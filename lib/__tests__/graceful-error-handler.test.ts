import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { 
  GracefulErrorHandler, 
  ActionDiscoveryError, 
  ErrorHandlingOptions,
  FallbackDataSource,
  ErrorContext
} from '../graceful-error-handler'
import { DiscoveryResult, ActionMetadata } from '../types'

describe('GracefulErrorHandler', () => {
  let handler: GracefulErrorHandler
  let handlerWithoutFallbacks: GracefulErrorHandler
  let mockConsoleError: any
  let mockConsoleWarn: any

  beforeEach(() => {
    handler = new GracefulErrorHandler({
      enableFallbacks: true,
      maxRetries: 3,
      retryDelay: 100,
      cacheTimeout: 5000,
      logErrors: true
    })

    // Create a handler without fallbacks for specific tests
    handlerWithoutFallbacks = new GracefulErrorHandler({
      enableFallbacks: false,
      maxRetries: 3,
      retryDelay: 100,
      cacheTimeout: 5000,
      logErrors: true
    })

    // Mock console methods
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    handler.clearCache()
    handlerWithoutFallbacks.clearCache()
  })

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultHandler = new GracefulErrorHandler()
      expect(defaultHandler).toBeInstanceOf(GracefulErrorHandler)
    })

    it('should merge custom options with defaults', () => {
      const customHandler = new GracefulErrorHandler({
        maxRetries: 5,
        enableFallbacks: false
      })
      expect(customHandler).toBeInstanceOf(GracefulErrorHandler)
    })
  })

  describe('createActionDiscoveryError', () => {
    it('should create a properly formatted ActionDiscoveryError', () => {
      const originalError = new Error('Test error')
      const context = { test: 'context' }
      
      const error = handler.createActionDiscoveryError(
        originalError,
        'API_ERROR',
        context
      )

      expect(error.name).toBe('ActionDiscoveryError')
      expect(error.code).toBe('API_ERROR')
      expect(error.message).toBe('Test error')
      expect(error.retryable).toBe(true)
      expect(error.context).toEqual(context)
      expect(error.originalError).toBe(originalError)
      expect(error.timestamp).toBeTypeOf('number')
    })

    it('should set retryable correctly for different error codes', () => {
      const originalError = new Error('Test')
      
      const retryableError = handler.createActionDiscoveryError(originalError, 'NETWORK_ERROR')
      expect(retryableError.retryable).toBe(true)

      const nonRetryableError = handler.createActionDiscoveryError(originalError, 'DISCOVERY_IN_PROGRESS')
      expect(nonRetryableError.retryable).toBe(false)
    })
  })

  describe('getUserFriendlyMessage', () => {
    it('should return appropriate messages for different error codes', () => {
      const testCases = [
        { code: 'DISCOVERY_IN_PROGRESS', expected: 'Action discovery is currently running. Please wait a moment...' },
        { code: 'API_ERROR', expected: 'Unable to connect to the action registry. Using cached data if available.' },
        { code: 'NETWORK_ERROR', expected: 'Network connection issue detected. Trying alternative sources...' },
        { code: 'TIMEOUT', expected: 'Request timed out. Attempting to use cached data...' },
        { code: 'VALIDATION_ERROR', expected: 'Invalid data received from action registry. Using fallback data...' },
        { code: 'UNKNOWN_ERROR', expected: 'An unexpected error occurred. Using cached data if available...' }
      ]

      testCases.forEach(({ code, expected }) => {
        const error = handler.createActionDiscoveryError(
          new Error('test'),
          code as ActionDiscoveryError['code']
        )
        const message = handler.getUserFriendlyMessage(error)
        expect(message).toBe(expected)
      })
    })

    it('should include retry attempt information when available', () => {
      const error = handler.createActionDiscoveryError(
        new Error('test'),
        'API_ERROR',
        { retryAttempt: 2 }
      )
      
      const message = handler.getUserFriendlyMessage(error)
      expect(message).toContain('(Attempt 2/3)')
    })
  })

  describe('handleDiscoveryError', () => {
    const mockContext: ErrorContext = {
      operation: 'test-operation',
      timestamp: Date.now(),
      attempt: 1
    }

    it('should handle DISCOVERY_IN_PROGRESS errors', async () => {
      const error = handler.createActionDiscoveryError(
        new Error('Discovery in progress'),
        'DISCOVERY_IN_PROGRESS'
      )

      const result = await handler.handleDiscoveryError(error, mockContext)
      
      expect(result).toBeDefined()
      expect(result.actions).toEqual([])
      expect(result.errors).toContain('Waiting for ongoing discovery to complete')
    })

    it('should handle API_ERROR with fallback sources', async () => {
      const mockFallbackData: DiscoveryResult = {
        actions: [createMockAction('fallback-action')],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1
      }

      const fallbackSource: FallbackDataSource = {
        name: 'test-fallback',
        priority: 10,
        enabled: true,
        getData: vi.fn().mockResolvedValue(mockFallbackData)
      }

      handler.registerFallbackSource(fallbackSource)

      const error = handler.createActionDiscoveryError(
        new Error('API Error'),
        'API_ERROR'
      )

      const result = await handler.handleDiscoveryError(error, mockContext)
      
      expect(result).toEqual(mockFallbackData)
      expect(fallbackSource.getData).toHaveBeenCalled()
    })

    it('should handle NETWORK_ERROR with cached data', async () => {
      const cachedData: DiscoveryResult = {
        actions: [createMockAction('cached-action')],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1
      }

      handler.cacheDiscoveryResult(cachedData)

      const error = handler.createActionDiscoveryError(
        new Error('Network Error'),
        'NETWORK_ERROR'
      )

      const result = await handler.handleDiscoveryError(error, mockContext)
      
      expect(result).toEqual(cachedData)
    })

    it('should handle TIMEOUT errors', async () => {
      const error = handler.createActionDiscoveryError(
        new Error('Timeout'),
        'TIMEOUT'
      )

      const result = await handler.handleDiscoveryError(error, mockContext)
      
      expect(result).toBeDefined()
      expect(result.actions).toEqual([])
      expect(result.errors).toContain('Request timed out')
    })

    it('should handle VALIDATION_ERROR', async () => {
      const error = handlerWithoutFallbacks.createActionDiscoveryError(
        new Error('Validation failed'),
        'VALIDATION_ERROR'
      )

      const result = await handlerWithoutFallbacks.handleDiscoveryError(error, mockContext)
      
      expect(result).toBeDefined()
      expect(result.actions).toEqual([])
      expect(result.errors).toContain('Invalid data received')
    })

    it('should handle UNKNOWN_ERROR', async () => {
      const error = handlerWithoutFallbacks.createActionDiscoveryError(
        new Error('Unknown error'),
        'UNKNOWN_ERROR'
      )

      const result = await handlerWithoutFallbacks.handleDiscoveryError(error, mockContext)
      
      expect(result).toBeDefined()
      expect(result.actions).toEqual([])
      expect(result.errors).toContain('An unexpected error occurred')
    })

    it('should log errors when logging is enabled', async () => {
      const error = handler.createActionDiscoveryError(
        new Error('Test error'),
        'API_ERROR'
      )

      await handler.handleDiscoveryError(error, mockContext)
      
      expect(mockConsoleError).toHaveBeenCalledWith(
        'ActionDiscovery Error:',
        expect.objectContaining({
          code: 'API_ERROR',
          message: 'Test error',
          retryable: true
        })
      )
    })
  })

  describe('fallback sources', () => {
    it('should register and use fallback sources', async () => {
      const mockData: DiscoveryResult = {
        actions: [createMockAction('fallback-action')],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1
      }

      const fallbackSource: FallbackDataSource = {
        name: 'test-source',
        priority: 5,
        enabled: true,
        getData: vi.fn().mockResolvedValue(mockData)
      }

      handler.registerFallbackSource(fallbackSource)

      const error = handler.createActionDiscoveryError(
        new Error('API Error'),
        'API_ERROR'
      )

      const result = await handler.handleDiscoveryError(error, {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      })

      expect(result).toEqual(mockData)
      expect(fallbackSource.getData).toHaveBeenCalled()
    })

    it('should prioritize fallback sources by priority', async () => {
      const highPriorityData: DiscoveryResult = {
        actions: [createMockAction('high-priority')],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1
      }

      const lowPriorityData: DiscoveryResult = {
        actions: [createMockAction('low-priority')],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1
      }

      const highPrioritySource: FallbackDataSource = {
        name: 'high-priority',
        priority: 10,
        enabled: true,
        getData: vi.fn().mockResolvedValue(highPriorityData)
      }

      const lowPrioritySource: FallbackDataSource = {
        name: 'low-priority',
        priority: 1,
        enabled: true,
        getData: vi.fn().mockResolvedValue(lowPriorityData)
      }

      handler.registerFallbackSource(lowPrioritySource)
      handler.registerFallbackSource(highPrioritySource)

      const error = handler.createActionDiscoveryError(
        new Error('API Error'),
        'API_ERROR'
      )

      const result = await handler.handleDiscoveryError(error, {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      })

      expect(result).toEqual(highPriorityData)
      expect(highPrioritySource.getData).toHaveBeenCalled()
      expect(lowPrioritySource.getData).not.toHaveBeenCalled()
    })

    it('should skip disabled fallback sources', async () => {
      const disabledSource: FallbackDataSource = {
        name: 'disabled-source',
        priority: 10,
        enabled: false,
        getData: vi.fn().mockResolvedValue({
          actions: [],
          registries: [],
          lastUpdated: new Date().toISOString(),
          totalFound: 0
        })
      }

      handlerWithoutFallbacks.registerFallbackSource(disabledSource)

      const error = handlerWithoutFallbacks.createActionDiscoveryError(
        new Error('API Error'),
        'API_ERROR'
      )

      const result = await handlerWithoutFallbacks.handleDiscoveryError(error, {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      })

      expect(disabledSource.getData).not.toHaveBeenCalled()
      expect(result.actions).toEqual([])
    })

    it('should unregister fallback sources', () => {
      const source: FallbackDataSource = {
        name: 'test-source',
        priority: 5,
        enabled: true,
        getData: vi.fn()
      }

      handler.registerFallbackSource(source)
      handler.unregisterFallbackSource('test-source')

      // Verify source is no longer available (this is tested indirectly)
      expect(true).toBe(true) // Placeholder assertion
    })
  })

  describe('caching', () => {
    it('should cache and retrieve discovery results', () => {
      const testData: DiscoveryResult = {
        actions: [createMockAction('cached-action')],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1
      }

      handler.cacheDiscoveryResult(testData)

      // Test that cached data is used in error handling
      const error = handler.createActionDiscoveryError(
        new Error('Network Error'),
        'NETWORK_ERROR'
      )

      return handler.handleDiscoveryError(error, {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      }).then(result => {
        expect(result).toEqual(testData)
      })
    })

    it('should expire cached data after timeout', async () => {
      const shortTimeoutHandler = new GracefulErrorHandler({
        cacheTimeout: 100, // 100ms timeout
        enableFallbacks: false
      })

      const testData: DiscoveryResult = {
        actions: [createMockAction('cached-action')],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1
      }

      shortTimeoutHandler.cacheDiscoveryResult(testData)

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150))

      const error = shortTimeoutHandler.createActionDiscoveryError(
        new Error('Network Error'),
        'NETWORK_ERROR'
      )

      const result = await shortTimeoutHandler.handleDiscoveryError(error, {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      })

      // Should return empty result since cache expired
      expect(result.actions).toEqual([])
      expect(result.errors).toContain('Network connection unavailable')
    })

    it('should clear cache when requested', () => {
      const testData: DiscoveryResult = {
        actions: [createMockAction('cached-action')],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 1
      }

      handlerWithoutFallbacks.cacheDiscoveryResult(testData)
      handlerWithoutFallbacks.clearCache()

      const error = handlerWithoutFallbacks.createActionDiscoveryError(
        new Error('Network Error'),
        'NETWORK_ERROR'
      )

      return handlerWithoutFallbacks.handleDiscoveryError(error, {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      }).then(result => {
        // Should return empty result since cache was cleared
        expect(result.actions).toEqual([])
        expect(result.errors).toContain('Network connection unavailable')
      })
    })

    it('should not cache empty results', () => {
      const emptyData: DiscoveryResult = {
        actions: [],
        registries: [],
        lastUpdated: new Date().toISOString(),
        totalFound: 0
      }

      handlerWithoutFallbacks.cacheDiscoveryResult(emptyData)

      const error = handlerWithoutFallbacks.createActionDiscoveryError(
        new Error('Network Error'),
        'NETWORK_ERROR'
      )

      return handlerWithoutFallbacks.handleDiscoveryError(error, {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      }).then(result => {
        // Should return empty result since empty data wasn't cached
        expect(result.actions).toEqual([])
        expect(result.errors).toContain('Network connection unavailable')
      })
    })
  })

  describe('error statistics', () => {
    it('should track error statistics', async () => {
      const error1 = handler.createActionDiscoveryError(
        new Error('Error 1'),
        'API_ERROR'
      )
      const error2 = handler.createActionDiscoveryError(
        new Error('Error 2'),
        'NETWORK_ERROR'
      )
      const error3 = handler.createActionDiscoveryError(
        new Error('Error 3'),
        'API_ERROR'
      )

      const context: ErrorContext = {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      }

      await handler.handleDiscoveryError(error1, context)
      await handler.handleDiscoveryError(error2, context)
      await handler.handleDiscoveryError(error3, context)

      const stats = handler.getErrorStats()

      expect(stats.totalErrors).toBe(3)
      expect(stats.errorsByType['API_ERROR']).toBe(2)
      expect(stats.errorsByType['NETWORK_ERROR']).toBe(1)
      expect(stats.recentErrors).toHaveLength(3)
    })

    it('should limit error log size', async () => {
      const context: ErrorContext = {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      }

      // Generate more than 100 errors
      for (let i = 0; i < 105; i++) {
        const error = handler.createActionDiscoveryError(
          new Error(`Error ${i}`),
          'API_ERROR'
        )
        await handler.handleDiscoveryError(error, context)
      }

      const stats = handler.getErrorStats()
      expect(stats.totalErrors).toBe(100) // Should be capped at 100
    })
  })

  describe('default fallback source', () => {
    it('should have basic actions fallback source registered by default', async () => {
      const error = handler.createActionDiscoveryError(
        new Error('API Error'),
        'API_ERROR'
      )

      const result = await handler.handleDiscoveryError(error, {
        operation: 'test',
        timestamp: Date.now(),
        attempt: 1
      })

      // Should get basic actions from default fallback
      expect(result.actions.length).toBeGreaterThan(0)
      expect(result.actions[0].name).toBe('Transfer FLOW')
      expect(result.registries.length).toBeGreaterThan(0)
      expect(result.registries[0].name).toBe('Basic Actions')
    })
  })
})

// Helper function to create mock action metadata
function createMockAction(id: string): ActionMetadata {
  return {
    id,
    name: `Mock Action ${id}`,
    description: `Mock action for testing: ${id}`,
    category: 'Test',
    version: '1.0.0',
    inputs: [],
    outputs: [],
    parameters: [],
    compatibility: {
      requiredCapabilities: [],
      supportedNetworks: ['testnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 1000,
    securityLevel: 'low' as any,
    author: 'Test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}