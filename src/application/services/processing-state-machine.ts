import { ok, Result } from "../../domain/shared/types/result.ts";
import { DomainError } from "../../domain/shared/types/errors.ts";
import {
  PipelineConfiguration,
  PipelineExecutionState,
  PipelineStateService,
  StateTransitionEvent,
} from "../../domain/pipeline/services/pipeline-state-service.ts";
import { LoggingService } from "../../infrastructure/logging/logging-service.ts";
import { PipelineConfig } from "./pipeline-orchestrator.ts";
import { PipelineStrategyConfig } from "../../domain/pipeline/value-objects/pipeline-strategy-config.ts";
import {
  ExplicitTemplateStrategy,
  TemplateConfig,
  TemplateResolutionStrategyFactory,
} from "../strategies/template-resolution-strategy.ts";

/**
 * Processing context for state transitions
 */
export interface ProcessingContext {
  readonly config: PipelineConfig;
  readonly strategyConfig: PipelineStrategyConfig;
  readonly startTime: number;
  readonly memoryStart: Deno.MemoryUsage;
}

/**
 * Processing metrics collected during execution
 */
export interface ProcessingMetrics {
  readonly pipelineArchitecture: string;
  readonly stagesCompleted: number;
  readonly memoryVariance: number;
  readonly throughputVariance: number;
  readonly errorRecoveryTime: number;
  readonly executionTimeMs: number;
}

/**
 * Processing State Machine
 * Application-level state machine that coordinates with domain state service
 * Handles processing logic and metrics collection
 */
export class ProcessingStateMachine {
  private readonly stateService: PipelineStateService;
  private readonly loggingService: LoggingService;
  private processingContext?: ProcessingContext;
  private metrics: Partial<ProcessingMetrics> = {};

  private constructor(
    stateService: PipelineStateService,
    loggingService: LoggingService,
  ) {
    this.stateService = stateService;
    this.loggingService = loggingService;
  }

  /**
   * Smart Constructor
   */
  static create(
    loggingService: LoggingService,
  ): Result<ProcessingStateMachine, DomainError & { message: string }> {
    const stateServiceResult = PipelineStateService.create();
    if (!stateServiceResult.ok) {
      return stateServiceResult;
    }

    return ok(
      new ProcessingStateMachine(
        stateServiceResult.data,
        loggingService,
      ),
    );
  }

  /**
   * Initialize processing with configuration
   */
  initialize(
    config: PipelineConfig,
    strategyConfig: PipelineStrategyConfig,
  ): Result<void, DomainError & { message: string }> {
    // Reset state machine to idle for new execution
    this.stateService.reset();

    // Create pipeline configuration from app config using strategy pattern
    const templatePathResult = this.extractTemplatePathFromConfig(
      config.templateConfig,
    );
    if (!templatePathResult.ok) {
      return templatePathResult;
    }
    const templatePath = templatePathResult.data;

    const pipelineConfig: PipelineConfiguration = {
      mode: this.determineMode(config),
      inputPattern: config.inputPattern,
      schemaPath: config.schemaPath,
      templatePath,
      outputPath: config.outputPath,
      enableJMESPath: false, // Would need to check schema for JMES path extensions
      parallelProcessing: strategyConfig.shouldUseParallelProcessing(100, 5),
      maxConcurrency: strategyConfig.getConcurrencyLevel(),
    };

    // Initialize processing context
    this.processingContext = {
      config,
      strategyConfig,
      startTime: performance.now(),
      memoryStart: Deno.memoryUsage(),
    };

    // Initialize metrics
    this.metrics = {
      pipelineArchitecture: strategyConfig.getProcessingStrategy(),
      stagesCompleted: 0,
    };

    // Transition to initializing state
    const event: StateTransitionEvent = {
      kind: "state-transition",
      fromPhase: "initialization",
      toPhase: "initialization",
      timestamp: new Date(),
      metadata: { config: pipelineConfig },
    };

    const result = this.stateService.transition(event);
    if (!result.ok) {
      this.loggingService.error("Failed to initialize state machine", {
        error: result.error,
      });
      return result;
    }

    this.loggingService.info("Processing state machine initialized", {
      mode: pipelineConfig.mode,
      strategy: pipelineConfig.parallelProcessing ? "parallel" : "sequential",
    });

    return ok(undefined);
  }

  /**
   * Get current state
   */
  getCurrentState(): PipelineExecutionState {
    return this.stateService.getCurrentState();
  }

  /**
   * Check if processing is complete
   */
  isComplete(): boolean {
    return this.stateService.isTerminal();
  }

  /**
   * Check if processing can continue
   */
  canProceed(): boolean {
    return this.stateService.canProceed();
  }

  /**
   * Transition to next state
   */
  transition(
    event: StateTransitionEvent,
  ): Result<PipelineExecutionState, DomainError & { message: string }> {
    const currentState = this.getCurrentState();

    this.loggingService.debug("State transition", {
      from: currentState.kind,
      event: event.kind,
    });

    const result = this.stateService.transition(event);

    if (!result.ok) {
      this.loggingService.error("State transition failed", {
        from: currentState.kind,
        event: event.kind,
        error: result.error,
      });
      return result;
    }

    // Update metrics
    if (this.metrics.stagesCompleted !== undefined) {
      this.metrics = {
        ...this.metrics,
        stagesCompleted: this.metrics.stagesCompleted + 1,
      };
    }

    // Get the new state after transition
    const newState = this.getCurrentState();

    this.loggingService.debug("State transition successful", {
      from: currentState.kind,
      to: newState.kind,
    });

    return ok(newState);
  }

  /**
   * Get processing metrics
   */
  getMetrics(): ProcessingMetrics {
    const currentTime = performance.now();
    const executionTime = this.processingContext
      ? currentTime - this.processingContext.startTime
      : 0;

    const currentMemory = Deno.memoryUsage();
    const memoryDelta = this.processingContext
      ? currentMemory.heapUsed - this.processingContext.memoryStart.heapUsed
      : 0;

    return {
      pipelineArchitecture: this.metrics.pipelineArchitecture || "unknown",
      stagesCompleted: this.metrics.stagesCompleted || 0,
      memoryVariance: this.calculateMemoryVariance(memoryDelta),
      throughputVariance: this.calculateThroughputVariance(executionTime),
      errorRecoveryTime: this.metrics.errorRecoveryTime || 0,
      executionTimeMs: Math.floor(executionTime),
    };
  }

  /**
   * Handle error state
   */
  handleError(
    phase: string,
    message: string,
    cause?: DomainError,
  ): Result<void, DomainError & { message: string }> {
    const errorEvent: StateTransitionEvent = {
      kind: "state-transition",
      fromPhase: this.getCurrentState().phase,
      toPhase: "error",
      timestamp: new Date(),
      metadata: {
        phase,
        message,
        cause,
      },
    };

    const result = this.stateService.transition(errorEvent);
    if (!result.ok) {
      return result;
    }

    this.loggingService.error("Processing error", {
      phase,
      message,
      cause,
    });

    return ok(undefined);
  }

  /**
   * Complete processing
   */
  complete(): Result<void, DomainError & { message: string }> {
    const event: StateTransitionEvent = {
      kind: "state-transition",
      fromPhase: this.getCurrentState().phase,
      toPhase: "completed",
      timestamp: new Date(),
    };

    const result = this.stateService.transition(event);
    if (!result.ok) {
      this.loggingService.error("Failed to complete processing", {
        error: result.error,
      });
      return result;
    }

    const metrics = this.getMetrics();
    this.loggingService.info("Processing completed", {
      metrics,
    });

    return ok(undefined);
  }

  /**
   * Reset state machine
   */
  reset(): void {
    this.stateService.reset();
    this.processingContext = undefined;
    this.metrics = {};
    this.loggingService.debug("State machine reset");
  }

  /**
   * Get state history for debugging
   */
  getStateHistory(): Array<{
    from: string;
    to: string;
    event: string;
    timestamp: Date;
  }> {
    return this.stateService.getStateHistory();
  }

  /**
   * Get transition log for debugging
   */
  getTransitionLog(): Array<{
    from: string;
    to: string;
    event: string;
    timestamp: Date;
  }> {
    // Get transition log directly from the state service
    return this.stateService.getStateHistory();
  }

  /**
   * Determine processing mode from config
   */
  /**
   * Extract template path from config using strategy pattern
   * Eliminates hardcoded kind comparisons
   */
  private extractTemplatePathFromConfig(
    templateConfig: TemplateConfig,
  ): Result<string | undefined, DomainError & { message: string }> {
    const strategyResult = TemplateResolutionStrategyFactory.createStrategy(
      templateConfig,
    );
    if (!strategyResult.ok) {
      return strategyResult;
    }

    const strategy = strategyResult.data;

    // Use strategy pattern to determine template path extraction
    // Explicit strategy should return the path, schema-derived should return undefined
    if (strategy instanceof ExplicitTemplateStrategy) {
      // For explicit strategy, return the template path directly
      return ok((templateConfig as { templatePath: string }).templatePath);
    } else {
      // For schema-derived strategy, return undefined (will be derived later)
      return ok(undefined);
    }
  }

  /**
   * Determine processing mode using strategy pattern
   * Eliminates hardcoded kind comparisons
   */
  private determineMode(
    config: PipelineConfig,
  ): "sequential" | "parallel" | "adaptive" {
    const hasTemplate = this.hasTemplateConfiguration(config.templateConfig);

    if (!config.schemaPath) {
      return "sequential"; // template-only -> sequential
    }
    if (!hasTemplate) {
      return "sequential"; // validation-only -> sequential
    }
    return "sequential"; // standard -> sequential (default)
  }

  /**
   * Check if template configuration provides a template
   * Uses strategy pattern to avoid hardcoded kind comparisons
   */
  private hasTemplateConfiguration(templateConfig: TemplateConfig): boolean {
    // All current template config kinds provide templates
    // This method replaces hardcoded kind === "explicit" || kind === "schema-derived"
    const strategyResult = TemplateResolutionStrategyFactory.createStrategy(
      templateConfig,
    );
    return strategyResult.ok;
  }

  /**
   * Calculate memory variance percentage
   */
  private calculateMemoryVariance(_memoryDelta: number): number {
    if (!this.processingContext) {
      return 0;
    }

    // Use the variance percentage from thresholds
    return this.processingContext.strategyConfig
      .getPerformanceThresholds().maxMemoryVariancePct;
  }

  /**
   * Calculate throughput variance percentage
   */
  private calculateThroughputVariance(_executionTime: number): number {
    if (!this.processingContext) {
      return 0;
    }

    // Use the variance percentage from thresholds
    return this.processingContext.strategyConfig
      .getPerformanceThresholds().maxThroughputVariancePct;
  }
}
