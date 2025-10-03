import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestDeduplicator } from '../request-deduplicator';

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator;

  beforeEach(() => {
    vi.useFakeTimers();
    deduplicator = new RequestDeduplicator();
  });

  afterEach(() => {
    vi.useRealTimers();
    deduplicator.clearAll();
  });

  describe('basic deduplication', () => {
    it('should deduplicate identical requests', async () => {
      const mockFactory = vi.fn().mockResolvedValue('result');
      const key = 'test-key';

      // Start two identical requests
      const promise1 = deduplicator.deduplicate(key, mockFactory);
      const promise2 = deduplicator.deduplicate(key, mockFactory);

      // Both should return the same promise
      expect(promise1).toBe(promise2);

      // Factory should only be called once
      expect(mockFactory).toHaveBeenCalledTimes(1);

      // Both should resolve to the same result
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('result');
      expect(result2).toBe('result');
    });

    it('should handle different keys separately', async () => {
      const mockFactory1 = vi.fn().mockResolvedValue('result1');
      const mockFactory2 = vi.fn().mockResolvedValue('result2');

      const promise1 = deduplicator.deduplicate('key1', mockFactory1);
      const promise2 = deduplicator.deduplicate('key2', mockFactory2);

      // Both factories should be called
      expect(mockFactory1).toHaveBeenCalledTimes(1);
      expect(mockFactory2).toHaveBeenCalledTimes(1);

      // Results should be different
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });

    it('should allow new requests after completion', async () => {
      const mockFactory = vi.fn()
        .mockResolvedValueOnce('result1')
        .mockResolvedValueOnce('result2');
      
      const key = 'test-key';

      // First request
      const result1 = await deduplicator.deduplicate(key, mockFactory);
      expect(result1).toBe('result1');
      expect(mockFactory).toHaveBeenCalledTimes(1);

      // Second request after first completes
      const result2 = await deduplicator.deduplicate(key, mockFactory);
      expect(result2).toBe('result2');
      expect(mockFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle rejected promises correctly', async () => {
      const error = new Error('Test error');
      const mockFactory = vi.fn().mockRejectedValue(error);
      const key = 'test-key';

      // Start two identical requests
      const promise1 = deduplicator.deduplicate(key, mockFactory);
      const promise2 = deduplicator.deduplicate(key, mockFactory);

      // Both should reject with the same error
      await expect(promise1).rejects.toThrow('Test error');
      await expect(promise2).rejects.toThrow('Test error');

      // Factory should only be called once
      expect(mockFactory).toHaveBeenCalledTimes(1);
    });

    it('should allow new requests after error', async () => {
      const mockFactory = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('success');
      
      const key = 'test-key';

      // First request fails
      await expect(deduplicator.deduplicate(key, mockFactory)).rejects.toThrow('First error');
      expect(mockFactory).toHaveBeenCalledTimes(1);

      // Second request should succeed
      const result = await deduplicator.deduplicate(key, mockFactory);
      expect(result).toBe('success');
      expect(mockFactory).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout handling', () => {
    it('should clean up stale requests', async () => {
      const deduplicatorWithTimeout = new RequestDeduplicator({ timeout: 1000 });
      const mockFactory = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      const key = 'test-key';

      // Start a request
      deduplicatorWithTimeout.deduplicate(key, mockFactory);
      expect(deduplicatorWithTimeout.getActiveRequestCount()).toBe(1);

      // Fast-forward time beyond timeout
      vi.advanceTimersByTime(1001);

      // Request should be cleaned up
      expect(deduplicatorWithTimeout.getActiveRequestCount()).toBe(0);
      
      deduplicatorWithTimeout.clearAll();
    });

    it('should replace stale requests with new ones', async () => {
      const deduplicatorWithTimeout = new RequestDeduplicator({ timeout: 1000 });
      const mockFactory1 = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      const mockFactory2 = vi.fn().mockResolvedValue('result2');
      const key = 'test-key';

      // Start first request
      deduplicatorWithTimeout.deduplicate(key, mockFactory1);
      expect(mockFactory1).toHaveBeenCalledTimes(1);

      // Fast-forward time to make request stale
      vi.advanceTimersByTime(1001);

      // Start second request with same key
      const result = await deduplicatorWithTimeout.deduplicate(key, mockFactory2);
      expect(result).toBe('result2');
      expect(mockFactory2).toHaveBeenCalledTimes(1);
      
      deduplicatorWithTimeout.clearAll();
    });
  });

  describe('request key generation', () => {
    it('should generate consistent keys for same parameters', () => {
      const key1 = deduplicator.generateRequestKey('method', 'param1', 'param2');
      const key2 = deduplicator.generateRequestKey('method', 'param1', 'param2');
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different parameters', () => {
      const key1 = deduplicator.generateRequestKey('method', 'param1');
      const key2 = deduplicator.generateRequestKey('method', 'param2');
      expect(key1).not.toBe(key2);
    });

    it('should handle object parameters consistently', () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      
      const key1 = deduplicator.generateRequestKey('method', obj1);
      const key2 = deduplicator.generateRequestKey('method', obj2);
      
      // Should be the same because object keys are sorted
      expect(key1).toBe(key2);
    });

    it('should handle mixed parameter types', () => {
      const key = deduplicator.generateRequestKey('method', 'string', 123, { key: 'value' }, true);
      expect(typeof key).toBe('string');
      expect(key).toContain('method:');
    });

    it('should handle null and undefined parameters', () => {
      const key1 = deduplicator.generateRequestKey('method', null);
      const key2 = deduplicator.generateRequestKey('method', undefined);
      
      expect(key1).toContain('null');
      expect(key2).toContain('undefined');
      expect(key1).not.toBe(key2);
    });
  });

  describe('cache management', () => {
    it('should enforce max cache size', async () => {
      const smallDeduplicator = new RequestDeduplicator({ maxCacheSize: 2 });
      const neverResolve = () => new Promise(() => {}); // Never resolves

      // Add 3 requests (exceeds max cache size of 2)
      smallDeduplicator.deduplicate('key1', neverResolve);
      smallDeduplicator.deduplicate('key2', neverResolve);
      smallDeduplicator.deduplicate('key3', neverResolve);

      // Should only have 2 active requests (oldest should be removed)
      expect(smallDeduplicator.getActiveRequestCount()).toBe(2);
      
      smallDeduplicator.clearAll();
    });

    it('should provide active request count', async () => {
      const neverResolve = () => new Promise(() => {});

      expect(deduplicator.getActiveRequestCount()).toBe(0);

      deduplicator.deduplicate('key1', neverResolve);
      expect(deduplicator.getActiveRequestCount()).toBe(1);

      deduplicator.deduplicate('key2', neverResolve);
      expect(deduplicator.getActiveRequestCount()).toBe(2);
    });

    it('should provide active request keys', async () => {
      const neverResolve = () => new Promise(() => {});

      deduplicator.deduplicate('key1', neverResolve);
      deduplicator.deduplicate('key2', neverResolve);

      const keys = deduplicator.getActiveRequestKeys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('should clear specific requests', async () => {
      const neverResolve = () => new Promise(() => {});

      deduplicator.deduplicate('key1', neverResolve);
      deduplicator.deduplicate('key2', neverResolve);
      expect(deduplicator.getActiveRequestCount()).toBe(2);

      deduplicator.clear('key1');
      expect(deduplicator.getActiveRequestCount()).toBe(1);
      expect(deduplicator.getActiveRequestKeys()).toEqual(['key2']);
    });

    it('should clear all requests', async () => {
      const neverResolve = () => new Promise(() => {});

      deduplicator.deduplicate('key1', neverResolve);
      deduplicator.deduplicate('key2', neverResolve);
      expect(deduplicator.getActiveRequestCount()).toBe(2);

      deduplicator.clearAll();
      expect(deduplicator.getActiveRequestCount()).toBe(0);
    });
  });

  describe('concurrent request scenarios', () => {
    it('should handle multiple concurrent requests with same key', async () => {
      const mockFactory = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('result'), 100))
      );
      const key = 'concurrent-key';

      // Start 5 concurrent requests
      const promises = Array.from({ length: 5 }, () => 
        deduplicator.deduplicate(key, mockFactory)
      );

      // All should be the same promise
      expect(promises.every(p => p === promises[0])).toBe(true);

      // Factory should only be called once
      expect(mockFactory).toHaveBeenCalledTimes(1);

      // Fast-forward time to resolve the promise
      vi.advanceTimersByTime(100);

      // All should resolve to the same result
      const results = await Promise.all(promises);
      expect(results.every(r => r === 'result')).toBe(true);
    });

    it('should handle rapid sequential requests', async () => {
      const mockFactory = vi.fn().mockResolvedValue('result');
      const key = 'sequential-key';

      // Start first request
      const promise1 = deduplicator.deduplicate(key, mockFactory);
      
      // Immediately start second request (should be deduplicated)
      const promise2 = deduplicator.deduplicate(key, mockFactory);
      
      expect(promise1).toBe(promise2);
      expect(mockFactory).toHaveBeenCalledTimes(1);

      await Promise.all([promise1, promise2]);
    });
  });
});