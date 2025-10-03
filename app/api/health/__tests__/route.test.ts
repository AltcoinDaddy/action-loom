import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET } from '../route'
import { logger } from '@/lib/logging-service'

// Mock the logging service
vi.mock('@/lib/logging-service', () => ({
  logger: {
    generateCorrelationId: vi.fn(() => 'test-correlation-id'),
    info: vi.fn(),
    error: vi.fn(),
    getMetrics: vi.fn(),
    getPerformanceData: vi.fn()
  }
}))

// Mock process methods
const mockProcess = {
  uptime: vi.fn(() => 3600), // 1 hour
  memoryUsage: vi.fn(() => ({
    rss: 50 * 1024 * 1024, // 50MB
    heapTotal: 30 * 1024 * 1024, // 30MB
    heapUsed: 20 * 1024 * 1024, // 20MB
    external: 5 * 1024 * 1024, // 5MB
    arrayBuffers: 1 * 1024 * 1024 // 1MB
  })),
  version: 'v18.17.0'
}

describe('/api/health', () => {
  beforeEach(() => {
    // Mock global process
    global.process = mockProcess as any
    
    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/health', () => {
    it('should return healthy status with good metrics', async () => {
      // Mock good metrics
      const mockMetrics = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        errorRate: 5.0,
        averageResponseTime: 150.5,
        lastUpdated: Date.now()
      }

      const mockPerformanceData = [
        {
          operation: 'GET /api/test',
          duration: 100,
          success: true,
          startTime: Date.now() - 1000
        },
        {
          operation: 'POST /api/test',
          duration: 200,
          success: true,
          startTime: Date.now() - 2000
        }
      ]

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue(mockPerformanceData)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        status: 'healthy',
        correlationId: 'test-correlation-id',
        system: {
          uptime: 3600,
          memory: expect.objectContaining({
            rss: 50 * 1024 * 1024,
            heapTotal: 30 * 1024 * 1024,
            heapUsed: 20 * 1024 * 1024
          }),
          version: 'v18.17.0'
        },
        metrics: {
          totalRequests: 100,
          successRate: '95.00%',
          errorRate: '5.00%',
          averageResponseTime: '150.50ms'
        },
        recentPerformance: expect.arrayContaining([
          expect.objectContaining({
            operation: 'GET /api/test',
            duration: '100.00ms',
            success: true
          })
        ])
      })

      expect(logger.info).toHaveBeenCalledWith(
        'Health check requested',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'health-check',
          operation: 'system-status'
        })
      )

      expect(logger.info).toHaveBeenCalledWith(
        'Health check completed',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          metadata: expect.objectContaining({
            status: 'healthy',
            errorRate: 5.0,
            averageResponseTime: 150.5
          })
        })
      )
    })

    it('should return degraded status with high error rate', async () => {
      const mockMetrics = {
        totalRequests: 100,
        successfulRequests: 75,
        failedRequests: 25,
        errorRate: 25.0, // High error rate
        averageResponseTime: 200.0,
        lastUpdated: Date.now()
      }

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.metrics.errorRate).toBe('25.00%')
    })

    it('should return degraded status with high response time', async () => {
      const mockMetrics = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        errorRate: 5.0,
        averageResponseTime: 6000.0, // High response time
        lastUpdated: Date.now()
      }

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('degraded')
      expect(data.metrics.averageResponseTime).toBe('6000.00ms')
    })

    it('should return unhealthy status with very high error rate', async () => {
      const mockMetrics = {
        totalRequests: 100,
        successfulRequests: 40,
        failedRequests: 60,
        errorRate: 60.0, // Very high error rate
        averageResponseTime: 300.0,
        lastUpdated: Date.now()
      }

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.metrics.errorRate).toBe('60.00%')
    })

    it('should handle zero requests gracefully', async () => {
      const mockMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        lastUpdated: Date.now()
      }

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.metrics.successRate).toBe('0%')
      expect(data.metrics.errorRate).toBe('0.00%')
    })

    it('should handle errors gracefully', async () => {
      // Mock logger to throw an error
      vi.mocked(logger.getMetrics).mockImplementation(() => {
        throw new Error('Metrics service unavailable')
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        status: 'error',
        correlationId: 'test-correlation-id',
        error: 'Health check failed'
      })

      expect(logger.error).toHaveBeenCalledWith(
        'Health check failed',
        expect.any(Error),
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'health-check',
          operation: 'system-status'
        })
      )
    })

    it('should include timestamp in response', async () => {
      const mockMetrics = {
        totalRequests: 10,
        successfulRequests: 10,
        failedRequests: 0,
        errorRate: 0,
        averageResponseTime: 100,
        lastUpdated: Date.now()
      }

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue([])

      const beforeRequest = new Date().toISOString()
      const response = await GET()
      const afterRequest = new Date().toISOString()
      const data = await response.json()

      expect(data.timestamp).toBeDefined()
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(data.timestamp >= beforeRequest).toBe(true)
      expect(data.timestamp <= afterRequest).toBe(true)
    })

    it('should format performance data correctly', async () => {
      const mockMetrics = {
        totalRequests: 2,
        successfulRequests: 1,
        failedRequests: 1,
        errorRate: 50.0,
        averageResponseTime: 150.0,
        lastUpdated: Date.now()
      }

      const mockPerformanceData = [
        {
          operation: 'GET /api/success',
          duration: 100.5,
          success: true,
          startTime: Date.now() - 1000
        },
        {
          operation: 'POST /api/failure',
          duration: 200.75,
          success: false,
          errorCode: '500',
          startTime: Date.now() - 2000
        }
      ]

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue(mockPerformanceData)

      const response = await GET()
      const data = await response.json()

      expect(data.recentPerformance).toHaveLength(2)
      expect(data.recentPerformance[0]).toMatchObject({
        operation: 'GET /api/success',
        duration: '100.50ms',
        success: true,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      })
      expect(data.recentPerformance[1]).toMatchObject({
        operation: 'POST /api/failure',
        duration: '200.75ms',
        success: false,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      })
    })
  })
})