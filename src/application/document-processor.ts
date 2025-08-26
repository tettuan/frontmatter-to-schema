import { isOk, type Result } from "../domain/core/result.ts";
import type { DomainError, ValidationError } from "../domain/shared/errors.ts";
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
import type {
  AIAnalyzerPort,
  FileSystemPort,
} from "../infrastructure/ports/index.ts";
import type { ApplicationConfiguration } from "./configuration.ts";

export class DocumentProcessor {
  constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly aiAnalyzer: AIAnalyzerPort,
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
    const errors: Array<{ document: Document; error: ValidationError }> = [];

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
          error: transformResult.error as ValidationError,
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
        error: {
          kind: "ValidationError",
          message: `Schema definition error: ${definitionResult.error.kind}`,
        },
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
        error: {
          kind: "ValidationError",
          message: `Schema creation error: ${schemaResult.error.kind}`,
        },
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
      const basicDoc = Document.create(
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
      const document = extractionResult.data
        ? Document.create(
          pathResult.data,
          extractionResult.data,
          contentObj.data,
        )
        : basicDoc;
      documents.push(document);
    }

    return { ok: true, data: documents };
  }

  private async transformDocument(
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

    if (extractionPrompt && document.hasFrontMatter()) {
      const analysisResult = await this.aiAnalyzer.analyze({
        content: document.getFrontMatter()!.getRaw(),
        prompt: extractionPrompt,
      });

      if (!analysisResult.ok) {
        return analysisResult;
      }

      try {
        const parsed = JSON.parse(analysisResult.data.result);
        extractedData = ExtractedData.create(parsed);
      } catch {
        extractedData = ExtractedData.create({
          raw: analysisResult.data.result,
        });
      }
    } else if (document.hasFrontMatter()) {
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

    // Map to schema using AI if mapping prompt is provided
    let validatedData: unknown;

    if (mappingPrompt) {
      const mappingResult = await this.aiAnalyzer.analyze({
        content: JSON.stringify(extractedData.getData()),
        prompt: mappingPrompt + "\n\nSchema: " +
          JSON.stringify(schema.getDefinition().getDefinition()),
      });

      if (!mappingResult.ok) {
        return mappingResult;
      }

      try {
        validatedData = JSON.parse(mappingResult.data.result);
      } catch {
        validatedData = extractedData.getData();
      }
    } else {
      // Validate against schema
      const validationResult = this.schemaValidator.validate(
        extractedData.getData(),
        schema,
      );

      if (!validationResult.ok) {
        return validationResult;
      }

      validatedData = validationResult.data;
    }

    const transformationResult = TransformationResult.create(
      context,
      extractedData,
      validatedData,
    );

    return { ok: true, data: transformationResult };
  }

  private async generateOutput(
    batchResult: BatchTransformationResult,
    template: Template,
    config: { path: string; format: "json" | "yaml" | "markdown" },
  ): Promise<Result<void, DomainError>> {
    const aggregatedData = batchResult.aggregateData();

    // Wrap data based on output format
    const outputData = config.format === "json" || config.format === "yaml"
      ? aggregatedData
      : { items: aggregatedData };

    const renderResult = this.templateMapper.map(outputData, template);
    if (!renderResult.ok) {
      return renderResult;
    }

    const writeResult = await this.fileSystem.writeFile(
      config.path,
      renderResult.data,
    );

    return writeResult;
  }
}
