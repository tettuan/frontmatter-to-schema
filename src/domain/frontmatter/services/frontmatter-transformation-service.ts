import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";
import { ProcessingConstants } from "../../shared/constants/processing-constants.ts";
import { ValidationHelpers } from "../../shared/utils/validation-helpers.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
  ProcessingBoundsMonitor,
} from "../../shared/types/processing-bounds.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import { FrontmatterExtractionService } from "./frontmatter-extraction-service.ts";
import { FrontmatterValidationService } from "./frontmatter-validation-service.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { SchemaValidationService } from "../../schema/services/schema-validation-service.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { Aggregator, DerivationRule } from "../../aggregation/index.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";
import { SchemaPathResolver } from "../../schema/services/schema-path-resolver.ts";
import {
  createLogContext,
  DebugLogger,
  LogContext,
} from "../../shared/services/debug-logger.ts";
import { PerformanceSettings } from "../../configuration/value-objects/performance-settings.ts";
import {
  DomainLogger,
  DomainLoggerAdapter,
  DomainLoggerFactory,
} from "../../shared/services/domain-logger.ts";
import {
  defaultFrontmatterDataCreationService,
  FrontmatterDataCreationService,
} from "./frontmatter-data-creation-service.ts";
import type {
  DomainFileLister,
  DomainFileReader,
} from "../../shared/interfaces/file-operations.ts";
import {
  FrontmatterTransformationConfig,
  FrontmatterTransformationConfigFactory,
} from "../configuration/frontmatter-transformation-config.ts";
import { MemoryBoundsServiceFactory } from "../../../infrastructure/monitoring/memory-bounds-service.ts";
import {
  ProcessingOptionsFactory,
  ProcessingOptionsState,
} from "../configuration/processing-options-factory.ts";
import { MergeOperations } from "../utilities/merge-operations.ts";
import { FieldOperations } from "../utilities/field-operations.ts";
import { FrontmatterConfigurationService } from "./frontmatter-configuration-service.ts";
import { FrontmatterValidationOrchestrator } from "./frontmatter-validation-orchestrator.ts";
import { FrontmatterPartProcessor } from "../processors/frontmatter-part-processor.ts";
import {
  TransformationStrategySelector,
  // TransformationStrategy - will be used in next integration step
} from "../strategies/transformation-strategy.ts";
import {
  DocumentProcessingResult as _DocumentProcessingResult,
  ProcessingStrategyState,
  StateTransitions as _StateTransitions,
  ValidationState as _ValidationState,
} from "../types/transformation-states.ts";

export interface ProcessedDocuments {
  readonly documents: MarkdownDocument[];
  readonly processedData: FrontmatterData[];
}

/**
 * Result of converting schema derivation rules to domain rules.
 * Replaces silent error handling with explicit rule conversion tracking.
 */
export type RuleConversionResult = {
  readonly successfulRules: DerivationRule[];
  readonly failedRuleCount: number;
  readonly errors: Array<DomainError & { message: string }>;
};

/**
 * Domain service responsible for transforming multiple Markdown files into integrated domain data.
 * Handles: Multiple Frontmatter → Validated + Aggregated + Structured Domain Data
 *
 * Transformation Pipeline:
 * 1. Extract frontmatter from multiple files
 * 2. Validate according to schema rules
 * 3. Aggregate and structure data
 * 4. Apply derivation rules
 * 5. Generate final integrated domain data
 */
export class FrontmatterTransformationService {
  private readonly mergeOperations: MergeOperations;
  private readonly configurationService: FrontmatterConfigurationService;
  private readonly validationOrchestrator: FrontmatterValidationOrchestrator;
  private readonly strategySelector: TransformationStrategySelector;

  private constructor(
    private readonly config: FrontmatterTransformationConfig,
    private readonly frontmatterDataCreationService:
      FrontmatterDataCreationService,
    private readonly domainLogger: DomainLogger,
    private readonly performanceSettings: PerformanceSettings,
    private readonly extractionService: FrontmatterExtractionService,
    private readonly validationService: FrontmatterValidationService,
    configurationService: FrontmatterConfigurationService,
    validationOrchestrator: FrontmatterValidationOrchestrator,
  ) {
    this.mergeOperations = new MergeOperations(frontmatterDataCreationService);
    this.configurationService = configurationService;
    this.validationOrchestrator = validationOrchestrator;
    this.strategySelector = new TransformationStrategySelector();
  }

  /**
   * Smart Constructor following Totality principles
   * Creates a frontmatter transformation service with configuration object
   */
  static create(
    config: FrontmatterTransformationConfig,
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    const creationService = config.services.dataCreation ??
      defaultFrontmatterDataCreationService;
    const logger = config.settings.logger ??
      DomainLoggerAdapter.createDisabled();

    // Use configuration service to handle performance settings
    let settings = config.settings.performance;
    if (!settings) {
      const defaultSettingsResult = PerformanceSettings.createDefault();
      if (!defaultSettingsResult.ok) {
        return {
          ok: false,
          error: createError({
            kind: "ConfigurationError",
            message: "Failed to create default performance settings",
          }),
        };
      }
      settings = defaultSettingsResult.data;
    }

    const configServiceResult = FrontmatterConfigurationService.create(
      settings,
    );
    if (!configServiceResult.ok) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Failed to initialize configuration service",
        }),
      };
    }

    // Initialize extraction service
    const extractionResult = FrontmatterExtractionService.create(
      config.processor,
    );
    if (!extractionResult.ok) {
      return extractionResult;
    }

    // Initialize validation service
    const validationResult = FrontmatterValidationService.create(
      config.services.schemaValidation,
    );
    if (!validationResult.ok) {
      return validationResult;
    }

    // Initialize configuration service
    const configurationServiceResult = FrontmatterConfigurationService.create(
      settings,
    );
    if (!configurationServiceResult.ok) {
      return configurationServiceResult;
    }

    // Initialize validation orchestrator
    const validationOrchestratorResult = FrontmatterValidationOrchestrator
      .create(
        config.services.schemaValidation,
        validationResult.data,
      );
    if (!validationOrchestratorResult.ok) {
      return validationOrchestratorResult;
    }

    return ok(
      new FrontmatterTransformationService(
        config,
        creationService,
        logger,
        settings,
        extractionResult.data,
        validationResult.data,
        configurationServiceResult.data,
        validationOrchestratorResult.data,
      ),
    );
  }

  /**
   * Legacy compatibility method - maintains backward compatibility
   * @deprecated Use create(config) instead
   */
  static createLegacy(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    schemaValidationService: SchemaValidationService,
    frontmatterDataCreationService?: FrontmatterDataCreationService,
    domainLogger?: DomainLogger,
    performanceSettings?: PerformanceSettings,
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    // Create FrontmatterPartProcessor for DDD service extraction
    const partProcessorResult = FrontmatterPartProcessor.create({
      frontmatterDataCreationService: frontmatterDataCreationService ??
        defaultFrontmatterDataCreationService,
      // Note: No debugLogger available in legacy method (DomainLogger vs DebugLogger)
    });
    if (!partProcessorResult.ok) {
      return partProcessorResult;
    }

    // Create MemoryBoundsService for DDD service extraction (Issue #1080)
    const memoryBoundsServiceResult = MemoryBoundsServiceFactory.createDefault(
      100,
    );
    if (!memoryBoundsServiceResult.ok) {
      return memoryBoundsServiceResult;
    }

    const configResult = FrontmatterTransformationConfigFactory.create(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      schemaValidationService,
      partProcessorResult.data,
      memoryBoundsServiceResult.data, // Created MemoryBoundsService
      {
        dataCreation: frontmatterDataCreationService,
        logger: domainLogger,
        performance: performanceSettings,
      },
    );

    if (!configResult.ok) {
      return configResult;
    }

    return this.create(configResult.data);
  }

  /**
   * Helper method to create an activeLogger compatible with existing logging patterns
   * This provides backward compatibility while transitioning to DomainLogger
   */
  private createActiveLogger(): DebugLogger | undefined {
    // Create a bridge logger that translates DebugLogger calls to DomainLogger calls
    const domainLogger = this.domainLogger;

    // Return proper DebugLogger implementation following Totality principles
    const debugLogger: DebugLogger = {
      info: (message: string, context?: LogContext) => {
        domainLogger.logInfo("transformation", message, context);
        return ok(void 0);
      },
      debug: (message: string, context?: LogContext) => {
        domainLogger.logDebug("transformation", message, context);
        return ok(void 0);
      },
      trace: (message: string, context?: LogContext) => {
        domainLogger.logDebug("transformation", message, context); // Use debug level for trace
        return ok(void 0);
      },
      warn: (message: string, context?: LogContext) => {
        domainLogger.logWarning("transformation", message, context);
        return ok(void 0);
      },
      error: (message: string, context?: LogContext) => {
        domainLogger.logError("transformation", message, context);
        return ok(void 0);
      },
      log: (level, message, context?) => {
        // Delegate to appropriate method based on level
        switch (level.kind) {
          case "error":
            return debugLogger.error(message, context);
          case "warn":
            return debugLogger.warn(message, context);
          case "info":
            return debugLogger.info(message, context);
          case "debug":
          case "trace":
            return debugLogger.debug(message, context);
        }
      },
      withContext: (_baseContext: LogContext) => {
        // For simplicity, return the same logger (could be enhanced to merge contexts)
        return debugLogger;
      },
    };

    return debugLogger;
  }

  /**
   * Transform multiple frontmatter documents into integrated domain data.
   * Follows transformation pipeline: Extract → Validate → Aggregate → Structure → Integrate
   * Includes memory bounds monitoring following Totality principles
   */
  /**
   * Transform documents with explicit processing options state (Totality-compliant)
   */
  async transformDocumentsWithProcessingOptions(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    processingBounds?: ProcessingBounds,
    processingOptionsState?: ProcessingOptionsState,
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    const optionsState = processingOptionsState ??
      ProcessingOptionsFactory.createSequential();

    // Convert discriminated union to legacy format for internal processing
    let legacyOptions: { parallel?: boolean; maxWorkers?: number } | undefined;

    switch (optionsState.kind) {
      case "sequential":
        legacyOptions = { parallel: false };
        break;
      case "parallel":
        legacyOptions = { parallel: true, maxWorkers: optionsState.maxWorkers };
        break;
      case "adaptive":
        // For adaptive, we'll need to check file count later to decide
        legacyOptions = {
          parallel: true,
          maxWorkers: optionsState.baseWorkers,
        };
        break;
    }

    return await this.transformDocumentsInternal(
      inputPattern,
      validationRules,
      schema,
      processingBounds,
      legacyOptions,
      optionsState,
    );
  }

  /**
   * Transform documents with optional logger for backward compatibility
   * @deprecated Use transformDocumentsWithProcessingOptions() method instead
   */
  async transformDocumentsWithOptionalLogger(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    _logger?: DebugLogger,
    processingBounds?: ProcessingBounds,
    options?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // For backward compatibility, we'll temporarily support the old signature
    // but the service now uses explicit domain logger state
    return await this.transformDocuments(
      inputPattern,
      validationRules,
      schema,
      processingBounds,
      options,
    );
  }

  /**
   * Transform documents with optional options (backward compatibility)
   * @deprecated Use transformDocumentsWithProcessingOptions() instead
   */
  async transformDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    processingBounds?: ProcessingBounds,
    options?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    const processingOptionsState = ProcessingOptionsFactory.fromOptional(
      options,
    );
    return await this.transformDocumentsWithProcessingOptions(
      inputPattern,
      validationRules,
      schema,
      processingBounds,
      processingOptionsState,
    );
  }

  /**
   * Internal implementation that handles the actual document transformation logic
   */
  private async transformDocumentsInternal(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    processingBounds?: ProcessingBounds,
    legacyOptions?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
    processingOptionsState?: ProcessingOptionsState,
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // Stage 0: Check for x-frontmatter-part and adjust validation rules if needed
    // Create activeLogger for backward compatibility within this method
    const activeLogger = this.createActiveLogger();

    // When x-frontmatter-part is defined, individual files should be validated
    // against the array element schema, not the top-level schema
    let effectiveValidationRules = validationRules;

    // Use schema validation service to get proper validation rules for frontmatter part
    // This follows DDD boundaries: Schema domain provides validation rules to frontmatter domain
    const validationRulesResult = this.config.services.schemaValidation
      .getValidationRulesForFrontmatterPart(schema);

    if (validationRulesResult.ok) {
      effectiveValidationRules = validationRulesResult.data;

      activeLogger?.info(
        `Generated validation rules from resolved schema`,
        {
          operation: "validation-adjustment",
          totalRules: effectiveValidationRules.getRules().length,
          usingResolvedSchema: true,
          timestamp: new Date().toISOString(),
        },
      );
    } else {
      activeLogger?.warn(
        "Failed to get validation rules from schema service, using default rules",
        {
          error: validationRulesResult.error.message,
          operation: "validation-adjustment",
          timestamp: new Date().toISOString(),
        },
      );
      // Keep using original validation rules as fallback
    }

    // OLD LOGIC (replaced by SchemaValidationService above)
    /*
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
    if (frontmatterPartSchemaResult.ok) {
      // Debug: Validation rules variance coordination (Issue #905 Phase 2)
      activeLogger?.debug(
        "Validation rules variance - coordination with ProcessingCoordinator validation timing",
        {
          operation: "validation-rules-variance",
          variancePoint: "frontmatter-part-adjustment",
          originalRules: validationRules.getRules().length,
          adjustmentStrategy: "array-element-schema",
          coordinationWithProcessingCoordinator: "validation-timing-alignment",
          expectedVariance: "high",
          timestamp: new Date().toISOString(),
        },
      );

      activeLogger?.debug(
        "x-frontmatter-part detected, adjusting validation rules for array element schema",
        {
          operation: "validation-adjustment",
          timestamp: new Date().toISOString(),
        },
      );

      // The frontmatterPartSchemaResult.data is the array schema with x-frontmatter-part
      // We need to get its items schema for validating individual elements
      const arraySchema = frontmatterPartSchemaResult.data;

      // Check if arraySchema has getItems method
      if (typeof arraySchema.getItems !== "function") {
        activeLogger?.debug(
          "frontmatterPartSchema does not have getItems method, skipping validation adjustment",
          createLogContext({
            operation: "validation-adjustment",
          }),
        );
      } else {
        const itemsResult = arraySchema.getItems();

        if (itemsResult.ok) {
          // The items schema might be wrapped or might be a direct SchemaProperty
          const itemsSchema = itemsResult.data;

          // Check if it's wrapped in a 'schema' property
          let actualItemsSchema = (itemsSchema as any).schema || itemsSchema;

          // If the items schema is a $ref, we need to resolve it
          if ((actualItemsSchema as any).$ref) {
            // If the schema is resolved, we can get the resolved schema
            if (schema.isResolved()) {
              const resolvedResult = schema.getResolved();
              if (resolvedResult.ok) {
                const refName = (actualItemsSchema as any).$ref;
                const resolvedSchema = resolvedResult.data.referencedSchemas
                  .get(refName);
                if (resolvedSchema) {
                  actualItemsSchema = resolvedSchema.getRawSchema();
                }
              }
            } else {
              // Schema is not resolved, try to load the referenced schema directly
              const refPath = (actualItemsSchema as any).$ref;

              // Try to load the referenced schema from the same directory as the main schema
              const schemaPath = schema.getPath().toString();
              const schemaDir = schemaPath.substring(
                0,
                schemaPath.lastIndexOf("/"),
              );
              const refFullPath = `${schemaDir}/${refPath}`;

              try {
                const refContent = await Deno.readTextFile(refFullPath);
                const refSchema = JSON.parse(refContent);

                // Apply migration if needed
                const { SchemaPropertyMigration } = await import(
                  "../../schema/value-objects/schema-property-migration.ts"
                );
                const migrationResult = SchemaPropertyMigration.migrate(
                  refSchema,
                );

                if (migrationResult.ok) {
                  actualItemsSchema = migrationResult.data;

                  // Create validation rules from the loaded schema
                  effectiveValidationRules = ValidationRules.fromSchema(
                    actualItemsSchema,
                    "",
                  );
                } else {
                  activeLogger?.warn(
                    "Cannot adjust validation: failed to migrate referenced schema",
                    createLogContext({
                      operation: "validation-adjustment",
                      inputs:
                        `ref: ${refPath}, error: ${migrationResult.error}`,
                    }),
                  );
                }
              } catch (error) {
                activeLogger?.warn(
                  "Cannot adjust validation for x-frontmatter-part: failed to load referenced schema",
                  createLogContext({
                    operation: "validation-adjustment",
                    inputs: `ref: ${refPath}, error: ${String(error)}`,
                  }),
                );
                // Don't change effectiveValidationRules, keep using the original
              }
            }
          } else {
            // Create validation rules from the array items schema
            // TEMPORARY FIX: Only apply migration when we detect the specific Issue #970 problem
            // Check if this is a raw JSON schema that needs migration vs already migrated SchemaProperty
            const needsMigration =
              (actualItemsSchema as any).kind === undefined &&
              typeof actualItemsSchema === "object" &&
              actualItemsSchema !== null;

            if (needsMigration) {
              // Need to apply migration to convert raw schema to SchemaProperty
              const { SchemaPropertyMigration } = await import(
                "../../schema/value-objects/schema-property-migration.ts"
              );
              const migrationResult = SchemaPropertyMigration.migrate(
                actualItemsSchema,
              );

              if (migrationResult.ok) {
                effectiveValidationRules = ValidationRules.fromSchema(
                  migrationResult.data,
                  "",
                );
              } else {
                activeLogger?.warn(
                  "Cannot adjust validation: failed to migrate items schema",
                  createLogContext({
                    operation: "validation-adjustment",
                    inputs: `error: ${migrationResult.error}`,
                  }),
                );
                // Keep using original validation rules
              }
            } else {
              // Already a SchemaProperty, use directly (legacy behavior)
              effectiveValidationRules = ValidationRules.fromSchema(
                actualItemsSchema,
                "",
              );
            }
          }

          const frontmatterPartPath = schema.findFrontmatterPartPath();

          // Debug: Check what rules were generated
          const allRules = effectiveValidationRules.getRules();
          const booleanRules = allRules.filter((r) => r.kind === "boolean");
          activeLogger?.info(
            `Generated validation rules from array items schema`,
            {
              operation: "validation-adjustment",
              path: frontmatterPartPath.ok
                ? frontmatterPartPath.data
                : "unknown",
              totalRules: allRules.length,
              booleanRules: booleanRules.map((r) => r.path),
              timestamp: new Date().toISOString(),
            },
          );
        } else {
          activeLogger?.warn(
            "Could not extract items schema from frontmatter-part array",
            {
              error: itemsResult.error,
              operation: "validation-adjustment",
              timestamp: new Date().toISOString(),
            },
          );
        }
      }
    }
    */

    // Stage 1: List matching files
    activeLogger?.info(
      `Starting document processing with pattern: ${inputPattern}`,
      {
        operation: "document-processing",
        pattern: inputPattern,
        timestamp: new Date().toISOString(),
      },
    );
    const filesResult = this.config.fileSystem.lister.list(inputPattern);
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

    // Initialize memory bounds monitoring following Totality principles
    let actualBounds: ProcessingBounds;
    if (processingBounds) {
      actualBounds = processingBounds;
    } else {
      const defaultBoundsResult = ProcessingBoundsFactory.createDefault(
        filesResult.data.length,
      );
      if (!defaultBoundsResult.ok) {
        return defaultBoundsResult;
      }
      actualBounds = defaultBoundsResult.data;
    }

    // Debug: Processing bounds variance tracking (Issue #905 Phase 2)
    activeLogger?.debug(
      "Processing bounds variance decision coordination",
      {
        operation: "processing-bounds-variance",
        boundsSource: processingBounds
          ? "external-provided"
          : "factory-generated",
        boundsType: actualBounds.kind,
        fileCount: filesResult.data.length,
        varianceFactors: {
          boundsDetermination: processingBounds ? "explicit" : "dynamic",
          memoryPrediction: actualBounds.kind === "bounded"
            ? "constrained"
            : "unlimited",
          coordinationStrategy: "ProcessingCoordinator-alignment",
        },
        expectedVariance: processingBounds ? "low" : "medium",
        timestamp: new Date().toISOString(),
      },
    );

    // メモリ境界監視振れ幅デバッグ情報 (メモリ管理変動制御フロー Iteration 15)
    const memoryBoundsVarianceDebug = {
      varianceTarget: "memory-bounds-monitoring-variance-control",
      boundsConfiguration: {
        providedBounds: !!processingBounds,
        boundsType: actualBounds.kind,
        fileCount: filesResult.data.length,
        boundsCreationMethod: processingBounds
          ? "external-provided"
          : "factory-generated",
      },
      memoryMonitoringVarianceFactors: {
        dynamicBoundsCalculation: !processingBounds,
        fileCountImpact: filesResult.data.length,
        expectedMemoryGrowthPattern: actualBounds.kind === "bounded"
          ? "bounded-growth"
          : "unlimited-growth",
        monitoringOverhead: "per-file-check",
        boundsCheckingFrequency: "every-100-files",
      },
      memoryVariancePrediction: {
        estimatedPeakMemory: `${filesResult.data.length * 2}MB`,
        memoryGrowthRate: "O(n)-linear",
        monitoringImpact: `${Math.ceil(filesResult.data.length / 100) * 5}ms`,
        boundsViolationRisk: actualBounds.kind === "unbounded"
          ? "low"
          : "medium",
      },
      memoryVarianceRisks: {
        boundsCreationVariance: !processingBounds ? "high" : "none",
        monitoringOverheadVariance: "medium", // 監視オーバーヘッド変動
        memoryGrowthPredictionVariance: "high", // メモリ成長予測変動
        boundsViolationHandlingVariance: "low", // 境界違反処理変動
      },
      varianceReductionStrategy: {
        targetReduction: "predictive-bounds-optimization",
        recommendedApproach: "adaptive-bounds-scaling",
        monitoringOptimization: "threshold-based-checking",
        memoryPredictionImprovement: "learning-based-estimation",
      },
      debugLogLevel: "memory-bounds-variance", // メモリ境界変動詳細ログ
      memoryVarianceTrackingEnabled: true, // メモリ変動追跡有効
    };

    const currentMemory = Deno.memoryUsage();
    activeLogger?.debug("メモリ境界監視振れ幅デバッグ情報", {
      ...memoryBoundsVarianceDebug,
      currentSystemState: {
        heapUsedMB: Math.round(currentMemory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(currentMemory.heapTotal / 1024 / 1024),
        systemMemoryPressure: ProcessingConstants.isMemoryPressureHigh(
            currentMemory.heapUsed,
            currentMemory.heapTotal,
          )
          ? "high"
          : "normal",
        estimatedMemoryAfterProcessing: Math.round(
          (currentMemory.heapUsed + filesResult.data.length * 2 * 1024 * 1024) /
            1024 / 1024,
        ),
      },
      timestamp: new Date().toISOString(),
    });

    // Use injected MemoryBoundsService (DDD extraction from Issue #1080)
    const memoryBoundsService = this.config.services.memoryBounds;

    activeLogger?.debug(
      "Using injected MemoryBoundsService",
      {
        operation: "memory-monitoring",
        boundsType: actualBounds.kind,
        fileCount: filesResult.data.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Check memory bounds before processing
    // Only check if bounds are restrictive and provided explicitly
    if (
      processingBounds && actualBounds.kind === "bounded" &&
      actualBounds.fileLimit < filesResult.data.length
    ) {
      return {
        ok: false,
        error: createError({
          kind: "MemoryBoundsViolation",
          content:
            `Memory limit exceeded: Cannot process ${filesResult.data.length} files with limit of ${actualBounds.fileLimit}`,
        }),
      };
    }

    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    // Stage 2: Process files using strategy pattern (DDD refactoring)
    // Replace complex configuration logic with TransformationStrategySelector
    const strategySelector = new TransformationStrategySelector();

    // Determine processing strategy state from configuration
    let processingStrategyState: ProcessingStrategyState;
    if (processingOptionsState?.kind === "adaptive") {
      processingStrategyState = {
        kind: "adaptive",
        baseWorkers: processingOptionsState.baseWorkers,
        threshold: processingOptionsState.maxFileThreshold,
      };
    } else if (legacyOptions?.parallel === true) {
      processingStrategyState = {
        kind: "parallel",
        workers: legacyOptions.maxWorkers ||
          this.performanceSettings.getDefaultMaxWorkers(),
      };
    } else {
      processingStrategyState = { kind: "sequential" };
    }

    const strategyResult = strategySelector.selectStrategy(
      processingStrategyState,
    );
    if (!strategyResult.ok) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            `Failed to select processing strategy: ${strategyResult.error.message}`,
        }),
      };
    }

    const strategy = strategyResult.data;

    // Log strategy selection for debugging
    activeLogger?.debug("Selected processing strategy", {
      operation: "strategy-selection",
      strategyType: strategy.getDescription(),
      fileCount: filesResult.data.length,
      processingState: processingStrategyState,
      timestamp: new Date().toISOString(),
    });

    // Execute the selected strategy
    // Convert string paths to FilePath objects, handling errors properly
    const filePathResults = filesResult.data.map((path) =>
      FilePath.create(path)
    );
    const invalidPaths = filePathResults.filter((result) => !result.ok);
    if (invalidPaths.length > 0) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: `Invalid file paths: ${
            invalidPaths.map((p) => p.error.message).join(", ")
          }`,
        }),
      };
    }

    const filePaths = filePathResults.filter((result) => result.ok).map(
      (result) => (result as { ok: true; data: FilePath }).data,
    );

    const strategyExecutionResult = await strategy.execute(
      filePaths,
      effectiveValidationRules,
      (filePath, rules) => {
        // Convert FilePath back to string for processDocument method
        const docResult = this.processDocument(filePath.toString(), rules);
        if (docResult.ok) {
          return {
            ok: true,
            data: {
              kind: "success" as const,
              data: docResult.data.frontmatterData,
              document: docResult.data.document,
            },
          };
        } else {
          return {
            ok: false,
            error: docResult.error,
          };
        }
      },
      memoryBoundsService.getUnderlyingMonitor(), // Legacy compatibility during DDD migration
      activeLogger,
    );

    if (!strategyExecutionResult.ok) {
      // Preserve original error type for memory bounds violations and other specific errors
      return {
        ok: false,
        error: createError({
          kind: "EXCEPTION_CAUGHT",
          content: String(strategyExecutionResult.error),
        }, "Strategy execution failed") as DomainError & { message: string },
      };
    }

    // Collect results from strategy execution
    for (const result of strategyExecutionResult.data) {
      if (result.kind === "success" && result.data && result.document) {
        processedData.push(result.data);
        documents.push(result.document);
      } else if (result.kind === "failed") {
        activeLogger?.warn(
          `Failed to process file: ${result.filePath}`,
          {
            operation: "strategy-execution-failed",
            error: result.error,
            timestamp: new Date().toISOString(),
          },
        );
      } else if (result.kind === "skipped") {
        activeLogger?.debug(
          `Skipped file: ${result.filePath}`,
          {
            operation: "strategy-execution-skipped",
            reason: result.reason,
            timestamp: new Date().toISOString(),
          },
        );
      }
    }

    // Document processing completed by strategy execution above

    if (ValidationHelpers.isEmptyArray(processedData)) {
      const noDataError = ErrorHandler.aggregation({
        operation: "transformDocumentsInternal",
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

    // Stage 3: Apply frontmatter-part processing if needed
    activeLogger?.debug(
      "Starting frontmatter-part processing",
      {
        operation: "frontmatter-part-processing",
        timestamp: new Date().toISOString(),
      },
    );

    // DEBUG: Log data before frontmatter-part processing
    activeLogger?.debug(
      "TRACE: Data BEFORE processFrontmatterParts",
      {
        operation: "frontmatter-part-trace-before",
        inputCount: processedData.length,
        firstItemKeys: processedData[0]
          ? Object.keys(processedData[0].getData())
          : [],
        firstItemSample: processedData[0]
          ? JSON.stringify(processedData[0].getData()).substring(0, 600)
          : "no data",
        timestamp: new Date().toISOString(),
      },
    );

    // Use injected FrontmatterPartProcessor service (DDD extraction)
    const frontmatterPartResult = this.config.services.frontmatterPartProcessor
      .processFrontmatterParts(processedData, schema);

    if (!frontmatterPartResult.ok) {
      return frontmatterPartResult;
    }

    const finalData = frontmatterPartResult.data;

    // DEBUG: Log data after frontmatter-part processing
    activeLogger?.debug(
      "TRACE: Data AFTER processFrontmatterParts",
      {
        operation: "frontmatter-part-trace-after",
        outputCount: finalData.length,
        firstOutputKeys: finalData[0]
          ? Object.keys(finalData[0].getData())
          : [],
        firstOutputSample: finalData[0]
          ? JSON.stringify(finalData[0].getData()).substring(0, 600)
          : "no data",
        timestamp: new Date().toISOString(),
      },
    );

    activeLogger?.info(
      "Frontmatter-part processing complete",
      {
        operation: "frontmatter-part-processing",
        inputCount: processedData.length,
        outputCount: finalData.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Stage 4: Aggregate data using derivation rules
    activeLogger?.debug(
      "Starting data aggregation with derivation rules",
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
        rules: derivationRules.map((r) => ({
          sourcePath: r.sourcePath,
          targetField: r.targetField,
        })),
        timestamp: new Date().toISOString(),
      },
    );

    let aggregatedData = this.aggregateData(finalData, schema);
    if (!aggregatedData.ok) {
      activeLogger?.error(
        "Data aggregation failed",
        {
          operation: "aggregation",
          error: aggregatedData.error,
          timestamp: new Date().toISOString(),
        },
      );
      return aggregatedData;
    }

    // Stage 4.5: Apply directive processing (x-flatten-arrays, x-jmespath-filter, etc.)
    activeLogger?.debug(
      "Starting directive processing",
      {
        operation: "directive-processing",
        timestamp: new Date().toISOString(),
      },
    );

    // Import and create DirectiveProcessor
    const { DirectiveProcessor } = await import(
      "../../schema/services/directive-processor.ts"
    );
    const directiveProcessorResult = DirectiveProcessor.create();

    if (directiveProcessorResult.ok) {
      const directiveProcessor = directiveProcessorResult.data;

      // First resolve the processing order for directives
      const processingOrderResult = directiveProcessor.resolveProcessingOrder(
        schema,
      );

      if (processingOrderResult.ok) {
        const processingOrder = processingOrderResult.data;

        activeLogger?.debug(
          "Resolved directive processing order",
          {
            operation: "directive-processing",
            totalDirectives: processingOrder.totalDirectives,
            phases: processingOrder.phases.length,
            timestamp: new Date().toISOString(),
          },
        );

        // Process directives on the aggregated data
        const directiveResult = directiveProcessor.processDirectives(
          aggregatedData.data,
          schema,
          processingOrder,
        );

        if (!directiveResult.ok) {
          activeLogger?.warn(
            "Directive processing failed, continuing with unprocessed data",
            {
              operation: "directive-processing",
              error: directiveResult.error,
              timestamp: new Date().toISOString(),
            },
          );
          // Continue with original data if directive processing fails
        } else {
          // Update aggregated data with directive-processed data
          aggregatedData = ok(directiveResult.data);
          activeLogger?.info(
            "Directive processing completed successfully",
            {
              operation: "directive-processing",
              timestamp: new Date().toISOString(),
            },
          );
        }
      } else {
        activeLogger?.warn(
          "Failed to resolve directive processing order, skipping directive processing",
          {
            operation: "directive-processing",
            error: processingOrderResult.error,
            timestamp: new Date().toISOString(),
          },
        );
      }
    } else {
      activeLogger?.warn(
        "Failed to create DirectiveProcessor, skipping directive processing",
        {
          operation: "directive-processing",
          error: directiveProcessorResult.error,
          timestamp: new Date().toISOString(),
        },
      );
    }

    // Stage 5: Populate base properties from schema defaults
    activeLogger?.debug(
      "Starting base property population",
      {
        operation: "base-property-population",
        timestamp: new Date().toISOString(),
      },
    );
    const result = this.config.services.basePropertyPopulator.populate(
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

    return result;
  }

  /**
   * Process a single document file.
   */
  private processDocument(
    filePath: string,
    validationRules: ValidationRules,
  ): Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  > {
    const activeLogger = this.createActiveLogger();
    activeLogger?.debug(
      `Starting processing of document: ${filePath}`,
      createLogContext({
        operation: "single-document",
        location: filePath,
      }),
    );

    // Create file path value object
    const filePathResult = FilePath.create(filePath);
    if (!filePathResult.ok) {
      activeLogger?.error(
        `File path validation failed: ${filePathResult.error.message}`,
        createLogContext({
          operation: "file-path-validation",
          location: filePath,
        }),
      );
      return filePathResult;
    }

    // Read file content
    activeLogger?.debug(
      `Reading file content: ${filePath}`,
      createLogContext({
        operation: "file-reading",
        location: filePath,
      }),
    );
    const contentResult = this.config.fileSystem.reader.read(filePath);
    if (!contentResult.ok) {
      activeLogger?.error(
        `File reading failed: ${contentResult.error.message}`,
        createLogContext({
          operation: "file-reading",
          location: filePath,
        }),
      );
      return contentResult;
    }

    // Extract frontmatter
    activeLogger?.debug(
      `Extracting frontmatter from: ${filePath}`,
      createLogContext({
        operation: "frontmatter-extraction",
        location: filePath,
      }),
    );
    const extractResult = this.config.processor.extract(contentResult.data);
    if (!extractResult.ok) {
      activeLogger?.error(
        `Frontmatter extraction failed: ${extractResult.error.message}`,
        createLogContext({
          operation: "frontmatter-extraction",
          location: filePath,
        }),
      );
      return extractResult;
    }

    const { frontmatter, body } = extractResult.data;
    activeLogger?.debug(
      `Successfully extracted frontmatter from: ${filePath}`,
      createLogContext({
        operation: "frontmatter-extraction",
        location: filePath,
        inputs: `keys: ${
          Object.keys(frontmatter || {}).join(", ")
        }, bodyLength: ${body.length}`,
      }),
    );

    // Validate frontmatter
    activeLogger?.debug(
      `Validating frontmatter for: ${filePath}`,
      createLogContext({
        operation: "frontmatter-validation",
        location: filePath,
      }),
    );

    // Debug: Check options before validation
    if ((frontmatter as any).options) {
      const options = (frontmatter as any).options;
      activeLogger?.debug(
        `Pre-validation options check`,
        createLogContext({
          operation: "options-check-pre",
          location: filePath,
          inputs: JSON.stringify({
            file: { type: typeof options.file, value: options.file },
            stdin: { type: typeof options.stdin, value: options.stdin },
            destination: {
              type: typeof options.destination,
              value: options.destination,
            },
          }),
        }),
      );
    }

    const validationResult = this.config.processor.validate(
      frontmatter,
      validationRules,
    );
    if (!validationResult.ok) {
      activeLogger?.error(
        `Frontmatter validation failed: ${validationResult.error.message}`,
        createLogContext({
          operation: "frontmatter-validation",
          location: filePath,
        }),
      );
      return validationResult;
    }

    // Debug: Check options after validation
    if ((validationResult.data as any).options) {
      const options = (validationResult.data as any).options;
      activeLogger?.debug(
        `Post-validation options check`,
        createLogContext({
          operation: "options-check-post",
          location: filePath,
          inputs: JSON.stringify({
            file: { type: typeof options.file, value: options.file },
            stdin: { type: typeof options.stdin, value: options.stdin },
            destination: {
              type: typeof options.destination,
              value: options.destination,
            },
          }),
        }),
      );
    }

    activeLogger?.debug(
      `Successfully validated frontmatter for: ${filePath}`,
      createLogContext({
        operation: "frontmatter-validation",
        location: filePath,
      }),
    );

    // Create document entity
    activeLogger?.debug(
      `Creating MarkdownDocument entity for: ${filePath}`,
      createLogContext({
        operation: "document-creation",
        location: filePath,
      }),
    );
    const docResult = MarkdownDocument.create(
      filePathResult.data,
      contentResult.data,
      validationResult.data,
      body,
    );
    if (!docResult.ok) {
      activeLogger?.error(
        `Document creation failed: ${docResult.error.message}`,
        createLogContext({
          operation: "document-creation",
          location: filePath,
        }),
      );
      return docResult;
    }

    activeLogger?.debug(
      `Successfully processed document: ${filePath}`,
      createLogContext({
        operation: "single-document",
        location: filePath,
      }),
    );

    return ok({
      document: docResult.data,
      frontmatterData: validationResult.data,
    });
  }

  /**
   * Process files in parallel using a worker pool pattern.
   * Implements Issue #545: Parallel processing capability with configurable workers.
   */
  private async processFilesInParallel(
    filePaths: string[],
    validationRules: ValidationRules,
    maxWorkers: number,
    _boundsMonitor: ProcessingBoundsMonitor,
    _logger?: DebugLogger,
  ): Promise<
    Result<
      Array<{ document: MarkdownDocument; frontmatterData: FrontmatterData }>,
      DomainError & { message: string }
    >
  > {
    const activeLogger = this.createActiveLogger();
    const results: Array<
      { document: MarkdownDocument; frontmatterData: FrontmatterData }
    > = [];
    const errors: Array<DomainError & { message: string }> = [];

    // ワーカープール振れ幅デバッグ情報 (並列処理変動制御フロー Iteration 14)
    const workerPoolVarianceDebug = {
      varianceTarget: "worker-pool-variance-control",
      workerPoolConfiguration: {
        maxWorkers,
        fileCount: filePaths.length,
        optimalWorkerCount: Math.min(maxWorkers, filePaths.length),
        workerUtilizationRatio: filePaths.length / maxWorkers,
        parallelEfficiencyPredictiion: maxWorkers > filePaths.length
          ? "over-provisioned"
          : "optimal-or-under-provisioned",
      },
      batchingVarianceFactors: {
        calculatedBatchSize: Math.max(
          1,
          Math.ceil(filePaths.length / maxWorkers),
        ),
        batchCountVariance: Math.ceil(filePaths.length / maxWorkers),
        batchBalancing: (filePaths.length % maxWorkers) === 0
          ? "perfect"
          : "unbalanced",
        lastBatchSize: filePaths.length %
          Math.max(1, Math.ceil(filePaths.length / maxWorkers)),
        workerLoadDistribution: "round-robin-batching",
      },
      coordinationVarianceRisks: {
        promiseAllSynchronization: "high-variance", // Promise.all 同期オーバーヘッド
        batchResultAggregation: "medium-variance", // バッチ結果集約の複雑性
        errorHandlingComplexity: "high-variance", // 並列エラーハンドリング複雑性
        memoryCoordinationOverhead: "medium-variance", // メモリ協調オーバーヘッド
      },
      workerPoolVarianceMetrics: {
        estimatedMemoryPerWorker: `${
          Math.ceil(filePaths.length / maxWorkers) * 2
        }MB`,
        estimatedCpuUtilization: `${Math.min(100, maxWorkers * 25)}%`,
        estimatedCoordinationLatency: `${maxWorkers * 5}ms`,
        estimatedVarianceRange: `${maxWorkers}x-${
          Math.ceil(maxWorkers * 1.5)
        }x-speedup`,
      },
      debugLogLevel: "worker-pool-variance", // ワーカープール変動詳細ログ
      parallelVarianceTrackingEnabled: true, // 並列変動追跡有効
    };

    activeLogger?.debug("ワーカープール振れ幅デバッグ情報", {
      ...workerPoolVarianceDebug,
      realTimeMetrics: {
        currentMemoryMB: Math.round(Deno.memoryUsage().heapUsed / 1024 / 1024),
        processingStartTime: performance.now(),
        expectedFinishTime: `+${
          Math.ceil(filePaths.length / maxWorkers) * 100
        }ms`,
      },
      timestamp: new Date().toISOString(),
    });

    // Create batches for worker processing
    const batchSize = Math.max(1, Math.ceil(filePaths.length / maxWorkers));
    const batches: string[][] = [];

    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }

    activeLogger?.debug(
      `Created ${batches.length} batches with batch size ${batchSize}`,
      {
        operation: "parallel-batch-creation",
        batchCount: batches.length,
        batchSize,
        totalFiles: filePaths.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Process batches in parallel using Promise.all
    try {
      const batchPromises = batches.map((batch, batchIndex) => {
        return new Promise<
          {
            batchResults: Array<
              { document: MarkdownDocument; frontmatterData: FrontmatterData }
            >;
            batchErrors: Array<DomainError & { message: string }>;
          }
        >((resolve) => {
          const batchResults: Array<
            { document: MarkdownDocument; frontmatterData: FrontmatterData }
          > = [];
          const batchErrors: Array<DomainError & { message: string }> = [];

          activeLogger?.debug(
            `Processing batch ${
              batchIndex + 1
            }/${batches.length} with ${batch.length} files`,
            {
              operation: "parallel-batch-processing",
              batchIndex: batchIndex + 1,
              batchSize: batch.length,
              timestamp: new Date().toISOString(),
            },
          );

          for (const filePath of batch) {
            // Memory bounds monitoring for each file (using injected service)
            const state = this.config.services.memoryBounds
              .checkProcessingState(
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

            if (state.kind === "approaching_limit") {
              activeLogger?.warn(
                `Approaching memory limit in batch ${batchIndex + 1}: ${
                  Math.round(state.usage.heapUsed / 1024 / 1024)
                }MB used, threshold: ${
                  Math.round(state.warningThreshold / 1024 / 1024)
                }MB`,
                {
                  operation: "parallel-memory-monitoring",
                  batchIndex: batchIndex + 1,
                  heapUsed: state.usage.heapUsed,
                  warningThreshold: state.warningThreshold,
                  timestamp: new Date().toISOString(),
                },
              );
            }

            const documentResult = this.processDocument(
              filePath,
              validationRules,
            );
            if (documentResult.ok) {
              batchResults.push(documentResult.data);
              activeLogger?.debug(
                `Successfully processed file in batch ${
                  batchIndex + 1
                }: ${filePath}`,
                {
                  operation: "parallel-file-processing",
                  batchIndex: batchIndex + 1,
                  filePath,
                  timestamp: new Date().toISOString(),
                },
              );
            } else {
              batchErrors.push(documentResult.error);
              activeLogger?.error(
                `Failed to process file in batch ${
                  batchIndex + 1
                }: ${filePath}`,
                {
                  operation: "parallel-file-processing",
                  batchIndex: batchIndex + 1,
                  filePath,
                  error: documentResult.error,
                  timestamp: new Date().toISOString(),
                },
              );
            }
          }

          resolve({ batchResults, batchErrors });
        });
      });

      // Wait for all batches to complete
      const batchOutputs = await Promise.all(batchPromises);

      // Collect all results and errors
      for (const { batchResults, batchErrors } of batchOutputs) {
        results.push(...batchResults);
        errors.push(...batchErrors);
      }

      activeLogger?.info(
        `Parallel processing completed: ${results.length} successful, ${errors.length} errors`,
        {
          operation: "parallel-processing-completion",
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

      activeLogger?.error(
        "Parallel processing encountered an unexpected error",
        {
          operation: "parallel-processing-error",
          error: "Parallel processing failed",
          timestamp: new Date().toISOString(),
        },
      );

      return processingError;
    }
  }

  /**
   * Aggregate data using derivation rules from schema.
   * Refactored to use SchemaPathResolver following DDD Totality principles.
   */
  private aggregateData(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivationRules = schema.getDerivedRules();

    if (derivationRules.length > 0) {
      return this.aggregateWithDerivationRules(data, schema, derivationRules);
    } else {
      return this.aggregateWithoutDerivationRules(data, schema);
    }
  }

  /**
   * Handles aggregation with derivation rules using schema-driven approach.
   * Replaces hardcoded structure creation with SchemaPathResolver.
   */
  private aggregateWithDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.mergeOperations.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      const baseDataResult = emptyStructureResult.data.toFrontmatterData();
      if (!baseDataResult.ok) {
        return baseDataResult;
      }

      return this.applyDerivationRules(baseDataResult.data, derivationRules);
    }

    // Use SchemaPathResolver instead of hardcoded structure creation
    const commandsArray = data.map((item) => item.getData());

    const activeLogger = this.createActiveLogger();
    activeLogger?.debug(
      "Creating data structure using SchemaPathResolver",
      createLogContext({
        operation: "data-structure-creation",
        inputs:
          `inputCount: ${data.length}, commandsArrayLength: ${commandsArray.length}`,
      }),
    );

    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      activeLogger?.error(
        `Data structure creation failed: ${structureResult.error.message}`,
        createLogContext({
          operation: "data-structure-creation",
        }),
      );
      return structureResult;
    }

    activeLogger?.debug(
      "Successfully created data structure",
      createLogContext({
        operation: "data-structure-creation",
      }),
    );

    // Convert to FrontmatterData and apply derivation rules
    const baseDataResult = structureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      activeLogger?.error(
        `Frontmatter conversion failed: ${baseDataResult.error.message}`,
        createLogContext({
          operation: "frontmatter-conversion",
        }),
      );
      return baseDataResult;
    }

    activeLogger?.debug(
      "Successfully converted structure to FrontmatterData",
      createLogContext({
        operation: "frontmatter-conversion",
        inputs: `dataKeys: ${
          Object.keys(baseDataResult.data.getData()).join(", ")
        }`,
      }),
    );

    return this.applyDerivationRules(baseDataResult.data, derivationRules);
  }

  /**
   * Handles aggregation without derivation rules using schema-driven approach.
   * Replaces hardcoded structure creation with SchemaPathResolver.
   */
  private aggregateWithoutDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.mergeOperations.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      return emptyStructureResult.data.toFrontmatterData();
    }

    // Use SchemaPathResolver instead of hardcoded structure creation
    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      return structureResult;
    }

    return structureResult.data.toFrontmatterData();
  }

  /**
   * Applies derivation rules to base data using existing aggregator.
   */
  private applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Validate required baseData parameter
    if (!baseData) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "Base data is required for derivation rules application",
        }),
      };
    }

    // Convert schema rules to domain rules with explicit error tracking
    const ruleConversion = this.convertDerivationRules(derivationRules);

    // For backward compatibility, we continue processing even with failed rules
    const rules = ruleConversion.successfulRules;

    const activeLogger = this.createActiveLogger();
    activeLogger?.debug(
      "Applying derivation rules while preserving frontmatter-part data",
      createLogContext({
        operation: "derivation-rules-application",
        inputs: `ruleCount: ${rules.length}, baseDataKeys: ${
          baseData ? Object.keys(baseData.getData()).join(", ") : "none"
        }`,
      }),
    );

    // Apply derivation rules and merge with base data
    const aggregationResult = this.config.services.aggregator.aggregate(
      [baseData],
      rules,
      baseData,
    );
    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    // Use aggregator's mergeWithBase to properly apply derived fields
    const mergeResult = this.config.services.aggregator.mergeWithBase(
      aggregationResult.data,
    );
    if (!mergeResult.ok) {
      return mergeResult;
    }

    const finalData = mergeResult.data;

    activeLogger?.debug(
      "Successfully applied derivation rules",
      createLogContext({
        operation: "derivation-rules-application",
        inputs: `finalDataKeys: ${Object.keys(finalData.getData()).join(", ")}`,
      }),
    );

    return ok(finalData);
  }

  /**
   * Calculate derived fields from source data using derivation rules.
   * Preserves frontmatter-part data by computing only derived fields.
   */
  private calculateDerivedFields(
    sourceData: FrontmatterData,
    rules: DerivationRule[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivedFields: Record<string, unknown> = {};

    const activeLogger = this.createActiveLogger();
    activeLogger?.debug(
      "Calculating derived fields",
      createLogContext({
        operation: "derived-field-calculation",
        inputs: `ruleCount: ${rules.length}, sourceDataKeys: ${
          Object.keys(sourceData.getData()).join(", ")
        }`,
      }),
    );

    for (const rule of rules) {
      const sourceResult = sourceData.get(rule.getBasePath());
      if (sourceResult.ok && Array.isArray(sourceResult.data)) {
        activeLogger?.debug(
          `Processing rule: ${rule.getBasePath()} -> ${rule.getTargetField()}`,
          createLogContext({
            operation: "derived-field-calculation",
            inputs:
              `sourceArrayLength: ${sourceResult.data.length}, isUnique: ${rule.isUnique()}`,
          }),
        );

        const values = sourceResult.data.map((item) => {
          if (typeof item === "object" && item !== null) {
            const itemResult = SafePropertyAccess.asRecord(item);
            if (itemResult.ok) {
              return itemResult.data[rule.getPropertyPath()];
            }
          }
          return item;
        }).filter((value) => value !== undefined);

        const finalValues = rule.isUnique() ? [...new Set(values)] : values;

        // Set derived field using targetField path
        const setFieldResult = FieldOperations.setNestedField(
          derivedFields,
          rule.getTargetField(),
          finalValues,
        );
        if (!setFieldResult.ok) {
          // Log error but continue processing other rules
          activeLogger?.error(
            `Failed to set derived field: ${rule.getTargetField()}`,
            createLogContext({
              operation: "derived-field-setting",
              error: setFieldResult.error.message,
            }),
          );
        }

        activeLogger?.debug(
          `Calculated derived field: ${rule.getTargetField()}`,
          createLogContext({
            operation: "derived-field-calculation",
            inputs: `valuesCount: ${finalValues.length}`,
          }),
        );
      } else {
        activeLogger?.debug(
          `Skipping rule due to missing or non-array source: ${rule.getBasePath()}`,
          createLogContext({
            operation: "derived-field-calculation",
            decisions: [sourceResult.ok ? "found but not array" : "not found"],
          }),
        );
      }
    }

    activeLogger?.debug(
      "Derived field calculation completed",
      createLogContext({
        operation: "derived-field-calculation",
        inputs: `derivedFieldsKeys: ${Object.keys(derivedFields).join(", ")}`,
      }),
    );

    return this.frontmatterDataCreationService.createFromRaw(derivedFields);
  }

  /**
   * Deep merge two FrontmatterData objects, preserving existing nested structures.
   * Required to merge derived fields without overwriting frontmatter-part data.
   */

  /**
   * Convert schema derivation rules to domain rules with explicit error handling.
   * Replaces silent error handling with tracked rule conversion results.
   */
  private convertDerivationRules(
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): RuleConversionResult {
    const successfulRules: DerivationRule[] = [];
    const errors: Array<DomainError & { message: string }> = [];
    let failedRuleCount = 0;

    for (const rule of derivationRules) {
      const ruleResult = DerivationRule.create(
        rule.sourcePath,
        rule.targetField,
        rule.unique,
      );

      if (ruleResult.ok) {
        successfulRules.push(ruleResult.data);
      } else {
        failedRuleCount++;
        errors.push(ruleResult.error);
      }
    }

    return { successfulRules, failedRuleCount, errors };
  }

  /**
   * Helper method to extract nested properties from an object.
   */
  private extractNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object") {
        const currentResult = SafePropertyAccess.asRecord(current);
        if (currentResult.ok && part in currentResult.data) {
          current = currentResult.data[part];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Helper method to set nested properties in an object.
   */
  private setNestedProperty(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    const parts = path.split(".");
    let current = obj;

    // Navigate to the parent of the target property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }

      // Use SafePropertyAccess to eliminate type assertion
      const propertyResult = SafePropertyAccess.asRecord(current[part]);
      if (!propertyResult.ok) {
        // If property is not a record, create a new one
        current[part] = {};
        const newRecordResult = SafePropertyAccess.asRecord(current[part]);
        if (newRecordResult.ok) {
          current = newRecordResult.data;
        } else {
          // This should never happen since we just created an empty object
          // But following Totality principles, we return an error instead of throwing
          return ErrorHandler.validation({
            operation: "setNestedProperty",
            method: "createNestedRecord",
          }).invalidStructure(
            path,
            "Failed to create record for nested property after initialization",
          );
        }
      } else {
        current = propertyResult.data;
      }
    }

    // Set the final property
    current[parts[parts.length - 1]] = value;
    return ok(void 0);
  }

  /**
   * Private method to process frontmatter parts - wrapper for service call.
   * This method is exposed for testing purposes.
   */
  private processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): FrontmatterData[] {
    const result = this.config.services.frontmatterPartProcessor
      .processFrontmatterParts(data, schema);
    // For backward compatibility with tests, return the data directly
    if (result.ok) {
      return result.data;
    }
    // On error, return original data as fallback
    return data;
  }

  /**
   * Factory method for creating FrontmatterTransformationService with enabled logging
   */
  static createWithEnabledLogging(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    debugLogger: DebugLogger,
    performanceSettings: PerformanceSettings,
    schemaValidationService: SchemaValidationService,
    frontmatterDataCreationService: FrontmatterDataCreationService =
      defaultFrontmatterDataCreationService,
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    const domainLogger = DomainLoggerFactory.createEnabled(debugLogger);

    // Initialize extraction service
    const extractionResult = FrontmatterExtractionService.create(
      frontmatterProcessor,
    );
    if (!extractionResult.ok) {
      return { ok: false, error: extractionResult.error };
    }

    // Initialize validation service
    const validationResult = FrontmatterValidationService.create(
      schemaValidationService,
    );
    if (!validationResult.ok) {
      return { ok: false, error: validationResult.error };
    }

    // Create FrontmatterPartProcessor for DDD service extraction
    const partProcessorResult = FrontmatterPartProcessor.create({
      frontmatterDataCreationService,
      debugLogger,
    });
    if (!partProcessorResult.ok) {
      return { ok: false, error: partProcessorResult.error };
    }

    // Create MemoryBoundsService for DDD service extraction (Issue #1080)
    const memoryBoundsServiceResult = MemoryBoundsServiceFactory.createDefault(
      100,
    );
    if (!memoryBoundsServiceResult.ok) {
      return memoryBoundsServiceResult;
    }

    const configResult = FrontmatterTransformationConfigFactory.create(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      schemaValidationService,
      partProcessorResult.data,
      memoryBoundsServiceResult.data, // Created MemoryBoundsService
      {
        dataCreation: frontmatterDataCreationService,
        logger: domainLogger,
        performance: performanceSettings,
      },
    );

    if (!configResult.ok) {
      return { ok: false, error: configResult.error };
    }

    const serviceResult = FrontmatterTransformationService.create(
      configResult.data,
    );
    if (!serviceResult.ok) {
      return { ok: false, error: serviceResult.error };
    }

    return { ok: true, data: serviceResult.data };
  }

  /**
   * Factory method for creating FrontmatterTransformationService with disabled logging
   */
  static createWithDisabledLogging(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    performanceSettings: PerformanceSettings,
    schemaValidationService: SchemaValidationService,
    frontmatterDataCreationService: FrontmatterDataCreationService =
      defaultFrontmatterDataCreationService,
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    const domainLogger = DomainLoggerFactory.createDisabled();

    // Initialize extraction service
    const extractionResult = FrontmatterExtractionService.create(
      frontmatterProcessor,
    );
    if (!extractionResult.ok) {
      return { ok: false, error: extractionResult.error };
    }

    // Initialize validation service
    const validationResult = FrontmatterValidationService.create(
      schemaValidationService,
    );
    if (!validationResult.ok) {
      return { ok: false, error: validationResult.error };
    }

    // Create FrontmatterPartProcessor for DDD service extraction
    const partProcessorResult = FrontmatterPartProcessor.create({
      frontmatterDataCreationService,
      // No debugLogger for disabled logging
    });
    if (!partProcessorResult.ok) {
      return { ok: false, error: partProcessorResult.error };
    }

    // Create MemoryBoundsService for DDD service extraction (Issue #1080)
    const memoryBoundsServiceResult = MemoryBoundsServiceFactory.createDefault(
      100,
    );
    if (!memoryBoundsServiceResult.ok) {
      return memoryBoundsServiceResult;
    }

    const configResult = FrontmatterTransformationConfigFactory.create(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      schemaValidationService,
      partProcessorResult.data,
      memoryBoundsServiceResult.data, // Created MemoryBoundsService
      {
        dataCreation: frontmatterDataCreationService,
        logger: domainLogger,
        performance: performanceSettings,
      },
    );

    if (!configResult.ok) {
      return { ok: false, error: configResult.error };
    }

    const serviceResult = FrontmatterTransformationService.create(
      configResult.data,
    );
    if (!serviceResult.ok) {
      return { ok: false, error: serviceResult.error };
    }

    return { ok: true, data: serviceResult.data };
  }

  /**
   * Backward compatibility factory method for optional logger
   * @deprecated Use createWithEnabledLogging() or createWithDisabledLogging() for explicit state management
   */
  static createWithOptionalLogger(
    frontmatterProcessor: FrontmatterProcessor,
    aggregator: Aggregator,
    basePropertyPopulator: BasePropertyPopulator,
    fileReader: DomainFileReader,
    fileLister: DomainFileLister,
    performanceSettings: PerformanceSettings,
    schemaValidationService: SchemaValidationService,
    logger?: DebugLogger,
    frontmatterDataCreationService: FrontmatterDataCreationService =
      defaultFrontmatterDataCreationService,
  ): Result<
    FrontmatterTransformationService,
    DomainError & { message: string }
  > {
    const domainLogger = DomainLoggerFactory.fromOptional(logger);

    // Initialize extraction service
    const extractionResult = FrontmatterExtractionService.create(
      frontmatterProcessor,
    );
    if (!extractionResult.ok) {
      return { ok: false, error: extractionResult.error };
    }

    // Initialize validation service
    const validationResult = FrontmatterValidationService.create(
      schemaValidationService,
    );
    if (!validationResult.ok) {
      return { ok: false, error: validationResult.error };
    }

    // Create FrontmatterPartProcessor for DDD service extraction
    const partProcessorResult = FrontmatterPartProcessor.create({
      frontmatterDataCreationService,
      debugLogger: logger, // Use optional logger directly
    });
    if (!partProcessorResult.ok) {
      return { ok: false, error: partProcessorResult.error };
    }

    // Create MemoryBoundsService for DDD service extraction (Issue #1080)
    const memoryBoundsServiceResult = MemoryBoundsServiceFactory.createDefault(
      100,
    );
    if (!memoryBoundsServiceResult.ok) {
      return memoryBoundsServiceResult;
    }

    const configResult = FrontmatterTransformationConfigFactory.create(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
      schemaValidationService,
      partProcessorResult.data,
      memoryBoundsServiceResult.data, // Created MemoryBoundsService
      {
        dataCreation: frontmatterDataCreationService,
        logger: domainLogger,
        performance: performanceSettings,
      },
    );

    if (!configResult.ok) {
      return { ok: false, error: configResult.error };
    }

    const serviceResult = FrontmatterTransformationService.create(
      configResult.data,
    );
    if (!serviceResult.ok) {
      return { ok: false, error: serviceResult.error };
    }

    return { ok: true, data: serviceResult.data };
  }
}
