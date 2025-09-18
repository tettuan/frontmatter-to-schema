import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

/**
 * Performance metrics value object following Totality principles
 * Encapsulates performance-related measurements with proper validation
 */
export class PerformanceMetrics {
  private constructor(
    readonly processingMode: string,
    readonly expectedConcurrency: number,
    readonly memoryBudgetMB: number,
    readonly timeoutMs: number,
    readonly memoryStrategy: string,
    readonly adaptiveScaling: boolean,
  ) {}

  /**
   * Smart constructor for PerformanceMetrics
   * Validates all input parameters and returns Result type
   */
  static create(
    processingMode: string,
    expectedConcurrency: number,
    memoryBudgetMB: number,
    timeoutMs: number,
    memoryStrategy: string,
    adaptiveScaling: boolean,
  ): Result<PerformanceMetrics, ValidationError & { message: string }> {
    // Validate processing mode
    if (!processingMode || processingMode.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "processingMode",
        message: "Processing mode cannot be empty",
      }));
    }

    // Validate concurrency level
    if (expectedConcurrency < 1 || expectedConcurrency > 32) {
      return err(createError({
        kind: "OutOfRange",
        field: "expectedConcurrency",
        value: expectedConcurrency,
        min: 1,
        max: 32,
        message: "Expected concurrency must be between 1 and 32",
      }));
    }

    // Validate memory budget
    if (memoryBudgetMB < 1 || memoryBudgetMB > 8192) {
      return err(createError({
        kind: "OutOfRange",
        field: "memoryBudgetMB",
        value: memoryBudgetMB,
        min: 1,
        max: 8192,
        message: "Memory budget must be between 1MB and 8GB",
      }));
    }

    // Validate timeout
    if (timeoutMs < 1000 || timeoutMs > 300000) {
      return err(createError({
        kind: "OutOfRange",
        field: "timeoutMs",
        value: timeoutMs,
        min: 1000,
        max: 300000,
        message: "Timeout must be between 1 second and 5 minutes",
      }));
    }

    // Validate memory strategy
    if (!memoryStrategy || memoryStrategy.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "memoryStrategy",
        message: "Memory strategy cannot be empty",
      }));
    }

    return ok(
      new PerformanceMetrics(
        processingMode,
        expectedConcurrency,
        memoryBudgetMB,
        timeoutMs,
        memoryStrategy,
        adaptiveScaling,
      ),
    );
  }

  /**
   * Calculate memory variance risk level based on budget
   */
  calculateMemoryVarianceRisk(): "low" | "medium" | "high" {
    if (this.memoryBudgetMB < 100) return "high";
    if (this.memoryBudgetMB < 500) return "medium";
    return "low";
  }

  /**
   * Get performance summary for logging
   */
  toLogSummary(): Record<string, unknown> {
    return {
      processingMode: this.processingMode,
      expectedConcurrency: this.expectedConcurrency,
      memoryBudgetMB: this.memoryBudgetMB,
      timeoutMs: this.timeoutMs,
      memoryStrategy: this.memoryStrategy,
      adaptiveScaling: this.adaptiveScaling,
      memoryVarianceRisk: this.calculateMemoryVarianceRisk(),
    };
  }
}
