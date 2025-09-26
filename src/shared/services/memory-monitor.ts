/**
 * @fileoverview Memory Monitor for Debug Information
 * @description Provides memory usage tracking and debugging capabilities
 * Following DDD, TDD, and Totality principles
 */

import type { DomainLogger } from "../../domain/shared/interfaces/domain-logger.ts";
import {
  LogContext,
  LogMessages,
} from "../../domain/shared/interfaces/domain-logger.ts";

/**
 * DDD-Compliant Memory Monitor Debug Logger
 * Environment-controlled memory monitoring using domain logger abstraction
 */
class MemoryDebugLogger {
  private static logger?: DomainLogger;
  private static logContext?: LogContext;

  static initialize(logger: DomainLogger): void {
    this.logger = logger;
    const contextResult = LogContext.create(
      "shared",
      "memory-monitoring",
      "memory-monitor",
    );
    if (contextResult.ok) {
      this.logContext = contextResult.data;
    }
  }

  private static isEnabled(
    level: "error" | "warn" | "info" | "debug" | "verbose" = "debug",
  ): boolean {
    const debugLevel = Deno.env.get("DEBUG_LEVEL") || "none";
    const debugComponents = Deno.env.get("DEBUG_COMPONENTS")?.split(",") || [];

    if (debugLevel === "none") return false;
    if (debugComponents.length > 0 && !debugComponents.includes("memory")) {
      return false;
    }

    const levelPriority = { error: 0, warn: 1, info: 2, debug: 3, verbose: 4 };
    const currentPriority =
      levelPriority[debugLevel as keyof typeof levelPriority] ?? 0;
    const messagePriority = levelPriority[level];

    return messagePriority <= currentPriority;
  }

  static log(
    level: "error" | "warn" | "info" | "debug" | "verbose",
    message: string,
    data?: unknown,
  ): void {
    if (!this.isEnabled(level) || !this.logger || !this.logContext) return;

    const outputFormat = Deno.env.get("DEBUG_OUTPUT_FORMAT") || "plain";

    if (outputFormat === "json") {
      const structuredData = {
        timestamp: new Date().toISOString(),
        level,
        component: "memory",
        message,
        data,
      };
      this.logger.logStructured(this.logContext, structuredData);
    } else {
      const prefix = `[${level.toUpperCase()}] [MEMORY] ${message}`;
      if (data) {
        this.logger.logTrace(
          this.logContext,
          LogMessages.trace(prefix, data),
        );
      } else {
        this.logger.logDebug(
          this.logContext,
          LogMessages.debug(prefix),
        );
      }
    }
  }

  static error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  static warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  static info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  static debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  static verbose(message: string, data?: unknown): void {
    this.log("verbose", message, data);
  }
}

/**
 * Memory Usage Information
 */
export interface MemoryUsage {
  /** Resident Set Size in MB */
  readonly rss: number;
  /** Heap total in MB */
  readonly heapTotal: number;
  /** Heap used in MB */
  readonly heapUsed: number;
  /** External memory in MB */
  readonly external: number;
  /** Timestamp of measurement */
  readonly timestamp: string;
}

/**
 * Memory Monitor Configuration
 */
export interface MemoryMonitorConfig {
  /** Memory threshold in MB for warnings */
  readonly warningThreshold: number;
  /** Memory threshold in MB for critical alerts */
  readonly criticalThreshold: number;
  /** Enable automatic memory snapshots */
  readonly enableSnapshots: boolean;
  /** Interval for automatic monitoring in milliseconds */
  readonly monitoringInterval?: number;
}

/**
 * Memory Monitor Service
 *
 * Provides comprehensive memory usage monitoring with configurable thresholds
 * and automatic alerting for memory issues that cause processing variance.
 */
export class MemoryMonitor {
  private readonly config: MemoryMonitorConfig;
  private readonly initialMemory: MemoryUsage;
  private readonly snapshots: MemoryUsage[] = [];
  private monitoringTimer?: number;

  constructor(
    config: Partial<MemoryMonitorConfig> = {},
    logger?: DomainLogger,
  ) {
    this.config = {
      warningThreshold: 50,
      criticalThreshold: 100,
      enableSnapshots: true,
      ...config,
    };

    if (logger) {
      MemoryDebugLogger.initialize(logger);
    }

    this.initialMemory = this.getCurrentMemoryUsage();

    MemoryDebugLogger.info("Memory monitor initialized", {
      config: this.config,
      initialMemory: this.initialMemory,
    });

    if (this.config.monitoringInterval) {
      this.startContinuousMonitoring();
    }
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage(): MemoryUsage {
    try {
      const usage = Deno.memoryUsage();

      return {
        rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
        external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      MemoryDebugLogger.error("Failed to get memory usage", { error });

      // Fallback values
      return {
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Log memory usage at a specific processing step
   */
  logMemoryUsage(step: string): MemoryUsage {
    const currentMemory = this.getCurrentMemoryUsage();
    const difference = currentMemory.rss - this.initialMemory.rss;
    const percentageIncrease = Math.round(
      (difference / this.initialMemory.rss) * 100,
    );

    const memoryInfo = {
      step,
      current: currentMemory,
      initial: this.initialMemory,
      difference,
      percentageIncrease,
    };

    // Determine log level based on memory usage
    if (currentMemory.rss >= this.config.criticalThreshold) {
      MemoryDebugLogger.error(
        `Critical memory usage detected at ${step}`,
        memoryInfo,
      );
    } else if (currentMemory.rss >= this.config.warningThreshold) {
      MemoryDebugLogger.warn(
        `High memory usage detected at ${step}`,
        memoryInfo,
      );
    } else {
      MemoryDebugLogger.debug(`Memory usage at ${step}`, {
        step,
        rss: currentMemory.rss,
        difference,
        percentageIncrease,
      });
    }

    if (this.config.enableSnapshots) {
      this.snapshots.push(currentMemory);
    }

    return currentMemory;
  }

  /**
   * Check for memory spikes that could cause processing variance
   */
  checkMemorySpike(
    previousMemory: MemoryUsage,
    currentMemory: MemoryUsage,
    step: string,
  ): boolean {
    const spike = currentMemory.rss - previousMemory.rss;
    const spikeThreshold = 20; // 20MB spike threshold

    if (spike > spikeThreshold) {
      MemoryDebugLogger.warn(`Memory spike detected at ${step}`, {
        step,
        previousMemory: previousMemory.rss,
        currentMemory: currentMemory.rss,
        spike,
        spikeThreshold,
      });
      return true;
    }

    return false;
  }

  /**
   * Analyze memory usage patterns for variance detection
   */
  analyzeMemoryPattern(): {
    averageUsage: number;
    maxUsage: number;
    minUsage: number;
    variance: number;
    spikes: number;
  } {
    if (this.snapshots.length < 2) {
      MemoryDebugLogger.warn(
        "Insufficient memory snapshots for pattern analysis",
        {
          snapshotCount: this.snapshots.length,
        },
      );
      return {
        averageUsage: this.initialMemory.rss,
        maxUsage: this.initialMemory.rss,
        minUsage: this.initialMemory.rss,
        variance: 0,
        spikes: 0,
      };
    }

    const usageValues = this.snapshots.map((s) => s.rss);
    const maxUsage = Math.max(...usageValues);
    const minUsage = Math.min(...usageValues);
    const averageUsage = usageValues.reduce((sum, val) => sum + val, 0) /
      usageValues.length;

    // Calculate variance
    const squaredDifferences = usageValues.map((val) =>
      Math.pow(val - averageUsage, 2)
    );
    const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) /
      usageValues.length;

    // Count memory spikes (20MB+ sudden increases)
    let spikes = 0;
    for (let i = 1; i < this.snapshots.length; i++) {
      if (this.snapshots[i].rss - this.snapshots[i - 1].rss > 20) {
        spikes++;
      }
    }

    const analysis = {
      averageUsage: Math.round(averageUsage * 100) / 100,
      maxUsage,
      minUsage,
      variance: Math.round(variance * 100) / 100,
      spikes,
    };

    MemoryDebugLogger.info("Memory pattern analysis completed", {
      snapshotCount: this.snapshots.length,
      analysis,
    });

    return analysis;
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection(): void {
    try {
      // Note: Deno doesn't expose gc() directly, but we can attempt it
      if (typeof (globalThis as any).gc === "function") {
        (globalThis as any).gc();
        MemoryDebugLogger.info("Forced garbage collection executed");
      } else {
        MemoryDebugLogger.warn("Garbage collection not available");
      }
    } catch (error) {
      MemoryDebugLogger.error("Failed to force garbage collection", { error });
    }
  }

  /**
   * Start continuous memory monitoring
   */
  private startContinuousMonitoring(): void {
    if (!this.config.monitoringInterval) return;

    MemoryDebugLogger.info("Starting continuous memory monitoring", {
      interval: this.config.monitoringInterval,
    });

    this.monitoringTimer = setInterval(() => {
      this.logMemoryUsage("continuous-monitoring");
    }, this.config.monitoringInterval);
  }

  /**
   * Stop continuous memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
      MemoryDebugLogger.info("Continuous memory monitoring stopped");
    }
  }

  /**
   * Get memory monitoring summary
   */
  getSummary(): {
    config: MemoryMonitorConfig;
    initialMemory: MemoryUsage;
    currentMemory: MemoryUsage;
    totalSnapshots: number;
    pattern: {
      averageUsage: number;
      maxUsage: number;
      minUsage: number;
      variance: number;
      spikes: number;
    };
  } {
    return {
      config: this.config,
      initialMemory: this.initialMemory,
      currentMemory: this.getCurrentMemoryUsage(),
      totalSnapshots: this.snapshots.length,
      pattern: this.analyzeMemoryPattern(),
    };
  }

  /**
   * Dispose of the memory monitor
   */
  dispose(): void {
    this.stopMonitoring();
    this.snapshots.length = 0;
    MemoryDebugLogger.info("Memory monitor disposed");
  }
}
