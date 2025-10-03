import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the API auth service
vi.mock('@/lib/api-auth-service', () => ({
  createAPIAuthService: vi.fn(() => ({
    getUserAPIKeys: vi.fn(),
    generateAPIKey: vi.fn(),
    storeAPIKey: vi.fn(),
    revokeAPIKey: vi.fn()
  })),
  DEFAULT_RATE_LIMITS: {
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
  }
}))

// Import API handlers
import { GET as getHandler, POST as postHandler, DELETE as deleteHandler } from '@/app/api/auth/keys/route'

describe('API Key Management Endpoint', () => {
  let mockAuthService: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Get the mocked auth service
    const { createAPIAuthService } = require('@/lib/api-auth-service')
    mockAuthService = createAPIAuthService()
  })

  describe('GET /api/auth/keys', () => {
    it('should list user API keys', async () => {
      const keyIds = ['key1', 'key2', 'key3']
      mockAuthService.getUserAPIKeys.mockResolvedValueOnce(keyIds)

      const request = new NextRequest('http://localhost:3000/api/auth/keys?userId=user123')
      const response = await getHandler(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.keys).toHaveLength(3)
      expect(data.total).toBe(3)
      expect(mockAuthService.getUserAPIKeys).toHaveBeenCalledWith('user123')
    })

    it('should return error for missing userId', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/keys')
      const response = await getHandler(request)
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing required parameter: userId')
    })

    it('should handle empty key list', async () => {
      mockAuthService.getUserAPIKeys.mockResolvedValueOnce([])

      const request = new NextRequest('http://localhost:3000/api/auth/keys?userId=user123')
      const response = await getHandler(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.keys).toHaveLength(0)
      expect(data.total).toBe(0)
    })
  })

  describe('POST /api/auth/keys', () => {
    it('should create new API key', async () => {
      const mockApiKey = {
        id: 'key_123',
        key: 'al_' + 'a'.repeat(64),
        name: 'Test Key',
        permissions: [],
        rateLimit: {
          requestsPerMinute: 10,
          requestsPerHour: 100,
          requestsPerDay: 1000,
          burstLimit: 20
        },
        createdAt: new Date().toISOString(),
        expiresAt: undefined
      }

      mockAuthService.generateAPIKey.mockReturnValueOnce(mockApiKey)
      mockAuthService.storeAPIKey.mockResolvedValueOnce(undefined)

      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Key',
          userId: 'user123',
          tier: 'free'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await postHandler(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.apiKey.key).toBe(mockApiKey.key)
      expect(data.apiKey.name).toBe('Test Key')
      expect(data.message).toContain('Store this key securely')
      
      expect(mockAuthService.generateAPIKey).toHaveBeenCalledWith(
        'Test Key',
        'user123',
        undefined,
        expect.any(Object),
        undefined
      )
      expect(mockAuthService.storeAPIKey).toHaveBeenCalledWith(mockApiKey)
    })

    it('should create API key with pro tier limits', async () => {
      const mockApiKey = {
        id: 'key_123',
        key: 'al_' + 'a'.repeat(64),
        name: 'Pro Key',
        permissions: [],
        rateLimit: {
          requestsPerMinute: 100,
          requestsPerHour: 5000,
          requestsPerDay: 50000,
          burstLimit: 200
        },
        createdAt: new Date().toISOString(),
        expiresAt: undefined
      }

      mockAuthService.generateAPIKey.mockReturnValueOnce(mockApiKey)
      mockAuthService.storeAPIKey.mockResolvedValueOnce(undefined)

      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Pro Key',
          userId: 'user123',
          tier: 'pro'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await postHandler(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.apiKey.rateLimit.requestsPerMinute).toBe(100)
    })

    it('should create API key with expiration', async () => {
      const expiresAt = new Date(Date.now() + 86400000) // 1 day
      const mockApiKey = {
        id: 'key_123',
        key: 'al_' + 'a'.repeat(64),
        name: 'Expiring Key',
        permissions: [],
        rateLimit: {
          requestsPerMinute: 10,
          requestsPerHour: 100,
          requestsPerDay: 1000,
          burstLimit: 20
        },
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }

      mockAuthService.generateAPIKey.mockReturnValueOnce(mockApiKey)
      mockAuthService.storeAPIKey.mockResolvedValueOnce(undefined)

      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Expiring Key',
          userId: 'user123',
          expiresInDays: 1
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await postHandler(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.apiKey.expiresAt).toBeDefined()
    })

    it('should return error for missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Key'
          // Missing userId
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await postHandler(request)
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing required fields: name, userId')
    })

    it('should create API key with custom permissions', async () => {
      const customPermissions = [
        { resource: 'compose', actions: ['read'] }
      ]

      const mockApiKey = {
        id: 'key_123',
        key: 'al_' + 'a'.repeat(64),
        name: 'Custom Key',
        permissions: customPermissions,
        rateLimit: {
          requestsPerMinute: 10,
          requestsPerHour: 100,
          requestsPerDay: 1000,
          burstLimit: 20
        },
        createdAt: new Date().toISOString(),
        expiresAt: undefined
      }

      mockAuthService.generateAPIKey.mockReturnValueOnce(mockApiKey)
      mockAuthService.storeAPIKey.mockResolvedValueOnce(undefined)

      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Custom Key',
          userId: 'user123',
          permissions: customPermissions
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await postHandler(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.apiKey.permissions).toEqual(customPermissions)
    })
  })

  describe('DELETE /api/auth/keys', () => {
    it('should revoke API key', async () => {
      mockAuthService.revokeAPIKey.mockResolvedValueOnce(true)

      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'DELETE',
        body: JSON.stringify({
          keyId: 'key_123',
          userId: 'user123'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await deleteHandler(request)
      
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('API key revoked successfully')
      
      expect(mockAuthService.revokeAPIKey).toHaveBeenCalledWith('key_123', 'user123')
    })

    it('should return error for non-existent key', async () => {
      mockAuthService.revokeAPIKey.mockResolvedValueOnce(false)

      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'DELETE',
        body: JSON.stringify({
          keyId: 'nonexistent',
          userId: 'user123'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await deleteHandler(request)
      
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('API key not found or already revoked')
    })

    it('should return error for missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'DELETE',
        body: JSON.stringify({
          keyId: 'key_123'
          // Missing userId
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await deleteHandler(request)
      
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Missing required fields: keyId, userId')
    })
  })

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockAuthService.getUserAPIKeys.mockRejectedValueOnce(new Error('Service error'))

      const request = new NextRequest('http://localhost:3000/api/auth/keys?userId=user123')
      const response = await getHandler(request)
      
      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch API keys')
      expect(data.details).toBe('Service error')
    })

    it('should handle API key creation errors', async () => {
      mockAuthService.generateAPIKey.mockImplementationOnce(() => {
        throw new Error('Generation failed')
      })

      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Key',
          userId: 'user123'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await postHandler(request)
      
      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('API key creation failed')
    })

    it('should handle API key revocation errors', async () => {
      mockAuthService.revokeAPIKey.mockRejectedValueOnce(new Error('Revocation failed'))

      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'DELETE',
        body: JSON.stringify({
          keyId: 'key_123',
          userId: 'user123'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await deleteHandler(request)
      
      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('API key revocation failed')
    })
  })
})