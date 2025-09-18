import { Result } from "../../../domain/shared/types/result.ts";
import { DomainError } from "../../../domain/shared/types/errors.ts";
import { PipelineState } from "../types/pipeline-state.ts";
import { Schema } from "../../../domain/schema/entities/schema.ts";

/**
 * Base interface for pipeline commands following command pattern
 * All commands return Result<PipelineState, DomainError> for consistent error handling
 */
export interface PipelineCommand {
  /**
   * Execute the command with the current pipeline state
   * Returns the new state or an error
   */
  execute(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>>;

  /**
   * Get the command name for logging and debugging
   */
  getName(): string;

  /**
   * Validate that the command can be executed with the current state
   */
  canExecute(currentState: PipelineState): boolean;
}

/**
 * Command execution context for dependency injection
 */
export interface CommandExecutionContext {
  // Schema operations
  loadSchema(schemaPath: string): Promise<Result<Schema, DomainError>>;

  // Template operations
  resolveTemplatePaths(
    schema: unknown,
    config: unknown,
  ): Result<unknown, DomainError>;

  // Document processing
  transformDocuments(
    inputPattern: string,
    validationRules: unknown[],
    schema: unknown,
    options?: unknown,
  ): Promise<Result<unknown[], DomainError>>;

  // Data preparation
  extractItemsData(
    schema: unknown,
    processedData: unknown[],
  ): Promise<Result<unknown[], DomainError>>;

  // Output rendering
  renderOutput(
    templatePath: string,
    itemsTemplatePath: string | undefined,
    mainData: unknown[],
    itemsData: unknown[] | undefined,
    outputPath: string,
    outputFormat: string,
    verbosityMode: unknown,
  ): Promise<Result<void, DomainError>>;
}

/**
 * Command result with state transition and metadata
 */
export interface CommandResult {
  readonly newState: PipelineState;
  readonly executionTime: number;
  readonly metadata?: Record<string, unknown>;
}
