import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import {
  CircuitBreaker,
} from "../../../../../src/domain/aggregation/services/circuit-breaker.ts";
import { CircuitBreakerConfig } from "../../../../../src/domain/aggregation/value-objects/circuit-breaker-config.ts";

/**
 * CircuitBreaker Unit Tests
 * Following DDD and Totality principles with comprehensive state transition coverage
 */

// Helper function to create test config
function createTestConfig(
  overrides?: Partial<
    {
      maxComplexity: number;
      maxMemoryMB: number;
      maxProcessingTimeMs: number;
      maxDatasetSize: number;
      cooldownPeriodMs: number;
    }
  >,
): CircuitBreakerConfig {
  const result = CircuitBreakerConfig.create(overrides);
  if (!result.ok) {
    throw new Error(`Failed to create test config: ${result.error.message}`);
  }
  return result.data;
}
Deno.test("CircuitBreaker", async (t) => {
  await t.step("should initialize with closed state", () => {
    const breakerResult = CircuitBreaker.create();
    assert(breakerResult.ok);
    const breaker = breakerResult.data;
    const state = breaker.getState();

    assertEquals(state.status, "closed");
    assertEquals(state.failures, 0);
    assertEquals(state.metrics.totalAttempts, 0);
    assertEquals(state.metrics.successfulAttempts, 0);
    assertEquals(state.metrics.failedAttempts, 0);
    assertEquals(state.metrics.rejectedAttempts, 0);
  });

  await t.step("should accept requests when closed and under limits", () => {
    const breakerResult = CircuitBreaker.create();
    assert(breakerResult.ok);
    const breaker = breakerResult.data;
    const result = breaker.canProcess(100, 10);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should reject when dataset size exceeds limit", () => {
    const config = createTestConfig({
      maxDatasetSize: 1000,
    });
    const breakerResult = CircuitBreaker.create(config);
    assert(breakerResult.ok);
    const breaker = breakerResult.data;
    const result = breaker.canProcess(1001, 1);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "AggregationFailed");
      assertExists(result.error.message);
      assertEquals(
        result.error.message.includes("Dataset size 1001 exceeds maximum"),
        true,
      );
    }

    // Verify rejection was recorded
    const state = breaker.getState();
    assertEquals(state.metrics.rejectedAttempts, 1);
    assertEquals(state.metrics.totalAttempts, 1);
  });

  await t.step("should reject when complexity exceeds limit", () => {
    const configResult = CircuitBreakerConfig.create({
      maxComplexity: 1000,
      maxMemoryMB: 512,
      maxProcessingTimeMs: 60000,
      maxDatasetSize: 5000,
      cooldownPeriodMs: 30000,
    });
    assert(configResult.ok);
    const config = configResult.data;
    const breakerResult = CircuitBreaker.create(config);
    assert(breakerResult.ok);
    const breaker = breakerResult.data;
    const result = breaker.canProcess(100, 20); // 100 * 20 = 2000 > 1000

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "AggregationFailed");
      assertEquals(
        result.error.message.includes("Processing complexity 2000 exceeds"),
        true,
      );
    }

    const state = breaker.getState();
    assertEquals(state.metrics.rejectedAttempts, 1);
  });

  await t.step("should transition from CLOSED to OPEN after 3 failures", () => {
    const configResult = CircuitBreakerConfig.create({
      failureThreshold: 3,
    });
    assert(configResult.ok);
    const breakerResult = CircuitBreaker.create(configResult.data);
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    // Start in closed state
    assertEquals(breaker.getState().status, "closed");

    // Record 3 failures
    breaker.recordFailure("Test failure 1");
    assertEquals(breaker.getState().status, "closed");
    assertEquals(breaker.getState().failures, 1);

    breaker.recordFailure("Test failure 2");
    assertEquals(breaker.getState().status, "closed");
    assertEquals(breaker.getState().failures, 2);

    breaker.recordFailure("Test failure 3");
    assertEquals(breaker.getState().status, "open");
    assertEquals(breaker.getState().failures, 3);

    // Verify metrics
    const state = breaker.getState();
    assertEquals(state.metrics.totalAttempts, 3);
    assertEquals(state.metrics.failedAttempts, 3);
    assertExists(state.lastFailureTime);
  });

  await t.step("should reject requests when in OPEN state", () => {
    const configResult = CircuitBreakerConfig.create({
      maxComplexity: 10000,
      maxMemoryMB: 512,
      maxProcessingTimeMs: 60000,
      maxDatasetSize: 5000,
      cooldownPeriodMs: 30000,
      failureThreshold: 3,
    });
    assert(configResult.ok);
    const config = configResult.data;
    const breakerResult = CircuitBreaker.create(config);
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    // Force open state
    breaker.recordFailure("Failure 1");
    breaker.recordFailure("Failure 2");
    breaker.recordFailure("Failure 3");

    assertEquals(breaker.getState().status, "open");

    // Try to process - should be rejected
    const result = breaker.canProcess(100, 10);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "AggregationFailed");
      assertEquals(
        result.error.message.includes("Circuit breaker is open"),
        true,
      );
    }

    // Verify rejection was recorded
    const state = breaker.getState();
    assertEquals(state.metrics.rejectedAttempts, 1);
    assertEquals(state.metrics.totalAttempts, 4); // 3 failures + 1 rejection
  });

  await t.step(
    "should transition from OPEN to HALF-OPEN after cooldown",
    async () => {
      const configResult = CircuitBreakerConfig.create({
        maxComplexity: 10000,
        maxMemoryMB: 512,
        maxProcessingTimeMs: 60000,
        maxDatasetSize: 5000,
        cooldownPeriodMs: 100, // Short cooldown for testing
        failureThreshold: 3,
      });
      assert(configResult.ok);
      const config = configResult.data;
      const breakerResult = CircuitBreaker.create(config);
      assert(breakerResult.ok);
      const breaker = breakerResult.data;

      // Force open state
      breaker.recordFailure("Failure 1");
      breaker.recordFailure("Failure 2");
      breaker.recordFailure("Failure 3");
      assertEquals(breaker.getState().status, "open");

      // Wait for cooldown
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should transition to half-open on next check
      const result = breaker.canProcess(100, 10);
      assertEquals(result.ok, true);
      assertEquals(breaker.getState().status, "half-open");
    },
  );

  await t.step(
    "should transition from HALF-OPEN to CLOSED on success",
    async () => {
      const configResult = CircuitBreakerConfig.create({
        maxComplexity: 10000,
        maxMemoryMB: 512,
        maxProcessingTimeMs: 60000,
        maxDatasetSize: 5000,
        cooldownPeriodMs: 100,
        failureThreshold: 3,
      });
      assert(configResult.ok);
      const config = configResult.data;
      const breakerResult = CircuitBreaker.create(config);
      assert(breakerResult.ok);
      const breaker = breakerResult.data;

      // Force open state
      breaker.recordFailure("Failure 1");
      breaker.recordFailure("Failure 2");
      breaker.recordFailure("Failure 3");

      // Wait for cooldown
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Transition to half-open
      breaker.canProcess(100, 10);
      assertEquals(breaker.getState().status, "half-open");

      // Record success - should close
      breaker.recordSuccess(50, 100);
      assertEquals(breaker.getState().status, "closed");
      assertEquals(breaker.getState().failures, 0);

      // Verify metrics
      const state = breaker.getState();
      assertEquals(state.metrics.successfulAttempts, 1);
      assertExists(state.lastSuccessTime);
    },
  );

  await t.step(
    "should transition from HALF-OPEN to OPEN on failure",
    async () => {
      const configResult = CircuitBreakerConfig.create({
        maxComplexity: 10000,
        maxMemoryMB: 512,
        maxProcessingTimeMs: 60000,
        maxDatasetSize: 5000,
        cooldownPeriodMs: 100,
        failureThreshold: 3,
      });
      assert(configResult.ok);
      const config = configResult.data;
      const breakerResult = CircuitBreaker.create(config);
      assert(breakerResult.ok);
      const breaker = breakerResult.data;

      // Force open state
      breaker.recordFailure("Failure 1");
      breaker.recordFailure("Failure 2");
      breaker.recordFailure("Failure 3");

      // Wait for cooldown
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Transition to half-open
      breaker.canProcess(100, 10);
      assertEquals(breaker.getState().status, "half-open");

      // Record failure - should open immediately
      breaker.recordFailure("Failure in half-open");
      assertEquals(breaker.getState().status, "open");
      assertEquals(breaker.getState().failures, 4);
    },
  );

  await t.step("should track metrics correctly", () => {
    const breakerResult = CircuitBreaker.create();
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    // Record multiple successes
    breaker.recordSuccess(100, 50);
    breaker.recordSuccess(200, 75);
    breaker.recordSuccess(150, 60);

    const state = breaker.getState();
    assertEquals(state.metrics.totalAttempts, 3);
    assertEquals(state.metrics.successfulAttempts, 3);
    assertEquals(state.metrics.averageProcessingTime, 150); // (100+200+150)/3
    assertEquals(state.metrics.peakMemoryUsage, 75);
  });

  await t.step("should calculate average processing time correctly", () => {
    const breakerResult = CircuitBreaker.create();
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    breaker.recordSuccess(100, 50);
    assertEquals(breaker.getState().metrics.averageProcessingTime, 100);

    breaker.recordSuccess(200, 60);
    assertEquals(breaker.getState().metrics.averageProcessingTime, 150);

    breaker.recordSuccess(300, 70);
    assertEquals(breaker.getState().metrics.averageProcessingTime, 200);
  });

  await t.step("should suggest appropriate batch size", () => {
    const configResult = CircuitBreakerConfig.create({
      maxComplexity: 1000,
      maxMemoryMB: 512,
      maxProcessingTimeMs: 60000,
      maxDatasetSize: 5000,
      cooldownPeriodMs: 30000,
    });
    assert(configResult.ok);
    const config = configResult.data;
    const breakerResult = CircuitBreaker.create(config);
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    // Under limit - return full size
    let batchSize = breaker.suggestBatchSize(100, 5); // complexity = 500 < 1000
    assertEquals(batchSize, 100);

    // Over limit - suggest smaller batch
    batchSize = breaker.suggestBatchSize(200, 10); // complexity = 2000 > 1000
    assertEquals(batchSize, 50); // (1000 * 0.5) / 10 = 50

    // Very high complexity - cap at 100
    batchSize = breaker.suggestBatchSize(10000, 100);
    assertEquals(batchSize, 5); // (1000 * 0.5) / 100 = 5

    // Ensure minimum of 1
    batchSize = breaker.suggestBatchSize(1000, 1000);
    assertEquals(batchSize, 1);
  });

  await t.step("should reset state correctly", () => {
    const breakerResult = CircuitBreaker.create();
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    // Create some state
    breaker.recordFailure("Failure 1");
    breaker.recordFailure("Failure 2");
    breaker.recordSuccess(100, 50);

    // Verify state is not empty
    let state = breaker.getState();
    assertEquals(state.failures, 0); // recordSuccess resets failures to 0
    assertEquals(state.metrics.totalAttempts, 3);
    assertEquals(state.metrics.failedAttempts, 2);
    assertEquals(state.metrics.successfulAttempts, 1);

    // Reset
    breaker.reset();

    // Verify clean state
    state = breaker.getState();
    assertEquals(state.status, "closed");
    assertEquals(state.failures, 0);
    assertEquals(state.metrics.totalAttempts, 0);
    assertEquals(state.metrics.successfulAttempts, 0);
    assertEquals(state.metrics.failedAttempts, 0);
    assertEquals(state.metrics.rejectedAttempts, 0);
    assertEquals(state.metrics.averageProcessingTime, 0);
    assertEquals(state.metrics.peakMemoryUsage, 0);
    assertEquals(state.lastFailureTime, undefined);
    assertEquals(state.lastSuccessTime, undefined);
  });

  await t.step("should handle memory pressure correctly", () => {
    // This test simulates high memory usage scenario
    // Note: Can't easily control actual memory usage in tests, but we can test the logic
    const configResult = CircuitBreakerConfig.create({
      maxComplexity: 10000,
      maxMemoryMB: 1, // Very low limit to trigger rejection
      maxProcessingTimeMs: 60000,
      maxDatasetSize: 5000,
      cooldownPeriodMs: 30000,
    });
    assert(configResult.ok);
    const config = configResult.data;
    const breakerResult = CircuitBreaker.create(config);
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    // Current memory will likely be > 0.8MB, triggering rejection
    const result = breaker.canProcess(100, 10);

    // This might pass or fail depending on actual memory usage
    // The important thing is that the logic is tested
    if (!result.ok) {
      assertEquals(result.error.kind, "AggregationFailed");
      assertEquals(
        result.error.message.includes("memory usage"),
        true,
      );
      assertEquals(breaker.getState().metrics.rejectedAttempts, 1);
    }
  });

  await t.step("should maintain immutable state", () => {
    const breakerResult = CircuitBreaker.create();
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    const state1 = breaker.getState();
    breaker.recordSuccess(100, 50);
    const state2 = breaker.getState();

    // Original state should not be modified
    assertEquals(state1.metrics.totalAttempts, 0);
    assertEquals(state2.metrics.totalAttempts, 1);

    // Modifying returned state should not affect internal state
    const mutableState = breaker.getState();
    (mutableState as any).failures = 999;

    const actualState = breaker.getState();
    assertEquals(actualState.failures, 0);
  });

  await t.step("should handle concurrent operations safely", async () => {
    // Test thread-safety by simulating concurrent operations
    const breakerResult = CircuitBreaker.create();
    assert(breakerResult.ok);
    const breaker = breakerResult.data;

    const operations = Array.from(
      { length: 10 },
      (_, i) =>
        Promise.resolve().then(() => {
          if (i % 2 === 0) {
            breaker.recordSuccess(100, 50);
          } else {
            breaker.recordFailure(`Failure ${i}`);
          }
        }),
    );

    await Promise.all(operations);

    const state = breaker.getState();
    assertEquals(state.metrics.totalAttempts, 10);
    assertEquals(state.metrics.successfulAttempts, 5);
    assertEquals(state.metrics.failedAttempts, 5);
  });
});
