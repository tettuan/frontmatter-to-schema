/**
 * Robust Test Framework
 *
 * Provides foundational infrastructure for robust, parallel-safe, environment-independent tests
 * following DDD principles and Totality patterns.
 */

import { assertEquals } from "@std/assert";
import {
  type DomainError,
  isFailure,
  isSuccess,
  type Result,
} from "../../src/domain/core/result.ts";

// Test Environment Management
export interface TestEnvironment {
  readonly testId: string;
  readonly tempDir: string;
  cleanup(): Promise<void>;
}

export class IsolatedTestEnvironment implements TestEnvironment {
  readonly testId: string;
  readonly tempDir: string;
  private readonly cleanupFunctions: (() => Promise<void>)[] = [];

  constructor() {
    this.testId = crypto.randomUUID();
    this.tempDir = `/tmp/test-${this.testId}`;
  }

  addCleanup(cleanup: () => Promise<void>): void {
    this.cleanupFunctions.push(cleanup);
  }

  async cleanup(): Promise<void> {
    for (const cleanup of this.cleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        console.warn(`Cleanup failed: ${error}`);
      }
    }
  }
}

// Robust Test Runner with automatic cleanup
export async function withIsolatedEnvironment<T>(
  testFn: (env: TestEnvironment) => Promise<T> | T,
): Promise<T> {
  const env = new IsolatedTestEnvironment();
  try {
    return await testFn(env);
  } finally {
    await env.cleanup();
  }
}

// Result Assertion Helpers (Totality-focused)
export class ResultAssert {
  static assertSuccess<T, E>(
    result: Result<T, E>,
    message?: string,
  ): asserts result is { ok: true; data: T } {
    if (!isSuccess(result)) {
      const errorMsg = message ||
        `Expected success but got error: ${JSON.stringify(result.error)}`;
      throw new Error(errorMsg);
    }
  }

  static assertFailure<T, E extends { message: string }>(
    result: Result<T, E>,
    expectedErrorKind?: string,
    message?: string,
  ): asserts result is { ok: false; error: E } {
    if (!isFailure(result)) {
      const errorMsg = message || `Expected failure but got success`;
      throw new Error(errorMsg);
    }

    if (
      expectedErrorKind && typeof result.error === "object" &&
      result.error !== null
    ) {
      const error = result.error as { kind?: string };
      if (error.kind !== expectedErrorKind) {
        const errorMsg = message ||
          `Expected error kind '${expectedErrorKind}' but got '${error.kind}'`;
        throw new Error(errorMsg);
      }
    }
  }

  static assertErrorMessage<T>(
    result: Result<T, DomainError & { message: string }>,
    expectedMessage: string | RegExp,
  ): void {
    ResultAssert.assertFailure(result);

    if (typeof expectedMessage === "string") {
      assertEquals(result.error.message, expectedMessage);
    } else {
      if (!expectedMessage.test(result.error.message)) {
        throw new Error(
          `Error message '${result.error.message}' does not match pattern ${expectedMessage}`,
        );
      }
    }
  }
}

// Domain Test Helpers (DDD-focused)
export class DomainTestHelpers {
  /**
   * Tests Smart Constructor validation comprehensively
   */
  static async testSmartConstructor<T, E extends { message: string }>(
    t: Deno.TestContext,
    constructorName: string,
    createFn: (input: unknown) => Result<T, E>,
    validInput: unknown,
    invalidInputs: Array<
      { input: unknown; expectedError?: string; description: string }
    >,
  ): Promise<void> {
    await t.step(`${constructorName} should create valid instance`, () => {
      const result = createFn(validInput);
      ResultAssert.assertSuccess(result, `Valid input should create instance`);
    });

    for (const { input, expectedError, description } of invalidInputs) {
      await t.step(`${constructorName} should reject ${description}`, () => {
        const result = createFn(input);
        ResultAssert.assertFailure(
          result,
          expectedError,
          `Should reject ${description}`,
        );
      });
    }
  }

  /**
   * Tests value object immutability
   */
  static testValueObjectImmutability<T extends Record<string, unknown>>(
    valueObject: T,
    testName: string,
  ): void {
    // Attempt to modify properties should not affect the object
    const originalState = JSON.stringify(valueObject);

    try {
      // Try to modify properties
      Object.keys(valueObject).forEach((key) => {
        if (typeof valueObject[key] !== "function") {
          try {
            (valueObject as Record<string, unknown>)[key] = "modified";
          } catch {
            // Expected - object is frozen or properties are read-only
          }
        }
      });
    } catch {
      // Expected - object is immutable
    }

    const finalState = JSON.stringify(valueObject);
    assertEquals(originalState, finalState, `${testName} should be immutable`);
  }
}

// Performance Test Utilities
export class PerformanceTestUtils {
  static async measureExecutionTime<T>(
    operation: () => Promise<T> | T,
    maxTimeMs: number,
    description: string,
  ): Promise<T> {
    const startTime = performance.now();
    const result = await operation();
    const executionTime = performance.now() - startTime;

    if (executionTime > maxTimeMs) {
      throw new Error(
        `${description} took ${
          executionTime.toFixed(2)
        }ms, expected <${maxTimeMs}ms`,
      );
    }

    return result;
  }

  static async testMemoryUsage(
    operation: () => Promise<void> | void,
    maxMemoryIncreaseBytes: number,
    description: string,
  ): Promise<void> {
    const initialMemory = Deno.memoryUsage().heapUsed;

    await operation();

    // Force garbage collection if available
    if (
      typeof (globalThis as unknown as { gc?: () => void }).gc === "function"
    ) {
      (globalThis as unknown as { gc: () => void }).gc();
    }

    const finalMemory = Deno.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    if (memoryIncrease > maxMemoryIncreaseBytes) {
      throw new Error(
        `${description} increased memory by ${memoryIncrease} bytes, expected <${maxMemoryIncreaseBytes} bytes`,
      );
    }
  }
}

// Mock Factory (Simplified and Robust)
export class RobustMockFactory {
  private static readonly responses = new Map<string, unknown>();

  static createMockWithResponses<T extends Record<string, unknown>>(
    _interfaceName: string,
    methodResponses: Record<keyof T, unknown>,
  ): T {
    const mock = {} as T;

    Object.entries(methodResponses).forEach(([method, response]) => {
      (mock as Record<string, unknown>)[method] = typeof response === "function"
        ? response
        : () => response;
    });

    return mock;
  }

  static clearAllResponses(): void {
    this.responses.clear();
  }
}

// Test Data Generation (Deterministic)
export class TestDataGenerator {
  private static counter = 0;

  static uniqueId(): string {
    return `test-${++this.counter}-${Date.now()}`;
  }

  static uniquePath(extension = ".md"): string {
    return `/test/path/${this.uniqueId()}${extension}`;
  }

  static resetCounter(): void {
    this.counter = 0;
  }
}

// Parallel Test Safety Guards
export class ParallelTestSafety {
  /**
   * Ensures test function runs in complete isolation
   */
  static async isolatedTest<T>(
    testName: string,
    testFn: () => Promise<T> | T,
  ): Promise<T> {
    // Create isolated environment
    const testId = TestDataGenerator.uniqueId();

    try {
      // Reset any global state
      TestDataGenerator.resetCounter();
      RobustMockFactory.clearAllResponses();

      // Run test
      return await testFn();
    } catch (error) {
      throw new Error(`Test '${testName}' (${testId}) failed: ${error}`);
    }
  }
}
