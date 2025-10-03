import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  APIAuthService, 
  createAPIAuthService, 
  withAuth,
  DEFAULT_RATE_LIMITS,
  APIPermission 
} from '@/lib/api-auth-service'

// Mock Redis cache manager
vi.mock('@/lib/redis-cache-manager', () => ({
  createRedisCacheManager: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  })),
  RedisCacheManager: vi.fn()
}))

describe('API Authentication Service', () => {
  let authService: APIAuthService
  let mockCache: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock cache
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn()
    }
    
    // Create auth service with mock cache
    authService = new APIAuthService(mockCache)
  })

  describe('API Key Generation', () => {
    it('should generate valid API key', () => {
      const apiKey = authService.generateAPIKey(
        'Test Key',
        'user123',
        [],
        DEFAULT_RATE_LIMITS.free
      )

      expect(apiKey).toHaveProperty('id')
      expect(apiKey).toHaveProperty('key')
      expect(apiKey).toHaveProperty('hashedKey')
      expect(apiKey.key).toMatch(/^al_[a-f0-9]{64}$/)
      expect(apiKey.name).toBe('Test Key')
      expect(apiKey.userId).toBe('user123')
      expect(apiKey.isActive).toBe(true)
      expect(apiKey.permissions).toHaveLength(3) // Default permissions
    })

    it('should generate unique API keys', () => {
      const key1 = authService.generateAPIKey('Key 1', 'user1')
      const key2 = authService.generateAPIKey('Key 2', 'user2')

      expect(key1.id).not.toBe(key2.id)
      expect(key1.key).not.toBe(key2.key)
      expect(key1.hashedKey).not.toBe(key2.hashedKey)
    })

    it('should set custom permissions', () => {
      const permissions: APIPermission[] = [
        { resource: 'compose', actions: ['read'] }
      ]

      const apiKey = authService.generateAPIKey(
        'Custom Key',
        'user123',
        permissions
      )

      expect(apiKey.permissions).toEqual(permissions)
    })

    it('should set expiration date', () => {
      const expiresAt = new Date(Date.now() + 86400000) // 1 day
      const apiKey = authService.generateAPIKey(
        'Expiring Key',
        'user123',
        [],
        DEFAULT_RATE_LIMITS.free,
        expiresAt
      )

      expect(apiKey.expiresAt).toBe(expiresAt.toISOString())
    })
  })

  describe('API Key Storage', () => {
    it('should store API key in cache', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      await authService.storeAPIKey(apiKey)

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('api_auth:'),
        expect.stringContaining('"id"'),
        undefined
      )
    })

    it('should store API key with TTL when expiration is set', async () => {
      const expiresAt = new Date(Date.now() + 3600000) // 1 hour
      const apiKey = authService.generateAPIKey(
        'Expiring Key',
        'user123',
        [],
        DEFAULT_RATE_LIMITS.free,
        expiresAt
      )
      
      await authService.storeAPIKey(apiKey)

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('api_auth:'),
        expect.stringContaining('"id"'),
        expect.any(Number)
      )
    })

    it('should not store raw key in cache', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      await authService.storeAPIKey(apiKey)

      const storedData = JSON.parse(mockCache.set.mock.calls[0][1])
      expect(storedData.key).toBeUndefined()
      expect(storedData.hashedKey).toBeDefined()
    })
  })

  describe('Authentication', () => {
    it('should authenticate valid API key', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      // Mock cache to return stored key data
      mockCache.get.mockResolvedValueOnce(JSON.stringify({
        ...apiKey,
        key: undefined
      }))
      
      // Mock rate limit checks
      mockCache.get.mockResolvedValue('0') // No previous requests

      const result = await authService.authenticate(apiKey.key, 'compose', 'read')

      expect(result.success).toBe(true)
      expect(result.apiKey).toBeDefined()
      expect(result.remainingRequests).toBeDefined()
    })

    it('should reject invalid API key format', async () => {
      const result = await authService.authenticate('invalid-key', 'compose', 'read')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid API key format')
    })

    it('should reject non-existent API key', async () => {
      mockCache.get.mockResolvedValueOnce(null)

      const result = await authService.authenticate('al_' + 'a'.repeat(64), 'compose', 'read')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid or expired API key')
    })

    it('should reject inactive API key', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      mockCache.get.mockResolvedValueOnce(JSON.stringify({
        ...apiKey,
        key: undefined,
        isActive: false
      }))

      const result = await authService.authenticate(apiKey.key, 'compose', 'read')

      expect(result.success).toBe(false)
      expect(result.error).toBe('API key is disabled')
    })

    it('should reject expired API key', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      mockCache.get.mockResolvedValueOnce(JSON.stringify({
        ...apiKey,
        key: undefined,
        expiresAt: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
      }))

      const result = await authService.authenticate(apiKey.key, 'compose', 'read')

      expect(result.success).toBe(false)
      expect(result.error).toBe('API key has expired')
    })

    it('should check permissions', async () => {
      const permissions: APIPermission[] = [
        { resource: 'actions', actions: ['read'] }
      ]
      
      const apiKey = authService.generateAPIKey('Test Key', 'user123', permissions)
      
      mockCache.get.mockResolvedValueOnce(JSON.stringify({
        ...apiKey,
        key: undefined
      }))

      // Should succeed for allowed resource/action
      const result1 = await authService.authenticate(apiKey.key, 'actions', 'read')
      expect(result1.success).toBe(true)

      // Should fail for disallowed resource/action
      mockCache.get.mockResolvedValueOnce(JSON.stringify({
        ...apiKey,
        key: undefined
      }))
      
      const result2 = await authService.authenticate(apiKey.key, 'compose', 'write')
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('Insufficient permissions')
    })
  })

  describe('Rate Limiting', () => {
    it('should allow requests within rate limits', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      // Mock no previous requests
      mockCache.get.mockResolvedValue('0')

      const result = await authService.checkRateLimit(apiKey)

      expect(result.allowed).toBe(true)
      expect(result.remainingRequests.minute).toBe(9) // 10 - 1
      expect(result.remainingRequests.hour).toBe(99) // 100 - 1
      expect(result.remainingRequests.day).toBe(999) // 1000 - 1
    })

    it('should reject requests exceeding minute limit', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      // Mock requests at minute limit
      mockCache.get.mockImplementation((key) => {
        if (key.includes(':' + Math.floor(Date.now() / 60000))) {
          return Promise.resolve('10') // At minute limit
        }
        return Promise.resolve('0')
      })

      const result = await authService.checkRateLimit(apiKey)

      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should reject requests exceeding hour limit', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      // Mock requests at hour limit
      mockCache.get.mockImplementation((key) => {
        if (key.includes(':' + Math.floor(Date.now() / 3600000))) {
          return Promise.resolve('100') // At hour limit
        }
        return Promise.resolve('0')
      })

      const result = await authService.checkRateLimit(apiKey)

      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should reject requests exceeding day limit', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      // Mock requests at day limit
      mockCache.get.mockImplementation((key) => {
        if (key.includes(':' + Math.floor(Date.now() / 86400000))) {
          return Promise.resolve('1000') // At day limit
        }
        return Promise.resolve('0')
      })

      const result = await authService.checkRateLimit(apiKey)

      expect(result.allowed).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should increment request counters', async () => {
      const apiKey = authService.generateAPIKey('Test Key', 'user123')
      
      mockCache.get.mockResolvedValue('5') // 5 previous requests

      await authService.checkRateLimit(apiKey)

      // Should increment all three counters
      expect(mockCache.set).toHaveBeenCalledTimes(3)
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), '6', 60)
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), '6', 3600)
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), '6', 86400)
    })
  })

  describe('withAuth Middleware', () => {
    it('should create auth middleware function', () => {
      const middleware = withAuth('compose', 'write')
      expect(typeof middleware).toBe('function')
    })

    it('should reject request without Authorization header', async () => {
      const middleware = withAuth('compose', 'write')
      const request = new Request('http://localhost/api/compose', {
        method: 'POST'
      })

      const result = await middleware(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing or invalid Authorization header')
      expect(result.status).toBe(401)
    })

    it('should reject request with invalid Authorization header', async () => {
      const middleware = withAuth('compose', 'write')
      const request = new Request('http://localhost/api/compose', {
        method: 'POST',
        headers: {
          'Authorization': 'Invalid header'
        }
      })

      const result = await middleware(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Missing or invalid Authorization header')
      expect(result.status).toBe(401)
    })
  })

  describe('User API Key Management', () => {
    it('should get user API keys', async () => {
      const userId = 'user123'
      const keyIds = ['key1', 'key2', 'key3']
      
      mockCache.get.mockResolvedValueOnce(JSON.stringify(keyIds))

      const result = await authService.getUserAPIKeys(userId)

      expect(result).toEqual(keyIds)
      expect(mockCache.get).toHaveBeenCalledWith(`api_auth:user:${userId}`)
    })

    it('should return empty array for user with no keys', async () => {
      mockCache.get.mockResolvedValueOnce(null)

      const result = await authService.getUserAPIKeys('user123')

      expect(result).toEqual([])
    })

    it('should revoke API key', async () => {
      const userId = 'user123'
      const keyId = 'key123'
      const userKeys = ['key123', 'key456']
      
      mockCache.get.mockResolvedValueOnce(JSON.stringify(userKeys))

      const result = await authService.revokeAPIKey(keyId, userId)

      expect(result).toBe(true)
      expect(mockCache.set).toHaveBeenCalledWith(
        `api_auth:user:${userId}`,
        JSON.stringify(['key456'])
      )
    })

    it('should return false when revoking non-existent key', async () => {
      const userId = 'user123'
      const keyId = 'nonexistent'
      const userKeys = ['key123', 'key456']
      
      mockCache.get.mockResolvedValueOnce(JSON.stringify(userKeys))

      const result = await authService.revokeAPIKey(keyId, userId)

      expect(result).toBe(false)
    })
  })

  describe('Rate Limit Tiers', () => {
    it('should have correct free tier limits', () => {
      expect(DEFAULT_RATE_LIMITS.free).toEqual({
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 1000,
        burstLimit: 20
      })
    })

    it('should have correct pro tier limits', () => {
      expect(DEFAULT_RATE_LIMITS.pro).toEqual({
        requestsPerMinute: 100,
        requestsPerHour: 5000,
        requestsPerDay: 50000,
        burstLimit: 200
      })
    })

    it('should have correct enterprise tier limits', () => {
      expect(DEFAULT_RATE_LIMITS.enterprise).toEqual({
        requestsPerMinute: 1000,
        requestsPerHour: 50000,
        requestsPerDay: 1000000,
        burstLimit: 2000
      })
    })
  })
})