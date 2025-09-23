import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import {
  ProcessingBoundsMonitor,
} from "../../shared/types/processing-bounds.ts";

/**
 * Frontmatter Processing Service - Core Domain Service for DDD Phase 2
 *
 * Implements the core document processing logic from the DDD architecture.
 * Handles individual file processing and coordination between sequential and parallel processing.
 *
 * Single Responsibility: Core document processing operations
 * Follows Totality principles with Result<T,E> pattern and smart constructor
 */

/**
 * Configuration for Frontmatter Processing Service following dependency injection pattern
 */
export interface FrontmatterProcessingServiceConfig {
  readonly processor: FrontmatterProcessor;
  readonly fileSystem: {
    readonly reader: {
      readFile(
        path: string,
      ): Promise<Result<string, DomainError & { message: string }>>;
    };
  };
}

/**
 * Processing options for different processing strategies
 */
export interface ProcessingOptions {
  readonly useParallel: boolean;
  readonly maxWorkers: number;
  readonly batchSize?: number;
}

/**
 * Result type for document processing operation
 */
export interface DocumentProcessingResult {
  readonly processedData: FrontmatterData[];
  readonly documents: MarkdownDocument[];
  readonly successCount: number;
  readonly errorCount: number;
  readonly processingStrategy: "sequential" | "parallel";
}

/**
 * Error types specific to document processing
 */
export type DocumentProcessingError =
  | { kind: "ConfigurationError"; service: string }
  | { kind: "ProcessingError"; file?: string; originalError: DomainError }
  | { kind: "ValidationError"; file?: string; details: string }
  | { kind: "BoundsViolationError"; memoryUsed: number; limit: number };

/**
 * Frontmatter Processing Service implementing core document processing from DDD architecture
 *
 * Responsibilities:
 * - Process individual markdown documents
 * - Coordinate between sequential and parallel processing strategies
 * - Handle validation and bounds monitoring
 * - Provide structured error handling with Result<T,E> pattern
 * - Log processing decisions for debugging
 */
export class FrontmatterProcessingService {
  private constructor(
    private readonly config: FrontmatterProcessingServiceConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Validates configuration and ensures all required dependencies are present
   */
  static create(
    config: FrontmatterProcessingServiceConfig,
  ): Result<
    FrontmatterProcessingService,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config?.processor) {
      return err(createError({
        kind: "ConfigurationError",
        message: "FrontmatterProcessor is required for document processing",
      }));
    }

    if (!config?.fileSystem?.reader) {
      return err(createError({
        kind: "ConfigurationError",
        message: "FileSystem reader is required for document processing",
      }));
    }

    if (typeof config.fileSystem.reader.readFile !== "function") {
      return err(createError({
        kind: "ConfigurationError",
        message: "FileSystem reader must implement readFile method",
      }));
    }

    return ok(new FrontmatterProcessingService(config));
  }

  /**
   * Process multiple documents with the specified strategy
   *
   * @param filePaths - Array of file paths to process
   * @param validationRules - Validation rules to apply
   * @param options - Processing options (parallel/sequential, workers, etc.)
   * @param boundsMonitor - Memory bounds monitoring
   * @param logger - Optional logger for debug information
   * @returns Result containing processed documents or error
   */
  processDocuments(
    filePaths: string[],
    validationRules: ValidationRules,
    options: ProcessingOptions,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<DocumentProcessingResult, DomainError & { message: string }>
  > {
    logger?.debug("Starting document processing", {
      operation: "document-processing",
      fileCount: filePaths.length,
      strategy: options.useParallel ? "parallel" : "sequential",
      maxWorkers: options.maxWorkers,
      timestamp: new Date().toISOString(),
    });

    if (options.useParallel) {
      return this.processDocumentsInParallel(
        filePaths,
        validationRules,
        options,
        boundsMonitor,
        logger,
      );
    } else {
      return this.processDocumentsSequentially(
        filePaths,
        validationRules,
        boundsMonitor,
        logger,
      );
    }
  }

  /**
   * Process documents in parallel using worker batches
   * Private method that implements parallel processing strategy
   */
  private async processDocumentsInParallel(
    filePaths: string[],
    validationRules: ValidationRules,
    options: ProcessingOptions,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<DocumentProcessingResult, DomainError & { message: string }>
  > {
    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];
    let successCount = 0;
    let errorCount = 0;

    const batchSize = Math.max(
      1,
      Math.ceil(filePaths.length / options.maxWorkers),
    );
    const batches = this.createBatches(filePaths, batchSize);

    logger?.debug(
      `Created ${batches.length} batches with batch size ${batchSize}`,
      {
        operation: "parallel-batch-creation",
        totalFiles: filePaths.length,
        batchCount: batches.length,
        batchSize,
        timestamp: new Date().toISOString(),
      },
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      logger?.debug(
        `Processing batch ${
          i + 1
        }/${batches.length} with ${batch.length} files`,
        {
          operation: "parallel-batch-processing",
          batchIndex: i + 1,
          totalBatches: batches.length,
          filesInBatch: batch.length,
          timestamp: new Date().toISOString(),
        },
      );

      // Process batch concurrently
      const batchPromises = batch.map((filePath) =>
        this.processIndividualFile(
          filePath,
          validationRules,
          boundsMonitor,
          logger,
        )
      );

      const batchResults = await Promise.all(batchPromises);

      // Collect results from batch
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const filePath = batch[j];

        if (result.ok) {
          processedData.push(result.data.frontmatterData);
          documents.push(result.data.document);
          successCount++;
          logger?.debug(
            `Successfully processed file in batch ${i + 1}: ${filePath}`,
            {
              operation: "parallel-file-processing",
              batchIndex: i + 1,
              filePath,
              timestamp: new Date().toISOString(),
            },
          );
        } else {
          errorCount++;
          logger?.error(
            `Failed to process file in batch ${i + 1}: ${filePath}`,
            {
              operation: "parallel-file-processing",
              batchIndex: i + 1,
              filePath,
              error: result.error.message,
              timestamp: new Date().toISOString(),
            },
          );
        }
      }

      // Check memory bounds after each batch
      const boundsState = boundsMonitor.checkState(i + 1);
      if (boundsState.kind === "exceeded_limit") {
        return err(createError({
          kind: "InitializationError",
          message:
            `Memory bounds exceeded during parallel processing: ${boundsState.limit}`,
        }));
      }
    }

    logger?.info(
      `Parallel processing completed: ${successCount} successful, ${errorCount} errors`,
      {
        operation: "parallel-processing-completion",
        successCount,
        errorCount,
        totalFiles: filePaths.length,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({
      processedData,
      documents,
      successCount,
      errorCount,
      processingStrategy: "parallel" as const,
    });
  }

  /**
   * Process documents sequentially
   * Private method that implements sequential processing strategy
   */
  private async processDocumentsSequentially(
    filePaths: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<DocumentProcessingResult, DomainError & { message: string }>
  > {
    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];
    let successCount = 0;
    let errorCount = 0;

    logger?.info(`Using sequential processing for ${filePaths.length} files`, {
      operation: "sequential-processing",
      fileCount: filePaths.length,
      timestamp: new Date().toISOString(),
    });

    for (const filePath of filePaths) {
      const result = await this.processIndividualFile(
        filePath,
        validationRules,
        boundsMonitor,
        logger,
      );

      if (result.ok) {
        processedData.push(result.data.frontmatterData);
        documents.push(result.data.document);
        successCount++;
      } else {
        errorCount++;
        logger?.error(`Failed to process file: ${filePath}`, {
          operation: "sequential-file-processing",
          filePath,
          error: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Check bounds after each file in sequential processing
      const boundsState = boundsMonitor.checkState(successCount + errorCount);
      if (boundsState.kind === "exceeded_limit") {
        return err(createError({
          kind: "InitializationError",
          message:
            `Memory bounds exceeded during sequential processing: ${boundsState.limit}`,
        }));
      }
    }

    logger?.info(
      `Sequential processing completed: ${successCount} successful, ${errorCount} errors`,
      {
        operation: "sequential-processing-completion",
        successCount,
        errorCount,
        totalFiles: filePaths.length,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({
      processedData,
      documents,
      successCount,
      errorCount,
      processingStrategy: "sequential" as const,
    });
  }

  /**
   * Process a single markdown file
   * Private method that encapsulates individual file processing logic
   */
  private async processIndividualFile(
    filePath: string,
    validationRules: ValidationRules,
    _boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<{
      frontmatterData: FrontmatterData;
      document: MarkdownDocument;
    }, DomainError & { message: string }>
  > {
    try {
      logger?.debug(`Starting processing of document: ${filePath}`, {
        operation: "single-document",
        filePath,
        timestamp: new Date().toISOString(),
      });

      // Read file content
      logger?.debug(`Reading file content: ${filePath}`, {
        operation: "file-reading",
        filePath,
        timestamp: new Date().toISOString(),
      });

      const contentResult = await this.config.fileSystem.reader.readFile(
        filePath,
      );
      if (!contentResult.ok) {
        return err(createError({
          kind: "ReadFailed",
          path: filePath,
          message:
            `Failed to read file ${filePath}: ${contentResult.error.message}`,
        }));
      }

      // Extract frontmatter from content
      const extractResult = this.config.processor.extract(contentResult.data);
      if (!extractResult.ok) {
        return err(createError({
          kind: "ExtractionFailed",
          message:
            `Failed to extract frontmatter from ${filePath}: ${extractResult.error.message}`,
        }));
      }

      // Validate extracted frontmatter
      const validationResult = this.config.processor.validate(
        extractResult.data.frontmatter,
        validationRules,
      );
      if (!validationResult.ok) {
        return err(createError({
          kind: "InvalidFormat",
          format: "frontmatter",
          value: filePath,
          field: "validation",
        }));
      }

      // Create FilePath value object
      const filePathResult = FilePath.create(filePath);
      if (!filePathResult.ok) {
        return err(createError({
          kind: "InvalidFormat",
          format: "file path",
          value: filePath,
        }));
      }

      // Create MarkdownDocument
      const documentResult = MarkdownDocument.create(
        filePathResult.data,
        contentResult.data,
        extractResult.data.frontmatter,
        extractResult.data.body,
      );
      if (!documentResult.ok) {
        return err(createError({
          kind: "InvalidFormat",
          format: "markdown document",
          value: filePath,
        }));
      }

      logger?.debug(`Successfully processed document: ${filePath}`, {
        operation: "single-document",
        filePath,
        timestamp: new Date().toISOString(),
      });

      return ok({
        frontmatterData: extractResult.data.frontmatter,
        document: documentResult.data,
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);

      logger?.error(`Unexpected error processing file: ${filePath}`, {
        operation: "single-document",
        filePath,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });

      return err(createError({
        kind: "InitializationError",
        message: `Unexpected error processing ${filePath}: ${errorMessage}`,
      }));
    }
  }

  /**
   * Create batches for parallel processing
   * Private utility method for batch creation
   */
  private createBatches(filePaths: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Get processing service configuration for debugging
   * Useful for testing and diagnostics
   */
  getConfiguration(): { hasProcessor: boolean; hasFileSystemReader: boolean } {
    return {
      hasProcessor: !!this.config.processor,
      hasFileSystemReader: !!this.config.fileSystem?.reader,
    };
  }
}
