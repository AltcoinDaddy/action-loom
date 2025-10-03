/**
 * Circuit Breaker Pattern Implementation for API Resilience
 * 
 * Implements the circuit breaker pattern to prevent cascading failures
 * and provide graceful degradation when external services are failing.
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  totalRequests: number;
  totalFailures: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitBreakerState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  private halfOpenCalls = 0;

  constructor(private config: CircuitBreakerConfig) {
    this.validateConfig(config);
  }

  private validateConfig(config: CircuitBreakerConfig): void {
    if (config.failureThreshold <= 0) {
      throw new Error('Failure threshold must be greater than 0');
    }
    if (config.resetTimeout <= 0) {
      throw new Error('Reset timeout must be greater than 0');
    }
    if (config.monitoringPeriod <= 0) {
      throw new Error('Monitoring period must be greater than 0');
    }
    if (config.halfOpenMaxCalls <= 0) {
      throw new Error('Half-open max calls must be greater than 0');
    }
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.shouldAllowRequest()) {
      throw new CircuitBreakerError(
        `Circuit breaker is ${this.state}. Request rejected.`,
        this.state
      );
    }

    this.totalRequests++;

    if (this.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Determine if a request should be allowed based on current state
   */
  private shouldAllowRequest(): boolean {
    const now = Date.now();

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (now >= this.nextAttemptTime) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return this.halfOpenCalls < this.config.halfOpenMaxCalls;

      default:
        return false;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;

    if (this.state === 'HALF_OPEN') {
      // If we've had enough successful calls in half-open state, close the circuit
      if (this.successCount >= this.config.halfOpenMaxCalls) {
        this.transitionToClosed();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.resetFailureCount();
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open state should open the circuit
      this.transitionToOpen();
    } else if (this.state === 'CLOSED') {
      // Check if we've exceeded the failure threshold
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = 'CLOSED';
    this.resetCounters();
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    this.halfOpenCalls = 0;
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.halfOpenCalls = 0;
    this.successCount = 0;
    this.failureCount = 0;
  }

  /**
   * Reset failure count (used when monitoring period expires)
   */
  private resetFailureCount(): void {
    const now = Date.now();
    if (now - this.lastFailureTime > this.config.monitoringPeriod) {
      this.failureCount = 0;
    }
  }

  /**
   * Reset all counters
   */
  private resetCounters(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics & {
    successRate: number;
    averageResponseTime: number;
  } {
    const successRate = this.totalRequests > 0 
      ? (this.totalRequests - this.totalFailures) / this.totalRequests 
      : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      successRate,
      averageResponseTime: 0 // Placeholder - would need timing tracking for real implementation
    };
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.halfOpenCalls = 0;
  }

  /**
   * Force the circuit breaker to a specific state (for testing)
   */
  forceState(state: CircuitBreakerState): void {
    this.state = state;
    if (state === 'OPEN') {
      this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }


}

/**
 * Exponential backoff utility for retry attempts
 */
export class ExponentialBackoff {
  constructor(
    private baseDelay: number = 1000,
    private maxDelay: number = 30000,
    private backoffFactor: number = 2,
    private jitter: boolean = true
  ) {}

  /**
   * Calculate delay for a given attempt number
   */
  calculateDelay(attempt: number): number {
    const exponentialDelay = this.baseDelay * Math.pow(this.backoffFactor, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    
    if (this.jitter) {
      // Add random jitter to prevent thundering herd
      const jitterAmount = cappedDelay * 0.1;
      return cappedDelay + (Math.random() * jitterAmount * 2 - jitterAmount);
    }
    
    return cappedDelay;
  }

  /**
   * Sleep for the calculated delay
   */
  async delay(attempt: number): Promise<void> {
    const delayMs = this.calculateDelay(attempt);
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

/**
 * Retry wrapper with exponential backoff and circuit breaker
 */
export class RetryWithCircuitBreaker {
  constructor(
    private circuitBreaker: CircuitBreaker,
    private backoff: ExponentialBackoff,
    private maxRetries: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.circuitBreaker.execute(operation);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry if circuit breaker is open
        if (error instanceof CircuitBreakerError && error.state === 'OPEN') {
          throw error;
        }
        
        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Wait before retrying
        await this.backoff.delay(attempt);
      }
    }
    
    throw lastError!;
  }
}