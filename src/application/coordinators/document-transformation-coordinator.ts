import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../../domain/frontmatter/entities/markdown-document.ts";
import { ProcessingBoundsMonitor } from "../../domain/shared/types/processing-bounds.ts";
import { DebugLogger } from "../../domain/shared/services/debug-logger.ts";
import { createEnhancedDebugLogger } from "../../domain/shared/services/enhanced-debug-logger.ts";

// Domain service imports
import {
  SchemaValidationServicePort,
  ValidationRulesAdjustmentService,
} from "../../domain/frontmatter/services/validation-rules-adjustment-service.ts";
import {
  ProcessingStrategyOptions,
  ProcessingStrategyService,
} from "../../domain/frontmatter/services/processing-strategy-service-final.ts";
import {
  AggregationProcessingService,
  AggregatorPort,
  MergeOperationsPort,
} from "../../domain/frontmatter/services/aggregation-processing-service-final.ts";
import { DocumentProcessorPort } from "../../domain/frontmatter/utilities/batch-processor.ts";
import { PerformanceSettings } from "../../domain/configuration/value-objects/performance-settings.ts";

/**
 * Configuration for the DocumentTransformationCoordinator
 * Following dependency injection pattern for Totality compliance
 */
export interface DocumentTransformationCoordinatorConfig {
  readonly schemaValidationService: SchemaValidationServicePort;
  readonly aggregator: AggregatorPort;
  readonly mergeOperations: MergeOperationsPort;
  readonly documentProcessor: DocumentProcessorPort;
  readonly performanceSettings: PerformanceSettings;
  readonly logger?: DebugLogger;
}

/**
 * Application layer coordinator that orchestrates domain services for document transformation.
 *
 * Following DDD principles:
 * - Application Service pattern for cross-domain coordination
 * - Orchestrates domain services without containing business logic
 * - Implements Totality principle with Result<T,E> pattern
 * - Uses Smart Constructor pattern for safe instantiation
 * - <300 lines for AI complexity compliance
 *
 * Coordinates the 5-stage processing pipeline:
 * 1. Validation rules adjustment based on schema
 * 2. File listing and bounds monitoring setup
 * 3. Document processing (parallel or sequential)
 * 4. Frontmatter-part processing
 * 5. Data aggregation and base property population
 *
 * Addresses Issue #1021: Replaces 1026-line monolithic pipeline with DDD-compliant architecture
 */
export class DocumentTransformationCoordinator {
  private readonly logger: DebugLogger;
  private readonly validationRulesService: ValidationRulesAdjustmentService;
  private readonly processingStrategyService: ProcessingStrategyService;
  private readonly aggregationProcessingService: AggregationProcessingService;

  private constructor(
    private readonly config: DocumentTransformationCoordinatorConfig,
    validationRulesService: ValidationRulesAdjustmentService,
    processingStrategyService: ProcessingStrategyService,
    aggregationProcessingService: AggregationProcessingService,
  ) {
    // Initialize logger
    if (config.logger) {
      this.logger = config.logger;
    } else {
      const loggerResult = createEnhancedDebugLogger("document-transformation");
      this.logger = loggerResult.ok
        ? loggerResult.data
        : this.createNoOpLogger();
    }

    // Initialize domain services (already validated)
    this.validationRulesService = validationRulesService;
    this.processingStrategyService = processingStrategyService;
    this.aggregationProcessingService = aggregationProcessingService;
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(
    config: DocumentTransformationCoordinatorConfig,
  ): Result<
    DocumentTransformationCoordinator,
    DomainError & { message: string }
  > {
    // Validate required dependencies
    if (!config.schemaValidationService) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "SchemaValidationService is required for DocumentTransformationCoordinator",
      }));
    }

    if (!config.aggregator) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Aggregator is required for DocumentTransformationCoordinator",
      }));
    }

    if (!config.mergeOperations) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "MergeOperations is required for DocumentTransformationCoordinator",
      }));
    }

    if (!config.documentProcessor) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "DocumentProcessor is required for DocumentTransformationCoordinator",
      }));
    }

    if (!config.performanceSettings) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "PerformanceSettings is required for DocumentTransformationCoordinator",
      }));
    }

    // Validate domain service creation
    const validationServiceResult = ValidationRulesAdjustmentService.create(
      config.schemaValidationService,
    );
    if (!validationServiceResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Failed to create ValidationRulesAdjustmentService: ${validationServiceResult.error.message}`,
      }));
    }

    const processingServiceResult = ProcessingStrategyService.create(
      config.documentProcessor,
      config.performanceSettings,
    );
    if (!processingServiceResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Failed to create ProcessingStrategyService: ${processingServiceResult.error.message}`,
      }));
    }

    const aggregationServiceResult = AggregationProcessingService.create(
      config.aggregator,
      config.mergeOperations,
    );
    if (!aggregationServiceResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Failed to create AggregationProcessingService: ${aggregationServiceResult.error.message}`,
      }));
    }

    return ok(
      new DocumentTransformationCoordinator(
        config,
        validationServiceResult.data,
        processingServiceResult.data,
        aggregationServiceResult.data,
      ),
    );
  }

  /**
   * Main orchestration method that coordinates the 5-stage processing pipeline.
   */
  transform(
    files: string[],
    originalRules: ValidationRules,
    schema: Schema,
    boundsMonitor: ProcessingBoundsMonitor,
    options?: {
      processingStrategy?: ProcessingStrategyOptions;
      enableAggregation?: boolean;
    },
  ): Result<
    {
      processedData: FrontmatterData[];
      documents: MarkdownDocument[];
      aggregatedData?: FrontmatterData;
    },
    DomainError & { message: string }
  > {
    this.logger.info(
      `Starting document transformation for ${files.length} files`,
      {
        operation: "document-transformation",
        fileCount: files.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Stage 1: Adjust validation rules based on schema
    const adjustedRulesResult = this.validationRulesService.adjustRules(
      originalRules,
      schema,
    );
    if (!adjustedRulesResult.ok) {
      return adjustedRulesResult;
    }

    const validationRules = adjustedRulesResult.data;
    this.logger.debug("Validation rules adjusted successfully");

    // Stage 2: Process documents using appropriate strategy
    const documentsResult = this.processingStrategyService.processDocuments(
      files,
      validationRules,
      boundsMonitor,
      options?.processingStrategy,
    );
    if (!documentsResult.ok) {
      return documentsResult;
    }

    const { processedData, documents } = documentsResult.data;
    this.logger.info(
      `Document processing completed: ${processedData.length} files processed`,
    );

    // Stage 3: Aggregate data if aggregation is enabled
    let aggregatedData: FrontmatterData | undefined = undefined;
    if (options?.enableAggregation && processedData.length > 0) {
      const aggregationResult = this.aggregationProcessingService.aggregateData(
        processedData,
        schema,
      );
      if (!aggregationResult.ok) {
        this.logger.warn(
          `Aggregation failed: ${aggregationResult.error.message}`,
        );
        // Continue without aggregation rather than failing the entire process
      } else {
        aggregatedData = aggregationResult.data;
        this.logger.debug("Data aggregation completed successfully");
      }
    }

    this.logger.info(
      "Document transformation completed successfully",
      {
        operation: "document-transformation-completion",
        processedCount: processedData.length,
        aggregated: !!aggregatedData,
        timestamp: new Date().toISOString(),
      },
    );

    return ok({
      processedData,
      documents,
      aggregatedData,
    });
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
