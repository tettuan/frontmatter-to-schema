import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

/**
 * Variance metrics value object following Totality principles
 * Encapsulates variance-related measurements with proper validation
 */
export class VarianceMetrics {
  private constructor(
    readonly memoryVariancePct: number,
    readonly throughputVariancePct: number,
    readonly errorRecoveryTimeMs: number,
  ) {}

  /**
   * Smart constructor for VarianceMetrics
   * Validates all variance parameters and returns Result type
   */
  static create(
    memoryVariancePct: number,
    throughputVariancePct: number,
    errorRecoveryTimeMs: number,
  ): Result<VarianceMetrics, ValidationError & { message: string }> {
    // Validate memory variance percentage
    if (memoryVariancePct < 0 || memoryVariancePct > 1000) {
      return err(createError({
        kind: "OutOfRange",
        field: "memoryVariancePct",
        value: memoryVariancePct,
        min: 0,
        max: 1000,
        message: "Memory variance percentage must be between 0% and 1000%",
      }));
    }

    // Validate throughput variance percentage
    if (throughputVariancePct < 0 || throughputVariancePct > 1000) {
      return err(createError({
        kind: "OutOfRange",
        field: "throughputVariancePct",
        value: throughputVariancePct,
        min: 0,
        max: 1000,
        message: "Throughput variance percentage must be between 0% and 1000%",
      }));
    }

    // Validate error recovery time
    if (errorRecoveryTimeMs < 0 || errorRecoveryTimeMs > 60000) {
      return err(createError({
        kind: "OutOfRange",
        field: "errorRecoveryTimeMs",
        value: errorRecoveryTimeMs,
        min: 0,
        max: 60000,
        message: "Error recovery time must be between 0ms and 60 seconds",
      }));
    }

    return ok(
      new VarianceMetrics(
        memoryVariancePct,
        throughputVariancePct,
        errorRecoveryTimeMs,
      ),
    );
  }

  /**
   * Calculate variance improvement compared to baseline
   */
  calculateImprovements(baseline: {
    memoryVariancePct: number;
    throughputVariancePct: number;
    errorRecoveryTimeMs: number;
  }): {
    memoryVarianceReduction: number;
    throughputVarianceReduction: number;
    errorRecoveryImprovement: string;
  } {
    return {
      memoryVarianceReduction: baseline.memoryVariancePct -
        this.memoryVariancePct,
      throughputVarianceReduction: baseline.throughputVariancePct -
        this.throughputVariancePct,
      errorRecoveryImprovement: baseline.errorRecoveryTimeMs === 0
        ? `finite: ${this.errorRecoveryTimeMs}ms`
        : `improved: ${
          baseline.errorRecoveryTimeMs - this.errorRecoveryTimeMs
        }ms`,
    };
  }

  /**
   * Check if variance levels are acceptable
   */
  isAcceptable(thresholds: {
    maxMemoryVariancePct: number;
    maxThroughputVariancePct: number;
    maxErrorRecoveryTimeMs: number;
  }): boolean {
    return this.memoryVariancePct <= thresholds.maxMemoryVariancePct &&
      this.throughputVariancePct <= thresholds.maxThroughputVariancePct &&
      this.errorRecoveryTimeMs <= thresholds.maxErrorRecoveryTimeMs;
  }

  /**
   * Get variance summary for logging
   */
  toLogSummary(): Record<string, unknown> {
    return {
      memoryVariancePct: this.memoryVariancePct,
      throughputVariancePct: this.throughputVariancePct,
      errorRecoveryTimeMs: this.errorRecoveryTimeMs,
    };
  }
}
