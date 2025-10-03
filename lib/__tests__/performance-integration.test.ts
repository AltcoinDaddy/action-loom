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

describe('Performance Integration Tests', () => {
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
      failureThreshold: 5, 
      resetTimeout: 5000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 2
    })
    actionDiscoveryService = new ActionDiscoveryService()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('High-Concurrency Scenarios', () => {
    it('should handle 1000 concurrent requests efficiently', async () => {
      const mockActions = Array.from({ length: 100 }, (_, i) => ({
        id: `action${i}`,
        name: `Action ${i}`,
        category: 'test',
        description: `Test action ${i}`
      }))

      mockFlowClient.discoverAllActions.mockResolvedValue(createMockDiscoveryResult(mockActions))

      const startTime = performance.now()
      
      // Start 1000 concurrent requests
      const promises = Array.from({ length: 1000 }, () => 
        actionDiscoveryService.discoverActions()
      )

      const results = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000)

      // All requests should succeed
      expect(results).toHaveLength(1000)
      results.forEach(result => {
        expect(result.actions).toEqual(mockActions)
      })

      // Should only make one API call due to deduplication
      expect(mockFlowClient.discoverAllActions).toHaveBeenCalledTimes(1)

      console.log(`1000 concurrent requests completed in ${duration.toFixed(2)}ms`)
    })

    it('should maintain performance under sustained load', async () => {
      const mockActions = [
        { id: 'action1', name: 'Test Action', category: 'test' }
      ]
      
      mockFlowClient.discoverAllActions.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(createMockDiscoveryResult(mockActions)), 10))
      )

      const batchSize = 50
      const numBatches = 20
      const results: number[] = []

      // Run multiple batches sequentially
      for (let batch = 0; batch < numBatches; batch++) {
        const startTime = performance.now()
        
        const promises = Array.from({ length: batchSize }, () => 
          actionDiscoveryService.discoverActions()
        )
        
        await Promise.all(promises)
        
        const endTime = performance.now()
        results.push(endTime - startTime)
      }

      // Performance should remain consistent (no significant degradation)
      const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length
      const maxTime = Math.max(...results)
      const minTime = Math.min(...results)

      expect(maxTime - minTime).toBeLessThan(avgTime * 0.5) // Max variance of 50%
      
      console.log(`Sustained load test - Avg: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`)
    })

    it('should handle mixed success/failure scenarios efficiently', async () => {
      let callCount = 0
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]

      mockFlowClient.discoverAllActions.mockImplementation(() => {
        callCount++
        // Fail every 5th request
        if (callCount % 5 === 0) {
          return Promise.reject(new Error('Intermittent failure'))
        }
        return Promise.resolve(createMockDiscoveryResult(mockActions))
      })

      const startTime = performance.now()
      
      // Start 500 concurrent requests
      const promises = Array.from({ length: 500 }, () => 
        actionDiscoveryService.discoverActions().catch(error => ({ error: error.message }))
      )

      const results = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within reasonable time
      expect(duration).toBeLessThan(3000)

      // Count successes and failures
      const successes = results.filter(result => !('error' in result))
      const failures = results.filter(result => 'error' in result)

      expect(successes.length).toBeGreaterThan(0)
      expect(failures.length).toBeGreaterThan(0)

      console.log(`Mixed scenario: ${successes.length} successes, ${failures.length} failures in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Memory Usage and Cleanup', () => {
    it('should not leak memory during extended operation', async () => {
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]
      mockFlowClient.discoverAllActions.mockResolvedValue(createMockDiscoveryResult(mockActions))

      // Simulate extended operation with multiple cycles
      for (let cycle = 0; cycle < 50; cycle++) {
        const promises = Array.from({ length: 20 }, () => 
          actionDiscoveryService.discoverActions()
        )
        await Promise.all(promises)
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }
      }

      // Check that internal state is cleaned up
      expect(actionDiscoveryService.getPendingRequestCount()).toBe(0)
      expect(requestDeduplicator.getActiveRequestCount()).toBe(0)
    })

    it('should clean up failed requests properly', async () => {
      const error = new Error('Test error')
      mockFlowClient.discoverAllActions.mockRejectedValue(error)

      // Start multiple requests that will fail
      const promises = Array.from({ length: 100 }, () => 
        actionDiscoveryService.discoverActions().catch(() => null)
      )

      await Promise.all(promises)

      // Internal state should be cleaned up
      expect(actionDiscoveryService.getPendingRequestCount()).toBe(0)
    })
  })

  describe('Request Deduplication Performance', () => {
    it('should efficiently deduplicate identical requests', async () => {
      const mockActions = [{ id: 'action1', name: 'Test Action', category: 'test' }]
      
      // Add delay to make deduplication more visible
      mockFlowClient.discoverAllActions.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(createMockDiscoveryResult(mockActions)), 50))
      )

      const startTime = performance.now()
      
      // Start many identical requests
      const promises = Array.from({ length: 200 }, () => 
        requestDeduplicator.deduplicate('test-key', () => mockFlowClient.discoverAllActions())
      )

      const results = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete faster than if all requests were made individually
      expect(duration).toBeLessThan(200) // Much less than 200 * 50ms

      // All results should be identical
      results.forEach(result => {
        expect(result.actions).toEqual(mockActions)
      })

      // Should only make one actual API call
      expect(mockFlowClient.discoverAllActions).toHaveBeenCalledTimes(1)
    })

    it('should handle different request keys efficiently', async () => {
      const mockActions1 = [{ id: 'action1', name: 'Action 1', category: 'test' }]
      const mockActions2 = [{ id: 'action2', name: 'Action 2', category: 'test' }]

      mockFlowClient.discoverAllActions
        .mockResolvedValueOnce(createMockDiscoveryResult(mockActions1))
        .mockResolvedValueOnce(createMockDiscoveryResult(mockActions2))

      const startTime = performance.now()
      
      // Start requests with different keys
      const promises1 = Array.from({ length: 50 }, () => 
        requestDeduplicator.deduplicate('key1', () => mockFlowClient.discoverAllActions())
      )
      
      const promises2 = Array.from({ length: 50 }, () => 
        requestDeduplicator.deduplicate('key2', () => mockFlowClient.discoverAllActions())
      )

      const [results1, results2] = await Promise.all([
        Promise.all(promises1),
        Promise.all(promises2)
      ])
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete efficiently
      expect(duration).toBeLessThan(1000)

      // Results should be different for different keys
      results1.forEach(result => expect(result.actions).toEqual(mockActions1))
      results2.forEach(result => expect(result.actions).toEqual(mockActions2))

      // Should make two API calls (one per unique key)
      expect(mockFlowClient.discoverAllActions).toHaveBeenCalledTimes(2)
    })
  })

  describe('Circuit Breaker Performance Impact', () => {
    it('should add minimal overhead when circuit is closed', async () => {
      const operation = () => Promise.resolve('success')
      
      // Measure direct operation time
      const directStart = performance.now()
      await operation()
      const directEnd = performance.now()
      const directTime = directEnd - directStart

      // Measure circuit breaker operation time
      const circuitStart = performance.now()
      await circuitBreaker.execute(operation)
      const circuitEnd = performance.now()
      const circuitTime = circuitEnd - circuitStart

      // Circuit breaker should add minimal overhead (< 1ms)
      expect(circuitTime - directTime).toBeLessThan(1)
    })

    it('should fail fast when circuit is open', async () => {
      const failingOperation = () => Promise.reject(new Error('Service Error'))
      
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow()
      }

      // Measure fail-fast performance
      const startTime = performance.now()
      
      const promises = Array.from({ length: 100 }, () => 
        circuitBreaker.execute(failingOperation).catch(() => null)
      )
      
      await Promise.all(promises)
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should fail very quickly (< 10ms for 100 requests)
      expect(duration).toBeLessThan(10)
    })
  })

  describe('End-to-End Performance', () => {
    it('should handle realistic workflow builder usage patterns', async () => {
      const mockActions = Array.from({ length: 50 }, (_, i) => ({
        id: `action${i}`,
        name: `Action ${i}`,
        category: i % 5 === 0 ? 'token' : 'nft',
        description: `Description for action ${i}`
      }))

      mockFlowClient.discoverAllActions.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(createMockDiscoveryResult(mockActions)), 100))
      )

      // Simulate realistic usage: multiple components requesting actions
      const componentRequests = [
        // Workflow builder component
        actionDiscoveryService.discoverActions(),
        // Action library component  
        actionDiscoveryService.discoverActions(),
        // Code preview component
        actionDiscoveryService.discoverActions(),
        // Another code preview
        actionDiscoveryService.discoverActions()
      ]

      const startTime = performance.now()
      const results = await Promise.all(componentRequests)
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete close to single request time due to deduplication
      expect(duration).toBeLessThan(200) // Close to 100ms + overhead

      // All components should get the same data
      results.forEach(result => {
        expect(result.actions).toEqual(mockActions)
      })

      // Should only make one API call
      expect(mockFlowClient.discoverAllActions).toHaveBeenCalledTimes(1)

      console.log(`Realistic usage pattern completed in ${duration.toFixed(2)}ms`)
    })
  })
})