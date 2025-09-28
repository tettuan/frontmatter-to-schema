/**
 * Optimized Property Extractor with Performance Enhancements
 *
 * Extends PropertyExtractor with intelligent caching and performance optimizations
 * Implements DDD Service patterns with enhanced error context support
 * Follows Totality principles with comprehensive Result types
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import {
  EnhancedErrorContext,
  EnhancedErrorContextFactory,
  SystemContext,
  UserContext,
} from "../../shared/types/enhanced-error-context.ts";
import { PropertyExtractor, PropertyPath } from "./property-extractor.ts";
import {
  PathCache,
  // PathCacheFactory, // Removed unused import
} from "../../../infrastructure/cache/path-cache.ts";

/**
 * Performance metrics for extraction operations
 */
export interface ExtractionMetrics {
  readonly operationId: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly cacheHit: boolean;
  readonly pathComplexity: number;
  readonly dataSize: number;
  readonly memoryUsage?: number;
}

/**
 * Configuration for optimized extractor
 */
export interface OptimizedExtractorConfig {
  readonly enablePathCache: boolean;
  readonly enableExtractionCache: boolean;
  readonly enableMetrics: boolean;
  readonly maxConcurrentExtractions: number;
  readonly timeoutMs: number;
  readonly pathCacheConfig?: {
    maxSize?: number;
    defaultTtl?: number;
    enableMetrics?: boolean;
    maxPathEntries?: number;
    maxExtractionEntries?: number;
    pathTtlMs?: number;
    extractionTtlMs?: number;
  };
}

/**
 * Optimized Property Extractor with intelligent caching and performance monitoring
 */
export class OptimizedPropertyExtractor {
  private readonly baseExtractor: PropertyExtractor;
  private readonly pathCache: PathCache<unknown> | null;
  private readonly config: OptimizedExtractorConfig;
  private readonly activeExtractions = new Map<string, ExtractionMetrics>();
  private readonly extractionHistory: ExtractionMetrics[] = [];

  private constructor(
    baseExtractor: PropertyExtractor,
    pathCache: PathCache<unknown> | null,
    config: OptimizedExtractorConfig,
  ) {
    this.baseExtractor = baseExtractor;
    this.pathCache = pathCache;
    this.config = config;
  }

  /**
   * Smart Constructor for OptimizedPropertyExtractor
   */
  static create(
    config: Partial<OptimizedExtractorConfig> = {},
  ): Result<OptimizedPropertyExtractor, SchemaError & { message: string }> {
    const validatedConfig: OptimizedExtractorConfig = {
      enablePathCache: config.enablePathCache ?? true,
      enableExtractionCache: config.enableExtractionCache ?? true,
      enableMetrics: config.enableMetrics ?? true,
      maxConcurrentExtractions: config.maxConcurrentExtractions ?? 10,
      timeoutMs: config.timeoutMs ?? 30000,
      pathCacheConfig: config.pathCacheConfig,
    };

    // Validate configuration
    if (
      validatedConfig.maxConcurrentExtractions < 1 ||
      validatedConfig.maxConcurrentExtractions > 100
    ) {
      return err({
        kind: "InvalidSchema",
        message: "Max concurrent extractions must be between 1 and 100",
      });
    }

    if (
      validatedConfig.timeoutMs < 1000 || validatedConfig.timeoutMs > 300000
    ) {
      return err({
        kind: "InvalidSchema",
        message: "Timeout must be between 1 second and 5 minutes",
      });
    }

    // Create base extractor
    const baseExtractor = PropertyExtractor.create();

    // Create path cache if enabled
    let pathCache: PathCache<unknown> | null = null;
    if (validatedConfig.enablePathCache) {
      pathCache = PathCache.create<unknown>(validatedConfig.pathCacheConfig);
    }

    return ok(
      new OptimizedPropertyExtractor(baseExtractor, pathCache, validatedConfig),
    );
  }

  /**
   * Extract value with performance optimizations and enhanced error context
   */
  async extract(
    data: unknown,
    pathString: string,
    context?: {
      correlationId?: string;
      inputFile?: string;
      operation?: string;
    },
  ): Promise<
    Result<unknown, SchemaError & { enhancedContext?: EnhancedErrorContext }>
  > {
    const operationId = context?.correlationId || this.generateOperationId();
    const startTime = performance.now();

    // Check concurrent extractions limit
    if (this.activeExtractions.size >= this.config.maxConcurrentExtractions) {
      const errorContextResult = EnhancedErrorContextFactory.forSchemaOperation(
        pathString,
        "extract",
        "extract",
      );

      return err({
        kind: "InvalidSchema",
        message:
          `Maximum concurrent extractions (${this.config.maxConcurrentExtractions}) exceeded`,
        enhancedContext: errorContextResult.ok
          ? errorContextResult.data
          : undefined,
      });
    }

    // Initialize metrics
    const metrics: ExtractionMetrics = {
      operationId,
      startTime,
      cacheHit: false,
      pathComplexity: this.calculatePathComplexity(pathString),
      dataSize: this.estimateDataSize(data),
    };

    this.activeExtractions.set(operationId, metrics);

    try {
      // Try to get cached result first
      if (this.pathCache && this.config.enableExtractionCache) {
        const dataHash = this.pathCache.generateDataHash(data);
        const pathHash = this.pathCache.generatePathHash(pathString);
        const cachedResult = this.pathCache.getExtractionResult(
          dataHash,
          pathHash,
        );

        if (cachedResult !== null) {
          const cachedMetrics = { ...metrics, cacheHit: true };
          this.activeExtractions.set(operationId, cachedMetrics);
          this.completeMetrics(operationId, true);
          return ok(cachedResult);
        }
      }

      // Get or parse property path
      const pathResult = this.getOrParsePath(pathString);
      if (!pathResult.ok) {
        this.completeMetrics(operationId, false);
        return pathResult;
      }

      // Extract using base extractor with timeout
      const extractionResult = await this.extractWithTimeout(
        data,
        pathResult.data,
        this.config.timeoutMs,
      );

      if (!extractionResult.ok) {
        this.completeMetrics(operationId, false);

        // Enhance error with context
        const errorContextResult = EnhancedErrorContextFactory
          .forSchemaOperation(
            pathString,
            context?.operation || "extract",
            "extract",
          );

        return err({
          ...extractionResult.error,
          enhancedContext: errorContextResult.ok
            ? errorContextResult.data.withUserContext(
              UserContext.create({
                inputFile: context?.inputFile,
                operation: context?.operation,
              }),
            ).withSystemContext(
              SystemContext.create({
                processingTime: performance.now() - startTime,
                memoryUsage: this.getCurrentMemoryUsage(),
              }),
            )
            : undefined,
        });
      }

      // Cache the result if enabled
      if (this.pathCache && this.config.enableExtractionCache) {
        const dataHash = this.pathCache.generateDataHash(data);
        const pathHash = this.pathCache.generatePathHash(pathString);
        this.pathCache.setExtractionResult(
          dataHash,
          pathHash,
          extractionResult.data,
        );
      }

      this.completeMetrics(operationId, true);
      return extractionResult;
    } catch (error) {
      this.completeMetrics(operationId, false);

      const errorContextResult = EnhancedErrorContextFactory.forSchemaOperation(
        pathString,
        context?.operation || "extract",
        "extract",
      );

      return err({
        kind: "InvalidSchema",
        message: `Extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        enhancedContext: errorContextResult.ok
          ? errorContextResult.data
          : undefined,
      });
    }
  }

  /**
   * Extract multiple paths in parallel with optimization
   */
  async extractMultiple(
    data: unknown,
    paths: string[],
    context?: {
      correlationId?: string;
      inputFile?: string;
      operation?: string;
    },
  ): Promise<
    Result<
      Record<string, unknown>,
      SchemaError & { enhancedContext?: EnhancedErrorContext }
    >
  > {
    if (paths.length === 0) {
      return ok({});
    }

    // Check if total extractions would exceed limit
    if (
      this.activeExtractions.size + paths.length >
        this.config.maxConcurrentExtractions
    ) {
      const errorContextResult = EnhancedErrorContextFactory.forSchemaOperation(
        paths.join(", "),
        "extractMultiple",
        "extractMultiple",
      );

      return err({
        kind: "InvalidSchema",
        message: "Batch extraction would exceed concurrent extraction limit",
        enhancedContext: errorContextResult.ok
          ? errorContextResult.data
          : undefined,
      });
    }

    try {
      // Process extractions in parallel
      const extractionPromises = paths.map(async (path) => {
        const result = await this.extract(data, path, {
          ...context,
          correlationId: `${
            context?.correlationId || this.generateOperationId()
          }-${path}`,
        });
        return { path, result };
      });

      const results = await Promise.all(extractionPromises);
      const successResults: Record<string, unknown> = {};
      const errors: Array<{ path: string; error: SchemaError }> = [];

      // Collect results and errors
      for (const { path, result } of results) {
        if (result.ok) {
          successResults[path] = result.data;
        } else {
          errors.push({ path, error: result.error });
        }
      }

      // If any errors occurred, return first error with enhanced context
      if (errors.length > 0) {
        const firstError = errors[0];
        const errorContextResult = EnhancedErrorContextFactory
          .forSchemaOperation(
            firstError.path,
            "extractMultiple",
            "extractMultiple",
          );

        return err({
          ...firstError.error,
          enhancedContext: errorContextResult.ok
            ? errorContextResult.data
            : undefined,
        });
      }

      return ok(successResults);
    } catch (error) {
      const errorContextResult = EnhancedErrorContextFactory.forSchemaOperation(
        paths.join(", "),
        "extractMultiple",
        "extractMultiple",
      );

      return err({
        kind: "InvalidSchema",
        message: `Multiple extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        enhancedContext: errorContextResult.ok
          ? errorContextResult.data
          : undefined,
      });
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    activeExtractions: number;
    totalExtractions: number;
    averageDuration: number;
    cacheHitRate: number;
    pathCacheStats?: any;
  } {
    const completedExtractions = this.extractionHistory.filter((m) =>
      m.endTime !== undefined
    );
    const totalDuration = completedExtractions.reduce(
      (sum, m) => sum + (m.duration || 0),
      0,
    );
    const cacheHits = completedExtractions.filter((m) => m.cacheHit).length;

    return {
      activeExtractions: this.activeExtractions.size,
      totalExtractions: completedExtractions.length,
      averageDuration: completedExtractions.length > 0
        ? totalDuration / completedExtractions.length
        : 0,
      cacheHitRate: completedExtractions.length > 0
        ? cacheHits / completedExtractions.length
        : 0,
      pathCacheStats: this.pathCache?.getStats(),
    };
  }

  /**
   * Clear all caches and reset metrics
   */
  clearCaches(): void {
    this.pathCache?.clear();
    this.extractionHistory.length = 0;
    this.activeExtractions.clear();
  }

  /**
   * Perform maintenance on caches
   */
  performMaintenance(): Result<void, SchemaError> {
    if (this.pathCache) {
      const maintenanceResult = this.pathCache.performMaintenance();
      if (!maintenanceResult.ok) {
        const errorMessage = "message" in maintenanceResult.error
          ? maintenanceResult.error.message
          : `Error kind: ${maintenanceResult.error.kind}`;
        return err({
          kind: "InvalidSchema",
          message: `Cache maintenance failed: ${errorMessage}`,
        });
      }
    }

    // Clean old extraction history (keep last 1000 entries)
    if (this.extractionHistory.length > 1000) {
      this.extractionHistory.splice(0, this.extractionHistory.length - 1000);
    }

    return ok(undefined);
  }

  /**
   * Get or parse property path with caching
   */
  private getOrParsePath(
    pathString: string,
  ): Result<PropertyPath, SchemaError> {
    // Try cache first
    if (this.pathCache) {
      const cachedPath = this.pathCache.getPath(pathString);
      if (cachedPath && typeof cachedPath === "object" && cachedPath !== null) {
        return ok(cachedPath as PropertyPath);
      }
    }

    // Parse path
    const pathResult = PropertyPath.create(pathString);
    if (!pathResult.ok) {
      return pathResult;
    }

    // Cache the parsed path
    if (this.pathCache) {
      this.pathCache.setPath(pathString, pathResult.data);
    }

    return pathResult;
  }

  /**
   * Extract with timeout protection
   */
  private async extractWithTimeout(
    data: unknown,
    path: PropertyPath,
    timeoutMs: number,
  ): Promise<Result<unknown, SchemaError>> {
    return await new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(err({
          kind: "InvalidSchema",
          message: `Extraction timeout after ${timeoutMs}ms`,
        }));
      }, timeoutMs);

      try {
        const result = this.baseExtractor.extract(data, path);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        resolve(err({
          kind: "InvalidSchema",
          message: `Extraction error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }));
      }
    });
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `ext_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Calculate path complexity score
   */
  private calculatePathComplexity(pathString: string): number {
    let complexity = pathString.length;
    if (pathString.includes("[]")) complexity += 10;
    if (pathString.includes(".")) {
      complexity += pathString.split(".").length * 2;
    }
    return complexity;
  }

  /**
   * Estimate data size for metrics
   */
  private estimateDataSize(data: unknown): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  /**
   * Get current memory usage estimate
   */
  private getCurrentMemoryUsage(): number {
    try {
      // In Deno, we can get memory usage
      if (typeof Deno !== "undefined" && Deno.memoryUsage) {
        return Deno.memoryUsage().heapUsed;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Complete metrics tracking for an operation
   */
  private completeMetrics(operationId: string, _success: boolean): void {
    const metrics = this.activeExtractions.get(operationId);
    if (metrics) {
      const endTime = performance.now();
      const completedMetrics: ExtractionMetrics = {
        ...metrics,
        endTime,
        duration: endTime - metrics.startTime,
        memoryUsage: this.getCurrentMemoryUsage(),
      };

      this.activeExtractions.delete(operationId);

      if (this.config.enableMetrics) {
        this.extractionHistory.push(completedMetrics);
      }
    }
  }
}

/**
 * Optimized Property Extractor Factory
 */
export class OptimizedPropertyExtractorFactory {
  /**
   * Create standard optimized extractor
   */
  static create(
    config?: Partial<OptimizedExtractorConfig>,
  ): Result<OptimizedPropertyExtractor, SchemaError & { message: string }> {
    return OptimizedPropertyExtractor.create(config);
  }

  /**
   * Create extractor optimized for testing
   */
  static createForTesting(): Result<
    OptimizedPropertyExtractor,
    SchemaError & { message: string }
  > {
    return OptimizedPropertyExtractor.create({
      enablePathCache: true,
      enableExtractionCache: true,
      enableMetrics: true,
      maxConcurrentExtractions: 5,
      timeoutMs: 5000,
      pathCacheConfig: {
        maxSize: 50,
        defaultTtl: 1000,
        enableMetrics: true,
        maxPathEntries: 50,
        maxExtractionEntries: 25,
        pathTtlMs: 1000,
        extractionTtlMs: 500,
      },
    });
  }

  /**
   * Create high-performance extractor
   */
  static createHighPerformance(): Result<
    OptimizedPropertyExtractor,
    SchemaError & { message: string }
  > {
    return OptimizedPropertyExtractor.create({
      enablePathCache: true,
      enableExtractionCache: true,
      enableMetrics: true,
      maxConcurrentExtractions: 50,
      timeoutMs: 60000,
      pathCacheConfig: {
        maxSize: 5000,
        defaultTtl: 60 * 60 * 1000, // 1 hour
        enableMetrics: true,
        maxPathEntries: 5000,
        maxExtractionEntries: 2000,
        pathTtlMs: 60 * 60 * 1000, // 1 hour
        extractionTtlMs: 15 * 60 * 1000, // 15 minutes
      },
    });
  }
}
