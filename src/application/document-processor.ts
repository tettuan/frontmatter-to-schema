import {
  createProcessingStageError,
  type DomainError,
  isOk,
  type Result,
} from "../domain/core/result.ts";
import { Document } from "../domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
} from "../domain/models/value-objects.ts";
import {
  Schema,
  SchemaDefinition,
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
import type { TemplateMapper } from "../domain/services/template-mapper.ts";
import type { FileSystemPort } from "../infrastructure/ports/index.ts";
import type { ApplicationConfiguration } from "./configuration.ts";

export class DocumentProcessor {
  constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaValidator: SchemaValidator,
    private readonly templateMapper: TemplateMapper,
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
        config.processing?.extractionPrompt,
        config.processing?.mappingPrompt,
      );

      if (isOk(transformResult)) {
        results.push(transformResult.data);
      } else if (config.processing?.continueOnError !== false) {
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
    config: { definition: unknown; format: "json" | "yaml" | "custom" },
  ): Result<Schema, DomainError> {
    const definitionResult = SchemaDefinition.create(
      config.definition,
      config.format,
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

    const schemaResult = Schema.create(
      "main-schema",
      definitionResult.data,
    );
    if (!schemaResult.ok) {
      // Convert ValidationError to DomainError
      return {
        ok: false,
        error: createProcessingStageError(
          "schema creation",
          schemaResult.error,
        ),
      };
    }
    return schemaResult;
  }

  private loadTemplate(
    config: {
      definition: string;
      format: "json" | "yaml" | "handlebars" | "custom";
    },
  ): Result<Template, DomainError> {
    const definitionResult = TemplateDefinition.create(
      config.definition,
      config.format,
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
    config: { path: string; pattern?: string },
  ): Promise<Result<Document[], DomainError>> {
    const filesResult = await this.fileSystem.listFiles(
      config.path,
      config.pattern || "\\.md$",
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

    if (document.hasFrontMatter()) {
      const frontMatter = document.getFrontMatter()!;
      const contentJson = frontMatter.getContent().toJSON();
      extractedData = ExtractedData.create(
        typeof contentJson === "object" && contentJson !== null
          ? contentJson as Record<string, unknown>
          : {},
      );
    } else {
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
    _template: Template,
    config: { path: string; format: "json" | "yaml" | "markdown" },
  ): Promise<Result<void, DomainError>> {
    const aggregatedData = batchResult.aggregateData();

    // Wrap data based on output format
    const outputData = config.format === "json" || config.format === "yaml"
      ? aggregatedData
      : { items: aggregatedData };

    // For now, bypass template mapping and directly serialize output data
    // TODO: Integrate new strict structure matching template system
    // Note: Template integration was attempted but requires resolving type compatibility issues
    // between transformation.ts and entities.ts ExtractedData/Template types
    const outputString = config.format === "json"
      ? JSON.stringify(outputData, null, 2)
      : config.format === "yaml"
      ? this.convertToYaml(outputData, 0)
      : JSON.stringify(outputData, null, 2);

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

    if (typeof data === "object") {
      const entries = Object.entries(data as Record<string, unknown>);
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
}
