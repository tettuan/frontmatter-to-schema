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
  FrontMatterContent,
  SchemaDefinition,
  SourceFile,
  ValidFilePath,
} from "../../src/domain/core/types.ts";
import { Registry } from "../../src/domain/core/registry.ts";

// Test Data Builders following Builder pattern for robust test data creation
export class TestDataBuilder {
  /**
   * Creates a valid file path for testing
   */
  static validFilePath(path = "/test/sample.md"): ValidFilePath {
    const result = ValidFilePath.create(path);
    if (!result.ok) {
      throw new Error(
        `Failed to create test ValidFilePath: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Creates a markdown file path for testing
   */
  static markdownFilePath(path = "/test/sample.md"): ValidFilePath {
    const result = ValidFilePath.createMarkdown(path);
    if (!result.ok) {
      throw new Error(
        `Failed to create test markdown ValidFilePath: ${result.error.message}`,
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
        `Failed to create test FrontMatterContent: ${result.error.message}`,
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
        `Failed to create test FrontMatterContent from YAML: ${result.error.message}`,
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
    const result = SchemaDefinition.create(schema);
    if (!result.ok) {
      throw new Error(
        `Failed to create test SchemaDefinition: ${result.error.message}`,
      );
    }
    return result.data;
  }

  /**
   * Creates SourceFile for testing
   */
  static sourceFile(
    path = "/test/sample.md",
    content = "# Test Content",
    frontMatter?: Record<string, unknown>,
  ): SourceFile {
    const validPath = this.validFilePath(path);
    const frontMatterContent = frontMatter
      ? this.frontMatterContent(frontMatter)
      : undefined;

    const result = SourceFile.create(validPath, content, frontMatterContent);
    if (!result.ok) {
      throw new Error(
        `Failed to create test SourceFile: ${result.error.message}`,
      );
    }
    return result.data;
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
    return new AnalysisResult(validPath, extractedData, metadata);
  }
}

// Result Assertion Helpers for type-safe testing
export class ResultAssertions {
  /**
   * Asserts that a Result is successful and returns the data
   */
  static assertSuccess<T, E>(result: Result<T, E>, message?: string): T {
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
  ): AnalysisContext {
    return {
      kind: "SchemaAnalysis",
      schema: schema || TestDataBuilder.schemaDefinition(),
      options,
    };
  }

  /**
   * Creates a TemplateMapping context for testing
   */
  static templateMapping(
    template = { structure: { name: "test" } },
    schema?: SchemaDefinition,
  ): AnalysisContext {
    const context: AnalysisContext = {
      kind: "TemplateMapping",
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
  static validationOnly(schema?: SchemaDefinition): AnalysisContext {
    return {
      kind: "ValidationOnly",
      schema: schema || TestDataBuilder.schemaDefinition(),
    };
  }

  /**
   * Creates a BasicExtraction context for testing
   */
  static basicExtraction(options = { includeMetadata: true }): AnalysisContext {
    return {
      kind: "BasicExtraction",
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

    console.log(`${description}: ${duration.toFixed(2)}ms`);

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
