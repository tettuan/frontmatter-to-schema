/**
 * Transformation Pipeline - Document Processing and Template Application
 * Following DDD principles and Totality patterns
 * Part of Application Layer - Document Processing Context
 */

import {
  createDomainError,
  createProcessingStageError,
  type DomainError,
  isOk,
  type Result,
} from "../../domain/core/result.ts";
import {
  getConfig,
  getKind,
  getSupports,
} from "../../domain/core/type-guards.ts";
import type { Document } from "../../domain/models/entities.ts";
import type { Schema } from "../../domain/models/entities.ts";
import type { Template } from "../../domain/models/domain-models.ts";
import {
  ExtractedData,
  TransformationContext,
  TransformationResult,
} from "../../domain/models/transformation.ts";
import type {
  TemplateProcessingContext,
  UnifiedTemplateProcessor,
} from "../../domain/template/services/unified-template-processor.ts";
import type { SchemaValidator } from "../../domain/services/schema-validator.ts";
import type { ProcessingConfiguration } from "../configuration.ts";

/**
 * Type guard for validating unknown data as Record<string, unknown>
 * Eliminates type assertions following Totality principles
 */
function isValidRecordData(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" &&
    data !== null &&
    !Array.isArray(data);
}

/**
 * Document transformation pipeline service
 * Handles core document processing logic following Frontmatter Context boundaries
 */
export class TransformationPipeline {
  constructor(
    private readonly schemaValidator: SchemaValidator,
    private readonly templateProcessor: UnifiedTemplateProcessor,
  ) {}

  /**
   * Transform a single document through the complete pipeline
   * Follows Smart Constructor pattern with Result types
   */
  transformDocument(
    document: Document,
    schema: Schema,
    extractionPrompt?: string,
    mappingPrompt?: string,
  ): Result<TransformationResult, DomainError> {
    const context = TransformationContext.create(
      document,
      schema,
      extractionPrompt,
      mappingPrompt,
    );

    // Extract data using AI if prompts are provided
    let extractedData: ExtractedData;

    // Use totality-compliant getFrontMatter()
    const frontMatterResult = document.getFrontMatter();
    if (isOk(frontMatterResult)) {
      const frontMatter = frontMatterResult.data;
      const contentJson = frontMatter.getContent().toJSON();
      extractedData = ExtractedData.create(
        isValidRecordData(contentJson) ? contentJson : {},
      );
    } else {
      // No frontmatter present or error occurred
      extractedData = ExtractedData.create({});
    }

    // Validate against schema directly
    const validationResult = this.schemaValidator.validate(
      extractedData.getData(),
      schema,
    );

    if (!validationResult.ok) {
      return validationResult;
    }

    const validatedData = validationResult.data;

    const transformationResult = TransformationResult.create(
      context,
      extractedData,
      validatedData,
    );

    return { ok: true, data: transformationResult };
  }

  /**
   * Apply template mapping following Totality principle
   * Integrates UnifiedTemplateProcessor for proper variable substitution
   */
  applyTemplateMapping(
    data: unknown[],
    template: Template,
    format: "json" | "yaml" | "xml" | "custom",
  ): Result<string, DomainError> {
    try {
      // Get template content from Template entity
      const templateContent = template.getDefinition().getDefinition();

      // Prepare data for template processing with field mapping
      const processedItems: Record<string, unknown>[] = [];

      for (const item of data) {
        if (isValidRecordData(item)) {
          // Apply field mapping from frontmatter fields to template variables
          const mappedItem: Record<string, unknown> = {};

          // Map domain/action/target to c1/c2/c3 for legacy template compatibility
          if (item.domain) mappedItem.c1 = item.domain;
          if (item.action) mappedItem.c2 = item.action;
          if (item.target) mappedItem.c3 = item.target;

          // Map other standard fields directly
          if (item.title) mappedItem.title = item.title;
          if (item.description) mappedItem.description = item.description;
          if (item.usage) mappedItem.usage = item.usage;

          // Handle options mapping
          if (item.config) {
            const configResult = getConfig(item, "mappingItem");
            if (!configResult.ok) {
              return {
                ok: false,
                error: createProcessingStageError(
                  "ConfigMapping",
                  configResult.error,
                ),
              };
            }
            const config = configResult.data;

            // Safe supports extraction
            const supportsResult = getSupports(config, "mappingItem.config");
            const supports = supportsResult.ok ? supportsResult.data : {};

            mappedItem.options = {
              input: config.input_formats || [],
              adaptation: config.processing_modes || [],
              file: supports.file_input ? [true] : [false],
              stdin: supports.stdin_input ? [true] : [false],
              destination: supports.output_destination ? [true] : [false],
            };
          }

          processedItems.push(mappedItem);
        }
      }

      // Create template processing context using SimpleReplacement approach
      const processingContext: TemplateProcessingContext = {
        kind: "SimpleReplacement",
        data: processedItems.length === 1
          ? processedItems[0]
          : { items: processedItems },
        placeholderPattern: "brace", // Handles {variable} patterns like {c1}, {c2}
      };

      // Process template using UnifiedTemplateProcessor
      const templateResult = this.templateProcessor.process(
        templateContent,
        processingContext,
      );

      // Handle template processing result following Totality principle
      if (this.isDomainError(templateResult)) {
        const errorMessage = ("message" in templateResult &&
            typeof templateResult.message === "string")
          ? templateResult.message
          : JSON.stringify(templateResult);
        return {
          ok: false,
          error: createDomainError({
            kind: "TemplateMappingFailed",
            template,
            source: data,
          }, `Template processing failed: ${errorMessage}`),
        };
      }

      // Extract content from successful result
      const processedContent = templateResult.content;

      // Apply format-specific serialization to processed content
      let outputString: string;

      if (format === "json") {
        // If template already produced JSON-like content, use it directly
        try {
          // Validate that it's proper JSON
          JSON.parse(processedContent);
          outputString = processedContent;
        } catch {
          // Fallback to JSON stringification if template didn't produce valid JSON
          outputString = JSON.stringify({ content: processedContent }, null, 2);
        }
      } else if (format === "yaml") {
        // For YAML, convert the processed content appropriately
        outputString = this.convertToYaml({ content: processedContent }, 0);
      } else if (format === "xml") {
        // For XML, convert the processed content appropriately
        outputString = this.convertToXml({ content: processedContent });
      } else {
        // Default for "custom" and others - use processed content directly
        outputString = processedContent;
      }

      return { ok: true, data: outputString };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template,
          source: data,
        }, `Failed to apply template mapping: ${String(error)}`),
      };
    }
  }

  /**
   * Get extraction prompt from processing configuration
   */
  getExtractionPrompt(processing: ProcessingConfiguration): string | undefined {
    switch (processing.kind) {
      case "CustomPrompts":
        return processing.extractionPrompt;
      case "FullCustom":
        return processing.extractionPrompt;
      case "BasicProcessing":
      case "ParallelProcessing":
        return undefined;
      default: {
        // Exhaustive check for ProcessingConfiguration
        const _exhaustive: never = processing;
        return undefined;
      }
    }
  }

  /**
   * Get mapping prompt from processing configuration
   */
  getMappingPrompt(processing: ProcessingConfiguration): string | undefined {
    switch (processing.kind) {
      case "CustomPrompts":
        return processing.mappingPrompt;
      case "FullCustom":
        return processing.mappingPrompt;
      case "BasicProcessing":
      case "ParallelProcessing":
        return undefined;
      default: {
        // Exhaustive check for ProcessingConfiguration
        const _exhaustive: never = processing;
        return undefined;
      }
    }
  }

  /**
   * Determine if processing should continue on error
   */
  shouldContinueOnError(processing: ProcessingConfiguration): boolean {
    switch (processing.kind) {
      case "ParallelProcessing":
        return processing.continueOnError;
      case "FullCustom":
        return processing.continueOnError;
      case "BasicProcessing":
      case "CustomPrompts":
        return false;
      default: {
        // Exhaustive check for ProcessingConfiguration
        const _exhaustive: never = processing;
        return false;
      }
    }
  }

  /**
   * Type guard to check if a value is a DomainError
   */
  private isDomainError(value: unknown): value is DomainError {
    if (typeof value !== "object" || value === null || !("kind" in value)) {
      return false;
    }

    const kindResult = getKind(value, "isDomainError");
    if (!kindResult.ok) {
      return false;
    }
    const kind = kindResult.data;
    // Template processing success result has kind: "Success", not an error
    if (kind === "Success") {
      return false;
    }

    // Check for known DomainError patterns
    return typeof kind === "string" && kind.length > 0;
  }

  /**
   * Convert data to YAML format
   */
  private convertToYaml(data: unknown, indent: number): string {
    const indentStr = "  ".repeat(indent);

    if (data === null || data === undefined) {
      return "null";
    }

    if (typeof data === "string") {
      return `"${data.replace(/"/g, '\\"')}"`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return "[]";
      }
      return data
        .map((item) => `${indentStr}- ${this.convertToYaml(item, indent + 1)}`)
        .join("\n");
    }

    if (typeof data === "object") {
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return "{}";
      }
      return entries
        .map(([key, value]) =>
          `${indentStr}${key}: ${this.convertToYaml(value, indent + 1)}`
        )
        .join("\n");
    }

    return String(data);
  }

  /**
   * Convert data to XML format
   */
  private convertToXml(data: unknown): string {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return `<root>${String(data)}</root>`;
    }

    const entries = Object.entries(data);
    const xmlContent = entries.map(([key, value]) => {
      if (
        typeof value === "object" && value !== null && !Array.isArray(value)
      ) {
        return `<${key}>${
          this.convertToXml(value).replace(/<\/?root>/g, "")
        }</${key}>`;
      }
      return `<${key}>${String(value)}</${key}>`;
    }).join("");

    return `<root>${xmlContent}</root>`;
  }
}
