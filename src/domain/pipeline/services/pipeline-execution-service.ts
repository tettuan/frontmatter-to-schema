import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import {
  PipelineState,
  PipelineStateFactory,
  PipelineStateGuards,
} from "../types/pipeline-state.ts";
import {
  CommandExecutionContext,
  PipelineCommand,
} from "../commands/pipeline-command.ts";
import { InitializeCommand } from "../commands/initialize-command.ts";
import { LoadSchemaCommand } from "../commands/load-schema-command.ts";
import { ResolveTemplateCommand } from "../commands/resolve-template-command.ts";
import { ProcessDocumentsCommand } from "../commands/process-documents-command.ts";
import { PrepareDataCommand } from "../commands/prepare-data-command.ts";
import { RenderOutputCommand } from "../commands/render-output-command.ts";
import { PipelineConfig } from "../../../application/services/pipeline-orchestrator.ts";

/**
 * Pipeline execution configuration
 */
export interface PipelineExecutionConfig {
  readonly maxExecutionTime: number;
  readonly enableDetailedLogging: boolean;
  readonly errorRecoveryEnabled: boolean;
}

/**
 * Pipeline execution result with detailed metrics
 */
export interface PipelineExecutionResult {
  readonly finalState: PipelineState;
  readonly executionTime: number;
  readonly stagesCompleted: string[];
  readonly commandsExecuted: string[];
  readonly metrics: Record<string, unknown>;
}

/**
 * Pipeline Execution Service following DDD and Totality principles
 * Orchestrates pipeline commands using state machine pattern
 */
export class PipelineExecutionService {
  private state: PipelineState;
  private executionStartTime: number = 0;
  private commandsExecuted: string[] = [];
  private stagesCompleted: string[] = [];

  private constructor(
    private readonly executionConfig: PipelineExecutionConfig,
    private readonly context: CommandExecutionContext,
    initialState: PipelineState,
  ) {
    this.state = initialState;
  }

  /**
   * Smart constructor for PipelineExecutionService
   */
  static create(
    pipelineConfig: PipelineConfig,
    executionConfig: PipelineExecutionConfig,
    context: CommandExecutionContext,
  ): Result<PipelineExecutionService, DomainError & { message: string }> {
    // Validate execution configuration
    const configValidation = PipelineExecutionService.validateExecutionConfig(
      executionConfig,
    );
    if (!configValidation.ok) {
      return configValidation;
    }

    // Create initial state
    const initialState = PipelineStateFactory.createInitializing(
      pipelineConfig,
    );

    return ok(
      new PipelineExecutionService(
        executionConfig,
        context,
        initialState,
      ),
    );
  }

  /**
   * Execute the entire pipeline from start to completion
   */
  async executePipeline(): Promise<
    Result<PipelineExecutionResult, DomainError & { message: string }>
  > {
    this.executionStartTime = Date.now();
    this.commandsExecuted = [];
    this.stagesCompleted = [];

    try {
      // Execute pipeline stages in sequence
      const stages = [
        () => this.executeCommand(new InitializeCommand(this.context)),
        () => this.executeCommand(new LoadSchemaCommand(this.context)),
        () => this.executeCommand(new ResolveTemplateCommand(this.context)),
        () => this.executeCommand(new ProcessDocumentsCommand(this.context)),
        () => this.executeCommand(new PrepareDataCommand(this.context)),
        () => this.executeCommand(new RenderOutputCommand(this.context)),
      ];

      for (const stage of stages) {
        const result = await stage();
        if (!result.ok) {
          return result;
        }

        // Check if we've reached a terminal state
        if (PipelineStateGuards.isTerminal(this.state)) {
          break;
        }

        // Check execution timeout
        const currentTime = Date.now();
        if (
          currentTime - this.executionStartTime >
            this.executionConfig.maxExecutionTime
        ) {
          const timeoutState = PipelineStateFactory.createFailed(
            this.state.config,
            createError({
              kind: "PipelineExecutionError",
              content:
                `Pipeline execution exceeded maximum time of ${this.executionConfig.maxExecutionTime}ms`,
            }),
            this.state.kind,
          );
          this.state = timeoutState;
          break;
        }
      }

      // Calculate final metrics
      const totalExecutionTime = Date.now() - this.executionStartTime;
      const metrics = this.calculateExecutionMetrics(totalExecutionTime);

      const result: PipelineExecutionResult = {
        finalState: this.state,
        executionTime: totalExecutionTime,
        stagesCompleted: this.stagesCompleted,
        commandsExecuted: this.commandsExecuted,
        metrics,
      };

      return ok(result);
    } catch (error) {
      const failedState = PipelineStateFactory.createFailed(
        this.state.config,
        createError({
          kind: "PipelineExecutionError",
          content: `Unexpected error during pipeline execution: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
        this.state.kind,
      );

      this.state = failedState;

      const result: PipelineExecutionResult = {
        finalState: this.state,
        executionTime: Date.now() - this.executionStartTime,
        stagesCompleted: this.stagesCompleted,
        commandsExecuted: this.commandsExecuted,
        metrics: { error: true },
      };

      return ok(result);
    }
  }

  /**
   * Execute a single command and update state
   */
  private async executeCommand(
    command: PipelineCommand,
  ): Promise<Result<void, DomainError & { message: string }>> {
    if (!command.canExecute(this.state)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Command ${command.getName()} cannot be executed from ${this.state.kind} state`,
      }));
    }

    const commandStartTime = Date.now();

    try {
      const result = await command.execute(this.state);
      if (!result.ok) {
        return err(result.error);
      }

      // Update state and tracking
      this.state = result.data;
      this.commandsExecuted.push(command.getName());
      this.stagesCompleted.push(this.state.kind);

      const commandExecutionTime = Date.now() - commandStartTime;

      if (this.executionConfig.enableDetailedLogging) {
        // Log command execution (in real implementation, use proper logger)
        console.log(
          `[Pipeline] Executed ${command.getName()} in ${commandExecutionTime}ms, new state: ${this.state.kind}`,
        );
      }

      return ok(void 0);
    } catch (error) {
      return err(createError({
        kind: "PipelineExecutionError",
        content: `Command ${command.getName()} execution failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  /**
   * Get current pipeline state
   */
  getCurrentState(): PipelineState {
    return this.state;
  }

  /**
   * Check if pipeline execution is complete
   */
  isComplete(): boolean {
    return PipelineStateGuards.isCompleted(this.state);
  }

  /**
   * Check if pipeline execution has failed
   */
  hasFailed(): boolean {
    return PipelineStateGuards.isFailed(this.state);
  }

  /**
   * Get execution metrics
   */
  getExecutionMetrics(): Record<string, unknown> {
    const currentTime = Date.now();
    const executionTime = this.executionStartTime > 0
      ? currentTime - this.executionStartTime
      : 0;

    return {
      currentState: this.state.kind,
      executionTime,
      commandsExecuted: this.commandsExecuted,
      stagesCompleted: this.stagesCompleted,
      isComplete: this.isComplete(),
      hasFailed: this.hasFailed(),
    };
  }

  /**
   * Validate execution configuration
   */
  private static validateExecutionConfig(
    config: PipelineExecutionConfig,
  ): Result<void, DomainError & { message: string }> {
    if (config.maxExecutionTime <= 0) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Max execution time must be positive",
      }));
    }

    if (config.maxExecutionTime > 600000) { // 10 minutes
      return err(createError({
        kind: "ConfigurationError",
        message: "Max execution time cannot exceed 10 minutes",
      }));
    }

    return ok(void 0);
  }

  /**
   * Calculate detailed execution metrics
   */
  private calculateExecutionMetrics(
    totalTime: number,
  ): Record<string, unknown> {
    return {
      totalExecutionTime: totalTime,
      averageCommandTime: this.commandsExecuted.length > 0
        ? totalTime / this.commandsExecuted.length
        : 0,
      stageTransitions: this.stagesCompleted.length,
      finalState: this.state.kind,
      successfulCompletion: PipelineStateGuards.isCompleted(this.state),
      errorRecoveryAttempts: 0, // Will be implemented in future iterations
    };
  }
}
