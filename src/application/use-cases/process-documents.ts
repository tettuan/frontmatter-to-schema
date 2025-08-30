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
  MappedData,
  type Schema,
  type Template,
} from "../../domain/models/entities.ts";
import { ProcessingOptions } from "../../domain/models/value-objects.ts";
import { StructuredLogger } from "../../domain/shared/logger.ts";
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

    // Verbose: Pipeline start
    if (verboseMode) {
      const verboseLogger = StructuredLogger.getServiceLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("[Pipeline] Starting", {
        schema: config.schemaPath.getValue(),
        template: config.templatePath.getValue(),
        documents: config.documentsPath.getValue(),
      });
    }

    // Load schema
    const schemaResult = await this.schemaRepo.load(config.schemaPath);
    // Schema loaded
    if (isError(schemaResult)) {
      if (verboseMode) {
        const errorLogger = StructuredLogger.getServiceLogger(
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
    const templateResult = await this.templateRepo.load(
      config.templatePath.getValue(),
    );
    // Template loaded
    if (isError(templateResult)) {
      if (verboseMode) {
        const errorLogger = StructuredLogger.getServiceLogger(
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
    const documentsResult = await this.documentRepo.findAll(
      config.documentsPath,
    );
    // Search completed
    if (documentsResult.ok) {
      // Verbose: 成果A - Document list created
      if (verboseMode) {
        const verboseLogger = StructuredLogger.getServiceLogger(
          "process-documents-verbose",
        );
        verboseLogger.info("[成果A] Document list created", {
          count: documentsResult.data.length,
          path: config.documentsPath.getValue(),
        });
      }
    }
    if (isError(documentsResult)) {
      if (verboseMode) {
        const errorLogger = StructuredLogger.getServiceLogger(
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
      // No markdown files found
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

    // Start processing documents

    // Display processing list
    const processLogger = StructuredLogger.getServiceLogger(
      "process-documents-main",
    );
    const documentPaths = documents.map((doc) => doc.getPath().getValue());
    processLogger.info("Processing document list", {
      documentCount: documents.length,
      documents: documentPaths,
    });

    if (options.isParallel()) {
      // Parallel processing
      // Parallel processing

      const promises = documents.map((doc) => {
        const docPath = doc.getPath().getValue();
        const startLogger = StructuredLogger.getServiceLogger(
          "process-documents-main",
        );
        startLogger.info("Starting document processing", { docPath });

        // Process document
        return this.processDocument(doc, schema, template)
          .then((result) => {
            const resultLogger = StructuredLogger.getServiceLogger(
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

      // Wait for completion

      const outcomes = await Promise.all(promises);

      // Processing completed

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
        const startLogger = StructuredLogger.getServiceLogger(
          "process-documents-sequential",
        );
        startLogger.info("Starting document processing", { document: docPath });

        const result = await this.processDocument(doc, schema, template);

        const resultLogger = StructuredLogger.getServiceLogger(
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
            const stopLogger = StructuredLogger.getServiceLogger(
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
      const summaryLogger = StructuredLogger.getServiceLogger(
        "process-documents-summary",
      );
      summaryLogger.warn("No documents were successfully processed");
      if (errors.length > 0) {
        const errorSummaryLogger = StructuredLogger.getServiceLogger(
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
    const aggregationLogger = StructuredLogger.getServiceLogger(
      "process-documents-main",
    );
    aggregationLogger.info("Aggregating results", {
      resultCount: results.length,
    });
    const aggregateResult = this.resultAggregator.aggregate(results);
    if (isError(aggregateResult)) {
      const errorLogger = StructuredLogger.getServiceLogger(
        "process-documents-error",
      );
      errorLogger.error("Aggregation failed", {
        errorMessage: aggregateResult.error.message,
      });
      return {
        ok: false,
        error: aggregateResult.error,
      };
    }

    // Verbose: 最終成果物Z - Final aggregation
    if (verboseMode) {
      const verboseLogger = StructuredLogger.getServiceLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("[最終成果物Z] Aggregation completed", {
        totalResults: results.length,
        errors: errors.length,
      });
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

  /**
   * Check if a schema is a registry schema (contains tools.commands referencing another schema)
   */
  private isRegistrySchema(schemaDefinition: unknown): boolean {
    if (!schemaDefinition || typeof schemaDefinition !== "object") {
      return false;
    }

    const schema = schemaDefinition as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown> | undefined;

    if (!properties?.tools) {
      return false;
    }

    const tools = properties.tools as Record<string, unknown>;
    const toolsProperties = tools.properties as
      | Record<string, unknown>
      | undefined;

    if (!toolsProperties?.commands) {
      return false;
    }

    const commands = toolsProperties.commands as Record<string, unknown>;
    const items = commands.items as Record<string, unknown> | undefined;

    // Check if commands.items has a $ref (indicating it references another schema)
    return items?.["$ref"] !== undefined;
  }

  private async processDocument(
    document: Document,
    schema: Schema,
    template: Template,
  ): Promise<Result<AnalysisResult, DomainError & { message: string }>> {
    const verboseMode = Deno.env.get("FRONTMATTER_VERBOSE_MODE") === "true";
    const docPath = document.getPath().getValue();

    // Processing document

    // Extract frontmatter
    const frontMatterResult = this.frontMatterExtractor.extract(document);
    if (isError(frontMatterResult)) {
      // Frontmatter extraction failed
      return frontMatterResult;
    }

    if (frontMatterResult.data.kind === "NotPresent") {
      // No frontmatter found
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

    // Verbose: 成果B - Frontmatter extraction
    if (verboseMode) {
      const verboseLogger = StructuredLogger.getServiceLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("[成果B] Frontmatter extracted", {
        document: docPath,
        keys: Object.keys(frontMatter.toObject() as Record<string, unknown>),
      });
    }

    // Analyze with schema
    const extractedResult = await this.schemaAnalyzer.analyze(
      frontMatter,
      schema,
    );
    // Verbose: 成果C - Schema analysis
    if (verboseMode && isOk(extractedResult)) {
      const verboseLogger = StructuredLogger.getServiceLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("[成果C] Schema analysis completed", {
        document: docPath,
        fieldsExtracted: Object.keys(extractedResult.data),
      });
    }
    if (isError(extractedResult)) {
      if (verboseMode) {
        const errorLogger = StructuredLogger.getServiceLogger(
          "process-documents-helper",
        );
        errorLogger.error("AI analysis failed", {
          document: docPath,
          error: extractedResult.error,
        });
      }
      return extractedResult;
    }
    // Analysis complete

    // Map to template

    // Check if this is a registry schema - if so, use command data directly
    const schemaDefinition = schema.getDefinition().getRawDefinition();
    const isRegistry = this.isRegistrySchema(schemaDefinition);

    // Schema type detected

    let mappedResult: Result<MappedData, DomainError & { message: string }>;

    if (isRegistry) {
      // For registry schemas, wrap the extracted command data directly
      // The extracted data already contains c1, c2, c3, etc. fields
      const commandData = extractedResult.data;
      // Convert ExtractedData to plain object
      const commandObject =
        typeof commandData === "object" && commandData !== null
          ? commandData as unknown as Record<string, unknown>
          : {};
      mappedResult = { ok: true, data: MappedData.create(commandObject) };

      // Registry mode: using command data directly
    } else {
      // For non-registry schemas, apply the template normally
      mappedResult = this.templateMapper.map(
        extractedResult.data,
        template,
        { kind: "WithSchema", schema: schemaDefinition },
      );
    }

    if (isError(mappedResult)) {
      if (verboseMode) {
        const errorLogger = StructuredLogger.getServiceLogger(
          "process-documents-helper",
        );
        errorLogger.error("Template mapping failed", {
          document: docPath,
        });
      }
      return mappedResult;
    }

    // Verbose: 成果D - Template mapping
    if (verboseMode) {
      const verboseLogger = StructuredLogger.getServiceLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("[成果D] Template mapping completed", {
        document: docPath,
      });
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
