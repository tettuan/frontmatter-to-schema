import { PerformanceMetrics } from "../value-objects/performance-metrics.ts";
import { VarianceMetrics } from "../value-objects/variance-metrics.ts";
import { MonitoringReport } from "../entities/monitoring-report.ts";
import { DomainError } from "../../shared/types/errors.ts";

/**
 * Monitoring state using discriminated union for type safety
 * Follows Totality principles by making all states explicit
 */
export type MonitoringState =
  | {
    readonly kind: "initializing";
    readonly startTime: number;
    readonly initialMemory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
  }
  | {
    readonly kind: "collecting";
    readonly metrics: PerformanceMetrics;
    readonly startTime: number;
  }
  | {
    readonly kind: "analyzing";
    readonly metrics: PerformanceMetrics;
    readonly variance: VarianceMetrics;
    readonly startTime: number;
  }
  | {
    readonly kind: "reporting";
    readonly report: MonitoringReport;
  }
  | {
    readonly kind: "completed";
    readonly report: MonitoringReport;
    readonly duration: number;
  }
  | {
    readonly kind: "failed";
    readonly error: DomainError;
    readonly stage: string;
  };

/**
 * Factory for creating MonitoringState instances following Totality principles
 */
export class MonitoringStateFactory {
  /**
   * Create initializing state with performance snapshot
   */
  static createInitializing(
    initialMemory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    },
  ): MonitoringState {
    return {
      kind: "initializing",
      startTime: performance.now(),
      initialMemory,
    };
  }

  /**
   * Create collecting state with performance metrics
   */
  static createCollecting(
    metrics: PerformanceMetrics,
    startTime: number,
  ): MonitoringState {
    return {
      kind: "collecting",
      metrics,
      startTime,
    };
  }

  /**
   * Create analyzing state with variance metrics
   */
  static createAnalyzing(
    metrics: PerformanceMetrics,
    variance: VarianceMetrics,
    startTime: number,
  ): MonitoringState {
    return {
      kind: "analyzing",
      metrics,
      variance,
      startTime,
    };
  }

  /**
   * Create reporting state with complete report
   */
  static createReporting(report: MonitoringReport): MonitoringState {
    return {
      kind: "reporting",
      report,
    };
  }

  /**
   * Create completed state with final report and duration
   */
  static createCompleted(
    report: MonitoringReport,
    duration: number,
  ): MonitoringState {
    return {
      kind: "completed",
      report,
      duration,
    };
  }

  /**
   * Create failed state with error information
   */
  static createFailed(error: DomainError, stage: string): MonitoringState {
    return {
      kind: "failed",
      error,
      stage,
    };
  }
}

/**
 * Type guard functions for monitoring state
 */
export class MonitoringStateGuards {
  static isInitializing(
    state: MonitoringState,
  ): state is Extract<MonitoringState, { kind: "initializing" }> {
    return state.kind === "initializing";
  }

  static isCollecting(
    state: MonitoringState,
  ): state is Extract<MonitoringState, { kind: "collecting" }> {
    return state.kind === "collecting";
  }

  static isAnalyzing(
    state: MonitoringState,
  ): state is Extract<MonitoringState, { kind: "analyzing" }> {
    return state.kind === "analyzing";
  }

  static isReporting(
    state: MonitoringState,
  ): state is Extract<MonitoringState, { kind: "reporting" }> {
    return state.kind === "reporting";
  }

  static isCompleted(
    state: MonitoringState,
  ): state is Extract<MonitoringState, { kind: "completed" }> {
    return state.kind === "completed";
  }

  static isFailed(
    state: MonitoringState,
  ): state is Extract<MonitoringState, { kind: "failed" }> {
    return state.kind === "failed";
  }
}
