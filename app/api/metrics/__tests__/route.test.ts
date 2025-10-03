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

describe('/api/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/metrics', () => {
    it('should return detailed metrics in JSON format', async () => {
      const mockMetrics = {
        totalRequests: 150,
        successfulRequests: 140,
        failedRequests: 10,
        errorRate: 6.67,
        averageResponseTime: 250.5,
        lastUpdated: Date.now()
      }

      const mockPerformanceData = [
        {
          operation: 'GET /api/test1',
          duration: 100,
          success: true,
          startTime: Date.now() - 1000
        },
        {
          operation: 'POST /api/test2',
          duration: 200,
          success: false,
          errorCode: '500',
          startTime: Date.now() - 2000
        },
        {
          operation: 'GET /api/test1',
          duration: 150,
          success: true,
          startTime: Date.now() - 3000
        }
      ]

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue(mockPerformanceData)

      const request = new Request('http://localhost:3000/api/metrics')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        correlationId: 'test-correlation-id',
        summary: {
          totalRequests: 150,
          successfulRequests: 140,
          failedRequests: 10,
          successRate: '93.33',
          errorRate: '6.67',
          averageResponseTime: '250.50'
        },
        operationBreakdown: expect.arrayContaining([
          expect.objectContaining({
            operation: 'GET /api/test1',
            count: 2,
            successCount: 2,
            failureCount: 0,
            successRate: '100.00%',
            averageDuration: '125.00ms'
          }),
          expect.objectContaining({
            operation: 'POST /api/test2',
            count: 1,
            successCount: 0,
            failureCount: 1,
            successRate: '0.00%',
            averageDuration: '200.00ms'
          })
        ]),
        recentActivity: expect.arrayContaining([
          expect.objectContaining({
            operation: 'GET /api/test1',
            duration: '100.00ms',
            success: true
          }),
          expect.objectContaining({
            operation: 'POST /api/test2',
            duration: '200.00ms',
            success: false,
            errorCode: '500'
          })
        ])
      })
    })

    it('should respect limit parameter', async () => {
      const mockMetrics = {
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        errorRate: 5.0,
        averageResponseTime: 150.0,
        lastUpdated: Date.now()
      }

      const mockPerformanceData = Array.from({ length: 200 }, (_, i) => ({
        operation: `GET /api/test${i}`,
        duration: 100 + i,
        success: true,
        startTime: Date.now() - (i * 1000)
      }))

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue(mockPerformanceData)

      const request = new Request('http://localhost:3000/api/metrics?limit=50')
      const response = await GET(request)

      expect(vi.mocked(logger.getPerformanceData)).toHaveBeenCalledWith(50)
    })

    it('should return Prometheus format when requested', async () => {
      const mockMetrics = {
        totalRequests: 100,
        successfulRequests: 90,
        failedRequests: 10,
        errorRate: 10.0,
        averageResponseTime: 200.5,
        lastUpdated: Date.now()
      }

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue([])

      const request = new Request('http://localhost:3000/api/metrics?format=prometheus')
      const response = await GET(request)
      const text = await response.text()

      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
      expect(text).toContain('# HELP actionloom_requests_total Total number of requests')
      expect(text).toContain('# TYPE actionloom_requests_total counter')
      expect(text).toContain('actionloom_requests_total 100')
      expect(text).toContain('actionloom_requests_success_total 90')
      expect(text).toContain('actionloom_requests_failed_total 10')
      expect(text).toContain('actionloom_response_time_avg 200.5')
      expect(text).toContain('actionloom_error_rate 10')
    })

    it('should handle empty performance data', async () => {
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

      const request = new Request('http://localhost:3000/api/metrics')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary.successRate).toBe('0')
      expect(data.operationBreakdown).toEqual([])
      expect(data.recentActivity).toEqual([])
    })

    it('should calculate operation statistics correctly', async () => {
      const mockMetrics = {
        totalRequests: 6,
        successfulRequests: 4,
        failedRequests: 2,
        errorRate: 33.33,
        averageResponseTime: 150.0,
        lastUpdated: Date.now()
      }

      const mockPerformanceData = [
        { operation: 'GET /api/test', duration: 100, success: true, startTime: Date.now() },
        { operation: 'GET /api/test', duration: 200, success: true, startTime: Date.now() },
        { operation: 'GET /api/test', duration: 50, success: false, startTime: Date.now() },
        { operation: 'POST /api/other', duration: 300, success: true, startTime: Date.now() },
        { operation: 'POST /api/other', duration: 400, success: false, startTime: Date.now() }
      ]

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue(mockPerformanceData)

      const request = new Request('http://localhost:3000/api/metrics')
      const response = await GET(request)
      const data = await response.json()

      const getTestStats = data.operationBreakdown.find(op => op.operation === 'GET /api/test')
      const postOtherStats = data.operationBreakdown.find(op => op.operation === 'POST /api/other')

      expect(getTestStats).toMatchObject({
        operation: 'GET /api/test',
        count: 3,
        successCount: 2,
        failureCount: 1,
        successRate: '66.67%',
        averageDuration: '116.67ms',
        minDuration: '50.00ms',
        maxDuration: '200.00ms'
      })

      expect(postOtherStats).toMatchObject({
        operation: 'POST /api/other',
        count: 2,
        successCount: 1,
        failureCount: 1,
        successRate: '50.00%',
        averageDuration: '350.00ms',
        minDuration: '300.00ms',
        maxDuration: '400.00ms'
      })
    })

    it('should limit recent activity to 20 items', async () => {
      const mockMetrics = {
        totalRequests: 50,
        successfulRequests: 45,
        failedRequests: 5,
        errorRate: 10.0,
        averageResponseTime: 150.0,
        lastUpdated: Date.now()
      }

      const mockPerformanceData = Array.from({ length: 30 }, (_, i) => ({
        operation: `GET /api/test${i}`,
        duration: 100 + i,
        success: i % 5 !== 0, // Every 5th request fails
        startTime: Date.now() - (i * 1000)
      }))

      vi.mocked(logger.getMetrics).mockReturnValue(mockMetrics)
      vi.mocked(logger.getPerformanceData).mockReturnValue(mockPerformanceData)

      const request = new Request('http://localhost:3000/api/metrics')
      const response = await GET(request)
      const data = await response.json()

      expect(data.recentActivity).toHaveLength(20)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(logger.getMetrics).mockImplementation(() => {
        throw new Error('Metrics service unavailable')
      })

      const request = new Request('http://localhost:3000/api/metrics')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        error: 'Failed to retrieve metrics',
        correlationId: 'test-correlation-id'
      })

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to retrieve metrics',
        expect.any(Error),
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'metrics-endpoint',
          operation: 'get-metrics'
        })
      )
    })

    it('should log metrics request and response', async () => {
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

      const request = new Request('http://localhost:3000/api/metrics?limit=50')
      await GET(request)

      expect(logger.info).toHaveBeenCalledWith(
        'Metrics requested',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'metrics-endpoint',
          operation: 'get-metrics',
          metadata: { limit: 50, format: 'json' }
        })
      )

      expect(logger.info).toHaveBeenCalledWith(
        'Metrics delivered',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'metrics-endpoint',
          operation: 'get-metrics',
          metadata: expect.objectContaining({
            totalRequests: 10
          })
        })
      )
    })

    it('should handle invalid limit parameter', async () => {
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

      const request = new Request('http://localhost:3000/api/metrics?limit=invalid')
      const response = await GET(request)

      expect(response.status).toBe(200)
      // Should default to 100 when limit is invalid
      expect(vi.mocked(logger.getPerformanceData)).toHaveBeenCalledWith(100)
    })
  })
})