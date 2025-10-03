import { NextResponse } from 'next/server'
import { logger } from '@/lib/logging-service'

export async function GET(request: Request) {
  const correlationId = logger.generateCorrelationId()
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit') || '100'
  const limit = isNaN(parseInt(limitParam)) ? 100 : parseInt(limitParam)
  const format = searchParams.get('format') || 'json'

  try {
    logger.info('Metrics requested', {
      correlationId,
      component: 'metrics-endpoint',
      operation: 'get-metrics',
      metadata: { limit, format }
    })

    const metrics = logger.getMetrics()
    const performanceData = logger.getPerformanceData(limit)

    // Calculate additional metrics
    const operationStats = performanceData.reduce((acc, entry) => {
      const op = entry.operation
      if (!acc[op]) {
        acc[op] = {
          count: 0,
          successCount: 0,
          failureCount: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: Infinity,
          maxDuration: 0
        }
      }

      acc[op].count++
      if (entry.success) {
        acc[op].successCount++
      } else {
        acc[op].failureCount++
      }

      if (entry.duration) {
        acc[op].totalDuration += entry.duration
        acc[op].minDuration = Math.min(acc[op].minDuration, entry.duration)
        acc[op].maxDuration = Math.max(acc[op].maxDuration, entry.duration)
        acc[op].averageDuration = acc[op].totalDuration / acc[op].count
      }

      return acc
    }, {} as Record<string, any>)

    const detailedMetrics = {
      timestamp: new Date().toISOString(),
      correlationId,
      summary: {
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        successRate: metrics.totalRequests > 0 
          ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
          : '0',
        errorRate: metrics.errorRate.toFixed(2),
        averageResponseTime: metrics.averageResponseTime.toFixed(2),
        lastUpdated: new Date(metrics.lastUpdated).toISOString()
      },
      operationBreakdown: Object.entries(operationStats).map(([operation, stats]) => ({
        operation,
        ...stats,
        successRate: ((stats.successCount / stats.count) * 100).toFixed(2) + '%',
        averageDuration: stats.averageDuration.toFixed(2) + 'ms',
        minDuration: stats.minDuration === Infinity ? '0ms' : stats.minDuration.toFixed(2) + 'ms',
        maxDuration: stats.maxDuration.toFixed(2) + 'ms'
      })),
      recentActivity: performanceData.slice(-20).map(entry => ({
        timestamp: new Date(entry.startTime).toISOString(),
        operation: entry.operation,
        duration: entry.duration?.toFixed(2) + 'ms',
        success: entry.success,
        errorCode: entry.errorCode
      }))
    }

    // Support Prometheus format for monitoring tools
    if (format === 'prometheus') {
      const prometheusMetrics = [
        `# HELP actionloom_requests_total Total number of requests`,
        `# TYPE actionloom_requests_total counter`,
        `actionloom_requests_total ${metrics.totalRequests}`,
        ``,
        `# HELP actionloom_requests_success_total Total number of successful requests`,
        `# TYPE actionloom_requests_success_total counter`,
        `actionloom_requests_success_total ${metrics.successfulRequests}`,
        ``,
        `# HELP actionloom_requests_failed_total Total number of failed requests`,
        `# TYPE actionloom_requests_failed_total counter`,
        `actionloom_requests_failed_total ${metrics.failedRequests}`,
        ``,
        `# HELP actionloom_response_time_avg Average response time in milliseconds`,
        `# TYPE actionloom_response_time_avg gauge`,
        `actionloom_response_time_avg ${metrics.averageResponseTime}`,
        ``,
        `# HELP actionloom_error_rate Error rate percentage`,
        `# TYPE actionloom_error_rate gauge`,
        `actionloom_error_rate ${metrics.errorRate}`,
        ``
      ].join('\n')

      return new Response(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      })
    }

    logger.info('Metrics delivered', {
      correlationId,
      component: 'metrics-endpoint',
      operation: 'get-metrics',
      metadata: {
        totalRequests: metrics.totalRequests,
        operationCount: Object.keys(operationStats).length
      }
    })

    return NextResponse.json(detailedMetrics)

  } catch (error) {
    logger.error('Failed to retrieve metrics', error as Error, {
      correlationId,
      component: 'metrics-endpoint',
      operation: 'get-metrics'
    })

    return NextResponse.json({
      error: 'Failed to retrieve metrics',
      correlationId,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}