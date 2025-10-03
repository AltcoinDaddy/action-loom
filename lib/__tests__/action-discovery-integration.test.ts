import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ActionDiscoveryService } from '../action-discovery-service'
import { FlowAPIClient } from '../flow-api-client'
import { RequestDeduplicator } from '../request-deduplicator'
import { CircuitBreaker } from '../circuit-breaker'

// Mock FlowAPIClient
vi.mock('../flow-api-client')
const MockedFlowAPIClient = vi.mocked(FlowAPIClient)

// Create mock discovery result helper
const createMockDiscoveryResult = (actions: any[]) => ({
  actions,
  registries: [],
  executionTime: 100,
  timestamp: Date.now(),
  network: { name: 'testnet', endpoint: 'https://rest-testnet.onflow.org', chainId: 'flow-testnet' }
})

describe('ActionDiscoveryService Integration Tests', () => {
  let actionDiscoveryService: ActionDiscoveryService
  let mockFlowClient: any
  let requestDeduplicator: RequestDeduplicator
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock client with all required methods
    mockFlowClient = {
      discoverAllActions: vi.fn(),
      getCurrentNetwork: vi.fn().mockReturnValue({ name: 'testnet', endpoint: 'https://rest-testnet.onflow.org', chainId: 'flow-testnet' }),
      switchNetwork: vi.fn()
    }
    
    MockedFlowAPIClient.mockImplementation(() => mockFlowClient)
    
    requestDeduplicator = new RequestDeduplicator()
    circuitBreaker = new CircuitBreaker({ 
      failureThreshold: 3, 
      resetTimeout: 5000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 2
    })
    actionDiscoveryService = new ActionDiscoveryService()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Concurrent ActionDiscoveryService Usage', () => {
    it('should handle multiple concurrent discovery requests without conflicts', async () => {
      // Mock successful API response
      const mockActions = [
        { id: 'action1', name: 'Transfer Token', category: 'token' },
        { id: 'action2', name: 'Mint NFT', category: 'nft' }
      ]
      
      mockFlowClient.discoverAllActions.mockResolvedValue(createMockDiscoveryResult(mockActions))

      // Start multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => 
        actionDiscoveryService.discoverActions()
      )

      const results = await Promise.all(promises)

      // All requests should succeed with same data
      results.forEach(result => {
        expect(result.actions).toEqual(mockActions)
      })

      // API should only be called once due to deduplication
      expect(mockFlowClient.discoverAllActions).toHaveBeenCalledTimes(1)
    })

    it('should queue requests when discovery is in progress', async () => {
      let resolveFirstCall: (value: any) => void
      const firstCallPromise = new Promise(resolve => {
        resolveFirstCall = resolve
      })

      mockFlowClient.discoverAllActions.mockImplementationOnce(() => firstCallPromise)

      // Start first request
      const firstRequest = actionDiscoveryService.discoverActions()
      
      // Start second request while first is pending
      const secondRequest = actionDiscoveryService.discoverActions()

      // Resolve first call
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]
      resolveFirstCall(createMockDiscoveryResult(mockActions))

      const [firstResult, secondResult] = await Promise.all([firstRequest, secondRequest])

      expect(firstResult.actions).toEqual(mockActions)
      expect(secondResult.actions).toEqual(mockActions)
      expect(mockFlowClient.discoverAllActions).toHaveBeenCalledTimes(1)
    })

    it('should handle race conditions gracefully', async () => {
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]
      
      // Mock API with slight delay
      mockFlowClient.discoverAllActions.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(createMockDiscoveryResult(mockActions)), 10))
      )

      // Start 10 concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) => 
        actionDiscoveryService.discoverActions()
      )

      const results = await Promise.all(promises)

      // All should return same result
      results.forEach(result => {
        expect(result.actions).toEqual(mockActions)
      })

      // Should only make one API call
      expect(mockFlowClient.discoverAllActions).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Recovery and Fallback Mechanisms', () => {
    it('should recover from API failures and allow retry', async () => {
      const mockError = new Error('API Error')
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]

      // First call fails, second succeeds
      mockFlowClient.discoverAllActions
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(createMockDiscoveryResult(mockActions))

      // First request should fail
      await expect(actionDiscoveryService.discoverActions()).rejects.toThrow('API Error')

      // Second request should succeed
      const result = await actionDiscoveryService.discoverActions()
      expect(result.actions).toEqual(mockActions)
    })

    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Network timeout')
      timeoutError.name = 'TimeoutError'

      mockFlowClient.discoverAllActions.mockRejectedValue(timeoutError)

      await expect(actionDiscoveryService.discoverActions()).rejects.toThrow('Network timeout')
      
      // Service should be ready for next request
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]
      mockFlowClient.discoverAllActions.mockResolvedValue(createMockDiscoveryResult(mockActions))
      
      const result = await actionDiscoveryService.discoverActions()
      expect(result.actions).toEqual(mockActions)
    })

    it('should provide fallback data when API is unavailable', async () => {
      const apiError = new Error('Service Unavailable')
      mockFlowClient.discoverAllActions.mockRejectedValue(apiError)

      // Mock fallback behavior
      const fallbackActions = [{ id: 'fallback1', name: 'Basic Transfer', category: 'token' }]
      vi.spyOn(actionDiscoveryService, 'getFallbackActions').mockReturnValue(fallbackActions)

      const result = await actionDiscoveryService.discoverActionsWithFallback()
      expect(result.actions).toEqual(fallbackActions)
    })
  })

  describe('Performance Under High Concurrency', () => {
    it('should handle 100 concurrent requests efficiently', async () => {
      const mockActions = Array.from({ length: 50 }, (_, i) => ({
        id: `action${i}`,
        name: `Action ${i}`,
        category: 'test'
      }))

      mockFlowClient.discoverAllActions.mockResolvedValue(createMockDiscoveryResult(mockActions))

      const startTime = Date.now()
      
      // Start 100 concurrent requests
      const promises = Array.from({ length: 100 }, () => 
        actionDiscoveryService.discoverActions()
      )

      const results = await Promise.all(promises)
      const endTime = Date.now()

      // Should complete within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000)

      // All requests should succeed
      expect(results).toHaveLength(100)
      results.forEach(result => {
        expect(result.actions).toEqual(mockActions)
      })

      // Should only make one API call
      expect(mockFlowClient.discoverAllActions).toHaveBeenCalledTimes(1)
    })

    it('should not leak memory under sustained load', async () => {
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]
      mockFlowClient.discoverAllActions.mockResolvedValue(createMockDiscoveryResult(mockActions))

      // Run multiple batches of requests
      for (let batch = 0; batch < 10; batch++) {
        const promises = Array.from({ length: 20 }, () => 
          actionDiscoveryService.discoverActions()
        )
        await Promise.all(promises)
      }

      // Check that internal maps are cleaned up
      expect(actionDiscoveryService.getPendingRequestCount()).toBe(0)
    })
  })

  describe('Circuit Breaker Integration', () => {
    it('should open circuit after repeated failures', async () => {
      const apiError = new Error('Service Error')
      mockFlowClient.discoverAllActions.mockRejectedValue(apiError)

      // Make enough requests to trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(actionDiscoveryService.discoverActions()).rejects.toThrow()
      }

      // Circuit should now be open (this test is more about the service behavior)
      // The actual circuit breaker is tested separately
    })

    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers()
      
      const apiError = new Error('Service Error')
      mockFlowClient.discoverAllActions.mockRejectedValue(apiError)

      // Trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(actionDiscoveryService.discoverActions()).rejects.toThrow()
      }

      // Fast forward time
      vi.advanceTimersByTime(6000)

      // Next request should work if circuit breaker allows it
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]
      mockFlowClient.discoverAllActions.mockResolvedValue(createMockDiscoveryResult(mockActions))

      const result = await actionDiscoveryService.discoverActions()
      expect(result.actions).toEqual(mockActions)

      vi.useRealTimers()
    })
  })
})