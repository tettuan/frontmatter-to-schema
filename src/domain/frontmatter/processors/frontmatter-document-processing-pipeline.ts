/**
 * @fileoverview FrontmatterDocumentProcessingPipeline - Document Processing Pipeline Coordination
 * @description Handles core document processing pipeline orchestration
 * Following DDD boundaries and Totality principles for processing coordination
 */

import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { ProcessingBounds } from "../../shared/types/processing-bounds.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { FrontmatterPartProcessor } from "./frontmatter-part-processor.ts";
import { FrontmatterProcessingConfigurationCoordinator } from "./frontmatter-processing-configuration-coordinator.ts";
import { FrontmatterProcessingStrategyCoordinator } from "./frontmatter-processing-strategy-coordinator.ts";
import { FrontmatterValidationPipelineCoordinator } from "./frontmatter-validation-pipeline-coordinator.ts";
import { FrontmatterLoggingBridgeService } from "./frontmatter-logging-bridge-service.ts";
import { FrontmatterAggregationProcessor } from "./frontmatter-aggregation-processor.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";
import {
  ProcessingOptionsState,
} from "../configuration/processing-options-factory.ts";
import {
  defaultFrontmatterDataCreationService,
  FrontmatterDataCreationService,
} from "../services/frontmatter-data-creation-service.ts";
import type {
  DomainFileLister,
} from "../../shared/interfaces/file-operations.ts";

/**
 * Configuration interface for document processing pipeline dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterDocumentProcessingPipelineConfig {
  readonly fileLister: DomainFileLister;
  readonly configurationCoordinator:
    FrontmatterProcessingConfigurationCoordinator;
  readonly strategyCoordinator: FrontmatterProcessingStrategyCoordinator;
  readonly validationCoordinator: FrontmatterValidationPipelineCoordinator;
  readonly loggingBridgeService: FrontmatterLoggingBridgeService;
  readonly aggregationProcessor: FrontmatterAggregationProcessor;
  readonly basePropertyPopulator: BasePropertyPopulator;
  readonly frontmatterDataCreationService?: FrontmatterDataCreationService;
  readonly processDocumentCallback: (
    filePath: string,
    validationRules: ValidationRules,
  ) => Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  >;
}

/**
 * Document processing pipeline result
 * Encapsulates processing result with metadata
 */
export interface DocumentProcessingPipelineResult {
  readonly processedData: FrontmatterData;
  readonly stagesCompleted: number;
  readonly processingMetadata: {
    fileCount: number;
    validationRulesProcessed: boolean;
    configurationCoordinated: boolean;
    filesProcessed: boolean;
    partsProcessed: boolean;
    aggregated: boolean;
    basePropertiesPopulated: boolean;
  };
}

/**
 * FrontmatterDocumentProcessingPipeline - Document Processing Pipeline Coordinator
 *
 * Responsibilities:
 * - Orchestrate complete document processing pipeline
 * - Coordinate validation rules processing
 * - Manage file listing and processing strategy
 * - Handle part processing and data aggregation
 * - Manage base property population
 *
 * Following DDD principles:
 * - Single responsibility: Document processing pipeline coordination only
 * - Domain service: Processing coordination within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 * - Pipeline orchestration: Clean integration between processing stages
 */
export class FrontmatterDocumentProcessingPipeline {
  private constructor(
    private readonly config: FrontmatterDocumentProcessingPipelineConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates document processing pipeline with validated configuration
   */
  static create(
    config: FrontmatterDocumentProcessingPipelineConfig,
  ): Result<
    FrontmatterDocumentProcessingPipeline,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config.fileLister) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "File lister is required for document processing pipeline",
        }),
      };
    }

    if (!config.configurationCoordinator) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Configuration coordinator is required for document processing pipeline",
        }),
      };
    }

    if (!config.strategyCoordinator) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Strategy coordinator is required for document processing pipeline",
        }),
      };
    }

    if (!config.validationCoordinator) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Validation coordinator is required for document processing pipeline",
        }),
      };
    }

    if (!config.aggregationProcessor) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Aggregation processor is required for document processing pipeline",
        }),
      };
    }

    if (!config.processDocumentCallback) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Process document callback is required for document processing pipeline",
        }),
      };
    }

    return ok(new FrontmatterDocumentProcessingPipeline(config));
  }

  /**
   * Execute complete document processing pipeline
   * Handles all stages from validation to base property population
   */
  async executeDocumentProcessingPipeline(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    processingBounds?: ProcessingBounds,
    legacyOptions?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
    processingOptionsState?: ProcessingOptionsState,
  ): Promise<
    Result<DocumentProcessingPipelineResult, DomainError & { message: string }>
  > {
    // Create activeLogger for backward compatibility within this method
    const activeLogger = this.config.loggingBridgeService
      .createTransformationDebugLoggerBridge();

    const processingMetadata = {
      fileCount: 0,
      validationRulesProcessed: false,
      configurationCoordinated: false,
      filesProcessed: false,
      partsProcessed: false,
      aggregated: false,
      basePropertiesPopulated: false,
    };

    // Stage 0: Process validation rules through validation coordinator
    // Delegate validation rules processing to the validation pipeline coordinator
    // This follows DDD boundaries: Validation coordination handled by specialized service
    const validationRulesProcessingResult = this.config.validationCoordinator
      .coordinateValidationRulesProcessing(validationRules, schema);

    if (!validationRulesProcessingResult.ok) {
      return validationRulesProcessingResult;
    }

    const effectiveValidationRules =
      validationRulesProcessingResult.data.effectiveRules;
    processingMetadata.validationRulesProcessed = true;

    // Log validation rules processing result
    const loggingResult = this.config.validationCoordinator
      .logValidationRulesProcessing(validationRulesProcessingResult.data);
    if (!loggingResult.ok) {
      return loggingResult;
    }

    // Stage 1: List matching files
    activeLogger?.info(
      `Starting document processing with pattern: ${inputPattern}`,
      {
        operation: "document-processing",
        pattern: inputPattern,
        timestamp: new Date().toISOString(),
      },
    );
    const filesResult = this.config.fileLister.list(inputPattern);
    if (!filesResult.ok) {
      activeLogger?.error(
        `Failed to list files with pattern: ${inputPattern}`,
        {
          operation: "file-listing",
          pattern: inputPattern,
          error: filesResult.error,
          timestamp: new Date().toISOString(),
        },
      );
      return filesResult;
    }

    activeLogger?.info(
      `Found ${filesResult.data.length} files to process`,
      {
        operation: "file-listing",
        count: filesResult.data.length,
        files: filesResult.data,
        timestamp: new Date().toISOString(),
      },
    );

    processingMetadata.fileCount = filesResult.data.length;

    // Delegate processing configuration coordination to configuration coordinator
    // This follows DDD boundaries: Configuration coordination handled by specialized service
    const configCoordinationResult = this.config.configurationCoordinator
      .coordinateProcessingConfiguration(
        filesResult.data.length,
        processingBounds,
        legacyOptions,
        processingOptionsState,
      );

    if (!configCoordinationResult.ok) {
      activeLogger?.error(
        "Processing configuration coordination failed",
        {
          operation: "configuration-coordination",
          error: configCoordinationResult.error.message,
          timestamp: new Date().toISOString(),
        },
      );
      return configCoordinationResult;
    }

    const actualBounds = configCoordinationResult.data.bounds;
    const actualLegacyOptions = configCoordinationResult.data.legacyOptions;
    processingMetadata.configurationCoordinated = true;

    // Stage 2: Process files using strategy coordinator
    // Delegate all processing strategy decisions and file orchestration to coordinator
    const processingResult = await this.config.strategyCoordinator
      .coordinateFileProcessing(
        filesResult.data,
        effectiveValidationRules,
        inputPattern,
        actualBounds,
        actualLegacyOptions,
        processingOptionsState,
        this.config.processDocumentCallback,
      );

    if (!processingResult.ok) {
      activeLogger?.error(
        "File processing coordination failed",
        {
          operation: "file-processing-coordination",
          error: processingResult.error.message,
          timestamp: new Date().toISOString(),
        },
      );
      return processingResult;
    }

    const { documents: _documents, processedData } = processingResult.data;

    if (processedData.length === 0) {
      const noDataError = ErrorHandler.aggregation({
        operation: "executeDocumentProcessingPipeline",
        method: "validateProcessedData",
      }).aggregationFailed("No valid documents found to process");
      activeLogger?.error(
        "No valid documents found to process",
        {
          operation: "document-processing",
          error: "No valid documents found to process",
          timestamp: new Date().toISOString(),
        },
      );
      return noDataError;
    }

    activeLogger?.info(
      `Successfully processed ${processedData.length} documents`,
      {
        operation: "document-processing",
        processedCount: processedData.length,
        totalFiles: filesResult.data.length,
        timestamp: new Date().toISOString(),
      },
    );

    processingMetadata.filesProcessed = true;

    // Stage 3: Apply frontmatter-part processing if needed
    activeLogger?.debug(
      "Starting frontmatter-part processing",
      {
        operation: "frontmatter-part-processing",
        timestamp: new Date().toISOString(),
      },
    );
    // Create a new part processor instance with current active logger
    const partProcessorLogger = this.config.loggingBridgeService
      .createTransformationDebugLoggerBridge();
    const partProcessorConfig = {
      frontmatterDataCreationService: this.config
        .frontmatterDataCreationService ??
        defaultFrontmatterDataCreationService,
      debugLogger: partProcessorLogger,
    };
    const activePartProcessorResult = FrontmatterPartProcessor.create(
      partProcessorConfig,
    );
    if (!activePartProcessorResult.ok) {
      return activePartProcessorResult;
    }

    const partProcessingResult = activePartProcessorResult.data
      .processFrontmatterParts(processedData, schema);
    if (!partProcessingResult.ok) {
      return partProcessingResult;
    }
    const finalData = partProcessingResult.data;

    activeLogger?.info(
      "Frontmatter-part processing complete",
      {
        operation: "frontmatter-part-processing",
        inputCount: processedData.length,
        outputCount: finalData.length,
        timestamp: new Date().toISOString(),
      },
    );

    processingMetadata.partsProcessed = true;

    // Stage 4: Aggregate data using aggregation processor
    activeLogger?.debug(
      "Starting data aggregation with aggregation processor",
      {
        operation: "aggregation",
        timestamp: new Date().toISOString(),
      },
    );
    const derivationRules = schema.getDerivedRules();

    activeLogger?.info(
      `Found ${derivationRules.length} derivation rules`,
      {
        operation: "aggregation",
        rulesCount: derivationRules.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Use aggregation processor to properly handle aggregation with error propagation
    const aggregationResult = this.config.aggregationProcessor.aggregateData(
      finalData,
      schema,
    );

    if (!aggregationResult.ok) {
      activeLogger?.error(
        "Data aggregation failed",
        {
          operation: "aggregation",
          error: aggregationResult.error.message,
          timestamp: new Date().toISOString(),
        },
      );
      return aggregationResult;
    }

    const aggregatedData = aggregationResult;
    processingMetadata.aggregated = true;

    // Stage 5: Populate base properties
    activeLogger?.debug(
      "Starting base property population",
      {
        operation: "base-property-population",
        timestamp: new Date().toISOString(),
      },
    );
    const result = this.config.basePropertyPopulator.populate(
      aggregatedData.data,
      schema,
    );

    if (result.ok) {
      activeLogger?.info(
        "Document processing pipeline completed successfully",
        {
          operation: "document-processing",
          timestamp: new Date().toISOString(),
        },
      );
      processingMetadata.basePropertiesPopulated = true;
    } else {
      activeLogger?.error(
        "Base property population failed",
        {
          operation: "base-property-population",
          error: result.error,
          timestamp: new Date().toISOString(),
        },
      );
    }

    if (!result.ok) {
      return result;
    }

    return ok({
      processedData: result.data,
      stagesCompleted: 5,
      processingMetadata,
    });
  }

  /**
   * Validate document processing pipeline preconditions
   * Ensures proper context for pipeline execution
   */
  validatePipelinePreconditions(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
  ): Result<void, DomainError & { message: string }> {
    // Validate input pattern
    if (!inputPattern || inputPattern.trim() === "") {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Input pattern is required for document processing pipeline",
        }),
      };
    }

    // Validate validation rules
    if (!validationRules) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            "Validation rules are required for document processing pipeline",
        }),
      };
    }

    // Validate schema
    if (!schema) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Schema is required for document processing pipeline",
        }),
      };
    }

    return ok(void 0);
  }

  /**
   * Create pipeline context for logging and monitoring
   * Provides structured context for pipeline operations
   */
  createPipelineContext(
    operation: string,
    inputPattern: string,
    stage?: number,
  ): Record<string, unknown> {
    return {
      operation,
      pipelineContext: {
        inputPattern,
        stage: stage ?? 0,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
