import { ok, Result } from "../../shared/types/result.ts";
import { AggregationError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

/**
 * Domain configuration for circuit breaker settings
 * Eliminates hardcoded timeout and threshold values following DDD principles
 */
export interface CircuitBreakerThresholds {
  readonly maxComplexity: number;
  readonly maxMemoryMB: number;
  readonly maxProcessingTimeMs: number;
  readonly maxDatasetSize: number;
  readonly cooldownPeriodMs: number;
  readonly failureThreshold: number;
  readonly halfOpenRetryDelayMs: number;
}

/**
 * Circuit breaker configuration following Totality principles
 * Replaces hardcoded timeout values with proper domain abstractions
 */
export class CircuitBreakerConfig {
  private constructor(
    private readonly thresholds: CircuitBreakerThresholds,
    private readonly adaptiveScaling: boolean,
  ) {}

  /**
   * Smart constructor following Totality principles
   */
  static create(
    thresholds?: Partial<CircuitBreakerThresholds>,
    adaptiveScaling: boolean = false,
  ): Result<CircuitBreakerConfig, AggregationError & { message: string }> {
    const defaultThresholds: CircuitBreakerThresholds = {
      maxComplexity: 10000,
      maxMemoryMB: 512,
      maxProcessingTimeMs: 60000,
      maxDatasetSize: 5000,
      cooldownPeriodMs: 30000, // 30 seconds - now configurable
      failureThreshold: 5,
      halfOpenRetryDelayMs: 5000,
    };

    const finalThresholds: CircuitBreakerThresholds = {
      ...defaultThresholds,
      ...thresholds,
    };

    // Validate configuration (allow test scenarios with shorter cooldowns)
    if (finalThresholds.cooldownPeriodMs < 100) {
      return ErrorHandler.aggregation({
        operation: "create",
        method: "validateCooldownPeriod",
      }).invalidExpression(
        `cooldownPeriodMs: ${finalThresholds.cooldownPeriodMs}`,
      );
    }

    if (
      finalThresholds.maxProcessingTimeMs < finalThresholds.cooldownPeriodMs
    ) {
      return ErrorHandler.aggregation({
        operation: "create",
        method: "validateProcessingTime",
      }).invalidExpression(
        `maxProcessingTimeMs: ${finalThresholds.maxProcessingTimeMs}, cooldownPeriodMs: ${finalThresholds.cooldownPeriodMs}`,
      );
    }

    return ok(new CircuitBreakerConfig(finalThresholds, adaptiveScaling));
  }

  /**
   * Default configuration for standard processing
   */
  static forStandardProcessing(): Result<
    CircuitBreakerConfig,
    AggregationError & { message: string }
  > {
    return CircuitBreakerConfig.create();
  }

  /**
   * High-throughput configuration for intensive processing
   */
  static forHighThroughput(): Result<
    CircuitBreakerConfig,
    AggregationError & { message: string }
  > {
    return CircuitBreakerConfig.create({
      maxComplexity: 50000,
      maxMemoryMB: 1024,
      maxProcessingTimeMs: 120000,
      maxDatasetSize: 25000,
      cooldownPeriodMs: 60000, // 1 minute for high-load scenarios
      failureThreshold: 10,
      halfOpenRetryDelayMs: 10000,
    }, true);
  }

  /**
   * Low-latency configuration for quick processing
   */
  static forLowLatency(): Result<
    CircuitBreakerConfig,
    AggregationError & { message: string }
  > {
    return CircuitBreakerConfig.create({
      maxComplexity: 5000,
      maxMemoryMB: 256,
      maxProcessingTimeMs: 30000,
      maxDatasetSize: 2500,
      cooldownPeriodMs: 10000, // 10 seconds for quick recovery
      failureThreshold: 3,
      halfOpenRetryDelayMs: 2000,
    }, false);
  }

  /**
   * Get configured thresholds
   */
  getThresholds(): CircuitBreakerThresholds {
    return { ...this.thresholds };
  }

  /**
   * Get cooldown period in milliseconds
   */
  getCooldownPeriodMs(): number {
    return this.thresholds.cooldownPeriodMs;
  }

  /**
   * Get failure threshold
   */
  getFailureThreshold(): number {
    return this.thresholds.failureThreshold;
  }

  /**
   * Check if adaptive scaling is enabled
   */
  isAdaptiveScalingEnabled(): boolean {
    return this.adaptiveScaling;
  }

  /**
   * Calculate dynamic cooldown based on failure count (if adaptive scaling enabled)
   */
  calculateDynamicCooldown(failureCount: number): number {
    if (!this.adaptiveScaling) {
      return this.thresholds.cooldownPeriodMs;
    }

    // Exponential backoff with cap
    const baseCooldown = this.thresholds.cooldownPeriodMs;
    const multiplier = Math.min(Math.pow(2, failureCount), 8); // Cap at 8x
    return Math.min(baseCooldown * multiplier, 5 * 60 * 1000); // Cap at 5 minutes
  }
}
