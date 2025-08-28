// Process documents use case - orchestrates the entire document processing pipeline

import {
  createDomainError,
  type DomainError,
  isError,
  isOk,
  type Result,
} from "../../domain/core/result.ts";
import {
  AnalysisResult,
  type Document,
  type Schema,
  type Template,
} from "../../domain/models/entities.ts";
import { ProcessingOptions } from "../../domain/models/value-objects.ts";
import { LoggerFactory } from "../../domain/shared/logger.ts";
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
    Result<ProcessDocumentsUseCaseOutput, DomainError & { message: string }>
  > {
    const { config } = input;
    const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";

    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Starting document processing pipeline", {
        schemaPath: config.schemaPath.getValue(),
        templatePath: config.templatePath.getValue(),
        documentsPath: config.documentsPath.getValue(),
      });
    }

    // Load schema
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Loading schema", {
        schemaPath: config.schemaPath.getValue(),
      });
    }
    const schemaResult = await this.schemaRepo.load(config.schemaPath);
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Schema loaded", {
        success: schemaResult.ok,
        schemaPath: config.schemaPath.getValue(),
      });
    }
    if (isError(schemaResult)) {
      if (verboseMode) {
        const errorLogger = LoggerFactory.createLogger(
          "process-documents-error",
        );
        errorLogger.error("Schema load error", {
          errorKind: schemaResult.error.kind,
          message: schemaResult.error.message,
          schemaPath: config.schemaPath.getValue(),
        });
      }
      // Provide more specific error message
      let reason = "Failed to load schema";
      if (schemaResult.error.kind === "FileNotFound") {
        reason = "Schema file not found";
      } else if (
        schemaResult.error.kind === "ReadError" && schemaResult.error.details
      ) {
        reason = `Schema load error: ${schemaResult.error.details}`;
      } else if (schemaResult.error.message) {
        reason = schemaResult.error.message;
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: config.schemaPath.getValue(),
          details: reason,
        }),
      };
    }
    const schema = schemaResult.data;

    // Load template
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Loading template", {
        templatePath: config.templatePath.getValue(),
      });
    }
    const templateResult = await this.templateRepo.loadFromPath(config.templatePath);
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Template loaded", {
        success: templateResult.ok,
        templatePath: config.templatePath.getValue(),
      });
    }
    if (isError(templateResult)) {
      if (verboseMode) {
        const errorLogger = LoggerFactory.createLogger(
          "process-documents-error",
        );
        errorLogger.error("Template load error", {
          errorKind: templateResult.error.kind,
          message: templateResult.error.message,
          templatePath: config.templatePath.getValue(),
        });
      }
      // Provide more specific error message
      let reason = "Failed to load template";
      if (templateResult.error.kind === "FileNotFound") {
        reason = "Template file not found";
      } else if (
        templateResult.error.kind === "ReadError" &&
        templateResult.error.details
      ) {
        reason = `Template load error: ${templateResult.error.details}`;
      } else if (templateResult.error.message) {
        reason = templateResult.error.message;
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: config.templatePath.getValue(),
          details: reason,
        }),
      };
    }
    const template = templateResult.data;

    // Find all documents
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Scanning for markdown files", {
        documentsPath: config.documentsPath.getValue(),
      });
    }
    const documentsResult = await this.documentRepo.findAll(
      config.documentsPath,
    );
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Document search result", {
        success: documentsResult.ok,
        documentsPath: config.documentsPath.getValue(),
      });
    }
    if (documentsResult.ok) {
      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "process-documents-verbose",
        );
        verboseLogger.info("Found markdown files", {
          count: documentsResult.data.length,
          documentsPath: config.documentsPath.getValue(),
        });
      }
    }
    if (isError(documentsResult)) {
      if (verboseMode) {
        const errorLogger = LoggerFactory.createLogger(
          "process-documents-error",
        );
        errorLogger.error("Document search error", {
          errorKind: documentsResult.error.kind,
          message: documentsResult.error.message,
          documentsPath: config.documentsPath.getValue(),
        });
      }
      // Provide more specific error message
      let reason = "Failed to find documents";
      if (documentsResult.error.kind === "FileNotFound") {
        reason = "Documents directory not found";
      } else if (
        documentsResult.error.kind === "ReadError" &&
        documentsResult.error.details
      ) {
        reason = `Documents load error: ${documentsResult.error.details}`;
      } else if (documentsResult.error.message) {
        reason = documentsResult.error.message;
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: config.documentsPath.getValue(),
          details: reason,
        }),
      };
    }
    const documents = documentsResult.data;

    // Check if any documents were found
    if (documents.length === 0) {
      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "process-documents-verbose",
        );
        verboseLogger.warn(
          "No markdown files found in the specified directory",
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
        error: createDomainError({
          kind: "EmptyInput",
          field: "processing_options",
        }),
      };
    }
    const options = optionsResult.data;

    // Process documents
    const results: AnalysisResult[] = [];
    const errors: Array<{ document: string; error: string }> = [];

    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Starting document processing", {
        documentCount: documents.length,
        processingMode: options.isParallel() ? "Parallel" : "Sequential",
      });
    }

    // Display processing list
    const processLogger = LoggerFactory.createLogger("process-documents-main");
    const documentPaths = documents.map((doc) => doc.getPath().getValue());
    processLogger.info("Processing document list", {
      documentCount: documents.length,
      documents: documentPaths,
    });

    if (options.isParallel()) {
      // Parallel processing
      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "process-documents-verbose",
        );
        verboseLogger.info("Creating parallel processing promises", {
          documentCount: documents.length,
        });
      }

      const promises = documents.map((doc) => {
        const docPath = doc.getPath().getValue();
        const startLogger = LoggerFactory.createLogger(
          "process-documents-main",
        );
        startLogger.info("Starting document processing", { docPath });

        if (verboseMode) {
          const verboseLogger = LoggerFactory.createLogger(
            "process-documents-verbose",
          );
          verboseLogger.info("Creating promise for document", {
            document: docPath,
          });
        }
        return this.processDocument(doc, schema, template)
          .then((result) => {
            const resultLogger = LoggerFactory.createLogger(
              "process-documents-result",
            );
            if (isOk(result)) {
              resultLogger.info("Document processing success", {
                document: docPath,
              });
            } else {
              resultLogger.error("Document processing failed", {
                document: docPath,
                error: result.error.message,
              });
            }
            return { doc, result };
          });
      });

      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "process-documents-verbose",
        );
        verboseLogger.info("Waiting for all promises to complete", {
          promiseCount: promises.length,
        });
      }

      const outcomes = await Promise.all(promises);

      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "process-documents-verbose",
        );
        verboseLogger.info("All promises completed, processing outcomes");
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
        const startLogger = LoggerFactory.createLogger(
          "process-documents-sequential",
        );
        startLogger.info("Starting document processing", { document: docPath });

        const result = await this.processDocument(doc, schema, template);

        const resultLogger = LoggerFactory.createLogger(
          "process-documents-sequential",
        );
        if (isOk(result)) {
          resultLogger.info("Document processing success", {
            document: docPath,
          });
          results.push(result.data);
        } else {
          resultLogger.error("Document processing failed", {
            document: docPath,
            error: result.error.message,
          });
          errors.push({
            document: docPath,
            error: result.error.message,
          });

          if (!options.shouldContinueOnError()) {
            const stopLogger = LoggerFactory.createLogger(
              "process-documents-control",
            );
            stopLogger.warn("Stopping due to error", {
              reason: "continue-on-error is false",
            });
            break;
          }
        }
      }
    }

    // Check if any results were processed
    if (results.length === 0) {
      const summaryLogger = LoggerFactory.createLogger(
        "process-documents-summary",
      );
      summaryLogger.warn("No documents were successfully processed");
      if (errors.length > 0) {
        const errorSummaryLogger = LoggerFactory.createLogger(
          "process-documents-summary",
        );
        errorSummaryLogger.error("Failed documents summary", {
          failedCount: errors.length,
          failures: errors.map((error) => ({
            document: error.document,
            error: error.error,
          })),
        });
      }
    }

    // Aggregate results
    const aggregationLogger = LoggerFactory.createLogger(
      "process-documents-main",
    );
    aggregationLogger.info("Aggregating results", {
      resultCount: results.length,
    });
    const aggregateResult = this.resultAggregator.aggregate(results);
    if (isError(aggregateResult)) {
      const errorLogger = LoggerFactory.createLogger("process-documents-error");
      errorLogger.error("Aggregation failed", {
        errorMessage: aggregateResult.error.message,
      });
      return {
        ok: false,
        error: aggregateResult.error,
      };
    }
    aggregationLogger.info("Aggregation successful");

    // Save aggregated results
    const saveResult = await this.resultRepo.save(
      aggregateResult.data,
      config.outputPath,
    );
    if (isError(saveResult)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: config.outputPath.getValue(),
          details: "Failed to save aggregated results",
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
  ): Promise<Result<AnalysisResult, DomainError & { message: string }>> {
    const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";
    const docPath = document.getPath().getValue();

    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Processing document", { docPath });
    }

    // Extract frontmatter
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("Extracting frontmatter", { docPath });
    }
    const frontMatterResult = this.frontMatterExtractor.extract(document);
    if (isError(frontMatterResult)) {
      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "process-documents-verbose",
        );
        verboseLogger.error("Frontmatter extraction failed", { docPath });
      }
      return frontMatterResult;
    }

    if (frontMatterResult.data.kind === "NotPresent") {
      if (verboseMode) {
        const verboseLogger = LoggerFactory.createLogger(
          "process-documents-verbose",
        );
        verboseLogger.warn("No frontmatter found", { docPath });
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: "frontmatter",
          input: "No frontmatter found in document",
        }),
      };
    }

    const frontMatter = frontMatterResult.data.frontMatter;

    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-helper",
      );
      verboseLogger.info("Frontmatter extracted", { document: docPath });
    }

    // Analyze with schema
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-helper",
      );
      verboseLogger.info("Starting AI analysis", { document: docPath });
    }
    const extractedResult = await this.schemaAnalyzer.analyze(
      frontMatter,
      schema,
    );
    if (verboseMode) {
      const debugLogger = LoggerFactory.createLogger(
        "process-documents-debug",
      );
      debugLogger.info("AI analysis result", {
        document: docPath,
        result: extractedResult,
      });
    }
    if (isError(extractedResult)) {
      if (verboseMode) {
        const errorLogger = LoggerFactory.createLogger(
          "process-documents-helper",
        );
        errorLogger.error("AI analysis failed", {
          document: docPath,
          error: extractedResult.error,
        });
      }
      return extractedResult;
    }
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-helper",
      );
      verboseLogger.info("AI analysis successful", { document: docPath });
    }

    // Map to template
    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-helper",
      );
      verboseLogger.info("Mapping to template", { document: docPath });
    }
    const mappedResult = this.templateMapper.map(
      extractedResult.data,
      template,
      { kind: "WithSchema", schema: schema.getDefinition().getValue() }, // Pass schema for strict structure matching
    );
    if (isError(mappedResult)) {
      if (verboseMode) {
        const errorLogger = LoggerFactory.createLogger(
          "process-documents-helper",
        );
        errorLogger.error("Template mapping failed", { document: docPath });
      }
      return mappedResult;
    }

    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-helper",
      );
      verboseLogger.info("Template mapping completed", { document: docPath });
    }

    // Create analysis result
    const analysisResult = AnalysisResult.create(
      document,
      extractedResult.data,
      mappedResult.data,
    );

    if (verboseMode) {
      const verboseLogger = LoggerFactory.createLogger(
        "process-documents-helper",
      );
      verboseLogger.info("Document processing completed", {
        document: docPath,
      });
    }

    return { ok: true, data: analysisResult };
  }
}
