import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";
import { CircuitBreakerConfig } from "../value-objects/circuit-breaker-config.ts";

/**
 * Circuit breaker configuration state using discriminated union for enhanced type safety
 * Follows Totality principles by eliminating optional dependencies
 */
export type CircuitBreakerConfigurationState =
  | { readonly kind: "disabled" }
  | { readonly kind: "standard"; readonly config: CircuitBreakerConfig }
  | { readonly kind: "high-throughput"; readonly config: CircuitBreakerConfig }
  | { readonly kind: "low-latency"; readonly config: CircuitBreakerConfig }
  | { readonly kind: "custom"; readonly config: CircuitBreakerConfig };

/**
 * Factory for creating CircuitBreakerConfigurationState instances following Totality principles
 */
export class CircuitBreakerFactory {
  /**
   * Create disabled circuit breaker state - no circuit breaking applied
   */
  static createDisabled(): CircuitBreakerConfigurationState {
    return { kind: "disabled" };
  }

  /**
   * Create standard circuit breaker state with default configuration
   */
  static createStandard(): CircuitBreakerConfigurationState {
    return {
      kind: "standard",
      config: CircuitBreakerConfig.forStandardProcessing(),
    };
  }

  /**
   * Create high-throughput circuit breaker state for intensive processing
   */
  static createHighThroughput(): CircuitBreakerConfigurationState {
    return {
      kind: "high-throughput",
      config: CircuitBreakerConfig.forHighThroughput(),
    };
  }

  /**
   * Create low-latency circuit breaker state for quick processing
   */
  static createLowLatency(): CircuitBreakerConfigurationState {
    return {
      kind: "low-latency",
      config: CircuitBreakerConfig.forLowLatency(),
    };
  }

  /**
   * Create custom circuit breaker state with explicit configuration
   */
  static createCustom(
    config: CircuitBreakerConfig,
  ): CircuitBreakerConfigurationState {
    return {
      kind: "custom",
      config,
    };
  }
}

// Legacy interface for backward compatibility - will be removed in next version
export interface LegacyCircuitBreakerConfig {
  readonly maxComplexity: number;
  readonly maxMemoryMB: number;
  readonly maxProcessingTimeMs: number;
  readonly maxDatasetSize: number;
  readonly cooldownPeriodMs: number;
}

export type CircuitBreakerState =
  | {
    kind: "closed";
    failures: number;
    metrics: CircuitBreakerMetrics;
    lastSuccessTime: number | null;
  }
  | {
    kind: "open";
    failures: number;
    lastFailureTime: number;
    metrics: CircuitBreakerMetrics;
  }
  | {
    kind: "half-open";
    failures: number;
    lastFailureTime: number;
    metrics: CircuitBreakerMetrics;
  };

export interface CircuitBreakerMetrics {
  readonly totalAttempts: number;
  readonly successfulAttempts: number;
  readonly failedAttempts: number;
  readonly rejectedAttempts: number;
  readonly averageProcessingTime: number;
  readonly peakMemoryUsage: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    kind: "closed",
    failures: 0,
    lastSuccessTime: null,
    metrics: {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      rejectedAttempts: 0,
      averageProcessingTime: 0,
      peakMemoryUsage: 0,
    },
  };

  constructor(
    config?: CircuitBreakerConfig | LegacyCircuitBreakerConfig,
  ) {
    if (!config) {
      this.config = CircuitBreakerConfig.forStandardProcessing();
    } else if ("getThresholds" in config) {
      // New CircuitBreakerConfig
      this.config = config;
    } else {
      // Legacy configuration - convert to new format
      const result = CircuitBreakerConfig.create({
        maxComplexity: config.maxComplexity,
        maxMemoryMB: config.maxMemoryMB,
        maxProcessingTimeMs: config.maxProcessingTimeMs,
        maxDatasetSize: config.maxDatasetSize,
        cooldownPeriodMs: config.cooldownPeriodMs,
      });
      if (!result.ok) {
        throw new Error(
          `Invalid legacy configuration: ${result.error.message}`,
        );
      }
      this.config = result.data;
    }
  }

  private readonly config: CircuitBreakerConfig;

  canProcess(
    datasetSize: number,
    rulesCount: number,
  ): Result<boolean, AggregationError & { message: string }> {
    const complexity = datasetSize * rulesCount;

    if (this.state.kind === "open") {
      const now = Date.now();
      const timeSinceFailure = now - this.state.lastFailureTime;
      const cooldownPeriod = this.config.calculateDynamicCooldown(
        this.state.failures,
      );

      if (timeSinceFailure < cooldownPeriod) {
        this.recordRejection();
        return err(createError({
          kind: "AggregationFailed",
          message: `Circuit breaker is open. Please wait ${
            Math.ceil((cooldownPeriod - timeSinceFailure) / 1000)
          } seconds before retrying.`,
        }));
      }

      this.state = {
        kind: "half-open",
        failures: this.state.failures,
        lastFailureTime: this.state.lastFailureTime,
        metrics: this.state.metrics,
      };
    }

    const thresholds = this.config.getThresholds();

    if (datasetSize > thresholds.maxDatasetSize) {
      this.recordRejection();
      return err(createError({
        kind: "AggregationFailed",
        message:
          `Dataset size ${datasetSize} exceeds maximum allowed ${thresholds.maxDatasetSize}`,
      }));
    }

    if (complexity > thresholds.maxComplexity) {
      this.recordRejection();
      return err(createError({
        kind: "AggregationFailed",
        message:
          `Processing complexity ${complexity} exceeds maximum allowed ${thresholds.maxComplexity}`,
      }));
    }

    const currentMemoryMB = Math.round(
      Deno.memoryUsage().heapUsed / 1024 / 1024,
    );
    if (currentMemoryMB > thresholds.maxMemoryMB * 0.8) {
      this.recordRejection();
      return err(createError({
        kind: "AggregationFailed",
        message:
          `Current memory usage ${currentMemoryMB}MB is too high (limit: ${thresholds.maxMemoryMB}MB)`,
      }));
    }

    return ok(true);
  }

  recordSuccess(processingTimeMs: number, memoryUsedMB: number): void {
    const metrics = this.state.metrics;
    const newTotalAttempts = metrics.totalAttempts + 1;
    const newSuccessfulAttempts = metrics.successfulAttempts + 1;

    const newAverageTime = (
      (metrics.averageProcessingTime * metrics.successfulAttempts) +
      processingTimeMs
    ) / newSuccessfulAttempts;

    this.state = {
      kind: "closed",
      failures: 0,
      lastSuccessTime: Date.now(),
      metrics: {
        ...metrics,
        totalAttempts: newTotalAttempts,
        successfulAttempts: newSuccessfulAttempts,
        averageProcessingTime: newAverageTime,
        peakMemoryUsage: Math.max(metrics.peakMemoryUsage, memoryUsedMB),
      },
    };
  }

  recordFailure(_reason: string): void {
    const metrics = this.state.metrics;
    const newFailures = this.state.failures + 1;
    const failureThreshold = this.config.getFailureThreshold();
    const shouldOpen = newFailures >= failureThreshold ||
      this.state.kind === "half-open";
    const now = Date.now();

    if (shouldOpen) {
      this.state = {
        kind: "open",
        failures: newFailures,
        lastFailureTime: now,
        metrics: {
          ...metrics,
          totalAttempts: metrics.totalAttempts + 1,
          failedAttempts: metrics.failedAttempts + 1,
        },
      };
    } else {
      // Stay in current state but update data
      switch (this.state.kind) {
        case "closed": {
          this.state = {
            kind: "closed",
            failures: newFailures,
            lastSuccessTime: this.state.lastSuccessTime,
            metrics: {
              ...metrics,
              totalAttempts: metrics.totalAttempts + 1,
              failedAttempts: metrics.failedAttempts + 1,
            },
          };
          break;
        }
        case "open": {
          this.state = {
            kind: "open",
            failures: newFailures,
            lastFailureTime: this.state.lastFailureTime,
            metrics: {
              ...metrics,
              totalAttempts: metrics.totalAttempts + 1,
              failedAttempts: metrics.failedAttempts + 1,
            },
          };
          break;
        }
        case "half-open": {
          // This case should not happen due to shouldOpen logic above
          this.state = {
            kind: "half-open",
            failures: newFailures,
            lastFailureTime: this.state.lastFailureTime,
            metrics: {
              ...metrics,
              totalAttempts: metrics.totalAttempts + 1,
              failedAttempts: metrics.failedAttempts + 1,
            },
          };
          break;
        }
      }
    }
  }

  private recordRejection(): void {
    const metrics = this.state.metrics;
    const newMetrics = {
      ...metrics,
      totalAttempts: metrics.totalAttempts + 1,
      rejectedAttempts: metrics.rejectedAttempts + 1,
    };

    switch (this.state.kind) {
      case "closed": {
        this.state = {
          kind: "closed",
          failures: this.state.failures,
          lastSuccessTime: this.state.lastSuccessTime,
          metrics: newMetrics,
        };
        break;
      }
      case "open": {
        this.state = {
          kind: "open",
          failures: this.state.failures,
          lastFailureTime: this.state.lastFailureTime,
          metrics: newMetrics,
        };
        break;
      }
      case "half-open": {
        this.state = {
          kind: "half-open",
          failures: this.state.failures,
          lastFailureTime: this.state.lastFailureTime,
          metrics: newMetrics,
        };
        break;
      }
    }
  }

  getState(): {
    status: "closed" | "open" | "half-open";
    failures: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    metrics: CircuitBreakerMetrics;
  } {
    // Backwards compatibility: provide the old interface shape for existing consumers
    switch (this.state.kind) {
      case "closed": {
        return {
          status: "closed" as const,
          failures: this.state.failures,
          lastFailureTime: undefined,
          lastSuccessTime: this.state.lastSuccessTime ?? undefined,
          metrics: this.state.metrics,
        };
      }
      case "open": {
        return {
          status: "open" as const,
          failures: this.state.failures,
          lastFailureTime: this.state.lastFailureTime,
          lastSuccessTime: undefined,
          metrics: this.state.metrics,
        };
      }
      case "half-open": {
        return {
          status: "half-open" as const,
          failures: this.state.failures,
          lastFailureTime: this.state.lastFailureTime,
          lastSuccessTime: undefined,
          metrics: this.state.metrics,
        };
      }
    }
  }

  reset(): void {
    this.state = {
      kind: "closed",
      failures: 0,
      lastSuccessTime: null,
      metrics: {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        rejectedAttempts: 0,
        averageProcessingTime: 0,
        peakMemoryUsage: 0,
      },
    };
  }

  suggestBatchSize(datasetSize: number, rulesCount: number): number {
    const complexity = datasetSize * rulesCount;
    const thresholds = this.config.getThresholds();
    const maxBatchComplexity = thresholds.maxComplexity * 0.5;

    if (complexity <= maxBatchComplexity) {
      return datasetSize;
    }

    const suggestedSize = Math.floor(maxBatchComplexity / rulesCount);
    return Math.max(1, Math.min(suggestedSize, 100));
  }
}
