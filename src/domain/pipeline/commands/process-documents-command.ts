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
 * Process Documents command - Transforms and validates input documents
 * Transitions from document-processing -> data-preparing
 */
export class ProcessDocumentsCommand implements PipelineCommand {
  constructor(
    private readonly context: CommandExecutionContext,
  ) {}

  getName(): string {
    return "ProcessDocumentsCommand";
  }

  canExecute(currentState: PipelineState): boolean {
    return PipelineStateGuards.isDocumentProcessing(currentState);
  }

  async execute(
    currentState: PipelineState,
  ): Promise<Result<PipelineState, DomainError & { message: string }>> {
    if (!this.canExecute(currentState)) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Cannot execute ProcessDocumentsCommand from ${currentState.kind} state`,
      }));
    }

    // State is document-processing, so we can safely access all required fields
    const documentProcessingState = currentState as Extract<
      PipelineState,
      { kind: "document-processing" }
    >;

    try {
      // Extract required data from current state
      const config = documentProcessingState.config;
      const schema = documentProcessingState.schema;
      const templatePath = documentProcessingState.templatePath;
      const itemsTemplatePath = documentProcessingState.itemsTemplatePath;
      const outputFormat = documentProcessingState.outputFormat;

      // Extract input pattern from config
      const inputPattern = (config as any).inputPattern as string;

      // Create validation rules (in real implementation, these would come from schema)
      const validationRules: unknown[] = [];

      // Transform documents using context
      const documentsResult = await this.context.transformDocuments(
        inputPattern,
        validationRules,
        schema,
      );

      if (!documentsResult.ok) {
        // Create failed state with partial data
        const failedState = PipelineStateFactory.createFailed(
          config,
          documentsResult.error,
          "document-processing",
          {
            schema,
            templatePath,
          },
        );
        return ok(failedState);
      }

      const processedDocuments = documentsResult.data;

      // Validate processed documents
      const documentsValidation = await Promise.resolve(
        this.validateProcessedDocuments(processedDocuments),
      );
      if (!documentsValidation.ok) {
        const failedState = PipelineStateFactory.createFailed(
          config,
          documentsValidation.error,
          "document-processing",
          {
            schema,
            templatePath,
          },
        );
        return ok(failedState);
      }

      // Calculate processing time
      const processingTime = Date.now() -
        (documentProcessingState as Extract<
          PipelineState,
          { kind: "document-processing" }
        >).processingStartTime;

      // Log document processing success
      const _processingMetrics = {
        documentsProcessed: processedDocuments.length,
        inputPattern,
        processingTime,
        validationRulesApplied: validationRules.length,
      };

      // Transition to data preparing state
      const newState = PipelineStateFactory.createDataPreparing(
        config,
        schema,
        templatePath,
        itemsTemplatePath,
        outputFormat,
        processedDocuments,
      );

      return ok(newState);
    } catch (error) {
      const failedState = PipelineStateFactory.createFailed(
        documentProcessingState.config,
        createError(
          {
            kind: "PipelineExecutionError",
            content: `Document processing failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ),
        "document-processing",
        {
          schema: documentProcessingState.schema,
          templatePath: documentProcessingState.templatePath,
        },
      );
      return ok(failedState);
    }
  }

  private validateProcessedDocuments(
    processedDocuments: unknown[],
  ): Result<void, DomainError & { message: string }> {
    // Basic processed documents validation
    if (!Array.isArray(processedDocuments)) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Processed documents must be an array",
      }));
    }

    if (processedDocuments.length === 0) {
      return err(createError({
        kind: "ConfigurationError",
        message: "No documents were processed - input pattern may be invalid",
      }));
    }

    // Validate each document has required structure
    for (let i = 0; i < processedDocuments.length; i++) {
      const doc = processedDocuments[i];
      if (!doc || typeof doc !== "object") {
        return err(createError({
          kind: "ConfigurationError",
          message: `Document at index ${i} is not a valid object`,
        }));
      }
    }

    return ok(void 0);
  }
}
