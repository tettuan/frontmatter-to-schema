/**
 * @fileoverview FrontmatterDocumentProcessor - Domain Service for single document processing
 * @description Extracted from FrontmatterTransformationService to follow DDD boundaries
 * Following Frontmatter Context responsibilities for individual document processing workflow
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import type { DomainFileReader } from "../../shared/interfaces/file-operations.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";

/**
 * Configuration for frontmatter document processor dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterDocumentProcessorConfig {
  readonly processor: FrontmatterProcessor;
  readonly fileReader: DomainFileReader;
  readonly debugLogger?: DebugLogger;
}

/**
 * FrontmatterDocumentProcessor - Domain Service for Frontmatter Context
 *
 * Responsibilities:
 * - Single document processing workflow coordination
 * - File path validation and content reading
 * - Frontmatter extraction and validation
 * - Document entity creation and assembly
 *
 * Following DDD principles:
 * - Single responsibility: Individual document processing only
 * - Domain service: Cross-aggregate operations within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 */
export class FrontmatterDocumentProcessor {
  private constructor(
    private readonly config: FrontmatterDocumentProcessorConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates document processor with validated configuration
   */
  static create(
    config: FrontmatterDocumentProcessorConfig,
  ): Result<FrontmatterDocumentProcessor, DomainError & { message: string }> {
    if (!config?.processor) {
      return err(createError({
        kind: "InitializationError",
        message: "FrontmatterProcessor is required for document processor",
      }));
    }

    if (!config?.fileReader) {
      return err(createError({
        kind: "InitializationError",
        message: "DomainFileReader is required for document processor",
      }));
    }

    return ok(new FrontmatterDocumentProcessor(config));
  }

  /**
   * Process a single document through the complete workflow
   * Handles file reading, frontmatter extraction, validation, and entity creation
   * Following Totality principles with comprehensive error handling
   */
  processDocument(
    filePath: string,
    validationRules: ValidationRules,
  ): Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  > {
    this.config.debugLogger?.debug(
      `Starting processing of document: ${filePath}`,
      createLogContext({
        operation: "single-document",
        inputs: `filePath: ${filePath}`,
      }),
    );

    // Create file path value object
    const filePathResult = FilePath.create(filePath);
    if (!filePathResult.ok) {
      this.config.debugLogger?.error(
        `File path validation failed: ${filePathResult.error.message}`,
        createLogContext({
          operation: "file-path-validation",
          inputs: `filePath: ${filePath}`,
        }),
      );
      return filePathResult;
    }

    // Read file content
    this.config.debugLogger?.debug(
      `Reading file content: ${filePath}`,
      createLogContext({
        operation: "file-reading",
        inputs: `filePath: ${filePath}`,
      }),
    );

    const contentResult = this.config.fileReader.read(filePath);
    if (!contentResult.ok) {
      this.config.debugLogger?.error(
        `File reading failed: ${contentResult.error.message}`,
        createLogContext({
          operation: "file-reading",
          inputs: `filePath: ${filePath}`,
        }),
      );
      return contentResult;
    }

    // Extract frontmatter
    this.config.debugLogger?.debug(
      `Extracting frontmatter from: ${filePath}`,
      createLogContext({
        operation: "frontmatter-extraction",
        inputs: `filePath: ${filePath}`,
      }),
    );

    const extractResult = this.config.processor.extract(contentResult.data);
    if (!extractResult.ok) {
      this.config.debugLogger?.error(
        `Frontmatter extraction failed: ${extractResult.error.message}`,
        createLogContext({
          operation: "frontmatter-extraction",
          inputs: `filePath: ${filePath}`,
        }),
      );
      return extractResult;
    }

    const { frontmatter, body } = extractResult.data;
    this.config.debugLogger?.debug(
      `Successfully extracted frontmatter from: ${filePath}`,
      createLogContext({
        operation: "frontmatter-extraction",
        inputs: `filePath: ${filePath}, keys: ${
          Object.keys(frontmatter || {}).join(", ")
        }, bodyLength: ${body.length}`,
      }),
    );

    // Validate frontmatter
    this.config.debugLogger?.debug(
      `Validating frontmatter for: ${filePath}`,
      createLogContext({
        operation: "frontmatter-validation",
        inputs: `filePath: ${filePath}`,
      }),
    );

    // Debug: Check options before validation
    if ((frontmatter as any).options) {
      const options = (frontmatter as any).options;
      this.config.debugLogger?.debug(
        `Pre-validation options check`,
        createLogContext({
          operation: "options-check-pre",
          inputs: `filePath: ${filePath}, options: ${
            JSON.stringify({
              file: { type: typeof options.file, value: options.file },
              stdin: { type: typeof options.stdin, value: options.stdin },
              destination: {
                type: typeof options.destination,
                value: options.destination,
              },
            })
          }`,
        }),
      );
    }

    const validationResult = this.config.processor.validate(
      frontmatter,
      validationRules,
    );
    if (!validationResult.ok) {
      this.config.debugLogger?.error(
        `Frontmatter validation failed: ${validationResult.error.message}`,
        createLogContext({
          operation: "frontmatter-validation",
          inputs: `filePath: ${filePath}`,
        }),
      );
      return validationResult;
    }

    // Debug: Check options after validation
    if ((validationResult.data as any).options) {
      const options = (validationResult.data as any).options;
      this.config.debugLogger?.debug(
        `Post-validation options check`,
        createLogContext({
          operation: "options-check-post",
          inputs: `filePath: ${filePath}, options: ${
            JSON.stringify({
              file: { type: typeof options.file, value: options.file },
              stdin: { type: typeof options.stdin, value: options.stdin },
              destination: {
                type: typeof options.destination,
                value: options.destination,
              },
            })
          }`,
        }),
      );
    }

    this.config.debugLogger?.debug(
      `Successfully validated frontmatter for: ${filePath}`,
      createLogContext({
        operation: "frontmatter-validation",
        inputs: `filePath: ${filePath}`,
      }),
    );

    // Create document entity
    this.config.debugLogger?.debug(
      `Creating MarkdownDocument entity for: ${filePath}`,
      createLogContext({
        operation: "document-creation",
        inputs: `filePath: ${filePath}`,
      }),
    );

    const docResult = MarkdownDocument.create(
      filePathResult.data,
      contentResult.data,
      validationResult.data,
      body,
    );
    if (!docResult.ok) {
      this.config.debugLogger?.error(
        `Document creation failed: ${docResult.error.message}`,
        createLogContext({
          operation: "document-creation",
          inputs: `filePath: ${filePath}`,
        }),
      );
      return docResult;
    }

    this.config.debugLogger?.debug(
      `Successfully processed document: ${filePath}`,
      createLogContext({
        operation: "single-document",
        inputs: `filePath: ${filePath}`,
      }),
    );

    return ok({
      document: docResult.data,
      frontmatterData: validationResult.data,
    });
  }
}
