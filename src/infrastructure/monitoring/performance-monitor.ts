/**
 * Performance Monitor Infrastructure for Issue #904
 *
 * Provides comprehensive performance monitoring, metrics collection, and reporting
 * Integrates with enhanced error context for rich diagnostic information
 * Follows DDD principles with proper domain separation
 */

import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { PerformanceError } from "../../domain/shared/types/errors.ts";
import {
  EnhancedErrorContext,
  EnhancedErrorContextFactory,
  SystemContext as _SystemContext,
} from "../../domain/shared/types/enhanced-error-context.ts";

/**
 * Performance measurement point
 */
export interface PerformanceMeasurement {
  readonly id: string;
  readonly operation: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly memoryStart?: number;
  readonly memoryEnd?: number;
  readonly memoryDelta?: number;
  readonly metadata: Record<string, unknown>;
  readonly timeoutId?: number;
  readonly success: boolean;
  readonly errorInfo?: string;
}

/**
 * Performance report aggregating multiple measurements
 */
export interface PerformanceReport {
  readonly timeframe: {
    readonly start: number;
    readonly end: number;
    readonly duration: number;
  };
  readonly summary: {
    readonly totalOperations: number;
    readonly successfulOperations: number;
    readonly failedOperations: number;
    readonly successRate: number;
    readonly totalDuration: number;
    readonly averageDuration: number;
    readonly minDuration: number;
    readonly maxDuration: number;
    readonly p95Duration: number;
    readonly p99Duration: number;
  };
  readonly memory: {
    readonly peakUsage: number;
    readonly averageUsage: number;
    readonly totalAllocated: number;
    readonly totalFreed: number;
  };
  readonly operations: Record<string, {
    readonly count: number;
    readonly averageDuration: number;
    readonly successRate: number;
  }>;
  readonly measurements: PerformanceMeasurement[];
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitorConfig {
  readonly enabled: boolean;
  readonly maxMeasurements: number;
  readonly enableMemoryTracking: boolean;
  readonly enableAutoReporting: boolean;
  readonly reportIntervalMs: number;
  readonly operationTimeoutMs: number;
  readonly enableDetailed: boolean;
}

/**
 * Performance Monitor for comprehensive performance tracking
 */
export class PerformanceMonitor {
  private readonly config: PerformanceMonitorConfig;
  private readonly measurements: PerformanceMeasurement[] = [];
  private readonly activeMeasurements = new Map<
    string,
    PerformanceMeasurement
  >();
  private readonly operationCounts = new Map<string, number>();
  private reportInterval?: number;
  private startTime: number;

  private constructor(config: PerformanceMonitorConfig) {
    this.config = config;
    this.startTime = performance.now();

    if (config.enableAutoReporting && config.reportIntervalMs > 0) {
      this.startAutoReporting();
    }
  }

  /**
   * Smart Constructor for PerformanceMonitor
   */
  static create(
    config: Partial<PerformanceMonitorConfig> = {},
  ): Result<PerformanceMonitor, PerformanceError & { message: string }> {
    const validatedConfig: PerformanceMonitorConfig = {
      enabled: config.enabled ?? true,
      maxMeasurements: config.maxMeasurements ?? 10000,
      enableMemoryTracking: config.enableMemoryTracking ?? true,
      enableAutoReporting: config.enableAutoReporting ?? false,
      reportIntervalMs: config.reportIntervalMs ?? 60000, // 1 minute
      operationTimeoutMs: config.operationTimeoutMs ?? 300000, // 5 minutes
      enableDetailed: config.enableDetailed ?? true,
    };

    // Validate configuration
    if (
      validatedConfig.maxMeasurements < 100 ||
      validatedConfig.maxMeasurements > 100000
    ) {
      return err({
        kind: "PerformanceViolation",
        content: "Max measurements must be between 100 and 100,000",
        message: "Invalid performance monitor configuration",
      });
    }

    if (
      validatedConfig.reportIntervalMs < 1000 ||
      validatedConfig.reportIntervalMs > 3600000
    ) {
      return err({
        kind: "PerformanceViolation",
        content: "Report interval must be between 1 second and 1 hour",
        message: "Invalid report interval configuration",
      });
    }

    return ok(new PerformanceMonitor(validatedConfig));
  }

  /**
   * Start measuring a performance operation
   */
  startMeasurement(
    operation: string,
    metadata: Record<string, unknown> = {},
  ): Result<string, PerformanceError> {
    if (!this.config.enabled) {
      return ok("disabled");
    }

    const id = this.generateMeasurementId(operation);
    const startTime = performance.now();
    const memoryStart = this.config.enableMemoryTracking
      ? this.getCurrentMemoryUsage()
      : undefined;

    let timeoutId: number | undefined;

    // Set up timeout if configured
    if (this.config.operationTimeoutMs > 0) {
      timeoutId = setTimeout(() => {
        if (this.activeMeasurements.has(id)) {
          this.completeMeasurement(id, false, "Operation timeout");
        }
      }, this.config.operationTimeoutMs);
    }

    const measurement: PerformanceMeasurement = {
      id,
      operation,
      startTime,
      memoryStart,
      metadata: { ...metadata },
      success: false, // Will be updated on completion
      timeoutId,
    };

    this.activeMeasurements.set(id, measurement);
    this.updateOperationCount(operation);

    return ok(id);
  }

  /**
   * Complete a performance measurement
   */
  completeMeasurement(
    measurementId: string,
    success: boolean = true,
    errorInfo?: string,
  ): Result<PerformanceMeasurement, PerformanceError> {
    if (!this.config.enabled || measurementId === "disabled") {
      return ok({
        id: "disabled",
        operation: "disabled",
        startTime: 0,
        success: true,
        metadata: {},
      });
    }

    const activeMeasurement = this.activeMeasurements.get(measurementId);
    if (!activeMeasurement) {
      return err({
        kind: "PerformanceViolation",
        content: `Measurement not found: ${measurementId}`,
        message: "Invalid measurement ID",
      });
    }

    const endTime = performance.now();
    const duration = endTime - activeMeasurement.startTime;
    const memoryEnd = this.config.enableMemoryTracking
      ? this.getCurrentMemoryUsage()
      : undefined;
    const memoryDelta = activeMeasurement.memoryStart && memoryEnd
      ? memoryEnd - activeMeasurement.memoryStart
      : undefined;

    // Clear timeout if it exists
    if (activeMeasurement.timeoutId !== undefined) {
      clearTimeout(activeMeasurement.timeoutId);
    }

    const completedMeasurement: PerformanceMeasurement = {
      ...activeMeasurement,
      endTime,
      duration,
      memoryEnd,
      memoryDelta,
      success,
      errorInfo,
      timeoutId: undefined, // Clear the timeout ID
    };

    this.activeMeasurements.delete(measurementId);
    this.addMeasurement(completedMeasurement);

    return ok(completedMeasurement);
  }

  /**
   * Measure an async operation with automatic completion
   */
  async measureAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata: Record<string, unknown> = {},
  ): Promise<
    Result<T, PerformanceError & { enhancedContext?: EnhancedErrorContext }>
  > {
    const measurementResult = this.startMeasurement(operation, metadata);
    if (!measurementResult.ok) {
      return err({
        ...measurementResult.error,
        enhancedContext: undefined,
      });
    }

    const measurementId = measurementResult.data;

    try {
      const result = await fn();
      this.completeMeasurement(measurementId, true);
      return ok(result);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      this.completeMeasurement(measurementId, false, errorMessage);

      // Create enhanced error context
      const contextResult = EnhancedErrorContextFactory.forSchemaOperation(
        operation,
        "performance measurement",
        "measureAsync",
      );

      return err({
        kind: "PipelineExecutionError",
        content: `Operation '${operation}' failed: ${errorMessage}`,
        message: `Performance measurement failed for operation: ${operation}`,
        enhancedContext: contextResult.ok ? contextResult.data : undefined,
      });
    }
  }

  /**
   * Measure a synchronous operation with automatic completion
   */
  measureSync<T>(
    operation: string,
    fn: () => T,
    metadata: Record<string, unknown> = {},
  ): Result<T, PerformanceError & { enhancedContext?: EnhancedErrorContext }> {
    const measurementResult = this.startMeasurement(operation, metadata);
    if (!measurementResult.ok) {
      return err({
        ...measurementResult.error,
        enhancedContext: undefined,
      });
    }

    const measurementId = measurementResult.data;

    try {
      const result = fn();
      this.completeMeasurement(measurementId, true);
      return ok(result);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      this.completeMeasurement(measurementId, false, errorMessage);

      // Create enhanced error context
      const contextResult = EnhancedErrorContextFactory.forSchemaOperation(
        operation,
        "performance measurement",
        "measureSync",
      );

      return err({
        kind: "PipelineExecutionError",
        content: `Operation '${operation}' failed: ${errorMessage}`,
        message: `Performance measurement failed for operation: ${operation}`,
        enhancedContext: contextResult.ok ? contextResult.data : undefined,
      });
    }
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(timeframeMs?: number): PerformanceReport {
    const now = performance.now();
    const reportStart = timeframeMs ? now - timeframeMs : this.startTime;
    const relevantMeasurements = this.measurements.filter(
      (m) => m.startTime >= reportStart && m.endTime !== undefined,
    );

    if (relevantMeasurements.length === 0) {
      return this.createEmptyReport(reportStart, now);
    }

    // Calculate summary statistics
    const durations = relevantMeasurements
      .map((m) => m.duration!)
      .filter((d) => d !== undefined)
      .sort((a, b) => a - b);

    const successfulOps = relevantMeasurements.filter((m) => m.success);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    // Memory statistics
    const memoryUsages = relevantMeasurements
      .map((m) => m.memoryEnd)
      .filter((m) => m !== undefined) as number[];

    const memoryDeltas = relevantMeasurements
      .map((m) => m.memoryDelta)
      .filter((m) => m !== undefined) as number[];

    // Operation-specific statistics
    const operationStats: Record<string, any> = {};
    for (const measurement of relevantMeasurements) {
      if (!operationStats[measurement.operation]) {
        operationStats[measurement.operation] = {
          measurements: [],
          successes: 0,
        };
      }
      operationStats[measurement.operation].measurements.push(measurement);
      if (measurement.success) {
        operationStats[measurement.operation].successes++;
      }
    }

    // Calculate operation summaries
    const operations: Record<string, any> = {};
    for (const [op, stats] of Object.entries(operationStats)) {
      const opDurations = stats.measurements
        .map((m: PerformanceMeasurement) => m.duration!)
        .filter((d: number) => d !== undefined);

      operations[op] = {
        count: stats.measurements.length,
        averageDuration: opDurations.length > 0
          ? opDurations.reduce((sum: number, d: number) => sum + d, 0) /
            opDurations.length
          : 0,
        successRate: stats.measurements.length > 0
          ? stats.successes / stats.measurements.length
          : 0,
      };
    }

    return {
      timeframe: {
        start: reportStart,
        end: now,
        duration: now - reportStart,
      },
      summary: {
        totalOperations: relevantMeasurements.length,
        successfulOperations: successfulOps.length,
        failedOperations: relevantMeasurements.length - successfulOps.length,
        successRate: relevantMeasurements.length > 0
          ? successfulOps.length / relevantMeasurements.length
          : 0,
        totalDuration,
        averageDuration: durations.length > 0
          ? totalDuration / durations.length
          : 0,
        minDuration: durations.length > 0 ? durations[0] : 0,
        maxDuration: durations.length > 0 ? durations[durations.length - 1] : 0,
        p95Duration: durations.length > 0 ? durations[p95Index] : 0,
        p99Duration: durations.length > 0 ? durations[p99Index] : 0,
      },
      memory: {
        peakUsage: memoryUsages.length > 0 ? Math.max(...memoryUsages) : 0,
        averageUsage: memoryUsages.length > 0
          ? memoryUsages.reduce((sum, u) => sum + u, 0) / memoryUsages.length
          : 0,
        totalAllocated: memoryDeltas.filter((d) => d > 0).reduce(
          (sum, d) => sum + d,
          0,
        ),
        totalFreed: Math.abs(
          memoryDeltas.filter((d) => d < 0).reduce((sum, d) => sum + d, 0),
        ),
      },
      operations,
      measurements: this.config.enableDetailed ? relevantMeasurements : [],
    };
  }

  /**
   * Check if performance goals are being met
   */
  checkPerformanceGoals(): {
    fileProcessingTime: { target: number; actual: number; passed: boolean };
    memoryUsage: { target: number; actual: number; passed: boolean };
    batchProcessing: { target: number; actual: number; passed: boolean };
  } {
    const report = this.generateReport(60000); // Last minute

    // Issue #904 goals: 1000 files in 10s, memory <500MB, single file <10ms
    const fileProcessingTime = {
      target: 10, // 10ms per file
      actual: report.summary.averageDuration,
      passed: report.summary.averageDuration <= 10,
    };

    const memoryUsage = {
      target: 500 * 1024 * 1024, // 500MB
      actual: report.memory.peakUsage,
      passed: report.memory.peakUsage <= 500 * 1024 * 1024,
    };

    const batchProcessing = {
      target: 10000, // 10s for 1000 files = 10ms average
      actual: report.summary.averageDuration,
      passed: report.summary.averageDuration <= 10,
    };

    return {
      fileProcessingTime,
      memoryUsage,
      batchProcessing,
    };
  }

  /**
   * Clear measurements and reset monitor
   */
  reset(): void {
    // Clear any active timeouts first
    for (const [, measurement] of this.activeMeasurements) {
      if (measurement.timeoutId !== undefined) {
        clearTimeout(measurement.timeoutId);
      }
    }

    this.measurements.length = 0;
    this.activeMeasurements.clear();
    this.operationCounts.clear();
    this.startTime = performance.now();
  }

  /**
   * Get current performance statistics
   */
  getStats(): {
    totalMeasurements: number;
    activeMeasurements: number;
    memoryUsage: number;
    uptime: number;
  } {
    return {
      totalMeasurements: this.measurements.length,
      activeMeasurements: this.activeMeasurements.size,
      memoryUsage: this.getCurrentMemoryUsage(),
      uptime: performance.now() - this.startTime,
    };
  }

  /**
   * Dispose of the monitor and clean up resources
   */
  dispose(): void {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = undefined;
    }

    // Clear any active timeouts
    for (const [, measurement] of this.activeMeasurements) {
      if (measurement.timeoutId !== undefined) {
        clearTimeout(measurement.timeoutId);
      }
    }

    this.measurements.length = 0;
    this.activeMeasurements.clear();
    this.operationCounts.clear();
  }

  /**
   * Start automatic reporting
   */
  private startAutoReporting(): void {
    this.reportInterval = setInterval(() => {
      const report = this.generateReport();
      console.log("Performance Report:", JSON.stringify(report, null, 2));
    }, this.config.reportIntervalMs);
  }

  /**
   * Add measurement to history with size management
   */
  private addMeasurement(measurement: PerformanceMeasurement): void {
    this.measurements.push(measurement);

    // Manage memory by removing old measurements
    if (this.measurements.length > this.config.maxMeasurements) {
      const toRemove = this.measurements.length - this.config.maxMeasurements;
      this.measurements.splice(0, toRemove);
    }
  }

  /**
   * Generate unique measurement ID
   */
  private generateMeasurementId(operation: string): string {
    const count = this.operationCounts.get(operation) || 0;
    return `${operation}_${Date.now()}_${count}`;
  }

  /**
   * Update operation count for ID generation
   */
  private updateOperationCount(operation: string): void {
    const current = this.operationCounts.get(operation) || 0;
    this.operationCounts.set(operation, current + 1);
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    try {
      if (typeof Deno !== "undefined" && Deno.memoryUsage) {
        return Deno.memoryUsage().heapUsed;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Create empty report structure
   */
  private createEmptyReport(start: number, end: number): PerformanceReport {
    return {
      timeframe: { start, end, duration: end - start },
      summary: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        successRate: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
      },
      memory: {
        peakUsage: 0,
        averageUsage: 0,
        totalAllocated: 0,
        totalFreed: 0,
      },
      operations: {},
      measurements: [],
    };
  }
}

/**
 * Performance Monitor Factory
 */
export class PerformanceMonitorFactory {
  /**
   * Create standard performance monitor
   */
  static create(
    config?: Partial<PerformanceMonitorConfig>,
  ): Result<PerformanceMonitor, PerformanceError & { message: string }> {
    return PerformanceMonitor.create(config);
  }

  /**
   * Create performance monitor for testing
   */
  static createForTesting(): Result<
    PerformanceMonitor,
    PerformanceError & { message: string }
  > {
    return PerformanceMonitor.create({
      enabled: true,
      maxMeasurements: 100,
      enableMemoryTracking: true,
      enableAutoReporting: false,
      enableDetailed: true,
      operationTimeoutMs: 5000,
    });
  }

  /**
   * Create high-performance monitor for production
   */
  static createHighPerformance(): Result<
    PerformanceMonitor,
    PerformanceError & { message: string }
  > {
    return PerformanceMonitor.create({
      enabled: true,
      maxMeasurements: 50000,
      enableMemoryTracking: true,
      enableAutoReporting: true,
      reportIntervalMs: 300000, // 5 minutes
      enableDetailed: false,
      operationTimeoutMs: 300000, // 5 minutes
    });
  }
}
