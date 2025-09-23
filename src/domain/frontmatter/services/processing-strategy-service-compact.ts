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
import {
  BatchProcessor,
  DocumentProcessorPort,
} from "../utilities/batch-processor.ts";

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
  async processDocuments(
    files: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    options?: ProcessingStrategyOptions,
  ): Promise<
    Result<
      { processedData: FrontmatterData[]; documents: MarkdownDocument[] },
      DomainError & { message: string }
    >
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
      `Selected ${strategy.type} processing strategy for ${files.length} files`,
      { operation: "processing-strategy", timestamp: new Date().toISOString() },
    );

    return strategy.type === "parallel"
      ? await this.processInParallel(
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
  private async processInParallel(
    files: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    maxWorkers: number,
  ): Promise<
    Result<
      { processedData: FrontmatterData[]; documents: MarkdownDocument[] },
      DomainError & { message: string }
    >
  > {
    const batches = BatchProcessor.createBatches(files, maxWorkers);
    this.logger.debug(
      `Created ${batches.length} batches for parallel processing`,
    );

    try {
      const batchPromises = batches.map((batch) => {
        return BatchProcessor.processBatch(
          batch,
          validationRules,
          boundsMonitor,
          this.documentProcessor,
        );
      });

      const batchOutputs = await Promise.all(batchPromises);
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

    this.logger.info(`Using sequential processing for ${files.length} files`);

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
          `Failed to process file: ${filePath} - ${documentResult.error.message}`,
        );
        return documentResult;
      }
    }

    this.logger.info(
      `Sequential processing completed: ${processedData.length} files processed`,
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
