import { FlowAPIClient, createFlowAPIClient } from './flow-api-client'
import { OnChainActionScanner, createOnChainActionScanner } from './on-chain-action-scanner'
import { ContractMetadataParser, createContractMetadataParser } from './contract-metadata-parser'
import { ActionRegistryClient, createActionRegistryClient } from './action-registry-client'
import { RedisCacheManager, createRedisCacheManager } from './redis-cache-manager'
import { 
  ActionMetadata, 
  ActionRegistry, 
  DiscoveryResult,
  ValidationResult,
  FlowNetwork,
  Contract
} from './types'
import { FLOW_NETWORKS } from './flow-config'
import { logger } from './logging-service'

/**
 * Interface for enhanced discovery configuration
 */
export interface EnhancedDiscoveryConfig {
  network: keyof typeof FLOW_NETWORKS
  apiKey?: string
  enableCaching: boolean
  enableBackgroundRefresh: boolean
  enableFallback: boolean
  scannerConfig?: any
  parserConfig?: any
  registryConfig?: any
  cacheConfig?: any
}

/**
 * Interface for discovery metrics
 */
export interface DiscoveryMetrics {
  totalDiscoveries: number
  successfulDiscoveries: number
  failedDiscoveries: number
  averageDiscoveryTime: number
  cacheHitRate: number
  registryHealth: any[]
  lastDiscoveryTime: string
  backgroundRefreshStatus: string
}

/**
 * Enhanced Action Discovery Service - Integrates all discovery components
 */
export class EnhancedActionDiscoveryService {
  private client: FlowAPIClient
  private scanner: OnChainActionScanner
  private parser: ContractMetadataParser
  private registryClient: ActionRegistryClient
  private cacheManager: RedisCacheManager
  private config: EnhancedDiscoveryConfig

  private discoveryCount: number = 0
  private successCount: number = 0
  private failureCount: number = 0
  private totalDiscoveryTime: number = 0
  private lastDiscoveryTime?: string

  constructor(config: Partial<EnhancedDiscoveryConfig> = {}) {
    this.config = {
      network: 'testnet',
      enableCaching: true,
      enableBackgroundRefresh: true,
      enableFallback: true,
      ...config
    }

    // Initialize components
    this.client = createFlowAPIClient(this.config.network, this.config.apiKey)
    this.scanner = createOnChainActionScanner(this.client, this.config.scannerConfig)
    this.parser = createContractMetadataParser()
    this.cacheManager = createRedisCacheManager(this.config.cacheConfig)
    this.registryClient = createActionRegistryClient(
      this.client,
      this.scanner,
      this.parser,
      this.cacheManager,
      this.config.registryConfig
    )

    this.initialize()
  }

  /**
   * Initialize the enhanced discovery service
   */
  private async initialize(): Promise<void> {
    const correlationId = logger.generateCorrelationId()
    logger.info('Initializing Enhanced Action Discovery Service', {
      correlationId,
      component: 'enhanced-action-discovery-service',
      operation: 'initialize',
      metadata: {
        network: this.config.network,
        enableCaching: this.config.enableCaching,
        enableBackgroundRefresh: this.config.enableBackgroundRefresh,
        enableFallback: this.config.enableFallback
      }
    })

    try {
      // Setup caching if enabled
      if (this.config.enableCaching) {
        await this.registryClient.setupIntelligentCaching()
      }

      // Connect to registries
      await this.registryClient.connectToOfficialRegistries()

      logger.info('Enhanced Action Discovery Service initialized successfully', {
        correlationId,
        component: 'enhanced-action-discovery-service',
        operation: 'initialize'
      })

    } catch (error) {
      logger.error('Failed to initialize Enhanced Action Discovery Service', error as Error, {
        correlationId,
        component: 'enhanced-action-discovery-service',
        operation: 'initialize'
      })
      throw error
    }
  }

  /**
   * Discover all available Actions with comprehensive integration
   */
  async discoverActions(forceRefresh: boolean = false): Promise<DiscoveryResult> {
    const correlationId = logger.generateCorrelationId()
    const timingId = logger.startTiming('enhanced-discover-actions', correlationId)
    const startTime = Date.now()

    this.discoveryCount++

    logger.info('Starting enhanced Action discovery', {
      correlationId,
      component: 'enhanced-action-discovery-service',
      operation: 'discover-actions',
      metadata: {
        forceRefresh,
        network: this.config.network,
        discoveryCount: this.discoveryCount
      }
    })

    try {
      let result: DiscoveryResult

      if (!forceRefresh && this.config.enableCaching) {
        // Try to get cached results first
        const cachedResult = await this.cacheManager.getCachedDiscoveryResult()
        if (cachedResult) {
          logger.info('Returning cached discovery results', {
            correlationId,
            component: 'enhanced-action-discovery-service',
            operation: 'discover-actions',
            metadata: {
              source: 'cache',
              actionCount: cachedResult.actions.length
            }
          })
          
          this.successCount++
          this.updateMetrics(Date.now() - startTime)
          logger.endTiming(correlationId, 'enhanced-discover-actions', true)
          return cachedResult
        }
      }

      // Perform fresh discovery
      result = await this.performFreshDiscovery(correlationId)

      this.successCount++
      this.updateMetrics(Date.now() - startTime)
      logger.endTiming(correlationId, 'enhanced-discover-actions', true)
      return result

    } catch (error) {
      this.failureCount++
      this.updateMetrics(Date.now() - startTime)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.endTiming(correlationId, 'enhanced-discover-actions', false, errorMessage)
      logger.error('Enhanced Action discovery failed', error as Error, {
        correlationId,
        component: 'enhanced-action-discovery-service',
        operation: 'discover-actions'
      })

      // Try fallback if enabled
      if (this.config.enableFallback) {
        logger.info('Attempting fallback discovery', {
          correlationId,
          component: 'enhanced-action-discovery-service',
          operation: 'discover-actions'
        })
        return await this.performFallbackDiscovery()
      }

      throw error
    }
  }

  /**
   * Perform fresh discovery using all components
   */
  private async performFreshDiscovery(correlationId?: string): Promise<DiscoveryResult> {
    const id = correlationId || logger.generateCorrelationId()
    const startTime = Date.now()

    logger.info('Performing fresh Action discovery', {
      correlationId: id,
      component: 'enhanced-action-discovery-service',
      operation: 'perform-fresh-discovery'
    })

    try {
      // Step 1: Connect to registries
      const registries = await this.registryClient.connectToOfficialRegistries()
      logger.debug('Connected to registries', {
        correlationId: id,
        component: 'enhanced-action-discovery-service',
        operation: 'perform-fresh-discovery',
        metadata: { registryCount: registries.length }
      })

      // Step 2: Scan contracts for Actions
      const allActions: ActionMetadata[] = []
      const errors: string[] = []

      for (const registry of registries) {
        try {
          const registryActions = await this.discoverActionsFromRegistry(registry, id)
          allActions.push(...registryActions)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Failed to discover actions from registry ${registry.address}: ${errorMessage}`)
        }
      }

      // Step 3: Validate and filter Actions
      const validActions = await this.validateAndFilterActions(allActions, id)

      // Step 4: Create discovery result
      const result: DiscoveryResult = {
        actions: validActions,
        registries,
        lastUpdated: new Date().toISOString(),
        totalFound: validActions.length,
        executionTime: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined
      }

      // Step 5: Cache the results
      if (this.config.enableCaching) {
        await this.cacheManager.cacheDiscoveryResult(result, 3600) // 1 hour TTL
      }

      logger.info('Fresh discovery completed successfully', {
        correlationId: id,
        component: 'enhanced-action-discovery-service',
        operation: 'perform-fresh-discovery',
        metadata: {
          totalActions: validActions.length,
          registries: registries.length,
          executionTime: result.executionTime,
          errors: errors.length
        }
      })

      return result

    } catch (error) {
      logger.error('Fresh discovery failed', error as Error, {
        correlationId: id,
        component: 'enhanced-action-discovery-service',
        operation: 'perform-fresh-discovery'
      })
      throw error
    }
  }

  /**
   * Discover Actions from a specific registry
   */
  private async discoverActionsFromRegistry(
    registry: ActionRegistry, 
    correlationId?: string
  ): Promise<ActionMetadata[]> {
    const id = correlationId || logger.generateCorrelationId()
    const actions: ActionMetadata[] = []

    logger.debug('Discovering actions from registry', {
      correlationId: id,
      component: 'enhanced-action-discovery-service',
      operation: 'discover-actions-from-registry',
      metadata: {
        registryAddress: registry.address,
        actionCount: registry.actions.length
      }
    })

    // Process actions in batches
    const batchSize = 5
    for (let i = 0; i < registry.actions.length; i += batchSize) {
      const batch = registry.actions.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (actionId) => {
        try {
          // Get action metadata from registry
          const actionMetadata = await this.client.getActionMetadata(registry.address, actionId)
          if (actionMetadata) {
            actions.push(actionMetadata)
          }
        } catch (error) {
          logger.warn('Failed to get action metadata', {
            correlationId: id,
            component: 'enhanced-action-discovery-service',
            operation: 'discover-actions-from-registry',
            metadata: {
              registryAddress: registry.address,
              actionId,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        }
      })

      await Promise.all(batchPromises)

      // Small delay between batches
      if (i + batchSize < registry.actions.length) {
        await this.delay(100)
      }
    }

    return actions
  }

  /**
   * Validate and filter discovered Actions
   */
  private async validateAndFilterActions(
    actions: ActionMetadata[], 
    correlationId?: string
  ): Promise<ActionMetadata[]> {
    const id = correlationId || logger.generateCorrelationId()
    const validActions: ActionMetadata[] = []

    logger.debug('Validating and filtering actions', {
      correlationId: id,
      component: 'enhanced-action-discovery-service',
      operation: 'validate-and-filter-actions',
      metadata: { totalActions: actions.length }
    })

    for (const action of actions) {
      try {
        // Validate action metadata
        const validationResult = this.parser.validateActionMetadata(action)
        
        if (validationResult.isValid) {
          validActions.push(action)
        } else {
          logger.debug('Action failed validation', {
            correlationId: id,
            component: 'enhanced-action-discovery-service',
            operation: 'validate-and-filter-actions',
            metadata: {
              actionId: action.id,
              errors: validationResult.errors.length,
              warnings: validationResult.warnings.length
            }
          })
        }
      } catch (error) {
        logger.warn('Action validation failed', {
          correlationId: id,
          component: 'enhanced-action-discovery-service',
          operation: 'validate-and-filter-actions',
          metadata: {
            actionId: action.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    }

    logger.debug('Action validation completed', {
      correlationId: id,
      component: 'enhanced-action-discovery-service',
      operation: 'validate-and-filter-actions',
      metadata: {
        totalActions: actions.length,
        validActions: validActions.length,
        filteredOut: actions.length - validActions.length
      }
    })

    return validActions
  }

  /**
   * Perform fallback discovery when main discovery fails
   */
  private async performFallbackDiscovery(): Promise<DiscoveryResult> {
    logger.info('Performing fallback discovery', {
      component: 'enhanced-action-discovery-service',
      operation: 'perform-fallback-discovery'
    })

    try {
      const fallbackActions = await this.registryClient.getFallbackActions()
      
      return {
        actions: fallbackActions,
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: fallbackActions.length,
        executionTime: 0,
        errors: ['Primary discovery failed, using fallback actions']
      }

    } catch (error) {
      logger.error('Fallback discovery failed', error as Error, {
        component: 'enhanced-action-discovery-service',
        operation: 'perform-fallback-discovery'
      })
      throw error
    }
  }

  /**
   * Get specific Action by ID with enhanced lookup
   */
  async getAction(actionId: string): Promise<ActionMetadata | null> {
    const correlationId = logger.generateCorrelationId()
    
    logger.debug('Getting action by ID', {
      correlationId,
      component: 'enhanced-action-discovery-service',
      operation: 'get-action',
      metadata: { actionId }
    })

    try {
      // Try cache first
      if (this.config.enableCaching) {
        const cachedAction = await this.cacheManager.getCachedAction(actionId)
        if (cachedAction) {
          return cachedAction
        }
      }

      // Trigger discovery if not found
      const discoveryResult = await this.discoverActions()
      return discoveryResult.actions.find(action => action.id === actionId) || null

    } catch (error) {
      logger.error('Failed to get action', error as Error, {
        correlationId,
        component: 'enhanced-action-discovery-service',
        operation: 'get-action',
        metadata: { actionId }
      })
      return null
    }
  }

  /**
   * Search Actions with enhanced capabilities
   */
  async searchActions(query: string, options: any = {}): Promise<ActionMetadata[]> {
    const correlationId = logger.generateCorrelationId()
    
    logger.debug('Searching actions', {
      correlationId,
      component: 'enhanced-action-discovery-service',
      operation: 'search-actions',
      metadata: { query, options }
    })

    try {
      // Get all actions
      const discoveryResult = await this.discoverActions()
      
      // Simple text-based search (could be enhanced with semantic search)
      const searchResults = discoveryResult.actions.filter(action => {
        const searchText = `${action.name} ${action.description} ${action.category}`.toLowerCase()
        return searchText.includes(query.toLowerCase())
      })

      // Apply options (limit, category filter, etc.)
      let filteredResults = searchResults
      
      if (options.category) {
        filteredResults = filteredResults.filter(action => 
          action.category.toLowerCase() === options.category.toLowerCase()
        )
      }

      if (options.limit) {
        filteredResults = filteredResults.slice(0, options.limit)
      }

      return filteredResults

    } catch (error) {
      logger.error('Action search failed', error as Error, {
        correlationId,
        component: 'enhanced-action-discovery-service',
        operation: 'search-actions',
        metadata: { query }
      })
      return []
    }
  }

  /**
   * Get Actions by category
   */
  async getActionsByCategory(category: string): Promise<ActionMetadata[]> {
    const discoveryResult = await this.discoverActions()
    return discoveryResult.actions.filter(action => 
      action.category.toLowerCase() === category.toLowerCase()
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
   * Switch to different Flow network
   */
  async switchNetwork(networkName: keyof typeof FLOW_NETWORKS): Promise<void> {
    const correlationId = logger.generateCorrelationId()
    
    logger.info('Switching network', {
      correlationId,
      component: 'enhanced-action-discovery-service',
      operation: 'switch-network',
      metadata: {
        fromNetwork: this.config.network,
        toNetwork: networkName
      }
    })

    try {
      // Update configuration
      this.config.network = networkName

      // Switch client network
      this.client.switchNetwork(networkName)

      // Clear cache when switching networks
      if (this.config.enableCaching) {
        await this.cacheManager.invalidateAll()
      }

      // Reconnect to registries on new network
      await this.registryClient.connectToOfficialRegistries()

      logger.info('Network switch completed', {
        correlationId,
        component: 'enhanced-action-discovery-service',
        operation: 'switch-network',
        metadata: { newNetwork: networkName }
      })

    } catch (error) {
      logger.error('Network switch failed', error as Error, {
        correlationId,
        component: 'enhanced-action-discovery-service',
        operation: 'switch-network',
        metadata: { targetNetwork: networkName }
      })
      throw error
    }
  }

  /**
   * Force refresh all data
   */
  async forceRefresh(): Promise<DiscoveryResult> {
    logger.info('Force refreshing all data', {
      component: 'enhanced-action-discovery-service',
      operation: 'force-refresh'
    })

    // Clear all caches
    if (this.config.enableCaching) {
      await this.cacheManager.invalidateAll()
    }

    // Force refresh registries
    await this.registryClient.forceRefreshAll()

    // Perform fresh discovery
    return await this.discoverActions(true)
  }

  /**
   * Get comprehensive metrics
   */
  async getMetrics(): Promise<DiscoveryMetrics> {
    const registryStats = await this.registryClient.getStats()
    const registryHealth = this.registryClient.getRegistryHealth()

    return {
      totalDiscoveries: this.discoveryCount,
      successfulDiscoveries: this.successCount,
      failedDiscoveries: this.failureCount,
      averageDiscoveryTime: this.discoveryCount > 0 ? this.totalDiscoveryTime / this.discoveryCount : 0,
      cacheHitRate: registryStats.cacheHitRate,
      registryHealth,
      lastDiscoveryTime: this.lastDiscoveryTime || 'Never',
      backgroundRefreshStatus: registryStats.backgroundRefreshEnabled ? 'Enabled' : 'Disabled'
    }
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(discoveryTime: number): void {
    this.totalDiscoveryTime += discoveryTime
    this.lastDiscoveryTime = new Date().toISOString()
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.registryClient.cleanup()
    await this.cacheManager.close()

    logger.info('Enhanced Action Discovery Service cleaned up', {
      component: 'enhanced-action-discovery-service',
      operation: 'cleanup'
    })
  }
}

/**
 * Create Enhanced Action Discovery Service with default configuration
 */
export function createEnhancedActionDiscoveryService(
  config?: Partial<EnhancedDiscoveryConfig>
): EnhancedActionDiscoveryService {
  return new EnhancedActionDiscoveryService(config)
}

/**
 * Default enhanced service instance (lazy-loaded)
 */
let _defaultEnhancedService: EnhancedActionDiscoveryService | null = null
export const getDefaultEnhancedActionDiscoveryService = (): EnhancedActionDiscoveryService => {
  if (!_defaultEnhancedService) {
    _defaultEnhancedService = new EnhancedActionDiscoveryService()
  }
  return _defaultEnhancedService
}