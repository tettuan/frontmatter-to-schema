import { Result } from "../../domain/shared/types/result.ts";
import {
  ProcessingError,
  TemplateError,
} from "../../domain/shared/types/errors.ts";
import { OutputRenderingService } from "../../domain/template/index.ts";
import {
  MarkdownDocument,
} from "../../domain/frontmatter/entities/markdown-document.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { FileSystemPort } from "../../infrastructure/ports/file-system-port.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import {
  DocumentLoader,
  UniversalPipeline,
  UniversalPipelineConfig,
} from "../universal-pipeline.ts";
import { ConfigurationManager } from "../strategies/configuration-strategy.ts";
import { TemplateSchemaCoordinator } from "./template-schema-coordinator.ts";
import { TemplateRenderer } from "../../domain/template/services/template-renderer.ts";
import { SchemaTemplateResolver } from "../../domain/schema/services/schema-template-resolver.ts";
import { FrontmatterParsingService } from "../../domain/frontmatter/index.ts";
import { SchemaDirectiveProcessor } from "../../domain/schema/index.ts";
import { DocumentAggregationService } from "../../domain/aggregation/index.ts";
import { TemplateOutputRenderer } from "../../domain/template/index.ts";
import { Phase1DirectiveProcessor } from "../../domain/directives/services/phase1-directive-processor.ts";
import {
  ItemsProcessor,
  ItemsTemplateLoader,
} from "../../domain/template/services/items-processor.ts";
import { ItemsDetector } from "../../domain/template/services/items-detector.ts";
import { ItemsExpander } from "../../domain/template/services/items-expander.ts";
import { TemplatePath } from "../../domain/template/value-objects/template-path.ts";
import { Template } from "../../domain/template/entities/template.ts";
import { createFileError } from "../../domain/shared/types/file-errors.ts";
import { resolveInputToFiles } from "../../infrastructure/utils/input-resolver.ts";
import {
  OutputFormatterPort,
  OutputFormatType,
} from "../../infrastructure/ports/output-formatter-port.ts";
import { DefaultOutputFormatter } from "../../infrastructure/adapters/default-output-formatter.ts";

/**
 * Template loader adapter for ItemsProcessor
 * Implements ItemsTemplateLoader port using FileSystemPort
 */
class FileSystemTemplateLoader implements ItemsTemplateLoader {
  constructor(private readonly fileSystem: FileSystemPort) {}

  async loadTemplate(
    path: TemplatePath,
  ): Promise<Result<Template, TemplateError>> {
    try {
      const contentResult = await this.fileSystem.readTextFile(path.toString());
      if (contentResult.isError()) {
        return Result.error(
          new TemplateError(
            `Failed to read template file: ${
              createFileError(contentResult.unwrapError()).message
            }`,
            "TEMPLATE_READ_ERROR",
            {
              templatePath: path.toString(),
              error: contentResult.unwrapError(),
            },
          ),
        );
      }

      let templateData: Record<string, unknown>;
      try {
        templateData = JSON.parse(contentResult.unwrap());
      } catch (parseError) {
        return Result.error(
          new TemplateError(
            `Failed to parse template JSON: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }`,
            "TEMPLATE_PARSE_ERROR",
            { templatePath: path.toString(), error: parseError },
          ),
        );
      }

      const templateDataFormatted = {
        content: templateData,
        format: "json" as const,
      };

      const templateResult = Template.create(path, templateDataFormatted);
      if (templateResult.isError()) {
        return Result.error(templateResult.unwrapError());
      }

      return Result.ok(templateResult.unwrap());
    } catch (error) {
      return Result.error(
        new TemplateError(
          `Template loading failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TEMPLATE_LOAD_ERROR",
          { templatePath: path.toString(), error },
        ),
      );
    }
  }
}

/**
 * Configuration for pipeline execution
 */
export interface PipelineConfig {
  readonly schemaPath: string;
  readonly templatePath: string;
  readonly inputPath: string | string[];
  readonly outputPath: string;
  readonly outputFormat?: "json" | "yaml" | "xml" | "markdown";
}

/**
 * Result of pipeline execution
 */
export interface PipelineResult {
  readonly processedDocuments: number;
  readonly outputPath: string;
  readonly executionTime: number;
  readonly metadata: {
    readonly schemaPath: string;
    readonly templatePath: string;
    readonly outputFormat: string;
    readonly errors?: ProcessingError[];
    readonly warnings?: number;
  };
}

/**
 * Application service for orchestrating the complete document processing pipeline.
 * Refactored to use Universal Pipeline with strategy patterns instead of hardcoded special cases.
 * Eliminates architectural violations by delegating to configurable pipeline stages.
 */
export class PipelineOrchestrator implements DocumentLoader {
  private currentSchema?: Schema; // ← Schema for Stage 0 transformation

  private constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly configManager: ConfigurationManager,
    private readonly templateSchemaCoordinator: TemplateSchemaCoordinator,
    private readonly frontmatterParsingService: FrontmatterParsingService,
    private readonly phase1DirectiveProcessor: Phase1DirectiveProcessor,
    private readonly schemaDirectiveProcessor: SchemaDirectiveProcessor,
    private readonly documentAggregationService: DocumentAggregationService,
    private readonly templateOutputRenderer: TemplateOutputRenderer,
    private readonly outputFormatter: OutputFormatterPort,
  ) {}

  /**
   * Creates a PipelineOrchestrator with required dependencies.
   */
  static create(
    fileSystem: FileSystemPort,
    customConfig?: ConfigurationManager,
  ): Result<PipelineOrchestrator, ProcessingError> {
    const configManager = customConfig || new ConfigurationManager();

    // Create output renderer
    const outputRendererResult = OutputRenderingService.create();
    if (outputRendererResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to create output renderer: ${outputRendererResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: outputRendererResult.unwrapError() },
        ),
      );
    }

    // Create ItemsProcessor dependencies
    const itemsDetector = ItemsDetector.create();
    const itemsExpander = ItemsExpander.create();
    const templateLoader = new FileSystemTemplateLoader(fileSystem);
    const itemsProcessor = ItemsProcessor.create(
      itemsDetector,
      itemsExpander,
      templateLoader,
    );

    // Create template renderer with ItemsProcessor
    const templateRendererResult = TemplateRenderer.create(itemsProcessor);
    if (templateRendererResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to create template renderer: ${templateRendererResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: templateRendererResult.unwrapError() },
        ),
      );
    }

    // Create domain services
    const frontmatterParsingServiceResult = FrontmatterParsingService.create(
      fileSystem,
    );
    if (frontmatterParsingServiceResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to create frontmatter parsing service: ${frontmatterParsingServiceResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: frontmatterParsingServiceResult.unwrapError() },
        ),
      );
    }

    const phase1DirectiveProcessorResult = Phase1DirectiveProcessor.create();
    if (phase1DirectiveProcessorResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to create phase 1 directive processor: ${phase1DirectiveProcessorResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: phase1DirectiveProcessorResult.unwrapError() },
        ),
      );
    }

    const schemaDirectiveProcessorResult = SchemaDirectiveProcessor.create(
      fileSystem,
    );
    if (schemaDirectiveProcessorResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to create schema directive processor: ${schemaDirectiveProcessorResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: schemaDirectiveProcessorResult.unwrapError() },
        ),
      );
    }

    const documentAggregationServiceResult = DocumentAggregationService.create(
      configManager,
    );
    if (documentAggregationServiceResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to create document aggregation service: ${documentAggregationServiceResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: documentAggregationServiceResult.unwrapError() },
        ),
      );
    }

    const templateOutputRendererResult = TemplateOutputRenderer.create(
      outputRendererResult.unwrap(),
      fileSystem,
    );
    if (templateOutputRendererResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to create template output renderer: ${templateOutputRendererResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: templateOutputRendererResult.unwrapError() },
        ),
      );
    }

    // Create template schema coordinator
    const schemaTemplateResolver = new SchemaTemplateResolver();
    const templateSchemaCoordinator = new TemplateSchemaCoordinator(
      templateRendererResult.unwrap(),
      schemaTemplateResolver,
      fileSystem,
    );

    // Create output formatter
    const outputFormatterResult = DefaultOutputFormatter.create();
    if (outputFormatterResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to create output formatter: ${outputFormatterResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: outputFormatterResult.unwrapError() },
        ),
      );
    }

    return Result.ok(
      new PipelineOrchestrator(
        fileSystem,
        configManager,
        templateSchemaCoordinator,
        frontmatterParsingServiceResult.unwrap(),
        phase1DirectiveProcessorResult.unwrap(),
        schemaDirectiveProcessorResult.unwrap(),
        documentAggregationServiceResult.unwrap(),
        templateOutputRendererResult.unwrap(),
        outputFormatterResult.unwrap(),
      ),
    );
  }

  /**
   * Executes the complete processing pipeline using Universal Pipeline.
   * Eliminates hardcoded special cases by delegating to strategy-based processing.
   */
  async execute(
    config: PipelineConfig,
  ): Promise<Result<PipelineResult, ProcessingError>> {
    // Track all errors encountered during processing
    const allErrors: ProcessingError[] = [];

    // Resolve input path to actual files if it's a single string
    // This handles directories and glob patterns
    let resolvedInputPath: string | string[] = config.inputPath;

    if (typeof config.inputPath === "string") {
      // Check if the input is a file or directory
      const statResult = await this.fileSystem.stat(config.inputPath);

      if (statResult.isOk()) {
        const info = statResult.unwrap();

        if (info.isFile) {
          // Single file: use as-is
          resolvedInputPath = [config.inputPath];
        } else if (info.isDirectory) {
          // Directory: read directory contents using FileSystemPort
          const dirResult = await this.fileSystem.readDir(config.inputPath);

          if (dirResult.isError()) {
            return Result.error(
              new ProcessingError(
                `Failed to read directory: ${dirResult.unwrapError().kind}`,
                "DIRECTORY_READ_ERROR",
                { inputPath: config.inputPath },
              ),
            );
          }

          const entries = dirResult.unwrap();
          const markdownFiles = entries
            .filter((entry) => entry.isFile && /\.md(own)?$/.test(entry.name))
            .map((entry) => `${config.inputPath}/${entry.name}`);

          if (markdownFiles.length === 0) {
            return Result.error(
              new ProcessingError(
                "No markdown files found in directory",
                "NO_DOCUMENTS_FOUND",
                { inputPath: config.inputPath },
              ),
            );
          }

          resolvedInputPath = markdownFiles;
        }
      } else {
        // Glob pattern or non-existent path: use utility (requires real filesystem)
        const resolvedFiles = await resolveInputToFiles([config.inputPath]);

        if (resolvedFiles.length === 0) {
          return Result.error(
            new ProcessingError(
              "No markdown files found matching the input pattern",
              "NO_FILES_FOUND",
              { inputPath: config.inputPath },
            ),
          );
        }

        resolvedInputPath = resolvedFiles;
      }
    }

    // Create Universal Pipeline configuration
    const pipelineConfig: UniversalPipelineConfig = {
      schemaPath: config.schemaPath,
      templatePath: config.templatePath,
      inputPath: resolvedInputPath,
      outputPath: config.outputPath,
      outputFormat: config.outputFormat,
      customConfiguration: this.configManager,
    };

    // Create Universal Pipeline
    const pipelineResult = UniversalPipeline.create(
      pipelineConfig,
      this.fileSystem,
      this, // PipelineOrchestrator implements DocumentLoader
    );

    if (pipelineResult.isError()) {
      return Result.error(pipelineResult.unwrapError());
    }

    const pipeline = pipelineResult.unwrap();

    // Execute pipeline stages
    const executionResult = await pipeline.execute();
    if (executionResult.isError()) {
      return Result.error(executionResult.unwrapError());
    }

    const result = executionResult.unwrap();

    // Store schema for Stage 0 transformation in loadMarkdownDocument()
    this.currentSchema = result.schema;

    // Load schema data for Phase 1 directive processing
    const schemaDataResult = await this.schemaDirectiveProcessor.loadSchemaData(
      config.schemaPath,
    );
    if (schemaDataResult.isError()) {
      return Result.error(schemaDataResult.unwrapError());
    }

    // Phase 1: Apply per-file directives to each document BEFORE template processing
    // DEBUG: Log document count
    if (typeof Deno !== "undefined" && Deno.env.get("DEBUG_PIPELINE")) {
      console.log(`[DEBUG] Processing ${result.documents.length} documents`);
    }

    const phase1ProcessedDocuments: MarkdownDocument[] = [];
    for (const document of result.documents) {
      const phase1Result = this.phase1DirectiveProcessor.processDocument(
        document,
        schemaDataResult.unwrap(),
      );
      if (phase1Result.isError()) {
        // Collect error but continue processing
        const error = phase1Result.unwrapError();
        allErrors.push(error);
        console.error(
          `⚠️  Warning: Failed to process ${document.getPath().toString()}: ${error.message}`,
        );
        // Skip this document and continue with others
        continue;
      }
      phase1ProcessedDocuments.push(phase1Result.unwrap());
    }

    // Phase 2: Check if schema has x-template to determine processing path
    const schemaData = schemaDataResult.unwrap();
    const hasXTemplate = schemaData["x-template"];

    // Branch: Use coordinator if x-template exists, otherwise use traditional flow
    if (hasXTemplate) {
      // === COORDINATOR PATH (for schemas with x-template) ===
      // Extract FrontmatterData from documents for coordinator
      // Documents without frontmatter get empty FrontmatterData
      // DEBUG: Log frontmatter extraction
      if (typeof Deno !== "undefined" && Deno.env.get("DEBUG_PIPELINE")) {
        console.log(
          `[DEBUG] Extracting frontmatter from ${phase1ProcessedDocuments.length} documents`,
        );
      }

      const frontmatterDataArray: FrontmatterData[] = [];
      for (const doc of phase1ProcessedDocuments) {
        const frontmatter = doc.getFrontmatter();
        if (frontmatter) {
          frontmatterDataArray.push(frontmatter);
          if (typeof Deno !== "undefined" && Deno.env.get("DEBUG_PIPELINE")) {
            console.log(
              `[DEBUG] Document has frontmatter:`,
              Object.keys(frontmatter.getData()),
            );
          }
        } else {
          // Create empty FrontmatterData for documents without frontmatter
          const emptyDataResult = FrontmatterData.create({});
          if (emptyDataResult.isError()) {
            // Warn but continue processing
            const error = new ProcessingError(
              `Failed to create empty frontmatter data for ${doc.getPath().toString()}: ${emptyDataResult.unwrapError().message}`,
              "FRONTMATTER_CREATION_ERROR",
              { error: emptyDataResult.unwrapError() },
            );
            allErrors.push(error);
            console.error(`⚠️  Warning: ${error.message}`);
            // Skip this document
            continue;
          }
          frontmatterDataArray.push(emptyDataResult.unwrap());
        }
      }

      // Mark schema as resolved with loaded data
      const resolvedSchema = result.schema.markAsResolved(
        schemaData as Record<string, unknown> & { type: string },
      );

      // Use TemplateSchemaCoordinator for template rendering with ItemsProcessor
      const coordinatorResult = await this.templateSchemaCoordinator
        .processWithSchemaTemplates(
          resolvedSchema,
          frontmatterDataArray,
        );
      if (coordinatorResult.isError()) {
        const error = coordinatorResult.unwrapError();
        allErrors.push(error);
        console.error(
          `⚠️  Warning: Template coordinator failed: ${error.message}`,
        );
        // Cannot continue without coordinator output - use empty object
      }

      // Parse coordinator output to apply schema directives
      const outputContent = coordinatorResult.isError()
        ? "{}"
        : coordinatorResult.unwrap().content;
      let outputData: Record<string, unknown>;
      try {
        outputData = JSON.parse(outputContent);
      } catch (parseError) {
        const error = new ProcessingError(
          `Failed to parse coordinator output: ${
            parseError instanceof Error
              ? parseError.message
              : String(parseError)
          }`,
          "COORDINATOR_OUTPUT_PARSE_ERROR",
          { error: parseError },
        );
        allErrors.push(error);
        console.error(`⚠️  Warning: ${error.message}`);
        outputData = {}; // Use empty object as fallback
      }

      // Apply schema directives (x-derived-from, x-derived-unique, etc.)
      const directivesResult = this.schemaDirectiveProcessor
        .applySchemaDirectives(
          outputData,
          schemaData,
        );
      if (directivesResult.isError()) {
        const error = directivesResult.unwrapError();
        allErrors.push(error);
        console.error(
          `⚠️  Warning: Failed to apply schema directives: ${error.message}`,
        );
        // Continue with original data if directives fail
      }

      // Format conversion and output writing using OutputFormatter
      const outputFormat = result.outputFormat as OutputFormatType;

      const dataToWrite = directivesResult.isError()
        ? outputData
        : directivesResult.unwrap();

      const formatResult = this.outputFormatter.format(
        dataToWrite,
        outputFormat,
      );
      if (formatResult.isError()) {
        const error = new ProcessingError(
          `Failed to format output: ${formatResult.unwrapError().message}`,
          "OUTPUT_FORMAT_ERROR",
          { outputFormat, error: formatResult.unwrapError() },
        );
        allErrors.push(error);
        console.error(`⚠️  Warning: ${error.message}`);
        // Fallback to JSON if formatting fails
      }
      const finalOutput = formatResult.isOk()
        ? formatResult.unwrap()
        : JSON.stringify(dataToWrite, null, 2);

      const finalWriteResult = await this.fileSystem.writeTextFile(
        config.outputPath,
        finalOutput,
      );
      if (finalWriteResult.isError()) {
        const error = new ProcessingError(
          `Failed to write final output: ${
            createFileError(finalWriteResult.unwrapError()).message
          }`,
          "OUTPUT_WRITE_ERROR",
          {
            outputPath: config.outputPath,
            error: finalWriteResult.unwrapError(),
          },
        );
        allErrors.push(error);
        console.error(`⚠️  Warning: ${error.message}`);
        // Continue - processing completed but output write failed
      }
    } else {
      // === TRADITIONAL PATH (for schemas without x-template) ===
      // Phase 2: Transform documents using document aggregation service with schema
      const transformedData = this.documentAggregationService
        .transformDocuments(
          phase1ProcessedDocuments,
          result.template,
          schemaData,
        );
      if (transformedData.isError()) {
        return Result.error(transformedData.unwrapError());
      }

      // Apply schema directives (x-derived-from, x-derived-unique, etc.)
      const directivesResult = this.schemaDirectiveProcessor
        .applySchemaDirectives(
          transformedData.unwrap(),
          schemaData,
        );
      if (directivesResult.isError()) {
        const error = directivesResult.unwrapError();
        allErrors.push(error);
        console.error(
          `⚠️  Warning: Failed to apply schema directives: ${error.message}`,
        );
        // Continue with original data if directives fail
      }

      // Render output using template output renderer with schema
      const renderingResult = await this.templateOutputRenderer.renderOutput(
        result.template,
        directivesResult.isError()
          ? transformedData.unwrap()
          : directivesResult.unwrap(),
        result.outputFormat as "json" | "yaml" | "xml" | "markdown",
        config.outputPath,
        schemaData,
      );
      if (renderingResult.isError()) {
        const error = renderingResult.unwrapError();
        allErrors.push(error);
        console.error(
          `⚠️  Warning: Failed to render output: ${error.message}`,
        );
        // Continue - output may be partial
      }
    }

    return Result.ok({
      processedDocuments: result.documents.length,
      outputPath: config.outputPath,
      executionTime: result.executionTime,
      metadata: {
        schemaPath: config.schemaPath,
        templatePath: config.templatePath,
        outputFormat: result.outputFormat,
        errors: allErrors.length > 0 ? allErrors : undefined,
        warnings: allErrors.length,
      },
    });
  }

  /**
   * Implements DocumentLoader interface for Universal Pipeline.
   * Replaces hardcoded document loading with configurable approach.
   * Passes schema to enable Stage 0 transformation (yaml-schema-mapper).
   */
  async loadMarkdownDocument(
    filePath: string,
    schema?: Schema,
  ): Promise<Result<MarkdownDocument, ProcessingError>> {
    // Use provided schema or fallback to currentSchema for backward compatibility
    const schemaToUse = schema || this.currentSchema;
    // Delegate to frontmatter parsing service with schema for Stage 0 transformation
    return await this.frontmatterParsingService.loadMarkdownDocument(
      filePath,
      schemaToUse,
    );
  }
}
