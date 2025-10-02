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
import {
  UniversalPipeline,
  UniversalPipelineConfig,
} from "../universal-pipeline.ts";
import { DocumentLoader } from "../strategies/input-processing-strategy.ts";
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
  readonly inputPath: string;
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
  };
}

/**
 * Application service for orchestrating the complete document processing pipeline.
 * Refactored to use Universal Pipeline with strategy patterns instead of hardcoded special cases.
 * Eliminates architectural violations by delegating to configurable pipeline stages.
 */
export class PipelineOrchestrator implements DocumentLoader {
  private constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly configManager: ConfigurationManager,
    private readonly templateSchemaCoordinator: TemplateSchemaCoordinator,
    private readonly frontmatterParsingService: FrontmatterParsingService,
    private readonly phase1DirectiveProcessor: Phase1DirectiveProcessor,
    private readonly schemaDirectiveProcessor: SchemaDirectiveProcessor,
    private readonly documentAggregationService: DocumentAggregationService,
    private readonly templateOutputRenderer: TemplateOutputRenderer,
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
    // Create Universal Pipeline configuration
    const pipelineConfig: UniversalPipelineConfig = {
      schemaPath: config.schemaPath,
      templatePath: config.templatePath,
      inputPath: config.inputPath,
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

    // Load schema early to use for Phase 1 directive processing and property name mapping
    const schemaDataResult = await this.schemaDirectiveProcessor.loadSchemaData(
      config.schemaPath,
    );
    if (schemaDataResult.isError()) {
      return Result.error(schemaDataResult.unwrapError());
    }

    // Phase 1: Apply per-file directives to each document BEFORE template processing
    const phase1ProcessedDocuments: MarkdownDocument[] = [];
    for (const document of result.documents) {
      const phase1Result = this.phase1DirectiveProcessor.processDocument(
        document,
        schemaDataResult.unwrap(),
      );
      if (phase1Result.isError()) {
        return Result.error(phase1Result.unwrapError());
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
      const frontmatterDataArray: FrontmatterData[] = [];
      for (const doc of phase1ProcessedDocuments) {
        const frontmatter = doc.getFrontmatter();
        if (frontmatter) {
          frontmatterDataArray.push(frontmatter);
        } else {
          // Create empty FrontmatterData for documents without frontmatter
          const emptyDataResult = FrontmatterData.create({});
          if (emptyDataResult.isError()) {
            return Result.error(
              new ProcessingError(
                `Failed to create empty frontmatter data: ${emptyDataResult.unwrapError().message}`,
                "FRONTMATTER_CREATION_ERROR",
                { error: emptyDataResult.unwrapError() },
              ),
            );
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
        return Result.error(coordinatorResult.unwrapError());
      }

      // Parse coordinator output to apply schema directives
      const outputContent = coordinatorResult.unwrap().content;
      let outputData: Record<string, unknown>;
      try {
        outputData = JSON.parse(outputContent);
      } catch (parseError) {
        return Result.error(
          new ProcessingError(
            `Failed to parse coordinator output: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }`,
            "COORDINATOR_OUTPUT_PARSE_ERROR",
            { error: parseError },
          ),
        );
      }

      // Apply schema directives (x-derived-from, x-derived-unique, etc.)
      const directivesResult = this.schemaDirectiveProcessor
        .applySchemaDirectives(
          outputData,
          schemaData,
        );
      if (directivesResult.isError()) {
        return Result.error(directivesResult.unwrapError());
      }

      // Format conversion and output writing
      const outputFormat = result.outputFormat as
        | "json"
        | "yaml"
        | "xml"
        | "markdown";
      let finalOutput: string;

      if (outputFormat === "json") {
        finalOutput = JSON.stringify(directivesResult.unwrap(), null, 2);
      } else if (outputFormat === "yaml") {
        const { stringify } = await import("@std/yaml");
        finalOutput = stringify(directivesResult.unwrap());
      } else {
        // For now, fall back to JSON for xml and markdown
        finalOutput = JSON.stringify(directivesResult.unwrap(), null, 2);
      }

      const finalWriteResult = await this.fileSystem.writeTextFile(
        config.outputPath,
        finalOutput,
      );
      if (finalWriteResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to write final output: ${
              createFileError(finalWriteResult.unwrapError()).message
            }`,
            "OUTPUT_WRITE_ERROR",
            {
              outputPath: config.outputPath,
              error: finalWriteResult.unwrapError(),
            },
          ),
        );
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
        return Result.error(directivesResult.unwrapError());
      }

      // Render output using template output renderer with schema
      const renderingResult = await this.templateOutputRenderer.renderOutput(
        result.template,
        directivesResult.unwrap(),
        result.outputFormat as "json" | "yaml" | "xml" | "markdown",
        config.outputPath,
        schemaData,
      );
      if (renderingResult.isError()) {
        return Result.error(renderingResult.unwrapError());
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
      },
    });
  }

  /**
   * Implements DocumentLoader interface for Universal Pipeline.
   * Replaces hardcoded document loading with configurable approach.
   */
  async loadMarkdownDocument(
    filePath: string,
  ): Promise<Result<MarkdownDocument, ProcessingError>> {
    // Delegate to frontmatter parsing service
    return await this.frontmatterParsingService.loadMarkdownDocument(filePath);
  }
}
