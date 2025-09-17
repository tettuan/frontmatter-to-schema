import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";
import { CircuitBreakerConfig } from "../value-objects/circuit-breaker-config.ts";

// Legacy interface for backward compatibility - will be removed in next version
export interface LegacyCircuitBreakerConfig {
  readonly maxComplexity: number;
  readonly maxMemoryMB: number;
  readonly maxProcessingTimeMs: number;
  readonly maxDatasetSize: number;
  readonly cooldownPeriodMs: number;
}

export interface CircuitBreakerState {
  readonly status: "closed" | "open" | "half-open";
  readonly failures: number;
  readonly lastFailureTime?: number;
  readonly lastSuccessTime?: number;
  readonly metrics: CircuitBreakerMetrics;
}

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
    status: "closed",
    failures: 0,
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

    if (this.state.status === "open") {
      const now = Date.now();
      const timeSinceFailure = now - (this.state.lastFailureTime || 0);
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

      this.state = { ...this.state, status: "half-open" };
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
      status: "closed",
      failures: 0,
      lastSuccessTime: Date.now(),
      lastFailureTime: this.state.lastFailureTime,
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
      this.state.status === "half-open";

    this.state = {
      status: shouldOpen ? "open" : this.state.status,
      failures: newFailures,
      lastFailureTime: Date.now(),
      lastSuccessTime: this.state.lastSuccessTime,
      metrics: {
        ...metrics,
        totalAttempts: metrics.totalAttempts + 1,
        failedAttempts: metrics.failedAttempts + 1,
      },
    };
  }

  private recordRejection(): void {
    const metrics = this.state.metrics;
    this.state = {
      ...this.state,
      metrics: {
        ...metrics,
        totalAttempts: metrics.totalAttempts + 1,
        rejectedAttempts: metrics.rejectedAttempts + 1,
      },
    };
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      status: "closed",
      failures: 0,
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
