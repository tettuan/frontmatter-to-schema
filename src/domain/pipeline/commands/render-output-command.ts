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
 * Render Output command - Renders final output using templates and data
 * Transitions from output-rendering -> completed
 */
export class RenderOutputCommand implements PipelineCommand {
  constructor(
    private readonly context: CommandExecutionContext,
  ) {}

  getName(): string {
    return "RenderOutputCommand";
  }

  canExecute(currentState: PipelineState): boolean {
    return PipelineStateGuards.isOutputRendering(currentState);
  }

  async execute(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>> {
    if (!this.canExecute(currentState)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot execute RenderOutputCommand from ${currentState.kind} state`,
      }));
    }

    // State is output-rendering, so we can safely access all required fields
    const outputRenderingState = currentState as Extract<
      PipelineState,
      { kind: "output-rendering" }
    >;

    try {
      // Extract required data from current state
      const config = outputRenderingState.config;
      const templatePath = outputRenderingState.templatePath;
      const itemsTemplatePath = outputRenderingState.itemsTemplatePath;
      const outputFormat = outputRenderingState.outputFormat;
      const mainData = outputRenderingState.mainData;
      const itemsData = outputRenderingState.itemsData;

      // Extract output path from config
      const outputPath = (config as any).outputPath as string;

      // Extract verbosity configuration
      const verbosityConfig = (config as any).verbosityConfig;
      const verbosityMode = verbosityConfig?.enabled ? "verbose" : "quiet";

      // Render output using context
      const renderResult = await this.context.renderOutput(
        templatePath,
        itemsTemplatePath,
        mainData,
        itemsData,
        outputPath,
        outputFormat,
        verbosityMode,
      );

      if (!renderResult.ok) {
        // Create failed state with partial data
        const failedState = PipelineStateFactory.createFailed(
          config,
          renderResult.error,
          "output-rendering",
          {
            schema: outputRenderingState.schema,
            templatePath,
            processedDocuments: undefined, // Not available at this stage
            mainData,
          },
        );
        return ok(failedState);
      }

      // Calculate rendering time
      const renderingTime = Date.now() -
        (outputRenderingState as Extract<
          PipelineState,
          { kind: "output-rendering" }
        >).renderingStartTime;

      // Calculate total execution time from initial state start time
      // This would need to be tracked through the pipeline, for now use rendering time
      const totalExecutionTime = renderingTime;

      // Log rendering success
      const _renderingMetrics = {
        outputPath,
        outputFormat,
        mainDataEntries: mainData.length,
        itemsDataEntries: itemsData?.length ?? 0,
        hasItemsTemplate: itemsTemplatePath !== undefined,
        renderingTime,
        verbosityMode,
      };

      // Transition to completed state
      const newState = PipelineStateFactory.createCompleted(
        config,
        totalExecutionTime,
      );

      return ok(newState);
    } catch (error) {
      const failedState = PipelineStateFactory.createFailed(
        outputRenderingState.config,
        createError(
          {
            kind: "PipelineExecutionError",
            content: `Output rendering failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ),
        "output-rendering",
        {
          schema: outputRenderingState.schema,
          templatePath: outputRenderingState.templatePath,
          mainData: outputRenderingState.mainData,
        },
      );
      return ok(failedState);
    }
  }
}
