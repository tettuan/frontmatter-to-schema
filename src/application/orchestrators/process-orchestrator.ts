import { err, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { DocumentProcessingService } from "../../domain/frontmatter/services/document-processing-service.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";

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

    const { schema, validationRules, templatePath } = schemaResult.data;

    // Validate template path exists
    if (!templatePath) {
      return err(createError({
        kind: "InvalidTemplate",
        template: "No template path specified in schema",
      }));
    }

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
    return this.outputRenderingService.renderOutput(
      resolvedTemplatePath,
      aggregatedData,
      outputPath,
    );
  }
}
