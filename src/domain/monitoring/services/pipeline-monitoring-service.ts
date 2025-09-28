import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { PerformanceMetrics } from "../value-objects/performance-metrics.ts";
import { VarianceMetrics } from "../value-objects/variance-metrics.ts";
import { MonitoringReport } from "../entities/monitoring-report.ts";
import {
  MonitoringState,
  MonitoringStateFactory,
  MonitoringStateGuards,
} from "../types/monitoring-state.ts";
import { PipelineStrategyConfig } from "../../pipeline/value-objects/pipeline-strategy-config.ts";

/**
 * Pipeline monitoring service following DDD and Totality principles
 * Handles performance monitoring and variance analysis for pipeline execution
 */
export class PipelineMonitoringService {
  private state: MonitoringState;

  private constructor(initialState: MonitoringState) {
    this.state = initialState;
  }

  /**
   * Smart constructor for PipelineMonitoringService
   * Follows Totality principles by returning Result<T,E>
   */
  static create(): Result<
    PipelineMonitoringService,
    DomainError & { message: string }
  > {
    try {
      const initialMemory = Deno.memoryUsage();
      const initialState = MonitoringStateFactory.createInitializing(
        initialMemory,
      );

      return ok(new PipelineMonitoringService(initialState));
    } catch (error) {
      return err(createError({
        kind: "InitializationError",
        message: `Failed to create PipelineMonitoringService: ${error}`,
      }));
    }
  }

  /**
   * Start monitoring with strategy configuration
   */
  startMonitoring(
    strategyConfig: PipelineStrategyConfig,
  ): Result<PerformanceMetrics, DomainError & { message: string }> {
    if (!MonitoringStateGuards.isInitializing(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot start monitoring from state: ${this.state.kind}. Expected: initializing`,
      }));
    }

    const _thresholds = strategyConfig.getPerformanceThresholds();
    const memoryBudgetMB = Math.floor(
      this.state.initialMemory.heapTotal / 1024 / 1024 * 0.8,
    );

    const performanceMetricsResult = PerformanceMetrics.create(
      strategyConfig.getProcessingStrategy(),
      strategyConfig.getConcurrencyLevel(),
      memoryBudgetMB,
      60000, // 60 second timeout
      strategyConfig.getMemoryStrategy(),
      strategyConfig.isAdaptiveScalingEnabled(),
    );

    if (!performanceMetricsResult.ok) {
      this.state = MonitoringStateFactory.createFailed(
        performanceMetricsResult.error,
        "performance-metrics-creation",
      );
      return err(performanceMetricsResult.error);
    }

    this.state = MonitoringStateFactory.createCollecting(
      performanceMetricsResult.data,
      this.state.startTime,
    );

    return ok(performanceMetricsResult.data);
  }

  /**
   * Analyze variance metrics
   */
  analyzeVariance(
    strategyConfig: PipelineStrategyConfig,
  ): Result<VarianceMetrics, DomainError & { message: string }> {
    if (!MonitoringStateGuards.isCollecting(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot analyze variance from state: ${this.state.kind}. Expected: collecting`,
      }));
    }

    const _thresholds = strategyConfig.getPerformanceThresholds();

    const varianceMetricsResult = VarianceMetrics.create(
      _thresholds.maxMemoryVariancePct,
      _thresholds.maxThroughputVariancePct,
      _thresholds.maxErrorRecoveryTimeMs,
    );

    if (!varianceMetricsResult.ok) {
      this.state = MonitoringStateFactory.createFailed(
        varianceMetricsResult.error,
        "variance-metrics-creation",
      );
      return err(varianceMetricsResult.error);
    }

    this.state = MonitoringStateFactory.createAnalyzing(
      this.state.metrics,
      varianceMetricsResult.data,
      this.state.startTime,
    );

    return ok(varianceMetricsResult.data);
  }

  /**
   * Generate monitoring report
   */
  generateReport(): Result<
    MonitoringReport,
    DomainError & { message: string }
  > {
    if (!MonitoringStateGuards.isAnalyzing(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot generate report from state: ${this.state.kind}. Expected: analyzing`,
      }));
    }

    try {
      const currentMemory = Deno.memoryUsage();
      const executionTimeMs = performance.now() - this.state.startTime;

      const report = MonitoringReport.create(
        this.state.metrics,
        this.state.variance,
        executionTimeMs,
        currentMemory,
      );

      this.state = MonitoringStateFactory.createReporting(report);

      return ok(report);
    } catch (error) {
      const domainError = createError({
        kind: "PipelineExecutionError",
        content: `Failed to generate monitoring report: ${error}`,
      });
      this.state = MonitoringStateFactory.createFailed(
        domainError,
        "report-generation",
      );
      return err(domainError);
    }
  }

  /**
   * Complete monitoring and get final report
   */
  complete(): Result<MonitoringReport, DomainError & { message: string }> {
    if (!MonitoringStateGuards.isReporting(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot complete monitoring from state: ${this.state.kind}. Expected: reporting`,
      }));
    }

    const duration = performance.now() - performance.now(); // This would need the actual start time
    this.state = MonitoringStateFactory.createCompleted(
      this.state.report,
      duration,
    );

    if (MonitoringStateGuards.isCompleted(this.state)) {
      return ok(this.state.report);
    }
    return err(createError({
      kind: "ConfigurationError",
      message: "Monitoring state is not completed",
    }));
  }

  /**
   * Get current monitoring state
   */
  getCurrentState(): MonitoringState {
    return this.state;
  }

  /**
   * Check if monitoring is in a completed state
   */
  isCompleted(): boolean {
    return MonitoringStateGuards.isCompleted(this.state) ||
      MonitoringStateGuards.isFailed(this.state);
  }

  /**
   * Get monitoring summary for logging
   */
  getMonitoringSummary(): Record<string, unknown> {
    switch (this.state.kind) {
      case "initializing":
        return {
          state: "initializing",
          startTime: this.state.startTime,
          initialMemoryMB: Math.floor(
            this.state.initialMemory.heapUsed / 1024 / 1024,
          ),
        };

      case "collecting":
        return {
          state: "collecting",
          performance: this.state.metrics.toLogSummary(),
          elapsedMs: performance.now() - this.state.startTime,
        };

      case "analyzing":
        return {
          state: "analyzing",
          performance: this.state.metrics.toLogSummary(),
          variance: this.state.variance.toLogSummary(),
          elapsedMs: performance.now() - this.state.startTime,
        };

      case "reporting":
        return {
          state: "reporting",
          report: this.state.report.toLogSummary(),
        };

      case "completed":
        return {
          state: "completed",
          report: this.state.report.toLogSummary(),
          totalDuration: this.state.duration,
        };

      case "failed":
        return {
          state: "failed",
          error: this.state.error.kind,
          failedStage: this.state.stage,
        };
    }
  }
}
