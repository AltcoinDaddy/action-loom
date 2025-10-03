/**
 * Comprehensive logging service with structured context and correlation IDs
 */

export interface LogContext {
  correlationId?: string
  userId?: string
  sessionId?: string
  component?: string
  operation?: string
  metadata?: Record<string, any>
}

export interface PerformanceMetrics {
  startTime: number
  endTime?: number
  duration?: number
  operation: string
  success: boolean
  errorCode?: string
}

export interface SystemMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  errorRate: number
  lastUpdated: number
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

class LoggingService {
  private static instance: LoggingService
  private metrics: SystemMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    errorRate: 0,
    lastUpdated: Date.now()
  }
  private performanceData: PerformanceMetrics[] = []
  private maxPerformanceEntries = 1000

  private constructor() {}

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService()
    }
    return LoggingService.instance
  }

  /**
   * Generate a unique correlation ID for request tracking
   */
  generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Log with structured context
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level,
      message,
      correlationId: context?.correlationId || this.generateCorrelationId(),
      component: context?.component || 'unknown',
      operation: context?.operation,
      userId: context?.userId,
      sessionId: context?.sessionId,
      metadata: context?.metadata
    }

    // Check if we're in a test environment
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
    
    // In production, this would go to a proper logging service
    if (typeof window !== 'undefined' && !isTest) {
      // Client-side logging
      console[level === 'debug' ? 'log' : level](
        `[${timestamp}] ${level.toUpperCase()} [${logEntry.correlationId}] ${message}`,
        context?.metadata ? context.metadata : ''
      )
    } else {
      // Server-side logging - structured JSON
      console.log(JSON.stringify(logEntry))
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      metadata: {
        ...context?.metadata,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : undefined
      }
    }
    this.log('error', message, errorContext)
  }

  /**
   * Start performance timing for an operation
   */
  startTiming(operation: string, correlationId?: string): string {
    const id = correlationId || this.generateCorrelationId()
    const startTime = performance.now()
    
    // Store start time for later calculation
    this.startTimes.set(id, startTime)
    
    this.debug(`Starting operation: ${operation}`, {
      correlationId: id,
      operation,
      metadata: { startTime }
    })

    return id
  }

  /**
   * End performance timing and log results
   */
  endTiming(correlationId: string, operation: string, success: boolean, errorCode?: string): void {
    const endTime = performance.now()
    const startTime = this.findStartTime(correlationId)
    const duration = startTime ? endTime - startTime : 0

    // Clean up start time
    this.startTimes.delete(correlationId)

    const metrics: PerformanceMetrics = {
      startTime: startTime || endTime,
      endTime,
      duration,
      operation,
      success,
      errorCode
    }

    // Store performance data
    this.performanceData.push(metrics)
    if (this.performanceData.length > this.maxPerformanceEntries) {
      this.performanceData.shift()
    }

    // Update system metrics
    this.updateMetrics(metrics)

    this.info(`Operation completed: ${operation}`, {
      correlationId,
      operation,
      metadata: {
        duration: `${duration.toFixed(2)}ms`,
        success,
        errorCode
      }
    })
  }

  private startTimes: Map<string, number> = new Map()

  private findStartTime(correlationId: string): number | null {
    return this.startTimes.get(correlationId) || null
  }

  private updateMetrics(metrics: PerformanceMetrics): void {
    this.metrics.totalRequests++
    
    if (metrics.success) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
    }

    // Calculate rolling average response time
    const recentMetrics = this.performanceData.slice(-100)
    if (recentMetrics.length > 0) {
      const totalDuration = recentMetrics.reduce((sum, m) => sum + (m.duration || 0), 0)
      this.metrics.averageResponseTime = totalDuration / recentMetrics.length
    }

    // Calculate error rate
    this.metrics.errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100
    this.metrics.lastUpdated = Date.now()
  }

  /**
   * Get current system metrics
   */
  getMetrics(): SystemMetrics {
    return { ...this.metrics }
  }

  /**
   * Get recent performance data
   */
  getPerformanceData(limit: number = 100): PerformanceMetrics[] {
    return this.performanceData.slice(-limit)
  }

  /**
   * Log API request with timing and context
   */
  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    correlationId?: string,
    error?: Error
  ): void {
    const success = statusCode >= 200 && statusCode < 400
    const context: LogContext = {
      correlationId: correlationId || this.generateCorrelationId(),
      component: 'api-client',
      operation: `${method} ${url}`,
      metadata: {
        method,
        url,
        statusCode,
        duration: `${duration.toFixed(2)}ms`,
        success
      }
    }

    if (success) {
      this.info(`API request successful`, context)
    } else {
      this.error(`API request failed`, error, context)
    }

    // Create and store performance metrics
    const now = Date.now()
    const performanceMetrics: PerformanceMetrics = {
      startTime: now - duration, // Use Date.now() based timestamp for easier cleanup
      endTime: now,
      duration,
      operation: `${method} ${url}`,
      success,
      errorCode: success ? undefined : statusCode.toString()
    }

    // Store performance data
    this.performanceData.push(performanceMetrics)
    if (this.performanceData.length > this.maxPerformanceEntries) {
      this.performanceData.shift()
    }

    // Update metrics
    this.updateMetrics(performanceMetrics)
  }

  /**
   * Clear old performance data to prevent memory leaks
   */
  cleanup(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours
    
    // Filter performance data based on startTime (now using Date.now() timestamps)
    this.performanceData = this.performanceData.filter(
      entry => entry.startTime > cutoff
    )
    
    // Clear old start times
    this.startTimes.clear()
  }

  /**
   * Reset all metrics and performance data (useful for testing)
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastUpdated: Date.now()
    }
    this.performanceData = []
    this.startTimes.clear()
  }
}

export const logger = LoggingService.getInstance()