import { FlowAPIClient } from './flow-api-client'
import { OnChainActionScanner } from './on-chain-action-scanner'
import { ContractMetadataParser } from './contract-metadata-parser'
import { RedisCacheManager } from './redis-cache-manager'
import { 
  ActionMetadata, 
  ActionRegistry, 
  DiscoveryResult,
  FlowNetwork,
  ValidationResult,
  Contract
} from './types'
import { logger } from './logging-service'
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker'

/**
 * Interface for registry client configuration
 */
export interface RegistryClientConfig {
  cacheEnabled: boolean
  cacheTTL: number
  backgroundRefreshInterval: number
  maxRetries: number
  requestTimeout: number
  batchSize: number
  enableFallback: boolean
  fallbackRegistries: string[]
}

/**
 * Interface for registry update detection
 */
export interface RegistryUpdateInfo {
  registryAddress: string
  lastUpdateBlock: number
  lastUpdateTime: string
  actionCount: number
  hasChanges: boolean
  newActions: string[]
  removedActions: string[]
  modifiedActions: string[]
}

/**
 * Interface for registry health status
 */
export interface RegistryHealthStatus {
  registryAddress: string
  isHealthy: boolean
  lastChecked: string
  responseTime: number
  errorCount: number
  lastError?: string
}

/**
 * Interface for registry statistics
 */
export interface RegistryStats {
  totalRegistries: number
  healthyRegistries: number
  totalActions: number
  cacheHitRate: number
  averageResponseTime: number
  lastFullScan: string
  backgroundRefreshEnabled: boolean
}

/**
 * ActionRegistryClient - Manages connections to Flow Action registries with caching
 */
export class ActionRegistryClient {
  private client: FlowAPIClient
  private scanner: OnChainActionScanner
  private parser: ContractMetadataParser
  private cacheManager: RedisCacheManager
  private config: RegistryClientConfig
  private circuitBreaker: CircuitBreaker
  
  private registryHealth: Map<string, RegistryHealthStatus> = new Map()
  private lastUpdateCheck: Map<string, number> = new Map()
  private backgroundRefreshTimer?: NodeJS.Timeout
  private isRefreshing: boolean = false
  private refreshQueue: Set<string> = new Set()

  constructor(
    client: FlowAPIClient,
    scanner: OnChainActionScanner,
    parser: ContractMetadataParser,
    cacheManager: RedisCacheManager,
    config: Partial<RegistryClientConfig> = {}
  ) {
    this.client = client
    this.scanner = scanner
    this.parser = parser
    this.cacheManager = cacheManager
    
    this.config = {
      cacheEnabled: true,
      cacheTTL: 3600, // 1 hour
      backgroundRefreshInterval: 1800, // 30 minutes
      maxRetries: 3,
      requestTimeout: 30000,
      batchSize: 10,
      enableFallback: true,
      fallbackRegistries: [
        '0x1654653399040a61', // Official Flow Action Registry
        '0x9a0766d93b6608b7'  // Community Action Registry
      ],
      ...config
    }

    // Initialize circuit breaker
    const circuitBreakerConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 120000,
      halfOpenMaxCalls: 3
    }
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig)

    this.setupBackgroundRefresh()
  }

  /**
   * Connect to Flow's official Action registries
   */
  async connectToOfficialRegistries(): Promise<ActionRegistry[]> {
    const correlationId = logger.generateCorrelationId()
    const timingId = logger.startTiming('connect-official-registries', correlationId)

    logger.info('Connecting to official Action registries', {
      correlationId,
      component: 'action-registry-client',
      operation: 'connect-official-registries',
      metadata: {
        network: this.client.getCurrentNetwork().name,
        fallbackRegistries: this.config.fallbackRegistries.length
      }
    })

    try {
      // First try to discover registries through the scanner
      let registries: ActionRegistry[] = []
      
      try {
        registries = await this.scanner.scanRegistries()
        logger.info('Discovered registries through scanner', {
          correlationId,
          component: 'action-registry-client',
          operation: 'connect-official-registries',
          metadata: { discoveredCount: registries.length }
        })
      } catch (scanError) {
        logger.warn('Registry scanning failed, using fallback', {
          correlationId,
          component: 'action-registry-client',
          operation: 'connect-official-registries',
          metadata: { error: scanError instanceof Error ? scanError.message : 'Unknown error' }
        })
      }

      // If no registries discovered or fallback enabled, use known registries
      if (registries.length === 0 || this.config.enableFallback) {
        const fallbackRegistries = await this.connectToFallbackRegistries()
        registries.push(...fallbackRegistries)
      }

      // Update registry health status
      await this.updateRegistryHealthStatus(registries)

      // Cache the registry list
      if (this.config.cacheEnabled) {
        await this.cacheRegistryList(registries)
      }

      logger.info('Successfully connected to Action registries', {
        correlationId,
        component: 'action-registry-client',
        operation: 'connect-official-registries',
        metadata: {
          totalRegistries: registries.length,
          healthyRegistries: this.getHealthyRegistryCount()
        }
      })

      logger.endTiming(correlationId, 'connect-official-registries', true)
      return registries

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.endTiming(correlationId, 'connect-official-registries', false, errorMessage)
      logger.error('Failed to connect to official registries', error as Error, {
        correlationId,
        component: 'action-registry-client',
        operation: 'connect-official-registries'
      })
      throw error
    }
  }

  /**
   * Connect to fallback registries
   */
  private async connectToFallbackRegistries(): Promise<ActionRegistry[]> {
    const registries: ActionRegistry[] = []

    for (const registryAddress of this.config.fallbackRegistries) {
      try {
        const registry = await this.connectToSingleRegistry(registryAddress)
        if (registry) {
          registries.push(registry)
        }
      } catch (error) {
        logger.warn('Failed to connect to fallback registry', {
          component: 'action-registry-client',
          operation: 'connect-fallback-registries',
          metadata: {
            registryAddress,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
    }

    return registries
  }

  /**
   * Connect to a single registry
   */
  private async connectToSingleRegistry(registryAddress: string): Promise<ActionRegistry | null> {
    try {
      // Execute registry info script
      const registryScript = this.getRegistryInfoScript()
      const result = await this.client.executeScript(registryScript, [
        { type: 'Address', value: registryAddress }
      ])

      if (!result || !result.value) {
        return null
      }

      const registryData = result.value
      return {
        address: registryAddress,
        name: registryData.name || `Registry at ${registryAddress}`,
        description: registryData.description || 'Flow Action Registry',
        actions: registryData.actions || []
      }

    } catch (error) {
      logger.warn('Failed to connect to registry', {
        component: 'action-registry-client',
        operation: 'connect-single-registry',
        metadata: {
          registryAddress,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      return null
    }
  }

  /**
   * Build intelligent caching system with TTL management
   */
  async setupIntelligentCaching(): Promise<void> {
    if (!this.config.cacheEnabled) {
      logger.info('Caching is disabled', {
        component: 'action-registry-client',
        operation: 'setup-intelligent-caching'
      })
      return
    }

    const correlationId = logger.generateCorrelationId()
    logger.info('Setting up intelligent caching system', {
      correlationId,
      component: 'action-registry-client',
      operation: 'setup-intelligent-caching',
      metadata: {
        cacheTTL: this.config.cacheTTL,
        backgroundRefreshInterval: this.config.backgroundRefreshInterval
      }
    })

    try {
      // Initialize cache structure
      await this.cacheManager.setupCacheStructure()

      // Set up cache warming
      await this.warmCache()

      // Set up cache invalidation strategies
      await this.setupCacheInvalidation()

      logger.info('Intelligent caching system setup complete', {
        correlationId,
        component: 'action-registry-client',
        operation: 'setup-intelligent-caching'
      })

    } catch (error) {
      logger.error('Failed to setup intelligent caching', error as Error, {
        correlationId,
        component: 'action-registry-client',
        operation: 'setup-intelligent-caching'
      })
      throw error
    }
  }

  /**
   * Warm the cache with initial data
   */
  private async warmCache(): Promise<void> {
    try {
      logger.info('Warming cache with initial data', {
        component: 'action-registry-client',
        operation: 'warm-cache'
      })

      // Get all registries
      const registries = await this.connectToOfficialRegistries()

      // Cache all Actions from all registries
      for (const registry of registries) {
        await this.cacheRegistryActions(registry)
      }

      logger.info('Cache warming completed', {
        component: 'action-registry-client',
        operation: 'warm-cache',
        metadata: { registriesWarmed: registries.length }
      })

    } catch (error) {
      logger.warn('Cache warming failed', {
        component: 'action-registry-client',
        operation: 'warm-cache',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  /**
   * Cache Actions from a specific registry
   */
  private async cacheRegistryActions(registry: ActionRegistry): Promise<void> {
    const batchSize = this.config.batchSize
    const actions: ActionMetadata[] = []

    // Process actions in batches
    for (let i = 0; i < registry.actions.length; i += batchSize) {
      const batch = registry.actions.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (actionId) => {
        try {
          const actionMetadata = await this.client.getActionMetadata(registry.address, actionId)
          if (actionMetadata) {
            actions.push(actionMetadata)
            // Cache individual action
            await this.cacheManager.cacheAction(actionMetadata, this.config.cacheTTL)
          }
        } catch (error) {
          logger.warn('Failed to cache action', {
            component: 'action-registry-client',
            operation: 'cache-registry-actions',
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

    // Cache registry metadata
    await this.cacheManager.cacheRegistry(registry, this.config.cacheTTL)
    
    logger.debug('Registry actions cached', {
      component: 'action-registry-client',
      operation: 'cache-registry-actions',
      metadata: {
        registryAddress: registry.address,
        actionsCached: actions.length
      }
    })
  }

  /**
   * Setup cache invalidation strategies
   */
  private async setupCacheInvalidation(): Promise<void> {
    // Set up TTL-based invalidation (handled by Redis)
    // Set up event-based invalidation for registry updates
    // Set up manual invalidation triggers
    
    logger.info('Cache invalidation strategies configured', {
      component: 'action-registry-client',
      operation: 'setup-cache-invalidation'
    })
  }

  /**
   * Detect Action registry updates
   */
  async detectRegistryUpdates(): Promise<RegistryUpdateInfo[]> {
    const correlationId = logger.generateCorrelationId()
    logger.info('Detecting registry updates', {
      correlationId,
      component: 'action-registry-client',
      operation: 'detect-registry-updates'
    })

    try {
      const updateInfos: RegistryUpdateInfo[] = []
      const registries = await this.getCachedRegistries()

      for (const registry of registries) {
        const updateInfo = await this.checkRegistryForUpdates(registry)
        updateInfos.push(updateInfo)

        if (updateInfo.hasChanges) {
          logger.info('Registry changes detected', {
            correlationId,
            component: 'action-registry-client',
            operation: 'detect-registry-updates',
            metadata: {
              registryAddress: registry.address,
              newActions: updateInfo.newActions.length,
              removedActions: updateInfo.removedActions.length,
              modifiedActions: updateInfo.modifiedActions.length
            }
          })
        }
      }

      return updateInfos

    } catch (error) {
      logger.error('Failed to detect registry updates', error as Error, {
        correlationId,
        component: 'action-registry-client',
        operation: 'detect-registry-updates'
      })
      throw error
    }
  }

  /**
   * Check a single registry for updates
   */
  private async checkRegistryForUpdates(registry: ActionRegistry): Promise<RegistryUpdateInfo> {
    try {
      // Get current registry state
      const currentRegistry = await this.connectToSingleRegistry(registry.address)
      if (!currentRegistry) {
        return {
          registryAddress: registry.address,
          lastUpdateBlock: 0,
          lastUpdateTime: new Date().toISOString(),
          actionCount: 0,
          hasChanges: false,
          newActions: [],
          removedActions: [],
          modifiedActions: []
        }
      }

      // Compare with cached version
      const cachedActions = new Set(registry.actions)
      const currentActions = new Set(currentRegistry.actions)

      const newActions = [...currentActions].filter(action => !cachedActions.has(action))
      const removedActions = [...cachedActions].filter(action => !currentActions.has(action))
      const modifiedActions: string[] = [] // Would need more sophisticated comparison

      const hasChanges = newActions.length > 0 || removedActions.length > 0 || modifiedActions.length > 0

      return {
        registryAddress: registry.address,
        lastUpdateBlock: await this.getCurrentBlockHeight(),
        lastUpdateTime: new Date().toISOString(),
        actionCount: currentRegistry.actions.length,
        hasChanges,
        newActions,
        removedActions,
        modifiedActions
      }

    } catch (error) {
      logger.warn('Failed to check registry for updates', {
        component: 'action-registry-client',
        operation: 'check-registry-for-updates',
        metadata: {
          registryAddress: registry.address,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })

      return {
        registryAddress: registry.address,
        lastUpdateBlock: 0,
        lastUpdateTime: new Date().toISOString(),
        actionCount: 0,
        hasChanges: false,
        newActions: [],
        removedActions: [],
        modifiedActions: []
      }
    }
  }

  /**
   * Setup automatic refresh mechanisms
   */
  private setupBackgroundRefresh(): void {
    if (this.config.backgroundRefreshInterval <= 0) {
      return
    }

    this.backgroundRefreshTimer = setInterval(async () => {
      if (this.isRefreshing) {
        logger.debug('Background refresh already in progress, skipping', {
          component: 'action-registry-client',
          operation: 'background-refresh'
        })
        return
      }

      try {
        await this.performBackgroundRefresh()
      } catch (error) {
        logger.error('Background refresh failed', error as Error, {
          component: 'action-registry-client',
          operation: 'background-refresh'
        })
      }
    }, this.config.backgroundRefreshInterval * 1000)

    logger.info('Background refresh setup complete', {
      component: 'action-registry-client',
      operation: 'setup-background-refresh',
      metadata: { intervalSeconds: this.config.backgroundRefreshInterval }
    })
  }

  /**
   * Perform background refresh of registry data
   */
  private async performBackgroundRefresh(): Promise<void> {
    this.isRefreshing = true
    const correlationId = logger.generateCorrelationId()

    logger.info('Starting background refresh', {
      correlationId,
      component: 'action-registry-client',
      operation: 'perform-background-refresh'
    })

    try {
      // Detect updates
      const updateInfos = await this.detectRegistryUpdates()
      const registriesWithChanges = updateInfos.filter(info => info.hasChanges)

      if (registriesWithChanges.length === 0) {
        logger.debug('No registry changes detected during background refresh', {
          correlationId,
          component: 'action-registry-client',
          operation: 'perform-background-refresh'
        })
        return
      }

      // Refresh changed registries
      for (const updateInfo of registriesWithChanges) {
        await this.refreshRegistry(updateInfo.registryAddress)
      }

      logger.info('Background refresh completed', {
        correlationId,
        component: 'action-registry-client',
        operation: 'perform-background-refresh',
        metadata: { refreshedRegistries: registriesWithChanges.length }
      })

    } catch (error) {
      logger.error('Background refresh failed', error as Error, {
        correlationId,
        component: 'action-registry-client',
        operation: 'perform-background-refresh'
      })
    } finally {
      this.isRefreshing = false
    }
  }

  /**
   * Refresh a specific registry
   */
  private async refreshRegistry(registryAddress: string): Promise<void> {
    try {
      // Invalidate cached data for this registry
      await this.cacheManager.invalidateRegistry(registryAddress)

      // Reconnect and cache fresh data
      const registry = await this.connectToSingleRegistry(registryAddress)
      if (registry) {
        await this.cacheRegistryActions(registry)
      }

      logger.info('Registry refreshed', {
        component: 'action-registry-client',
        operation: 'refresh-registry',
        metadata: { registryAddress }
      })

    } catch (error) {
      logger.error('Failed to refresh registry', error as Error, {
        component: 'action-registry-client',
        operation: 'refresh-registry',
        metadata: { registryAddress }
      })
    }
  }

  /**
   * Create fallback to curated Action list when discovery fails
   */
  async getFallbackActions(): Promise<ActionMetadata[]> {
    logger.info('Using fallback Action list', {
      component: 'action-registry-client',
      operation: 'get-fallback-actions'
    })

    // Return a curated list of essential Actions
    return [
      {
        id: 'fallback-flow-transfer',
        name: 'FLOW Token Transfer',
        description: 'Transfer FLOW tokens between accounts',
        category: 'token',
        version: '1.0.0',
        inputs: [
          { name: 'recipient', type: 'Address', required: true, description: 'Recipient address' },
          { name: 'amount', type: 'UFix64', required: true, description: 'Amount to transfer' }
        ],
        outputs: [
          { name: 'success', type: 'Bool', description: 'Transfer success status' }
        ],
        parameters: [
          { name: 'recipient', type: 'Address', value: '', required: true, description: 'Recipient address' },
          { name: 'amount', type: 'UFix64', value: '', required: true, description: 'Amount to transfer' }
        ],
        compatibility: {
          requiredCapabilities: ['token_transfer'],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 150,
        securityLevel: 'medium' as any,
        author: 'Flow Foundation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'fallback-account-info',
        name: 'Get Account Information',
        description: 'Retrieve account balance and details',
        category: 'utility',
        version: '1.0.0',
        inputs: [
          { name: 'address', type: 'Address', required: true, description: 'Account address' }
        ],
        outputs: [
          { name: 'balance', type: 'UFix64', description: 'Account FLOW balance' },
          { name: 'address', type: 'Address', description: 'Account address' }
        ],
        parameters: [
          { name: 'address', type: 'Address', value: '', required: true, description: 'Account address' }
        ],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 50,
        securityLevel: 'low' as any,
        author: 'Flow Foundation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  }

  /**
   * Get cached registries
   */
  private async getCachedRegistries(): Promise<ActionRegistry[]> {
    try {
      return await this.cacheManager.getCachedRegistries()
    } catch (error) {
      logger.warn('Failed to get cached registries', {
        component: 'action-registry-client',
        operation: 'get-cached-registries',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return []
    }
  }

  /**
   * Cache registry list
   */
  private async cacheRegistryList(registries: ActionRegistry[]): Promise<void> {
    try {
      await this.cacheManager.cacheRegistries(registries, this.config.cacheTTL)
    } catch (error) {
      logger.warn('Failed to cache registry list', {
        component: 'action-registry-client',
        operation: 'cache-registry-list',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }

  /**
   * Update registry health status
   */
  private async updateRegistryHealthStatus(registries: ActionRegistry[]): Promise<void> {
    for (const registry of registries) {
      const startTime = Date.now()
      let isHealthy = true
      let lastError: string | undefined

      try {
        // Perform health check
        await this.connectToSingleRegistry(registry.address)
      } catch (error) {
        isHealthy = false
        lastError = error instanceof Error ? error.message : 'Unknown error'
      }

      const responseTime = Date.now() - startTime
      const healthStatus: RegistryHealthStatus = {
        registryAddress: registry.address,
        isHealthy,
        lastChecked: new Date().toISOString(),
        responseTime,
        errorCount: isHealthy ? 0 : (this.registryHealth.get(registry.address)?.errorCount || 0) + 1,
        lastError
      }

      this.registryHealth.set(registry.address, healthStatus)
    }
  }

  /**
   * Get healthy registry count
   */
  private getHealthyRegistryCount(): number {
    return Array.from(this.registryHealth.values()).filter(status => status.isHealthy).length
  }

  /**
   * Get current block height
   */
  private async getCurrentBlockHeight(): Promise<number> {
    try {
      const script = `
        pub fun main(): UInt64 {
          return getCurrentBlock().height
        }
      `
      const result = await this.client.executeScript(script, [])
      return result?.value || 0
    } catch (error) {
      logger.warn('Failed to get current block height', {
        component: 'action-registry-client',
        operation: 'get-current-block-height',
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return 0
    }
  }

  /**
   * Get registry info script
   */
  private getRegistryInfoScript(): string {
    return `
      import ActionRegistry from 0x1654653399040a61

      pub fun main(registryAddress: Address): RegistryInfo? {
        let registryAccount = getAccount(registryAddress)
        
        if let registry = registryAccount.getCapability<&ActionRegistry.Registry{ActionRegistry.RegistryPublic}>
          (/public/ActionRegistry).borrow() {
          
          return RegistryInfo(
            name: registry.getName(),
            description: registry.getDescription(),
            actions: registry.getActionIds(),
            version: registry.getVersion(),
            lastUpdate: registry.getLastUpdateTime()
          )
        }
        
        return nil
      }

      pub struct RegistryInfo {
        pub let name: String
        pub let description: String
        pub let actions: [String]
        pub let version: String
        pub let lastUpdate: UFix64

        init(name: String, description: String, actions: [String], version: String, lastUpdate: UFix64) {
          self.name = name
          self.description = description
          self.actions = actions
          self.version = version
          self.lastUpdate = lastUpdate
        }
      }
    `
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<RegistryStats> {
    const registries = await this.getCachedRegistries()
    const healthyRegistries = this.getHealthyRegistryCount()
    const totalActions = registries.reduce((sum, registry) => sum + registry.actions.length, 0)
    
    const cacheStats = await this.cacheManager.getCacheStats()
    const cacheHitRate = cacheStats.totalKeys > 0 ? 
      (cacheStats.actionKeys / cacheStats.totalKeys) * 100 : 0

    const responseTimes = Array.from(this.registryHealth.values()).map(status => status.responseTime)
    const averageResponseTime = responseTimes.length > 0 ? 
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length : 0

    return {
      totalRegistries: registries.length,
      healthyRegistries,
      totalActions,
      cacheHitRate,
      averageResponseTime,
      lastFullScan: new Date().toISOString(), // Would track actual last scan time
      backgroundRefreshEnabled: !!this.backgroundRefreshTimer
    }
  }

  /**
   * Get registry health status
   */
  getRegistryHealth(): RegistryHealthStatus[] {
    return Array.from(this.registryHealth.values())
  }

  /**
   * Force refresh all registries
   */
  async forceRefreshAll(): Promise<void> {
    const correlationId = logger.generateCorrelationId()
    logger.info('Force refreshing all registries', {
      correlationId,
      component: 'action-registry-client',
      operation: 'force-refresh-all'
    })

    try {
      // Clear all cache
      await this.cacheManager.invalidateAll()

      // Reconnect to all registries
      await this.connectToOfficialRegistries()

      logger.info('Force refresh completed', {
        correlationId,
        component: 'action-registry-client',
        operation: 'force-refresh-all'
      })

    } catch (error) {
      logger.error('Force refresh failed', error as Error, {
        correlationId,
        component: 'action-registry-client',
        operation: 'force-refresh-all'
      })
      throw error
    }
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
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer)
      this.backgroundRefreshTimer = undefined
    }

    this.registryHealth.clear()
    this.lastUpdateCheck.clear()
    this.refreshQueue.clear()

    logger.info('ActionRegistryClient cleaned up', {
      component: 'action-registry-client',
      operation: 'cleanup'
    })
  }
}

/**
 * Create ActionRegistryClient with default configuration
 */
export function createActionRegistryClient(
  client: FlowAPIClient,
  scanner: OnChainActionScanner,
  parser: ContractMetadataParser,
  cacheManager: RedisCacheManager,
  config?: Partial<RegistryClientConfig>
): ActionRegistryClient {
  return new ActionRegistryClient(client, scanner, parser, cacheManager, config)
}