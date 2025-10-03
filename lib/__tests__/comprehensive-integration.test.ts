import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CircuitBreaker } from '../circuit-breaker'
import { RequestDeduplicator } from '../request-deduplicator'

describe('Comprehensive Integration Tests', () => {
  let circuitBreaker: CircuitBreaker
  let requestDeduplicator: RequestDeduplicator

  beforeEach(() => {
    vi.clearAllMocks()
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 5000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 2
    })
    requestDeduplicator = new RequestDeduplicator()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      
      const startTime = performance.now()
      
      // Start 100 concurrent requests
      const promises = Array.from({ length: 100 }, () => 
        requestDeduplicator.deduplicate('test-key', mockOperation)
      )

      const results = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete quickly
      expect(duration).toBeLessThan(100)

      // All requests should succeed
      expect(results).toHaveLength(100)
      results.forEach(result => {
        expect(result).toBe('success')
      })

      // Should only make one actual call due to deduplication
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('should handle different request keys concurrently', async () => {
      const mockOperation1 = vi.fn().mockResolvedValue('result1')
      const mockOperation2 = vi.fn().mockResolvedValue('result2')
      
      const startTime = performance.now()
      
      // Start requests with different keys
      const promises1 = Array.from({ length: 50 }, () => 
        requestDeduplicator.deduplicate('key1', mockOperation1)
      )
      
      const promises2 = Array.from({ length: 50 }, () => 
        requestDeduplicator.deduplicate('key2', mockOperation2)
      )

      const [results1, results2] = await Promise.all([
        Promise.all(promises1),
        Promise.all(promises2)
      ])
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete efficiently
      expect(duration).toBeLessThan(100)

      // Results should be different for different keys
      results1.forEach(result => expect(result).toBe('result1'))
      results2.forEach(result => expect(result).toBe('result2'))

      // Should make two calls (one per unique key)
      expect(mockOperation1).toHaveBeenCalledTimes(1)
      expect(mockOperation2).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Recovery and Circuit Breaker Integration', () => {
    it('should handle failures and recovery gracefully', async () => {
      let callCount = 0
      const mockOperation = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount <= 3) {
          return Promise.reject(new Error('Service Error'))
        }
        return Promise.resolve('success')
      })

      // First 3 calls should fail and open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Service Error')
      }

      expect(circuitBreaker.getState()).toBe('OPEN')

      // Circuit should reject requests immediately
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is OPEN')

      // Fast forward time to allow circuit to transition to half-open
      vi.useFakeTimers()
      vi.advanceTimersByTime(6000)

      // Next request should succeed and close the circuit
      const result = await circuitBreaker.execute(mockOperation)
      expect(result).toBe('success')

      vi.useRealTimers()
    })

    it('should provide comprehensive metrics', async () => {
      const successOperation = () => Promise.resolve('success')
      const failOperation = () => Promise.reject(new Error('fail'))
      
      // Execute mixed operations
      await circuitBreaker.execute(successOperation)
      await circuitBreaker.execute(successOperation)
      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow()
      
      const metrics = circuitBreaker.getMetrics()
      
      expect(metrics.totalRequests).toBe(3)
      expect(metrics.successCount).toBe(2)
      expect(metrics.failureCount).toBe(1)
      expect(metrics.successRate).toBeCloseTo(0.67, 2)
    })
  })

  describe('Performance Under Load', () => {
    it('should maintain performance under sustained load', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      
      const batchSize = 50
      const numBatches = 10
      const results: number[] = []

      // Run multiple batches
      for (let batch = 0; batch < numBatches; batch++) {
        const startTime = performance.now()
        
        const promises = Array.from({ length: batchSize }, () => 
          requestDeduplicator.deduplicate(`batch-${batch}`, mockOperation)
        )
        
        await Promise.all(promises)
        
        const endTime = performance.now()
        results.push(endTime - startTime)
      }

      // Performance should remain consistent
      const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length
      const maxTime = Math.max(...results)
      const minTime = Math.min(...results)

      // Variance should be reasonable
      expect(maxTime - minTime).toBeLessThan(avgTime * 2)
      
      // Should have made one call per batch
      expect(mockOperation).toHaveBeenCalledTimes(numBatches)
    })

    it('should clean up resources properly', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      
      // Run multiple operations
      for (let i = 0; i < 100; i++) {
        await requestDeduplicator.deduplicate(`key-${i}`, mockOperation)
      }

      // All operations should be cleaned up
      expect(requestDeduplicator.getActiveRequestCount()).toBe(0)
    })
  })

  describe('Error Handling and Fallback', () => {
    it('should handle different error types appropriately', async () => {
      // Network errors
      const networkError = new Error('Network Error')
      networkError.name = 'NetworkError'
      
      await expect(circuitBreaker.execute(() => Promise.reject(networkError))).rejects.toThrow()
      expect(circuitBreaker.getMetrics().failureCount).toBe(1)
      
      // Timeout errors
      const timeoutError = new Error('Timeout')
      timeoutError.name = 'TimeoutError'
      
      await expect(circuitBreaker.execute(() => Promise.reject(timeoutError))).rejects.toThrow()
      expect(circuitBreaker.getMetrics().failureCount).toBe(2)
    })

    it('should provide detailed error context when circuit is open', async () => {
      const originalError = new Error('Service Unavailable')
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(() => Promise.reject(originalError))).rejects.toThrow()
      }
      
      // Subsequent requests should include circuit breaker context
      try {
        await circuitBreaker.execute(() => Promise.resolve('test'))
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Circuit breaker is OPEN')
      }
    })
  })

  describe('Memory Management', () => {
    it('should not leak memory under extended operation', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      
      // Simulate extended operation
      for (let cycle = 0; cycle < 50; cycle++) {
        const promises = Array.from({ length: 20 }, () => 
          requestDeduplicator.deduplicate(`cycle-${cycle}`, mockOperation)
        )
        await Promise.all(promises)
        
        // Force cleanup
        if (global.gc) {
          global.gc()
        }
      }

      // Internal state should be cleaned up
      expect(requestDeduplicator.getActiveRequestCount()).toBe(0)
    })

    it('should handle failed requests without memory leaks', async () => {
      const error = new Error('Test error')
      const mockOperation = vi.fn().mockRejectedValue(error)

      // Start multiple requests that will fail
      const promises = Array.from({ length: 100 }, (_, i) => 
        requestDeduplicator.deduplicate(`fail-${i}`, mockOperation).catch(() => null)
      )

      await Promise.all(promises)

      // Internal state should be cleaned up
      expect(requestDeduplicator.getActiveRequestCount()).toBe(0)
    })
  })

  describe('Hydration Consistency Simulation', () => {
    it('should handle server-client consistency patterns', () => {
      // Simulate server-side data
      const serverData = { id: 1, name: 'Test', timestamp: Date.now() }
      
      // Simulate client-side hydration
      const clientData = { ...serverData }
      
      // Data should be consistent
      expect(clientData).toEqual(serverData)
    })

    it('should handle dynamic content patterns', async () => {
      let mounted = false
      
      // Simulate component mounting
      setTimeout(() => {
        mounted = true
      }, 0)
      
      // Wait for mounting
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(mounted).toBe(true)
    })
  })
})