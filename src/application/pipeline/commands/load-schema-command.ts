import { err, ok, Result } from "../../../domain/shared/types/result.ts";
import {
  createError,
  DomainError,
} from "../../../domain/shared/types/errors.ts";
import {
  CommandExecutionContext,
  PipelineCommand,
} from "./pipeline-command.ts";
import {
  PipelineState,
  PipelineStateFactory,
  PipelineStateGuards,
} from "../types/pipeline-state.ts";
import { Schema } from "../../../domain/schema/entities/schema.ts";
import { PipelineConfigAccessor } from "../../shared/utils/pipeline-config-accessor.ts";

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
      // Extract schema path from config using safe accessor
      const config = schemaLoadingState.config;
      const schemaPathResult = PipelineConfigAccessor.getSchemaPath(config);
      if (!schemaPathResult.ok) {
        const failedState = PipelineStateFactory.createFailed(
          config,
          schemaPathResult.error,
          "schema-loading",
        );
        return ok(failedState);
      }
      const schemaPath = schemaPathResult.data;

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

      // schemaResult.data is already typed as Schema from loadSchema method
      const schema = schemaResult.data;

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

      // Calculate loading time using safe state access
      let loadingTime = 0;
      if (PipelineStateGuards.isSchemaLoading(schemaLoadingState)) {
        loadingTime = Date.now() - schemaLoadingState.loadingStartTime;
      } else {
        // Fallback if state is not schema-loading (shouldn't happen in normal flow)
        loadingTime = 0;
      }

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
      // Use safe accessor for error reporting
      const schemaPathResult = PipelineConfigAccessor.getSchemaPath(
        schemaLoadingState.config,
      );
      const schemaPath = schemaPathResult.ok
        ? schemaPathResult.data
        : "unknown";

      const failedState = PipelineStateFactory.createFailed(
        schemaLoadingState.config,
        createError(
          {
            kind: "SchemaNotFound",
            path: schemaPath,
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
