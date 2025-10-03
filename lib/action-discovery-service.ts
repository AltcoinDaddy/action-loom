import { FlowAPIClient, createFlowAPIClient } from './flow-api-client'
import { ActionMetadataParser } from './action-metadata-parser'
import { RedisCacheManager, createRedisCacheManager } from './redis-cache-manager'
import { SemanticSearchEngine, SearchResult, SearchOptions, createSemanticSearchEngine } from './semantic-search-engine'
import {
  ActionMetadata,
  DiscoveryResult,
  ValidationResult,
  CompatibilityIssue,
  FlowNetwork,
  SecurityLevel
} from './types'
import { FLOW_NETWORKS, FORTE_CONSTANTS } from './flow-config'
import { logger } from './logging-service'

/**
 * Interface for queued discovery requests
 */
interface QueuedDiscoveryRequest {
  id: string
  forceRefresh: boolean
  resolve: (result: DiscoveryResult) => void
  reject: (error: Error) => void
  timestamp: number
}

/**
 * Service for discovering and managing Actions from Flow blockchain
 */
export class ActionDiscoveryService {
  private client: FlowAPIClient
  private cacheManager: RedisCacheManager
  private searchEngine: SemanticSearchEngine
  private activeDiscovery: Promise<DiscoveryResult> | null = null
  private requestQueue: QueuedDiscoveryRequest[] = []
  private backgroundRefreshTimer?: NodeJS.Timeout

  constructor(
    client?: FlowAPIClient,
    cacheManager?: RedisCacheManager,
    searchEngine?: SemanticSearchEngine
  ) {
    this.client = client || createFlowAPIClient('testnet')
    this.cacheManager = cacheManager || createRedisCacheManager()
    this.searchEngine = searchEngine || createSemanticSearchEngine()
    this.setupBackgroundRefresh()
  }

  /**
   * Discover all available Actions with Redis caching and search indexing
   */
  async discoverActions(forceRefresh: boolean = false): Promise<DiscoveryResult> {
    const correlationId = logger.generateCorrelationId()
    const timingId = logger.startTiming('action-discovery', correlationId)

    logger.info('Action discovery requested', {
      correlationId,
      component: 'action-discovery-service',
      operation: 'discover-actions',
      metadata: { forceRefresh }
    })

    try {
      // Try to get cached results first if not forcing refresh
      if (!forceRefresh) {
        const cachedResult = await this.cacheManager.getCachedDiscoveryResult()
        if (cachedResult) {
          logger.info('Returning cached Action discovery results', {
            correlationId,
            component: 'action-discovery-service',
            operation: 'discover-actions',
            metadata: {
              source: 'cache',
              actionCount: cachedResult.actions.length
            }
          })

          // Ensure search index is up to date
          await this.searchEngine.indexActions(cachedResult.actions)
          logger.endTiming(correlationId, 'action-discovery', true)
          return cachedResult
        }
      }

      // If there's already an active discovery, queue this request
      if (this.activeDiscovery) {
        logger.info('Discovery already in progress, queuing request', {
          correlationId,
          component: 'action-discovery-service',
          operation: 'discover-actions',
          metadata: { queueLength: this.requestQueue.length }
        })
        return this.queueDiscoveryRequest(forceRefresh)
      }

      // Start new discovery
      const result = await this.startDiscovery(forceRefresh)
      logger.endTiming(correlationId, 'action-discovery', true)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.endTiming(correlationId, 'action-discovery', false, errorMessage)
      logger.error('Action discovery failed', error as Error, {
        correlationId,
        component: 'action-discovery-service',
        operation: 'discover-actions',
        metadata: { forceRefresh }
      })
      throw error
    }
  }

  /**
   * Queue a discovery request when one is already in progress
   */
  private queueDiscoveryRequest(forceRefresh: boolean): Promise<DiscoveryResult> {
    return new Promise<DiscoveryResult>((resolve, reject) => {
      const requestId = logger.generateCorrelationId()
      const queuedRequest: QueuedDiscoveryRequest = {
        id: requestId,
        forceRefresh,
        resolve,
        reject,
        timestamp: Date.now()
      }

      this.requestQueue.push(queuedRequest)

      logger.info('Discovery request queued', {
        correlationId: requestId,
        component: 'action-discovery-service',
        operation: 'queue-discovery-request',
        metadata: {
          queueLength: this.requestQueue.length,
          forceRefresh
        }
      })

      // Set a timeout for the request to prevent hanging
      setTimeout(() => {
        this.timeoutQueuedRequest(requestId)
      }, 30000) // 30 second timeout
    })
  }

  /**
   * Start a new discovery process
   */
  private async startDiscovery(forceRefresh: boolean): Promise<DiscoveryResult> {
    const correlationId = logger.generateCorrelationId()

    logger.info('Starting fresh Action discovery', {
      correlationId,
      component: 'action-discovery-service',
      operation: 'start-discovery',
      metadata: {
        forceRefresh,
        queuedRequests: this.requestQueue.length
      }
    })

    this.activeDiscovery = this.performDiscovery(correlationId)

    try {
      const result = await this.activeDiscovery

      logger.info('Discovery completed successfully', {
        correlationId,
        component: 'action-discovery-service',
        operation: 'start-discovery',
        metadata: {
          actionCount: result.actions.length,
          registryCount: result.registries.length,
          executionTime: result.executionTime
        }
      })

      // Process any queued requests
      this.processQueuedRequests(result, null)

      return result
    } catch (error) {
      logger.error('Discovery failed', error as Error, {
        correlationId,
        component: 'action-discovery-service',
        operation: 'start-discovery'
      })

      // Process queued requests with error
      this.processQueuedRequests(null, error as Error)
      throw error
    } finally {
      this.activeDiscovery = null
    }
  }

  /**
   * Perform the actual discovery operation
   */
  private async performDiscovery(correlationId?: string): Promise<DiscoveryResult> {
    const id = correlationId || logger.generateCorrelationId()

    try {
      logger.info('Performing action discovery', {
        correlationId: id,
        component: 'action-discovery-service',
        operation: 'perform-discovery'
      })

      const result = await this.client.discoverAllActions()

      // Cache the results
      await this.cacheManager.cacheDiscoveryResult(result, FORTE_CONSTANTS.ACTION_CACHE_TTL)

      // Index actions for search
      await this.searchEngine.indexActions(result.actions)

      logger.info('Discovery completed and cached', {
        correlationId: id,
        component: 'action-discovery-service',
        operation: 'perform-discovery',
        metadata: {
          actionCount: result.actions.length,
          registryCount: result.registries.length,
          executionTime: result.executionTime,
          cached: true,
          indexed: true
        }
      })

      return result
    } catch (error) {
      logger.error('Discovery operation failed', error as Error, {
        correlationId: id,
        component: 'action-discovery-service',
        operation: 'perform-discovery'
      })
      throw error
    }
  }

  /**
   * Process all queued requests with the result or error
   */
  private processQueuedRequests(result: DiscoveryResult | null, error: Error | null): void {
    const queueLength = this.requestQueue.length
    if (queueLength === 0) return

    logger.info('Processing queued discovery requests', {
      correlationId: logger.generateCorrelationId(),
      component: 'action-discovery-service',
      operation: 'process-queued-requests',
      metadata: {
        queueLength,
        hasResult: !!result,
        hasError: !!error
      }
    })

    // Process all queued requests
    const requests = [...this.requestQueue]
    this.requestQueue = []

    let successCount = 0
    let errorCount = 0

    for (const request of requests) {
      try {
        if (error) {
          request.reject(error)
          errorCount++
        } else if (result) {
          request.resolve(result)
          successCount++
        } else {
          request.reject(new Error('Discovery completed but no result available'))
          errorCount++
        }
      } catch (requestError) {
        logger.error('Error processing queued request', requestError as Error, {
          correlationId: request.id,
          component: 'action-discovery-service',
          operation: 'process-queued-requests'
        })
        errorCount++
      }
    }

    logger.info('Queued requests processed', {
      correlationId: logger.generateCorrelationId(),
      component: 'action-discovery-service',
      operation: 'process-queued-requests',
      metadata: {
        totalProcessed: requests.length,
        successCount,
        errorCount
      }
    })
  }

  /**
   * Handle timeout for a queued request
   */
  private timeoutQueuedRequest(requestId: string): void {
    const requestIndex = this.requestQueue.findIndex(req => req.id === requestId)
    if (requestIndex === -1) return // Request already processed

    const request = this.requestQueue[requestIndex]
    this.requestQueue.splice(requestIndex, 1)

    console.warn(`Discovery request ${requestId} timed out`)
    request.reject(new Error('Discovery request timed out'))
  }

  /**
   * Get a specific Action by ID
   */
  async getAction(actionId: string): Promise<ActionMetadata | null> {
    // Check Redis cache first
    const cachedAction = await this.cacheManager.getCachedAction(actionId)
    if (cachedAction) {
      return cachedAction
    }

    // If not in cache, trigger discovery
    try {
      await this.discoverActions()
      return await this.cacheManager.getCachedAction(actionId)
    } catch (error) {
      console.error(`Failed to get Action ${actionId}:`, error)
      return null
    }
  }

  /**
   * Search Actions using semantic search engine
   */
  async searchActions(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Get all cached actions or trigger discovery
    const discoveryResult = await this.discoverActions()
    const actions = discoveryResult.actions

    // Use semantic search engine for advanced search
    return await this.searchEngine.searchActions(query, actions, options)
  }

  /**
   * Simple search that returns just ActionMetadata (for backward compatibility)
   */
  async searchActionsSimple(query: string, limit: number = 20): Promise<ActionMetadata[]> {
    const searchResults = await this.searchActions(query, { limit })
    return searchResults.map(result => result.action)
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSearchSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    const discoveryResult = await this.discoverActions()
    return await this.searchEngine.getSuggestions(partialQuery, discoveryResult.actions, limit)
  }

  /**
   * Find Actions similar to a given Action
   */
  async findSimilarActions(actionId: string, limit: number = 10): Promise<SearchResult[]> {
    const targetAction = await this.getAction(actionId)
    if (!targetAction) {
      throw new Error(`Action ${actionId} not found`)
    }

    const discoveryResult = await this.discoverActions()
    return await this.searchEngine.findSimilarActions(targetAction, discoveryResult.actions, limit)
  }

  /**
   * Get Actions by category
   */
  async getActionsByCategory(category: string): Promise<ActionMetadata[]> {
    // Try to get from category cache first
    const cachedActionIds = await this.cacheManager.getCachedActionsByCategory(category)
    if (cachedActionIds.length > 0) {
      const actions = await this.cacheManager.getCachedActions(cachedActionIds)
      const validActions = actions.filter(action => action !== null) as ActionMetadata[]
      if (validActions.length === cachedActionIds.length) {
        return validActions
      }
    }

    // Fallback to full discovery
    const discoveryResult = await this.discoverActions()
    return discoveryResult.actions.filter(
      action => action.category.toLowerCase() === category.toLowerCase()
    )
  }

  /**
   * Get all available categories
   */
  async getCategories(): Promise<string[]> {
    const discoveryResult = await this.discoverActions()
    const categories = new Set<string>()

    discoveryResult.actions.forEach(action => {
      categories.add(action.category)
    })

    return Array.from(categories).sort()
  }

  /**
   * Validate Action metadata
   */
  validateAction(action: ActionMetadata): ValidationResult {
    return ActionMetadataParser.validateMetadata(action)
  }

  /**
   * Check compatibility between Actions
   */
  checkActionCompatibility(sourceAction: ActionMetadata, targetAction: ActionMetadata): CompatibilityIssue[] {
    return ActionMetadataParser.checkCompatibility(sourceAction, targetAction)
  }

  /**
   * Validate a workflow chain of Actions
   */
  async validateWorkflowChain(actionIds: string[]): Promise<{
    isValid: boolean
    issues: CompatibilityIssue[]
    warnings: string[]
  }> {
    if (actionIds.length < 2) {
      return { isValid: true, issues: [], warnings: [] }
    }

    // Get all actions
    const actions: ActionMetadata[] = []
    for (const actionId of actionIds) {
      const action = await this.getAction(actionId)
      if (!action) {
        return {
          isValid: false,
          issues: [{
            sourceActionId: '',
            targetActionId: actionId,
            issue: `Action ${actionId} not found`,
            suggestion: 'Ensure the Action ID is correct and the Action is available'
          }],
          warnings: []
        }
      }
      actions.push(action)
    }

    // Check compatibility between consecutive actions
    const allIssues: CompatibilityIssue[] = []
    const warnings: string[] = []

    for (let i = 0; i < actions.length - 1; i++) {
      const sourceAction = actions[i]
      const targetAction = actions[i + 1]

      const issues = this.checkActionCompatibility(sourceAction, targetAction)
      allIssues.push(...issues)

      // Add warnings for potential issues
      if (sourceAction.gasEstimate + targetAction.gasEstimate > 5000) {
        warnings.push(`High gas estimate for chain ${sourceAction.name} -> ${targetAction.name}`)
      }
    }

    return {
      isValid: allIssues.length === 0,
      issues: allIssues,
      warnings
    }
  }

  /**
   * Switch to a different Flow network
   */
  switchNetwork(networkName: keyof typeof FLOW_NETWORKS): void {
    this.client.switchNetwork(networkName)
    // Clear cache when switching networks
    this.clearCache()
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): FlowNetwork {
    return this.client.getCurrentNetwork()
  }

  /**
   * Clear the Action cache
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.invalidateAll()
    console.log('Action cache cleared')
  }

  /**
   * Invalidate specific Action cache
   */
  async invalidateAction(actionId: string): Promise<void> {
    await this.cacheManager.invalidateAction(actionId)
  }

  /**
   * Invalidate category cache
   */
  async invalidateCategory(category: string): Promise<void> {
    await this.cacheManager.invalidateCategory(category)
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    redis: {
      totalKeys: number
      actionKeys: number
      categoryKeys: number
      discoveryKeys: number
    }
    isHealthy: boolean
  }> {
    const redisStats = await this.cacheManager.getCacheStats()
    const isHealthy = await this.cacheManager.isHealthy()

    return {
      redis: redisStats,
      isHealthy
    }
  }

  /**
   * Setup background refresh mechanism
   */
  private setupBackgroundRefresh(): void {
    // Set up background refresh every 30 minutes
    this.backgroundRefreshTimer = this.cacheManager.setupBackgroundRefresh(
      () => this.client.discoverAllActions(),
      30 // 30 minutes
    )
  }

  /**
   * Warm up the cache
   */
  async warmCache(): Promise<void> {
    await this.cacheManager.warmCache(() => this.client.discoverAllActions())
  }

  /**
   * Check cache health and connectivity
   */
  async checkCacheHealth(): Promise<boolean> {
    return await this.cacheManager.isHealthy()
  }

  /**
   * Get search engine statistics
   */
  getSearchStats(): {
    indexedActions: number
    keywordEntries: number
    lastIndexTime: string | null
  } {
    return this.searchEngine.getStats()
  }

  /**
   * Rebuild search index
   */
  async rebuildSearchIndex(): Promise<void> {
    const discoveryResult = await this.discoverActions()
    await this.searchEngine.indexActions(discoveryResult.actions)
    console.log('Search index rebuilt')
  }

  /**
   * Clear search index
   */
  clearSearchIndex(): void {
    this.searchEngine.clearIndex()
  }

  /**
   * Get queue statistics for monitoring
   */
  getQueueStats(): {
    queueLength: number
    activeDiscovery: boolean
    oldestRequestAge: number | null
  } {
    const now = Date.now()
    const oldestRequest = this.requestQueue.length > 0
      ? Math.min(...this.requestQueue.map(req => req.timestamp))
      : null

    return {
      queueLength: this.requestQueue.length,
      activeDiscovery: this.activeDiscovery !== null,
      oldestRequestAge: oldestRequest ? now - oldestRequest : null
    }
  }

  /**
   * Get pending request count for testing
   */
  getPendingRequestCount(): number {
    return this.requestQueue.length
  }

  /**
   * Discover actions with fallback behavior
   */
  async discoverActionsWithFallback(): Promise<DiscoveryResult> {
    try {
      return await this.discoverActions()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Primary discovery failed, using fallback', {
        component: 'action-discovery-service',
        operation: 'discover-actions-with-fallback',
        metadata: { error: errorMessage }
      })

      return {
        actions: this.getFallbackActions(),
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1,
        executionTime: 0
      }
    }
  }

  /**
   * Get fallback actions when API is unavailable
   */
  getFallbackActions(): ActionMetadata[] {
    return [
      {
        id: 'fallback-transfer',
        name: 'Basic Token Transfer',
        category: 'token',
        description: 'Transfer tokens between accounts (fallback)',
        version: '1.0.0',
        inputs: [
          { name: 'recipient', type: 'Address', description: 'Recipient address', required: true },
          { name: 'amount', type: 'UFix64', description: 'Amount to transfer', required: true }
        ],
        outputs: [
          { name: 'success', type: 'Bool', description: 'Transfer success' }
        ],
        parameters: [],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 100,
        securityLevel: SecurityLevel.LOW,
        author: 'ActionLoom',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer)
      this.backgroundRefreshTimer = undefined
    }

    // Reject any pending queued requests
    const pendingRequests = [...this.requestQueue]
    this.requestQueue = []

    for (const request of pendingRequests) {
      request.reject(new Error('Service is being cleaned up'))
    }

    // Wait for active discovery to complete if any
    if (this.activeDiscovery) {
      try {
        await this.activeDiscovery
      } catch (error) {
        // Ignore errors during cleanup
        console.warn('Active discovery failed during cleanup:', error)
      }
    }

    this.searchEngine.clearIndex()
    await this.cacheManager.close()
    console.log('Action discovery service cleaned up')
  }
}

/**
 * Default Action discovery service instance
 */
export const defaultActionDiscoveryService = new ActionDiscoveryService()

/**
 * Create a new Action discovery service with custom configuration
 */
export function createActionDiscoveryService(
  networkName: keyof typeof FLOW_NETWORKS = 'testnet',
  apiKey?: string,
  cacheManager?: RedisCacheManager,
  searchEngine?: SemanticSearchEngine
): ActionDiscoveryService {
  const client = createFlowAPIClient(networkName, apiKey)
  return new ActionDiscoveryService(client, cacheManager, searchEngine)
}