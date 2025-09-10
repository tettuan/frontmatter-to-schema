/**
 * Domain Test Helpers - Robust Testing Utilities
 *
 * Provides consistent, idempotent test helpers following DDD and Totality principles.
 * Ensures reproducible test environments and proper domain boundary isolation.
 */

import { assertEquals, assertExists } from "@std/assert";
import type { Result } from "../../src/domain/core/result.ts";
import type { DomainError } from "../../src/domain/core/result.ts";

/**
 * Result Type Test Helpers
 *
 * Provides robust testing patterns for Result<T, E> types following Totality principles.
 */
export class ResultTestHelpers {
  /**
   * Assert that a Result is successful and return the data
   * Eliminates repetitive result.ok checking in tests
   */
  static assertSuccess<T, E>(
    result: Result<T, E>,
    message?: string,
  ): T {
    assertEquals(
      result.ok,
      true,
      message ||
        `Expected successful result, got error: ${
          JSON.stringify(result.ok ? null : result.error)
        }`,
    );
    if (result.ok) {
      return result.data;
    }
    // This line should never execute due to assertEquals above, but TypeScript requires it
    throw new Error("Type assertion failed - this should be unreachable");
  }

  /**
   * Assert that a Result is an error and return the error
   */
  static assertError<T, E>(
    result: Result<T, E>,
    expectedErrorKind?: string,
    message?: string,
  ): E {
    assertEquals(
      result.ok,
      false,
      message ||
        `Expected error result, got success: ${
          JSON.stringify(result.ok ? result.data : null)
        }`,
    );

    if (!result.ok) {
      if (
        expectedErrorKind && typeof result.error === "object" &&
        result.error !== null && "kind" in result.error
      ) {
        assertEquals(
          (result.error as DomainError).kind,
          expectedErrorKind,
          `Expected error kind '${expectedErrorKind}', got '${
            (result.error as DomainError).kind
          }'`,
        );
      }
      return result.error;
    }
    throw new Error("Type assertion failed - this should be unreachable");
  }

  /**
   * Test both success and error paths for Result-returning functions
   */
  static testResultPaths<T, E>(
    testName: string,
    successCase: () => Result<T, E>,
    errorCase: () => Result<T, E>,
    successValidator: (data: T) => void,
    errorValidator: (error: E) => void,
  ): void {
    Deno.test(`${testName} - success path`, () => {
      const result = successCase();
      const data = ResultTestHelpers.assertSuccess(result);
      successValidator(data);
    });

    Deno.test(`${testName} - error path`, () => {
      const result = errorCase();
      const error = ResultTestHelpers.assertError(result);
      errorValidator(error);
    });
  }
}

/**
 * Domain Data Factory - Idempotent Test Data Creation
 *
 * Provides consistent test data that doesn't change between test runs.
 * Follows DDD value object patterns for reliable test scenarios.
 */
export class DomainDataFactory {
  /**
   * Create consistent schema test data
   */
  static createTestSchema(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        title: { type: "string" },
        tags: {
          type: "array",
          items: { type: "string" },
        },
        metadata: {
          type: "object",
          properties: {
            author: { type: "string" },
            created: { type: "string", format: "date-time" },
          },
        },
      },
      required: ["title"],
      ...overrides,
    };
  }

  /**
   * Create test frontmatter data
   */
  static createTestFrontmatter(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      title: "Test Document",
      tags: ["test", "example"],
      metadata: {
        author: "Test Author",
        created: "2023-01-01T00:00:00Z",
      },
      ...overrides,
    };
  }

  /**
   * Create test document content with frontmatter
   */
  static createTestDocument(
    frontmatter: Record<string, unknown> = {},
    content = "# Test Content\n\nThis is test content.",
  ): string {
    const fm = { ...DomainDataFactory.createTestFrontmatter(), ...frontmatter };
    const yamlFrontmatter = Object.entries(fm)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");

    return `---\n${yamlFrontmatter}\n---\n\n${content}`;
  }

  /**
   * Create test aggregation rules with consistent data
   */
  static createTestAggregationRules() {
    return {
      simple: {
        targetField: "allTitles",
        sourceExpression: "$.title",
        options: { unique: false, flatten: false },
      },
      unique: {
        targetField: "uniqueTags",
        sourceExpression: "$.tags[*]",
        options: { unique: true, flatten: true },
      },
      nested: {
        targetField: "authors.names",
        sourceExpression: "$.metadata.author",
        options: { unique: true, flatten: false },
      },
    };
  }
}

/**
 * Mock Factory - Consistent Mock Creation
 *
 * Provides predictable mocks that maintain the same behavior across test runs.
 * Follows dependency injection patterns for proper domain isolation.
 */
export class MockFactory {
  /**
   * Create a mock file system provider with predictable behavior
   */
  static createMockFileSystem(files: Map<string, string> = new Map()) {
    const mockFiles = new Map(files);

    return {
      readFile(path: string): Promise<Result<string, DomainError>> {
        if (mockFiles.has(path)) {
          return Promise.resolve({ ok: true, data: mockFiles.get(path)! });
        }
        return Promise.resolve({
          ok: false,
          error: { kind: "FileNotFound", path: path } as DomainError,
        });
      },

      writeFile(
        path: string,
        content: string,
      ): Promise<Result<void, DomainError>> {
        mockFiles.set(path, content);
        return Promise.resolve({ ok: true, data: undefined });
      },

      exists(path: string): Promise<boolean> {
        return Promise.resolve(mockFiles.has(path));
      },

      // Helper for test setup
      setFile(path: string, content: string) {
        mockFiles.set(path, content);
      },

      // Helper for test cleanup
      clear() {
        mockFiles.clear();
      },
    };
  }

  /**
   * Create a mock logger that captures messages for testing
   */
  static createMockLogger() {
    const messages: Array<
      { level: string; message: string; context?: unknown }
    > = [];

    return {
      info(message: string, context?: unknown) {
        messages.push({ level: "info", message, context });
      },

      error(message: string, context?: unknown) {
        messages.push({ level: "error", message, context });
      },

      warn(message: string, context?: unknown) {
        messages.push({ level: "warn", message, context });
      },

      debug(message: string, context?: unknown) {
        messages.push({ level: "debug", message, context });
      },

      // Test helpers
      getMessages() {
        return [...messages];
      },

      getMessagesByLevel(level: string) {
        return messages.filter((m) => m.level === level);
      },

      clear() {
        messages.length = 0;
      },
    };
  }
}

/**
 * Test Environment Helper - Reproducible Test Conditions
 *
 * Ensures tests run in consistent, isolated environments.
 * Provides cleanup and setup patterns for robust testing.
 */
export class TestEnvironment {
  private static cleanupTasks: Array<() => Promise<void> | void> = [];

  /**
   * Register a cleanup task to run after tests
   */
  static addCleanup(task: () => Promise<void> | void): void {
    TestEnvironment.cleanupTasks.push(task);
  }

  /**
   * Run all cleanup tasks and clear the list
   */
  static async cleanup(): Promise<void> {
    for (const task of TestEnvironment.cleanupTasks) {
      try {
        await task();
      } catch (error) {
        console.warn("Cleanup task failed:", error);
      }
    }
    TestEnvironment.cleanupTasks.length = 0;
  }

  /**
   * Create isolated test directory (useful for integration tests)
   */
  static async createTempDir(prefix = "test-"): Promise<string> {
    const tempDir = await Deno.makeTempDir({ prefix });
    TestEnvironment.addCleanup(async () => {
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    });
    return tempDir;
  }

  /**
   * Set up test with automatic cleanup
   */
  static withCleanup<T>(
    testFn: () => Promise<T> | T,
    cleanupFn: () => Promise<void> | void,
  ): () => Promise<T> {
    return async () => {
      try {
        return await testFn();
      } finally {
        await cleanupFn();
      }
    };
  }
}

/**
 * Domain Assertion Helpers - Semantic Test Assertions
 *
 * Provides domain-specific assertions that make tests more readable
 * and maintainable. Follows DDD ubiquitous language patterns.
 */
export class DomainAssertions {
  /**
   * Assert that a value object is valid according to its domain rules
   */
  static assertValidValueObject<T>(
    valueObject: T,
    validator: (obj: T) => boolean,
    message?: string,
  ): void {
    assertEquals(
      validator(valueObject),
      true,
      message ||
        `Value object failed domain validation: ${JSON.stringify(valueObject)}`,
    );
  }

  /**
   * Assert that a schema matches expected structure
   */
  static assertSchemaStructure(
    schema: unknown,
    expectedProperties: string[],
    message?: string,
  ): void {
    assertExists(schema, "Schema should exist");
    assertEquals(
      typeof schema,
      "object",
      "Schema should be an object",
    );

    const schemaObj = schema as Record<string, unknown>;
    const properties = schemaObj.properties as Record<string, unknown> || {};

    for (const prop of expectedProperties) {
      assertExists(
        properties[prop],
        message || `Schema should have property '${prop}'`,
      );
    }
  }

  /**
   * Assert that aggregation results contain expected data structure
   */
  static assertAggregationResult(
    result: unknown,
    expectedFields: string[],
    message?: string,
  ): void {
    assertExists(result, "Aggregation result should exist");
    assertEquals(
      typeof result,
      "object",
      "Aggregation result should be an object",
    );

    const resultObj = result as Record<string, unknown>;
    for (const field of expectedFields) {
      assertExists(
        resultObj[field],
        message || `Aggregation result should have field '${field}'`,
      );
    }
  }
}
