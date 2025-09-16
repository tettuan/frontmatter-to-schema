import { assertEquals, assertExists } from "@std/assert";
import { CircuitBreaker } from "../../../../../src/domain/aggregation/services/circuit-breaker.ts";

Deno.test("CircuitBreaker - should allow processing within limits", () => {
  const breaker = new CircuitBreaker({
    maxComplexity: 1000,
    maxMemoryMB: 512,
    maxProcessingTimeMs: 5000,
    maxDatasetSize: 100,
    cooldownPeriodMs: 1000,
  });

  const result = breaker.canProcess(50, 10);
  assertEquals(result.ok, true);
});

Deno.test("CircuitBreaker - should reject when dataset exceeds limit", () => {
  const breaker = new CircuitBreaker({
    maxComplexity: 1000,
    maxMemoryMB: 512,
    maxProcessingTimeMs: 5000,
    maxDatasetSize: 100,
    cooldownPeriodMs: 1000,
  });

  const result = breaker.canProcess(200, 10);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertExists(result.error.message.includes("Dataset size"));
  }
});

Deno.test("CircuitBreaker - should reject when complexity exceeds limit", () => {
  const breaker = new CircuitBreaker({
    maxComplexity: 1000,
    maxMemoryMB: 512,
    maxProcessingTimeMs: 5000,
    maxDatasetSize: 100,
    cooldownPeriodMs: 1000,
  });

  const result = breaker.canProcess(100, 20);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertExists(result.error.message.includes("complexity"));
  }
});

Deno.test("CircuitBreaker - should open after multiple failures", () => {
  const breaker = new CircuitBreaker({
    maxComplexity: 1000,
    maxMemoryMB: 512,
    maxProcessingTimeMs: 5000,
    maxDatasetSize: 100,
    cooldownPeriodMs: 100,
  });

  // Record multiple failures
  breaker.recordFailure("Error 1");
  breaker.recordFailure("Error 2");
  breaker.recordFailure("Error 3");

  // Circuit should be open
  const state = breaker.getState();
  assertEquals(state.status, "open");

  // Should reject requests when open
  const result = breaker.canProcess(10, 10);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertExists(result.error.message.includes("Circuit breaker is open"));
  }
});

Deno.test("CircuitBreaker - should close after successful operations", () => {
  const breaker = new CircuitBreaker();

  // Record a failure
  breaker.recordFailure("Error");

  // Record successful operations
  breaker.recordSuccess(100, 10);

  const state = breaker.getState();
  assertEquals(state.status, "closed");
  assertEquals(state.failures, 0);
});

Deno.test("CircuitBreaker - should track metrics correctly", () => {
  const breaker = new CircuitBreaker();

  breaker.recordSuccess(100, 20);
  breaker.recordSuccess(200, 30);
  breaker.recordFailure("Error");

  const state = breaker.getState();
  assertEquals(state.metrics.totalAttempts, 3);
  assertEquals(state.metrics.successfulAttempts, 2);
  assertEquals(state.metrics.failedAttempts, 1);
  assertEquals(state.metrics.averageProcessingTime, 150);
  assertEquals(state.metrics.peakMemoryUsage, 30);
});

Deno.test("CircuitBreaker - should suggest appropriate batch size", () => {
  const breaker = new CircuitBreaker({
    maxComplexity: 1000,
    maxMemoryMB: 512,
    maxProcessingTimeMs: 5000,
    maxDatasetSize: 1000,
    cooldownPeriodMs: 1000,
  });

  // Small dataset - should return full size
  assertEquals(breaker.suggestBatchSize(10, 10), 10);

  // Large dataset - should suggest smaller batch
  const suggested = breaker.suggestBatchSize(1000, 10);
  assertExists(suggested < 1000);
  assertExists(suggested > 0);
});

Deno.test("CircuitBreaker - should reset state correctly", () => {
  const breaker = new CircuitBreaker();

  breaker.recordFailure("Error 1");
  breaker.recordFailure("Error 2");
  breaker.recordSuccess(100, 20);

  breaker.reset();

  const state = breaker.getState();
  assertEquals(state.status, "closed");
  assertEquals(state.failures, 0);
  assertEquals(state.metrics.totalAttempts, 0);
  assertEquals(state.metrics.successfulAttempts, 0);
  assertEquals(state.metrics.failedAttempts, 0);
});
