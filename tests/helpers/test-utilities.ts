/**
 * Test Utilities for DDD Architecture Testing
 * Provides reusable helpers following Totality principles and reproducibility
 */

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  type AnalysisError,
  createDomainError,
  type Result,
  type ValidationError,
} from "../../src/domain/core/result.ts";
import {
  type AnalysisContext,
  AnalysisResult,
} from "../../src/domain/core/types.ts";
import {
  DocumentPath,
  FrontMatterContent,
} from "../../src/domain/models/value-objects.ts";
import { SchemaDefinition } from "../../src/domain/models/schema.ts";
// Note: DocumentPath and DocumentPath replaced with DocumentPath
import { Registry } from "../../src/domain/core/registry.ts";
import {
  getBreakdownLogger,
  type TestScopeLogger,
} from "./breakdown-logger.ts";

// Test Data Builders following Builder pattern for robust test data creation
export class TestDataBuilder {
  /**
   * Creates a valid file path for testing
   */
  static validFilePath(path = "/test/sample.md"): DocumentPath {
    const result = DocumentPath.create(path);
    if (!result.ok) {
      throw new Error(
        `Failed to create test DocumentPath: ${result.error.kind}`,
      );
    }
    return result.data;
  }

  /**
   * Creates a markdown file path for testing
   */
  static markdownFilePath(path = "/test/sample.md"): DocumentPath {
    const result = DocumentPath.create(path);
    if (!result.ok) {
      throw new Error(
        `Failed to create test markdown DocumentPath: ${result.error.kind}`,
      );
    }
    return result.data;
  }

  /**
   * Creates FrontMatterContent from object for testing
   */
  static frontMatterContent(
    data: Record<string, unknown> = { title: "Test" },
  ): FrontMatterContent {
    const result = FrontMatterContent.fromObject(data);
    if (!result.ok) {
      throw new Error(
        `Failed to create test FrontMatterContent: ${result.error.kind}`,
      );
    }
    return result.data;
  }

  /**
   * Creates FrontMatterContent from YAML string for testing
   */
  static frontMatterFromYaml(yaml: string): FrontMatterContent {
    const result = FrontMatterContent.fromYaml(yaml);
    if (!result.ok) {
      throw new Error(
        `Failed to create test FrontMatterContent from YAML: ${result.error.kind}`,
      );
    }
    return result.data;
  }

  /**
   * Creates SchemaDefinition for testing
   */
  static schemaDefinition(
    schema: unknown = { type: "object" },
  ): SchemaDefinition {
    const result = SchemaDefinition.create(schema, "json");
    if (!result.ok) {
      throw new Error(
        `Failed to create test SchemaDefinition: ${result.error.kind}`,
      );
    }
    return result.data;
  }

  /**
   * Creates DocumentPath for testing (simplified - just returns path)
   * Note: DocumentPath only contains path, not content or frontmatter
   */
  static sourceFile(
    path = "/test/sample.md",
    _content = "# Test Content",
    _frontMatter?: Record<string, unknown>,
  ): DocumentPath {
    // DocumentPath is just a path, not a full document
    // Return the path for backward compatibility
    return this.validFilePath(path);
  }

  /**
   * Creates AnalysisResult for testing
   */
  static analysisResult<T>(
    path = "/test/sample.md",
    extractedData: T = { title: "Test" } as T,
    metadata?: Map<string, unknown>,
  ): AnalysisResult<T> {
    const validPath = this.validFilePath(path);
    const result = new AnalysisResult(validPath, extractedData);
    // Add metadata separately if provided
    if (metadata) {
      for (const [key, value] of metadata) {
        result.addMetadata(key, value);
      }
    }
    return result;
  }
}

// Result Assertion Helpers for type-safe testing
export class ResultAssertions {
  private static logger = getBreakdownLogger();

  /**
   * Asserts that a Result is successful and returns the data
   */
  static assertSuccess<T, E>(result: Result<T, E>, message?: string): T {
    const testContext = {
      testName: "ResultAssertion",
      phase: "assert" as const,
      operation: "assertSuccess",
    };

    if (this.logger.isEnabled()) {
      // Type-safe wrapper for logResult with message constraint
      const resultWithMessage = result.ok
        ? { ok: true as const, data: result.data }
        : {
          ok: false as const,
          error: { message: JSON.stringify(result.error) },
        };
      this.logger.logResult(testContext, resultWithMessage, message);
    }

    assertEquals(
      result.ok,
      true,
      message || "Expected result to be successful",
    );
    if (result.ok) {
      return result.data;
    }
    throw new Error("Type narrowing failed - this should not happen");
  }

  /**
   * Asserts that a Result is an error and returns the error
   */
  static assertError<T, E extends { message: string }>(
    result: Result<T, E>,
    expectedErrorKind?: string,
    message?: string,
  ): E {
    const testContext = {
      testName: "ResultAssertion",
      phase: "assert" as const,
      operation: "assertError",
    };

    if (this.logger.isEnabled()) {
      // Result already has the right type constraint for E
      const resultWithMessage = result.ok
        ? { ok: true as const, data: result.data }
        : { ok: false as const, error: result.error };
      this.logger.logResult(testContext, resultWithMessage, message);
    }

    assertEquals(result.ok, false, message || "Expected result to be an error");
    if (!result.ok) {
      if (expectedErrorKind && "kind" in result.error) {
        assertEquals(
          (result.error as ValidationError & { kind: string }).kind,
          expectedErrorKind,
          `Expected error kind to be ${expectedErrorKind}`,
        );
      }
      return result.error;
    }
    throw new Error("Type narrowing failed - this should not happen");
  }

  /**
   * Asserts that a ValidationError has the expected kind
   */
  static assertValidationError(
    result: Result<unknown, ValidationError & { message: string }>,
    expectedKind: ValidationError["kind"],
    message?: string,
  ): ValidationError & { message: string } {
    const error = this.assertError(result, expectedKind, message);
    assertEquals(
      error.kind,
      expectedKind,
      `Expected validation error kind to be ${expectedKind}`,
    );
    return error;
  }

  /**
   * Asserts that an AnalysisError has the expected kind
   */
  static assertAnalysisError(
    result: Result<unknown, AnalysisError & { message: string }>,
    expectedKind: AnalysisError["kind"],
    message?: string,
  ): AnalysisError & { message: string } {
    const error = this.assertError(result, expectedKind, message);
    assertEquals(
      error.kind,
      expectedKind,
      `Expected analysis error kind to be ${expectedKind}`,
    );
    return error;
  }
}

// Mock Implementations for Testing
export class MockAnalysisStrategy<TInput, TOutput> {
  readonly name: string;
  private shouldSucceed: boolean;
  private resultData?: TOutput;
  private errorKind?: AnalysisError["kind"];

  constructor(
    name: string,
    options: {
      shouldSucceed?: boolean;
      resultData?: TOutput;
      errorKind?: AnalysisError["kind"];
    } = {},
  ) {
    this.name = name;
    this.shouldSucceed = options.shouldSucceed ?? true;
    this.resultData = options.resultData;
    this.errorKind = options.errorKind || "ExtractionStrategyFailed";
  }

  execute(
    input: TInput,
    _context: AnalysisContext,
  ): Promise<Result<TOutput, AnalysisError & { message: string }>> {
    if (this.shouldSucceed && this.resultData !== undefined) {
      return Promise.resolve({ ok: true, data: this.resultData });
    }

    return Promise.resolve({
      ok: false,
      error: createDomainError({
        kind: this.errorKind,
        strategy: this.name,
        input,
      } as AnalysisError),
    });
  }

  // Helper methods for test control
  setSuccess(success: boolean, data?: TOutput): this {
    this.shouldSucceed = success;
    if (data !== undefined) {
      this.resultData = data;
    }
    return this;
  }

  setError(errorKind: AnalysisError["kind"]): this {
    this.shouldSucceed = false;
    this.errorKind = errorKind;
    return this;
  }
}

// Test Context Factories
export class TestContextFactory {
  /**
   * Creates a SchemaAnalysis context for testing
   */
  static schemaAnalysis(
    schema?: SchemaDefinition,
    options = { includeMetadata: true },
    document = "/test/sample.md",
  ): AnalysisContext {
    return {
      kind: "SchemaAnalysis",
      document,
      schema: schema || TestDataBuilder.schemaDefinition(),
      options,
    };
  }

  /**
   * Creates a TemplateMapping context for testing
   */
  static templateMapping(
    template = { template: "test", variables: { name: "test" } },
    schema?: SchemaDefinition,
    document = "/test/sample.md",
  ): AnalysisContext {
    const context: AnalysisContext = {
      kind: "TemplateMapping",
      document,
      template,
    };

    if (schema) {
      (context as AnalysisContext & { schema?: SchemaDefinition }).schema =
        schema;
    }

    return context;
  }

  /**
   * Creates a ValidationOnly context for testing
   */
  static validationOnly(
    schema?: SchemaDefinition,
    document = "/test/sample.md",
  ): AnalysisContext {
    const schemaObj = schema || TestDataBuilder.schemaDefinition();
    return {
      kind: "ValidationOnly",
      document,
      schema: {
        validate: (data: unknown) => ({ ok: true, data }),
        schema: schemaObj.getDefinition(),
      },
    };
  }

  /**
   * Creates a BasicExtraction context for testing
   */
  static basicExtraction(
    options = { includeMetadata: true },
    document = "/test/sample.md",
  ): AnalysisContext {
    return {
      kind: "BasicExtraction",
      document,
      options,
    };
  }
}

// Sample frontmatter type definition
interface SampleFrontMatter {
  version: number;
  active: boolean;
  domain: string;
  action: string;
  target: string;
  description: string;
  complexity: string;
  tags: string[];
}

// Sample Data Generators for consistent testing
export class SampleDataGenerator {
  /**
   * Generates sample frontmatter data for different domains
   */
  static frontMatter(
    domain: "git" | "spec" | "build" | "test" | "docs" = "git",
  ): SampleFrontMatter {
    const baseData = {
      version: 1.0,
      active: true,
      tags: ["test"],
    };

    switch (domain) {
      case "git":
        return {
          ...baseData,
          domain: "git",
          action: "create",
          target: "pull-request",
          description: "Create a pull request for code review",
          complexity: "medium",
          tags: ["git", "collaboration", "review"],
        };

      case "spec":
        return {
          ...baseData,
          domain: "spec",
          action: "analyze",
          target: "requirements",
          description: "Analyze project requirements and dependencies",
          complexity: "high",
          tags: ["spec", "analysis", "requirements"],
        };

      case "build":
        return {
          ...baseData,
          domain: "build",
          action: "validate",
          target: "config",
          description: "Validate build configuration files",
          complexity: "low",
          tags: ["build", "validation", "config"],
        };

      case "test":
        return {
          ...baseData,
          domain: "test",
          action: "run",
          target: "unit-tests",
          description: "Run unit tests for the project",
          complexity: "medium",
          tags: ["test", "unit", "validation"],
        };

      case "docs":
        return {
          ...baseData,
          domain: "docs",
          action: "generate",
          target: "api-docs",
          description: "Generate API documentation from code",
          complexity: "low",
          tags: ["docs", "api", "generation"],
        };

      default:
        return {
          ...baseData,
          domain: "unknown",
          action: "unknown",
          target: "unknown",
          description: "Unknown command type",
          complexity: "unknown",
          tags: ["unknown"],
        };
    }
  }

  /**
   * Generates sample markdown content with frontmatter
   */
  static markdownWithFrontMatter(
    domain: "git" | "spec" | "build" | "test" | "docs" = "git",
  ): string {
    const frontMatter = this.frontMatter(domain);
    const yamlLines = Object.entries(frontMatter).map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map((v) => `"${v}"`).join(", ")}]`;
      } else if (typeof value === "string") {
        return `${key}: "${value}"`;
      } else {
        return `${key}: ${value}`;
      }
    });

    return `---
${yamlLines.join("\n")}
---

# ${frontMatter.domain.charAt(0).toUpperCase() + frontMatter.domain.slice(1)} ${
      frontMatter.action.charAt(0).toUpperCase() + frontMatter.action.slice(1)
    } Command

${frontMatter.description}

## Usage

This command performs ${frontMatter.action} operations for ${frontMatter.target}.

\`\`\`bash
climpt-${frontMatter.domain} ${frontMatter.action} ${frontMatter.target}
\`\`\`

## Options

- \`--help\`: Show help information
- \`--verbose\`: Enable verbose output
- \`--dry-run\`: Preview changes without executing

## Examples

\`\`\`bash
# Basic usage
climpt-${frontMatter.domain} ${frontMatter.action} ${frontMatter.target}

# With options
climpt-${frontMatter.domain} ${frontMatter.action} ${frontMatter.target} --verbose --dry-run
\`\`\`
`;
  }

  /**
   * Generates sample command schema
   */
  static commandSchema() {
    return {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["git", "spec", "build", "test", "docs"],
        },
        action: {
          type: "string",
          enum: [
            "create",
            "update",
            "delete",
            "analyze",
            "validate",
            "run",
            "generate",
          ],
        },
        target: { type: "string" },
        description: { type: "string" },
        complexity: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        tags: {
          type: "array",
          items: { type: "string" },
        },
        version: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["domain", "action", "target", "description"],
    };
  }

  /**
   * Generates sample command template
   */
  static commandTemplate() {
    return {
      structure: {
        c1: "unknown",
        c2: "unknown",
        c3: "unknown",
        description: "No description",
        metadata: {
          complexity: "medium",
          version: "1.0",
          active: true,
          tags: [],
          processedAt: new Date().toISOString(),
        },
      },
      mappingRules: {
        c1: "domain",
        c2: "action",
        c3: "target",
      },
    };
  }
}

// Performance Testing Utilities
export class PerformanceTestUtils {
  private static logger = getBreakdownLogger();

  /**
   * Measures execution time of an async function
   */
  static async measureTime<T>(
    fn: () => Promise<T>,
    description = "Operation",
  ): Promise<{ result: T; duration: number; throughput?: number }> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;

    if (this.logger.isEnabled()) {
      this.logger.info(
        {
          testName: "PerformanceTest",
          phase: "act",
          operation: "measureTime",
        },
        `${description}: ${duration.toFixed(2)}ms`,
        { duration },
      );
    } else {
      console.log(`${description}: ${duration.toFixed(2)}ms`);
    }

    return { result, duration };
  }

  /**
   * Runs a performance test with multiple iterations
   */
  static async benchmarkFunction<T>(
    fn: () => Promise<T>,
    iterations = 100,
    description = "Benchmark",
  ): Promise<{
    results: T[];
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    throughput: number;
  }> {
    const times: number[] = [];
    const results: T[] = [];

    console.log(
      `Running ${description} benchmark with ${iterations} iterations...`,
    );

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measureTime(fn, "");
      times.push(duration);
      results.push(result);
    }

    const totalTime = times.reduce((sum, time) => sum + time, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = 1000 / averageTime; // operations per second

    console.log(`${description} Results:`);
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Average time: ${averageTime.toFixed(2)}ms`);
    console.log(`  Min time: ${minTime.toFixed(2)}ms`);
    console.log(`  Max time: ${maxTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${throughput.toFixed(2)} ops/sec`);

    return {
      results,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      throughput,
    };
  }

  /**
   * Asserts performance constraints
   */
  static assertPerformance(
    actualTime: number,
    maxTime: number,
    description = "Operation",
  ): void {
    assertEquals(
      actualTime <= maxTime,
      true,
      `${description} took ${
        actualTime.toFixed(2)
      }ms, which exceeds the maximum of ${maxTime}ms`,
    );
  }
}

// Test Structure with BreakdownLogger Support
export class TestWithBreakdown {
  private logger: TestScopeLogger;

  constructor(testName: string, domain?: string) {
    this.logger = getBreakdownLogger().createTestScope(testName, domain);
  }

  /**
   * Run a test with structured phases and automatic logging
   */
  async runTest<T>(
    arrange: () => Promise<unknown> | unknown,
    act: () => Promise<T> | T,
    assert: (result: T) => Promise<void> | void,
    cleanup?: () => Promise<void> | void,
  ): Promise<void> {
    // Arrange phase
    this.logger.startTimer("arrange");
    this.logger.arrange("Starting arrange phase");
    try {
      await arrange();
      this.logger.endTimer("arrange", "Arrange phase completed");
    } catch (error) {
      this.logger.endTimer("arrange", `Arrange phase failed: ${error}`);
      throw error;
    }

    // Act phase
    this.logger.startTimer("act");
    this.logger.act("Starting act phase");
    let result: T;
    try {
      result = await act();
      this.logger.endTimer("act", "Act phase completed");
    } catch (error) {
      this.logger.endTimer("act", `Act phase failed: ${error}`);
      throw error;
    }

    // Assert phase
    this.logger.startTimer("assert");
    this.logger.assert("Starting assert phase");
    try {
      await assert(result);
      this.logger.endTimer("assert", "Assert phase completed");
    } catch (error) {
      this.logger.endTimer("assert", `Assert phase failed: ${error}`);
      throw error;
    }

    // Cleanup phase (if provided)
    if (cleanup) {
      this.logger.startTimer("cleanup");
      this.logger.cleanup("Starting cleanup phase");
      try {
        await cleanup();
        this.logger.endTimer("cleanup", "Cleanup phase completed");
      } catch (error) {
        this.logger.endTimer("cleanup", `Cleanup phase failed: ${error}`);
        throw error;
      }
    }
  }

  /**
   * Get the scoped logger for custom logging
   */
  getLogger(): TestScopeLogger {
    return this.logger;
  }
}

// Test Cleanup Utilities
export class TestCleanup {
  private static cleanupTasks: (() => void | Promise<void>)[] = [];

  /**
   * Registers a cleanup task to be run after test completion
   */
  static register(task: () => void | Promise<void>): void {
    this.cleanupTasks.push(task);
  }

  /**
   * Runs all registered cleanup tasks
   */
  static async runAll(): Promise<void> {
    for (const task of this.cleanupTasks) {
      await task();
    }
    this.cleanupTasks.length = 0;
  }

  /**
   * Creates a temporary test registry that auto-cleans
   */
  static createTempRegistry<T>(): Registry<T> {
    const registry = new Registry<T>();

    this.register(() => {
      registry.clear();
    });

    return registry;
  }
}
