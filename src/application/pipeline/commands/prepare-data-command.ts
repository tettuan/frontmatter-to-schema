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

/**
 * Prepare Data command - Extracts and prepares data for template rendering
 * Transitions from data-preparing -> output-rendering
 */
export class PrepareDataCommand extends BasePipelineCommand {
  constructor(
    context: CommandExecutionContext,
  ) {
    super(context);
  }

  getName(): string {
    return "PrepareDataCommand";
  }

  canExecute(currentState: PipelineState): boolean {
    return PipelineStateGuards.isDataPreparing(currentState);
  }

  protected async executeInternal(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>> {
    // DEBUG: PrepareDataCommand execution started (no logging available in context)

    // State is data-preparing, so we can safely access all required fields
    // Use type guard to ensure proper state access
    if (!PipelineStateGuards.isDataPreparing(currentState)) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Invalid state for data preparation",
      }));
    }
    const dataPreparingState = currentState;

    try {
      // Extract required data from current state
      const config = dataPreparingState.config;
      const schema = dataPreparingState.schema;
      const templatePath = dataPreparingState.templatePath;
      const itemsTemplatePath = dataPreparingState.itemsTemplatePath;
      const outputFormat = dataPreparingState.outputFormat;
      const processedDocuments = dataPreparingState.processedDocuments;

      // DEBUG: Check for schema defaults before data preparation (debug variables removed for lint compliance)

      // Prepare main data from processed documents
      const mainData = processedDocuments;

      // Extract items data if items template is configured
      let itemsData: unknown[] | undefined = undefined;
      if (itemsTemplatePath) {
        const itemsResult = await this.context.extractItemsData(
          schema,
          processedDocuments,
        );

        if (!itemsResult.ok) {
          // Create failed state with partial data
          const failedState = PipelineStateFactory.createFailed(
            config,
            itemsResult.error,
            "data-preparing",
            {
              kind: "documents-processed",
              schema,
              templatePath,
              processedDocuments,
            },
          );
          return ok(failedState);
        }

        itemsData = itemsResult.data;

        // Validate items data
        const itemsValidation = await Promise.resolve(
          this.validateItemsData(itemsData),
        );
        if (!itemsValidation.ok) {
          const failedState = PipelineStateFactory.createFailed(
            config,
            itemsValidation.error,
            "data-preparing",
            {
              kind: "documents-processed",
              schema,
              templatePath,
              processedDocuments,
            },
          );
          return ok(failedState);
        }
      }

      // Validate main data
      const mainDataValidation = await Promise.resolve(
        this.validateMainData(mainData),
      );
      if (!mainDataValidation.ok) {
        const failedState = PipelineStateFactory.createFailed(
          config,
          mainDataValidation.error,
          "data-preparing",
          {
            kind: "documents-processed",
            schema,
            templatePath,
            processedDocuments,
          },
        );
        return ok(failedState);
      }

      // Calculate preparation time
      const preparationTime = Date.now() -
        dataPreparingState.preparationStartTime;

      // Log data preparation success
      const _preparationMetrics = {
        mainDataEntries: mainData.length,
        itemsDataEntries: itemsData?.length ?? 0,
        hasItemsData: itemsData !== undefined,
        preparationTime,
      };

      // Convert itemsData to proper discriminated union format
      const itemsDataState = itemsData
        ? { kind: "available" as const, data: itemsData }
        : { kind: "not-available" as const };

      // Transition to output rendering state
      const newState = PipelineStateFactory.createOutputRendering(
        config,
        schema,
        templatePath,
        itemsTemplatePath,
        outputFormat,
        mainData,
        itemsDataState,
      );

      return ok(newState);
    } catch (error) {
      const failedState = PipelineStateFactory.createFailed(
        dataPreparingState.config,
        createError(
          {
            kind: "PipelineExecutionError",
            content: `Data preparation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ),
        "data-preparing",
        {
          kind: "documents-processed",
          schema: dataPreparingState.schema,
          templatePath: dataPreparingState.templatePath,
          processedDocuments: dataPreparingState.processedDocuments,
        },
      );
      return ok(failedState);
    }
  }

  private validateMainData(
    mainData: unknown[],
  ): Result<void, DomainError & { message: string }> {
    // Basic main data validation
    if (!Array.isArray(mainData)) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Main data must be an array",
      }));
    }

    if (mainData.length === 0) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Main data cannot be empty",
      }));
    }

    return ok(void 0);
  }

  private validateItemsData(
    itemsData: unknown[] | undefined,
  ): Result<void, DomainError & { message: string }> {
    // Items data is optional, so undefined is valid
    if (itemsData === undefined) {
      return ok(void 0);
    }

    // If provided, items data must be an array
    if (!Array.isArray(itemsData)) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Items data must be an array if provided",
      }));
    }

    // Empty items data is allowed
    return ok(void 0);
  }
}
