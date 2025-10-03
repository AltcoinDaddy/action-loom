import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  CircuitBreaker, 
  CircuitBreakerError, 
  ExponentialBackoff, 
  RetryWithCircuitBreaker,
  type CircuitBreakerConfig 
} from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let config: CircuitBreakerConfig;

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      resetTimeout: 5000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 2,
    };
    circuitBreaker = new CircuitBreaker(config);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Configuration Validation', () => {
    it('should throw error for invalid failure threshold', () => {
      expect(() => new CircuitBreaker({ ...config, failureThreshold: 0 }))
        .toThrow('Failure threshold must be greater than 0');
    });

    it('should throw error for invalid reset timeout', () => {
      expect(() => new CircuitBreaker({ ...config, resetTimeout: -1 }))
        .toThrow('Reset timeout must be greater than 0');
    });

    it('should throw error for invalid monitoring period', () => {
      expect(() => new CircuitBreaker({ ...config, monitoringPeriod: 0 }))
        .toThrow('Monitoring period must be greater than 0');
    });

    it('should throw error for invalid half-open max calls', () => {
      expect(() => new CircuitBreaker({ ...config, halfOpenMaxCalls: 0 }))
        .toThrow('Half-open max calls must be greater than 0');
    });
  });

  describe('CLOSED State', () => {
    it('should start in CLOSED state', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('CLOSED');
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
    });

    it('should allow requests in CLOSED state', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should track successful operations', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successCount).toBe(2);
      expect(metrics.totalRequests).toBe(2);
    });

    it('should track failed operations', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('failure'));
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to fail
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should transition to OPEN after reaching failure threshold', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('OPEN');
      expect(metrics.failureCount).toBe(3);
    });

    it('should reset failure count after monitoring period', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValue('success');
      
      // First failure
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to fail
      }
      
      // Advance time beyond monitoring period
      vi.advanceTimersByTime(config.monitoringPeriod + 1000);
      
      // Success should reset failure count
      await circuitBreaker.execute(mockOperation);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(0);
    });
  });

  describe('OPEN State', () => {
    beforeEach(async () => {
      // Force circuit to OPEN state
      const mockOperation = vi.fn().mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }
    });

    it('should reject requests immediately in OPEN state', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      await expect(circuitBreaker.execute(mockOperation))
        .rejects.toThrow(CircuitBreakerError);
      
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      // Advance time to reset timeout
      vi.advanceTimersByTime(config.resetTimeout);
      
      await circuitBreaker.execute(mockOperation);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('HALF_OPEN');
    });

    it('should not allow requests before reset timeout', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      // Advance time but not enough
      vi.advanceTimersByTime(config.resetTimeout - 1000);
      
      await expect(circuitBreaker.execute(mockOperation))
        .rejects.toThrow(CircuitBreakerError);
    });
  });

  describe('HALF_OPEN State', () => {
    beforeEach(async () => {
      // Force circuit to OPEN state first
      const mockFailOperation = vi.fn().mockRejectedValue(new Error('failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFailOperation);
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Advance time to transition to HALF_OPEN
      vi.advanceTimersByTime(config.resetTimeout);
    });

    it('should allow limited requests in HALF_OPEN state', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      // Should allow up to halfOpenMaxCalls
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);
      
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should reject requests after reaching half-open limit', async () => {
      // Create a circuit breaker with halfOpenMaxCalls = 1 to make testing easier
      const testConfig = { ...config, halfOpenMaxCalls: 1 };
      const testCircuitBreaker = new CircuitBreaker(testConfig);
      
      // Force to HALF_OPEN state and manually set halfOpenCalls to the limit
      testCircuitBreaker.forceState('HALF_OPEN');
      
      // Use reflection to set halfOpenCalls to the limit
      (testCircuitBreaker as any).halfOpenCalls = 1;
      
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      // This call should be rejected because halfOpenCalls (1) >= halfOpenMaxCalls (1)
      await expect(testCircuitBreaker.execute(mockOperation))
        .rejects.toThrow(CircuitBreakerError);
      
      expect(mockOperation).not.toHaveBeenCalled();
    });

    it('should transition to CLOSED after successful calls', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      // Make successful calls up to the limit
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('CLOSED');
    });

    it('should transition to OPEN on any failure', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('failure'));
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to fail
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('OPEN');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should provide accurate metrics', async () => {
      const successOp = vi.fn().mockResolvedValue('success');
      const failOp = vi.fn().mockRejectedValue(new Error('failure'));
      
      await circuitBreaker.execute(successOp);
      
      try {
        await circuitBreaker.execute(failOp);
      } catch (error) {
        // Expected to fail
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(1);
    });

    it('should track timing information', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('failure'));
      
      const beforeTime = Date.now();
      
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to fail
      }
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.lastFailureTime).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe('Reset and Force State', () => {
    it('should reset to initial state', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Generate some activity
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to fail
      }
      
      circuitBreaker.reset();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('CLOSED');
      expect(metrics.failureCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.totalFailures).toBe(0);
    });

    it('should allow forcing state for testing', () => {
      circuitBreaker.forceState('OPEN');
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe('OPEN');
      expect(metrics.nextAttemptTime).toBeGreaterThan(Date.now());
    });
  });
});

describe('ExponentialBackoff', () => {
  let backoff: ExponentialBackoff;

  beforeEach(() => {
    backoff = new ExponentialBackoff(1000, 30000, 2, false); // No jitter for predictable tests
  });

  it('should calculate exponential delays', () => {
    expect(backoff.calculateDelay(0)).toBe(1000);
    expect(backoff.calculateDelay(1)).toBe(2000);
    expect(backoff.calculateDelay(2)).toBe(4000);
    expect(backoff.calculateDelay(3)).toBe(8000);
  });

  it('should cap delays at maximum', () => {
    expect(backoff.calculateDelay(10)).toBe(30000);
  });

  it('should add jitter when enabled', () => {
    const jitteredBackoff = new ExponentialBackoff(1000, 30000, 2, true);
    
    const delay1 = jitteredBackoff.calculateDelay(1);
    const delay2 = jitteredBackoff.calculateDelay(1);
    
    // With jitter, delays should be different
    expect(delay1).not.toBe(delay2);
    
    // But both should be around 2000ms (±10%)
    expect(delay1).toBeGreaterThan(1800);
    expect(delay1).toBeLessThan(2200);
  });

  it('should provide async delay method', async () => {
    vi.useFakeTimers();
    
    const delayPromise = backoff.delay(1);
    
    // Advance time
    vi.advanceTimersByTime(2000);
    
    await expect(delayPromise).resolves.toBeUndefined();
    
    vi.useRealTimers();
  });
});

describe('RetryWithCircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let backoff: ExponentialBackoff;
  let retryWrapper: RetryWithCircuitBreaker;

  beforeEach(() => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 3,
      resetTimeout: 5000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 2,
    };
    circuitBreaker = new CircuitBreaker(config);
    backoff = new ExponentialBackoff(100, 1000, 2, false);
    retryWrapper = new RetryWithCircuitBreaker(circuitBreaker, backoff, 2);
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const mockOperation = vi.fn().mockResolvedValue('success');
    
    const result = await retryWrapper.execute(mockOperation);
    
    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockOperation = vi.fn()
      .mockRejectedValueOnce(new Error('failure'))
      .mockResolvedValue('success');
    
    const executePromise = retryWrapper.execute(mockOperation);
    
    // Advance time for retry delay
    await vi.advanceTimersByTimeAsync(100);
    
    const result = await executePromise;
    
    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(2);
  }, 10000);

  it('should not retry when circuit breaker is open', async () => {
    // Force circuit breaker to open state
    circuitBreaker.forceState('OPEN');
    
    const mockOperation = vi.fn().mockResolvedValue('success');
    
    await expect(retryWrapper.execute(mockOperation))
      .rejects.toThrow(CircuitBreakerError);
    
    expect(mockOperation).not.toHaveBeenCalled();
  });

  it('should exhaust retries and throw last error', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('persistent failure'));
    
    const executePromise = retryWrapper.execute(mockOperation);
    
    // Advance time for all retry delays (100ms + 200ms + 400ms = 700ms total)
    await vi.advanceTimersByTimeAsync(800);
    
    await expect(executePromise).rejects.toThrow('persistent failure');
    expect(mockOperation).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});