import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { ProcessingBoundsMonitor } from "../../shared/types/processing-bounds.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import { createEnhancedDebugLogger } from "../../shared/services/enhanced-debug-logger.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import { ProcessingOptionsState } from "../configuration/processing-options-factory.ts";

/**
 * Processing Strategy Service - Domain Service for DDD Phase 2
 *
 * Handles document processing strategy decisions and execution following DDD principles.
 * Extracted from Stage 3 of the monolithic pipeline to reduce complexity and improve maintainability.
 *
 * Single Responsibility: Processing strategy selection and document processing coordination
 * Follows Totality principles with Result<T,E> pattern and smart constructor
 */

/**
 * Configuration for Processing Strategy Service following dependency injection pattern
 */
export interface ProcessingStrategyServiceConfig {
  readonly performanceSettings: PerformanceSettings;
  readonly documentProcessor: DocumentProcessor;
}

/**
 * Document processor interface for processing individual documents
 */
export interface DocumentProcessor {
  processDocument(
    filePath: string,
    validationRules: ValidationRules,
    logger?: DebugLogger,
  ): Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  >;
}

/**
 * Options for document processing operation
 */
export interface DocumentProcessingOptions {
  readonly files: string[];
  readonly validationRules: ValidationRules;
  readonly boundsMonitor: ProcessingBoundsMonitor;
  readonly processingOptionsState?: ProcessingOptionsState;
  readonly legacyOptions?: {
    readonly parallel?: boolean;
    readonly maxWorkers?: number;
  };
}

/**
 * Result type for document processing operation
 */
export interface DocumentProcessingResult {
  readonly processedData: FrontmatterData[];
  readonly documents: MarkdownDocument[];
  readonly strategy: "parallel" | "sequential";
  readonly workerCount?: number;
}

/**
 * Strategy decision result
 */
export interface ProcessingStrategy {
  readonly useParallel: boolean;
  readonly maxWorkers: number;
  readonly reason: string;
}

/**
 * Processing Strategy Service implementing Stage 3 logic from DDD architecture
 *
 * Responsibilities:
 * - Determine optimal processing strategy (parallel vs sequential)
 * - Handle adaptive processing configuration
 * - Execute document processing with appropriate strategy
 * - Monitor memory bounds during processing
 * - Provide structured error handling with Result<T,E> pattern
 * - Log processing decisions for debugging and monitoring
 * - Address Issue #1024: Enhanced debugging with component-based filtering
 */
export class ProcessingStrategyService {
  private readonly enhancedLogger: DebugLogger;

  private constructor(
    private readonly config: ProcessingStrategyServiceConfig,
  ) {
    // Initialize enhanced logger for Issue #1024 resolution
    const loggerResult = createEnhancedDebugLogger("processing-strategy");
    this.enhancedLogger = loggerResult.ok ? loggerResult.data : {
      log: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      error: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      warn: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      info: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      debug: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      trace: () => ({
        ok: false,
        error: {
          kind: "LoggerDisabled",
          reason: "Logger disabled",
          message: "Logger disabled",
        },
      }),
      withContext: () => this,
    } as any;
  }

  /**
   * Smart Constructor following Totality principles
   * Validates configuration and ensures all required dependencies are present
   */
  static create(
    config: ProcessingStrategyServiceConfig,
  ): Result<ProcessingStrategyService, DomainError & { message: string }> {
    // Validate required dependencies
    if (!config?.performanceSettings) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "PerformanceSettings is required for processing strategy decisions",
        }),
      };
    }

    if (!config?.documentProcessor) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "DocumentProcessor is required for document processing operations",
        }),
      };
    }

    return ok(new ProcessingStrategyService(config));
  }

  /**
   * Process documents using optimal strategy
   * Implements Stage 3 logic: strategy decision and document processing coordination
   */
  async processDocuments(
    options: DocumentProcessingOptions,
    logger?: DebugLogger,
  ): Promise<
    Result<DocumentProcessingResult, DomainError & { message: string }>
  > {
    // Use enhanced logger for Issue #1024 - improved debugging efficiency
    const activeLogger = logger || this.enhancedLogger;

    // Enhanced debugging with data structure analysis
    if ("analyzeDataStructure" in activeLogger) {
      (activeLogger as any).analyzeDataStructure("processing-options", options);
      (activeLogger as any).trackFlow("strategy-evaluation-start", {
        fileCount: options.files.length,
        hasLegacyOptions: !!options.legacyOptions,
      });
    }

    activeLogger?.debug("Starting document processing strategy evaluation", {
      operation: "processing-strategy",
      fileCount: options.files.length,
      hasLegacyOptions: !!options.legacyOptions,
      hasProcessingState: !!options.processingOptionsState,
      timestamp: new Date().toISOString(),
    });

    // Determine processing strategy
    const strategy = this.determineProcessingStrategy(
      options.files.length,
      options.legacyOptions,
      options.processingOptionsState,
      activeLogger,
    );

    // Enhanced debugging for strategy decision
    if ("trackFlow" in activeLogger) {
      (activeLogger as any).trackFlow("strategy-decision", {
        strategy: strategy.useParallel ? "parallel" : "sequential",
        fileCount: options.files.length,
        workerCount: strategy.maxWorkers,
      });
    }

    activeLogger?.info(
      `Selected ${
        strategy.useParallel ? "parallel" : "sequential"
      } processing strategy`,
      {
        operation: "strategy-selection",
        strategy: strategy.useParallel ? "parallel" : "sequential",
        reason: strategy.reason,
        fileCount: options.files.length,
        workerCount: strategy.maxWorkers,
        timestamp: new Date().toISOString(),
      },
    );

    // Execute processing with selected strategy
    if (strategy.useParallel) {
      const result = await this.processFilesInParallel(
        options.files,
        options.validationRules,
        strategy.maxWorkers,
        options.boundsMonitor,
        activeLogger,
      );

      if (!result.ok) {
        return result;
      }

      return ok({
        processedData: result.data.map((r) => r.frontmatterData),
        documents: result.data.map((r) => r.document),
        strategy: "parallel",
        workerCount: strategy.maxWorkers,
      });
    } else {
      const result = this.processFilesSequentially(
        options.files,
        options.validationRules,
        options.boundsMonitor,
        activeLogger,
      );

      if (!result.ok) {
        return result;
      }

      return ok({
        processedData: result.data.processedData,
        documents: result.data.documents,
        strategy: "sequential",
      });
    }
  }

  /**
   * Determine the optimal processing strategy based on configuration and file count
   */
  private determineProcessingStrategy(
    fileCount: number,
    legacyOptions?: DocumentProcessingOptions["legacyOptions"],
    processingOptionsState?: ProcessingOptionsState,
    logger?: DebugLogger,
  ): ProcessingStrategy {
    const minFilesForParallel = this.config.performanceSettings
      .getMinFilesForParallel();
    const defaultMaxWorkers = this.config.performanceSettings
      .getDefaultMaxWorkers();

    // Handle adaptive strategy if provided
    if (processingOptionsState?.kind === "adaptive") {
      const useParallel = fileCount > processingOptionsState.maxFileThreshold;
      const maxWorkers = processingOptionsState.baseWorkers;

      logger?.debug("Using adaptive processing strategy", {
        operation: "strategy-decision",
        fileCount,
        threshold: processingOptionsState.maxFileThreshold,
        baseWorkers: processingOptionsState.baseWorkers,
        decision: useParallel ? "parallel" : "sequential",
        timestamp: new Date().toISOString(),
      });

      return {
        useParallel,
        maxWorkers,
        reason: `adaptive strategy: ${fileCount} files ${
          useParallel ? ">" : "<="
        } ${processingOptionsState.maxFileThreshold} threshold`,
      };
    }

    // Handle legacy options
    const useParallel = legacyOptions?.parallel === true &&
      fileCount >= minFilesForParallel;
    const maxWorkers = legacyOptions?.maxWorkers || defaultMaxWorkers;

    const reason = legacyOptions?.parallel === true
      ? `legacy parallel option with ${fileCount} files (min: ${minFilesForParallel})`
      : `performance settings: ${fileCount} files < ${minFilesForParallel} minimum`;

    logger?.debug("Using legacy/default processing strategy", {
      operation: "strategy-decision",
      fileCount,
      minFilesForParallel,
      legacyParallel: legacyOptions?.parallel,
      decision: useParallel ? "parallel" : "sequential",
      timestamp: new Date().toISOString(),
    });

    return {
      useParallel,
      maxWorkers,
      reason,
    };
  }

  /**
   * Process files sequentially with memory bounds monitoring
   */
  private processFilesSequentially(
    files: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Result<
    { processedData: FrontmatterData[]; documents: MarkdownDocument[] },
    DomainError & { message: string }
  > {
    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    logger?.debug("Starting sequential document processing", {
      operation: "sequential-processing",
      fileCount: files.length,
      timestamp: new Date().toISOString(),
    });

    for (const filePath of files) {
      // Memory bounds monitoring
      const state = boundsMonitor.checkState(processedData.length);
      if (state.kind === "exceeded_limit") {
        return ErrorHandler.system({
          operation: "processFilesSequentially",
          method: "checkMemoryBounds",
        }).memoryBoundsViolation(
          `Processing exceeded bounds: ${state.limit}`,
        );
      }

      logger?.debug(`Processing file: ${filePath}`, {
        operation: "file-processing",
        filePath,
        processedCount: processedData.length,
        timestamp: new Date().toISOString(),
      });

      const documentResult = this.config.documentProcessor.processDocument(
        filePath,
        validationRules,
        logger,
      );

      if (documentResult.ok) {
        processedData.push(documentResult.data.frontmatterData);
        documents.push(documentResult.data.document);

        logger?.debug(`Successfully processed: ${filePath}`, {
          operation: "file-processing",
          filePath,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger?.error(`Failed to process file: ${filePath}`, {
          operation: "file-processing",
          filePath,
          error: documentResult.error,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (processedData.length === 0) {
      const noDataError = ErrorHandler.aggregation({
        operation: "processFilesSequentially",
        method: "validateProcessedData",
      }).aggregationFailed("No valid documents found to process");

      logger?.error("No valid documents found to process", {
        operation: "sequential-processing",
        error: "No valid documents found to process",
        timestamp: new Date().toISOString(),
      });
      return noDataError;
    }

    logger?.info(
      `Sequential processing completed: ${processedData.length} documents`,
      {
        operation: "sequential-processing",
        processedCount: processedData.length,
        totalFiles: files.length,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({ processedData, documents });
  }

  /**
   * Process files in parallel using a worker pool pattern
   */
  private async processFilesInParallel(
    filePaths: string[],
    validationRules: ValidationRules,
    maxWorkers: number,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<
      Array<{ document: MarkdownDocument; frontmatterData: FrontmatterData }>,
      DomainError & { message: string }
    >
  > {
    const batchSize = Math.ceil(filePaths.length / maxWorkers);
    const batches = [];

    logger?.debug("Starting parallel document processing", {
      operation: "parallel-processing",
      fileCount: filePaths.length,
      maxWorkers,
      batchSize,
      timestamp: new Date().toISOString(),
    });

    // Create batches for worker processing
    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }

    try {
      const results: Array<
        { document: MarkdownDocument; frontmatterData: FrontmatterData }
      > = [];
      const errors: Array<DomainError & { message: string }> = [];

      // Process batches in parallel
      const batchPromises = batches.map((batch, batchIndex) => {
        const batchResults: Array<
          { document: MarkdownDocument; frontmatterData: FrontmatterData }
        > = [];
        const batchErrors: Array<DomainError & { message: string }> = [];

        for (const filePath of batch) {
          // Memory bounds monitoring for each file
          const state = boundsMonitor.checkState(
            results.length + batchResults.length,
          );
          if (state.kind === "exceeded_limit") {
            const boundsError = ErrorHandler.system({
              operation: "processFilesInParallel",
              method: "checkBatchMemoryBounds",
            }).memoryBoundsViolation(
              `Processing exceeded bounds: ${state.limit}`,
            );
            if (!boundsError.ok) {
              batchErrors.push(boundsError.error);
            }
            break;
          }

          const documentResult = this.config.documentProcessor.processDocument(
            filePath,
            validationRules,
            logger,
          );

          if (documentResult.ok) {
            batchResults.push(documentResult.data);
            logger?.debug(`Batch ${batchIndex}: processed ${filePath}`, {
              operation: "parallel-batch-processing",
              batchIndex,
              filePath,
              timestamp: new Date().toISOString(),
            });
          } else {
            batchErrors.push(documentResult.error);
            logger?.error(
              `Batch ${batchIndex}: failed to process ${filePath}`,
              {
                operation: "parallel-batch-processing",
                batchIndex,
                filePath,
                error: documentResult.error,
                timestamp: new Date().toISOString(),
              },
            );
          }
        }

        return { results: batchResults, errors: batchErrors };
      });

      // Wait for all batches to complete
      const batchResults = await Promise.all(batchPromises);

      // Collect all results and errors
      for (const batch of batchResults) {
        results.push(...batch.results);
        errors.push(...batch.errors);
      }

      logger?.info(
        `Parallel processing completed: ${results.length} successful, ${errors.length} failed`,
        {
          operation: "parallel-processing",
          successCount: results.length,
          errorCount: errors.length,
          totalFiles: filePaths.length,
          timestamp: new Date().toISOString(),
        },
      );

      // Return results even if some files failed (matching sequential behavior)
      if (results.length === 0 && errors.length > 0) {
        return err(errors[0]);
      }

      return ok(results);
    } catch (error) {
      const processingError = ErrorHandler.aggregation({
        operation: "processFilesInParallel",
        method: "handleParallelProcessing",
      }).aggregationFailed(
        `Parallel processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      logger?.error("Parallel processing encountered an unexpected error", {
        operation: "parallel-processing",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });

      if (!processingError.ok) {
        return processingError;
      }

      // Fallback error
      return err(createError({
        kind: "PipelineExecutionError",
        content: "Parallel processing failed unexpectedly",
      }));
    }
  }

  /**
   * Get processing strategy statistics for monitoring and debugging
   */
  getStrategyStats(
    fileCount: number,
    processingOptionsState?: ProcessingOptionsState,
  ): {
    readonly recommendedStrategy: "parallel" | "sequential";
    readonly minFilesForParallel: number;
    readonly defaultMaxWorkers: number;
    readonly adaptiveThreshold?: number;
  } {
    const minFilesForParallel = this.config.performanceSettings
      .getMinFilesForParallel();
    const defaultMaxWorkers = this.config.performanceSettings
      .getDefaultMaxWorkers();

    let recommendedStrategy: "parallel" | "sequential" = "sequential";

    if (processingOptionsState?.kind === "adaptive") {
      recommendedStrategy = fileCount > processingOptionsState.maxFileThreshold
        ? "parallel"
        : "sequential";
    } else {
      recommendedStrategy = fileCount >= minFilesForParallel
        ? "parallel"
        : "sequential";
    }

    return {
      recommendedStrategy,
      minFilesForParallel,
      defaultMaxWorkers,
      adaptiveThreshold: processingOptionsState?.kind === "adaptive"
        ? processingOptionsState.maxFileThreshold
        : undefined,
    };
  }
}
