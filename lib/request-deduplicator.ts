/**
 * RequestDeduplicator - Prevents duplicate API calls by caching active requests
 * 
 * This utility ensures that multiple simultaneous requests for the same data
 * are deduplicated, with all callers receiving the result from a single
 * underlying request.
 */

export interface DeduplicationOptions {
  /** Timeout in milliseconds after which a request is considered stale */
  timeout?: number;
  /** Maximum number of cached requests to keep */
  maxCacheSize?: number;
}

interface CachedRequest<T> {
  promise: Promise<T>;
  timestamp: number;
  cleanup: () => void;
}

export class RequestDeduplicator {
  private activeRequests = new Map<string, CachedRequest<any>>();
  private readonly timeout: number;
  private readonly maxCacheSize: number;

  constructor(options: DeduplicationOptions = {}) {
    this.timeout = options.timeout ?? 30000; // 30 seconds default
    this.maxCacheSize = options.maxCacheSize ?? 100;
  }

  /**
   * Deduplicate requests based on a key. If a request with the same key
   * is already in progress, return the existing promise. Otherwise,
   * execute the factory function and cache the result.
   */
  deduplicate<T>(key: string, factory: () => Promise<T>): Promise<T> {
    // Check if we already have an active request for this key
    const existing = this.activeRequests.get(key);
    if (existing && !this.isRequestStale(existing)) {
      return existing.promise;
    }

    // Clean up stale request if it exists
    if (existing) {
      existing.cleanup();
      this.activeRequests.delete(key);
    }

    // Ensure we don't exceed max cache size
    this.enforceMaxCacheSize();

    // Create new request
    const promise = factory();
    const timeoutId = setTimeout(() => {
      this.cleanup(key);
    }, this.timeout);

    const cachedRequest: CachedRequest<T> = {
      promise,
      timestamp: Date.now(),
      cleanup: () => {
        clearTimeout(timeoutId);
        this.activeRequests.delete(key);
      }
    };

    this.activeRequests.set(key, cachedRequest);

    // Set up cleanup on completion (success or failure)
    promise
      .then(() => cachedRequest.cleanup())
      .catch(() => cachedRequest.cleanup());

    return promise;
  }

  /**
   * Generate a request key based on parameters
   */
  generateRequestKey(method: string, ...params: any[]): string {
    const paramString = params
      .map(param => {
        if (typeof param === 'object' && param !== null) {
          return JSON.stringify(param, Object.keys(param).sort());
        }
        return String(param);
      })
      .join('|');
    
    return `${method}:${paramString}`;
  }

  /**
   * Clear a specific request from the cache
   */
  clear(key: string): void {
    const request = this.activeRequests.get(key);
    if (request) {
      request.cleanup();
    }
  }

  /**
   * Clear all cached requests
   */
  clearAll(): void {
    for (const request of this.activeRequests.values()) {
      request.cleanup();
    }
    this.activeRequests.clear();
  }

  /**
   * Get the number of active requests
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get all active request keys (for debugging)
   */
  getActiveRequestKeys(): string[] {
    return Array.from(this.activeRequests.keys());
  }

  private isRequestStale(request: CachedRequest<any>): boolean {
    return Date.now() - request.timestamp > this.timeout;
  }

  private cleanup(key: string): void {
    const request = this.activeRequests.get(key);
    if (request) {
      request.cleanup();
    }
  }

  private enforceMaxCacheSize(): void {
    if (this.activeRequests.size >= this.maxCacheSize) {
      // Remove oldest requests first
      const entries = Array.from(this.activeRequests.entries());
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize + 1);
      for (const [key, request] of toRemove) {
        request.cleanup();
      }
    }
  }
}

// Export a default instance for convenience
export const defaultDeduplicator = new RequestDeduplicator();