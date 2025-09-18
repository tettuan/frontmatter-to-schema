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
 * Resolve Template command - Resolves template paths and output format
 * Transitions from template-resolving -> document-processing
 */
export class ResolveTemplateCommand implements PipelineCommand {
  constructor(
    private readonly context: CommandExecutionContext,
  ) {}

  getName(): string {
    return "ResolveTemplateCommand";
  }

  canExecute(currentState: PipelineState): boolean {
    return PipelineStateGuards.isTemplateResolving(currentState);
  }

  async execute(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>> {
    if (!this.canExecute(currentState)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot execute ResolveTemplateCommand from ${currentState.kind} state`,
      }));
    }

    // State is template-resolving, so we can safely access config and schema
    const templateResolvingState = currentState as Extract<
      PipelineState,
      { kind: "template-resolving" }
    >;

    try {
      // Extract config and schema from current state
      const config = templateResolvingState.config;
      const schema = templateResolvingState.schema;

      // Resolve template paths using context
      const templateResult = this.context.resolveTemplatePaths(schema, config);
      if (!templateResult.ok) {
        // Create failed state with partial data
        const failedState = PipelineStateFactory.createFailed(
          config,
          templateResult.error,
          "template-resolving",
          { schema },
        );
        return ok(failedState);
      }

      const templateConfig = templateResult.data as {
        templatePath: string;
        itemsTemplatePath?: string;
        outputFormat: string;
      };

      // Validate template configuration
      const templateValidation = await Promise.resolve(
        this.validateTemplateConfig(templateConfig),
      );
      if (!templateValidation.ok) {
        const failedState = PipelineStateFactory.createFailed(
          config,
          templateValidation.error,
          "template-resolving",
          { schema },
        );
        return ok(failedState);
      }

      // Calculate resolution time
      const resolutionTime = Date.now() -
        (templateResolvingState as Extract<
          PipelineState,
          { kind: "template-resolving" }
        >).resolutionStartTime;

      // Log template resolution success
      const _resolutionMetrics = {
        templatePath: templateConfig.templatePath,
        itemsTemplatePath: templateConfig.itemsTemplatePath,
        outputFormat: templateConfig.outputFormat,
        resolutionTime,
      };

      // Transition to document processing state
      const newState = PipelineStateFactory.createDocumentProcessing(
        config,
        schema,
        templateConfig.templatePath,
        templateConfig.itemsTemplatePath,
        templateConfig.outputFormat,
      );

      return ok(newState);
    } catch (error) {
      const failedState = PipelineStateFactory.createFailed(
        templateResolvingState.config,
        createError(
          {
            kind: "ConfigurationError",
            message: `Template resolution failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ),
        "template-resolving",
        { schema: templateResolvingState.schema },
      );
      return ok(failedState);
    }
  }

  private validateTemplateConfig(
    templateConfig: unknown,
  ): Result<void, DomainError & { message: string }> {
    // Basic template configuration validation
    if (!templateConfig || typeof templateConfig !== "object") {
      return err(createError({
        kind: "ConfigurationError",
        message: "Template configuration is required and must be an object",
      }));
    }

    const typedConfig = templateConfig as Record<string, unknown>;

    // Validate required fields
    if (
      !typedConfig.templatePath || typeof typedConfig.templatePath !== "string"
    ) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Template configuration must include a valid templatePath",
      }));
    }

    if (
      !typedConfig.outputFormat || typeof typedConfig.outputFormat !== "string"
    ) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Template configuration must include a valid outputFormat",
      }));
    }

    // itemsTemplatePath is optional, so we only validate if it exists
    if (
      typedConfig.itemsTemplatePath !== undefined &&
      typeof typedConfig.itemsTemplatePath !== "string"
    ) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          "Template configuration itemsTemplatePath must be a string if provided",
      }));
    }

    return ok(void 0);
  }
}
