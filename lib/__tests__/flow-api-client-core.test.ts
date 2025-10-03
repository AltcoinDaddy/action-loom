/**
 * Core FlowAPIClient Tests
 * Tests for the enhanced error handling and circuit breaker functionality
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FlowAPIClient, createFlowAPIClient } from '../flow-api-client'
import { FlowAPIConfig } from '../types'
import { FLOW_NETWORKS } from '../flow-config'

describe('FlowAPIClient Core Functionality', () => {
  let client: FlowAPIClient
  
  beforeEach(() => {
    const config: FlowAPIConfig = {
      network: FLOW_NETWORKS.testnet,
      apiKey: 'test-api-key',
      timeout: 5000,
      retryAttempts: 2
    }
    
    client = new FlowAPIClient(config)
  })

  describe('Circuit Breaker Integration', () => {
    it('should initialize with circuit breaker in CLOSED state', () => {
      const metrics = client.getCircuitBreakerMetrics()
      expect(metrics.state).toBe('CLOSED')
      expect(metrics.totalRequests).toBe(0)
      expect(metrics.totalFailures).toBe(0)
    })

    it('should provide circuit breaker metrics', () => {
      const metrics = client.getCircuitBreakerMetrics()
      expect(metrics).toHaveProperty('state')
      expect(metrics).toHaveProperty('failureCount')
      expect(metrics).toHaveProperty('successCount')
      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics).toHaveProperty('totalFailures')
    })

    it('should reset circuit breaker to CLOSED state', () => {
      // Force circuit breaker to OPEN state
      const circuitBreaker = (client as any).circuitBreaker
      circuitBreaker.forceState('OPEN')
      
      expect(client.getCircuitBreakerMetrics().state).toBe('OPEN')
      
      client.resetCircuitBreaker()
      
      expect(client.getCircuitBreakerMetrics().state).toBe('CLOSED')
    })
  })

  describe('Request Statistics', () => {
    it('should provide request statistics', () => {
      const stats = client.getRequestStats()
      expect(stats).toHaveProperty('totalRequests')
      expect(stats).toHaveProperty('lastRequestTime')
      expect(stats).toHaveProperty('circuitBreakerMetrics')
      expect(stats).toHaveProperty('network')
      expect(stats.network).toBe('Flow Testnet')
      expect(stats.totalRequests).toBe(0)
    })
  })

  describe('Error Handling Configuration', () => {
    it('should have proper retry configuration', () => {
      const config = (client as any).config
      expect(config.retryAttempts).toBe(2)
      expect(config.timeout).toBe(5000)
    })

    it('should have exponential backoff configured', () => {
      const backoff = (client as any).backoff
      expect(backoff).toBeDefined()
      
      // Test backoff calculation
      const delay1 = backoff.calculateDelay(0)
      const delay2 = backoff.calculateDelay(1)
      const delay3 = backoff.calculateDelay(2)
      
      expect(delay1).toBeGreaterThan(0)
      expect(delay2).toBeGreaterThan(delay1)
      expect(delay3).toBeGreaterThan(delay2)
    })
  })

  describe('Request ID Generation', () => {
    it('should generate unique request IDs', () => {
      const id1 = (client as any).generateRequestId()
      const id2 = (client as any).generateRequestId()
      const id3 = (client as any).generateRequestId()
      
      expect(id1).not.toBe(id2)
      expect(id1).not.toBe(id3)
      expect(id2).not.toBe(id3)
      
      expect(id1).toMatch(/^req_\d+_\d+$/)
      expect(id2).toMatch(/^req_\d+_\d+$/)
      expect(id3).toMatch(/^req_\d+_\d+$/)
    })
  })

  describe('Retry Logic Configuration', () => {
    it('should not retry 400 errors', () => {
      const shouldRetry1 = (client as any).shouldRetryRequest(new Error('Bad Request'), 0)
      const shouldRetry2 = (client as any).shouldRetryRequest(new Error('Invalid Cadence script'), 0)
      const shouldRetry3 = (client as any).shouldRetryRequest(new Error('Authentication failed'), 0)
      
      expect(shouldRetry1).toBe(false)
      expect(shouldRetry2).toBe(false)
      expect(shouldRetry3).toBe(false)
    })

    it('should retry network errors', () => {
      const shouldRetry1 = (client as any).shouldRetryRequest(new Error('Network error'), 0)
      const shouldRetry2 = (client as any).shouldRetryRequest(new Error('fetch failed'), 0)
      const shouldRetry3 = (client as any).shouldRetryRequest(new Error('timeout'), 0)
      
      expect(shouldRetry1).toBe(true)
      expect(shouldRetry2).toBe(true)
      expect(shouldRetry3).toBe(true)
    })

    it('should not retry when max attempts reached', () => {
      const shouldRetry = (client as any).shouldRetryRequest(new Error('Network error'), 2)
      expect(shouldRetry).toBe(false)
    })
  })

  describe('Network Configuration', () => {
    it('should switch networks correctly', () => {
      expect(client.getCurrentNetwork().name).toBe('Flow Testnet')
      
      client.switchNetwork('mainnet')
      expect(client.getCurrentNetwork().name).toBe('Flow Mainnet')
      
      client.switchNetwork('testnet')
      expect(client.getCurrentNetwork().name).toBe('Flow Testnet')
    })

    it('should throw error for unknown network', () => {
      expect(() => {
        client.switchNetwork('unknown' as any)
      }).toThrow('Unknown network: unknown')
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
    
    const config = (client as any).config
    expect(config.apiKey).toBe('test-api-key')
  })
})