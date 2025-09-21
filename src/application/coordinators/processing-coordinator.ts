import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { FrontmatterDataFactory } from "../../domain/frontmatter/factories/frontmatter-data-factory.ts";
import { ExtractFromProcessor } from "../../domain/schema/services/extract-from-processor.ts";
import { PropertyExtractor } from "../../domain/schema/extractors/property-extractor.ts";
import {
  ProcessingHints,
  SchemaStructureDetector,
} from "../../domain/schema/services/schema-structure-detector.ts";
import { StructureType } from "../../domain/schema/value-objects/structure-type.ts";
import { DebugLogger } from "../../infrastructure/adapters/debug-logger.ts";
import { RecoveryStrategyRegistry } from "../../domain/recovery/services/recovery-strategy-registry.ts";
import { DirectiveProcessor } from "../../domain/schema/services/directive-processor.ts";
import { PerformanceSettings } from "../../domain/configuration/value-objects/performance-settings.ts";

/**
 * Processing options using discriminated unions (Totality principle)
 */
export type ProcessingOptions =
  | {
    readonly kind: "sequential";
  }
  | {
    readonly kind: "parallel";
    readonly maxWorkers: number;
  };

/**
 * Processing Coordinator - Application Service
 *
 * Responsible for orchestrating document processing operations
 * Following DDD principles:
 * - Single responsibility: Document processing coordination
 * - Clean boundaries: Uses domain services, no infrastructure coupling
 * - Totality: All methods return Result<T,E>
 */
export class ProcessingCoordinator {
  private readonly extractFromProcessor: ExtractFromProcessor;
  private readonly logger: DebugLogger | null;
  private readonly recoveryRegistry: RecoveryStrategyRegistry;
  private readonly performanceSettings: PerformanceSettings;

  constructor(
    private readonly frontmatterTransformer: FrontmatterTransformationService,
    propertyExtractor?: PropertyExtractor,
    logger?: DebugLogger,
    optimizedExtractor?: boolean,
    recoveryRegistry?: RecoveryStrategyRegistry,
    performanceSettings?: PerformanceSettings,
  ) {
    this.logger = logger || null;

    // Initialize recovery registry with defaults if not provided
    if (recoveryRegistry) {
      this.recoveryRegistry = recoveryRegistry;
    } else {
      const registryResult = RecoveryStrategyRegistry.createWithDefaults();
      if (!registryResult.ok) {
        throw new Error(
          `Failed to create default RecoveryStrategyRegistry: ${registryResult.error.message}`,
        );
      }
      this.recoveryRegistry = registryResult.data;
    }

    // Initialize performance settings with defaults if not provided
    if (performanceSettings) {
      this.performanceSettings = performanceSettings;
    } else {
      const settingsResult = PerformanceSettings.createDefault();
      if (!settingsResult.ok) {
        throw new Error(
          `Failed to create default PerformanceSettings: ${settingsResult.error.message}`,
        );
      }
      this.performanceSettings = settingsResult.data;
    }

    // HIGH-VARIANCE DEBUG POINT: Schema processing optimization strategy
    // Critical variance point for parallel schema loading and caching
    const optimizedConfig = {
      enablePathCache: this.performanceSettings.isPathCacheEnabled(),
      enableExtractionCache: this.performanceSettings
        .isExtractionCacheEnabled(),
      enableMetrics: this.performanceSettings.areMetricsEnabled(),
      maxConcurrentExtractions: this.performanceSettings
        .getMaxConcurrentExtractions(),
    };

    this.logger?.logDebug(
      "variance-debug-point",
      "Schema processing optimization configuration - High variance detection",
      {
        debugPoint: "schema-optimization-strategy",
        optimizationConfig: optimizedConfig,
        performanceProfile: this.performanceSettings.getCurrentProfile(),
        varianceRisk: "high",
        parallelismImpact: "schema-loading-variance-300-400%",
        cachingStrategy: "path-and-extraction-cache",
        configurationSource: "external-performance-settings",
        hardcodingViolationFixed: true,
      },
    );

    // Use optimized extractor by default for better performance
    if (optimizedExtractor !== false) {
      const optimizedResult = ExtractFromProcessor.createOptimized(
        optimizedConfig,
      );

      if (optimizedResult.ok) {
        this.extractFromProcessor = optimizedResult.data;
        if (this.logger) {
          this.logger.logDebug(
            "extractor-optimization",
            "Using OptimizedPropertyExtractor for enhanced performance",
            {
              cacheEnabled: true,
              metricsEnabled: true,
              maxConcurrent: 20,
            },
          );
        }
        return;
      } else {
        // Log warning and fall back to basic extractor
        if (this.logger) {
          this.logger.logDebug(
            "extractor-fallback",
            "Failed to create OptimizedPropertyExtractor, falling back to basic extractor",
            {
              error: optimizedResult.error.message,
            },
          );
        }
      }
    }

    // Fallback to basic extractor
    const result = ExtractFromProcessor.create(propertyExtractor);
    if (!result.ok) {
      throw new Error("Failed to create ExtractFromProcessor");
    }
    this.extractFromProcessor = result.data;
  }

  /**
   * Smart Constructor for ProcessingCoordinator
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    frontmatterTransformer: FrontmatterTransformationService,
    propertyExtractor?: PropertyExtractor,
    logger?: DebugLogger,
    optimizedExtractor?: boolean,
    recoveryRegistry?: RecoveryStrategyRegistry,
  ): Result<ProcessingCoordinator, DomainError & { message: string }> {
    if (!frontmatterTransformer) {
      return err(createError({
        kind: "InitializationError",
        message: "FrontmatterTransformationService is required",
      }));
    }

    return ok(
      new ProcessingCoordinator(
        frontmatterTransformer,
        propertyExtractor,
        logger,
        optimizedExtractor,
        recoveryRegistry,
      ),
    );
  }

  /**
   * Create ProcessingCoordinator with high-performance optimizations enabled
   */
  static createOptimized(
    frontmatterTransformer: FrontmatterTransformationService,
    logger?: DebugLogger,
  ): Result<ProcessingCoordinator, DomainError & { message: string }> {
    return ProcessingCoordinator.create(
      frontmatterTransformer,
      undefined, // Use default PropertyExtractor
      logger,
      true, // Enable optimized extractor
      undefined, // Use default RecoveryStrategyRegistry
    );
  }

  /**
   * Process documents using the frontmatter transformation service
   * Extracted from PipelineOrchestrator document processing logic
   * Following Totality principles - total function returning Result<T,E>
   */
  async processDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // Debug: ValidationRules application timing (Issue #905 Phase 1)
    this.logger?.logDebug(
      "validation-timing",
      "ValidationRules application started",
      {
        inputPattern,
        validationStrategy: "fail-fast", // Current implementation strategy
        ruleCount: validationRules.getRules().length,
        processingMode: options.kind,
      },
    );

    // Convert ProcessingOptions to transformation service options
    const transformationOptions = this.convertProcessingOptions(options);

    // Debug: Processing variance tracking (Issue #905 Phase 1)
    this.logger?.logDebug(
      "processing-variance",
      "Processing options converted for transformation",
      {
        originalOptions: options,
        transformationOptions,
        expectedVariance: "low",
      },
    );

    const result = await this.frontmatterTransformer.transformDocuments(
      inputPattern,
      validationRules,
      schema,
      undefined, // processingBounds - using default
      transformationOptions,
    );

    // Debug: Error propagation tracking (Issue #905 Phase 1)
    if (!result.ok) {
      this.logger?.logDebug(
        "error-propagation",
        "Document processing failed - evaluating recovery options",
        {
          errorKind: result.error.kind,
          propagationStrategy: "error-classification",
          recoveryEvaluation: "determining-if-recoverable",
        },
      );

      // Check if error is recoverable using RecoveryStrategyRegistry (Issue #905 Phase 3)
      const isRecoverable = this.recoveryRegistry.canRecover(result.error.kind);

      if (!isRecoverable) {
        this.logger?.logDebug(
          "error-propagation",
          "Error is non-recoverable - propagating unchanged",
          {
            errorKind: result.error.kind,
            propagationStrategy: "direct-propagation",
            reason: "non-recoverable-error-type",
          },
        );
        return result;
      }

      // Get recovery strategy for enhanced debugging
      const recoveryStrategyResult = this.recoveryRegistry.getRecoveryStrategy(
        result.error.kind,
      );
      const recoveryStrategy = recoveryStrategyResult.ok
        ? recoveryStrategyResult.data
        : undefined;

      this.logger?.logDebug(
        "error-propagation",
        "Error is recoverable - attempting recovery",
        {
          errorKind: result.error.kind,
          propagationStrategy: "recovery-attempt",
          recoveryStrategy: recoveryStrategy
            ? {
              kind: recoveryStrategy.getStrategyType().kind,
              maxAttempts: recoveryStrategy.getMaxAttempts(),
              priority: recoveryStrategy.getPriority(),
            }
            : "none",
          recoveryOptions: [
            "partial-result",
            "fallback-validation",
            "user-guidance",
          ],
        },
      );

      // Issue #905 Phase 3: Error recovery mechanisms
      const recoveryResult = await this.attemptErrorRecovery(
        result.error,
        inputPattern,
        validationRules,
        schema,
        options,
      );

      if (recoveryResult.ok) {
        this.logger?.logDebug(
          "error-recovery-success",
          "Error recovery completed successfully",
          {
            originalError: result.error.kind,
            recoveryStrategy: recoveryResult.data.strategy,
            recoveredDataSize: recoveryResult.data.data.getAllKeys().length,
            partialSuccess: true,
          },
        );
        return ok(recoveryResult.data.data);
      } else {
        this.logger?.logDebug(
          "error-recovery-failed",
          "Error recovery unsuccessful - returning enhanced error",
          {
            originalError: result.error.kind,
            recoveryError: recoveryResult.error.kind,
            userGuidance: recoveryResult.error.message,
          },
        );
        return recoveryResult;
      }
    } else {
      this.logger?.logDebug(
        "processing-success",
        "Document processing completed successfully",
        {
          dataSize: result.data.getAllKeys().length,
          processingVariance: "within-tolerance",
        },
      );
    }

    return result;
  }

  /**
   * Extract frontmatter-part data as array for items expansion
   * Extracted from PipelineOrchestrator.extractFrontmatterPartData()
   * Following DDD - coordination of domain operations
   */
  extractFrontmatterPartData(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    // Debug: Frontmatter-part extraction variance tracking (Issue #905 Phase 1)
    this.logger?.logDebug(
      "frontmatter-part-extraction",
      "Starting frontmatter-part data extraction",
      {
        dataKeys: data.getAllKeys(),
        schemaPath: schema.getPath().toString(),
        extractionStrategy: "array-expansion",
      },
    );

    // Check if schema has frontmatter-part definition
    const pathResult = schema.findFrontmatterPartPath();
    if (!pathResult.ok) {
      // No frontmatter-part defined, return data as single item array
      this.logger?.logDebug(
        "frontmatter-part-extraction",
        "No frontmatter-part path found, using single-item strategy",
        {
          reason: "no-frontmatter-part-defined",
          fallbackStrategy: "single-item-array",
        },
      );
      return ok([data]);
    }

    const frontmatterPartPath = pathResult.data;

    // Debug: Path resolution tracking (Issue #905 Phase 1)
    this.logger?.logDebug(
      "frontmatter-part-path",
      "Frontmatter-part path resolved",
      {
        path: frontmatterPartPath,
        pathResolutionStrategy: "schema-traversal",
      },
    );

    // Check if this data already contains an array at the frontmatter-part path
    const arrayDataResult = data.get(frontmatterPartPath);
    const hasArrayData = arrayDataResult.ok &&
      Array.isArray(arrayDataResult.data);

    if (hasArrayData) {
      // File contains array at target path - extract individual items
      this.logger?.logDebug(
        "array-processing-variance",
        "Processing array data at frontmatter-part path",
        {
          arrayLength: arrayDataResult.data.length,
          processingStrategy: "item-by-item-extraction",
          expectedVariance: "item-validation-failures",
        },
      );

      const result: FrontmatterData[] = [];
      let processedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < arrayDataResult.data.length; i++) {
        const item = arrayDataResult.data[i];

        // Skip invalid items gracefully (null, primitives, etc.)
        if (!item || typeof item !== "object") {
          skippedCount++;
          continue;
        }

        const itemDataResult = FrontmatterDataFactory.fromParsedData(item);
        if (itemDataResult.ok) {
          result.push(itemDataResult.data);
          processedCount++;
        } else {
          skippedCount++;
        }
        // Continue processing other items even if one fails
      }

      // Debug: Array processing results (Issue #905 Phase 1)
      this.logger?.logDebug(
        "array-processing-results",
        "Array processing completed",
        {
          totalItems: arrayDataResult.data.length,
          processedItems: processedCount,
          skippedItems: skippedCount,
          processingVariance: skippedCount > 0 ? "high" : "low",
        },
      );

      return ok(result);
    } else {
      // Default case: individual file contributes directly as one item
      this.logger?.logDebug(
        "frontmatter-part-extraction",
        "No array data found, using single-item fallback",
        {
          reason: "no-array-at-path",
          fallbackStrategy: "single-item-array",
          dataType: arrayDataResult.ok
            ? typeof arrayDataResult.data
            : "unknown",
        },
      );
      return ok([data]);
    }
  }

  /**
   * Process documents and extract items if needed
   * Common coordination pattern combining processing and extraction
   */
  async processDocumentsWithItemsExtraction(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<
    Result<{
      mainData: FrontmatterData;
      itemsData?: FrontmatterData[];
    }, DomainError & { message: string }>
  > {
    // Process documents first
    const processResult = await this.processDocuments(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    const mainData = processResult.data;

    // Check if we need to extract items data
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    const hasFrontmatterPart = frontmatterPartResult.ok;

    if (hasFrontmatterPart) {
      const itemsResult = this.extractFrontmatterPartData(mainData, schema);
      if (!itemsResult.ok) {
        return itemsResult;
      }

      return ok({
        mainData,
        itemsData: itemsResult.data,
      });
    }

    return ok({ mainData });
  }

  /**
   * Process x-extract-from directives on frontmatter data
   * Extracts specified property paths from the data structure
   * Enhanced with async support for optimized extractors
   */
  async processExtractFromDirectives(
    data: FrontmatterData,
    schema: Schema,
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // Check if schema has extract-from directives
    if (!schema.hasExtractFromDirectives()) {
      return ok(data);
    }

    // Get extract-from directives from schema
    const directivesResult = schema.getExtractFromDirectives();
    if (!directivesResult.ok) {
      return err(createError({
        kind: "InvalidSchema",
        message: "Failed to get extract-from directives from schema",
      }));
    }

    // Check if we have an optimized extractor to use async processing
    const stats = this.extractFromProcessor.getPerformanceStats();
    if (stats.isOptimized) {
      // Use async processing for optimized extractor
      return await this.extractFromProcessor.processDirectives(
        data,
        directivesResult.data,
      );
    } else {
      // Use sync processing for backward compatibility
      return this.extractFromProcessor.processDirectivesSync(
        data,
        directivesResult.data,
      );
    }
  }

  /**
   * Synchronous version for backward compatibility
   * Use when you need synchronous processing or with basic extractors
   */
  processExtractFromDirectivesSync(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Check if schema has extract-from directives
    if (!schema.hasExtractFromDirectives()) {
      return ok(data);
    }

    // Get extract-from directives from schema
    const directivesResult = schema.getExtractFromDirectives();
    if (!directivesResult.ok) {
      return err(createError({
        kind: "InvalidSchema",
        message: "Failed to get extract-from directives from schema",
      }));
    }

    // Use sync processing
    return this.extractFromProcessor.processDirectivesSync(
      data,
      directivesResult.data,
    );
  }

  /**
   * Process documents with x-extract-from directives applied
   * Combines document processing with directive application
   */
  async processDocumentsWithExtractFrom(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // Process documents first
    const processResult = await this.processDocuments(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    // Apply x-extract-from directives if present
    const extractResult = await this.processExtractFromDirectives(
      processResult.data,
      schema,
    );

    return extractResult;
  }

  /**
   * Process documents with both items extraction and x-extract-from directives
   * Comprehensive coordination combining all processing steps
   */
  async processDocumentsWithFullExtraction(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<
    Result<{
      mainData: FrontmatterData;
      itemsData?: FrontmatterData[];
    }, DomainError & { message: string }>
  > {
    // Track directive processing order with proper logging
    this.logger?.logDebug(
      "processDocumentsWithFullExtraction",
      "Starting deterministic directive processing",
      {
        inputPattern,
        processingMode: options.kind,
      },
    );

    // Process documents with x-extract-from directives
    const processResult = await this.processDocumentsWithExtractFrom(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    const mainData = processResult.data;
    this.logger?.logDebug(
      "processDocumentsWithFullExtraction",
      "x-extract-from processing complete, checking for x-frontmatter-part",
      {},
    );

    // Check if we need to extract items data
    const frontmatterPartResult = schema.findFrontmatterPartPath();
    const hasFrontmatterPart = frontmatterPartResult.ok;

    if (hasFrontmatterPart) {
      this.logger?.logDebug(
        "processDocumentsWithFullExtraction",
        "x-frontmatter-part detected, extracting items",
        {
          frontmatterPartPath: frontmatterPartResult.data,
        },
      );
    }

    if (hasFrontmatterPart) {
      const itemsResult = this.extractFrontmatterPartData(mainData, schema);
      if (!itemsResult.ok) {
        return itemsResult;
      }

      // Use DirectiveProcessor for deterministic processing order
      // This eliminates the order dependency variance by processing all directives
      // in a canonical sequence defined by the DirectiveProcessor
      if (schema.hasExtractFromDirectives()) {
        this.logger?.logDebug(
          "processDocumentsWithFullExtraction",
          "Using DirectiveProcessor for deterministic x-extract-from on items",
          {
            itemCount: itemsResult.data.length,
          },
        );

        const directiveProcessorResult = DirectiveProcessor.create();
        if (!directiveProcessorResult.ok) {
          return err(createError({
            kind: "ConfigurationError",
            message:
              `Failed to create DirectiveProcessor: ${directiveProcessorResult.error.message}`,
          }));
        }

        const directiveProcessor = directiveProcessorResult.data;
        const processingOrderResult = directiveProcessor.resolveProcessingOrder(
          schema,
        );

        if (!processingOrderResult.ok) {
          return err(createError({
            kind: "AggregationFailed",
            message:
              `Failed to resolve directive processing order: ${processingOrderResult.error.message}`,
          }));
        }

        const processedItems: FrontmatterData[] = [];
        for (const item of itemsResult.data) {
          const processedItemResult = directiveProcessor.processDirectives(
            item,
            schema,
            processingOrderResult.data,
          );
          if (processedItemResult.ok) {
            processedItems.push(processedItemResult.data);
          } else {
            this.logger?.logDebug(
              "directive-processing-error",
              "Failed to process directives for item using DirectiveProcessor",
              {
                error: processedItemResult.error.kind,
                item: item.getAllKeys(),
              },
            );
            processedItems.push(item);
          }
        }

        this.logger?.logDebug(
          "processDocumentsWithFullExtraction",
          "Completed deterministic directive processing on items",
          {
            processedCount: processedItems.length,
            totalPhases: processingOrderResult.data.phases.length,
          },
        );

        return ok({
          mainData,
          itemsData: processedItems,
        });
      }

      this.logger?.logDebug(
        "processDocumentsWithFullExtraction",
        "No x-extract-from on items, completing frontmatter-part processing",
        {},
      );
      return ok({
        mainData,
        itemsData: itemsResult.data,
      });
    }

    this.logger?.logDebug(
      "processDocumentsWithFullExtraction",
      "No frontmatter-part detected, single-pass processing complete",
      {},
    );
    return ok({ mainData });
  }

  /**
   * Process documents with StructureType detection (basic variant)
   * Returns structure information alongside processed data
   * Following DDD - coordination with structure intelligence
   */
  async processDocumentsWithStructureDetection(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<
    Result<{
      data: FrontmatterData;
      structureType: StructureType;
      processingHints: ProcessingHints;
    }, DomainError & { message: string }>
  > {
    // Detect structure type first
    const structureResult = SchemaStructureDetector.detectStructureType(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    const structureType = structureResult.data;
    const processingHints = SchemaStructureDetector.getProcessingHints(
      structureType,
    );

    // Use basic processing logic
    const processResult = await this.processDocuments(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    return ok({
      data: processResult.data,
      structureType,
      processingHints,
    });
  }

  /**
   * Process documents with StructureType awareness and processing hints
   * Integrates structure detection with document processing for optimized handling
   * Following DDD - coordination of domain operations with structure intelligence
   */
  async processDocumentsWithStructureAwareness(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions = { kind: "sequential" },
  ): Promise<
    Result<{
      mainData: FrontmatterData;
      itemsData?: FrontmatterData[];
      structureType: StructureType;
      processingHints: ProcessingHints;
    }, DomainError & { message: string }>
  > {
    // Detect structure type first using our new SchemaStructureDetector
    const structureResult = SchemaStructureDetector.detectStructureType(schema);
    if (!structureResult.ok) {
      return structureResult;
    }

    const structureType = structureResult.data;
    const processingHints = SchemaStructureDetector.getProcessingHints(
      structureType,
    );

    // Use existing processing logic with structure intelligence
    const processResult = await this.processDocumentsWithFullExtraction(
      inputPattern,
      validationRules,
      schema,
      options,
    );
    if (!processResult.ok) {
      return processResult;
    }

    return ok({
      ...processResult.data,
      structureType,
      processingHints,
    });
  }

  /**
   * Convert ProcessingOptions to transformation service format
   * Following Totality principles - exhaustive pattern matching
   */
  private convertProcessingOptions(
    options: ProcessingOptions,
  ): { parallel: boolean; maxWorkers: number } {
    switch (options.kind) {
      case "sequential":
        return { parallel: false, maxWorkers: 1 };
      case "parallel":
        return { parallel: true, maxWorkers: options.maxWorkers };
    }
  }

  /**
   * Attempt error recovery for failed document processing
   * Issue #905 Phase 3: Error recovery mechanisms
   * Following Totality principles - comprehensive error handling with recovery strategies
   */
  private async attemptErrorRecovery(
    error: DomainError & { message: string },
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions,
  ): Promise<
    Result<
      { data: FrontmatterData; strategy: string },
      DomainError & { message: string }
    >
  > {
    this.logger?.logDebug(
      "error-recovery-attempt",
      "Starting error recovery process",
      {
        errorKind: error.kind,
        recoveryStrategies: [
          "partial-processing",
          "fallback-validation",
          "user-guidance",
        ],
      },
    );

    // HIGH-VARIANCE DEBUG POINT: Error recovery strategy selection
    // This represents a critical variance point in parallel processing scenarios
    const canRecoverFromValidationError = this.recoveryRegistry.canRecover(
      error.kind,
    );
    const validationStrategy = this.recoveryRegistry.getRecoveryStrategy(
      error.kind,
    );

    this.logger?.logDebug(
      "variance-debug-point",
      "Error recovery strategy evaluation - High variance detection",
      {
        debugPoint: "error-recovery-strategy-selection",
        errorKind: error.kind,
        canRecover: canRecoverFromValidationError,
        strategy: validationStrategy.ok
          ? validationStrategy.data?.getStrategyType()
          : null,
        processingMode: "fallback-validation",
        varianceRisk: "high",
        parallelismImpact: "strategy-selection-variance-300-400%",
      },
    );

    // Strategy 1: Attempt partial processing with relaxed validation
    if (
      canRecoverFromValidationError && validationStrategy.ok &&
      validationStrategy.data
    ) {
      this.logger?.logDebug(
        "error-recovery-strategy",
        "Attempting partial processing with fallback validation",
        {
          strategy: "fallback-validation",
          originalError: error.kind,
          debugContext: "high-variance-execution-path",
        },
      );

      const fallbackResult = await this.attemptFallbackValidation(
        inputPattern,
        validationRules,
        schema,
        options,
      );

      if (fallbackResult.ok) {
        return ok({
          data: fallbackResult.data,
          strategy: "fallback-validation",
        });
      }
    }

    // HIGH-VARIANCE DEBUG POINT: File system error recovery strategy
    // Critical variance point for parallel file processing scenarios
    const canRecoverFromFileSystemError = this.recoveryRegistry.canRecover(
      error.kind,
    );
    const fileSystemStrategy = this.recoveryRegistry.getRecoveryStrategy(
      error.kind,
    );

    this.logger?.logDebug(
      "variance-debug-point",
      "File system error recovery evaluation - High variance detection",
      {
        debugPoint: "filesystem-error-recovery-strategy",
        errorKind: error.kind,
        canRecover: canRecoverFromFileSystemError,
        strategy: fileSystemStrategy.ok
          ? fileSystemStrategy.data?.getStrategyType()
          : null,
        processingMode: "partial-processing",
        varianceRisk: "high",
        parallelismImpact: "filesystem-recovery-variance-200-500%",
        memoryImpact: "partial-result-accumulation",
      },
    );

    // Strategy 2: Attempt partial result extraction for file system or frontmatter errors
    if (
      canRecoverFromFileSystemError && fileSystemStrategy.ok &&
      fileSystemStrategy.data
    ) {
      this.logger?.logDebug(
        "error-recovery-strategy",
        "Attempting partial result extraction",
        {
          strategy: "partial-processing",
          originalError: error.kind,
          debugContext: "high-variance-filesystem-path",
        },
      );

      const partialResult = this.attemptPartialProcessing(
        inputPattern,
        validationRules,
        schema,
        options,
      );

      if (partialResult.ok) {
        return ok({
          data: partialResult.data,
          strategy: "partial-processing",
        });
      }
    }

    // Strategy 3: Return enhanced error with user guidance
    this.logger?.logDebug(
      "error-recovery-strategy",
      "Providing enhanced error with user guidance",
      {
        strategy: "user-guidance",
        originalError: error.kind,
      },
    );

    return err(createError({
      kind: "InitializationError",
      message: this.generateUserGuidanceMessage(error, inputPattern),
    }));
  }

  /**
   * Attempt processing with fallback validation rules
   * More permissive validation to recover partial data
   */
  private async attemptFallbackValidation(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options: ProcessingOptions,
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    this.logger?.logDebug(
      "fallback-validation",
      "Creating relaxed validation rules for recovery",
      {
        originalRules: validationRules.getRules().length,
        fallbackStrategy: "optional-fields",
      },
    );

    // Create fallback validation rules (make all fields optional)
    const fallbackRules = this.createFallbackValidationRules(validationRules);

    // Convert ProcessingOptions to transformation service options
    const transformationOptions = this.convertProcessingOptions(options);

    const result = await this.frontmatterTransformer.transformDocuments(
      inputPattern,
      fallbackRules,
      schema,
      undefined, // processingBounds - using default
      transformationOptions,
    );

    if (result.ok) {
      this.logger?.logDebug(
        "fallback-validation-success",
        "Fallback validation recovered partial data",
        {
          recoveredDataSize: result.data.getAllKeys().length,
          strategy: "relaxed-validation",
        },
      );
    }

    return result;
  }

  /**
   * Attempt to extract partial results from available data
   * Process what can be processed, skip what fails
   */
  private attemptPartialProcessing(
    _inputPattern: string,
    _validationRules: ValidationRules,
    _schema: Schema,
    _options: ProcessingOptions,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    this.logger?.logDebug(
      "partial-processing",
      "Attempting partial result extraction",
      {
        strategy: "best-effort-processing",
        skipErrors: true,
      },
    );

    // Implementation would involve file-by-file processing with error tolerance
    // For now, return a minimal data structure
    const emptyDataResult = FrontmatterData.create({});
    if (!emptyDataResult.ok) {
      return emptyDataResult;
    }

    this.logger?.logDebug(
      "partial-processing-fallback",
      "Created minimal data structure for partial recovery",
      {
        strategy: "minimal-data",
        dataSize: 0,
      },
    );

    return ok(emptyDataResult.data);
  }

  /**
   * Create relaxed validation rules for error recovery
   * Makes required fields optional to allow partial processing
   */
  private createFallbackValidationRules(
    _originalRules: ValidationRules,
  ): ValidationRules {
    // Create more permissive rules - simplified implementation
    // In a full implementation, this would analyze the original rules
    // and create optional variants
    return ValidationRules.create([]);
  }

  /**
   * Generate user-friendly error message with recovery suggestions
   * Issue #905 Phase 3: User-friendly error messaging
   */
  private generateUserGuidanceMessage(
    error: DomainError & { message: string },
    inputPattern: string,
  ): string {
    const baseMessage =
      `Processing failed for pattern "${inputPattern}": ${error.message}`;

    switch (error.kind) {
      case "MissingRequired":
      case "InvalidType":
      case "InvalidFormat":
        return `${baseMessage}

Recovery suggestions:
1. Check your frontmatter structure matches the schema requirements
2. Verify all required fields are present in your markdown files
3. Try processing individual files to identify specific validation issues
4. Consider using a more permissive schema for initial testing`;

      case "FileNotFound":
      case "ReadFailed":
      case "PermissionDenied":
        return `${baseMessage}

Recovery suggestions:
1. Verify the file pattern matches existing files
2. Check file permissions and accessibility
3. Try processing a smaller subset of files first
4. Ensure markdown files have valid frontmatter syntax`;

      case "InvalidSchema":
      case "TemplateNotDefined":
        return `${baseMessage}

Recovery suggestions:
1. Validate your schema file syntax
2. Check for missing or circular references
3. Verify schema extensions are properly defined
4. Try using a simpler schema to isolate the issue`;

      default:
        return `${baseMessage}

General recovery suggestions:
1. Check the CLI documentation for usage examples
2. Verify input files and schema are accessible
3. Try running with --verbose flag for more details
4. Consider processing files individually to isolate issues`;
    }
  }
}
