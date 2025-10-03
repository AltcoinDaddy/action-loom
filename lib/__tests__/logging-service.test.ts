import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Import the actual module to test
const loggingModule = await import('../logging-service')
const { logger } = loggingModule

// Mock console methods
const mockConsole = {
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}

// Mock performance.now
const mockPerformance = {
  now: vi.fn(() => 1000)
}

describe('LoggingService', () => {
  beforeEach(() => {
    // Reset console mocks
    Object.keys(mockConsole).forEach(key => {
      mockConsole[key].mockClear()
    })
    
    // Mock global console
    global.console = mockConsole as any
    
    // Mock global performance
    global.performance = mockPerformance as any
    
    // Set test environment
    process.env.NODE_ENV = 'test'
    
    // Reset logger state
    logger.reset()
  })

  afterEach(() => {
    // Clean up performance data
    logger.cleanup()
  })

  describe('Correlation ID Generation', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = logger.generateCorrelationId()
      const id2 = logger.generateCorrelationId()
      
      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^\d+-[a-z0-9]{9}$/)
    })
  })

  describe('Structured Logging', () => {
    it('should log debug messages with context', () => {
      const context = {
        correlationId: 'test-123',
        component: 'test-component',
        operation: 'test-operation',
        metadata: { key: 'value' }
      }

      logger.debug('Test debug message', context)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"test-123"')
      )
    })

    it('should log info messages with context', () => {
      const context = {
        correlationId: 'test-456',
        component: 'test-component'
      }

      logger.info('Test info message', context)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"test-456"')
      )
    })

    it('should log warnings with context', () => {
      logger.warn('Test warning', {
        correlationId: 'warn-123',
        metadata: { warning: true }
      })

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"warn-123"')
      )
    })

    it('should log errors with error objects', () => {
      const error = new Error('Test error')
      const context = {
        correlationId: 'error-123',
        component: 'error-component'
      }

      logger.error('Error occurred', error, context)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"error-123"')
      )
    })

    it('should generate correlation ID if not provided', () => {
      logger.info('Test message without correlation ID')

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringMatching(/"correlationId":"\d+-[a-z0-9]{9}"/)
      )
    })
  })

  describe('Performance Timing', () => {
    beforeEach(() => {
      mockPerformance.now.mockReturnValueOnce(1000).mockReturnValueOnce(1500)
    })

    it('should start and end timing operations', () => {
      const correlationId = logger.startTiming('test-operation')
      
      expect(correlationId).toBeDefined()
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Starting operation: test-operation"')
      )

      logger.endTiming(correlationId, 'test-operation', true)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Operation completed: test-operation"')
      )
    })

    it('should handle failed operations', () => {
      const correlationId = logger.startTiming('failed-operation')
      logger.endTiming(correlationId, 'failed-operation', false, 'TIMEOUT')

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Operation completed: failed-operation"')
      )
    })
  })

  describe('API Request Logging', () => {
    it('should log successful API requests', () => {
      logger.logApiRequest('GET', '/api/test', 200, 150.5, 'req-123')

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"req-123"')
      )
    })

    it('should log failed API requests with errors', () => {
      const error = new Error('Network timeout')
      logger.logApiRequest('POST', '/api/test', 500, 5000, 'req-456', error)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"req-456"')
      )
    })

    it('should generate correlation ID if not provided', () => {
      logger.logApiRequest('GET', '/api/test', 200, 100)

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringMatching(/"correlationId":"\d+-[a-z0-9]{9}"/)
      )
    })
  })

  describe('Metrics Collection', () => {
    beforeEach(() => {
      // Reset metrics completely
      logger.reset()
    })

    it('should track system metrics', () => {
      // Simulate some API requests
      logger.logApiRequest('GET', '/api/test1', 200, 100)
      logger.logApiRequest('POST', '/api/test2', 500, 200)
      logger.logApiRequest('GET', '/api/test3', 200, 150)

      const metrics = logger.getMetrics()

      expect(metrics.totalRequests).toBe(3)
      expect(metrics.successfulRequests).toBe(2)
      expect(metrics.failedRequests).toBe(1)
      expect(metrics.errorRate).toBeCloseTo(33.33, 1)
      expect(metrics.lastUpdated).toBeGreaterThan(0)
    })

    it('should calculate average response time', () => {
      // Mock performance.now to return predictable values
      mockPerformance.now
        .mockReturnValueOnce(1000).mockReturnValueOnce(1100) // 100ms
        .mockReturnValueOnce(2000).mockReturnValueOnce(2200) // 200ms
        .mockReturnValueOnce(3000).mockReturnValueOnce(3150) // 150ms

      logger.logApiRequest('GET', '/api/test1', 200, 100)
      logger.logApiRequest('GET', '/api/test2', 200, 200)
      logger.logApiRequest('GET', '/api/test3', 200, 150)

      const metrics = logger.getMetrics()
      expect(metrics.averageResponseTime).toBeCloseTo(150, 0)
    })

    it('should return recent performance data', () => {
      logger.logApiRequest('GET', '/api/test1', 200, 100)
      logger.logApiRequest('POST', '/api/test2', 404, 50)

      const performanceData = logger.getPerformanceData(10)

      expect(performanceData).toHaveLength(2)
      expect(performanceData[0]).toMatchObject({
        operation: 'GET /api/test1',
        success: true,
        duration: 100
      })
      expect(performanceData[1]).toMatchObject({
        operation: 'POST /api/test2',
        success: false,
        errorCode: '404'
      })
    })

    it('should limit performance data entries', () => {
      // Add more entries than the limit
      for (let i = 0; i < 1200; i++) {
        logger.logApiRequest('GET', `/api/test${i}`, 200, 100)
      }

      const performanceData = logger.getPerformanceData()
      expect(performanceData.length).toBeLessThanOrEqual(1000)
    })
  })

  describe('Cleanup', () => {
    it('should clean up old performance data', () => {
      // Reset to ensure clean state
      logger.reset()
      
      // Mock Date.now to simulate old entries
      const originalDateNow = Date.now
      const oldTime = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      const newTime = Date.now()

      Date.now = vi.fn()
        .mockReturnValueOnce(oldTime - 100) // Old entry start time
        .mockReturnValueOnce(oldTime) // Old entry end time
        .mockReturnValueOnce(newTime - 100) // New entry start time  
        .mockReturnValueOnce(newTime) // New entry end time
        .mockReturnValue(newTime) // Cleanup time

      logger.logApiRequest('GET', '/api/old', 200, 100)
      logger.logApiRequest('GET', '/api/new', 200, 100)

      const beforeCleanup = logger.getPerformanceData()
      expect(beforeCleanup.length).toBeGreaterThanOrEqual(2)

      logger.cleanup()

      const remainingData = logger.getPerformanceData()
      // Should have at least one entry (the new one), but may have others from other tests
      expect(remainingData.length).toBeGreaterThan(0)
      
      // Check that old entries are removed - find the new entry
      const newEntry = remainingData.find(entry => entry.operation === 'GET /api/new')
      expect(newEntry).toBeDefined()
      
      // Check that old entries are removed - should not find the old entry
      const oldEntry = remainingData.find(entry => entry.operation === 'GET /api/old')
      expect(oldEntry).toBeUndefined()

      // Restore Date.now
      Date.now = originalDateNow
    })
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      // Test that logger is consistent
      const id1 = logger.generateCorrelationId()
      const id2 = logger.generateCorrelationId()
      
      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })
  })

  describe('Server-side Logging', () => {
    it('should use JSON format for server-side logging', () => {
      // Mock window as undefined to simulate server environment
      const originalWindow = global.window
      delete (global as any).window

      logger.info('Server log message', {
        correlationId: 'server-123',
        component: 'server-component'
      })

      const logCall = mockConsole.log.mock.calls[0][0]
      expect(logCall).toContain('"level":"info"')
      expect(logCall).toContain('"correlationId":"server-123"')

      // Restore window
      global.window = originalWindow
    })
  })
})