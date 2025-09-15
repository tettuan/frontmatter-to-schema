/**
 * Unit tests for MemoryMonitor performance utility
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - MemoryMonitor class methods
 * - Memory snapshot capture
 * - Memory delta calculations
 * - Memory bounds validation
 * - Memory growth pattern analysis
 * - Error handling and edge cases
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  MemoryMonitor,
  MemorySnapshot,
} from "../../performance/memory-monitor.ts";
import { ok } from "../../../src/domain/shared/types/result.ts";

describe("MemoryMonitor", () => {
  const monitor = new MemoryMonitor();

  describe("capture", () => {
    it("should capture current memory usage successfully", () => {
      // Act
      const result = monitor.capture();

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const snapshot = result.data;
      assertExists(snapshot.rss);
      assertExists(snapshot.heapTotal);
      assertExists(snapshot.heapUsed);
      assertExists(snapshot.external);
      assertExists(snapshot.timestamp);

      // Memory values should be positive numbers
      assertEquals(snapshot.rss >= 0, true);
      assertEquals(snapshot.heapTotal >= 0, true);
      assertEquals(snapshot.heapUsed >= 0, true);
      assertEquals(snapshot.external >= 0, true);
      assertEquals(snapshot.timestamp > 0, true);
    });

    it("should capture different timestamps on consecutive calls", async () => {
      // Act
      const result1 = monitor.capture();
      await new Promise((resolve) => setTimeout(resolve, 1)); // Small delay
      const result2 = monitor.capture();

      // Assert
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (!result1.ok || !result2.ok) return;

      assertEquals(result2.data.timestamp > result1.data.timestamp, true);
    });
  });

  describe("calculateDelta", () => {
    it("should calculate memory delta correctly", () => {
      // Arrange
      const before: MemorySnapshot = {
        rss: 1000,
        heapTotal: 500,
        heapUsed: 300,
        external: 100,
        timestamp: 1000,
      };

      const after: MemorySnapshot = {
        rss: 1200,
        heapTotal: 600,
        heapUsed: 400,
        external: 150,
        timestamp: 2000,
      };

      // Act
      const result = monitor.calculateDelta(before, after);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const delta = result.data;
      assertEquals(delta.rssDelta, 200);
      assertEquals(delta.heapDelta, 100);
      assertEquals(delta.externalDelta, 50);
      assertEquals(delta.duration, 1000);
    });

    it("should handle negative memory deltas", () => {
      // Arrange - Memory can decrease (garbage collection)
      const before: MemorySnapshot = {
        rss: 1200,
        heapTotal: 600,
        heapUsed: 400,
        external: 150,
        timestamp: 1000,
      };

      const after: MemorySnapshot = {
        rss: 1000,
        heapTotal: 500,
        heapUsed: 300,
        external: 100,
        timestamp: 2000,
      };

      // Act
      const result = monitor.calculateDelta(before, after);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const delta = result.data;
      assertEquals(delta.rssDelta, -200);
      assertEquals(delta.heapDelta, -100);
      assertEquals(delta.externalDelta, -50);
      assertEquals(delta.duration, 1000);
    });

    it("should reject invalid timestamp order", () => {
      // Arrange - After timestamp is before or equal to before timestamp
      const before: MemorySnapshot = {
        rss: 1000,
        heapTotal: 500,
        heapUsed: 300,
        external: 100,
        timestamp: 2000,
      };

      const after: MemorySnapshot = {
        rss: 1200,
        heapTotal: 600,
        heapUsed: 400,
        external: 150,
        timestamp: 1000, // Earlier timestamp
      };

      // Act
      const result = monitor.calculateDelta(before, after);

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "InvalidMemoryComparison");
      if (result.error.kind === "InvalidMemoryComparison") {
        assertEquals(
          result.error.content,
          "After timestamp must be greater than before timestamp",
        );
      }
    });

    it("should reject equal timestamps", () => {
      // Arrange
      const before: MemorySnapshot = {
        rss: 1000,
        heapTotal: 500,
        heapUsed: 300,
        external: 100,
        timestamp: 1000,
      };

      const after: MemorySnapshot = {
        rss: 1200,
        heapTotal: 600,
        heapUsed: 400,
        external: 150,
        timestamp: 1000, // Same timestamp
      };

      // Act
      const result = monitor.calculateDelta(before, after);

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "InvalidMemoryComparison");
    });
  });

  describe("validateBounds", () => {
    it("should pass validation when memory is within bounds", () => {
      // Arrange
      const snapshot: MemorySnapshot = {
        rss: 1000,
        heapTotal: 500,
        heapUsed: 300,
        external: 100,
        timestamp: 1000,
      };
      const maxMemory = 500; // heapUsed (300) + external (100) = 400 < 500

      // Act
      const result = monitor.validateBounds(snapshot, maxMemory);

      // Assert
      assertEquals(result.ok, true);
    });

    it("should reject when memory exceeds bounds", () => {
      // Arrange
      const snapshot: MemorySnapshot = {
        rss: 1000,
        heapTotal: 500,
        heapUsed: 300,
        external: 100,
        timestamp: 1000,
      };
      const maxMemory = 350; // heapUsed (300) + external (100) = 400 > 350

      // Act
      const result = monitor.validateBounds(snapshot, maxMemory);

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "MemoryBoundsViolation");
      if (result.error.kind === "MemoryBoundsViolation") {
        assertEquals(
          result.error.content,
          "Memory usage 400 bytes exceeds limit 350 bytes",
        );
      }
    });

    it("should handle exact boundary case", () => {
      // Arrange
      const snapshot: MemorySnapshot = {
        rss: 1000,
        heapTotal: 500,
        heapUsed: 300,
        external: 100,
        timestamp: 1000,
      };
      const maxMemory = 400; // heapUsed (300) + external (100) = 400 == 400

      // Act
      const result = monitor.validateBounds(snapshot, maxMemory);

      // Assert
      assertEquals(result.ok, true); // Equal should pass
    });
  });

  describe("monitor", () => {
    it("should monitor async operation successfully", async () => {
      // Arrange
      const asyncOperation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return ok("operation completed");
      };

      // Act
      const result = await monitor.monitor(asyncOperation);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.result.ok, true);
      if (!result.data.result.ok) return;
      assertEquals(result.data.result.data, "operation completed");

      assertExists(result.data.memoryDelta);
      assertEquals(typeof result.data.memoryDelta.duration, "number");
      assertEquals(result.data.memoryDelta.duration >= 0, true);
    });

    it("should handle operation errors while still providing memory data", async () => {
      // Arrange
      const failingOperation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ok: false as const, error: { message: "operation failed" } };
      };

      // Act
      const result = await monitor.monitor(failingOperation);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.result.ok, false);
      assertExists(result.data.memoryDelta);
      assertEquals(typeof result.data.memoryDelta.duration, "number");
    });
  });

  describe("formatBytes", () => {
    it("should format bytes correctly", () => {
      assertEquals(monitor.formatBytes(0), "0.00 B");
      assertEquals(monitor.formatBytes(512), "512.00 B");
      assertEquals(monitor.formatBytes(1024), "1.00 KB");
      assertEquals(monitor.formatBytes(1536), "1.50 KB");
      assertEquals(monitor.formatBytes(1024 * 1024), "1.00 MB");
      assertEquals(monitor.formatBytes(1.5 * 1024 * 1024), "1.50 MB");
      assertEquals(monitor.formatBytes(1024 * 1024 * 1024), "1.00 GB");
    });

    it("should handle very large numbers", () => {
      const result = monitor.formatBytes(2.5 * 1024 * 1024 * 1024);
      assertEquals(result, "2.50 GB");
    });

    it("should handle fractional bytes", () => {
      const result = monitor.formatBytes(1536.7);
      assertEquals(result, "1.50 KB");
    });
  });

  describe("analyzeGrowthPattern", () => {
    it("should analyze healthy memory growth pattern", () => {
      // Arrange - Small, stable growth
      const snapshots: MemorySnapshot[] = [
        {
          rss: 1000,
          heapTotal: 500,
          heapUsed: 300,
          external: 100,
          timestamp: 1000,
        },
        {
          rss: 1010,
          heapTotal: 510,
          heapUsed: 305,
          external: 105,
          timestamp: 2000,
        },
        {
          rss: 1020,
          heapTotal: 520,
          heapUsed: 310,
          external: 110,
          timestamp: 3000,
        },
      ];

      // Act
      const result = monitor.analyzeGrowthPattern(snapshots);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.isHealthy, true);
      assertEquals(typeof result.data.growthRate, "number");
    });

    it("should calculate growth rate correctly", () => {
      // Arrange - Test the growth rate calculation without assuming threshold behavior
      const snapshots: MemorySnapshot[] = [
        {
          rss: 1000,
          heapTotal: 500,
          heapUsed: 1000000, // 1MB
          external: 100,
          timestamp: 0,
        },
        {
          rss: 5000,
          heapTotal: 2500,
          heapUsed: 3000000, // 3MB (2MB growth)
          external: 500,
          timestamp: 1000, // 1000ms later
        },
        {
          rss: 9000,
          heapTotal: 4500,
          heapUsed: 6000000, // 6MB (3MB growth)
          external: 900,
          timestamp: 2000, // 2000ms total
        },
      ];

      // Act
      const result = monitor.analyzeGrowthPattern(snapshots);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(typeof result.data.growthRate, "number");
      assertEquals(typeof result.data.isHealthy, "boolean");

      // Verify the growth rate calculation logic
      // Average delta: (2MB + 3MB) / 2 = 2.5MB
      // Time duration: 2000ms
      // Growth rate: 2.5MB / 2000ms = 1250 bytes/ms
      assertEquals(result.data.growthRate, 1250);
    });

    it("should reject insufficient data", () => {
      // Arrange - Only 2 snapshots (need at least 3)
      const snapshots: MemorySnapshot[] = [
        {
          rss: 1000,
          heapTotal: 500,
          heapUsed: 300,
          external: 100,
          timestamp: 1000,
        },
        {
          rss: 1010,
          heapTotal: 510,
          heapUsed: 305,
          external: 105,
          timestamp: 2000,
        },
      ];

      // Act
      const result = monitor.analyzeGrowthPattern(snapshots);

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "InsufficientData");
      if (result.error.kind === "InsufficientData") {
        assertEquals(
          result.error.content,
          "Need at least 3 snapshots for growth analysis",
        );
      }
    });

    it("should handle empty snapshots array", () => {
      // Act
      const result = monitor.analyzeGrowthPattern([]);

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "InsufficientData");
    });

    it("should handle memory decrease patterns", () => {
      // Arrange - Memory decreasing over time (garbage collection)
      const snapshots: MemorySnapshot[] = [
        {
          rss: 2000,
          heapTotal: 1000,
          heapUsed: 800,
          external: 200,
          timestamp: 1000,
        },
        {
          rss: 1500,
          heapTotal: 750,
          heapUsed: 600,
          external: 150,
          timestamp: 2000,
        },
        {
          rss: 1000,
          heapTotal: 500,
          heapUsed: 400,
          external: 100,
          timestamp: 3000,
        },
      ];

      // Act
      const result = monitor.analyzeGrowthPattern(snapshots);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.isHealthy, true); // Decreasing memory is healthy
      assertEquals(result.data.growthRate < 0, true); // Negative growth rate
    });
  });
});
