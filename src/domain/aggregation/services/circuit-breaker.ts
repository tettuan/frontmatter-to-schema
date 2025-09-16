import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";

export interface CircuitBreakerConfig {
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
    private readonly config: CircuitBreakerConfig = {
      maxComplexity: 10000,
      maxMemoryMB: 512,
      maxProcessingTimeMs: 60000,
      maxDatasetSize: 5000,
      cooldownPeriodMs: 30000,
    },
  ) {}

  canProcess(
    datasetSize: number,
    rulesCount: number,
  ): Result<boolean, AggregationError & { message: string }> {
    const complexity = datasetSize * rulesCount;

    if (this.state.status === "open") {
      const now = Date.now();
      const timeSinceFailure = now - (this.state.lastFailureTime || 0);

      if (timeSinceFailure < this.config.cooldownPeriodMs) {
        this.recordRejection();
        return err(createError({
          kind: "AggregationFailed",
          message: `Circuit breaker is open. Please wait ${
            Math.ceil((this.config.cooldownPeriodMs - timeSinceFailure) / 1000)
          } seconds before retrying.`,
        }));
      }

      this.state = { ...this.state, status: "half-open" };
    }

    if (datasetSize > this.config.maxDatasetSize) {
      this.recordRejection();
      return err(createError({
        kind: "AggregationFailed",
        message:
          `Dataset size ${datasetSize} exceeds maximum allowed ${this.config.maxDatasetSize}`,
      }));
    }

    if (complexity > this.config.maxComplexity) {
      this.recordRejection();
      return err(createError({
        kind: "AggregationFailed",
        message:
          `Processing complexity ${complexity} exceeds maximum allowed ${this.config.maxComplexity}`,
      }));
    }

    const currentMemoryMB = Math.round(
      Deno.memoryUsage().heapUsed / 1024 / 1024,
    );
    if (currentMemoryMB > this.config.maxMemoryMB * 0.8) {
      this.recordRejection();
      return err(createError({
        kind: "AggregationFailed",
        message:
          `Current memory usage ${currentMemoryMB}MB is too high (limit: ${this.config.maxMemoryMB}MB)`,
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
    const shouldOpen = newFailures >= 3 || this.state.status === "half-open";

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
    const maxBatchComplexity = this.config.maxComplexity * 0.5;

    if (complexity <= maxBatchComplexity) {
      return datasetSize;
    }

    const suggestedSize = Math.floor(maxBatchComplexity / rulesCount);
    return Math.max(1, Math.min(suggestedSize, 100));
  }
}
