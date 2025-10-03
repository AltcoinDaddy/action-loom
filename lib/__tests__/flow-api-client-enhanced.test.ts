/**
 * Enhanced FlowAPIClient Tests
 * Tests for improved error handling, circuit breaker integration, and retry logic
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { FlowAPIClient, createFlowAPIClient, APIErrorContext } from '../flow-api-client'
import { FlowAPIConfig } from '../types'
import { FLOW_NETWORKS, FlowErrorCode } from '../flow-config'
import { FlowNetworkError, FlowScriptError } from '../flow-errors'
import { CircuitBreakerError } from '../circuit-breaker'

// Mock fetch globally
global.fetch = vi.fn()

describe('FlowAPIClient Enhanced Error Handling', () => {
  let client: FlowAPIClient
  let mockFetch: Mock

  beforeEach(() => {
    mockFetch = vi.mocked(fetch)
    mockFetch.mockClear()
    
    const config: FlowAPIConfig = {
      network: FLOW_NETWORKS.testnet,
      apiKey: 'test-api-key',
      timeout: 5000,
      retryAttempts: 2
    }
    
    client = new FlowAPIClient(config)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('Circuit Breaker Integration', () => {
    it('should use circuit breaker for API calls', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ result: 'success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }))

      const result = await client.executeScript('pub fun main() { return "test" }')
      
      expect(result).toEqual({ result: 'success' })
      expect(mockFetch).toHaveBeenCalledTimes(1)
      
      // Circuit breaker should be in CLOSED state
      const metrics = client.getCircuitBreakerMetrics()
      expect(metrics.state).toBe('CLOSED')
      expect(metrics.totalRequests).toBe(1)
    })

    it('should reset circuit breaker manually', () => {
      // Force circuit breaker to OPEN state
      const circuitBreaker = (client as any).circuitBreaker
      circuitBreaker.forceState('OPEN')
      
      expect(client.getCircuitBreakerMetrics().state).toBe('OPEN')
      
      client.resetCircuitBreaker()
      
      expect(client.getCircuitBreakerMetrics().state).toBe('CLOSED')
    })

    it('should provide circuit breaker metrics', () => {
      const metrics = client.getCircuitBreakerMetrics()
      expect(metrics).toHaveProperty('state')
      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics).toHaveProperty('totalFailures')
      expect(metrics.state).toBe('CLOSED')
    })
  })

  describe('Enhanced 400 Error Handling', () => {
    it('should parse and handle 400 Bad Request with JSON error details', async () => {
      const errorResponse = {
        code: 'invalid_script',
        message: 'Syntax error in Cadence script',
        details: { line: 5, column: 10 }
      }

      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(errorResponse), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'content-type': 'application/json' }
      }))

      await expect(client.executeScript('invalid script')).rejects.toThrow(/Invalid Cadence script/)
    })

    it('should handle 400 errors with specific Flow API error codes', async () => {
      const testCases = [
        { code: 'invalid_arguments', expectedMessage: /Invalid script arguments/ },
        { code: 'execution_failed', expectedMessage: /Script execution failed/ },
        { code: 'account_not_found', expectedMessage: /Account not found/ }
      ]

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
          code: testCase.code,
          message: 'Test error message'
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        }))

        await expect(client.executeScript('test script')).rejects.toThrow(testCase.expectedMessage)
      }
    })
  })

  describe('HTTP Status Code Handling', () => {
    it('should handle 401 authentication errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Authentication failed'
      }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      }))

      await expect(client.executeScript('test script')).rejects.toThrow(/Authentication failed/)
    })

    it('should handle 404 not found errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Resource not found'
      }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      }))

      await expect(client.executeScript('test script')).rejects.toThrow(/Resource not found/)
    })

    it('should handle 500 server errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        message: 'Internal server error'
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }))

      await expect(client.executeScript('test script')).rejects.toThrow(/Server error/)
    })
  })

  describe('Retry Logic', () => {
    it('should not retry on 4xx client errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))
      
      await expect(client.executeScript('test script')).rejects.toThrow()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should provide retry configuration', () => {
      const stats = client.getRequestStats()
      expect(stats).toHaveProperty('totalRequests')
      expect(stats).toHaveProperty('network')
      expect(stats.network).toBe('Flow Testnet')
    })
  })

  describe('Request Context and Logging', () => {
    it('should generate unique request IDs', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ result: 'success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }))

      await client.executeScript('test1')
      await client.executeScript('test2')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      
      // Check that different request IDs were used
      const call1Headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
      const call2Headers = mockFetch.mock.calls[1][1]?.headers as Record<string, string>
      
      expect(call1Headers['X-Request-ID']).toBeDefined()
      expect(call2Headers['X-Request-ID']).toBeDefined()
      expect(call1Headers['X-Request-ID']).not.toBe(call2Headers['X-Request-ID'])
    })

    it('should provide request statistics', async () => {
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ result: 'success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }))

      await client.executeScript('test1')

      const stats = client.getRequestStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.lastRequestTime).toBeGreaterThan(0)
      expect(stats.circuitBreakerMetrics).toBeDefined()
      expect(stats.network).toBe('Flow Testnet')
    })
  })

  describe('Error Response Parsing', () => {
    it('should handle malformed JSON error responses', async () => {
      mockFetch.mockResolvedValueOnce(new Response('invalid json{', {
        status: 400,
        headers: { 'content-type': 'application/json' }
      }))

      await expect(client.executeScript('test script')).rejects.toThrow()
    })

    it('should handle empty error responses', async () => {
      mockFetch.mockResolvedValueOnce(new Response('', {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }))

      await expect(client.executeScript('test script')).rejects.toThrow()
    })
  })
})

describe('FlowAPIClient Factory Functions', () => {
  it('should create client with default configuration', () => {
    const client = createFlowAPIClient()
    const stats = client.getRequestStats()
    
    expect(stats.network).toBe('Flow Testnet')
  })

  it('should create client with custom network', () => {
    const client = createFlowAPIClient('mainnet')
    const stats = client.getRequestStats()
    
    expect(stats.network).toBe('Flow Mainnet')
  })

  it('should create client with API key', () => {
    const client = createFlowAPIClient('testnet', 'test-api-key')
    expect(client).toBeInstanceOf(FlowAPIClient)
  })
})