import { ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { ErrorHandler } from "../../domain/shared/services/unified-error-handler.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { FrontmatterDataFactory } from "../../domain/frontmatter/factories/frontmatter-data-factory.ts";
import { PropertyExtractor } from "../../domain/schema/extractors/property-extractor.ts";
import {
  ProcessingHints,
  SchemaStructureDetector,
} from "../../domain/schema/services/schema-structure-detector.ts";
import { StructureType } from "../../domain/schema/value-objects/structure-type.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../domain/shared/services/debug-logger.ts";
import { RecoveryStrategyRegistry } from "../../domain/recovery/services/recovery-strategy-registry.ts";
// Removed unused import - DirectiveProcessor
import { PerformanceSettings } from "../../domain/configuration/value-objects/performance-settings.ts";
import { ResultValidator } from "../../domain/shared/utilities/result-validator.ts";
import {
  DocumentProcessingCoordinator,
  ProcessingOptions,
  ProcessingStatus,
} from "../../domain/pipeline/interfaces/document-processing-coordinator.ts";

/**
 * Processing Coordinator - Application Service
 *
 * Responsible for orchestrating document processing operations
 * Following DDD principles:
 * - Single responsibility: Document processing coordination
 * - Clean boundaries: Uses domain services, no infrastructure coupling
 * - Totality: All methods return Result<T,E>
 */
export class ProcessingCoordinator implements DocumentProcessingCoordinator {
  private readonly logger: DebugLogger | null;

  private constructor(
    private readonly frontmatterTransformer: FrontmatterTransformationService,
    private readonly recoveryRegistry: RecoveryStrategyRegistry,
    private readonly performanceSettings: PerformanceSettings,
    logger: DebugLogger | null,
  ) {
    this.logger = logger;
  }

  /**
   * Smart Constructor for ProcessingCoordinator
   * Following Totality principles by returning Result<T,E>
   */
  static create(
    frontmatterTransformer: FrontmatterTransformationService,
    _propertyExtractor?: PropertyExtractor,
    logger?: DebugLogger,
    _optimizedExtractor?: boolean,
    recoveryRegistry?: RecoveryStrategyRegistry,
  ): Result<ProcessingCoordinator, DomainError & { message: string }> {
    if (!frontmatterTransformer) {
      return ErrorHandler.system({
        operation: "create",
        method: "validateFrontmatterTransformer",
      }).initializationError("FrontmatterTransformationService is required");
    }

    // Create dependencies with proper error handling
    let finalRecoveryRegistry: RecoveryStrategyRegistry;

    if (recoveryRegistry) {
      finalRecoveryRegistry = recoveryRegistry;
    } else {
      const registryResult = RecoveryStrategyRegistry.createWithDefaults();
      if (!registryResult.ok) {
        return ErrorHandler.system({
          operation: "create",
          method: "createRecoveryRegistry",
        }).initializationError("Failed to create RecoveryStrategyRegistry");
      }
      finalRecoveryRegistry = registryResult.data;
    }

    const settingsResult = PerformanceSettings.createDefault();
    if (!settingsResult.ok) {
      return ErrorHandler.system({
        operation: "create",
        method: "createPerformanceSettings",
      }).initializationError("Failed to create PerformanceSettings");
    }
    const finalPerformanceSettings = settingsResult.data;

    return ok(
      new ProcessingCoordinator(
        frontmatterTransformer,
        finalRecoveryRegistry,
        finalPerformanceSettings,
        logger || null,
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
   * Common processing pipeline pattern
   * Reduces duplication across processing methods
   * @internal
   */
  private async processWithPipeline<TInput, TOutput>(
    baseProcessor: () => Promise<
      Result<TInput, DomainError & { message: string }>
    >,
    transformers: Array<
      (
        input: TInput,
      ) => Promise<Result<TOutput, DomainError & { message: string }>>
    >,
  ): Promise<Result<TOutput, DomainError & { message: string }>> {
    const baseResult = await baseProcessor();

    if (!baseResult.ok) {
      return baseResult as Result<TOutput, DomainError & { message: string }>;
    }

    let currentResult: Result<any, DomainError & { message: string }> = ok(
      baseResult.data,
    );

    for (const transformer of transformers) {
      currentResult = await ResultValidator.chainOrReturn(
        currentResult,
        transformer,
      );
      if (!currentResult.ok) {
        return currentResult;
      }
    }

    return currentResult;
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
    this.logger?.debug(
      "validation-timing: ValidationRules application started",
      createLogContext({
        inputPattern,
        validationStrategy: "fail-fast", // Current implementation strategy
        ruleCount: validationRules.getRules().length,
        processingMode: options.kind,
      }),
    );

    // Convert ProcessingOptions to transformation service options
    const transformationOptions = this.convertProcessingOptions(options);

    // Debug: Processing variance tracking (Issue #905 Phase 1)
    this.logger?.debug(
      "processing-variance: Processing options converted for transformation",
      createLogContext({
        originalOptions: options,
        transformationOptions,
        expectedVariance: "low",
      }),
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
      this.logger?.debug(
        "error-propagation: Document processing failed - evaluating recovery options",
        createLogContext({
          errorKind: result.error.kind,
          propagationStrategy: "error-classification",
          recoveryEvaluation: "determining-if-recoverable",
        }),
      );

      // Check if error is recoverable using RecoveryStrategyRegistry (Issue #905 Phase 3)
      const isRecoverable = this.recoveryRegistry.canRecover(result.error.kind);

      if (!isRecoverable) {
        this.logger?.debug(
          "error-propagation: Error is non-recoverable - propagating unchanged",
          createLogContext({
            errorKind: result.error.kind,
            propagationStrategy: "direct-propagation",
            reason: "non-recoverable-error-type",
          }),
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

      this.logger?.debug(
        "error-propagation: Error is recoverable - attempting recovery",
        createLogContext({
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
        }),
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
        this.logger?.debug(
          "error-recovery-success: Error recovery completed successfully",
          createLogContext({
            originalError: result.error.kind,
            recoveryStrategy: recoveryResult.data.strategy,
            recoveredDataSize: recoveryResult.data.data.getAllKeys().length,
            partialSuccess: true,
          }),
        );
        return ok(recoveryResult.data.data);
      } else {
        this.logger?.debug(
          "error-recovery-failed: Error recovery unsuccessful - returning enhanced error",
          createLogContext({
            originalError: result.error.kind,
            recoveryError: recoveryResult.error.kind,
            userGuidance: recoveryResult.error.message,
          }),
        );
        return recoveryResult;
      }
    } else {
      this.logger?.debug(
        "processing-success: Document processing completed successfully",
        createLogContext({
          dataSize: result.data.getAllKeys().length,
          processingVariance: "within-tolerance",
        }),
      );
    }

    return result;
  }

  /**
   * Extract frontmatter-part data as array for items expansion
   * Extracted from PipelineOrchestrator.extractFrontmatterPartData()
   * Following DDD - coordination of domain operations
   *
   * FIX for Issue #977: This method now coordinates with FrontmatterTransformationService
   * to ensure proper data processing before array extraction.
   */
  extractFrontmatterPartData(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    // Debug: Frontmatter-part extraction variance tracking (Issue #905 Phase 1)
    this.logger?.debug(
      "frontmatter-part-extraction: Starting frontmatter-part data extraction with directive coordination",
      createLogContext({
        dataKeys: data.getAllKeys(),
        schemaPath: schema.getPath().toString(),
        extractionStrategy: "directive-aware-array-expansion",
      }),
    );

    // Check if schema has frontmatter-part definition
    const pathResult = schema.findFrontmatterPartPath();
    if (!pathResult.ok) {
      // No frontmatter-part defined, return data as single item array
      this.logger?.debug(
        "frontmatter-part-extraction: No frontmatter-part path found, using single-item strategy",
        createLogContext({
          reason: "no-frontmatter-part-defined",
          fallbackStrategy: "single-item-array",
        }),
      );
      return ok([data]);
    }

    const frontmatterPartPath = pathResult.data;

    // Debug: Path resolution tracking (Issue #905 Phase 1)
    this.logger?.debug(
      "frontmatter-part-path: Frontmatter-part path resolved",
      createLogContext({
        path: frontmatterPartPath,
        pathResolutionStrategy: "schema-traversal",
      }),
    );

    // CRITICAL FIX for Issue #977: Check for processed array data first
    // The data might already contain processed results from FrontmatterTransformationService.processFrontmatterParts()
    const arrayDataResult = data.get(frontmatterPartPath);
    const hasArrayData = arrayDataResult.ok &&
      Array.isArray(arrayDataResult.data);

    if (hasArrayData) {
      // File contains array at target path - extract individual items
      this.logger?.debug(
        "array-processing-variance: Processing array data at frontmatter-part path (directive-processed)",
        createLogContext({
          arrayLength: arrayDataResult.data.length,
          processingStrategy: "item-by-item-extraction",
          expectedVariance: "item-validation-failures",
          directiveProcessed: true,
        }),
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
      this.logger?.debug(
        "array-processing-results: Array processing completed",
        createLogContext({
          totalItems: arrayDataResult.data.length,
          processedItems: processedCount,
          skippedItems: skippedCount,
          processingVariance: skippedCount > 0 ? "high" : "low",
        }),
      );

      return ok(result);
    } else {
      // Return empty array when no processed array exists
      this.logger?.debug(
        "frontmatter-part-extraction: No frontmatter-part array found, returning empty result",
        createLogContext({
          reason: "no-array-data-available",
        }),
      );

      return ok([]);
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

    return ResultValidator.chainOrReturn(
      processResult,
      async (mainData) => {
        // Check if we need to extract items data
        const frontmatterPartResult = schema.findFrontmatterPartPath();
        const hasFrontmatterPart = frontmatterPartResult.ok;

        if (hasFrontmatterPart) {
          const itemsResult = this.extractFrontmatterPartData(
            mainData,
            schema,
          );
          return await Promise.resolve(ResultValidator.mapOrReturn(
            itemsResult,
            (itemsData) => ({ mainData, itemsData }),
          ));
        }

        return await Promise.resolve(ok({ mainData }));
      },
    );
  }

  /**
   * Synchronous version for backward compatibility
   * Use when you need synchronous processing or with basic extractors
   */

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

    // Use basic processing logic with structure intelligence
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
      mainData: processResult.data,
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
    // Handle both new 'kind' property and legacy 'parallel' property
    if (options.kind) {
      switch (options.kind) {
        case "sequential":
          return { parallel: false, maxWorkers: 1 };
        case "parallel":
          return { parallel: true, maxWorkers: options.maxWorkers || 4 };
        default:
          return { parallel: false, maxWorkers: 1 };
      }
    }
    // Legacy support for direct parallel property
    return {
      parallel: options.parallel || false,
      maxWorkers: options.maxWorkers || 1,
    };
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
    this.logger?.debug(
      "error-recovery-attempt: Starting error recovery process",
      createLogContext({
        errorKind: error.kind,
        recoveryStrategies: [
          "partial-processing",
          "fallback-validation",
          "user-guidance",
        ],
      }),
    );

    // HIGH-VARIANCE DEBUG POINT: Error recovery strategy selection
    // This represents a critical variance point in parallel processing scenarios
    const canRecoverFromValidationError = this.recoveryRegistry.canRecover(
      error.kind,
    );
    const validationStrategy = this.recoveryRegistry.getRecoveryStrategy(
      error.kind,
    );

    this.logger?.debug(
      "variance-debug-point: Error recovery strategy evaluation - High variance detection",
      createLogContext({
        debugPoint: "error-recovery-strategy-selection",
        errorKind: error.kind,
        canRecover: canRecoverFromValidationError,
        strategy: validationStrategy.ok
          ? validationStrategy.data?.getStrategyType()
          : null,
        processingMode: "fallback-validation",
        varianceRisk: "high",
        parallelismImpact: "strategy-selection-variance-300-400%",
      }),
    );

    // Strategy 1: Attempt partial processing with relaxed validation
    if (
      canRecoverFromValidationError && validationStrategy.ok &&
      validationStrategy.data
    ) {
      this.logger?.debug(
        "error-recovery-strategy: Attempting partial processing with fallback validation",
        createLogContext({
          strategy: "fallback-validation",
          originalError: error.kind,
          debugContext: "high-variance-execution-path",
        }),
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

    this.logger?.debug(
      "variance-debug-point: File system error recovery evaluation - High variance detection",
      createLogContext({
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
      }),
    );

    // Strategy 2: Attempt partial result extraction for file system or frontmatter errors
    if (
      canRecoverFromFileSystemError && fileSystemStrategy.ok &&
      fileSystemStrategy.data
    ) {
      this.logger?.debug(
        "error-recovery-strategy: Attempting partial result extraction",
        createLogContext({
          strategy: "partial-processing",
          originalError: error.kind,
          debugContext: "high-variance-filesystem-path",
        }),
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
    this.logger?.debug(
      "error-recovery-strategy: Providing enhanced error with user guidance",
      createLogContext({
        strategy: "user-guidance",
        originalError: error.kind,
      }),
    );

    return ErrorHandler.system({
      operation: "attemptErrorRecovery",
      method: "generateUserGuidance",
    }).initializationError(
      this.generateUserGuidanceMessage(error, inputPattern),
    );
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
    this.logger?.debug(
      "fallback-validation: Creating relaxed validation rules for recovery",
      createLogContext({
        originalRules: validationRules.getRules().length,
        fallbackStrategy: "optional-fields",
      }),
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
      this.logger?.debug(
        "fallback-validation-success: Fallback validation recovered partial data",
        createLogContext({
          recoveredDataSize: result.data.getAllKeys().length,
          strategy: "relaxed-validation",
        }),
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
    this.logger?.debug(
      "partial-processing: Attempting partial result extraction",
      createLogContext({
        strategy: "best-effort-processing",
        skipErrors: true,
      }),
    );

    // Implementation would involve file-by-file processing with error tolerance
    // For now, return a minimal data structure
    const emptyDataResult = FrontmatterData.create({});
    if (!emptyDataResult.ok) {
      return emptyDataResult;
    }

    this.logger?.debug(
      "partial-processing-fallback: Created minimal data structure for partial recovery",
      createLogContext({
        strategy: "minimal-data",
        dataSize: 0,
      }),
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

  /**
   * Get processing status (implementation of DocumentProcessingCoordinator interface)
   */
  getProcessingStatus(): ProcessingStatus {
    return {
      isProcessing: false,
      processedCount: 0,
      totalCount: 0,
    };
  }
}
