import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";
import { TemplatePathResolver } from "../../domain/template/services/template-path-resolver.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { TemplateCoordinator } from "../coordinators/template-coordinator.ts";
import { SchemaCache } from "../../infrastructure/caching/schema-cache.ts";
import {
  EnhancedDebugLogger,
} from "../../domain/shared/services/debug-logger.ts";
import { VerbosityMode } from "../../domain/template/value-objects/processing-context.ts";
import { PipelineStrategyConfig } from "../value-objects/pipeline-strategy-config.ts";
import { ProcessingCoordinator } from "../coordinators/processing-coordinator.ts";
import {
  EntropyReductionService,
} from "../../domain/shared/services/entropy-reduction-service.ts";
import {
  ComplexityMetricsConfiguration,
  ConfigurationLoader,
} from "../../domain/configuration/services/configuration-loader.ts";
import { ComplexityMetricsService } from "../../domain/monitoring/services/complexity-metrics-service.ts";
import { EntropyManagementService } from "../../domain/monitoring/services/entropy-management-service.ts";
import {
  LoggingService,
  LoggingServiceFactory,
} from "../../infrastructure/logging/logging-service.ts";
import {
  PipelineExecutionConfig,
  PipelineExecutionService,
} from "../pipeline/services/pipeline-execution-service.ts";
import { PipelineOrchestratorContext } from "../pipeline/services/pipeline-orchestrator-context.ts";
import { SchemaCoordinator } from "../coordinators/schema-coordinator.ts";
import { ProcessingStateMachine } from "./processing-state-machine.ts";
import { DebugMetricsService } from "../../infrastructure/metrics/debug-metrics-service.ts";

/**
 * Processing logger state using discriminated union for enhanced and debug loggers
 * Extends LoggerState to support EnhancedDebugLogger in processing contexts
 */
export type ProcessingLoggerState =
  | {
    readonly kind: "enhanced-enabled";
    readonly logger: EnhancedDebugLogger;
  }
  | {
    readonly kind: "debug-enabled";
    readonly logger: EnhancedDebugLogger;
  }
  | {
    readonly kind: "disabled";
  };

/**
 * Factory for creating ProcessingLoggerState instances following Totality principles
 */
export class ProcessingLoggerFactory {
  /**
   * Create enhanced logger state for processing services
   */
  static createEnhancedEnabled(
    logger: EnhancedDebugLogger,
  ): ProcessingLoggerState {
    return { kind: "enhanced-enabled", logger };
  }

  /**
   * Create debug logger state for processing services
   */
  static createDebugEnabled(
    logger: EnhancedDebugLogger,
  ): ProcessingLoggerState {
    return { kind: "debug-enabled", logger };
  }

  /**
   * Create disabled logger state for processing services
   */
  static createDisabled(): ProcessingLoggerState {
    return { kind: "disabled" };
  }

  /**
   * Backward compatibility helper for optional EnhancedDebugLogger
   * @deprecated Use explicit state creation methods for better type safety
   */
  static fromOptional(logger?: EnhancedDebugLogger): ProcessingLoggerState {
    return logger ? this.createEnhancedEnabled(logger) : this.createDisabled();
  }
}

/**
 * Template configuration using discriminated unions for type safety
 */
export type TemplateConfig =
  | { readonly kind: "explicit"; readonly templatePath: string }
  | { readonly kind: "schema-derived" };

/**
 * Verbosity configuration using discriminated unions
 */
export type VerbosityConfig =
  | { readonly kind: "verbose"; readonly enabled: true }
  | { readonly kind: "quiet"; readonly enabled: false };

/**
 * Configuration for pipeline processing following Totality principles
 */
export interface PipelineConfig {
  readonly inputPattern: string;
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly templateConfig: TemplateConfig;
  readonly verbosityConfig: VerbosityConfig;
  readonly strategyConfig?: PipelineStrategyConfig;
}

/**
 * File system interface for pipeline operations
 */
export interface FileSystem {
  read(
    path: string,
  ):
    | Promise<Result<string, DomainError & { message: string }>>
    | Result<string, DomainError & { message: string }>;
  write(
    path: string,
    content: string,
  ):
    | Promise<Result<void, DomainError & { message: string }>>
    | Result<void, DomainError & { message: string }>;
  list(
    pattern: string,
  ):
    | Promise<Result<string[], DomainError & { message: string }>>
    | Result<string[], DomainError & { message: string }>;
}

/**
 * Main pipeline orchestrator that coordinates the entire processing flow.
 * Implements the requirements from docs/requirements.ja.md
 *
 * Processing flow (成果A → 成果Z):
 * 1. List markdown files (成果A)
 * 2. Extract frontmatter (成果B)
 * 3. Parse with TypeScript (成果C)
 * 4. Convert to schema structure (成果D)
 * 5. Apply to template variables (成果E)
 * 6. Generate final output (成果Z)
 */
export class PipelineOrchestrator {
  private readonly schemaCoordinator: SchemaCoordinator;
  private readonly processingCoordinator: ProcessingCoordinator;
  private readonly templateCoordinator: TemplateCoordinator;
  private readonly complexityMetricsService: ComplexityMetricsService;
  private readonly entropyManagementService: EntropyManagementService;
  private readonly loggingService: LoggingService;
  private readonly stateMachine: ProcessingStateMachine;
  private readonly debugMetricsService: DebugMetricsService;

  private constructor(
    private readonly frontmatterTransformer: FrontmatterTransformationService,
    private readonly schemaProcessor: SchemaProcessingService,
    private readonly outputRenderingService: OutputRenderingService,
    private readonly templatePathResolver: TemplatePathResolver,
    private readonly fileSystem: FileSystem,
    private readonly schemaCache: SchemaCache,
    private readonly processingLoggerState: ProcessingLoggerState,
    private readonly defaultStrategyConfig: PipelineStrategyConfig =
      PipelineStrategyConfig.forBalanced(),
    private readonly entropyReductionService: EntropyReductionService = (() => {
      const result = EntropyReductionService.create();
      if (!result.ok) {
        throw new Error("Failed to create EntropyReductionService");
      }
      return result.data;
    })(),
    private readonly complexityMetricsConfig?: ComplexityMetricsConfiguration,
  ) {
    // Initialize SchemaCoordinator for domain service extraction (Phase C.1)
    const schemaCoordinatorResult = SchemaCoordinator.create(
      this.fileSystem,
      this.schemaCache,
    );
    if (!schemaCoordinatorResult.ok) {
      throw new Error(
        `Failed to create SchemaCoordinator: ${schemaCoordinatorResult.error.message}`,
      );
    }
    this.schemaCoordinator = schemaCoordinatorResult.data;

    // Initialize ProcessingCoordinator for domain service extraction (Phase C.2)
    const processingCoordinatorResult = ProcessingCoordinator.create(
      this.frontmatterTransformer,
    );
    if (!processingCoordinatorResult.ok) {
      throw new Error(
        `Failed to create ProcessingCoordinator: ${processingCoordinatorResult.error.message}`,
      );
    }
    this.processingCoordinator = processingCoordinatorResult.data;

    // Initialize TemplateCoordinator for domain service extraction (Phase C.3)
    const templateCoordinatorResult = TemplateCoordinator.create(
      this.templatePathResolver,
      this.outputRenderingService,
      this.fileSystem,
    );
    if (!templateCoordinatorResult.ok) {
      throw new Error(
        `Failed to create TemplateCoordinator: ${templateCoordinatorResult.error.message}`,
      );
    }
    this.templateCoordinator = templateCoordinatorResult.data;

    // Initialize monitoring services for complexity management
    const complexityMetricsResult = ComplexityMetricsService.create();
    if (!complexityMetricsResult.ok) {
      throw new Error(
        `Failed to create ComplexityMetricsService: ${complexityMetricsResult.error.message}`,
      );
    }
    this.complexityMetricsService = complexityMetricsResult.data;

    const entropyManagementResult = EntropyManagementService.create();
    if (!entropyManagementResult.ok) {
      throw new Error(
        `Failed to create EntropyManagementService: ${entropyManagementResult.error.message}`,
      );
    }
    this.entropyManagementService = entropyManagementResult.data;

    // Initialize logging service from processing logger state
    this.loggingService = LoggingServiceFactory.fromProcessingLoggerState(
      this.processingLoggerState,
    );

    // Initialize processing state machine
    const stateMachineResult = ProcessingStateMachine.create(
      this.loggingService,
    );
    if (!stateMachineResult.ok) {
      throw new Error(
        `Failed to create ProcessingStateMachine: ${stateMachineResult.error.message}`,
      );
    }
    this.stateMachine = stateMachineResult.data;

    // Initialize debug metrics service
    const debugMetricsResult = DebugMetricsService.create(
      this.complexityMetricsService,
      this.entropyManagementService,
    );
    if (!debugMetricsResult.ok) {
      throw new Error(
        `Failed to create DebugMetricsService: ${debugMetricsResult.error.message}`,
      );
    }
    this.debugMetricsService = debugMetricsResult.data;

    // DDD境界統合点デバッグ情報 (仕様駆動強化フロー Iteration 8)
    const dddBoundaryIntegrationDebug = {
      contextBoundaries: {
        applicationLayer: "PipelineOrchestrator", // Application Service
        domainLayers: [
          "FrontmatterTransformationService", // Frontmatter Domain
          "SchemaProcessingService", // Schema Domain
          "OutputRenderingService", // Template Domain
          "TemplatePathResolver", // Template Domain
        ],
        infrastructureLayers: [
          "FileSystem",
          "SchemaCache",
          "EnhancedDebugLogger",
        ],
      },
      boundaryViolationRisks: {
        responsibilityOverload: "high", // 8つの依存性を持つアプリケーションサービス
        domainMixing: "medium", // 複数ドメインの統合処理
        infrastructureCoupling: "low", // インフラ抽象化済み
      },
      separationStrategy: {
        targetSeparation: "bounded-context-per-domain",
        currentViolations: [
          "multi-domain-orchestration",
          "single-service-coordination",
        ],
        refactoringPriority: "high",
      },
      varianceFactors: {
        contextBoundaryChanges: "high", // 境界変更時の影響範囲
        serviceCoordinationComplexity: "high", // サービス間調整の複雑性
        dependencyInjectionVariance: "medium", // DI構成変更の影響
      },
    };

    this.logDebug("DDD境界統合デバッグ情報", {
      ...dddBoundaryIntegrationDebug,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Factory method to create PipelineOrchestrator with external configuration
   * Follows Totality principles with Result<T,E> error handling
   */
  static async createWithConfiguration(
    frontmatterTransformer: FrontmatterTransformationService,
    schemaProcessor: SchemaProcessingService,
    outputRenderingService: OutputRenderingService,
    templatePathResolver: TemplatePathResolver,
    fileSystem: FileSystem,
    schemaCache: SchemaCache,
    processingLoggerState: ProcessingLoggerState,
    configPath: string = "./config/complexity-metrics.yml",
    defaultStrategyConfig?: PipelineStrategyConfig,
  ): Promise<Result<PipelineOrchestrator, DomainError & { message: string }>> {
    // Load configuration from external file
    const configResult = await ConfigurationLoader.loadFromFile(configPath);
    if (!configResult.ok) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            `Failed to load complexity metrics configuration: ${configResult.error.message}`,
        }),
      };
    }

    // Create PipelineOrchestrator with configuration using Smart Constructor
    const orchestratorResult = PipelineOrchestrator.create(
      frontmatterTransformer,
      schemaProcessor,
      outputRenderingService,
      templatePathResolver,
      fileSystem,
      schemaCache,
      processingLoggerState,
      defaultStrategyConfig,
    );

    if (!orchestratorResult.ok) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message:
            `Failed to create PipelineOrchestrator: ${orchestratorResult.error.message}`,
        }),
      };
    }

    return { ok: true, data: orchestratorResult.data };
  }

  /**
   * Helper method to log debug messages - delegates to LoggingService
   */
  private logDebug(message: string, context?: Record<string, unknown>): void {
    this.loggingService.debug(message, context);
  }

  /**
   * Helper method to log info messages - delegates to LoggingService
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    this.loggingService.info(message, context);
  }

  /**
   * Helper method to log warning messages - delegates to LoggingService
   */
  private logWarn(message: string, context?: Record<string, unknown>): void {
    this.loggingService.warn(message, context);
  }

  /**
   * Helper method to log error messages - delegates to LoggingService
   */
  private logError(message: string, context?: Record<string, unknown>): void {
    this.loggingService.error(message, context);
  }

  /**
   * New DDD/Totality compliant execution method using command pattern state machine
   * Replaces the legacy execute method with clean separation of concerns
   */
  async executeWithNewArchitecture(
    config: PipelineConfig,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Get strategy configuration for execution config mapping
    const strategyConfig = config.strategyConfig || this.defaultStrategyConfig;
    const thresholds = strategyConfig.getPerformanceThresholds();

    // Log pipeline execution start with DDD/Totality refactoring info
    this.logInfo(
      "Pipeline execution starting with new DDD/Totality architecture",
      {
        architecture: "command-pattern-state-machine",
        totalityCompliance: "discriminated-unions-result-types",
        dddBoundaries: "pipeline-domain-extracted",
        timestamp: new Date().toISOString(),
      },
    );

    // Create execution context that bridges existing services to new command interface
    const context = new PipelineOrchestratorContext(
      this.schemaProcessor,
      this.frontmatterTransformer,
      this.templatePathResolver,
      this.outputRenderingService,
      this.fileSystem,
      this.schemaCache,
    );

    // Create execution configuration based on strategy
    const executionConfig: PipelineExecutionConfig = {
      maxExecutionTime: thresholds.maxErrorRecoveryTimeMs || 60000,
      enableDetailedLogging: this.processingLoggerState.kind !== "disabled",
      errorRecoveryEnabled: true,
    };

    // Create and execute pipeline using new DDD/Totality architecture
    const pipelineServiceResult = PipelineExecutionService.create(
      config,
      executionConfig,
      context,
    );

    if (!pipelineServiceResult.ok) {
      this.logError("Failed to create pipeline execution service", {
        error: pipelineServiceResult.error,
        config: config,
      });
      return err(pipelineServiceResult.error);
    }

    const pipelineService = pipelineServiceResult.data;

    // Execute the complete pipeline using state machine pattern
    const executionResult = await pipelineService.executePipeline();

    if (!executionResult.ok) {
      this.logError("Pipeline execution failed", {
        error: executionResult.error,
      });
      return err(executionResult.error);
    }

    const result = executionResult.data;

    // Log execution metrics and state machine completion
    this.logInfo("Pipeline execution completed successfully", {
      finalState: result.finalState.kind,
      executionTime: result.executionTime,
      commandsExecuted: result.commandsExecuted,
      stagesCompleted: result.stagesCompleted,
      isComplete: pipelineService.isComplete(),
      hasFailed: pipelineService.hasFailed(),
      metrics: result.metrics,
      timestamp: new Date().toISOString(),
    });

    // Check if pipeline completed successfully
    if (!pipelineService.isComplete()) {
      return err(createError({
        kind: "PipelineExecutionError",
        content:
          `Pipeline did not complete successfully. Final state: ${result.finalState.kind}`,
      }));
    }

    return ok(void 0);
  }

  /**
   * Smart Constructor factory method for PipelineOrchestrator
   * Follows Totality principles by returning Result<T,E> instead of throwing exceptions
   */
  static create(
    frontmatterTransformer: FrontmatterTransformationService,
    schemaProcessor: SchemaProcessingService,
    outputRenderingService: OutputRenderingService,
    templatePathResolver: TemplatePathResolver,
    fileSystem: FileSystem,
    schemaCache: SchemaCache,
    processingLoggerState: ProcessingLoggerState,
    defaultStrategyConfig: PipelineStrategyConfig = PipelineStrategyConfig
      .forBalanced(),
  ): Result<PipelineOrchestrator, DomainError & { message: string }> {
    // Create EntropyReductionService with proper error handling
    const entropyServiceResult = EntropyReductionService.create();
    if (!entropyServiceResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          "Failed to create EntropyReductionService for PipelineOrchestrator",
      }));
    }

    return ok(
      new PipelineOrchestrator(
        frontmatterTransformer,
        schemaProcessor,
        outputRenderingService,
        templatePathResolver,
        fileSystem,
        schemaCache,
        processingLoggerState,
        defaultStrategyConfig,
        entropyServiceResult.data,
      ),
    );
  }

  /**
   * Legacy compatibility method for optional logger parameter
   * @deprecated Use create() with explicit ProcessingLoggerState for better type safety
   */
  static createWithOptionalLogger(
    frontmatterTransformer: FrontmatterTransformationService,
    schemaProcessor: SchemaProcessingService,
    outputRenderingService: OutputRenderingService,
    templatePathResolver: TemplatePathResolver,
    fileSystem: FileSystem,
    schemaCache: SchemaCache,
    logger?: EnhancedDebugLogger,
    defaultStrategyConfig: PipelineStrategyConfig = PipelineStrategyConfig
      .forBalanced(),
  ): Result<PipelineOrchestrator, DomainError & { message: string }> {
    const processingLoggerState = ProcessingLoggerFactory.fromOptional(logger);
    return this.create(
      frontmatterTransformer,
      schemaProcessor,
      outputRenderingService,
      templatePathResolver,
      fileSystem,
      schemaCache,
      processingLoggerState,
      defaultStrategyConfig,
    );
  }

  /**
   * Get complexity factors from configuration or default hardcoded values
   * Follows Totality principles by handling both configured and fallback scenarios
   */

  /**
   * Execute the complete pipeline processing
   */
  async execute(
    config: PipelineConfig,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Initialize strategy configuration
    const strategyConfig = config.strategyConfig || this.defaultStrategyConfig;
    const initialMemory = Deno.memoryUsage();

    // Initialize state machine
    const initResult = this.stateMachine.initialize(config, strategyConfig);
    if (!initResult.ok) {
      return initResult;
    }

    // Generate debug metrics if needed
    const debugMetrics = this.debugMetricsService.generateMetrics(
      strategyConfig,
      initialMemory,
    );

    // Log pipeline initialization with debug metrics
    this.logInfo("Pipeline execution starting", {
      operation: "pipeline-initialization",
      processingStrategy: debugMetrics.processingStrategy,
      pipelineProcessing: debugMetrics.pipelineProcessing,
      entropyControl: debugMetrics.entropyControl,
      totalityControl: debugMetrics.totalityControl,
      integratedControl: debugMetrics.integratedControl,
      initialMemoryMB: Math.round(initialMemory.heapUsed / 1024 / 1024),
      timestamp: new Date().toISOString(),
    });

    // Step 1: Load and process schema
    const schemaTransitionResult = this.stateMachine.transition({
      kind: "LoadSchema",
      path: config.schemaPath,
    });
    if (!schemaTransitionResult.ok) {
      return schemaTransitionResult;
    }

    this.logInfo("Loading schema from " + config.schemaPath, {
      operation: "schema-loading",
      timestamp: new Date().toISOString(),
    });
    const schemaResult = await this.schemaCoordinator.loadSchema(
      config.schemaPath,
    );
    if (!schemaResult.ok) {
      const failureResult = this.stateMachine.transition({
        kind: "Fail",
        error: {
          phase: "schema-loading",
          message: schemaResult.error.message,
          cause: schemaResult.error,
          timestamp: new Date(),
        },
      });
      if (!failureResult.ok) {
        return failureResult;
      }
      return schemaResult;
    }
    const schema = schemaResult.data;

    const schemaSuccessResult = this.stateMachine.transition({
      kind: "SchemaLoadComplete",
      schema: schema,
    });
    if (!schemaSuccessResult.ok) {
      return schemaSuccessResult;
    }

    // Step 2: Process documents first (before template resolution)
    const docProcessingResult = this.stateMachine.transition({
      kind: "ParseFrontmatter",
      content: "", // Content will be loaded from files
    });
    if (!docProcessingResult.ok) {
      return docProcessingResult;
    }

    const validationRulesResult = schema.getValidationRules();
    if (!validationRulesResult.ok) {
      return err(validationRulesResult.error);
    }
    const validationRules = validationRulesResult.data;

    // Determine processing strategy
    const processingStrategy = strategyConfig.getProcessingStrategy();
    const shouldUseParallel = processingStrategy === "concurrent-parallel" ||
      processingStrategy === "adaptive";
    const maxWorkers = shouldUseParallel
      ? strategyConfig.getConcurrencyLevel()
      : 1;

    const processedDataResult = await this.processingCoordinator
      .processDocuments(
        config.inputPattern,
        validationRules,
        schema,
        shouldUseParallel
          ? { kind: "parallel", maxWorkers: maxWorkers }
          : { kind: "sequential" },
      );
    if (!processedDataResult.ok) {
      const failureResult = this.stateMachine.transition({
        kind: "Fail",
        error: {
          phase: "document-processing",
          message: processedDataResult.error.message,
          cause: processedDataResult.error,
          timestamp: new Date(),
        },
      });
      if (!failureResult.ok) {
        return failureResult;
      }
      return processedDataResult;
    }

    const docSuccessResult = this.stateMachine.transition({
      kind: "FrontmatterParseComplete",
      data: processedDataResult.data,
    });
    if (!docSuccessResult.ok) {
      return docSuccessResult;
    }

    // Step 3: Validate data
    const mainData = processedDataResult.data;
    let itemsData: FrontmatterData[] | undefined;

    const dataTransitionResult = this.stateMachine.transition({
      kind: "ValidateData",
    });
    if (!dataTransitionResult.ok) {
      return dataTransitionResult;
    }

    const dataSuccessResult = this.stateMachine.transition({
      kind: "ValidationComplete",
      validatedData: mainData,
    });
    if (!dataSuccessResult.ok) {
      return dataSuccessResult;
    }

    // Step 4: Resolve and load templates
    const resolvePathsResult = this.templateCoordinator.resolveTemplatePaths(
      schema,
      config.templateConfig,
      config.schemaPath,
    );
    if (!resolvePathsResult.ok) {
      const failureResult = this.stateMachine.transition({
        kind: "Fail",
        error: {
          phase: "template-resolution",
          message: resolvePathsResult.error.message,
          cause: resolvePathsResult.error,
          timestamp: new Date(),
        },
      });
      if (!failureResult.ok) {
        return failureResult;
      }
      return resolvePathsResult;
    }

    const resolvedPaths = resolvePathsResult.data;
    const templatePath = resolvedPaths.templatePath;

    // Use backward compatibility property if available, otherwise extract from ItemsTemplateState
    const itemsTemplatePath = resolvedPaths.itemsTemplatePath !== undefined
      ? resolvedPaths.itemsTemplatePath
      : resolvedPaths.itemsTemplate &&
          resolvedPaths.itemsTemplate.kind === "defined"
      ? resolvedPaths.itemsTemplate.path
      : undefined;

    // Extract output format from OutputFormatState
    const outputFormat = resolvedPaths.outputFormat &&
        resolvedPaths.outputFormat.kind === "specified"
      ? resolvedPaths.outputFormat.format
      : "json";

    const templateTransitionResult = this.stateMachine.transition({
      kind: "LoadTemplate",
      path: templatePath,
    });
    if (!templateTransitionResult.ok) {
      return templateTransitionResult;
    }

    // Log current state before TemplateLoadComplete
    this.logDebug("About to transition TemplateLoadComplete", {
      currentState: this.stateMachine.getCurrentState().kind,
    });

    const templateSuccessResult = this.stateMachine.transition({
      kind: "TemplateLoadComplete",
      template: { templatePath: templatePath } as any, // Type cast for now
    });
    if (!templateSuccessResult.ok) {
      this.logError("Template load complete transition failed", {
        error: templateSuccessResult.error,
        currentState: this.stateMachine.getCurrentState().kind,
      });
      return templateSuccessResult;
    }

    // Extract frontmatter-part data if we have a separate items template
    if (itemsTemplatePath) {
      const frontmatterPartResult = this.processingCoordinator
        .extractFrontmatterPartData(
          mainData,
          schema,
        );
      if (!frontmatterPartResult.ok) {
        const failureResult = this.stateMachine.transition({
          kind: "Fail",
          error: {
            phase: "data-preparation",
            message: frontmatterPartResult.error.message,
            cause: frontmatterPartResult.error,
            timestamp: new Date(),
          },
        });
        if (!failureResult.ok) {
          return failureResult;
        }
        return frontmatterPartResult;
      }
      if (frontmatterPartResult.data.length > 0) {
        itemsData = frontmatterPartResult.data;
      }
    }

    // Step 5: Generate output
    const renderTransitionResult = this.stateMachine.transition({
      kind: "GenerateOutput",
    });
    if (!renderTransitionResult.ok) {
      return renderTransitionResult;
    }

    const verbosityMode: VerbosityMode =
      config.verbosityConfig.kind === "verbose"
        ? { kind: "verbose" }
        : { kind: "normal" };

    const renderResult = this.templateCoordinator.renderOutput(
      templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      config.outputPath,
      outputFormat as "markdown" | "json" | "yaml",
      verbosityMode,
    );

    if (!renderResult.ok) {
      const failureResult = this.stateMachine.transition({
        kind: "Fail",
        error: {
          phase: "rendering",
          message: renderResult.error.message,
          cause: renderResult.error,
          timestamp: new Date(),
        },
      });
      if (!failureResult.ok) {
        return failureResult;
      }
      return renderResult;
    }

    const renderSuccessResult = this.stateMachine.transition({
      kind: "OutputGenerationComplete",
      output: config.outputPath,
    });
    if (!renderSuccessResult.ok) {
      return renderSuccessResult;
    }

    // Complete the pipeline
    const completeResult = this.stateMachine.transition({
      kind: "Complete",
    });
    if (!completeResult.ok) {
      return completeResult;
    }

    this.logInfo("Pipeline execution completed successfully", {
      operation: "pipeline-completion",
      timestamp: new Date().toISOString(),
    });

    return renderResult;
  }
}
