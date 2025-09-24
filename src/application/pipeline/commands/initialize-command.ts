import { err, ok, Result } from "../../../domain/shared/types/result.ts";
import {
  createError,
  DomainError,
} from "../../../domain/shared/types/errors.ts";
import { CommandExecutionContext } from "./pipeline-command.ts";
import { BasePipelineCommand } from "./base-pipeline-command.ts";
import {
  PipelineState,
  PipelineStateFactory,
  PipelineStateGuards,
} from "../types/pipeline-state.ts";
import { PipelineConfigAccessor } from "../../shared/utils/pipeline-config-accessor.ts";

/**
 * Initialize command - Sets up strategy and configuration
 * Transitions from initializing -> schema-loading
 */
export class InitializeCommand extends BasePipelineCommand {
  constructor(
    context: CommandExecutionContext,
  ) {
    super(context);
  }

  getName(): string {
    return "InitializeCommand";
  }

  canExecute(currentState: PipelineState): boolean {
    return PipelineStateGuards.isInitializing(currentState);
  }

  protected async executeInternal(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>> {
    // Use type guard to ensure proper state access
    if (!PipelineStateGuards.isInitializing(currentState)) {
      return Promise.resolve(err(createError({
        kind: "ConfigurationError",
        message: "Invalid state for initialization",
      })));
    }
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
        initializationTime: Date.now() - initializingState.startTime,
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
    // Validate required fields using safe accessors
    const schemaPathResult = PipelineConfigAccessor.getSchemaPath(config);
    if (!schemaPathResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Pipeline configuration must include a valid schemaPath",
      }));
    }

    const inputPatternResult = PipelineConfigAccessor.getInputPattern(config);
    if (!inputPatternResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Pipeline configuration must include a valid inputPattern",
      }));
    }

    const outputPathResult = PipelineConfigAccessor.getOutputPath(config);
    if (!outputPathResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Pipeline configuration must include a valid outputPath",
      }));
    }

    return ok(void 0);
  }
}
