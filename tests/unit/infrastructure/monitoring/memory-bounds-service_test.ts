/**
 * @fileoverview Unit Tests for MemoryBoundsService
 * @description Comprehensive tests following TDD principles and DDD validation
 * Part of Issue #1080 DDD refactoring - testing extracted memory bounds service
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  MemoryBoundsService,
  type MemoryBoundsServiceConfig,
  MemoryBoundsServiceFactory,
} from "../../../../src/infrastructure/monitoring/memory-bounds-service.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
} from "../../../../src/domain/shared/types/processing-bounds.ts";

// Helper function to create bounded processing bounds
function createTestBounds(
  memoryMB: number,
  fileLimit: number,
  timeSeconds: number,
): ProcessingBounds {
  const boundsResult = ProcessingBoundsFactory.createBounded(
    memoryMB,
    fileLimit,
    timeSeconds,
  );
  if (!boundsResult.ok) {
    throw new Error(
      `Failed to create test bounds: ${boundsResult.error.message}`,
    );
  }
  return boundsResult.data;
}

// Helper function to create unbounded processing bounds
function createUnboundedBounds(): ProcessingBounds {
  return ProcessingBoundsFactory.createUnbounded();
}

Deno.test("MemoryBoundsService Creation", async (t) => {
  await t.step("should create service with valid bounded configuration", () => {
    const bounds = createTestBounds(512, 100, 30);
    const config: MemoryBoundsServiceConfig = { bounds };

    const result = MemoryBoundsService.create(config);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
    }
  });

  await t.step("should create service with unbounded configuration", () => {
    const bounds = createUnboundedBounds();
    const config: MemoryBoundsServiceConfig = { bounds };

    const result = MemoryBoundsService.create(config);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
    }
  });

  await t.step("should reject undefined configuration", () => {
    const result = MemoryBoundsService.create(undefined as any);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InitializationError");
      assertEquals(
        result.error.message,
        "MemoryBoundsService configuration is required",
      );
    }
  });

  await t.step("should reject configuration without bounds", () => {
    const config = { bounds: undefined } as any;

    const result = MemoryBoundsService.create(config);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InitializationError");
      assertEquals(
        result.error.message,
        "ProcessingBounds are required for memory bounds service",
      );
    }
  });
});

Deno.test("MemoryBoundsService Processing State Checking", async (t) => {
  // Setup services for tests
  const boundedBounds = createTestBounds(512, 100, 30);
  const boundedConfig: MemoryBoundsServiceConfig = { bounds: boundedBounds };
  const boundedResult = MemoryBoundsService.create(boundedConfig);

  const unboundedBounds = createUnboundedBounds();
  const unboundedConfig: MemoryBoundsServiceConfig = {
    bounds: unboundedBounds,
  };
  const unboundedResult = MemoryBoundsService.create(unboundedConfig);

  if (!boundedResult.ok || !unboundedResult.ok) {
    throw new Error("Failed to create test services");
  }

  const boundedService = boundedResult.data;
  const unboundedService = unboundedResult.data;

  await t.step("should check processing state for bounded service", () => {
    const state = boundedService.checkProcessingState(50);

    assertExists(state);
    assertEquals(
      state.kind === "within_bounds" || state.kind === "approaching_limit",
      true,
    );
  });

  await t.step("should check processing state for unbounded service", () => {
    const state = unboundedService.checkProcessingState(1000);

    assertExists(state);
    assertEquals(state.kind, "within_bounds");
  });

  await t.step("should detect when bounds are exceeded for file count", () => {
    // Use file count that exceeds the limit (100)
    const state = boundedService.checkProcessingState(150);

    assertExists(state);
    // Should exceed limit due to file count
    assertEquals(state.kind, "exceeded_limit");
  });

  await t.step("should handle zero files processed", () => {
    const state = boundedService.checkProcessingState(0);

    assertExists(state);
    assertEquals(state.kind, "within_bounds");
  });

  await t.step("should handle negative files processed gracefully", () => {
    const state = boundedService.checkProcessingState(-1);

    assertExists(state);
    // Service should handle negative values gracefully
  });
});

Deno.test("MemoryBoundsService Memory Growth Validation", async (t) => {
  // Setup service for tests
  const bounds = createTestBounds(512, 100, 30);
  const config: MemoryBoundsServiceConfig = { bounds };
  const serviceResult = MemoryBoundsService.create(config);

  if (!serviceResult.ok) {
    throw new Error("Failed to create test service");
  }
  const service = serviceResult.data;

  await t.step("should validate memory growth for single file", () => {
    const result = service.validateMemoryGrowth(1);

    assertEquals(result.ok, true);
  });

  await t.step("should validate memory growth for zero files", () => {
    const result = service.validateMemoryGrowth(0);

    assertEquals(result.ok, true);
  });

  await t.step("should validate memory growth for moderate file count", () => {
    const result = service.validateMemoryGrowth(50);

    assertEquals(result.ok, true);
  });

  await t.step("should validate memory growth for large file count", () => {
    const result = service.validateMemoryGrowth(100);

    assertEquals(result.ok, true);
  });

  await t.step("should handle negative file count in memory validation", () => {
    const result = service.validateMemoryGrowth(-1);

    assertEquals(result.ok, true);
  });
});

Deno.test("MemoryBoundsService Bounds Access", async (t) => {
  await t.step("should return processing bounds for bounded service", () => {
    const originalBounds = createTestBounds(512, 100, 30);
    const config: MemoryBoundsServiceConfig = { bounds: originalBounds };
    const serviceResult = MemoryBoundsService.create(config);

    if (!serviceResult.ok) {
      throw new Error("Failed to create test service");
    }

    const retrievedBounds = serviceResult.data.getProcessingBounds();

    assertEquals(retrievedBounds.kind, "bounded");
    if (retrievedBounds.kind === "bounded") {
      assertEquals(retrievedBounds.memoryLimit, 512 * 1024 * 1024); // MB to bytes
      assertEquals(retrievedBounds.fileLimit, 100);
      assertEquals(retrievedBounds.timeLimit, 30 * 1000); // seconds to milliseconds
    }
  });

  await t.step("should return processing bounds for unbounded service", () => {
    const originalBounds = createUnboundedBounds();
    const config: MemoryBoundsServiceConfig = { bounds: originalBounds };
    const serviceResult = MemoryBoundsService.create(config);

    if (!serviceResult.ok) {
      throw new Error("Failed to create test service");
    }

    const retrievedBounds = serviceResult.data.getProcessingBounds();

    assertEquals(retrievedBounds.kind, "unbounded");
  });
});

Deno.test("MemoryBoundsService Convenience Methods", async (t) => {
  // Setup service for tests
  const bounds = createTestBounds(512, 100, 30);
  const config: MemoryBoundsServiceConfig = { bounds };
  const serviceResult = MemoryBoundsService.create(config);

  if (!serviceResult.ok) {
    throw new Error("Failed to create test service");
  }
  const boundedService = serviceResult.data;

  await t.step("should correctly identify files within bounds", () => {
    const withinBounds = boundedService.isWithinBounds(50);

    assertEquals(withinBounds, true);
  });

  await t.step("should correctly identify files exceeding bounds", () => {
    const withinBounds = boundedService.isWithinBounds(150);

    assertEquals(withinBounds, false);
  });

  await t.step("should correctly detect exceeded limits", () => {
    const hasExceeded = boundedService.hasExceededLimits(150);

    assertEquals(hasExceeded, true);
  });

  await t.step("should correctly detect when limits are not exceeded", () => {
    const hasExceeded = boundedService.hasExceededLimits(50);

    assertEquals(hasExceeded, false);
  });
});

Deno.test("MemoryBoundsService Legacy Compatibility", async (t) => {
  await t.step(
    "should provide underlying monitor for legacy compatibility",
    () => {
      const bounds = createTestBounds(512, 100, 30);
      const config: MemoryBoundsServiceConfig = { bounds };
      const serviceResult = MemoryBoundsService.create(config);

      if (!serviceResult.ok) {
        throw new Error("Failed to create test service");
      }

      const monitor = serviceResult.data.getUnderlyingMonitor();

      assertExists(monitor);
      // Verify it works like the original ProcessingBoundsMonitor
      const state = monitor.checkState(50);
      assertExists(state);
    },
  );
});

Deno.test("MemoryBoundsServiceFactory", async (t) => {
  await t.step("should create bounded service via factory", () => {
    const result = MemoryBoundsServiceFactory.createBounded(512, 100, 30);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      const bounds = result.data.getProcessingBounds();
      assertEquals(bounds.kind, "bounded");
    }
  });

  await t.step("should create unbounded service via factory", () => {
    const result = MemoryBoundsServiceFactory.createUnbounded();

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      const bounds = result.data.getProcessingBounds();
      assertEquals(bounds.kind, "unbounded");
    }
  });

  await t.step("should create default service for small dataset", () => {
    const result = MemoryBoundsServiceFactory.createDefault(50);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      const bounds = result.data.getProcessingBounds();
      assertEquals(bounds.kind, "bounded");
    }
  });

  await t.step("should create default service for medium dataset", () => {
    const result = MemoryBoundsServiceFactory.createDefault(500);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      const bounds = result.data.getProcessingBounds();
      assertEquals(bounds.kind, "bounded");
    }
  });

  await t.step("should create default service for large dataset", () => {
    const result = MemoryBoundsServiceFactory.createDefault(1500);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      const bounds = result.data.getProcessingBounds();
      assertEquals(bounds.kind, "bounded");
    }
  });

  await t.step("should handle zero file count in default factory", () => {
    const result = MemoryBoundsServiceFactory.createDefault(0);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
      const bounds = result.data.getProcessingBounds();
      assertEquals(bounds.kind, "unbounded");
    }
  });

  await t.step("should reject invalid parameters in bounded factory", () => {
    const result = MemoryBoundsServiceFactory.createBounded(-1, 100, 30);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InitializationError");
      assertEquals(
        result.error.message.includes("Failed to create processing bounds"),
        true,
      );
    }
  });

  await t.step("should reject negative file count in default factory", () => {
    const result = MemoryBoundsServiceFactory.createDefault(-1);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InitializationError");
      assertEquals(
        result.error.message.includes(
          "Failed to create default processing bounds",
        ),
        true,
      );
    }
  });
});

Deno.test("MemoryBoundsService Integration", async (t) => {
  await t.step("should work with real-world processing patterns", () => {
    // Create service with realistic bounds for medium-sized project
    const serviceResult = MemoryBoundsServiceFactory.createDefault(200);

    if (!serviceResult.ok) {
      throw new Error("Failed to create service for integration test");
    }

    const service = serviceResult.data;

    // Simulate processing workflow
    let filesProcessed = 0;

    // Initial state should be within bounds
    assertEquals(service.isWithinBounds(filesProcessed), true);

    // Process files incrementally
    for (let i = 0; i < 50; i += 10) {
      filesProcessed = i;
      const state = service.checkProcessingState(filesProcessed);
      assertExists(state);

      // Validate memory growth
      const memoryResult = service.validateMemoryGrowth(filesProcessed);
      assertEquals(memoryResult.ok, true);
    }

    // Should still be within bounds for moderate processing
    assertEquals(service.isWithinBounds(filesProcessed), true);
    assertEquals(service.hasExceededLimits(filesProcessed), false);
  });

  await t.step("should handle edge case of exactly at limit", () => {
    const serviceResult = MemoryBoundsServiceFactory.createBounded(
      512,
      100,
      30,
    );

    if (!serviceResult.ok) {
      throw new Error("Failed to create service for edge case test");
    }

    const service = serviceResult.data;

    // Test exactly at file limit
    const state = service.checkProcessingState(100);
    assertExists(state);

    // Should be within bounds (not exceeded) at exactly the limit
    assertEquals(service.isWithinBounds(100), true);
    assertEquals(service.hasExceededLimits(100), false);
  });
});
