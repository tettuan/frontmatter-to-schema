/**
 * Processing bounds for memory and resource management
 * Following DDD and Totality principles with discriminated unions
 */

import { ok, Result } from "./result.ts";
import { PerformanceError } from "./errors.ts";
import { ErrorHandler } from "../services/unified-error-handler.ts";

/**
 * Processing bounds discriminated union
 * Eliminates optional properties following Totality principles
 */
export type ProcessingBounds =
  | {
    readonly kind: "bounded";
    readonly memoryLimit: number; // bytes
    readonly fileLimit: number; // file count
    readonly timeLimit: number; // milliseconds
  }
  | {
    readonly kind: "unbounded";
  };

/**
 * Memory usage tracking during processing
 */
export interface MemoryUsage {
  readonly heapUsed: number;
  readonly heapTotal: number;
  readonly external: number;
  readonly rss: number;
}

/**
 * Processing resource state
 */
export type ProcessingState =
  | { readonly kind: "within_bounds"; readonly usage: MemoryUsage }
  | {
    readonly kind: "approaching_limit";
    readonly usage: MemoryUsage;
    readonly warningThreshold: number;
  }
  | {
    readonly kind: "exceeded_limit";
    readonly usage: MemoryUsage;
    readonly limit: number;
  };

/**
 * Smart constructor for ProcessingBounds following Totality principles
 */
export class ProcessingBoundsFactory {
  /**
   * Create bounded processing limits
   */
  static createBounded(
    memoryLimitMB: number,
    fileLimit: number,
    timeLimitSeconds: number,
  ): Result<ProcessingBounds, PerformanceError & { message: string }> {
    if (memoryLimitMB <= 0) {
      return ErrorHandler.performance({
        operation: "createBounded",
        method: "validateMemoryLimit",
      }).memoryBoundsExceeded(
        `Memory limit must be positive, got ${memoryLimitMB}MB`,
      );
    }

    if (fileLimit <= 0) {
      return ErrorHandler.performance({
        operation: "createBounded",
        method: "validateFileLimit",
      }).memoryBoundsExceeded(`File limit must be positive, got ${fileLimit}`);
    }

    if (timeLimitSeconds <= 0) {
      return ErrorHandler.performance({
        operation: "createBounded",
        method: "validateTimeLimit",
      }).memoryBoundsExceeded(
        `Time limit must be positive, got ${timeLimitSeconds}s`,
      );
    }

    return ok({
      kind: "bounded",
      memoryLimit: memoryLimitMB * 1024 * 1024, // Convert MB to bytes
      fileLimit,
      timeLimit: timeLimitSeconds * 1000, // Convert seconds to milliseconds
    });
  }

  /**
   * Create unbounded processing (use with caution)
   */
  static createUnbounded(): ProcessingBounds {
    return { kind: "unbounded" };
  }

  /**
   * Create default bounds based on dataset size following SLA targets
   */
  static createDefault(
    fileCount: number,
  ): Result<ProcessingBounds, PerformanceError & { message: string }> {
    if (fileCount < 0) {
      return ErrorHandler.performance({
        operation: "createDefault",
        method: "validateFileCount",
      }).memoryBoundsExceeded(
        `File count must be non-negative, got ${fileCount}`,
      );
    }

    // Special case: 0 files found - use unbounded processing (nothing to process)
    if (fileCount === 0) {
      return ok(ProcessingBoundsFactory.createUnbounded());
    }

    // Default bounds based on Issue #838 SLA targets (relaxed for practical usage)
    if (fileCount < 100) {
      // Small dataset: <10s, <500MB (relaxed for development/testing)
      return ProcessingBoundsFactory.createBounded(500, fileCount * 2, 10);
    } else if (fileCount < 1000) {
      // Medium dataset: <30s, <1GB
      return ProcessingBoundsFactory.createBounded(1024, fileCount * 2, 30);
    } else {
      // Large dataset: <120s, <2GB
      return ProcessingBoundsFactory.createBounded(2048, fileCount * 2, 120);
    }
  }
}

/**
 * Memory bounds monitor following Totality principles
 */
export class ProcessingBoundsMonitor {
  private constructor(
    private readonly bounds: ProcessingBounds,
    private readonly startTime: number,
    private readonly initialMemory: MemoryUsage,
  ) {}

  /**
   * Create bounds monitor
   */
  static create(bounds: ProcessingBounds): ProcessingBoundsMonitor {
    const startTime = performance.now();
    const initialMemory = ProcessingBoundsMonitor.getCurrentMemoryUsage();
    return new ProcessingBoundsMonitor(bounds, startTime, initialMemory);
  }

  /**
   * Check current processing state against bounds
   */
  checkState(filesProcessed: number): ProcessingState {
    const currentMemory = ProcessingBoundsMonitor.getCurrentMemoryUsage();

    switch (this.bounds.kind) {
      case "unbounded":
        return { kind: "within_bounds", usage: currentMemory };

      case "bounded": {
        const memoryUsed = currentMemory.heapUsed;
        const timeElapsed = performance.now() - this.startTime;

        // Check memory bounds
        if (memoryUsed > this.bounds.memoryLimit) {
          return {
            kind: "exceeded_limit",
            usage: currentMemory,
            limit: this.bounds.memoryLimit,
          };
        }

        // Check file count bounds
        if (filesProcessed > this.bounds.fileLimit) {
          return {
            kind: "exceeded_limit",
            usage: currentMemory,
            limit: this.bounds.fileLimit,
          };
        }

        // Check time bounds
        if (timeElapsed > this.bounds.timeLimit) {
          return {
            kind: "exceeded_limit",
            usage: currentMemory,
            limit: this.bounds.timeLimit,
          };
        }

        // Check if approaching limits (80% threshold)
        const memoryThreshold = this.bounds.memoryLimit * 0.8;
        if (memoryUsed > memoryThreshold) {
          return {
            kind: "approaching_limit",
            usage: currentMemory,
            warningThreshold: memoryThreshold,
          };
        }

        return { kind: "within_bounds", usage: currentMemory };
      }
    }
  }

  /**
   * Validate O(log n) memory growth constraint
   */
  validateMemoryGrowth(
    filesProcessed: number,
  ): Result<void, PerformanceError & { message: string }> {
    if (filesProcessed <= 1) {
      return ok(void 0); // Can't calculate growth with single data point
    }

    const currentMemory = ProcessingBoundsMonitor.getCurrentMemoryUsage();
    const memoryGrowth = currentMemory.heapUsed - this.initialMemory.heapUsed;

    // O(log n) growth: memory should not exceed baseMemory * log2(n) * growthFactor
    const expectedLogGrowth = Math.log2(filesProcessed) * (1024 * 1024); // 1MB per log2(n)

    if (memoryGrowth > expectedLogGrowth * 2) { // Allow 2x tolerance
      return ErrorHandler.performance({
        operation: "validateMemoryGrowth",
        method: "checkLogGrowthConstraint",
      }).memoryBoundsExceeded(
        `Memory growth ${
          Math.round(memoryGrowth / 1024 / 1024)
        }MB exceeds O(log n) target of ${
          Math.round(expectedLogGrowth / 1024 / 1024)
        }MB for ${filesProcessed} files`,
      );
    }

    return ok(void 0);
  }

  /**
   * Get processing bounds
   */
  getBounds(): ProcessingBounds {
    return this.bounds;
  }

  private static getCurrentMemoryUsage(): MemoryUsage {
    const deno_usage = Deno.memoryUsage();
    return {
      heapUsed: deno_usage.heapUsed,
      heapTotal: deno_usage.heapTotal,
      external: deno_usage.external,
      rss: deno_usage.rss,
    };
  }
}
