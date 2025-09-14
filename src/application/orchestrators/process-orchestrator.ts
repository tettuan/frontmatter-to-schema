import { err, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { DocumentProcessingService } from "../../domain/frontmatter/services/document-processing-service.ts";
import { OutputRenderingService, RenderingMode } from "../../domain/template/services/output-rendering-service.ts";

/**
 * Application orchestrator that coordinates the 3-stage processing pipeline.
 * Replaces ProcessCoordinator with cleaner separation of concerns.
 *
 * Architecture: Schema → Documents → Output
 * Each stage is handled by a dedicated domain service.
 */
export class ProcessOrchestrator {
  constructor(
    private readonly schemaProcessingService: SchemaProcessingService,
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly outputRenderingService: OutputRenderingService,
  ) {}

  /**
   * Process documents through the complete 3-stage pipeline.
   * This is the main entry point that coordinates all processing stages.
   */
  processDocuments(
    schemaPath: string,
    outputPath: string,
    inputPattern: string,
  ): Result<void, DomainError & { message: string }> {
    // Stage 1: Process Schema
    const schemaResult = this.schemaProcessingService.processSchema(schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const processedSchema = schemaResult.data;

    // Handle schema based on whether it has a template
    if (processedSchema.kind === "WithoutTemplate") {
      return err(createError({
        kind: "InvalidTemplate",
        template: "No template path specified in schema",
      }));
    }

    // Schema has template - extract data and resolve path
    const { schema, validationRules } = processedSchema;

    // Resolve template path relative to schema directory
    const resolvedTemplatePathResult = this.schemaProcessingService
      .resolveTemplatePath(
        schema,
        schemaPath,
      );
    if (!resolvedTemplatePathResult.ok) {
      return resolvedTemplatePathResult;
    }
    const resolvedTemplatePath = resolvedTemplatePathResult.data;

    // Stage 2: Process Documents
    const documentsResult = this.documentProcessingService.processDocuments(
      inputPattern,
      validationRules,
      schema,
    );
    if (!documentsResult.ok) {
      return documentsResult;
    }

    const aggregatedData = documentsResult.data;

    // Stage 3: Render Output
    const renderingMode: RenderingMode = {
      kind: "SingleData",
      data: aggregatedData,
    };

    return this.outputRenderingService.renderOutput(
      resolvedTemplatePath,
      renderingMode,
      outputPath,
    );
  }
}
