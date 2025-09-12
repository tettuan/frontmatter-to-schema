/**
 * Test Processor Factory
 *
 * Centralized factory for creating DocumentProcessor instances in tests
 * Eliminates code duplication across 23+ test locations
 * Follows DDD principles and Totality patterns for type safety
 *
 * Part of Issue #664: Test Setup Duplication Refactoring
 */

import type { Result } from "../../src/domain/core/result.ts";
import { DocumentProcessor } from "../../src/application/document-processor.ts";
import { DenoFileSystemProvider } from "../../src/application/climpt/climpt-adapter.ts";
import { FrontMatterExtractorImpl } from "../../src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import { SchemaValidator } from "../../src/domain/services/schema-validator.ts";
import { UnifiedTemplateProcessor } from "../../src/domain/template/services/unified-template-processor.ts";

/**
 * Test setup error types following discriminated union pattern
 */
export type TestSetupError =
  | { kind: "TemplateProcessorCreationFailed"; message: string }
  | { kind: "DependencyInjectionFailed"; message: string; component: string };

/**
 * Smart Constructor Factory for DocumentProcessor test instances
 * Eliminates duplication and provides type-safe test setup
 */
export class TestProcessorFactory {
  private constructor() {
    // Prevent instantiation - static factory only
  }

  /**
   * Create DocumentProcessor with full error handling (Totality compliant)
   * Returns Result type for proper error handling
   */
  static create(): Result<DocumentProcessor, TestSetupError> {
    try {
      // Create dependencies with proper error handling
      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();

      // Handle UnifiedTemplateProcessor creation (known fallible operation)
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      if (
        !templateProcessorResult || typeof templateProcessorResult !== "object"
      ) {
        return {
          ok: false,
          error: {
            kind: "TemplateProcessorCreationFailed",
            message:
              "UnifiedTemplateProcessor.create() returned invalid result",
          },
        };
      }

      // Verify templateProcessor has expected interface
      const templateProcessor =
        templateProcessorResult as UnifiedTemplateProcessor;
      if (!templateProcessor) {
        return {
          ok: false,
          error: {
            kind: "TemplateProcessorCreationFailed",
            message: "Template processor instance is null or undefined",
          },
        };
      }

      // Create DocumentProcessor with validated dependencies using Smart Constructor
      const processorResult = DocumentProcessor.create(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor,
      );

      if (!processorResult.ok) {
        return {
          ok: false,
          error: {
            kind: "DependencyInjectionFailed",
            message:
              `DocumentProcessor creation failed: ${processorResult.error.message}`,
            component: "DocumentProcessor",
          },
        };
      }

      return {
        ok: true,
        data: processorResult.data,
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "DependencyInjectionFailed",
          message: error instanceof Error
            ? error.message
            : "Unknown error during setup",
          component: "DocumentProcessor",
        },
      };
    }
  }

  /**
   * Create DocumentProcessor with exception on failure (convenience method)
   * Use when test setup failure should terminate test execution
   */
  static createUnsafe(): DocumentProcessor {
    const result = this.create();
    if (!result.ok) {
      throw new Error(`Test setup failed: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Create DocumentProcessor with custom dependencies (advanced usage)
   * Allows dependency injection for specialized test scenarios
   */
  static createWithDependencies(
    fileSystem?: typeof DenoFileSystemProvider.prototype,
    frontMatterExtractor?: typeof FrontMatterExtractorImpl.prototype,
    schemaValidator?: typeof SchemaValidator.prototype,
    templateProcessor?: UnifiedTemplateProcessor,
  ): Result<DocumentProcessor, TestSetupError> {
    try {
      const defaultTemplateProcessor = templateProcessor ?? (() => {
        const result = UnifiedTemplateProcessor.create();
        if (!result) {
          throw new Error("Failed to create default template processor");
        }
        return result as UnifiedTemplateProcessor;
      })();

      const processorResult = DocumentProcessor.create(
        fileSystem ?? new DenoFileSystemProvider(),
        frontMatterExtractor ?? new FrontMatterExtractorImpl(),
        schemaValidator ?? new SchemaValidator(),
        defaultTemplateProcessor,
      );

      if (!processorResult.ok) {
        return {
          ok: false,
          error: {
            kind: "DependencyInjectionFailed",
            message:
              `DocumentProcessor creation failed: ${processorResult.error.message}`,
            component: "CustomDependencies",
          },
        };
      }

      return {
        ok: true,
        data: processorResult.data,
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "DependencyInjectionFailed",
          message: error instanceof Error ? error.message : "Unknown error",
          component: "CustomDependencies",
        },
      };
    }
  }
}
