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
import { Schema } from "../../schema/entities/schema.ts";

/**
 * Load Schema command - Loads and validates schema from file system
 * Transitions from schema-loading -> template-resolving
 */
export class LoadSchemaCommand implements PipelineCommand {
  constructor(
    private readonly context: CommandExecutionContext,
  ) {}

  getName(): string {
    return "LoadSchemaCommand";
  }

  canExecute(currentState: PipelineState): boolean {
    return PipelineStateGuards.isSchemaLoading(currentState);
  }

  async execute(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>> {
    if (!this.canExecute(currentState)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot execute LoadSchemaCommand from ${currentState.kind} state`,
      }));
    }

    // State is schema-loading, so we can safely access config
    const schemaLoadingState = currentState;

    try {
      // Extract schema path from config
      const config = schemaLoadingState.config;
      const schemaPath = (config as any).schemaPath as string;

      // Load schema using context
      const schemaResult = await this.context.loadSchema(schemaPath);
      if (!schemaResult.ok) {
        // Create failed state with partial data
        const failedState = PipelineStateFactory.createFailed(
          config,
          schemaResult.error,
          "schema-loading",
        );
        return ok(failedState);
      }

      // Cast to Schema entity (in real implementation, this would be proper validation)
      const schema = schemaResult.data as Schema;

      // Validate schema is properly loaded
      const schemaValidation = this.validateLoadedSchema(schema);
      if (!schemaValidation.ok) {
        const failedState = PipelineStateFactory.createFailed(
          config,
          schemaValidation.error,
          "schema-loading",
        );
        return ok(failedState);
      }

      // Calculate loading time
      const loadingTime = Date.now() -
        (schemaLoadingState as Extract<
          PipelineState,
          { kind: "schema-loading" }
        >).loadingStartTime;

      // Log schema loading success
      const _loadingMetrics = {
        schemaPath,
        loadingTime,
        schemaValidated: true,
      };

      // Transition to template resolving state
      const newState = PipelineStateFactory.createTemplateResolving(
        config,
        schema,
      );

      return ok(newState);
    } catch (error) {
      const failedState = PipelineStateFactory.createFailed(
        schemaLoadingState.config,
        createError(
          {
            kind: "SchemaNotFound",
            path: (schemaLoadingState.config as any).schemaPath,
          },
          `Schema loading failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
        "schema-loading",
      );
      return ok(failedState);
    }
  }

  private validateLoadedSchema(
    schema: Schema,
  ): Result<void, DomainError & { message: string }> {
    // Basic schema validation
    if (!schema) {
      return err(createError({
        kind: "InvalidSchema",
        message: "Loaded schema is null or undefined",
      }));
    }

    // Check if schema has required methods (duck typing validation)
    if (typeof schema !== "object") {
      return err(createError({
        kind: "InvalidSchema",
        message: "Loaded schema is not an object",
      }));
    }

    // In a real implementation, we would validate the schema structure
    // For now, assume it's valid if it's an object
    return ok(void 0);
  }
}
