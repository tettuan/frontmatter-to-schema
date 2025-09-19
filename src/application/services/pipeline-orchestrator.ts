import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";
import { TemplatePathResolver } from "../../domain/template/services/template-path-resolver.ts";
import { SchemaCache } from "../../infrastructure/caching/schema-cache.ts";
import { SchemaCoordinator } from "../coordinators/schema-coordinator.ts";
import { ProcessingCoordinator } from "../coordinators/processing-coordinator.ts";
import { TemplateCoordinator } from "../coordinators/template-coordinator.ts";
import { PipelineStrategyConfig } from "../value-objects/pipeline-strategy-config.ts";
import { MetricsCollectionService } from "../../infrastructure/metrics/metrics-collection-service.ts";
import { PipelineStateManager } from "./pipeline-state-manager.ts";
import { DocumentProcessingService } from "../../domain/pipeline/services/document-processing-service.ts";
import {
  LoggingService,
  LoggingServiceFactory,
  ProcessingLoggerState,
} from "../../infrastructure/logging/logging-service.ts";
import { ProcessingStateMachine } from "./processing-state-machine.ts";
import { ComplexityMetricsService } from "../../domain/monitoring/services/complexity-metrics-service.ts";
import { EntropyManagementService } from "../../domain/monitoring/services/entropy-management-service.ts";
import { EnhancedDebugLogger } from "../../domain/shared/services/debug-logger.ts";
import { VerbosityMode } from "../../domain/template/value-objects/processing-context.ts";

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

export type TemplateConfig =
  | { readonly kind: "explicit"; readonly templatePath: string }
  | { readonly kind: "schema-derived" };

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
  ) {}

  static create(
    frontmatterTransformer: FrontmatterTransformationService,
    _schemaProcessor: SchemaProcessingService,
    outputRenderingService: OutputRenderingService,
    templatePathResolver: TemplatePathResolver,
    fileSystem: FileSystem,
    schemaCache: SchemaCache,
    processingLoggerState: ProcessingLoggerState,
    defaultStrategyConfig: PipelineStrategyConfig = PipelineStrategyConfig
      .forBalanced(),
  ): Result<PipelineOrchestrator, DomainError & { message: string }> {
    // Initialize coordinators
    const schemaCoordinatorResult = SchemaCoordinator.create(
      fileSystem,
      schemaCache,
    );
    if (!schemaCoordinatorResult.ok) return err(schemaCoordinatorResult.error);

    const processingCoordinatorResult = ProcessingCoordinator.create(
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

    const loggingService = LoggingServiceFactory.fromProcessingLoggerState(
      processingLoggerState,
    );
    const complexityMetricsResult = ComplexityMetricsService.create();
    if (!complexityMetricsResult.ok) return err(complexityMetricsResult.error);
    const entropyManagementResult = EntropyManagementService.create();
    if (!entropyManagementResult.ok) return err(entropyManagementResult.error);
    const metricsServiceResult = MetricsCollectionService.create(
      complexityMetricsResult.data,
      entropyManagementResult.data,
      defaultStrategyConfig,
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
      loggingService,
    );
    if (!documentServiceResult.ok) return err(documentServiceResult.error);

    return ok(
      new PipelineOrchestrator(
        schemaCoordinatorResult.data,
        processingCoordinatorResult.data,
        templateCoordinatorResult.data,
        metricsServiceResult.data,
        stateManagerResult.data,
        documentServiceResult.data,
        loggingService,
        defaultStrategyConfig,
      ),
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

    const schemaResult = await this.schemaCoordinator.loadAndProcessSchema(
      config.schemaPath,
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
      paths: templatePathsResult.data,
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

    const documentsResult = await this.documentService.processDocuments(
      {
        inputPattern: config.inputPattern,
        strategyConfig: config.strategyConfig || this.strategyConfig,
      },
      validationRulesResult.data,
      schemaResult.data,
    );
    if (!documentsResult.ok) {
      this.handleError(documentsResult.error);
      return err(documentsResult.error);
    }
    const renderingResult = this.stateManager.transitionTo({
      kind: "rendering",
      outputPath: config.outputPath,
    });
    if (!renderingResult.ok) {
      return err(renderingResult.error);
    }

    const outputResult = this.templateCoordinator.renderOutput(
      templatePathsResult.data.templatePath,
      templatePathsResult.data.itemsTemplatePath,
      documentsResult.data[0] || (() => {
        const result = FrontmatterData.create({});
        return result.ok ? result.data : documentsResult.data[0];
      })(),
      documentsResult.data.length > 1 ? documentsResult.data : undefined,
      config.outputPath,
      templatePathsResult.data.outputFormat || "json",
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

    const completedResult = this.stateManager.transitionTo({
      kind: "completed",
      duration,
    });
    if (!completedResult.ok) {
      return err(completedResult.error);
    }

    const metricsEndResult = this.metricsService.completePipelineExecution(
      this.stateManager.getExecutionId(),
      documentsResult.data.length,
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
        documentsProcessed: documentsResult.data.length,
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
