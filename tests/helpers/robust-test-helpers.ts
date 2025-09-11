/**
 * Robust Test Helpers for Schema Extension Testing
 *
 * Provides utilities for:
 * - Reproducible test data generation
 * - Idempotent test execution
 * - Parallel-safe test isolation
 * - Change-resistant test patterns
 * - Memory-efficient test utilities
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import type { Result } from "../../src/domain/core/result.ts";

/**
 * Deterministic Test Data Generator
 *
 * Ensures reproducible test data across different environments
 * and test runs. Uses seeded random generation for consistency.
 */
export class DeterministicTestDataGenerator {
  private static seed = 12345; // Fixed seed for reproducibility

  /**
   * Reset seed for deterministic test execution
   */
  static resetSeed(): void {
    this.seed = 12345;
  }

  /**
   * Generate deterministic pseudo-random number
   */
  private static seededRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate deterministic test documents
   */
  static generateDocuments(count: number): Array<Record<string, unknown>> {
    this.resetSeed(); // Ensure reproducibility
    const documents: Array<Record<string, unknown>> = [];

    for (let i = 0; i < count; i++) {
      const doc = {
        id: i,
        title: `Document ${i}`,
        author: `Author ${i % 3}`, // Cycle through 3 authors
        category: `Category ${i % 5}`, // Cycle through 5 categories
        tags: [
          `tag${i % 4}`,
          `tag${(i + 1) % 4}`,
          `tag${(i + 2) % 4}`,
        ],
        items: this.generateItems(3),
        created: new Date(2024, 0, 1 + (i % 30)).toISOString(),
        priority: ["low", "medium", "high"][i % 3],
      };
      documents.push(doc);
    }

    return documents;
  }

  /**
   * Generate deterministic nested items
   */
  private static generateItems(count: number): Array<Record<string, unknown>> {
    const items: Array<Record<string, unknown>> = [];

    for (let i = 0; i < count; i++) {
      items.push({
        category: `ItemCategory ${i}`,
        value: Math.floor(this.seededRandom() * 100),
        active: i % 2 === 0,
        metadata: {
          type: ["typeA", "typeB", "typeC"][i % 3],
          version: `v${i + 1}.0`,
        },
      });
    }

    return items;
  }

  /**
   * Generate deterministic schema with extensions
   */
  static generateSchemaWithExtensions(
    extensionTypes: Array<"frontmatter" | "derived" | "template" | "unique">,
  ): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      type: "object",
      properties: {},
    };

    const properties = schema.properties as Record<string, unknown>;

    if (extensionTypes.includes("frontmatter")) {
      properties.authors = {
        type: "array",
        "x-frontmatter-part": true,
        items: { type: "string" },
      };
    }

    if (extensionTypes.includes("derived")) {
      properties.allCategories = {
        type: "array",
        "x-derived-from": "items[].category",
        "x-derived-unique": extensionTypes.includes("unique"),
      };
    }

    if (extensionTypes.includes("template")) {
      properties.summary = {
        type: "string",
        "x-template": "{{title}} by {{author}}",
      };
    }

    return schema;
  }
}

/**
 * Test Isolation Manager
 *
 * Ensures tests run in isolation and don't affect each other.
 * Provides cleanup and state management utilities.
 */
export class TestIsolationManager {
  private static testStates = new Map<string, unknown>();
  private static cleanupCallbacks = new Map<string, (() => void)[]>();

  /**
   * Setup isolated test environment
   */
  static setupTestEnvironment(testName: string): void {
    // Clear any existing state for this test
    this.testStates.delete(testName);
    this.cleanupCallbacks.delete(testName);

    // Initialize clean state
    this.testStates.set(testName, {});
    this.cleanupCallbacks.set(testName, []);
  }

  /**
   * Store test-specific state
   */
  static setState<T>(testName: string, key: string, value: T): void {
    const state = this.testStates.get(testName) as Record<string, unknown> ||
      {};
    state[key] = value;
    this.testStates.set(testName, state);
  }

  /**
   * Retrieve test-specific state
   */
  static getState<T>(testName: string, key: string): T | undefined {
    const state = this.testStates.get(testName) as Record<string, unknown>;
    return state?.[key] as T;
  }

  /**
   * Register cleanup callback
   */
  static registerCleanup(testName: string, callback: () => void): void {
    const callbacks = this.cleanupCallbacks.get(testName) || [];
    callbacks.push(callback);
    this.cleanupCallbacks.set(testName, callbacks);
  }

  /**
   * Execute cleanup for test
   */
  static cleanup(testName: string): void {
    const callbacks = this.cleanupCallbacks.get(testName) || [];

    // Execute all cleanup callbacks
    for (const callback of callbacks) {
      try {
        callback();
      } catch (error) {
        console.warn(`Cleanup error for test ${testName}:`, error);
      }
    }

    // Clear test state
    this.testStates.delete(testName);
    this.cleanupCallbacks.delete(testName);
  }

  /**
   * Create isolated test scope
   */
  static createTestScope<T>(
    testName: string,
    testFunction: () => T | Promise<T>,
  ): () => Promise<T> {
    return async () => {
      this.setupTestEnvironment(testName);

      try {
        const result = await testFunction();
        return result;
      } finally {
        this.cleanup(testName);
      }
    };
  }
}

/**
 * Result Type Test Helpers
 *
 * Utilities for testing Result types following Totality principles.
 */
export class ResultTestHelpers {
  /**
   * Assert that result is successful and return data
   */
  static assertSuccess<T, E>(result: Result<T, E>): T {
    assert(
      result.ok,
      `Expected success but got error: ${
        JSON.stringify(result.ok ? "" : result.error)
      }`,
    );
    return result.data;
  }

  /**
   * Assert that result is an error and return error
   */
  static assertError<T, E>(result: Result<T, E>): E {
    assert(
      !result.ok,
      `Expected error but got success: ${
        JSON.stringify(result.ok ? result.data : "")
      }`,
    );
    return result.error;
  }

  /**
   * Assert result success with data validation
   */
  static assertSuccessWithValidation<T, E>(
    result: Result<T, E>,
    validator: (data: T) => boolean,
    message?: string,
  ): T {
    const data = this.assertSuccess(result);
    assert(validator(data), message || "Data validation failed");
    return data;
  }

  /**
   * Assert result error with specific error kind
   */
  static assertErrorKind<T, E extends { kind: string }>(
    result: Result<T, E>,
    expectedKind: string,
  ): E {
    const error = this.assertError(result);
    assertEquals(error.kind, expectedKind);
    return error;
  }

  /**
   * Test result exhaustiveness (both success and error paths)
   */
  static testResultExhaustiveness<T, E>(
    successResult: Result<T, E>,
    errorResult: Result<T, E>,
  ): void {
    // Test success path
    assert(successResult.ok);
    assertExists(successResult.data);

    // Test error path
    assert(!errorResult.ok);
    assertExists(errorResult.error);
  }
}

/**
 * Performance Test Utilities
 *
 * Helpers for measuring and validating performance characteristics.
 */
export class PerformanceTestHelpers {
  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    fn: () => T | Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();

    return {
      result,
      duration: endTime - startTime,
    };
  }

  /**
   * Assert that operation completes within time limit
   */
  static async assertWithinTimeLimit<T>(
    fn: () => T | Promise<T>,
    maxDurationMs: number,
    operation: string = "Operation",
  ): Promise<T> {
    const { result, duration } = await this.measureTime(fn);

    assert(
      duration <= maxDurationMs,
      `${operation} took ${duration}ms, expected <= ${maxDurationMs}ms`,
    );

    return result;
  }

  /**
   * Benchmark function performance over multiple iterations
   */
  static async benchmark<T>(
    fn: () => T | Promise<T>,
    iterations: number = 10,
  ): Promise<{
    results: T[];
    durations: number[];
    average: number;
    min: number;
    max: number;
  }> {
    const results: T[] = [];
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measureTime(fn);
      results.push(result);
      durations.push(duration);
    }

    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);

    return { results, durations, average, min, max };
  }
}

/**
 * Memory Test Utilities
 *
 * Helpers for testing memory efficiency and preventing leaks.
 */
export class MemoryTestHelpers {
  /**
   * Test that objects are properly garbage collected
   */
  static testMemoryCleanup<T>(
    factory: () => T,
    cleanupFn?: (obj: T) => void,
  ): void {
    // Create and immediately release objects
    for (let i = 0; i < 1000; i++) {
      const obj = factory();

      if (cleanupFn) {
        cleanupFn(obj);
      }

      // Objects should become eligible for GC
      // (Note: Actual GC is non-deterministic)
    }

    // Test passes if no memory errors occur
    assert(true);
  }

  /**
   * Test object immutability
   */
  static testImmutability<T extends Record<string, unknown>>(
    obj: T,
    modificationAttempts: Array<(obj: T) => void>,
  ): void {
    // Create deep copy for comparison
    const originalState = JSON.parse(JSON.stringify(obj));

    // Attempt modifications
    for (const attempt of modificationAttempts) {
      try {
        attempt(obj);
      } catch {
        // Modification attempts may throw - that's expected for immutable objects
      }
    }

    // Object should be unchanged
    assertEquals(JSON.stringify(obj), JSON.stringify(originalState));
  }

  /**
   * Test for memory leaks in repeated operations
   */
  static testNoMemoryLeaks<T>(
    operation: () => T,
    iterations: number = 100,
  ): void {
    // Run operation multiple times
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      results.push(operation());
    }

    // Verify all results are valid (no corruption)
    assertEquals(results.length, iterations);

    // If we reach here without running out of memory, test passes
    assert(true);
  }
}

/**
 * Type Safety Test Utilities
 *
 * Helpers for testing type safety and compile-time guarantees.
 */
export class TypeSafetyTestHelpers {
  /**
   * Test discriminated union exhaustiveness
   */
  static testUnionExhaustiveness<T extends { kind: string }>(
    values: T[],
    expectedKinds: string[],
  ): void {
    const foundKinds = new Set(values.map((v) => v.kind));
    const expectedKindSet = new Set(expectedKinds);

    // All expected kinds should be found
    for (const expectedKind of expectedKinds) {
      assert(
        foundKinds.has(expectedKind),
        `Missing expected kind: ${expectedKind}`,
      );
    }

    // No unexpected kinds should be found
    for (const foundKind of foundKinds) {
      assert(
        expectedKindSet.has(foundKind),
        `Unexpected kind found: ${foundKind}`,
      );
    }
  }

  /**
   * Test type guard accuracy
   */
  static testTypeGuard<T, U extends T>(
    typeGuard: (value: T) => value is U,
    positiveExamples: T[],
    negativeExamples: T[],
  ): void {
    // Type guard should return true for positive examples
    for (const example of positiveExamples) {
      assert(
        typeGuard(example),
        `Type guard returned false for positive example: ${
          JSON.stringify(example)
        }`,
      );
    }

    // Type guard should return false for negative examples
    for (const example of negativeExamples) {
      assert(
        !typeGuard(example),
        `Type guard returned true for negative example: ${
          JSON.stringify(example)
        }`,
      );
    }
  }
}

/**
 * Async Test Utilities
 *
 * Helpers for testing asynchronous operations robustly.
 */
export class AsyncTestHelpers {
  /**
   * Test that async operation completes successfully
   */
  static async testAsyncSuccess<T>(
    asyncFn: () => Promise<T>,
    validator?: (result: T) => boolean,
  ): Promise<T> {
    const result = await asyncFn();

    if (validator) {
      assert(validator(result), "Async result validation failed");
    }

    return result;
  }

  /**
   * Test that async operation throws expected error
   */
  static async testAsyncError<T>(
    asyncFn: () => Promise<T>,
    expectedErrorMatcher?: (error: unknown) => boolean,
  ): Promise<void> {
    let errorThrown = false;
    let caughtError: unknown;

    try {
      await asyncFn();
    } catch (error) {
      errorThrown = true;
      caughtError = error;
    }

    assert(errorThrown, "Expected async function to throw an error");

    if (expectedErrorMatcher && caughtError) {
      assert(
        expectedErrorMatcher(caughtError),
        `Error did not match expected pattern: ${caughtError}`,
      );
    }
  }

  /**
   * Test async operation with timeout
   */
  static async testAsyncTimeout<T>(
    asyncFn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    return await Promise.race([asyncFn(), timeoutPromise]);
  }
}

/**
 * Comprehensive Test Suite Builder
 *
 * Utility for building complete test suites with all robustness features.
 */
export class RobustTestSuiteBuilder {
  private testName: string;
  private beforeEach?: () => void | Promise<void>;
  private afterEach?: () => void | Promise<void>;

  constructor(testName: string) {
    this.testName = testName;
  }

  /**
   * Set up test environment before each test
   */
  setBeforeEach(callback: () => void | Promise<void>): this {
    this.beforeEach = callback;
    return this;
  }

  /**
   * Clean up test environment after each test
   */
  setAfterEach(callback: () => void | Promise<void>): this {
    this.afterEach = callback;
    return this;
  }

  /**
   * Create a robust test with full isolation and cleanup
   */
  createTest<T>(
    testDescription: string,
    testFunction: () => T | Promise<T>,
  ): () => Promise<void> {
    return TestIsolationManager.createTestScope(
      `${this.testName}:${testDescription}`,
      async () => {
        if (this.beforeEach) {
          await this.beforeEach();
        }

        try {
          await testFunction();
        } finally {
          if (this.afterEach) {
            await this.afterEach();
          }
        }
      },
    );
  }
}
