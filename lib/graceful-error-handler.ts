import { DiscoveryResult, ActionMetadata, ActionRegistry } from './types'

/**
 * Enhanced error types for graceful error handling
 */
export interface ActionDiscoveryError extends Error {
  code: 'DISCOVERY_IN_PROGRESS' | 'API_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'UNKNOWN_ERROR'
  retryable: boolean
  context?: Record<string, any>
  originalError?: Error
  timestamp: number
}

export interface ErrorHandlingOptions {
  enableFallbacks: boolean
  maxRetries: number
  retryDelay: number
  cacheTimeout: number
  logErrors: boolean
}

export interface FallbackDataSource {
  name: string
  getData: () => Promise<DiscoveryResult>
  priority: number
  enabled: boolean
}

export interface ErrorContext {
  operation: string
  timestamp: number
  attempt: number
  userAgent?: string
  networkStatus?: string
  additionalData?: Record<string, any>
}

/**
 * GracefulErrorHandler provides comprehensive error handling with fallback strategies
 * for the ActionLoom application, ensuring users always receive meaningful feedback
 * and the system continues to function even when primary services fail.
 */
export class GracefulErrorHandler {
  private fallbackSources: Map<string, FallbackDataSource> = new Map()
  private cachedData: Map<string, { data: DiscoveryResult; timestamp: number }> = new Map()
  private errorLog: ActionDiscoveryError[] = []
  private options: ErrorHandlingOptions

  constructor(options: Partial<ErrorHandlingOptions> = {}) {
    this.options = {
      enableFallbacks: true,
      maxRetries: 3,
      retryDelay: 1000,
      cacheTimeout: 300000, // 5 minutes
      logErrors: true,
      ...options
    }

    this.initializeFallbackSources()
  }

  /**
   * Main error handling method that processes errors and returns appropriate responses
   */
  async handleDiscoveryError(
    error: ActionDiscoveryError,
    context: ErrorContext
  ): Promise<DiscoveryResult> {
    this.logError(error, context)

    switch (error.code) {
      case 'DISCOVERY_IN_PROGRESS':
        return this.handleConcurrencyError(error, context)
      
      case 'API_ERROR':
        return this.handleAPIError(error, context)
      
      case 'NETWORK_ERROR':
        return this.handleNetworkError(error, context)
      
      case 'TIMEOUT':
        return this.handleTimeoutError(error, context)
      
      case 'VALIDATION_ERROR':
        return this.handleValidationError(error, context)
      
      default:
        return this.handleUnknownError(error, context)
    }
  }

  /**
   * Creates a standardized ActionDiscoveryError from various error types
   */
  createActionDiscoveryError(
    originalError: Error,
    code: ActionDiscoveryError['code'],
    context?: Record<string, any>
  ): ActionDiscoveryError {
    const error = new Error(originalError.message) as ActionDiscoveryError
    error.name = 'ActionDiscoveryError'
    error.code = code
    error.retryable = this.isRetryableError(code)
    error.context = context
    error.originalError = originalError
    error.timestamp = Date.now()
    
    return error
  }

  /**
   * Generates user-friendly error messages based on error type and context
   */
  getUserFriendlyMessage(error: ActionDiscoveryError): string {
    const baseMessages = {
      'DISCOVERY_IN_PROGRESS': 'Action discovery is currently running. Please wait a moment...',
      'API_ERROR': 'Unable to connect to the action registry. Using cached data if available.',
      'NETWORK_ERROR': 'Network connection issue detected. Trying alternative sources...',
      'TIMEOUT': 'Request timed out. Attempting to use cached data...',
      'VALIDATION_ERROR': 'Invalid data received from action registry. Using fallback data...',
      'UNKNOWN_ERROR': 'An unexpected error occurred. Using cached data if available...'
    }

    let message = baseMessages[error.code] || baseMessages['UNKNOWN_ERROR']
    
    // Add context-specific information
    if (error.context?.retryAttempt) {
      message += ` (Attempt ${error.context.retryAttempt}/${this.options.maxRetries})`
    }

    return message
  }

  /**
   * Registers a fallback data source
   */
  registerFallbackSource(source: FallbackDataSource): void {
    this.fallbackSources.set(source.name, source)
  }

  /**
   * Removes a fallback data source
   */
  unregisterFallbackSource(name: string): void {
    this.fallbackSources.delete(name)
  }

  /**
   * Clears cached data (useful for testing or manual cache invalidation)
   */
  clearCache(): void {
    this.cachedData.clear()
  }

  /**
   * Gets error statistics for monitoring
   */
  getErrorStats(): {
    totalErrors: number
    errorsByType: Record<string, number>
    recentErrors: ActionDiscoveryError[]
  } {
    const errorsByType: Record<string, number> = {}
    
    this.errorLog.forEach(error => {
      errorsByType[error.code] = (errorsByType[error.code] || 0) + 1
    })

    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      recentErrors: this.errorLog.slice(-10) // Last 10 errors
    }
  }

  private async handleConcurrencyError(
    error: ActionDiscoveryError,
    context: ErrorContext
  ): Promise<DiscoveryResult> {
    // For concurrency errors, we should wait and then return cached data if available
    await this.delay(500) // Brief delay to allow ongoing discovery to complete
    
    const cachedResult = this.getCachedData('discovery')
    if (cachedResult) {
      return cachedResult
    }

    return this.getEmptyResult('Waiting for ongoing discovery to complete')
  }

  private async handleAPIError(
    error: ActionDiscoveryError,
    context: ErrorContext
  ): Promise<DiscoveryResult> {
    // Try fallback sources first
    if (this.options.enableFallbacks) {
      const fallbackResult = await this.tryFallbackSources()
      if (fallbackResult) {
        return fallbackResult
      }
    }

    // Return cached data if available
    const cachedResult = this.getCachedData('discovery')
    if (cachedResult) {
      return cachedResult
    }

    return this.getEmptyResult('API temporarily unavailable')
  }

  private async handleNetworkError(
    error: ActionDiscoveryError,
    context: ErrorContext
  ): Promise<DiscoveryResult> {
    // Network errors should prioritize cached data
    const cachedResult = this.getCachedData('discovery')
    if (cachedResult) {
      return cachedResult
    }

    // Try fallback sources
    if (this.options.enableFallbacks) {
      const fallbackResult = await this.tryFallbackSources()
      if (fallbackResult) {
        return fallbackResult
      }
    }

    return this.getEmptyResult('Network connection unavailable')
  }

  private async handleTimeoutError(
    error: ActionDiscoveryError,
    context: ErrorContext
  ): Promise<DiscoveryResult> {
    // For timeouts, prefer cached data over fallbacks for speed
    const cachedResult = this.getCachedData('discovery')
    if (cachedResult) {
      return cachedResult
    }

    return this.getEmptyResult('Request timed out')
  }

  private async handleValidationError(
    error: ActionDiscoveryError,
    context: ErrorContext
  ): Promise<DiscoveryResult> {
    // Validation errors suggest bad data, so prefer fallbacks over cache
    if (this.options.enableFallbacks) {
      const fallbackResult = await this.tryFallbackSources()
      if (fallbackResult) {
        return fallbackResult
      }
    }

    const cachedResult = this.getCachedData('discovery')
    if (cachedResult) {
      return cachedResult
    }

    return this.getEmptyResult('Invalid data received')
  }

  private async handleUnknownError(
    error: ActionDiscoveryError,
    context: ErrorContext
  ): Promise<DiscoveryResult> {
    // For unknown errors, try all recovery strategies
    const cachedResult = this.getCachedData('discovery')
    if (cachedResult) {
      return cachedResult
    }

    if (this.options.enableFallbacks) {
      const fallbackResult = await this.tryFallbackSources()
      if (fallbackResult) {
        return fallbackResult
      }
    }

    return this.getEmptyResult('An unexpected error occurred')
  }

  private async tryFallbackSources(): Promise<DiscoveryResult | null> {
    const enabledSources = Array.from(this.fallbackSources.values())
      .filter(source => source.enabled)
      .sort((a, b) => b.priority - a.priority)

    for (const source of enabledSources) {
      try {
        const result = await source.getData()
        if (result && result.actions.length > 0) {
          return result
        }
      } catch (fallbackError) {
        // Log fallback errors but continue trying other sources
        if (this.options.logErrors) {
          console.warn(`Fallback source ${source.name} failed:`, fallbackError)
        }
      }
    }

    return null
  }

  private getCachedData(key: string): DiscoveryResult | null {
    const cached = this.cachedData.get(key)
    if (!cached) {
      return null
    }

    const isExpired = Date.now() - cached.timestamp > this.options.cacheTimeout
    if (isExpired) {
      this.cachedData.delete(key)
      return null
    }

    return cached.data
  }

  private setCachedData(key: string, data: DiscoveryResult): void {
    this.cachedData.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  private getEmptyResult(reason: string): DiscoveryResult {
    return {
      actions: [],
      registries: [],
      lastUpdated: new Date().toISOString(),
      totalFound: 0,
      executionTime: 0,
      errors: [reason]
    }
  }

  private isRetryableError(code: ActionDiscoveryError['code']): boolean {
    return ['API_ERROR', 'NETWORK_ERROR', 'TIMEOUT'].includes(code)
  }

  private logError(error: ActionDiscoveryError, context: ErrorContext): void {
    if (!this.options.logErrors) {
      return
    }

    // Add to internal error log
    this.errorLog.push(error)

    // Keep only last 100 errors to prevent memory leaks
    if (this.errorLog.length > 100) {
      this.errorLog.splice(0, this.errorLog.length - 100)
    }

    // Log to console with structured information
    console.error('ActionDiscovery Error:', {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      context: error.context,
      operation: context.operation,
      timestamp: new Date(error.timestamp).toISOString(),
      userFriendlyMessage: this.getUserFriendlyMessage(error)
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private initializeFallbackSources(): void {
    // Register default fallback source for basic actions
    this.registerFallbackSource({
      name: 'basic-actions',
      priority: 1,
      enabled: true,
      getData: async (): Promise<DiscoveryResult> => {
        // Return a minimal set of basic actions that should always be available
        const basicActions: ActionMetadata[] = [
          {
            id: 'transfer-flow',
            name: 'Transfer FLOW',
            description: 'Transfer FLOW tokens to another account',
            category: 'Token',
            version: '1.0.0',
            inputs: [
              { name: 'to', type: 'Address', required: true, description: 'Recipient address' },
              { name: 'amount', type: 'UFix64', required: true, description: 'Amount to transfer' }
            ],
            outputs: [
              { name: 'success', type: 'Bool', description: 'Transfer success status' }
            ],
            parameters: [],
            compatibility: {
              requiredCapabilities: [],
              supportedNetworks: ['testnet', 'mainnet'],
              minimumFlowVersion: '1.0.0',
              conflictsWith: []
            },
            gasEstimate: 1000,
            securityLevel: 'medium' as any,
            author: 'ActionLoom',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]

        const basicRegistries: ActionRegistry[] = [
          {
            address: '0x0000000000000000',
            name: 'Basic Actions',
            description: 'Fallback registry with essential actions',
            actions: ['transfer-flow']
          }
        ]

        return {
          actions: basicActions,
          registries: basicRegistries,
          lastUpdated: new Date().toISOString(),
          totalFound: basicActions.length,
          executionTime: 0,
          errors: ['Using fallback basic actions']
        }
      }
    })
  }

  /**
   * Cache successful discovery results for future fallback use
   */
  cacheDiscoveryResult(result: DiscoveryResult): void {
    if (result.actions.length > 0) {
      this.setCachedData('discovery', result)
    }
  }
}

// Export a singleton instance for use across the application
export const gracefulErrorHandler = new GracefulErrorHandler()