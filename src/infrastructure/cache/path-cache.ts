/**
 * Path Cache Implementation for Performance Optimization
 *
 * Provides intelligent caching for property path parsing and extraction results
 * Following DDD principles with domain-driven cache design
 * Implements totality patterns with Result types and Smart Constructors
 */

import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { PerformanceError } from "../../domain/shared/types/errors.ts";
import { PropertyPath } from "../../domain/schema/extractors/property-extractor.ts";

/**
 * Cache Entry for parsed property paths
 */
interface PathCacheEntry {
  readonly path: PropertyPath;
  readonly parseTime: number;
  readonly accessCount: number;
  readonly lastAccessed: number;
  readonly complexity: number; // Path complexity score for eviction strategy
}

/**
 * Cache Entry for extraction results
 */
interface ExtractionCacheEntry {
  readonly result: unknown;
  readonly dataHash: string;
  readonly pathHash: string;
  readonly timestamp: number;
  readonly accessCount: number;
  readonly lastAccessed: number;
}

/**
 * Path Cache Configuration
 */
export interface PathCacheConfig {
  readonly maxPathEntries: number;
  readonly maxExtractionEntries: number;
  readonly pathTtlMs: number;
  readonly extractionTtlMs: number;
  readonly enableComplexityEviction: boolean;
  readonly enableExtractionCache: boolean;
}

/**
 * Path Cache Statistics for monitoring
 */
export interface PathCacheStats {
  readonly pathEntries: number;
  readonly extractionEntries: number;
  readonly pathHits: number;
  readonly pathMisses: number;
  readonly extractionHits: number;
  readonly extractionMisses: number;
  readonly pathHitRate: number;
  readonly extractionHitRate: number;
  readonly memoryEstimateMB: number;
  readonly evictions: number;
}

/**
 * Path Cache for Property Path parsing and extraction results
 * Optimizes repeated path parsing and data extraction operations
 */
export class PathCache {
  private readonly pathCache = new Map<string, PathCacheEntry>();
  private readonly extractionCache = new Map<string, ExtractionCacheEntry>();
  private readonly config: PathCacheConfig;
  private readonly stats: PathCacheStats;

  private constructor(config: PathCacheConfig) {
    this.config = config;
    this.stats = {
      pathEntries: 0,
      extractionEntries: 0,
      pathHits: 0,
      pathMisses: 0,
      extractionHits: 0,
      extractionMisses: 0,
      pathHitRate: 0,
      extractionHitRate: 0,
      memoryEstimateMB: 0,
      evictions: 0,
    };
  }

  /**
   * Smart Constructor for PathCache
   */
  static create(
    config: Partial<PathCacheConfig> = {},
  ): Result<PathCache, PerformanceError & { message: string }> {
    const validatedConfig: PathCacheConfig = {
      maxPathEntries: config.maxPathEntries ?? 1000,
      maxExtractionEntries: config.maxExtractionEntries ?? 500,
      pathTtlMs: config.pathTtlMs ?? 30 * 60 * 1000, // 30 minutes
      extractionTtlMs: config.extractionTtlMs ?? 5 * 60 * 1000, // 5 minutes
      enableComplexityEviction: config.enableComplexityEviction ?? true,
      enableExtractionCache: config.enableExtractionCache ?? true,
    };

    // Validate configuration
    if (
      validatedConfig.maxPathEntries < 1 ||
      validatedConfig.maxPathEntries > 10000
    ) {
      return err({
        kind: "PerformanceViolation",
        content: "Path cache entries must be between 1 and 10000",
        message: "Invalid path cache configuration",
      });
    }

    if (
      validatedConfig.maxExtractionEntries < 1 ||
      validatedConfig.maxExtractionEntries > 5000
    ) {
      return err({
        kind: "PerformanceViolation",
        content: "Extraction cache entries must be between 1 and 5000",
        message: "Invalid extraction cache configuration",
      });
    }

    return ok(new PathCache(validatedConfig));
  }

  /**
   * Get cached PropertyPath or null if not found/expired
   */
  getPath(pathString: string): PropertyPath | null {
    const entry = this.pathCache.get(pathString);

    if (!entry) {
      (this.stats as any).pathMisses++;
      this.updatePathHitRate();
      return null;
    }

    // Check TTL expiration
    const now = Date.now();
    if (now - entry.lastAccessed > this.config.pathTtlMs) {
      this.pathCache.delete(pathString);
      (this.stats as any).pathMisses++;
      (this.stats as any).evictions++;
      this.updatePathHitRate();
      return null;
    }

    // Update access statistics
    const updatedEntry: PathCacheEntry = {
      ...entry,
      accessCount: entry.accessCount + 1,
      lastAccessed: now,
    };
    this.pathCache.set(pathString, updatedEntry);

    (this.stats as any).pathHits++;
    this.updatePathHitRate();
    return entry.path;
  }

  /**
   * Cache parsed PropertyPath
   */
  setPath(
    pathString: string,
    path: PropertyPath,
  ): Result<void, PerformanceError> {
    // Check if cache is full and eviction is needed
    if (this.pathCache.size >= this.config.maxPathEntries) {
      const evictionResult = this.evictPathEntries();
      if (!evictionResult.ok) {
        return evictionResult;
      }
    }

    const now = Date.now();
    const complexity = this.calculatePathComplexity(pathString);

    const entry: PathCacheEntry = {
      path,
      parseTime: now,
      accessCount: 1,
      lastAccessed: now,
      complexity,
    };

    this.pathCache.set(pathString, entry);
    (this.stats as any).pathEntries = this.pathCache.size;
    this.updateMemoryEstimate();

    return ok(undefined);
  }

  /**
   * Get cached extraction result
   */
  getExtractionResult(dataHash: string, pathHash: string): unknown | null {
    if (!this.config.enableExtractionCache) {
      return null;
    }

    const cacheKey = `${dataHash}:${pathHash}`;
    const entry = this.extractionCache.get(cacheKey);

    if (!entry) {
      (this.stats as any).extractionMisses++;
      this.updateExtractionHitRate();
      return null;
    }

    // Check TTL expiration
    const now = Date.now();
    if (now - entry.timestamp > this.config.extractionTtlMs) {
      this.extractionCache.delete(cacheKey);
      (this.stats as any).extractionMisses++;
      (this.stats as any).evictions++;
      this.updateExtractionHitRate();
      return null;
    }

    // Update access statistics
    const updatedEntry: ExtractionCacheEntry = {
      ...entry,
      accessCount: entry.accessCount + 1,
      lastAccessed: now,
    };
    this.extractionCache.set(cacheKey, updatedEntry);

    (this.stats as any).extractionHits++;
    this.updateExtractionHitRate();
    return entry.result;
  }

  /**
   * Cache extraction result
   */
  setExtractionResult(
    dataHash: string,
    pathHash: string,
    result: unknown,
  ): Result<void, PerformanceError> {
    if (!this.config.enableExtractionCache) {
      return ok(undefined);
    }

    // Check if cache is full and eviction is needed
    if (this.extractionCache.size >= this.config.maxExtractionEntries) {
      const evictionResult = this.evictExtractionEntries();
      if (!evictionResult.ok) {
        return evictionResult;
      }
    }

    const now = Date.now();
    const cacheKey = `${dataHash}:${pathHash}`;

    const entry: ExtractionCacheEntry = {
      result,
      dataHash,
      pathHash,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    };

    this.extractionCache.set(cacheKey, entry);
    (this.stats as any).extractionEntries = this.extractionCache.size;
    this.updateMemoryEstimate();

    return ok(undefined);
  }

  /**
   * Generate hash for data structure (simple implementation)
   */
  generateDataHash(data: unknown): string {
    try {
      const serialized = JSON.stringify(data);
      // Simple hash function for demonstration - in production, use a proper hash
      let hash = 0;
      for (let i = 0; i < serialized.length; i++) {
        const char = serialized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash).toString(36);
    } catch {
      return Date.now().toString(36);
    }
  }

  /**
   * Generate hash for path string
   */
  generatePathHash(pathString: string): string {
    let hash = 0;
    for (let i = 0; i < pathString.length; i++) {
      const char = pathString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    const totalEvictions = this.pathCache.size + this.extractionCache.size;
    this.pathCache.clear();
    this.extractionCache.clear();

    (this.stats as any).pathEntries = 0;
    (this.stats as any).extractionEntries = 0;
    (this.stats as any).evictions += totalEvictions;
    this.updateMemoryEstimate();
  }

  /**
   * Get current cache statistics
   */
  getStats(): PathCacheStats {
    return { ...this.stats };
  }

  /**
   * Perform cache maintenance (cleanup expired entries)
   */
  performMaintenance(): Result<void, PerformanceError> {
    const now = Date.now();
    let evictedCount = 0;

    // Clean expired path entries
    for (const [key, entry] of this.pathCache.entries()) {
      if (now - entry.lastAccessed > this.config.pathTtlMs) {
        this.pathCache.delete(key);
        evictedCount++;
      }
    }

    // Clean expired extraction entries
    if (this.config.enableExtractionCache) {
      for (const [key, entry] of this.extractionCache.entries()) {
        if (now - entry.timestamp > this.config.extractionTtlMs) {
          this.extractionCache.delete(key);
          evictedCount++;
        }
      }
    }

    (this.stats as any).pathEntries = this.pathCache.size;
    (this.stats as any).extractionEntries = this.extractionCache.size;
    (this.stats as any).evictions += evictedCount;
    this.updateMemoryEstimate();

    return ok(undefined);
  }

  /**
   * Calculate path complexity for eviction strategy
   */
  private calculatePathComplexity(pathString: string): number {
    let complexity = pathString.length; // Base complexity on length

    // Add complexity for special patterns
    if (pathString.includes("[]")) complexity += 10; // Array notation
    if (pathString.includes(".")) complexity += pathString.split(".").length; // Depth

    return complexity;
  }

  /**
   * Evict path entries using complexity-based or LRU strategy
   */
  private evictPathEntries(): Result<void, PerformanceError> {
    const entriesToRemove = Math.ceil(this.config.maxPathEntries * 0.1); // Remove 10%
    const entries = Array.from(this.pathCache.entries());

    if (this.config.enableComplexityEviction) {
      // Evict highest complexity, least recently used entries
      entries
        .sort((a, b) => {
          const complexityDiff = b[1].complexity - a[1].complexity;
          if (complexityDiff !== 0) return complexityDiff;
          return a[1].lastAccessed - b[1].lastAccessed;
        })
        .slice(0, entriesToRemove)
        .forEach(([key]) => {
          this.pathCache.delete(key);
          (this.stats as any).evictions++;
        });
    } else {
      // Simple LRU eviction
      entries
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
        .slice(0, entriesToRemove)
        .forEach(([key]) => {
          this.pathCache.delete(key);
          (this.stats as any).evictions++;
        });
    }

    return ok(undefined);
  }

  /**
   * Evict extraction entries using LRU strategy
   */
  private evictExtractionEntries(): Result<void, PerformanceError> {
    const entriesToRemove = Math.ceil(this.config.maxExtractionEntries * 0.1);
    const entries = Array.from(this.extractionCache.entries());

    entries
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      .slice(0, entriesToRemove)
      .forEach(([key]) => {
        this.extractionCache.delete(key);
        (this.stats as any).evictions++;
      });

    return ok(undefined);
  }

  /**
   * Update path hit rate statistics
   */
  private updatePathHitRate(): void {
    const total = this.stats.pathHits + this.stats.pathMisses;
    (this.stats as any).pathHitRate = total > 0
      ? this.stats.pathHits / total
      : 0;
  }

  /**
   * Update extraction hit rate statistics
   */
  private updateExtractionHitRate(): void {
    const total = this.stats.extractionHits + this.stats.extractionMisses;
    (this.stats as any).extractionHitRate = total > 0
      ? this.stats.extractionHits / total
      : 0;
  }

  /**
   * Update memory usage estimate
   */
  private updateMemoryEstimate(): void {
    // Rough estimate: path entry ~200B, extraction entry ~1KB
    const pathMemory = this.pathCache.size * 200;
    const extractionMemory = this.extractionCache.size * 1024;
    (this.stats as any).memoryEstimateMB = (pathMemory + extractionMemory) /
      (1024 * 1024);
  }
}

/**
 * Path Cache Factory
 * Creates PathCache instances with proper configuration
 */
export class PathCacheFactory {
  /**
   * Create standard PathCache for production use
   */
  static create(
    config?: Partial<PathCacheConfig>,
  ): Result<PathCache, PerformanceError & { message: string }> {
    return PathCache.create(config);
  }

  /**
   * Create PathCache optimized for testing
   */
  static createForTesting(): Result<
    PathCache,
    PerformanceError & { message: string }
  > {
    return PathCache.create({
      maxPathEntries: 100,
      maxExtractionEntries: 50,
      pathTtlMs: 1000,
      extractionTtlMs: 500,
      enableComplexityEviction: true,
      enableExtractionCache: true,
    });
  }

  /**
   * Create PathCache optimized for high-performance scenarios
   */
  static createHighPerformance(): Result<
    PathCache,
    PerformanceError & { message: string }
  > {
    return PathCache.create({
      maxPathEntries: 5000,
      maxExtractionEntries: 2000,
      pathTtlMs: 60 * 60 * 1000, // 1 hour
      extractionTtlMs: 15 * 60 * 1000, // 15 minutes
      enableComplexityEviction: true,
      enableExtractionCache: true,
    });
  }
}
