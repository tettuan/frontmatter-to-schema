import { err, ok, Result } from "../../../domain/shared/types/result.ts";
import {
  createError,
  DomainError,
} from "../../../domain/shared/types/errors.ts";
import { SafePropertyAccess } from "../../../domain/shared/utils/safe-property-access.ts";
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
    // Use type guard to ensure proper state access
    if (!PipelineStateGuards.isTemplateResolving(currentState)) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Invalid state for template resolution",
      }));
    }
    const templateResolvingState = currentState;

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

      // Safely convert template result to expected structure
      const templateConfigResult = SafePropertyAccess.asRecord(
        templateResult.data,
      );
      if (!templateConfigResult.ok) {
        const failedState = PipelineStateFactory.createFailed(
          config,
          createError({
            kind: "ConfigurationError",
            message:
              `Template configuration is not a valid object: ${templateConfigResult.error.message}`,
          }),
          "template-resolving",
          { schema },
        );
        return ok(failedState);
      }
      const templateConfig = templateConfigResult.data;

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
        templateResolvingState.resolutionStartTime;

      // Log template resolution success
      const _resolutionMetrics = {
        templatePath: templateConfig.templatePath,
        itemsTemplatePath: templateConfig.itemsTemplatePath,
        outputFormat: templateConfig.outputFormat,
        resolutionTime,
      };

      // Transition to document processing state - safely extract string values
      const templatePath = typeof templateConfig.templatePath === "string"
        ? templateConfig.templatePath
        : "";
      const itemsTemplatePath =
        typeof templateConfig.itemsTemplatePath === "string"
          ? templateConfig.itemsTemplatePath
          : undefined;
      const outputFormat = typeof templateConfig.outputFormat === "string"
        ? templateConfig.outputFormat
        : "";

      const newState = PipelineStateFactory.createDocumentProcessing(
        config,
        schema,
        templatePath,
        itemsTemplatePath,
        outputFormat,
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

    const configResult = SafePropertyAccess.asRecord(templateConfig);
    if (!configResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Template configuration is not a valid object: ${configResult.error.message}`,
      }));
    }
    const typedConfig = configResult.data;

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
