import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import {
  CommandExecutionContext,
  PipelineCommand,
} from "./pipeline-command.ts";
import {
  PipelineState,
  PipelineStateFactory,
  PipelineStateGuards,
} from "../types/pipeline-state.ts";

/**
 * Initialize command - Sets up strategy and configuration
 * Transitions from initializing -> schema-loading
 */
export class InitializeCommand implements PipelineCommand {
  constructor(
    private readonly context: CommandExecutionContext,
  ) {}

  getName(): string {
    return "InitializeCommand";
  }

  canExecute(currentState: PipelineState): boolean {
    return PipelineStateGuards.isInitializing(currentState);
  }

  async execute(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>> {
    if (!this.canExecute(currentState)) {
      return Promise.resolve(err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot execute InitializeCommand from ${currentState.kind} state`,
      })));
    }

    // State is initializing, so we can safely access config
    const initializingState = currentState;

    try {
      // Validate configuration
      const configValidation = await Promise.resolve(
        this.validatePipelineConfig(
          initializingState.config,
        ),
      );
      if (!configValidation.ok) {
        return Promise.resolve(err(configValidation.error));
      }

      // Initialize strategy configuration if not provided
      const config = initializingState.config;
      const hasStrategyConfig = config.strategyConfig !== undefined;

      // Log initialization progress
      const _initializationMetrics = {
        configValidated: true,
        hasStrategyConfig,
        initializationTime: Date.now() -
          (initializingState as Extract<
            PipelineState,
            { kind: "initializing" }
          >).startTime,
      };

      // Transition to schema loading state
      const newState = PipelineStateFactory.createSchemaLoading(config);

      return Promise.resolve(ok(newState));
    } catch (error) {
      return Promise.resolve(err(createError({
        kind: "ConfigurationError",
        message: `Pipeline initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      })));
    }
  }

  private validatePipelineConfig(
    config: unknown,
  ): Result<void, DomainError & { message: string }> {
    // Basic configuration validation
    if (!config || typeof config !== "object") {
      return err(createError({
        kind: "ConfigurationError",
        message: "Pipeline configuration is required and must be an object",
      }));
    }

    const typedConfig = config as Record<string, unknown>;

    // Validate required fields
    if (!typedConfig.schemaPath || typeof typedConfig.schemaPath !== "string") {
      return err(createError({
        kind: "ConfigurationError",
        message: "Pipeline configuration must include a valid schemaPath",
      }));
    }

    if (
      !typedConfig.inputPattern || typeof typedConfig.inputPattern !== "string"
    ) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Pipeline configuration must include a valid inputPattern",
      }));
    }

    if (!typedConfig.outputPath || typeof typedConfig.outputPath !== "string") {
      return err(createError({
        kind: "ConfigurationError",
        message: "Pipeline configuration must include a valid outputPath",
      }));
    }

    return ok(void 0);
  }
}
