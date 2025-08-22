// Process documents use case - orchestrates the entire document processing pipeline

import {
  createError,
  isError,
  isOk,
  type ProcessingError,
  type Result,
} from "../../domain/shared/types.ts";
import {
  AnalysisResult,
  type Document,
  type Schema,
  type Template,
} from "../../domain/models/entities.ts";
import { ProcessingOptions } from "../../domain/models/value-objects.ts";
import type {
  DocumentRepository,
  FrontMatterExtractor,
  ProcessingConfiguration,
  ResultAggregator,
  ResultRepository,
  SchemaAnalyzer,
  SchemaRepository,
  TemplateMapper,
  TemplateRepository,
} from "../../domain/services/interfaces.ts";

export interface ProcessDocumentsUseCaseInput {
  config: ProcessingConfiguration;
}

export interface ProcessDocumentsUseCaseOutput {
  processedCount: number;
  failedCount: number;
  outputPath: string;
  errors: Array<{ document: string; error: string }>;
}

export class ProcessDocumentsUseCase {
  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly schemaRepo: SchemaRepository,
    private readonly templateRepo: TemplateRepository,
    private readonly resultRepo: ResultRepository,
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaAnalyzer: SchemaAnalyzer,
    private readonly templateMapper: TemplateMapper,
    private readonly resultAggregator: ResultAggregator,
  ) {}

  async execute(
    input: ProcessDocumentsUseCaseInput,
  ): Promise<
    Result<ProcessDocumentsUseCaseOutput, ProcessingError & { message: string }>
  > {
    const { config } = input;
    const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";

    if (verboseMode) {
      console.log("🎯 [VERBOSE] Starting document processing pipeline...");
      console.log(
        `📋 [VERBOSE] Config - schema: ${config.schemaPath.getValue()}, template: ${config.templatePath.getValue()}, documents: ${config.documentsPath.getValue()}`,
      );
    }

    // Load schema
    if (verboseMode) {
      console.log("📖 [VERBOSE] Loading schema...");
    }
    const schemaResult = await this.schemaRepo.load(config.schemaPath);
    if (verboseMode) {
      console.log(
        `✅ [VERBOSE] Schema loaded: ${schemaResult.ok ? "SUCCESS" : "FAILED"}`,
      );
    }
    if (isError(schemaResult)) {
      if (verboseMode) {
        console.log(
          `❌ [VERBOSE] Schema load error: ${schemaResult.error.kind} - ${schemaResult.error.message}`,
        );
      }
      // Provide more specific error message
      let reason = "Failed to load schema";
      if (schemaResult.error.kind === "FileNotFound") {
        reason = "Schema file not found";
      } else if (
        schemaResult.error.kind === "ReadError" && schemaResult.error.reason
      ) {
        reason = `Schema load error: ${schemaResult.error.reason}`;
      } else if (schemaResult.error.message) {
        reason = schemaResult.error.message;
      }

      return {
        ok: false,
        error: createError({
          kind: "ConfigurationInvalid",
          errors: [{
            kind: "InvalidPath",
            path: config.schemaPath.getValue(),
            reason,
          }],
        }),
      };
    }
    const schema = schemaResult.data;

    // Load template
    if (verboseMode) {
      console.log("📄 [VERBOSE] Loading template...");
    }
    const templateResult = await this.templateRepo.load(config.templatePath);
    if (verboseMode) {
      console.log(
        `✅ [VERBOSE] Template loaded: ${
          templateResult.ok ? "SUCCESS" : "FAILED"
        }`,
      );
    }
    if (isError(templateResult)) {
      if (verboseMode) {
        console.log(
          `❌ [VERBOSE] Template load error: ${templateResult.error.kind} - ${templateResult.error.message}`,
        );
      }
      // Provide more specific error message
      let reason = "Failed to load template";
      if (templateResult.error.kind === "FileNotFound") {
        reason = "Template file not found";
      } else if (
        templateResult.error.kind === "ReadError" && templateResult.error.reason
      ) {
        reason = `Template load error: ${templateResult.error.reason}`;
      } else if (templateResult.error.message) {
        reason = templateResult.error.message;
      }

      return {
        ok: false,
        error: createError({
          kind: "ConfigurationInvalid",
          errors: [{
            kind: "InvalidPath",
            path: config.templatePath.getValue(),
            reason,
          }],
        }),
      };
    }
    const template = templateResult.data;

    // Find all documents
    if (verboseMode) {
      console.log("📁 [VERBOSE] Scanning for markdown files...");
    }
    const documentsResult = await this.documentRepo.findAll(
      config.documentsPath,
    );
    if (verboseMode) {
      console.log(
        `📊 [VERBOSE] Document search: ${
          documentsResult.ok ? "SUCCESS" : "FAILED"
        }`,
      );
    }
    if (documentsResult.ok) {
      if (verboseMode) {
        console.log(
          `✅ [VERBOSE] Found ${documentsResult.data.length} markdown files`,
        );
      }
    }
    if (isError(documentsResult)) {
      if (verboseMode) {
        console.log(
          `❌ [VERBOSE] Document search error: ${documentsResult.error.kind} - ${documentsResult.error.message}`,
        );
      }
      // Provide more specific error message
      let reason = "Failed to find documents";
      if (documentsResult.error.kind === "FileNotFound") {
        reason = "Documents directory not found";
      } else if (
        documentsResult.error.kind === "ReadError" &&
        documentsResult.error.reason
      ) {
        reason = `Documents load error: ${documentsResult.error.reason}`;
      } else if (documentsResult.error.message) {
        reason = documentsResult.error.message;
      }

      return {
        ok: false,
        error: createError({
          kind: "ConfigurationInvalid",
          errors: [{
            kind: "InvalidPath",
            path: config.documentsPath.getValue(),
            reason,
          }],
        }),
      };
    }
    const documents = documentsResult.data;

    // Process options
    const optionsResult = ProcessingOptions.create(config.options);
    if (isError(optionsResult)) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationInvalid",
          errors: [optionsResult.error],
        }),
      };
    }
    const options = optionsResult.data;

    // Process documents
    const results: AnalysisResult[] = [];
    const errors: Array<{ document: string; error: string }> = [];

    if (options.isParallel()) {
      // Parallel processing
      const promises = documents.map((doc) =>
        this.processDocument(doc, schema, template)
          .then((result) => ({ doc, result }))
      );

      const outcomes = await Promise.all(promises);

      for (const { doc, result } of outcomes) {
        if (isOk(result)) {
          results.push(result.data);
        } else {
          errors.push({
            document: doc.getPath().getValue(),
            error: result.error.message,
          });

          if (!options.shouldContinueOnError()) {
            break;
          }
        }
      }
    } else {
      // Sequential processing
      for (const doc of documents) {
        const result = await this.processDocument(doc, schema, template);

        if (isOk(result)) {
          results.push(result.data);
        } else {
          errors.push({
            document: doc.getPath().getValue(),
            error: result.error.message,
          });

          if (!options.shouldContinueOnError()) {
            break;
          }
        }
      }
    }

    // Aggregate results
    const aggregateResult = this.resultAggregator.aggregate(results);
    if (isError(aggregateResult)) {
      return {
        ok: false,
        error: aggregateResult.error,
      };
    }

    // Save aggregated results
    const saveResult = await this.resultRepo.save(
      aggregateResult.data,
      config.outputPath,
    );
    if (isError(saveResult)) {
      return {
        ok: false,
        error: createError({
          kind: "AggregationFailed",
          reason: "Failed to save results",
        }),
      };
    }

    return {
      ok: true,
      data: {
        processedCount: results.length,
        failedCount: errors.length,
        outputPath: config.outputPath.getValue(),
        errors,
      },
    };
  }

  private async processDocument(
    document: Document,
    schema: Schema,
    template: Template,
  ): Promise<Result<AnalysisResult, ProcessingError & { message: string }>> {
    // Extract frontmatter
    const frontMatterResult = this.frontMatterExtractor.extract(document);
    if (isError(frontMatterResult)) {
      return frontMatterResult;
    }

    const frontMatter = frontMatterResult.data;
    if (!frontMatter) {
      return {
        ok: false,
        error: createError({
          kind: "ExtractionFailed",
          document: document.getPath().getValue(),
          reason: "No frontmatter found",
        }),
      };
    }

    // Analyze with schema
    const extractedResult = await this.schemaAnalyzer.analyze(
      frontMatter,
      schema,
    );
    if (isError(extractedResult)) {
      return extractedResult;
    }

    // Map to template
    const mappedResult = this.templateMapper.map(
      extractedResult.data,
      template,
    );
    if (isError(mappedResult)) {
      return mappedResult;
    }

    // Create analysis result
    const analysisResult = AnalysisResult.create(
      document,
      extractedResult.data,
      mappedResult.data,
    );

    return { ok: true, data: analysisResult };
  }
}
