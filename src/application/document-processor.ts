import {
  createDomainError,
  createProcessingStageError,
  type DomainError,
  isOk,
  type Result,
} from "../domain/core/result.ts";
import { FILE_PATTERNS } from "../domain/constants/index.ts";
import { Document } from "../domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
} from "../domain/models/value-objects.ts";
import { Schema, SchemaId } from "../domain/models/entities.ts";
import {
  SchemaDefinition,
  SchemaVersion,
} from "../domain/models/value-objects.ts";
import {
  Template,
  TemplateDefinition,
} from "../domain/models/domain-models.ts";
import {
  BatchTransformationResult,
  ExtractedData,
  TransformationContext,
  TransformationResult,
} from "../domain/models/transformation.ts";
import type { FrontMatterExtractor } from "../domain/services/interfaces.ts";
import type { SchemaValidator } from "../domain/services/schema-validator.ts";
import { VERSION_CONFIG } from "../config/version.ts";

/**
 * Type guard for validating unknown data as Record<string, unknown>
 * Eliminates type assertions following Totality principles
 */
function isValidRecordData(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" &&
    data !== null &&
    !Array.isArray(data);
}
import type {
  TemplateProcessingContext,
  UnifiedTemplateProcessor,
} from "../domain/template/unified-template-processor.ts";
import type { FileSystemPort } from "../infrastructure/ports/index.ts";
import type {
  ApplicationConfiguration,
  InputConfiguration,
  OutputFormat,
  ProcessingConfiguration,
  SchemaFormat,
  TemplateFormat,
} from "./configuration.ts";

export class DocumentProcessor {
  constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaValidator: SchemaValidator,
    private readonly templateProcessor: UnifiedTemplateProcessor,
  ) {}

  async processDocuments(
    config: ApplicationConfiguration,
  ): Promise<Result<BatchTransformationResult, DomainError>> {
    // Load schema
    const schemaResult = this.loadSchema(config.schema);
    if (!schemaResult.ok) {
      return schemaResult;
    }
    const schema = schemaResult.data;

    // Load template
    const templateResult = this.loadTemplate(config.template);
    if (!templateResult.ok) {
      return templateResult;
    }
    const template = templateResult.data;

    // Discover documents
    const documentsResult = await this.discoverDocuments(config.input);
    if (!documentsResult.ok) {
      return documentsResult;
    }
    const documents = documentsResult.data;

    // Process each document
    const results: TransformationResult[] = [];
    const errors: Array<{ document: Document; error: DomainError }> = [];

    for (const document of documents) {
      const transformResult = await this.transformDocument(
        document,
        schema,
        this.getExtractionPrompt(config.processing),
        this.getMappingPrompt(config.processing),
      );

      if (isOk(transformResult)) {
        results.push(transformResult.data);
      } else if (this.shouldContinueOnError(config.processing)) {
        errors.push({
          document,
          error: transformResult.error,
        });
      } else {
        return transformResult;
      }
    }

    const batchResult = BatchTransformationResult.create(results, errors);

    // Generate output
    const outputResult = await this.generateOutput(
      batchResult,
      template,
      config.output,
    );

    if (!outputResult.ok) {
      return outputResult;
    }

    return { ok: true, data: batchResult };
  }

  private loadSchema(
    config: { definition: unknown; format: SchemaFormat },
  ): Result<Schema, DomainError> {
    const definitionResult = SchemaDefinition.create(
      config.definition,
      config.format.getValue(),
    );
    if (!definitionResult.ok) {
      // Convert ValidationError to DomainError
      return {
        ok: false,
        error: createProcessingStageError(
          "schema definition",
          definitionResult.error,
        ),
      };
    }

    const schemaIdResult = SchemaId.create("main-schema");
    if (!schemaIdResult.ok) {
      return {
        ok: false,
        error: createProcessingStageError(
          "schema ID creation",
          schemaIdResult.error,
        ),
      };
    }

    const schemaVersionResult = SchemaVersion.create(
      VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
    );
    if (!schemaVersionResult.ok) {
      return {
        ok: false,
        error: createProcessingStageError(
          "schema version creation",
          schemaVersionResult.error,
        ),
      };
    }

    const schemaResult = Schema.create(
      schemaIdResult.data,
      definitionResult.data,
      schemaVersionResult.data,
      "Main processing schema",
    );

    if (!schemaResult.ok) {
      return {
        ok: false,
        error: schemaResult.error,
      };
    }

    return { ok: true, data: schemaResult.data };
  }

  private loadTemplate(
    config: {
      definition: string;
      format: TemplateFormat;
    },
  ): Result<Template, DomainError> {
    const definitionResult = TemplateDefinition.create(
      config.definition,
      config.format.getValue(),
    );
    if (!definitionResult.ok) {
      return definitionResult;
    }

    const templateResult = Template.create(
      "main-template",
      definitionResult.data,
    );
    return templateResult;
  }

  private async discoverDocuments(
    config: InputConfiguration,
  ): Promise<Result<Document[], DomainError>> {
    // Extract path and pattern from discriminated union
    const path = config.path;
    const pattern = config.kind === "DirectoryInput"
      ? config.pattern
      : FILE_PATTERNS.MARKDOWN;

    const filesResult = await this.fileSystem.listFiles(
      path,
      pattern,
    );
    if (!filesResult.ok) {
      return filesResult;
    }

    const documents: Document[] = [];
    for (const fileInfo of filesResult.data) {
      const contentResult = await this.fileSystem.readFile(fileInfo.path);
      if (!contentResult.ok) {
        continue;
      }

      const pathResult = DocumentPath.create(fileInfo.path);
      if (!pathResult.ok) {
        continue;
      }

      // Create DocumentContent from the raw string
      const contentObj = DocumentContent.create(contentResult.data);
      if (!contentObj.ok) {
        continue;
      }

      // Create a basic document first
      const basicDoc = Document.createWithFrontMatter(
        pathResult.data,
        null,
        contentObj.data,
      );

      // Extract frontmatter from the document
      const extractionResult = this.frontMatterExtractor.extract(basicDoc);
      if (!extractionResult.ok) {
        continue;
      }

      // Update the document with extracted frontmatter if found
      const document = extractionResult.data.kind === "Extracted"
        ? Document.createWithFrontMatter(
          pathResult.data,
          extractionResult.data.frontMatter,
          contentObj.data,
        )
        : basicDoc;
      documents.push(document);
    }

    return { ok: true, data: documents };
  }

  private transformDocument(
    document: Document,
    schema: Schema,
    extractionPrompt?: string,
    mappingPrompt?: string,
  ): Promise<Result<TransformationResult, DomainError>> {
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
      return Promise.resolve(validationResult);
    }

    const validatedData = validationResult.data;

    const transformationResult = TransformationResult.create(
      context,
      extractedData,
      validatedData,
    );

    return Promise.resolve({ ok: true, data: transformationResult });
  }

  private async generateOutput(
    batchResult: BatchTransformationResult,
    template: Template,
    config: { path: string; format: OutputFormat },
  ): Promise<Result<void, DomainError>> {
    const aggregatedData = batchResult.aggregateData();

    // Apply template mapping following Totality principle
    const templateMappingResult = this.applyTemplateMapping(
      aggregatedData,
      template,
      config.format.getValue(),
    );

    if (!templateMappingResult.ok) {
      return templateMappingResult;
    }

    const outputString = templateMappingResult.data;

    const writeResult = await this.fileSystem.writeFile(
      config.path,
      outputString,
    );

    return writeResult;
  }

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

    if (isValidRecordData(data)) {
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

  private convertToXml(data: unknown): string {
    // Simple XML conversion for basic data structures
    if (Array.isArray(data)) {
      return `<items>\n${
        data.map((item) => `  <item>${this.convertToXml(item)}</item>`).join(
          "\n",
        )
      }\n</items>`;
    }

    if (isValidRecordData(data)) {
      const entries = Object.entries(data);
      return entries.map(([key, value]) =>
        `<${key}>${this.convertToXml(value)}</${key}>`
      ).join("");
    }

    if (typeof data === "string") {
      return data.replace(/[<>&"]/g, (match) => {
        const escapes: Record<string, string> = {
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
        };
        return escapes[match] || match;
      });
    }

    return String(data);
  }

  /**
   * Apply template mapping following Totality principle
   * Integrates UnifiedTemplateProcessor for proper variable substitution
   */
  private applyTemplateMapping(
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
            const config = item.config as Record<string, unknown>;
            mappedItem.options = {
              input: config.input_formats || [],
              adaptation: config.processing_modes || [],
              file: config.supports &&
                  (config.supports as Record<string, unknown>).file_input
                ? [true]
                : [false],
              stdin: config.supports &&
                  (config.supports as Record<string, unknown>).stdin_input
                ? [true]
                : [false],
              destination: config.supports &&
                  (config.supports as Record<string, unknown>)
                    .output_destination
                ? [true]
                : [false],
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
   * Type guard to check if a value is a DomainError
   */
  private isDomainError(value: unknown): value is DomainError {
    if (typeof value !== "object" || value === null || !("kind" in value)) {
      return false;
    }

    const kind = (value as { kind?: unknown }).kind;
    // Template processing success result has kind: "Success", not an error
    if (kind === "Success") {
      return false;
    }

    // Check for actual domain error kinds
    return typeof kind === "string" && (
      kind.includes("Error") ||
      kind.includes("Failed") ||
      kind.includes("Missing") ||
      kind.includes("Invalid") ||
      kind.includes("Empty") ||
      kind.includes("Parse") ||
      kind.includes("Configuration") ||
      kind.includes("NotFound") ||
      kind.includes("OutOfRange") ||
      kind.includes("TemplateMappingFailed") ||
      kind.includes("ProcessingStageError")
    );
  }

  /**
   * Extract extraction prompt from ProcessingConfiguration discriminated union
   */
  private getExtractionPrompt(
    processing: ProcessingConfiguration,
  ): string | undefined {
    switch (processing.kind) {
      case "CustomPrompts":
      case "FullCustom":
        return processing.extractionPrompt;
      case "BasicProcessing":
      case "ParallelProcessing":
        return undefined;
    }
  }

  /**
   * Extract mapping prompt from ProcessingConfiguration discriminated union
   */
  private getMappingPrompt(
    processing: ProcessingConfiguration,
  ): string | undefined {
    switch (processing.kind) {
      case "CustomPrompts":
      case "FullCustom":
        return processing.mappingPrompt;
      case "BasicProcessing":
      case "ParallelProcessing":
        return undefined;
    }
  }

  /**
   * Determine if processing should continue on error from ProcessingConfiguration
   */
  private shouldContinueOnError(processing: ProcessingConfiguration): boolean {
    switch (processing.kind) {
      case "ParallelProcessing":
      case "FullCustom":
        return processing.continueOnError;
      case "BasicProcessing":
      case "CustomPrompts":
        return false; // Default to false for basic processing
    }
  }
}
