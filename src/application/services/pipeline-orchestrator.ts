import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";
import { TemplatePathResolver } from "../../domain/template/services/template-path-resolver.ts";
import { SchemaCache } from "../../infrastructure/caching/schema-cache.ts";
import { FileSystemSchemaRepository } from "../../infrastructure/adapters/schema-loader.ts";
import { SchemaCoordinator } from "../coordinators/schema-coordinator.ts";
import { ProcessingCoordinator } from "../coordinators/processing-coordinator.ts";
import { TemplateCoordinator } from "../coordinators/template-coordinator.ts";
import { PipelineStrategyConfig } from "../../domain/pipeline/value-objects/pipeline-strategy-config.ts";
import { MetricsCollectionService } from "../../infrastructure/metrics/metrics-collection-service.ts";
import { PipelineStateManager } from "./pipeline-state-manager.ts";
import { DocumentProcessingService } from "../../domain/pipeline/services/document-processing-service.ts";
import {
  LoggingService,
  LoggingServiceFactory,
  ProcessingLoggerState,
} from "../../infrastructure/logging/logging-service.ts";
import { NullDomainLogger } from "../../domain/shared/services/domain-logger.ts";
import { ProcessingStateMachine } from "./processing-state-machine.ts";
import { ComplexityMetricsService } from "../../domain/monitoring/services/complexity-metrics-service.ts";
import { EntropyManagementService } from "../../domain/monitoring/services/entropy-management-service.ts";
import { EnhancedDebugLogger } from "../../domain/shared/services/debug-logger.ts";
import { VerbosityMode } from "../../domain/template/value-objects/processing-context.ts";
import {
  RecoveryContext,
  RecoveryStrategy,
  RecoveryStrategyFactory,
} from "../strategies/recovery-strategy.ts";
import { TemplateConfig } from "../strategies/template-resolution-strategy.ts";

/**
 * Factory for creating ProcessingLoggerState instances - for backward compatibility
 */
export class ProcessingLoggerFactory {
  static createEnhancedEnabled(
    logger: EnhancedDebugLogger,
  ): ProcessingLoggerState {
    return { kind: "enhanced-enabled" as any, logger };
  }
  static createDebugEnabled(
    logger: EnhancedDebugLogger,
  ): ProcessingLoggerState {
    return { kind: "debug-enabled" as any, logger };
  }
  static createDisabled(): ProcessingLoggerState {
    return { kind: "disabled" as any };
  }
  static fromOptional(logger?: EnhancedDebugLogger): ProcessingLoggerState {
    return logger ? this.createEnhancedEnabled(logger) : this.createDisabled();
  }
}

export type VerbosityConfig =
  | { readonly kind: "verbose"; readonly enabled: true }
  | { readonly kind: "quiet"; readonly enabled: false };

export interface PipelineConfig {
  readonly inputPattern: string;
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly templateConfig: TemplateConfig;
  readonly verbosityConfig: VerbosityConfig;
  readonly strategyConfig?: PipelineStrategyConfig;
}

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
 * Pipeline Orchestrator - Simplified to < 300 lines
 * Delegates to: MetricsCollectionService, PipelineStateManager,
 * DocumentProcessingService, LoggingService
 */
export class PipelineOrchestrator {
  private constructor(
    private readonly schemaCoordinator: SchemaCoordinator,
    private readonly processingCoordinator: ProcessingCoordinator,
    private readonly templateCoordinator: TemplateCoordinator,
    private readonly metricsService: MetricsCollectionService,
    private readonly stateManager: PipelineStateManager,
    private readonly documentService: DocumentProcessingService,
    private readonly loggingService: LoggingService,
    private readonly strategyConfig: PipelineStrategyConfig,
    private readonly recoveryStrategies: RecoveryStrategy[],
  ) {}

  static create(
    frontmatterTransformer: FrontmatterTransformationService,
    _schemaProcessor: SchemaProcessingService,
    outputRenderingService: OutputRenderingService,
    templatePathResolver: TemplatePathResolver,
    fileSystem: FileSystem,
    schemaCache: SchemaCache,
    processingLoggerState: ProcessingLoggerState,
    defaultStrategyConfig?: PipelineStrategyConfig,
  ): Result<PipelineOrchestrator, DomainError & { message: string }> {
    // Create default strategy config if not provided
    let finalStrategyConfig = defaultStrategyConfig;
    if (!finalStrategyConfig) {
      const strategyConfigResult = PipelineStrategyConfig.forBalanced();
      if (!strategyConfigResult.ok) {
        return err(strategyConfigResult.error);
      }
      finalStrategyConfig = strategyConfigResult.data;
    }

    // Initialize coordinators
    // Create FileSystemSchemaRepository for schema loading with reference resolution
    // Adapt the fileSystem interface to FileReader interface
    const fileReader = {
      read: (path: string) => {
        const result = fileSystem.read(path);
        if (result instanceof Promise) {
          return err({
            kind: "FileSystemError",
            message: "Synchronous file reading expected in schema repository",
          });
        }
        return result;
      },
    };
    const schemaRepository = new FileSystemSchemaRepository(fileReader);

    const schemaCoordinatorResult = SchemaCoordinator.create(
      schemaRepository,
      schemaCache,
    );
    if (!schemaCoordinatorResult.ok) return err(schemaCoordinatorResult.error);

    const processingCoordinatorResult = ProcessingCoordinator.createOptimized(
      frontmatterTransformer,
    );
    if (!processingCoordinatorResult.ok) {
      return err(processingCoordinatorResult.error);
    }

    const templateCoordinatorResult = TemplateCoordinator.create(
      templatePathResolver,
      outputRenderingService,
      fileSystem,
    );
    if (!templateCoordinatorResult.ok) {
      return err(templateCoordinatorResult.error);
    }

    const loggingServiceResult = LoggingServiceFactory
      .fromProcessingLoggerState(
        processingLoggerState,
      );
    if (!loggingServiceResult.ok) return err(loggingServiceResult.error);
    const loggingService = loggingServiceResult.data;
    const complexityMetricsResult = ComplexityMetricsService.create();
    if (!complexityMetricsResult.ok) return err(complexityMetricsResult.error);
    const entropyManagementResult = EntropyManagementService.create();
    if (!entropyManagementResult.ok) return err(entropyManagementResult.error);
    const metricsServiceResult = MetricsCollectionService.create(
      complexityMetricsResult.data,
      entropyManagementResult.data,
      finalStrategyConfig,
    );
    if (!metricsServiceResult.ok) return err(metricsServiceResult.error);
    const stateMachineResult = ProcessingStateMachine.create(loggingService);
    if (!stateMachineResult.ok) return err(stateMachineResult.error);
    const executionId = `exec-${Date.now()}-${
      Math.random().toString(36).substring(2, 9)
    }`;
    const stateManagerResult = PipelineStateManager.create(
      executionId,
      stateMachineResult.data,
    );
    if (!stateManagerResult.ok) return err(stateManagerResult.error);
    const documentServiceResult = DocumentProcessingService.create(
      processingCoordinatorResult.data,
      new NullDomainLogger(),
    );
    if (!documentServiceResult.ok) return err(documentServiceResult.error);

    // Create recovery strategies
    const recoveryStrategiesResult = RecoveryStrategyFactory.createStrategies();
    if (!recoveryStrategiesResult.ok) {
      return err(recoveryStrategiesResult.error);
    }

    return ok(
      new PipelineOrchestrator(
        schemaCoordinatorResult.data,
        processingCoordinatorResult.data,
        templateCoordinatorResult.data,
        metricsServiceResult.data,
        stateManagerResult.data,
        documentServiceResult.data,
        loggingService,
        finalStrategyConfig,
        recoveryStrategiesResult.data,
      ),
    );
  }

  /**
   * Attempt error recovery using appropriate recovery strategy
   * Following DDD principles - domain service coordination
   * Following Totality principles - total function returning Result<T,E>
   */
  private attemptRecovery(
    error: DomainError,
    operationId: string,
    verbosityMode: VerbosityMode,
    attemptCount: number = 1,
    maxAttempts: number = 3,
    metadata: Record<string, unknown> = {},
  ): Result<void, DomainError & { message: string }> {
    // Create recovery context
    const context: RecoveryContext = {
      operationId,
      verbosityMode,
      attemptCount,
      maxAttempts,
      metadata,
    };

    // Find appropriate recovery strategy
    const strategyResult = RecoveryStrategyFactory.findStrategy(
      error,
      this.recoveryStrategies,
    );

    if (!strategyResult.ok) {
      // No recovery strategy available - log and return original error
      this.loggingService.error("No recovery strategy found", {
        error: error,
        operationId,
      });
      return err(error as DomainError & { message: string });
    }

    // Attempt recovery using the strategy
    const recoveryResult = strategyResult.data.recover(error, context);
    if (!recoveryResult.ok) {
      this.loggingService.error("Recovery attempt failed", {
        originalError: error,
        recoveryError: recoveryResult.error,
        operationId,
        attemptCount,
      });
      return recoveryResult;
    }

    // Recovery successful - log success
    if (verbosityMode.kind === "verbose") {
      this.loggingService.info("Recovery successful", {
        originalError: error,
        operationId,
        attemptCount,
      });
    }

    return ok(undefined);
  }

  /**
   * Execute operation with recovery support
   * Following DDD principles - error handling with domain recovery strategies
   */
  private async executeWithRecovery<T>(
    operation: () => Promise<Result<T, DomainError & { message: string }>>,
    operationId: string,
    verbosityMode: VerbosityMode,
    maxAttempts: number = 3,
  ): Promise<Result<T, DomainError & { message: string }>> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await operation();

      if (result.ok) {
        return result;
      }

      // If it's the last attempt, return the error
      if (attempt === maxAttempts) {
        return result;
      }

      // Attempt recovery
      const recoveryResult = await this.attemptRecovery(
        result.error,
        operationId,
        verbosityMode,
        attempt,
        maxAttempts,
      );

      // If recovery failed, return original error
      if (!recoveryResult.ok) {
        return result;
      }

      // Recovery succeeded, try the operation again
      if (verbosityMode.kind === "verbose") {
        this.loggingService.info("Retrying operation after recovery", {
          operationId,
          attempt: attempt + 1,
        });
      }
    }

    // This should never be reached, but TypeScript needs it
    return err(
      {
        kind: "ConfigurationError",
        message: "Unexpected error in executeWithRecovery",
      } as DomainError & { message: string },
    );
  }

  /**
   * Backward compatibility - alias for execute
   */
  async executeWithNewArchitecture(
    config: PipelineConfig,
  ): Promise<Result<string, DomainError & { message: string }>> {
    return await this.execute(config);
  }

  async execute(
    config: PipelineConfig,
  ): Promise<Result<string, DomainError & { message: string }>> {
    const executionStart = performance.now();
    const executionId = this.stateManager.getExecutionId();

    // Enhanced logging: Track pipeline stage transition
    this.loggingService.logStageTransition(
      "idle",
      "initializing",
      executionId,
      { reason: "Pipeline execution started" },
    );

    const initResult = this.stateManager.transitionTo({
      kind: "initializing",
      startTime: executionStart,
    });
    if (!initResult.ok) {
      this.loggingService.error("Pipeline initialization failed", {
        error: initResult.error,
      });
      return err(initResult.error);
    }
    const metricsStartResult = this.metricsService.startPipelineExecution(
      this.stateManager.getExecutionId(),
    );
    if (!metricsStartResult.ok) {
      return err(metricsStartResult.error);
    }
    const schemaStateResult = this.stateManager.transitionTo({
      kind: "schema-loading",
      schemaPath: config.schemaPath,
    });
    if (!schemaStateResult.ok) {
      return err(schemaStateResult.error);
    }

    // Enhanced logging: Track schema loading stage transition
    this.loggingService.logStageTransition(
      "initializing",
      "schema-loading",
      executionId,
      { reason: "Starting schema validation and processing" },
    );

    const schemaLoadStart = performance.now();
    const schemaResult = await this.schemaCoordinator.loadAndProcessSchema(
      config.schemaPath,
    );
    const schemaLoadEnd = performance.now();

    // Enhanced logging: Track schema processing step
    this.loggingService.logProcessingStep(
      "schema-validation",
      "schema-loading",
      { start: schemaLoadStart, end: schemaLoadEnd },
      { resourcesProcessed: 1 },
      { schemaPath: config.schemaPath },
    );
    if (!schemaResult.ok) {
      this.handleError(schemaResult.error);
      return err(schemaResult.error);
    }

    const schemaLoadedResult = this.stateManager.transitionTo({
      kind: "schema-loaded",
      schema: schemaResult.data,
    });
    if (!schemaLoadedResult.ok) {
      return err(schemaLoadedResult.error);
    }
    const templateResolvingResult = this.stateManager.transitionTo({
      kind: "template-resolving",
      schema: schemaResult.data,
    });
    if (!templateResolvingResult.ok) {
      return err(templateResolvingResult.error);
    }

    const templatePathsResult = this.templateCoordinator.resolveTemplatePaths(
      schemaResult.data,
      config.templateConfig,
      config.schemaPath,
    );
    if (!templatePathsResult.ok) {
      this.handleError(templatePathsResult.error);
      return err(templatePathsResult.error);
    }

    const templateResolvedResult = this.stateManager.transitionTo({
      kind: "template-resolved",
      paths: {
        templatePath: templatePathsResult.data.templatePath,
        itemsTemplatePath: templatePathsResult.data.itemsTemplatePath,
        outputFormat:
          templatePathsResult.data.outputFormat?.kind === "specified"
            ? templatePathsResult.data.outputFormat.format
            : "json",
      },
    });
    if (!templateResolvedResult.ok) {
      return err(templateResolvedResult.error);
    }
    const docProcessingResult = this.stateManager.transitionTo({
      kind: "document-processing",
      pattern: config.inputPattern,
    });
    if (!docProcessingResult.ok) {
      return err(docProcessingResult.error);
    }

    const validationRulesResult = schemaResult.data.getValidationRules();
    if (!validationRulesResult.ok) {
      return err(validationRulesResult.error);
    }

    // Enhanced logging: Track document processing stage transition
    this.loggingService.logStageTransition(
      "template-resolved",
      "document-processing",
      executionId,
      { reason: "Starting document processing pipeline" },
    );

    const docProcessingStart = performance.now();
    const documentsResult = await this.documentService.processDocuments(
      {
        inputPattern: config.inputPattern,
        strategyConfig: config.strategyConfig || this.strategyConfig,
      },
      validationRulesResult.data,
      schemaResult.data,
    );
    const docProcessingEnd = performance.now();
    const docProcessingDuration = docProcessingEnd - docProcessingStart;

    if (!documentsResult.ok) {
      this.handleError(documentsResult.error);
      return err(documentsResult.error);
    }

    // Enhanced logging: Track document processing performance
    this.loggingService.logProcessingStep(
      "document-processing",
      "document-processing",
      { start: docProcessingStart, end: docProcessingEnd },
      {
        resourcesProcessed: Array.isArray(documentsResult.data.mainData)
          ? documentsResult.data.mainData.length
          : 1,
      },
      {
        inputPattern: config.inputPattern,
        documentsProcessed: Array.isArray(documentsResult.data.mainData)
          ? documentsResult.data.mainData.length
          : 1,
      },
    );

    // Enhanced logging: Performance bottleneck detection (threshold: 5 seconds for document processing)
    if (docProcessingDuration > 5000) {
      this.loggingService.logPerformanceBottleneck(
        "document-processing",
        docProcessingDuration,
        5000,
        {
          resourceCount: Array.isArray(documentsResult.data.mainData)
            ? documentsResult.data.mainData.length
            : 1,
        },
      );
    }
    const renderingResult = this.stateManager.transitionTo({
      kind: "rendering",
      outputPath: config.outputPath,
    });
    if (!renderingResult.ok) {
      return err(renderingResult.error);
    }

    const outputFormat =
      templatePathsResult.data.outputFormat?.kind === "specified"
        ? templatePathsResult.data.outputFormat.format
        : "json";

    // Use itemsData from document processing if available, otherwise fallback to original logic
    let itemsData: FrontmatterData[] | undefined =
      documentsResult.data.itemsData;

    // If no itemsData from processing, check for fallback behavior
    if (!itemsData) {
      const mainDataArray = Array.isArray(documentsResult.data.mainData)
        ? documentsResult.data.mainData
        : [documentsResult.data.mainData];

      // Check if schema has x-frontmatter-part directive for fallback extraction
      const frontmatterPartResult = schemaResult.data.findFrontmatterPartPath();
      if (frontmatterPartResult.ok && mainDataArray.length > 0) {
        // Extract items from the frontmatter part path
        const mainDoc = mainDataArray[0];
        const itemsResult = mainDoc.get(frontmatterPartResult.data);

        if (itemsResult.ok && Array.isArray(itemsResult.data)) {
          // Convert raw items to FrontmatterData array
          const convertedItems: FrontmatterData[] = [];
          for (const item of itemsResult.data) {
            const itemDataResult = FrontmatterData.create(item);
            if (itemDataResult.ok) {
              convertedItems.push(itemDataResult.data);
            }
          }
          itemsData = convertedItems.length > 0 ? convertedItems : undefined;
        }
      } else if (mainDataArray.length > 1) {
        // Fallback: if multiple documents, use them as itemsData
        itemsData = mainDataArray;
      }
    }

    const outputResult = this.templateCoordinator.renderOutput(
      templatePathsResult.data.templatePath,
      templatePathsResult.data.itemsTemplatePath,
      (Array.isArray(documentsResult.data.mainData)
        ? documentsResult.data.mainData[0]
        : documentsResult.data.mainData) || (() => {
          const result = FrontmatterData.create({});
          return result.ok
            ? result.data
            : (Array.isArray(documentsResult.data.mainData)
              ? documentsResult.data.mainData[0]
              : documentsResult.data.mainData);
        })(),
      itemsData,
      config.outputPath,
      outputFormat,
      (config.verbosityConfig.kind === "verbose"
        ? "verbose"
        : "normal") as unknown as VerbosityMode,
    );
    if (!outputResult.ok) {
      this.handleError(outputResult.error);
      return err(outputResult.error);
    }
    const executionEnd = performance.now();
    const duration = executionEnd - executionStart;

    // Enhanced logging: Track final completion stage transition
    this.loggingService.logStageTransition(
      "rendering",
      "completed",
      executionId,
      {
        duration,
        reason: "Pipeline execution completed successfully",
        resourcesProcessed: Array.isArray(documentsResult.data.mainData)
          ? documentsResult.data.mainData.length
          : 1,
      },
    );

    const completedResult = this.stateManager.transitionTo({
      kind: "completed",
      duration,
    });
    if (!completedResult.ok) {
      return err(completedResult.error);
    }

    const metricsEndResult = this.metricsService.completePipelineExecution(
      this.stateManager.getExecutionId(),
      Array.isArray(documentsResult.data.mainData)
        ? documentsResult.data.mainData.length
        : 1,
      0, // errors count
    );
    if (!metricsEndResult.ok) {
      return err(metricsEndResult.error);
    }
    const finalMetricsResult = (this.metricsService as any).collectAllMetrics
      ? (this.metricsService as any).collectAllMetrics(
        this.stateManager.getExecutionId(),
      )
      : { ok: false };
    if (finalMetricsResult.ok) {
      this.loggingService.info("Pipeline execution completed", {
        duration: `${duration}ms`,
        documentsProcessed: Array.isArray(documentsResult.data.mainData)
          ? documentsResult.data.mainData.length
          : 1,
        metrics: finalMetricsResult.data,
      });
    }

    return ok(config.outputPath);
  }

  private handleError(
    error: DomainError & { message: string },
  ): Result<void, DomainError & { message: string }> {
    const failedResult = this.stateManager.transitionTo({
      kind: "failed",
      error,
    });
    if (!failedResult.ok) {
      this.loggingService.error("Failed to transition to error state", {
        originalError: error,
        transitionError: failedResult.error,
      });
    }

    this.loggingService.error("Pipeline execution failed", { error });

    const metricsResult = this.metricsService.completePipelineExecution(
      this.stateManager.getExecutionId(),
      0,
      1, // error count
    );
    if (!metricsResult.ok) {
      this.loggingService.warn("Failed to record error metrics", {
        error: metricsResult.error,
      });
    }

    return ok(undefined);
  }
}
