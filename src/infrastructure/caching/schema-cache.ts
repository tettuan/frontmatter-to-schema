import { Result } from "../../domain/shared/types/result.ts";
import { SchemaDefinition } from "../../domain/schema/value-objects/schema-definition.ts";

/**
 * Cache Entry Interface
 * Stores cached schema with metadata for invalidation
 */
interface SchemaCacheEntry {
  schema: SchemaDefinition;
  timestamp: number;
  filePath: string;
  fileModTime: number;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache Configuration
 * Configurable parameters for cache behavior
 */
export interface SchemaCacheConfig {
  maxEntries: number;
  ttlMs: number; // Time to live in milliseconds
  enableFileWatching: boolean;
  enableLRUEviction: boolean;
}

/**
 * Schema Cache Statistics
 * Provides insights into cache performance
 */
export interface SchemaCacheStats {
  totalEntries: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  memoryEstimateMB: number;
}

/**
 * Schema Cache Implementation
 * Provides intelligent caching with invalidation for schema definitions
 * Follows performance optimization patterns identified in project analysis
 */
export class SchemaCache {
  private cache = new Map<string, SchemaCacheEntry>();
  private config: SchemaCacheConfig;
  private stats: SchemaCacheStats;

  constructor(config: Partial<SchemaCacheConfig> = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 100,
      ttlMs: config.ttlMs ?? 5 * 60 * 1000, // 5 minutes default
      enableFileWatching: config.enableFileWatching ?? false,
      enableLRUEviction: config.enableLRUEviction ?? true,
    };

    this.stats = {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      memoryEstimateMB: 0,
    };
  }

  /**
   * Retrieves schema from cache with intelligent invalidation
   * Returns Result to maintain totality principle
   */
  async get(
    filePath: string,
  ): Promise<Result<SchemaDefinition | null, string>> {
    const normalizedPath = this.normalizePath(filePath);
    const entry = this.cache.get(normalizedPath);

    // Cache miss
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return { ok: true, data: null };
    }

    // Check TTL expiration
    const now = Date.now();
    if (now - entry.timestamp > this.config.ttlMs) {
      this.cache.delete(normalizedPath);
      this.stats.misses++;
      this.stats.evictions++;
      this.updateHitRate();
      return { ok: true, data: null };
    }

    // Check file modification time if file watching is disabled
    if (!this.config.enableFileWatching) {
      const fileModCheckResult = await this.checkFileModification(
        filePath,
        entry.fileModTime,
      );
      if (!fileModCheckResult.ok) {
        return {
          ok: false,
          error: `File modification check failed: ${fileModCheckResult.error}`,
        };
      }

      if (fileModCheckResult.data) {
        // File was modified, invalidate cache entry
        this.cache.delete(normalizedPath);
        this.stats.misses++;
        this.stats.evictions++;
        this.updateHitRate();
        return { ok: true, data: null };
      }
    }

    // Cache hit - update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.stats.hits++;
    this.updateHitRate();

    return { ok: true, data: entry.schema };
  }

  /**
   * Stores schema in cache with metadata
   */
  async set(
    filePath: string,
    schema: SchemaDefinition,
  ): Promise<Result<void, string>> {
    const normalizedPath = this.normalizePath(filePath);

    try {
      const fileModTime = await this.getFileModificationTime(filePath);
      const now = Date.now();

      const entry: SchemaCacheEntry = {
        schema,
        timestamp: now,
        filePath: normalizedPath,
        fileModTime,
        accessCount: 1,
        lastAccessed: now,
      };

      // Check if cache is full and eviction is needed
      if (this.cache.size >= this.config.maxEntries) {
        const evictionResult = this.evictEntries();
        if (!evictionResult.ok) {
          return {
            ok: false,
            error: `Cache eviction failed: ${evictionResult.error}`,
          };
        }
      }

      this.cache.set(normalizedPath, entry);
      this.stats.totalEntries = this.cache.size;
      this.updateMemoryEstimate();

      return { ok: true, data: undefined };
    } catch (error) {
      return { ok: false, error: `Failed to cache schema: ${error}` };
    }
  }

  /**
   * Invalidates cache entry for specific file path
   */
  invalidate(filePath: string): Result<boolean, string> {
    const normalizedPath = this.normalizePath(filePath);
    const wasDeleted = this.cache.delete(normalizedPath);

    if (wasDeleted) {
      this.stats.totalEntries = this.cache.size;
      this.stats.evictions++;
      this.updateMemoryEstimate();
    }

    return { ok: true, data: wasDeleted };
  }

  /**
   * Clears entire cache
   */
  clear(): Result<void, string> {
    const entriesCount = this.cache.size;
    this.cache.clear();

    this.stats.totalEntries = 0;
    this.stats.evictions += entriesCount;
    this.updateMemoryEstimate();

    return { ok: true, data: undefined };
  }

  /**
   * Gets current cache statistics
   */
  getStats(): SchemaCacheStats {
    return { ...this.stats };
  }

  /**
   * Performs cache maintenance (TTL cleanup, statistics update)
   */
  performMaintenance(): Result<void, string> {
    const now = Date.now();
    let evictedCount = 0;

    for (const [path, entry] of this.cache.entries()) {
      // Remove expired entries
      if (now - entry.timestamp > this.config.ttlMs) {
        this.cache.delete(path);
        evictedCount++;
      }
    }

    this.stats.totalEntries = this.cache.size;
    this.stats.evictions += evictedCount;
    this.updateMemoryEstimate();
    this.updateHitRate();

    return { ok: true, data: undefined };
  }

  /**
   * Evicts cache entries using configured strategy
   */
  private evictEntries(): Result<void, string> {
    if (!this.config.enableLRUEviction) {
      // Simple eviction: remove oldest entries
      const entries = Array.from(this.cache.entries());
      const toRemove = Math.ceil(this.config.maxEntries * 0.1); // Remove 10% of entries

      entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, toRemove)
        .forEach(([path]) => {
          this.cache.delete(path);
          this.stats.evictions++;
        });

      return { ok: true, data: undefined };
    }

    // LRU eviction: remove least recently used entries
    const entries = Array.from(this.cache.entries());
    const toRemove = Math.ceil(this.config.maxEntries * 0.1);

    entries
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      .slice(0, toRemove)
      .forEach(([path]) => {
        this.cache.delete(path);
        this.stats.evictions++;
      });

    return { ok: true, data: undefined };
  }

  /**
   * Checks if file has been modified since cached
   */
  private async checkFileModification(
    filePath: string,
    cachedModTime: number,
  ): Promise<Result<boolean, string>> {
    try {
      const currentModTime = await this.getFileModificationTime(filePath);
      return { ok: true, data: currentModTime !== cachedModTime };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to check file modification: ${error}`,
      };
    }
  }

  /**
   * Gets file modification time
   */
  private async getFileModificationTime(filePath: string): Promise<number> {
    const fileInfo = await Deno.stat(filePath);
    return fileInfo.mtime?.getTime() ?? 0;
  }

  /**
   * Normalizes file path for consistent cache keys
   */
  private normalizePath(filePath: string): string {
    // Convert to absolute path and normalize separators
    try {
      return new URL(`file://${filePath}`).pathname;
    } catch {
      // Fallback for invalid paths
      return filePath.replace(/\\/g, "/");
    }
  }

  /**
   * Updates hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Updates memory usage estimate
   */
  private updateMemoryEstimate(): void {
    // Rough estimate: each schema entry ~1KB
    this.stats.memoryEstimateMB = (this.cache.size * 1024) / (1024 * 1024);
  }
}

/**
 * Schema Cache Manager
 * Provides singleton access to schema cache with configuration
 */
export class SchemaCacheManager {
  private static instance: SchemaCache;

  static getInstance(config?: Partial<SchemaCacheConfig>): SchemaCache {
    if (!SchemaCacheManager.instance) {
      SchemaCacheManager.instance = new SchemaCache(config);
    }
    return SchemaCacheManager.instance;
  }

  static resetInstance(): void {
    SchemaCacheManager.instance?.clear();
    SchemaCacheManager.instance = null as any;
  }
}
