import { PerformanceMetrics } from "../value-objects/performance-metrics.ts";
import { VarianceMetrics } from "../value-objects/variance-metrics.ts";

/**
 * Monitoring report entity following DDD principles
 * Encapsulates the complete monitoring state and metrics
 */
export class MonitoringReport {
  private constructor(
    readonly id: string,
    readonly timestamp: Date,
    readonly performanceMetrics: PerformanceMetrics,
    readonly varianceMetrics: VarianceMetrics,
    readonly executionTimeMs: number,
    readonly memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    },
  ) {}

  /**
   * Factory method to create monitoring report
   */
  static create(
    performanceMetrics: PerformanceMetrics,
    varianceMetrics: VarianceMetrics,
    executionTimeMs: number,
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    },
  ): MonitoringReport {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    return new MonitoringReport(
      id,
      timestamp,
      performanceMetrics,
      varianceMetrics,
      executionTimeMs,
      memoryUsage,
    );
  }

  /**
   * Calculate total memory usage in MB
   */
  getTotalMemoryUsageMB(): number {
    return Math.floor(
      (this.memoryUsage.heapUsed + this.memoryUsage.external) / 1024 / 1024,
    );
  }

  /**
   * Get comprehensive summary for logging
   */
  toLogSummary(): Record<string, unknown> {
    return {
      reportId: this.id,
      timestamp: this.timestamp.toISOString(),
      executionTimeMs: this.executionTimeMs,
      totalMemoryUsageMB: this.getTotalMemoryUsageMB(),
      performance: this.performanceMetrics.toLogSummary(),
      variance: this.varianceMetrics.toLogSummary(),
    };
  }

  /**
   * Check if the monitoring report indicates acceptable performance
   */
  isPerformanceAcceptable(thresholds: {
    maxExecutionTimeMs: number;
    maxMemoryUsageMB: number;
    maxMemoryVariancePct: number;
    maxThroughputVariancePct: number;
    maxErrorRecoveryTimeMs: number;
  }): boolean {
    return this.executionTimeMs <= thresholds.maxExecutionTimeMs &&
      this.getTotalMemoryUsageMB() <= thresholds.maxMemoryUsageMB &&
      this.varianceMetrics.isAcceptable({
        maxMemoryVariancePct: thresholds.maxMemoryVariancePct,
        maxThroughputVariancePct: thresholds.maxThroughputVariancePct,
        maxErrorRecoveryTimeMs: thresholds.maxErrorRecoveryTimeMs,
      });
  }
}
