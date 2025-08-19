import { Result, isOk, isError } from "../domain/shared/result.ts";
import { DomainError, ValidationError } from "../domain/shared/errors.ts";
import {
  Document,
  DocumentPath,
} from "../domain/models/document.ts";
import {
  Schema,
  SchemaDefinition,
} from "../domain/models/schema.ts";
import {
  Template,
  TemplateDefinition,
} from "../domain/models/template.ts";
import {
  TransformationContext,
  TransformationResult,
  ExtractedData,
  BatchTransformationResult,
} from "../domain/models/transformation.ts";
import { FrontMatterExtractor } from "../domain/services/frontmatter-extractor.ts";
import { SchemaValidator } from "../domain/services/schema-validator.ts";
import { TemplateMapper } from "../domain/services/template-mapper.ts";
import { FileSystemPort } from "../infrastructure/ports/file-system.ts";
import { AIAnalyzerPort } from "../infrastructure/ports/ai-analyzer.ts";
import { ApplicationConfiguration } from "./configuration.ts";

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
    const schemaResult = await this.loadSchema(config.schema);
    if (!schemaResult.ok) {
      return schemaResult;
    }
    const schema = schemaResult.data;

    // Load template
    const templateResult = await this.loadTemplate(config.template);
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

  private async loadSchema(
    config: { definition: unknown; format: "json" | "yaml" | "custom" },
  ): Promise<Result<Schema, DomainError>> {
    const definitionResult = SchemaDefinition.create(
      config.definition,
      config.format,
    );
    if (!definitionResult.ok) {
      return definitionResult;
    }

    const schemaResult = Schema.create(
      "main-schema",
      definitionResult.data,
    );
    return schemaResult;
  }

  private async loadTemplate(
    config: { definition: string; format: "json" | "yaml" | "handlebars" | "custom" },
  ): Promise<Result<Template, DomainError>> {
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

      const extractionResult = this.frontMatterExtractor.extract(
        contentResult.data,
      );
      if (!extractionResult.ok) {
        continue;
      }

      const document = Document.create(
        pathResult.data,
        extractionResult.data.frontMatter,
        extractionResult.data.body,
      );
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
      extractedData = ExtractedData.create(
        document.getFrontMatter()!.getParsed(),
      );
    } else {
      extractedData = ExtractedData.create({});
    }

    // Map to schema using AI if mapping prompt is provided
    let validatedData: unknown;
    
    if (mappingPrompt) {
      const mappingResult = await this.aiAnalyzer.analyze({
        content: JSON.stringify(extractedData.getData()),
        prompt: mappingPrompt + "\n\nSchema: " + JSON.stringify(schema.getDefinition().getDefinition()),
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