import { ActionMetadata, DiscoveryResult, ActionRegistry } from './types'
import { FORTE_CONSTANTS } from './flow-config'

/**
 * Redis client interface for dependency injection and testing
 */
export interface RedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, options?: { EX?: number }): Promise<string | null>
  del(key: string): Promise<number>
  exists(key: string): Promise<number>
  keys(pattern: string): Promise<string[]>
  mget(keys: string[]): Promise<(string | null)[]>
  mset(keyValues: string[]): Promise<string>
  expire(key: string, seconds: number): Promise<number>
  ttl(key: string): Promise<number>
  ping(): Promise<string>
  quit(): Promise<string>
}

/**
 * Mock Redis client for development/testing when Redis is not available
 */
class MockRedisClient implements RedisClient {
  private store: Map<string, { value: string, expiry?: number }> = new Map()

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key)
    if (!item) return null
    
    if (item.expiry && Date.now() > item.expiry) {
      this.store.delete(key)
      return null
    }
    
    return item.value
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<string | null> {
    const expiry = options?.EX ? Date.now() + (options.EX * 1000) : undefined
    this.store.set(key, { value, expiry })
    return 'OK'
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }

  async exists(key: string): Promise<number> {
    const item = this.store.get(key)
    if (!item) return 0
    
    if (item.expiry && Date.now() > item.expiry) {
      this.store.delete(key)
      return 0
    }
    
    return 1
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return Array.from(this.store.keys()).filter(key => regex.test(key))
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map(key => this.get(key)))
  }

  async mset(keyValues: string[]): Promise<string> {
    for (let i = 0; i < keyValues.length; i += 2) {
      await this.set(keyValues[i], keyValues[i + 1])
    }
    return 'OK'
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key)
    if (!item) return 0
    
    item.expiry = Date.now() + (seconds * 1000)
    return 1
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key)
    if (!item) return -2
    
    if (!item.expiry) return -1
    
    const remaining = Math.ceil((item.expiry - Date.now()) / 1000)
    return remaining > 0 ? remaining : -2
  }

  async ping(): Promise<string> {
    return 'PONG'
  }

  async quit(): Promise<string> {
    this.store.clear()
    return 'OK'
  }
}

/**
 * Redis cache manager for Action metadata with TTL and invalidation strategies
 */
export class RedisCacheManager {
  private client: RedisClient
  private keyPrefix: string = 'actionloom:'
  private isConnected: boolean = false
  private connectionRetries: number = 0
  private maxRetries: number = 3

  constructor(client?: RedisClient) {
    this.client = client || new MockRedisClient()
    this.initialize()
  }

  /**
   * Initialize the cache manager
   */
  private async initialize(): Promise<void> {
    try {
      await this.client.ping()
      this.isConnected = true
      console.log('Redis cache manager initialized successfully')
    } catch (error) {
      console.warn('Redis connection failed, using mock client:', error)
      this.client = new MockRedisClient()
      this.isConnected = true
    }
  }

  /**
   * Check if Redis is connected and healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.ping()
      return response === 'PONG'
    } catch (error) {
      console.error('Redis health check failed:', error)
      return false
    }
  }

  /**
   * Cache Action metadata with TTL
   */
  async cacheAction(action: ActionMetadata, ttl: number = FORTE_CONSTANTS.ACTION_CACHE_TTL): Promise<void> {
    try {
      const key = this.getActionKey(action.id)
      const value = JSON.stringify(action)
      
      await this.client.set(key, value, { EX: ttl })
      
      // Also cache by category for faster category queries
      const categoryKey = this.getCategoryKey(action.category)
      const categoryActions = await this.getCachedActionsByCategory(action.category)
      categoryActions.push(action.id)
      
      // Remove duplicates and cache
      const uniqueActions = [...new Set(categoryActions)]
      await this.client.set(categoryKey, JSON.stringify(uniqueActions), { EX: ttl })
      
      console.log(`Cached Action ${action.id} with TTL ${ttl}s`)
    } catch (error) {
      console.error(`Failed to cache Action ${action.id}:`, error)
    }
  }

  /**
   * Cache multiple Actions in batch
   */
  async cacheActions(actions: ActionMetadata[], ttl: number = FORTE_CONSTANTS.ACTION_CACHE_TTL): Promise<void> {
    try {
      const keyValues: string[] = []
      const categoryMap: Map<string, string[]> = new Map()

      // Prepare action data
      for (const action of actions) {
        const key = this.getActionKey(action.id)
        const value = JSON.stringify(action)
        keyValues.push(key, value)

        // Group by category
        if (!categoryMap.has(action.category)) {
          categoryMap.set(action.category, [])
        }
        categoryMap.get(action.category)!.push(action.id)
      }

      // Batch set actions
      if (keyValues.length > 0) {
        await this.client.mset(keyValues)
        
        // Set TTL for each action
        const expirePromises = []
        for (let i = 0; i < keyValues.length; i += 2) {
          expirePromises.push(this.client.expire(keyValues[i], ttl))
        }
        await Promise.all(expirePromises)
      }

      // Cache category mappings
      for (const [category, actionIds] of categoryMap) {
        const categoryKey = this.getCategoryKey(category)
        await this.client.set(categoryKey, JSON.stringify(actionIds), { EX: ttl })
      }

      console.log(`Batch cached ${actions.length} Actions with TTL ${ttl}s`)
    } catch (error) {
      console.error('Failed to batch cache Actions:', error)
    }
  }

  /**
   * Get cached Action metadata
   */
  async getCachedAction(actionId: string): Promise<ActionMetadata | null> {
    try {
      const key = this.getActionKey(actionId)
      const value = await this.client.get(key)
      
      if (!value) {
        return null
      }

      const action = JSON.parse(value) as ActionMetadata
      console.log(`Retrieved cached Action ${actionId}`)
      return action
    } catch (error) {
      console.error(`Failed to get cached Action ${actionId}:`, error)
      return null
    }
  }

  /**
   * Get multiple cached Actions
   */
  async getCachedActions(actionIds: string[]): Promise<(ActionMetadata | null)[]> {
    try {
      const keys = actionIds.map(id => this.getActionKey(id))
      const values = await this.client.mget(keys)
      
      return values.map((value, index) => {
        if (!value) return null
        
        try {
          return JSON.parse(value) as ActionMetadata
        } catch (error) {
          console.error(`Failed to parse cached Action ${actionIds[index]}:`, error)
          return null
        }
      })
    } catch (error) {
      console.error('Failed to get cached Actions:', error)
      return actionIds.map(() => null)
    }
  }

  /**
   * Get cached Actions by category
   */
  async getCachedActionsByCategory(category: string): Promise<string[]> {
    try {
      const key = this.getCategoryKey(category)
      const value = await this.client.get(key)
      
      if (!value) {
        return []
      }

      return JSON.parse(value) as string[]
    } catch (error) {
      console.error(`Failed to get cached Actions for category ${category}:`, error)
      return []
    }
  }

  /**
   * Cache discovery results
   */
  async cacheDiscoveryResult(result: DiscoveryResult, ttl: number = FORTE_CONSTANTS.REGISTRY_CACHE_TTL): Promise<void> {
    try {
      const key = this.getDiscoveryKey()
      const value = JSON.stringify(result)
      
      await this.client.set(key, value, { EX: ttl })
      
      // Also cache individual actions
      await this.cacheActions(result.actions, ttl)
      
      console.log(`Cached discovery result with ${result.actions.length} actions`)
    } catch (error) {
      console.error('Failed to cache discovery result:', error)
    }
  }

  /**
   * Get cached discovery results
   */
  async getCachedDiscoveryResult(): Promise<DiscoveryResult | null> {
    try {
      const key = this.getDiscoveryKey()
      const value = await this.client.get(key)
      
      if (!value) {
        return null
      }

      const result = JSON.parse(value) as DiscoveryResult
      console.log(`Retrieved cached discovery result with ${result.actions.length} actions`)
      return result
    } catch (error) {
      console.error('Failed to get cached discovery result:', error)
      return null
    }
  }

  /**
   * Invalidate Action cache
   */
  async invalidateAction(actionId: string): Promise<void> {
    try {
      const key = this.getActionKey(actionId)
      await this.client.del(key)
      console.log(`Invalidated cache for Action ${actionId}`)
    } catch (error) {
      console.error(`Failed to invalidate Action ${actionId}:`, error)
    }
  }

  /**
   * Invalidate category cache
   */
  async invalidateCategory(category: string): Promise<void> {
    try {
      const key = this.getCategoryKey(category)
      await this.client.del(key)
      console.log(`Invalidated cache for category ${category}`)
    } catch (error) {
      console.error(`Failed to invalidate category ${category}:`, error)
    }
  }

  /**
   * Invalidate all Action caches
   */
  async invalidateAll(): Promise<void> {
    try {
      const pattern = `${this.keyPrefix}*`
      const keys = await this.client.keys(pattern)
      
      if (keys.length > 0) {
        const deletePromises = keys.map(key => this.client.del(key))
        await Promise.all(deletePromises)
        console.log(`Invalidated ${keys.length} cache entries`)
      }
    } catch (error) {
      console.error('Failed to invalidate all caches:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number
    actionKeys: number
    categoryKeys: number
    discoveryKeys: number
  }> {
    try {
      const allKeys = await this.client.keys(`${this.keyPrefix}*`)
      const actionKeys = allKeys.filter(key => key.includes(':action:'))
      const categoryKeys = allKeys.filter(key => key.includes(':category:'))
      const discoveryKeys = allKeys.filter(key => key.includes(':discovery'))

      return {
        totalKeys: allKeys.length,
        actionKeys: actionKeys.length,
        categoryKeys: categoryKeys.length,
        discoveryKeys: discoveryKeys.length
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return { totalKeys: 0, actionKeys: 0, categoryKeys: 0, discoveryKeys: 0 }
    }
  }

  /**
   * Warm up cache with background refresh
   */
  async warmCache(discoveryFunction: () => Promise<DiscoveryResult>): Promise<void> {
    try {
      console.log('Starting cache warm-up...')
      const result = await discoveryFunction()
      await this.cacheDiscoveryResult(result)
      console.log('Cache warm-up completed')
    } catch (error) {
      console.error('Cache warm-up failed:', error)
    }
  }

  /**
   * Set up background refresh mechanism
   */
  setupBackgroundRefresh(
    discoveryFunction: () => Promise<DiscoveryResult>,
    intervalMinutes: number = 30
  ): NodeJS.Timeout {
    const intervalMs = intervalMinutes * 60 * 1000
    
    return setInterval(async () => {
      try {
        console.log('Starting background cache refresh...')
        await this.warmCache(discoveryFunction)
      } catch (error) {
        console.error('Background cache refresh failed:', error)
      }
    }, intervalMs)
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.client.quit()
      this.isConnected = false
      console.log('Redis connection closed')
    } catch (error) {
      console.error('Failed to close Redis connection:', error)
    }
  }

  /**
   * Generate cache key for Action
   */
  private getActionKey(actionId: string): string {
    return `${this.keyPrefix}action:${actionId}`
  }

  /**
   * Generate cache key for category
   */
  private getCategoryKey(category: string): string {
    return `${this.keyPrefix}category:${category}`
  }

  /**
   * Generate cache key for discovery results
   */
  private getDiscoveryKey(): string {
    return `${this.keyPrefix}discovery:latest`
  }
}

/**
 * Create Redis cache manager with real Redis client
 */
export function createRedisCacheManager(redisClient?: RedisClient): RedisCacheManager {
  return new RedisCacheManager(redisClient)
}

/**
 * Default cache manager instance (uses mock client if Redis not available)
 */
export const defaultCacheManager = new RedisCacheManager()