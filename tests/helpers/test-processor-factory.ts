/**
 * Test Processor Factory
 *
 * Addresses Issue #664: Critical test setup duplication
 * Eliminates 25+ instances of repeated DocumentProcessor setup code
 * Reduces entropy from 8.2/10 to target 3.1/10 for maintainability
 */

import { DocumentProcessor } from "../../src/application/document-processor.ts";
import { DenoFileSystemProvider } from "../../src/application/climpt/climpt-adapter.ts";
import { FrontMatterExtractorImpl } from "../../src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import { SchemaValidator } from "../../src/domain/services/schema-validator.ts";
import { UnifiedTemplateProcessor } from "../../src/domain/template/index.ts";
import type { Result } from "../../src/domain/core/result.ts";
import type { DomainError } from "../../src/types.ts";
import type { FileSystemPort } from "../../src/infrastructure/ports/index.ts";
import type { FrontMatterExtractor } from "../../src/domain/services/interfaces.ts";

/**
 * Test processor factory providing consistent, validated setup
 * Eliminates duplication and ensures proper error handling
 */
export class TestProcessorFactory {
  private constructor() {}

  /**
   * Create a DocumentProcessor with all required dependencies
   * Replaces the 10-line setup pattern found in 25+ test locations
   *
   * @throws {Error} If template processor creation fails
   * @returns {DocumentProcessor} Fully configured processor ready for testing
   */
  static create(): DocumentProcessor {
    const fileSystem = new DenoFileSystemProvider();
    const frontMatterExtractor = new FrontMatterExtractorImpl();
    const schemaValidator = new SchemaValidator();
    const templateProcessorResult = UnifiedTemplateProcessor.create();

    if (!templateProcessorResult) {
      throw new Error(
        "Failed to create UnifiedTemplateProcessor in test setup. " +
          "This indicates a fundamental configuration issue that must be resolved.",
      );
    }

    return new DocumentProcessor(
      fileSystem,
      frontMatterExtractor,
      schemaValidator,
      templateProcessorResult as UnifiedTemplateProcessor,
    );
  }

  /**
   * Create processor with custom configuration options
   * Allows test-specific customization while maintaining consistency
   *
   * @param options Override options for specific test scenarios
   * @returns {DocumentProcessor} Configured processor with custom options
   */
  static createWithOptions(options: {
    fileSystem?: FileSystemPort;
    frontMatterExtractor?: FrontMatterExtractor;
    schemaValidator?: SchemaValidator;
    templateProcessor?: UnifiedTemplateProcessor;
  } = {}): DocumentProcessor {
    const fileSystem = options.fileSystem ?? new DenoFileSystemProvider();
    const frontMatterExtractor = options.frontMatterExtractor ??
      new FrontMatterExtractorImpl();
    const schemaValidator = options.schemaValidator ?? new SchemaValidator();

    let templateProcessor = options.templateProcessor;
    if (!templateProcessor) {
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      if (!templateProcessorResult) {
        throw new Error("Failed to create UnifiedTemplateProcessor");
      }
      templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
    }

    return new DocumentProcessor(
      fileSystem,
      frontMatterExtractor,
      schemaValidator,
      templateProcessor,
    );
  }
}

/**
 * Result assertion helpers for common test patterns
 * Provides consistent error checking and reduces test code duplication
 */
export class ResultAssertions {
  private constructor() {}

  /**
   * Assert that a result is successful and return the data
   * Provides type-safe success assertions with clear error messages
   *
   * @param result The result to check
   * @returns The unwrapped success data
   */
  static assertSuccess<T, E>(result: Result<T, E>): T {
    if (!result.ok) {
      throw new Error(
        `Expected successful result but got error: ${
          JSON.stringify(result.error)
        }`,
      );
    }
    return result.data;
  }

  /**
   * Assert that a result contains a specific error kind
   * Provides flexible error type checking for various test scenarios
   *
   * @param result The result to check
   * @param expectedKind The expected error kind
   */
  static assertErrorKind<T>(
    result: Result<T, DomainError>,
    expectedKind: string,
  ): void {
    if (result.ok) {
      throw new Error(
        `Expected error with kind "${expectedKind}" but got successful result`,
      );
    }

    if (result.error.kind !== expectedKind) {
      throw new Error(
        `Expected error kind "${expectedKind}" but got "${result.error.kind}"`,
      );
    }
  }
}

/**
 * Test configuration builder for complex test scenarios
 * Provides fluent API for building test configurations consistently
 */
export class TestConfigBuilder {
  private config: Record<string, unknown> = {};

  private constructor() {}

  static create(): TestConfigBuilder {
    return new TestConfigBuilder();
  }

  /**
   * Set schema path for test configuration
   */
  withSchemaPath(path: string): TestConfigBuilder {
    this.config.schemaPath = path;
    return this;
  }

  /**
   * Set template path for test configuration
   */
  withTemplatePath(path: string): TestConfigBuilder {
    this.config.templatePath = path;
    return this;
  }

  /**
   * Set input directory for test configuration
   */
  withInputDir(dir: string): TestConfigBuilder {
    this.config.inputDir = dir;
    return this;
  }

  /**
   * Set output path for test configuration
   */
  withOutputPath(path: string): TestConfigBuilder {
    this.config.outputPath = path;
    return this;
  }

  /**
   * Enable aggregation with optional settings
   */
  withAggregation(
    enabled: boolean = true,
    settings?: Record<string, unknown>,
  ): TestConfigBuilder {
    this.config.aggregation = { enabled, ...settings };
    return this;
  }

  /**
   * Build the final configuration object
   */
  build(): Record<string, unknown> {
    return { ...this.config };
  }
}

/**
 * Re-export commonly used testing utilities
 * Provides single import location for all test helpers
 */
export {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "jsr:@std/assert";
export { dirname, join } from "jsr:@std/path";
