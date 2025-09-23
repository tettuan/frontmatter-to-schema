/**
 * @fileoverview Path Cache Infrastructure for Performance Optimization
 * @description Implements caching for property paths and extraction results
 * Following DDD and Totality principles
 */

import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { SchemaError } from "../../domain/shared/types/errors.ts";
import {
  ErrorHandling,
  type OperationContext,
} from "../../domain/shared/services/error-handling-service.ts";

// Cache error factory for ErrorHandlingService
const cacheErrorFactory = (
  message: string,
  context?: OperationContext,
): SchemaError & { message: string } => ({
  kind: "InvalidSchema",
  message: context
    ? `Cache ${context.operation} failed: ${message}`
    : `Cache operation failed: ${message}`,
});

/**
 * Cache entry with TTL and usage tracking
 */
interface CacheEntry<T> {
  readonly value: T;
  readonly timestamp: number;
  readonly accessCount: number;
  readonly ttl: number;
}

/**
 * Cache configuration options
 */
export interface PathCacheConfig {
  readonly maxSize: number;
  readonly defaultTtl: number;
  readonly enableMetrics: boolean;
  readonly maxPathEntries?: number;
  readonly maxExtractionEntries?: number;
  readonly pathTtlMs?: number;
  readonly extractionTtlMs?: number;
}

/**
 * Cache metrics for monitoring
 */
interface CacheMetrics {
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
  readonly size: number;
  readonly hitRate: number;
}

/**
 * Path Cache for property path parsing and extraction results
 * Following Totality principle with immutable design
 */
export class PathCache<T> {
  private constructor(
    private readonly cache: Map<string, CacheEntry<T>>,
    private readonly config: PathCacheConfig,
    private readonly metrics: {
      hits: number;
      misses: number;
      evictions: number;
    },
  ) {}

  /**
   * Smart Constructor
   */
  static create<T>(config?: Partial<PathCacheConfig>): PathCache<T> {
    const defaultConfig: PathCacheConfig = {
      maxSize: 1000,
      defaultTtl: 300000, // 5 minutes
      enableMetrics: true,
    };

    const finalConfig = { ...defaultConfig, ...config };
    return new PathCache(
      new Map(),
      finalConfig,
      { hits: 0, misses: 0, evictions: 0 },
    );
  }

  /**
   * Get value from cache
   */
  get(key: string): Result<T | undefined, SchemaError> {
    return ErrorHandling.wrapOperation(
      () => {
        const entry = this.cache.get(key);

        if (!entry) {
          this.incrementMisses();
          return undefined;
        }

        // Check TTL
        if (this.isExpired(entry)) {
          this.cache.delete(key);
          this.incrementMisses();
          return undefined;
        }

        // Update access count
        const updatedEntry: CacheEntry<T> = {
          ...entry,
          accessCount: entry.accessCount + 1,
        };
        this.cache.set(key, updatedEntry);

        this.incrementHits();
        return entry.value;
      },
      cacheErrorFactory,
      { operation: "get", method: "cache-access" },
    );
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): Result<void, SchemaError> {
    const effectiveTtl = ttl ?? this.config.defaultTtl;

    // Evict if at capacity
    const maxEntries = this.config.maxPathEntries ?? this.config.maxSize;
    if (this.cache.size >= maxEntries && !this.cache.has(key)) {
      const evictResult = this.evictLeastRecentlyUsed();
      if (!evictResult.ok) {
        return err({
          kind: "InvalidSchema",
          message: `Cache eviction failed: ${evictResult.error.kind}`,
        });
      }
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      accessCount: 1,
      ttl: effectiveTtl,
    };

    this.cache.set(key, entry);
    return ok(void 0);
  }

  /**
   * Check if cache has valid entry
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.resetMetrics();
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? this.metrics.hits / total : 0;

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
      size: this.cache.size,
      hitRate,
    };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Estimate memory usage in bytes
   */
  estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache) {
      // Rough estimation: key + value + metadata
      totalSize += key.length * 2; // String UTF-16
      totalSize += this.estimateValueSize(entry.value);
      totalSize += 64; // Metadata overhead
    }

    return totalSize;
  }

  /**
   * Get cached property path
   */
  getPath(pathString: string): unknown | null {
    const result = this.get(pathString);
    return result.ok ? result.data : null;
  }

  /**
   * Set cached property path
   */
  setPath(pathString: string, path: unknown): Result<void, SchemaError> {
    const result = this.set(pathString, path as T);
    if (!result.ok) {
      return err({
        kind: "SchemaNotFound",
        path: pathString,
      });
    }
    return ok(undefined);
  }

  /**
   * Generate data hash for caching
   */
  generateDataHash(data: unknown): string {
    try {
      const str = JSON.stringify(data);
      return this.simpleHash(str);
    } catch {
      return "invalid-data-hash";
    }
  }

  /**
   * Generate path hash for caching
   */
  generatePathHash(pathString: string): string {
    return this.simpleHash(pathString);
  }

  /**
   * Get cached extraction result
   */
  getExtractionResult(dataHash: string, pathHash: string): unknown | null {
    const key = `extract:${dataHash}:${pathHash}`;
    const result = this.get(key);
    return result.ok ? result.data : null;
  }

  /**
   * Set cached extraction result
   */
  setExtractionResult(
    dataHash: string,
    pathHash: string,
    value: unknown,
  ): Result<void, SchemaError> {
    const key = `extract:${dataHash}:${pathHash}`;
    const result = this.set(key, value as T);
    if (!result.ok) {
      return err({
        kind: "SchemaNotFound",
        path: key,
      });
    }
    return ok(undefined);
  }

  /**
   * Perform cache maintenance
   */
  performMaintenance(): Result<void, SchemaError> {
    return ErrorHandling.wrapOperation(
      () => {
        this.cleanup();
        // No return needed for void operations
      },
      cacheErrorFactory,
      { operation: "maintenance", method: "cleanup" },
    );
  }

  /**
   * Get cache statistics
   */
  getStats(): any {
    const metrics = this.getMetrics();
    return {
      ...metrics,
      memoryUsage: this.estimateMemoryUsage(),
      pathEntries: this.cache.size,
    };
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    let removedCount = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  // Private methods

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLeastRecentlyUsed(): Result<void, SchemaError> {
    return ErrorHandling.wrapOperation(
      () => {
        let lruKey: string | null = null;
        let lruEntry: CacheEntry<T> | null = null;

        for (const [key, entry] of this.cache) {
          if (!lruEntry || entry.accessCount < lruEntry.accessCount) {
            lruKey = key;
            lruEntry = entry;
          }
        }

        if (lruKey) {
          this.cache.delete(lruKey);
          this.incrementEvictions();
        }

        // No return needed for void operations
      },
      cacheErrorFactory,
      { operation: "eviction", method: "lru-cleanup" },
    );
  }

  private incrementHits(): void {
    if (this.config.enableMetrics) {
      (this.metrics as { hits: number }).hits++;
    }
  }

  private incrementMisses(): void {
    if (this.config.enableMetrics) {
      (this.metrics as { misses: number }).misses++;
    }
  }

  private incrementEvictions(): void {
    if (this.config.enableMetrics) {
      (this.metrics as { evictions: number }).evictions++;
    }
  }

  private resetMetrics(): void {
    (this.metrics as { hits: number; misses: number; evictions: number }) = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  private estimateValueSize(value: T): number {
    if (typeof value === "string") {
      return value.length * 2; // UTF-16
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return 8;
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value).length * 2; // Rough estimate
    }
    return 64; // Default estimate
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * Factory for creating PathCache instances
 */
export class PathCacheFactory {
  private constructor() {}

  /**
   * Create a new PathCache instance with Result pattern
   */
  static create<T>(
    config?: Partial<PathCacheConfig>,
  ): Result<PathCache<T>, SchemaError> {
    try {
      const cache = PathCache.create<T>(config);
      return ok(cache);
    } catch (error) {
      return err({
        kind: "InvalidSchema" as const,
        message: `Failed to create PathCache: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Create a new PathCache instance for PropertyPath objects
   */
  static createPropertyPathCache(
    config?: Partial<PathCacheConfig>,
  ): PathCache<unknown> {
    return PathCache.create<unknown>(config);
  }

  /**
   * Create a new PathCache instance for extraction results
   */
  static createExtractionCache(
    config?: Partial<PathCacheConfig>,
  ): PathCache<unknown> {
    return PathCache.create<unknown>(config);
  }

  /**
   * Create a new PathCache instance with custom type
   */
  static createTypedCache<T>(config?: Partial<PathCacheConfig>): PathCache<T> {
    return PathCache.create<T>(config);
  }

  /**
   * Create a PathCache instance optimized for testing with smaller limits
   */
  static createForTesting<T = unknown>(
    config?: Partial<PathCacheConfig>,
  ): Result<PathCache<T>, SchemaError> {
    const testConfig: Partial<PathCacheConfig> = {
      maxSize: 50,
      defaultTtl: 1000, // 1 second for fast test execution
      enableMetrics: true,
      maxPathEntries: 25,
      ...config,
    };

    try {
      const cache = PathCache.create<T>(testConfig);
      return ok(cache);
    } catch (error) {
      return err({
        kind: "InvalidSchema" as const,
        message: `Failed to create test PathCache: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }
}
