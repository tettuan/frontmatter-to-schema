import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { ProcessingBoundsMonitor } from "../../shared/types/processing-bounds.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import { ProcessingOptionsState } from "../configuration/processing-options-factory.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import { createEnhancedDebugLogger } from "../../shared/services/enhanced-debug-logger.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

/**
 * Domain service for determining and executing processing strategies.
 *
 * Following DDD principles:
 * - Belongs to Frontmatter Processing bounded context
 * - Single responsibility: Processing strategy determination and execution
 * - Implements Totality principle with Result<T,E> pattern
 * - Uses Smart Constructor pattern for safe instantiation
 * - <300 lines for AI complexity compliance
 *
 * Addresses Issue #1021: Extracted from 1026-line pipeline to improve DDD compliance
 */
export class ProcessingStrategyService {
  private readonly logger: DebugLogger;

  private constructor(
    private readonly documentProcessor: DocumentProcessorPort,
    private readonly performanceSettings: PerformanceSettings,
    logger?: DebugLogger,
  ) {
    if (logger) {
      this.logger = logger;
    } else {
      const loggerResult = createEnhancedDebugLogger("processing-strategy");
      this.logger = loggerResult.ok
        ? loggerResult.data
        : this.createNoOpLogger();
    }
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(
    documentProcessor: DocumentProcessorPort,
    performanceSettings: PerformanceSettings,
    logger?: DebugLogger,
  ): Result<ProcessingStrategyService, DomainError & { message: string }> {
    if (!documentProcessor?.processDocument) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "Valid DocumentProcessor with processDocument method is required",
      }));
    }

    if (!performanceSettings) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "PerformanceSettings is required for ProcessingStrategyService",
      }));
    }

    return ok(
      new ProcessingStrategyService(
        documentProcessor,
        performanceSettings,
        logger,
      ),
    );
  }

  /**
   * Processes documents using the appropriate strategy (parallel or sequential).
   */
  processDocuments(
    files: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    options?: ProcessingStrategyOptions,
  ): Result<
    { processedData: FrontmatterData[]; documents: MarkdownDocument[] },
    DomainError & { message: string }
  > {
    if (!files || !validationRules || !boundsMonitor) {
      return err(createError({
        kind: "MissingRequired",
        field: !files
          ? "files"
          : !validationRules
          ? "validationRules"
          : "boundsMonitor",
        message: "Files, validation rules, and bounds monitor are required",
      }));
    }

    const strategy = this.determineProcessingStrategy(files, options);
    this.logger.info(
      `Selected ${strategy.type} processing strategy`,
      {
        operation: "processing-strategy",
        strategyType: strategy.type,
        fileCount: files.length,
        maxWorkers: strategy.maxWorkers,
        timestamp: new Date().toISOString(),
      },
    );

    return strategy.type === "parallel"
      ? this.processInParallel(
        files,
        validationRules,
        boundsMonitor,
        strategy.maxWorkers,
      )
      : this.processSequentially(files, validationRules, boundsMonitor);
  }

  /**
   * Determines the appropriate processing strategy based on file count and options.
   */
  private determineProcessingStrategy(
    files: string[],
    options?: ProcessingStrategyOptions,
  ): ProcessingStrategy {
    const minFilesForParallel = this.performanceSettings
      .getMinFilesForParallel();
    const defaultMaxWorkers = this.performanceSettings.getDefaultMaxWorkers();

    // Handle legacy options
    if (
      options?.legacy?.parallel === true && files.length >= minFilesForParallel
    ) {
      return {
        type: "parallel",
        maxWorkers: options.legacy.maxWorkers || defaultMaxWorkers,
      };
    }

    // Handle adaptive strategy
    if (options?.adaptive?.kind === "adaptive") {
      const useParallel = files.length > options.adaptive.maxFileThreshold;
      return {
        type: useParallel ? "parallel" : "sequential",
        maxWorkers: options.adaptive.baseWorkers,
      };
    }

    // Default strategy based on performance settings
    const useParallel = files.length >= minFilesForParallel;
    return {
      type: useParallel ? "parallel" : "sequential",
      maxWorkers: defaultMaxWorkers,
    };
  }

  /**
   * Processes files in parallel using batching strategy.
   */
  private processInParallel(
    files: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    maxWorkers: number,
  ): Result<
    { processedData: FrontmatterData[]; documents: MarkdownDocument[] },
    DomainError & { message: string }
  > {
    const batchSize = Math.max(1, Math.ceil(files.length / maxWorkers));
    const batches: string[][] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    this.logger.debug(
      `Created ${batches.length} batches with batch size ${batchSize}`,
      {
        operation: "parallel-batch-creation",
        batchCount: batches.length,
        batchSize,
        totalFiles: files.length,
        timestamp: new Date().toISOString(),
      },
    );

    try {
      const batchResults = batches.map((batch) => {
        return this.processBatch(batch, validationRules, boundsMonitor);
      });

      const batchOutputs = batchResults;
      const results: Array<
        { document: MarkdownDocument; frontmatterData: FrontmatterData }
      > = [];
      const errors: Array<DomainError & { message: string }> = [];

      for (const batchOutput of batchOutputs) {
        if (batchOutput.ok) {
          results.push(...batchOutput.data.batchResults);
          errors.push(...batchOutput.data.batchErrors);
        } else {
          errors.push(batchOutput.error);
        }
      }

      this.logger.info(
        `Parallel processing completed: ${results.length} successful, ${errors.length} errors`,
        {
          operation: "parallel-processing-completion",
          successCount: results.length,
          errorCount: errors.length,
          totalFiles: files.length,
          timestamp: new Date().toISOString(),
        },
      );

      const processedData = results.map((r) => r.frontmatterData);
      const documents = results.map((r) => r.document);

      return ok({ processedData, documents });
    } catch (error) {
      return err(createError({
        kind: "RenderFailed",
        message: `Parallel processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  /**
   * Processes a batch of files.
   */
  private processBatch(
    batch: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
  ): Result<
    {
      batchResults: Array<
        { document: MarkdownDocument; frontmatterData: FrontmatterData }
      >;
      batchErrors: Array<DomainError & { message: string }>;
    },
    DomainError & { message: string }
  > {
    const batchResults: Array<
      { document: MarkdownDocument; frontmatterData: FrontmatterData }
    > = [];
    const batchErrors: Array<DomainError & { message: string }> = [];

    for (const filePath of batch) {
      const state = boundsMonitor.checkState(batchResults.length);
      if (state.kind === "exceeded_limit") {
        const boundsError = ErrorHandler.system({
          operation: "processBatch",
          method: "checkBatchMemoryBounds",
        }).memoryBoundsViolation(`Processing exceeded bounds: ${state.limit}`);

        if (!boundsError.ok) {
          batchErrors.push(boundsError.error);
        }
        break;
      }

      const documentResult = this.documentProcessor.processDocument(
        filePath,
        validationRules,
      );
      if (documentResult.ok) {
        batchResults.push(documentResult.data);
      } else {
        batchErrors.push(documentResult.error);
      }
    }

    return ok({ batchResults, batchErrors });
  }

  /**
   * Processes files sequentially.
   */
  private processSequentially(
    files: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
  ): Result<
    { processedData: FrontmatterData[]; documents: MarkdownDocument[] },
    DomainError & { message: string }
  > {
    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    this.logger.info(
      `Using sequential processing for ${files.length} files`,
      {
        operation: "sequential-processing",
        fileCount: files.length,
        timestamp: new Date().toISOString(),
      },
    );

    for (const filePath of files) {
      const state = boundsMonitor.checkState(processedData.length);
      if (state.kind === "exceeded_limit") {
        return ErrorHandler.system({
          operation: "processSequentially",
          method: "checkMemoryBounds",
        }).memoryBoundsViolation(`Processing exceeded bounds: ${state.limit}`);
      }

      const documentResult = this.documentProcessor.processDocument(
        filePath,
        validationRules,
      );
      if (documentResult.ok) {
        processedData.push(documentResult.data.frontmatterData);
        documents.push(documentResult.data.document);
      } else {
        this.logger.error(
          `Failed to process file: ${filePath}`,
          {
            operation: "file-processing",
            filePath,
            error: documentResult.error.message,
            timestamp: new Date().toISOString(),
          },
        );
        return documentResult;
      }
    }

    this.logger.info(
      `Sequential processing completed: ${processedData.length} files processed`,
      {
        operation: "sequential-processing-completion",
        processedCount: processedData.length,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({ processedData, documents });
  }

  /**
   * Creates a no-op logger as fallback.
   */
  private createNoOpLogger(): DebugLogger {
    const noOp = () => ok(void 0);
    return {
      debug: noOp,
      info: noOp,
      warn: noOp,
      error: noOp,
      trace: noOp,
      log: noOp,
      withContext: () => this.logger,
    };
  }
}

/**
 * Processing strategy options
 */
export interface ProcessingStrategyOptions {
  readonly legacy?: {
    readonly parallel?: boolean;
    readonly maxWorkers?: number;
  };
  readonly adaptive?: ProcessingOptionsState;
}

/**
 * Processing strategy result
 */
export interface ProcessingStrategy {
  readonly type: "parallel" | "sequential";
  readonly maxWorkers: number;
}

/**
 * Port interface for document processor.
 */
export interface DocumentProcessorPort {
  processDocument(
    filePath: string,
    validationRules: ValidationRules,
  ): Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  >;
}
