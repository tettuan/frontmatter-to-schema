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

    // Check if any documents were found
    if (documents.length === 0) {
      if (verboseMode) {
        console.log(
          `⚠️ [VERBOSE] No markdown files found in the specified directory`,
        );
      }
      return {
        ok: true,
        data: {
          processedCount: 0,
          failedCount: 0,
          outputPath: config.outputPath.getValue(),
          errors: [],
        },
      };
    }

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

    if (verboseMode) {
      console.log(
        `📝 [VERBOSE] Starting to process ${documents.length} documents...`,
      );
      console.log(
        `⚙️ [VERBOSE] Processing mode: ${
          options.isParallel() ? "Parallel" : "Sequential"
        }`,
      );
    }

    // Display processing list
    console.log(`\n📋 Processing ${documents.length} markdown file(s):`);
    for (const doc of documents) {
      console.log(`  • ${doc.getPath().getValue()}`);
    }
    console.log("");

    if (options.isParallel()) {
      // Parallel processing
      if (verboseMode) {
        console.log(
          `🔄 [VERBOSE] Creating parallel processing promises for ${documents.length} documents...`,
        );
      }

      const promises = documents.map((doc) => {
        const docPath = doc.getPath().getValue();
        console.log(`🚀 Starting: ${docPath}`);

        if (verboseMode) {
          console.log(
            `🔄 [VERBOSE] Creating promise for: ${docPath}`,
          );
        }
        return this.processDocument(doc, schema, template)
          .then((result) => {
            if (isOk(result)) {
              console.log(`✅ Success: ${docPath}`);
            } else {
              console.log(`❌ Failed: ${docPath} - ${result.error.message}`);
            }
            return { doc, result };
          });
      });

      if (verboseMode) {
        console.log(
          `⏳ [VERBOSE] Waiting for all ${promises.length} promises to complete...`,
        );
      }

      const outcomes = await Promise.all(promises);

      if (verboseMode) {
        console.log(
          `✅ [VERBOSE] All promises completed, processing outcomes...`,
        );
      }

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
        const docPath = doc.getPath().getValue();
        console.log(`🚀 Starting: ${docPath}`);

        const result = await this.processDocument(doc, schema, template);

        if (isOk(result)) {
          console.log(`✅ Success: ${docPath}`);
          results.push(result.data);
        } else {
          console.log(`❌ Failed: ${docPath} - ${result.error.message}`);
          errors.push({
            document: docPath,
            error: result.error.message,
          });

          if (!options.shouldContinueOnError()) {
            console.log(
              `⛔ Stopping due to error (continue-on-error is false)`,
            );
            break;
          }
        }
      }
    }

    // Check if any results were processed
    if (results.length === 0) {
      console.log(`\n⚠️ No documents were successfully processed`);
      if (errors.length > 0) {
        console.log(`📊 Failed documents: ${errors.length}`);
        for (const error of errors) {
          console.log(`  • ${error.document}: ${error.error}`);
        }
      }
    }

    // Aggregate results
    console.log(`\n📦 Aggregating ${results.length} result(s)...`);
    const aggregateResult = this.resultAggregator.aggregate(results);
    if (isError(aggregateResult)) {
      console.log(`❌ Aggregation failed: ${aggregateResult.error.message}`);
      return {
        ok: false,
        error: aggregateResult.error,
      };
    }
    console.log(`✅ Aggregation successful`);

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
    const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";
    const docPath = document.getPath().getValue();

    if (verboseMode) {
      console.log(`📄 [VERBOSE] Processing document: ${docPath}`);
    }

    // Extract frontmatter
    if (verboseMode) {
      console.log(`📤 [VERBOSE] Extracting frontmatter from: ${docPath}`);
    }
    const frontMatterResult = this.frontMatterExtractor.extract(document);
    if (isError(frontMatterResult)) {
      if (verboseMode) {
        console.log(
          `❌ [VERBOSE] Frontmatter extraction failed for: ${docPath}`,
        );
      }
      return frontMatterResult;
    }

    const frontMatter = frontMatterResult.data;
    if (!frontMatter) {
      if (verboseMode) {
        console.log(`⚠️ [VERBOSE] No frontmatter found in: ${docPath}`);
      }
      return {
        ok: false,
        error: createError({
          kind: "ExtractionFailed",
          document: document.getPath().getValue(),
          reason: "No frontmatter found",
        }),
      };
    }

    if (verboseMode) {
      console.log(`✅ [VERBOSE] Frontmatter extracted from: ${docPath}`);
    }

    // Analyze with schema
    if (verboseMode) {
      console.log(`🤖 [VERBOSE] Starting AI analysis for: ${docPath}`);
    }
    const extractedResult = await this.schemaAnalyzer.analyze(
      frontMatter,
      schema,
    );
    if (verboseMode) {
      console.log(`🔍 [DEBUG] AI analysis result:`, extractedResult);
    }
    if (isError(extractedResult)) {
      if (verboseMode) {
        console.log(`❌ [VERBOSE] AI analysis failed for: ${docPath}`);
        console.log(`❌ [DEBUG] Error details:`, extractedResult.error);
      }
      return extractedResult;
    }
    if (verboseMode) {
      console.log(`✅ [VERBOSE] AI analysis successful for: ${docPath}`);
    }

    // Map to template
    if (verboseMode) {
      console.log(`🗺️ [VERBOSE] Mapping to template for: ${docPath}`);
    }
    const mappedResult = this.templateMapper.map(
      extractedResult.data,
      template,
    );
    if (isError(mappedResult)) {
      if (verboseMode) {
        console.log(`❌ [VERBOSE] Template mapping failed for: ${docPath}`);
      }
      return mappedResult;
    }

    if (verboseMode) {
      console.log(`✅ [VERBOSE] Template mapping completed for: ${docPath}`);
    }

    // Create analysis result
    const analysisResult = AnalysisResult.create(
      document,
      extractedResult.data,
      mappedResult.data,
    );

    if (verboseMode) {
      console.log(`✅ [VERBOSE] Document processing completed: ${docPath}`);
    }

    return { ok: true, data: analysisResult };
  }
}
