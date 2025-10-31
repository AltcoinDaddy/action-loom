import { FlowAPIConfig, FlowNetwork, ActionRegistry, ActionMetadata, DiscoveryResult } from './types'
import { FLOW_NETWORKS, DEFAULT_FLOW_CONFIG, FORTE_CONSTANTS, FlowErrorCode } from './flow-config'
import { FlowErrorHandler, FlowNetworkError, FlowScriptError, retryFlowOperation } from './flow-errors'
import { ActionMetadataParser } from './action-metadata-parser'
import { CircuitBreaker, CircuitBreakerConfig, CircuitBreakerError, ExponentialBackoff } from './circuit-breaker'
import { logger } from './logging-service'

export interface APIErrorContext {
  endpoint: string
  method: string
  attempt: number
  lastError?: Error
  requestId?: string
  timestamp: number
}

export class FlowAPIClient {
  private config: FlowAPIConfig
  private baseURL: string
  private requestCount: number = 0
  private lastRequestTime: number = 0
  private circuitBreaker: CircuitBreaker
  private backoff: ExponentialBackoff
  private requestIdCounter: number = 0

  constructor(config: FlowAPIConfig) {
    this.config = config
    this.baseURL = config.network.endpoint
    this.validateConfig()
    
    // Initialize circuit breaker with sensible defaults
    const circuitBreakerConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 120000, // 2 minutes
      halfOpenMaxCalls: 3
    }
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig)
    
    // Initialize exponential backoff
    this.backoff = new ExponentialBackoff(1000, 30000, 2, true)
  }

  /**
   * Validate client configuration
   */
  private validateConfig(): void {
    if (!this.config.network?.endpoint) {
      throw new Error('Flow network endpoint is required')
    }
    if (!this.config.network?.chainId) {
      throw new Error('Flow network chainId is required')
    }
    if (this.config.timeout <= 0) {
      throw new Error('Timeout must be positive')
    }
    if (this.config.retryAttempts < 0) {
      throw new Error('Retry attempts cannot be negative')
    }
  }

  /**
   * Switch to a different Flow network
   */
  switchNetwork(networkName: keyof typeof FLOW_NETWORKS): void {
    const network = FLOW_NETWORKS[networkName]
    if (!network) {
      throw new Error(`Unknown network: ${networkName}`)
    }
    this.config.network = network
    this.baseURL = network.endpoint
  }

  /**
   * Get current network information
   */
  getCurrentNetwork(): FlowNetwork {
    return this.config.network
  }

  /**
   * Check if the current network is healthy
   */
  async checkNetworkHealth(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/v1/network/parameters', {
        method: 'GET'
      })
      return response.ok
    } catch (error) {
      console.warn(`Network health check failed for ${this.config.network.name}:`, error)
      return false
    }
  }

  /**
   * Query Flow Access API for Action registries
   */
  async discoverActionRegistries(): Promise<ActionRegistry[]> {
    try {
      // Check network health before making request
      const isHealthy = await this.checkNetworkHealth()
      if (!isHealthy) {
        throw new FlowNetworkError(`Network ${this.config.network.name} is not healthy`, {
          network: this.config.network.name,
          endpoint: this.config.network.endpoint
        })
      }

      const response = await this.makeRequest('/v1/scripts', {
        method: 'POST',
        body: JSON.stringify({
          script: this.getRegistryDiscoveryScript(),
          arguments: []
        })
      })

      const data = await response.json()
      const registries = this.parseRegistryData(data)
      
      console.log(`Discovered ${registries.length} Action registries on ${this.config.network.name}`)
      return registries
    } catch (error) {
      const enhancedError = FlowErrorHandler.handleAPIError({
        message: `Failed to discover Action registries on ${this.config.network.name}`,
        originalError: error,
        context: {
          network: this.config.network.name,
          endpoint: this.config.network.endpoint
        }
      })
      console.error('Error discovering Action registries:', enhancedError)
      throw enhancedError
    }
  }

  /**
   * Query specific Action metadata from registry
   */
  async getActionMetadata(registryAddress: string, actionId: string): Promise<ActionMetadata | null> {
    try {
      // Validate inputs
      if (!registryAddress || !actionId) {
        throw new Error('Registry address and action ID are required')
      }

      const response = await this.makeRequest('/v1/scripts', {
        method: 'POST',
        body: JSON.stringify({
          script: this.getActionMetadataScript(),
          arguments: [
            { type: 'Address', value: registryAddress },
            { type: 'String', value: actionId }
          ]
        })
      })

      const data = await response.json()
      const metadata = this.parseActionMetadata(data)
      
      if (metadata) {
        console.log(`Retrieved metadata for Action ${actionId} from registry ${registryAddress}`)
      }
      
      return metadata
    } catch (error) {
      const enhancedError = FlowErrorHandler.handleAPIError({
        message: `Failed to get Action metadata for ${actionId} from registry ${registryAddress}`,
        originalError: error,
        context: {
          registryAddress,
          actionId,
          network: this.config.network.name
        }
      })
      console.error('Error getting Action metadata:', enhancedError)
      
      // Return null for non-critical errors to allow batch operations to continue
      if (error instanceof FlowNetworkError && error.retryable) {
        throw enhancedError
      }
      return null
    }
  }

  /**
   * Discover all available Actions from all registries
   */
  async discoverAllActions(): Promise<DiscoveryResult> {
    const startTime = Date.now()
    
    try {
      console.log(`Starting Action discovery on ${this.config.network.name}...`)
      
      const registries = await this.discoverActionRegistries()
      const actions: ActionMetadata[] = []
      const errors: string[] = []

      // Query each registry for its Actions with parallel processing
      const discoveryPromises = registries.map(async (registry) => {
        const registryActions: ActionMetadata[] = []
        
        // Process actions in batches to avoid overwhelming the API
        const batchSize = 5
        for (let i = 0; i < registry.actions.length; i += batchSize) {
          const batch = registry.actions.slice(i, i + batchSize)
          
          const batchPromises = batch.map(async (actionId) => {
            try {
              const metadata = await this.getActionMetadata(registry.address, actionId)
              if (metadata) {
                registryActions.push(metadata)
              }
            } catch (error) {
              errors.push(`Failed to get metadata for ${actionId} from ${registry.address}: ${error.message}`)
            }
          })
          
          await Promise.all(batchPromises)
          
          // Small delay between batches to be respectful to the API
          if (i + batchSize < registry.actions.length) {
            await this.delay(200)
          }
        }
        
        return registryActions
      })

      const registryResults = await Promise.all(discoveryPromises)
      registryResults.forEach(registryActions => {
        actions.push(...registryActions)
      })

      const executionTime = Date.now() - startTime
      console.log(`Action discovery completed in ${executionTime}ms. Found ${actions.length} actions from ${registries.length} registries.`)
      
      if (errors.length > 0) {
        console.warn(`Discovery completed with ${errors.length} errors:`, errors)
      }

      return {
        actions,
        registries,
        lastUpdated: new Date().toISOString(),
        totalFound: actions.length,
        executionTime,
        errors: errors.length > 0 ? errors : undefined
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      const enhancedError = FlowErrorHandler.handleAPIError({
        message: `Failed to discover Actions on ${this.config.network.name}`,
        originalError: error,
        context: {
          network: this.config.network.name,
          executionTime
        }
      })
      console.error('Error discovering all Actions:', enhancedError)
      throw enhancedError
    }
  }

  /**
   * Execute a Cadence script
   */
  async executeScript(script: string, args: any[] = []): Promise<any> {
    try {
      const response = await this.makeRequest('/v1/scripts', {
        method: 'POST',
        body: JSON.stringify({
          script,
          arguments: args
        })
      })

      if (!response.ok) {
        throw new Error(`Script execution failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error executing script:', error)
      throw error
    }
  }

  /**
   * Get account information
   */
  async getAccount(address: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/v1/accounts/${address}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get account: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting account:', error)
      throw error
    }
  }

  /**
   * Submit transaction
   */
  async submitTransaction(transaction: any): Promise<string> {
    try {
      const response = await this.makeRequest('/v1/transactions', {
        method: 'POST',
        body: JSON.stringify(transaction)
      })

      if (!response.ok) {
        throw new Error(`Transaction submission failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data.id
    } catch (error) {
      console.error('Error submitting transaction:', error)
      throw error
    }
  }

  /**
   * Get transaction result
   */
  async getTransactionResult(transactionId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/v1/transaction_results/${transactionId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get transaction result: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting transaction result:', error)
      throw error
    }
  }

  /**
   * Make HTTP request with circuit breaker, retry logic and enhanced error handling
   */
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const correlationId = logger.generateCorrelationId()
    const context: APIErrorContext = {
      endpoint,
      method: options.method || 'GET',
      attempt: 0,
      requestId: correlationId,
      timestamp: Date.now()
    }

    // Log request start with structured logging
    logger.info(`Starting API request`, {
      correlationId,
      component: 'flow-api-client',
      operation: `${context.method} ${endpoint}`,
      metadata: {
        endpoint,
        method: context.method,
        network: this.config.network.name
      }
    })

    const startTime = performance.now()
    
    try {
      const response = await this.makeRequestWithCircuitBreaker(endpoint, options, context)
      const duration = performance.now() - startTime
      
      // Log successful request with performance metrics
      logger.logApiRequest(
        context.method,
        endpoint,
        response.status,
        duration,
        correlationId
      )
      
      return response
    } catch (error) {
      const duration = performance.now() - startTime
      
      // Log failed request with error details
      logger.logApiRequest(
        context.method,
        endpoint,
        0, // Unknown status code for failed requests
        duration,
        correlationId,
        error as Error
      )
      
      throw error
    }
  }

  /**
   * Make request with circuit breaker protection
   */
  private async makeRequestWithCircuitBreaker(
    endpoint: string, 
    options: RequestInit, 
    context: APIErrorContext
  ): Promise<Response> {
    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.makeRequestWithRetry(endpoint, options, context)
      })
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        console.error(`[${context.requestId}] Circuit breaker ${error.state}: ${error.message}`)
        throw new FlowNetworkError(
          `Service temporarily unavailable (Circuit breaker ${error.state})`,
          {
            endpoint,
            circuitBreakerState: error.state,
            requestId: context.requestId
          }
        )
      }
      throw error
    }
  }

  /**
   * Make request with retry logic and exponential backoff
   */
  private async makeRequestWithRetry(
    endpoint: string, 
    options: RequestInit, 
    context: APIErrorContext
  ): Promise<Response> {
    let lastError: Error

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      context.attempt = attempt
      
      try {
        // Rate limiting check
        await this.enforceRateLimit()
        
        const response = await this.executeSingleRequest(endpoint, options, context)
        
        // Log successful request
        logger.debug(`Request completed successfully`, {
          correlationId: context.requestId,
          component: 'flow-api-client',
          operation: `${context.method} ${endpoint}`,
          metadata: {
            attempt: attempt + 1,
            statusCode: response.status,
            network: this.config.network.name
          }
        })
        
        this.requestCount++
        this.lastRequestTime = Date.now()
        return response
        
      } catch (error) {
        lastError = error as Error
        context.lastError = lastError
        
        // Log attempt failure
        logger.warn(`Request attempt failed`, {
          correlationId: context.requestId,
          component: 'flow-api-client',
          operation: `${context.method} ${endpoint}`,
          metadata: {
            attempt: attempt + 1,
            error: error.message,
            network: this.config.network.name
          }
        })
        
        // Don't retry on the last attempt
        if (attempt === this.config.retryAttempts) {
          logger.error(`All retry attempts exhausted`, error as Error, {
            correlationId: context.requestId,
            component: 'flow-api-client',
            operation: `${context.method} ${endpoint}`,
            metadata: {
              totalAttempts: attempt + 1,
              network: this.config.network.name
            }
          })
          break
        }
        
        // Check if we should retry this error
        if (!this.shouldRetryRequest(error as Error, attempt)) {
          logger.info(`Error not retryable, failing immediately`, {
            correlationId: context.requestId,
            component: 'flow-api-client',
            operation: `${context.method} ${endpoint}`,
            metadata: {
              error: error.message,
              attempt: attempt + 1
            }
          })
          break
        }
        
        // Wait before retrying with exponential backoff
        const delay = this.backoff.calculateDelay(attempt)
        logger.info(`Retrying request with backoff`, {
          correlationId: context.requestId,
          component: 'flow-api-client',
          operation: `${context.method} ${endpoint}`,
          metadata: {
            delayMs: delay,
            nextAttempt: attempt + 2
          }
        })
        await this.backoff.delay(attempt)
      }
    }

    throw this.enhanceErrorWithContext(lastError!, context)
  }

  /**
   * Execute a single HTTP request
   */
  private async executeSingleRequest(
    endpoint: string, 
    options: RequestInit, 
    context: APIErrorContext
  ): Promise<Response> {
    const url = `${this.baseURL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ActionLoom/1.0',
      'X-Request-ID': context.requestId!,
      ...((options.headers as Record<string, string>) || {})
    }

    // Add API key if configured
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: controller.signal
    }

    try {
      const response = await fetch(url, requestOptions)
      
      // Handle different HTTP status codes
      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response)
        
        if (response.status === 400) {
          throw await this.handleBadRequestError(response, context, errorData)
        } else {
          throw this.createAPIError(response.status, response.statusText, errorData, context)
        }
      }
      
      return response
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new FlowNetworkError('Request timeout', { 
          timeout: this.config.timeout,
          endpoint,
          network: this.config.network.name,
          requestId: context.requestId
        })
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Enforce rate limiting to prevent overwhelming the API
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const minInterval = 100 // Minimum 100ms between requests
    
    if (timeSinceLastRequest < minInterval) {
      await this.delay(minInterval - timeSinceLastRequest)
    }
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`
  }

  /**
   * Determine if a request should be retried based on error type
   */
  private shouldRetryRequest(error: Error, attempt: number): boolean {
    // Don't retry if we've exceeded max attempts
    if (attempt >= this.config.retryAttempts) {
      return false
    }

    // Always retry network errors
    if (error instanceof FlowNetworkError) {
      return true
    }

    // Check if it's a FlowError with specific details
    if (error.name === 'FlowError' && (error as any).details) {
      const details = (error as any).details
      
      // Retry on server errors (5xx)
      if (details.status >= 500 && details.status < 600) {
        return true
      }
      
      // Retry on rate limit (429)
      if (details.status === 429) {
        return true
      }
      
      // Don't retry on client errors (4xx except 429)
      if (details.status >= 400 && details.status < 500 && details.status !== 429) {
        return false
      }
    }

    // Don't retry on 400 Bad Request errors (these are typically script errors)
    if (error.message.includes('Bad Request') || 
        error.message.includes('Invalid Cadence script') ||
        error.message.includes('Invalid script arguments') ||
        error.message.includes('Script execution failed') ||
        error.message.includes('Authentication failed') ||
        error.message.includes('Resource not found')) {
      return false
    }

    // Retry specific HTTP status codes mentioned in error message
    if (error.message.includes('500') || 
        error.message.includes('502') || 
        error.message.includes('503') || 
        error.message.includes('504') ||
        error.message.includes('429')) {
      return true
    }

    // Retry timeout errors
    if (error.message.includes('timeout') || error.name === 'AbortError') {
      return true
    }

    // Retry generic network errors
    if (error.message.toLowerCase().includes('network') || 
        error.message.toLowerCase().includes('fetch')) {
      return true
    }

    // Don't retry client errors (4xx except 429)
    if (error.message.includes('400') || 
        error.message.includes('401') || 
        error.message.includes('403') || 
        error.message.includes('404')) {
      return false
    }

    // Default to retrying unknown errors (conservative approach)
    return true
  }

  /**
   * Enhanced error handling for 400 Bad Request responses
   */
  private async handleBadRequestError(
    response: Response, 
    context: APIErrorContext, 
    errorData: any
  ): Promise<never> {
    const detailedError = {
      status: response.status,
      statusText: response.statusText,
      endpoint: context.endpoint,
      method: context.method,
      requestId: context.requestId,
      timestamp: context.timestamp,
      responseData: errorData
    }

    // Parse specific error types from Flow API
    let errorMessage = errorData.message || response.statusText || 'Bad Request'
    let errorCode = FlowErrorCode.SCRIPT_EXECUTION_ERROR

    // Check for specific Flow API error patterns
    if (errorData.code) {
      switch (errorData.code) {
        case 'invalid_script':
          errorMessage = `Invalid Cadence script: ${errorData.message}`
          errorCode = FlowErrorCode.SCRIPT_EXECUTION_ERROR
          break
        case 'invalid_arguments':
          errorMessage = `Invalid script arguments: ${errorData.message}`
          errorCode = FlowErrorCode.SCRIPT_EXECUTION_ERROR
          break
        case 'execution_failed':
          errorMessage = `Script execution failed: ${errorData.message}`
          errorCode = FlowErrorCode.SCRIPT_EXECUTION_ERROR
          break
        case 'account_not_found':
          errorMessage = `Account not found: ${errorData.message}`
          errorCode = FlowErrorCode.ACCOUNT_NOT_FOUND
          break
        default:
          errorMessage = `API Error (${errorData.code}): ${errorData.message}`
      }
    }

    // Log detailed error information
    console.error(`[${context.requestId}] 400 Bad Request Details:`, {
      url: `${this.baseURL}${context.endpoint}`,
      method: context.method,
      status: response.status,
      errorData,
      headers: Object.fromEntries(response.headers.entries())
    })

    throw FlowErrorHandler.handleAPIError({
      code: errorCode,
      message: errorMessage,
      details: detailedError
    })
  }

  /**
   * Enhance error with request context for better debugging
   */
  private enhanceErrorWithContext(error: Error, context: APIErrorContext): Error {
    const enhancedMessage = `${error.message} [Request: ${context.requestId}, Endpoint: ${context.endpoint}, Attempts: ${context.attempt + 1}]`
    
    if (error instanceof FlowNetworkError) {
      return new FlowNetworkError(enhancedMessage, {
        ...error.details,
        requestId: context.requestId,
        endpoint: context.endpoint,
        totalAttempts: context.attempt + 1,
        lastAttemptTime: context.timestamp
      })
    }

    return FlowErrorHandler.handleAPIError({
      message: enhancedMessage,
      originalError: error,
      context: {
        requestId: context.requestId,
        endpoint: context.endpoint,
        method: context.method,
        totalAttempts: context.attempt + 1,
        lastAttemptTime: context.timestamp
      }
    })
  }

  /**
   * Parse error response from API with enhanced error details
   */
  private async parseErrorResponse(response: Response): Promise<any> {
    try {
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        const jsonData = await response.json()
        return jsonData
      }
      
      const textData = await response.text()
      return { 
        message: textData || 'Unknown error occurred',
        rawResponse: textData
      }
    } catch (parseError) {
      console.warn('Failed to parse error response:', parseError)
      return { 
        message: 'Failed to parse error response',
        parseError: parseError.message
      }
    }
  }

  /**
   * Create appropriate error based on HTTP status with enhanced context
   */
  private createAPIError(
    status: number, 
    statusText: string, 
    errorData: any, 
    context?: APIErrorContext
  ): Error {
    const message = errorData.message || statusText || 'Unknown error'
    const errorDetails = {
      ...errorData,
      status,
      statusText,
      network: this.config.network.name,
      ...(context && {
        requestId: context.requestId,
        endpoint: context.endpoint,
        method: context.method,
        timestamp: context.timestamp
      })
    }
    
    switch (status) {
      case 400:
        return FlowErrorHandler.handleAPIError({
          code: FlowErrorCode.SCRIPT_EXECUTION_ERROR,
          message: `Bad Request: ${message}`,
          details: errorDetails
        })
      case 401:
        return FlowErrorHandler.handleAPIError({
          code: FlowErrorCode.AUTHENTICATION_ERROR,
          message: `Authentication failed: ${message}`,
          details: errorDetails
        })
      case 404:
        return FlowErrorHandler.handleAPIError({
          code: FlowErrorCode.ACCOUNT_NOT_FOUND,
          message: `Resource not found: ${message}`,
          details: errorDetails
        })
      case 429:
        return FlowErrorHandler.handleAPIError({
          code: FlowErrorCode.RATE_LIMIT_EXCEEDED,
          message: `Rate limit exceeded: ${message}`,
          details: errorDetails
        })
      case 500:
      case 502:
      case 503:
      case 504:
        return new FlowNetworkError(`Server error (${status}): ${message}`, {
          ...errorDetails,
          retryable: true
        })
      default:
        return FlowErrorHandler.handleAPIError({
          message: `HTTP ${status}: ${message}`,
          details: errorDetails
        })
    }
  }

  /**
   * Get circuit breaker metrics for monitoring
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics()
  }

  /**
   * Reset circuit breaker to initial state
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
    console.log('Circuit breaker reset to CLOSED state')
  }

  /**
   * Get request statistics
   */
  getRequestStats() {
    return {
      totalRequests: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      circuitBreakerMetrics: this.circuitBreaker.getMetrics(),
      network: this.config.network.name
    }
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get Cadence script for discovering Action registries
   */
  private getRegistryDiscoveryScript(): string {
    return `
      // Cadence script to discover Action registries
      // This is a placeholder - actual implementation would depend on Forte's registry structure
      pub fun main(): [Address] {
        // Query known registry addresses or discover them dynamically
        // This would be replaced with actual Forte registry discovery logic
        return []
      }
    `
  }

  /**
   * Get Cadence script for querying Action metadata
   */
  private getActionMetadataScript(): string {
    return `
      // Cadence script to get Action metadata
      // This is a placeholder - actual implementation would depend on Forte's Action structure
      pub fun main(registryAddress: Address, actionId: String): ActionMetadata? {
        // Query the registry for Action metadata
        // This would be replaced with actual Forte Action metadata query logic
        return nil
      }
    `
  }

  /**
   * Parse registry discovery response
   */
  private parseRegistryData(data: any): ActionRegistry[] {
    // This would parse the actual response from Flow
    // For now, return empty array as placeholder
    return []
  }

  /**
   * Parse Action metadata response
   */
  private parseActionMetadata(data: any): ActionMetadata | null {
    try {
      // Extract the actual metadata from the Flow API response
      // The response structure may vary, so we handle different formats
      let metadataPayload = data
      
      // Handle wrapped responses
      if (data.value) {
        metadataPayload = data.value
      } else if (data.result) {
        metadataPayload = data.result
      } else if (data.data) {
        metadataPayload = data.data
      }

      return ActionMetadataParser.parseActionMetadata(metadataPayload)
    } catch (error) {
      console.error('Failed to parse Action metadata response:', error)
      return null
    }
  }
}

/**
 * Create a Flow API client with default configuration
 */
export function createFlowAPIClient(
  network: keyof typeof FLOW_NETWORKS = 'testnet',
  apiKey?: string
): FlowAPIClient {
  const config: FlowAPIConfig = {
    network: FLOW_NETWORKS[network],
    apiKey,
    timeout: 30000, // 30 seconds
    retryAttempts: 3
  }

  return new FlowAPIClient(config)
}

/**
 * Get default Flow API client instance for testnet (lazy-loaded)
 */
let _defaultFlowClient: FlowAPIClient | null = null
export const getDefaultFlowClient = (): FlowAPIClient => {
  if (!_defaultFlowClient) {
    _defaultFlowClient = createFlowAPIClient('testnet')
  }
  return _defaultFlowClient
}