/**
 * Memory monitoring utilities for performance testing
 *
 * Provides Deno-specific memory usage tracking following Totality principles
 * Returns Result<T,E> for all monitoring operations
 */

import { err, ok, Result } from "../../src/domain/shared/types/result.ts";
import { DomainError } from "../../src/domain/shared/types/errors.ts";

export interface MemorySnapshot {
  readonly rss: number; // Resident Set Size
  readonly heapTotal: number; // Total heap size
  readonly heapUsed: number; // Used heap size
  readonly external: number; // External memory usage
  readonly timestamp: number; // When measurement was taken
}

export interface MemoryDelta {
  readonly rssDelta: number;
  readonly heapDelta: number;
  readonly externalDelta: number;
  readonly duration: number;
}

export type MemoryResult = Result<
  MemorySnapshot,
  DomainError & { message: string }
>;
export type MemoryDeltaResult = Result<
  MemoryDelta,
  DomainError & { message: string }
>;

export class MemoryMonitor {
  /**
   * Capture current memory usage
   * Total function - always returns Result, never throws
   */
  capture(): MemoryResult {
    try {
      const memUsage = Deno.memoryUsage();

      return ok({
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        timestamp: performance.now(),
      });
    } catch (error) {
      return err({
        kind: "MemoryMonitorError" as const,
        content: "Failed to capture memory usage",
        message: `Memory capture failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Calculate memory delta between two snapshots
   * Total function - validates inputs and returns meaningful errors
   */
  calculateDelta(
    before: MemorySnapshot,
    after: MemorySnapshot,
  ): MemoryDeltaResult {
    if (after.timestamp <= before.timestamp) {
      return err({
        kind: "InvalidMemoryComparison" as const,
        content: "After timestamp must be greater than before timestamp",
        message:
          "Invalid memory comparison: timestamps are not in chronological order",
      });
    }

    return ok({
      rssDelta: after.rss - before.rss,
      heapDelta: after.heapUsed - before.heapUsed,
      externalDelta: after.external - before.external,
      duration: after.timestamp - before.timestamp,
    });
  }

  /**
   * Validate memory usage against target bounds
   */
  validateBounds(
    snapshot: MemorySnapshot,
    maxMemory: number,
  ): Result<void, DomainError & { message: string }> {
    const totalUsage = snapshot.heapUsed + snapshot.external;

    if (totalUsage > maxMemory) {
      return err({
        kind: "MemoryBoundsViolation" as const,
        content:
          `Memory usage ${totalUsage} bytes exceeds limit ${maxMemory} bytes`,
        message:
          `Memory bounds violation: current usage exceeds maximum allowed`,
      });
    }

    return ok(void 0);
  }

  /**
   * Monitor memory usage during async operation
   * Returns both the operation result and memory delta
   */
  async monitor<T, E>(
    operation: () => Promise<Result<T, E>>,
  ): Promise<
    Result<
      { result: Result<T, E>; memoryDelta: MemoryDelta },
      DomainError & { message: string }
    >
  > {
    const beforeResult = this.capture();
    if (!beforeResult.ok) {
      return err(beforeResult.error);
    }

    const operationResult = await operation();

    const afterResult = this.capture();
    if (!afterResult.ok) {
      return err(afterResult.error);
    }

    const deltaResult = this.calculateDelta(
      beforeResult.data,
      afterResult.data,
    );
    if (!deltaResult.ok) {
      return err(deltaResult.error);
    }

    return ok({
      result: operationResult,
      memoryDelta: deltaResult.data,
    });
  }

  /**
   * Format memory size for human-readable output
   */
  formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Check if memory growth pattern indicates potential leak
   * Analyzes multiple snapshots to detect concerning trends
   */
  analyzeGrowthPattern(
    snapshots: MemorySnapshot[],
  ): Result<
    { isHealthy: boolean; growthRate: number },
    DomainError & { message: string }
  > {
    if (snapshots.length < 3) {
      return err({
        kind: "InsufficientData" as const,
        content: "Need at least 3 snapshots for growth analysis",
        message: "Cannot analyze growth pattern with insufficient data points",
      });
    }

    const deltas = [];
    for (let i = 1; i < snapshots.length; i++) {
      const deltaResult = this.calculateDelta(snapshots[i - 1], snapshots[i]);
      if (!deltaResult.ok) {
        return err(deltaResult.error);
      }
      deltas.push(deltaResult.data.heapDelta);
    }

    // Calculate average growth rate
    const avgGrowth = deltas.reduce((sum, delta) => sum + delta, 0) /
      deltas.length;
    const growthRate = avgGrowth /
      (snapshots[snapshots.length - 1].timestamp - snapshots[0].timestamp);

    // Consider healthy if growth rate is less than 1MB per second
    const isHealthy = Math.abs(growthRate) < 1024 * 1024;

    return ok({ isHealthy, growthRate });
  }
}
