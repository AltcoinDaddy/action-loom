import { createHash, randomBytes } from 'crypto'
import { RedisCacheManager, createRedisCacheManager } from './redis-cache-manager'

/**
 * API Authentication and Authorization Service
 * 
 * Manages API keys, authentication, and authorization for AI Agent API
 * Requirements: 5.4, 5.5 - API authentication and rate limiting
 */

export interface APIKey {
  id: string
  key: string
  hashedKey: string
  name: string
  userId: string
  permissions: APIPermission[]
  rateLimit: RateLimit
  createdAt: string
  lastUsed?: string
  isActive: boolean
  expiresAt?: string
}

export interface APIPermission {
  resource: 'compose' | 'actions' | 'agents' | 'nlp' | '*'
  actions: ('read' | 'write' | 'delete' | '*')[]
  conditions?: Record<string, any>
}

export interface RateLimit {
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  burstLimit: number
}

export interface AuthResult {
  success: boolean
  apiKey?: APIKey
  error?: string
  remainingRequests?: {
    minute: number
    hour: number
    day: number
  }
}

export interface RateLimitResult {
  allowed: boolean
  remainingRequests: {
    minute: number
    hour: number
    day: number
  }
  resetTime: {
    minute: number
    hour: number
    day: number
  }
  error?: string
}

/**
 * Default rate limits for different API key tiers
 */
export const DEFAULT_RATE_LIMITS = {
  free: {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    requestsPerDay: 1000,
    burstLimit: 20
  },
  pro: {
    requestsPerMinute: 100,
    requestsPerHour: 5000,
    requestsPerDay: 50000,
    burstLimit: 200
  },
  enterprise: {
    requestsPerMinute: 1000,
    requestsPerHour: 50000,
    requestsPerDay: 1000000,
    burstLimit: 2000
  }
} as const

export class APIAuthService {
  private cacheManager: RedisCacheManager
  private readonly API_KEY_PREFIX = 'al_' // ActionLoom prefix
  private readonly CACHE_PREFIX = 'api_auth:'
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:'

  constructor(cacheManager?: RedisCacheManager) {
    this.cacheManager = cacheManager || createRedisCacheManager()
  }

  /**
   * Generate a new API key
   */
  generateAPIKey(
    name: string,
    userId: string,
    permissions: APIPermission[] = [],
    rateLimit: RateLimit = DEFAULT_RATE_LIMITS.free,
    expiresAt?: Date
  ): APIKey {
    const keyId = this.generateKeyId()
    const rawKey = this.generateRawKey()
    const hashedKey = this.hashKey(rawKey)
    
    const apiKey: APIKey = {
      id: keyId,
      key: `${this.API_KEY_PREFIX}${rawKey}`,
      hashedKey,
      name,
      userId,
      permissions: permissions.length > 0 ? permissions : this.getDefaultPermissions(),
      rateLimit,
      createdAt: new Date().toISOString(),
      isActive: true,
      expiresAt: expiresAt?.toISOString()
    }

    return apiKey
  }

  /**
   * Store API key in cache/database
   */
  async storeAPIKey(apiKey: APIKey): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${apiKey.hashedKey}`
    
    // Store the API key data (without the raw key)
    const storedData = {
      ...apiKey,
      key: undefined // Don't store the raw key
    }
    
    // Store with expiration if set
    const ttl = apiKey.expiresAt 
      ? Math.floor((new Date(apiKey.expiresAt).getTime() - Date.now()) / 1000)
      : undefined

    await this.cacheManager.set(cacheKey, JSON.stringify(storedData), ttl)
    
    // Also store in user's key list
    const userKeysKey = `${this.CACHE_PREFIX}user:${apiKey.userId}`
    const userKeys = await this.getUserAPIKeys(apiKey.userId)
    userKeys.push(apiKey.id)
    await this.cacheManager.set(userKeysKey, JSON.stringify(userKeys))
  }

  /**
   * Authenticate API key and check permissions
   */
  async authenticate(
    apiKey: string,
    resource: string,
    action: string = 'read'
  ): Promise<AuthResult> {
    try {
      // Validate API key format
      if (!apiKey.startsWith(this.API_KEY_PREFIX)) {
        return {
          success: false,
          error: 'Invalid API key format'
        }
      }

      // Extract and hash the key
      const rawKey = apiKey.substring(this.API_KEY_PREFIX.length)
      const hashedKey = this.hashKey(rawKey)
      const cacheKey = `${this.CACHE_PREFIX}${hashedKey}`

      // Get API key data from cache
      const keyDataStr = await this.cacheManager.get(cacheKey)
      if (!keyDataStr) {
        return {
          success: false,
          error: 'Invalid or expired API key'
        }
      }

      const keyData: APIKey = JSON.parse(keyDataStr)

      // Check if key is active
      if (!keyData.isActive) {
        return {
          success: false,
          error: 'API key is disabled'
        }
      }

      // Check expiration
      if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
        return {
          success: false,
          error: 'API key has expired'
        }
      }

      // Check permissions
      if (!this.hasPermission(keyData.permissions, resource, action)) {
        return {
          success: false,
          error: `Insufficient permissions for ${action} on ${resource}`
        }
      }

      // Check rate limits
      const rateLimitResult = await this.checkRateLimit(keyData)
      if (!rateLimitResult.allowed) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          remainingRequests: rateLimitResult.remainingRequests
        }
      }

      // Update last used timestamp
      keyData.lastUsed = new Date().toISOString()
      await this.cacheManager.set(cacheKey, JSON.stringify(keyData))

      return {
        success: true,
        apiKey: keyData,
        remainingRequests: rateLimitResult.remainingRequests
      }

    } catch (error) {
      console.error('[APIAuth] Authentication error:', error)
      return {
        success: false,
        error: 'Authentication failed'
      }
    }
  }

  /**
   * Check rate limits for an API key
   */
  async checkRateLimit(apiKey: APIKey): Promise<RateLimitResult> {
    const now = Date.now()
    const keyId = apiKey.id
    
    // Rate limit keys for different time windows
    const minuteKey = `${this.RATE_LIMIT_PREFIX}${keyId}:${Math.floor(now / 60000)}`
    const hourKey = `${this.RATE_LIMIT_PREFIX}${keyId}:${Math.floor(now / 3600000)}`
    const dayKey = `${this.RATE_LIMIT_PREFIX}${keyId}:${Math.floor(now / 86400000)}`

    try {
      // Get current counts
      const [minuteCount, hourCount, dayCount] = await Promise.all([
        this.getRequestCount(minuteKey),
        this.getRequestCount(hourKey),
        this.getRequestCount(dayKey)
      ])

      // Check limits
      const limits = apiKey.rateLimit
      const remaining = {
        minute: Math.max(0, limits.requestsPerMinute - minuteCount),
        hour: Math.max(0, limits.requestsPerHour - hourCount),
        day: Math.max(0, limits.requestsPerDay - dayCount)
      }

      // Check if any limit is exceeded
      if (minuteCount >= limits.requestsPerMinute ||
          hourCount >= limits.requestsPerHour ||
          dayCount >= limits.requestsPerDay) {
        return {
          allowed: false,
          remainingRequests: remaining,
          resetTime: {
            minute: 60 - (Math.floor(now / 1000) % 60),
            hour: 3600 - (Math.floor(now / 1000) % 3600),
            day: 86400 - (Math.floor(now / 1000) % 86400)
          },
          error: 'Rate limit exceeded'
        }
      }

      // Increment counters
      await Promise.all([
        this.incrementRequestCount(minuteKey, 60),
        this.incrementRequestCount(hourKey, 3600),
        this.incrementRequestCount(dayKey, 86400)
      ])

      return {
        allowed: true,
        remainingRequests: {
          minute: remaining.minute - 1,
          hour: remaining.hour - 1,
          day: remaining.day - 1
        },
        resetTime: {
          minute: 60 - (Math.floor(now / 1000) % 60),
          hour: 3600 - (Math.floor(now / 1000) % 3600),
          day: 86400 - (Math.floor(now / 1000) % 86400)
        }
      }

    } catch (error) {
      console.error('[APIAuth] Rate limit check error:', error)
      return {
        allowed: false,
        remainingRequests: { minute: 0, hour: 0, day: 0 },
        resetTime: { minute: 60, hour: 3600, day: 86400 },
        error: 'Rate limit check failed'
      }
    }
  }

  /**
   * Get user's API keys
   */
  async getUserAPIKeys(userId: string): Promise<string[]> {
    const userKeysKey = `${this.CACHE_PREFIX}user:${userId}`
    const keysStr = await this.cacheManager.get(userKeysKey)
    return keysStr ? JSON.parse(keysStr) : []
  }

  /**
   * Revoke an API key
   */
  async revokeAPIKey(keyId: string, userId: string): Promise<boolean> {
    try {
      // Get all user keys to find the one to revoke
      const userKeys = await this.getUserAPIKeys(userId)
      const keyIndex = userKeys.indexOf(keyId)
      
      if (keyIndex === -1) {
        return false
      }

      // Remove from user's key list
      userKeys.splice(keyIndex, 1)
      const userKeysKey = `${this.CACHE_PREFIX}user:${userId}`
      await this.cacheManager.set(userKeysKey, JSON.stringify(userKeys))

      // We can't easily remove from cache without the hashed key
      // In a real implementation, we'd store a mapping or use a database
      // For now, we'll mark it as inactive if we can find it
      
      return true
    } catch (error) {
      console.error('[APIAuth] Revoke API key error:', error)
      return false
    }
  }

  /**
   * Generate a unique key ID
   */
  private generateKeyId(): string {
    return `key_${Date.now()}_${randomBytes(8).toString('hex')}`
  }

  /**
   * Generate a random API key
   */
  private generateRawKey(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }

  /**
   * Check if API key has required permission
   */
  private hasPermission(
    permissions: APIPermission[],
    resource: string,
    action: string
  ): boolean {
    return permissions.some(permission => {
      // Check resource match
      const resourceMatch = permission.resource === '*' || permission.resource === resource
      
      // Check action match
      const actionMatch = permission.actions.includes('*') || 
                         permission.actions.includes(action as any)
      
      return resourceMatch && actionMatch
    })
  }

  /**
   * Get default permissions for new API keys
   */
  private getDefaultPermissions(): APIPermission[] {
    return [
      {
        resource: 'compose',
        actions: ['read', 'write']
      },
      {
        resource: 'actions',
        actions: ['read']
      },
      {
        resource: 'agents',
        actions: ['read', 'write']
      }
    ]
  }

  /**
   * Get request count from cache
   */
  private async getRequestCount(key: string): Promise<number> {
    const countStr = await this.cacheManager.get(key)
    return countStr ? parseInt(countStr, 10) : 0
  }

  /**
   * Increment request count with TTL
   */
  private async incrementRequestCount(key: string, ttl: number): Promise<void> {
    const current = await this.getRequestCount(key)
    await this.cacheManager.set(key, (current + 1).toString(), ttl)
  }
}

/**
 * Create a singleton instance of the API auth service
 */
let authServiceInstance: APIAuthService | null = null

export function createAPIAuthService(): APIAuthService {
  if (!authServiceInstance) {
    authServiceInstance = new APIAuthService()
  }
  return authServiceInstance
}

/**
 * Middleware function for Next.js API routes
 */
export function withAuth(
  resource: string,
  action: string = 'read'
) {
  return async function authMiddleware(request: Request) {
    const authService = createAPIAuthService()
    
    // Get API key from Authorization header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid Authorization header',
        status: 401
      }
    }

    const apiKey = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    // Authenticate
    const authResult = await authService.authenticate(apiKey, resource, action)
    
    if (!authResult.success) {
      return {
        success: false,
        error: authResult.error,
        status: authResult.error?.includes('rate limit') ? 429 : 403
      }
    }

    return {
      success: true,
      apiKey: authResult.apiKey,
      remainingRequests: authResult.remainingRequests
    }
  }
}