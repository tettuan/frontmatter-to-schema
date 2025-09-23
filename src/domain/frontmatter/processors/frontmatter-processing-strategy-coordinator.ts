/**
 * @fileoverview FrontmatterProcessingStrategyCoordinator - Domain Service for Processing Strategy Coordination
 * @description Extracts processing strategy decisions and file orchestration from transformation service
 * Following DDD boundaries and Totality principles for processing coordination
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  ProcessingBounds,
  ProcessingBoundsMonitor,
} from "../../shared/types/processing-bounds.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { FrontmatterParallelProcessor } from "./frontmatter-parallel-processor.ts";
import { FrontmatterProcessingMonitoringService } from "./frontmatter-processing-monitoring-service.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";
import {
  ProcessingOptionsState,
} from "../configuration/processing-options-factory.ts";

/**
 * Configuration interface for processing strategy coordinator dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterProcessingStrategyCoordinatorConfig {
  readonly performanceSettings: PerformanceSettings;
  readonly monitoringService: FrontmatterProcessingMonitoringService;
  readonly debugLogger?: DebugLogger;
}

/**
 * Document processor function type for processing individual files
 * Abstraction for dependency injection following Totality principles
 */
export type DocumentProcessor = (
  filePath: string,
  validationRules: ValidationRules,
) => Result<
  { document: MarkdownDocument; frontmatterData: FrontmatterData },
  DomainError & { message: string }
>;

/**
 * Processing results interface containing processed documents and data
 * Clear domain boundary for processing coordination results
 */
export interface ProcessedDocuments {
  readonly documents: MarkdownDocument[];
  readonly processedData: FrontmatterData[];
}

/**
 * Processing strategy decision result
 * Encapsulates strategy determination with monitoring compliance
 */
export interface ProcessingStrategyDecision {
  readonly useParallel: boolean;
  readonly maxWorkers: number;
  readonly strategyReason: string;
  readonly configurationSource: string;
}

/**
 * FrontmatterProcessingStrategyCoordinator - Domain Service for Processing Strategy Coordination
 *
 * Responsibilities:
 * - Processing strategy decision making (parallel vs sequential)
 * - File processing orchestration and coordination
 * - Memory bounds management and monitoring integration
 * - Processing results aggregation and validation
 *
 * Following DDD principles:
 * - Single responsibility: Processing strategy coordination only
 * - Domain service: Strategy coordination within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 */
export class FrontmatterProcessingStrategyCoordinator {
  private constructor(
    private readonly config: FrontmatterProcessingStrategyCoordinatorConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates strategy coordinator with validated configuration
   */
  static create(
    config: FrontmatterProcessingStrategyCoordinatorConfig,
  ): Result<
    FrontmatterProcessingStrategyCoordinator,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config.performanceSettings) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Performance settings are required for strategy coordination",
      }));
    }

    if (!config.monitoringService) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Monitoring service is required for strategy coordination",
      }));
    }

    return ok(new FrontmatterProcessingStrategyCoordinator(config));
  }

  /**
   * Coordinate file processing using appropriate strategy (parallel or sequential)
   * Main coordination method handling strategy decisions and file processing orchestration
   */
  async coordinateFileProcessing(
    files: string[],
    validationRules: ValidationRules,
    inputPattern: string,
    actualBounds: ProcessingBounds,
    legacyOptions?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
    processingOptionsState?: ProcessingOptionsState,
    processDocument?: DocumentProcessor,
  ): Promise<Result<ProcessedDocuments, DomainError & { message: string }>> {
    this.config.debugLogger?.debug(
      "Starting file processing coordination",
      createLogContext({
        operation: "file-processing-coordination",
        inputs: `fileCount: ${files.length}, pattern: ${inputPattern}`,
      }),
    );

    // Step 1: Make processing strategy decision
    const strategyResult = this.determineProcessingStrategy(
      files.length,
      legacyOptions,
      processingOptionsState,
    );
    if (!strategyResult.ok) {
      return strategyResult;
    }

    const strategy = strategyResult.data;

    // Step 2: Track strategy decision with monitoring service
    const strategyTrackingResult = this.config.monitoringService
      .trackProcessingStrategyDecision(
        inputPattern,
        files.length,
        processingOptionsState,
        strategy.useParallel,
        strategy.maxWorkers,
      );
    if (!strategyTrackingResult.ok) {
      this.config.debugLogger?.warn(
        "Failed to track processing strategy decision",
        createLogContext({
          operation: "strategy-tracking",
          error: strategyTrackingResult.error.message,
        }),
      );
    }

    // Step 3: Track comprehensive strategy variance debug information
    const strategyVarianceResult = this.config.monitoringService
      .trackProcessingStrategyVarianceDebug(
        strategy.useParallel,
        strategy.maxWorkers,
        files.length,
      );
    if (!strategyVarianceResult.ok) {
      this.config.debugLogger?.warn(
        "Failed to track processing strategy variance debug",
        createLogContext({
          operation: "strategy-variance-debug",
          error: strategyVarianceResult.error.message,
        }),
      );
    }

    // Step 4: Setup processing bounds monitoring
    const boundsSetupResult = this.setupProcessingBounds(
      actualBounds,
      files.length,
    );
    if (!boundsSetupResult.ok) {
      return boundsSetupResult;
    }

    const boundsMonitor = boundsSetupResult.data;

    // Step 5: Execute processing strategy
    if (strategy.useParallel) {
      this.config.debugLogger?.info(
        `Using parallel processing with ${strategy.maxWorkers} workers for ${files.length} files`,
        createLogContext({
          operation: "parallel-processing",
          workerCount: strategy.maxWorkers,
          fileCount: files.length,
        }),
      );

      return await this.executeParallelProcessing(
        files,
        validationRules,
        strategy.maxWorkers,
        boundsMonitor,
        processDocument,
      );
    } else {
      this.config.debugLogger?.info(
        `Using sequential processing for ${files.length} files`,
        createLogContext({
          operation: "sequential-processing",
          fileCount: files.length,
        }),
      );

      return this.executeSequentialProcessing(
        files,
        validationRules,
        boundsMonitor,
        processDocument,
      );
    }
  }

  /**
   * Determine processing strategy based on configuration and file count
   * Encapsulates strategy decision logic with adaptive handling
   */
  private determineProcessingStrategy(
    fileCount: number,
    legacyOptions?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
    processingOptionsState?: ProcessingOptionsState,
  ): Result<ProcessingStrategyDecision, DomainError & { message: string }> {
    this.config.debugLogger?.debug(
      "Determining processing strategy",
      createLogContext({
        operation: "strategy-determination",
        inputs: `fileCount: ${fileCount}, hasLegacyOptions: ${!!legacyOptions}`,
      }),
    );

    // Get configuration thresholds from performance settings
    const minFilesForParallel = this.config.performanceSettings
      .getMinFilesForParallel();
    const defaultMaxWorkers = this.config.performanceSettings
      .getDefaultMaxWorkers();

    // Initial strategy decision based on legacy options
    let useParallel = legacyOptions?.parallel === true &&
      fileCount >= minFilesForParallel;
    let maxWorkers = legacyOptions?.maxWorkers || defaultMaxWorkers;
    let strategyReason = "legacy-options-based";
    let configurationSource = "performance-settings";

    // Handle adaptive strategy if provided
    if (processingOptionsState?.kind === "adaptive") {
      const previousParallel = useParallel;
      useParallel = fileCount > processingOptionsState.maxFileThreshold;
      maxWorkers = processingOptionsState.baseWorkers;
      strategyReason = "adaptive-threshold-based";
      configurationSource = "adaptive-options";

      // Track adaptive strategy variance
      const adaptiveTrackingResult = this.config.monitoringService
        .trackAdaptiveStrategyVariance(
          fileCount,
          processingOptionsState.maxFileThreshold,
          previousParallel,
          useParallel,
        );
      if (!adaptiveTrackingResult.ok) {
        this.config.debugLogger?.warn(
          "Failed to track adaptive strategy variance",
          createLogContext({
            operation: "adaptive-strategy-tracking",
            error: adaptiveTrackingResult.error.message,
          }),
        );
      }
    }

    const decision: ProcessingStrategyDecision = {
      useParallel,
      maxWorkers,
      strategyReason,
      configurationSource,
    };

    this.config.debugLogger?.debug(
      "Processing strategy determined",
      createLogContext({
        operation: "strategy-determination",
        decision: {
          useParallel: decision.useParallel,
          maxWorkers: decision.maxWorkers,
          reason: decision.strategyReason,
        },
      }),
    );

    return ok(decision);
  }

  /**
   * Setup processing bounds monitoring
   * Initializes bounds monitor and tracks initialization with monitoring service
   */
  private setupProcessingBounds(
    actualBounds: ProcessingBounds,
    fileCount: number,
  ): Result<ProcessingBoundsMonitor, DomainError & { message: string }> {
    this.config.debugLogger?.debug(
      "Setting up processing bounds monitoring",
      createLogContext({
        operation: "bounds-setup",
        inputs: `boundsType: ${actualBounds.kind}, fileCount: ${fileCount}`,
      }),
    );

    // Create bounds monitor with actual bounds (guaranteed to be non-undefined)
    const boundsMonitor = ProcessingBoundsMonitor.create(actualBounds);

    // Log bounds initialization with monitoring service
    const boundsLogResult = this.config.monitoringService
      .logProcessingBoundsInitialization(
        actualBounds.kind,
        fileCount,
      );
    if (!boundsLogResult.ok) {
      this.config.debugLogger?.warn(
        "Failed to log bounds initialization",
        createLogContext({
          operation: "bounds-logging",
          error: boundsLogResult.error.message,
        }),
      );
    }

    return ok(boundsMonitor);
  }

  /**
   * Execute parallel processing strategy
   * Coordinates parallel file processing with proper error handling
   */
  private async executeParallelProcessing(
    files: string[],
    validationRules: ValidationRules,
    maxWorkers: number,
    boundsMonitor: ProcessingBoundsMonitor,
    processDocument?: DocumentProcessor,
  ): Promise<Result<ProcessedDocuments, DomainError & { message: string }>> {
    if (!processDocument) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Document processor is required for parallel processing",
      }));
    }

    // Create parallel processor configuration
    const parallelProcessorConfig = {
      processDocument: processDocument,
      debugLogger: this.config.debugLogger,
    };

    const parallelProcessorResult = FrontmatterParallelProcessor.create(
      parallelProcessorConfig,
    );
    if (!parallelProcessorResult.ok) {
      return parallelProcessorResult;
    }

    // Execute parallel processing
    const results = await parallelProcessorResult.data.processFilesInParallel(
      files,
      validationRules,
      maxWorkers,
      boundsMonitor,
    );

    if (!results.ok) {
      return results;
    }

    // Collect results from parallel processing
    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    for (const result of results.data) {
      processedData.push(result.frontmatterData);
      documents.push(result.document);
    }

    this.config.debugLogger?.info(
      `Parallel processing completed successfully`,
      createLogContext({
        operation: "parallel-processing",
        processedCount: processedData.length,
        totalFiles: files.length,
      }),
    );

    return ok({
      documents,
      processedData,
    });
  }

  /**
   * Execute sequential processing strategy
   * Coordinates sequential file processing with memory monitoring
   */
  private executeSequentialProcessing(
    files: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    processDocument?: DocumentProcessor,
  ): Result<ProcessedDocuments, DomainError & { message: string }> {
    if (!processDocument) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Document processor is required for sequential processing",
      }));
    }

    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    // Sequential processing with memory monitoring
    for (const filePath of files) {
      // Memory bounds monitoring - check state before processing each file
      const state = boundsMonitor.checkState(processedData.length);
      if (state.kind === "exceeded_limit") {
        return ErrorHandler.system({
          operation: "executeSequentialProcessing",
          method: "checkMemoryBounds",
        }).memoryBoundsViolation(
          `Processing exceeded bounds: ${state.limit}`,
        );
      }

      if (state.kind === "approaching_limit") {
        this.config.debugLogger?.warn(
          `Approaching memory limit: ${
            Math.round(state.usage.heapUsed / 1024 / 1024)
          }MB used, threshold: ${
            Math.round(state.warningThreshold / 1024 / 1024)
          }MB`,
          createLogContext({
            operation: "memory-monitoring",
            heapUsed: state.usage.heapUsed,
            warningThreshold: state.warningThreshold,
          }),
        );
      }

      this.config.debugLogger?.debug(
        `Processing file: ${filePath}`,
        createLogContext({
          operation: "file-processing",
          filePath,
        }),
      );

      const documentResult = processDocument(filePath, validationRules);
      if (documentResult.ok) {
        processedData.push(documentResult.data.frontmatterData);
        documents.push(documentResult.data.document);

        this.config.debugLogger?.debug(
          `Successfully processed: ${filePath}`,
          createLogContext({
            operation: "file-processing",
            filePath,
            status: "success",
          }),
        );

        // Periodic O(log n) memory growth validation
        if (processedData.length % 100 === 0 && processedData.length > 0) {
          const growthResult = boundsMonitor.validateMemoryGrowth(
            processedData.length,
          );
          if (!growthResult.ok) {
            this.config.debugLogger?.warn(
              `Memory growth validation warning: ${growthResult.error.message}`,
              createLogContext({
                operation: "memory-monitoring",
                processedCount: processedData.length,
              }),
            );
          }
        }
      } else {
        this.config.debugLogger?.error(
          `Failed to process file: ${filePath}`,
          createLogContext({
            operation: "file-processing",
            filePath,
            stage: "individual-file-processing",
            error: documentResult.error,
          }),
        );
      }
      // Note: Individual file failures don't stop processing
    }

    this.config.debugLogger?.info(
      `Sequential processing completed successfully`,
      createLogContext({
        operation: "sequential-processing",
        processedCount: processedData.length,
        totalFiles: files.length,
      }),
    );

    return ok({
      documents,
      processedData,
    });
  }
}
