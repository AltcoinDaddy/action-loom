import { NextResponse } from 'next/server'
import { logger } from '@/lib/logging-service'

export async function GET() {
  const correlationId = logger.generateCorrelationId()
  
  try {
    logger.info('Health check requested', {
      correlationId,
      component: 'health-check',
      operation: 'system-status'
    })

    const metrics = logger.getMetrics()
    const performanceData = logger.getPerformanceData(10)
    
    // Basic health checks
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      correlationId,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      },
      metrics: {
        totalRequests: metrics.totalRequests,
        successRate: metrics.totalRequests > 0 
          ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2) + '%'
          : '0%',
        errorRate: metrics.errorRate.toFixed(2) + '%',
        averageResponseTime: metrics.averageResponseTime.toFixed(2) + 'ms',
        lastUpdated: new Date(metrics.lastUpdated).toISOString()
      },
      recentPerformance: performanceData.map(p => ({
        operation: p.operation,
        duration: p.duration?.toFixed(2) + 'ms',
        success: p.success,
        timestamp: new Date(p.startTime).toISOString()
      }))
    }

    // Determine overall health status
    if (metrics.errorRate > 50) {
      healthStatus.status = 'unhealthy'
    } else if (metrics.errorRate > 20 || metrics.averageResponseTime > 5000) {
      healthStatus.status = 'degraded'
    }

    logger.info('Health check completed', {
      correlationId,
      component: 'health-check',
      operation: 'system-status',
      metadata: {
        status: healthStatus.status,
        errorRate: metrics.errorRate,
        averageResponseTime: metrics.averageResponseTime
      }
    })

    return NextResponse.json(healthStatus, {
      status: healthStatus.status === 'healthy' ? 200 : 503
    })

  } catch (error) {
    logger.error('Health check failed', error as Error, {
      correlationId,
      component: 'health-check',
      operation: 'system-status'
    })

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      correlationId,
      error: 'Health check failed'
    }, { status: 500 })
  }
}