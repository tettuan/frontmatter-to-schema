import { err, ok, Result } from "../../../domain/shared/types/result.ts";
import {
  createError,
  DomainError,
} from "../../../domain/shared/types/errors.ts";
import {
  CommandExecutionContext,
  PipelineCommand,
} from "./pipeline-command.ts";
import { PipelineState } from "../types/pipeline-state.ts";

/**
 * Base abstract class for pipeline commands with common error handling
 * Implements DRY principle by extracting duplicate validation logic
 */
export abstract class BasePipelineCommand implements PipelineCommand {
  constructor(
    protected readonly context: CommandExecutionContext,
  ) {}

  /**
   * Template method for command execution with common validation
   */
  async execute(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>> {
    // Common state validation
    const validationResult = this.validateExecutionState(currentState);
    if (!validationResult.ok) {
      return validationResult;
    }

    // Delegate to concrete implementation
    return await this.executeInternal(currentState);
  }

  /**
   * Common validation logic extracted from all commands
   * Returns error if command cannot execute from current state
   */
  protected validateExecutionState(
    currentState: PipelineState,
  ): Result<void, DomainError & { message: string }> {
    if (!this.canExecute(currentState)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot execute ${this.getName()} from ${currentState.kind} state`,
      }));
    }
    return ok(void 0);
  }

  /**
   * Abstract method for concrete command implementation
   * Called after state validation passes
   */
  protected abstract executeInternal(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>>;

  abstract getName(): string;
  abstract canExecute(currentState: PipelineState): boolean;
}
