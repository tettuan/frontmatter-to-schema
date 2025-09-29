import { Result } from "../../domain/shared/types/result.ts";
import { ProcessingError } from "../../domain/shared/types/errors.ts";
import { OutputRenderingService } from "../../domain/template/index.ts";
import {
  MarkdownDocument,
} from "../../domain/frontmatter/entities/markdown-document.ts";
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

/**
 * Configuration for pipeline execution
 */
export interface PipelineConfig {
  readonly schemaPath: string;
  readonly templatePath: string;
  readonly inputPath: string;
  readonly outputPath: string;
  readonly outputFormat?: "json" | "yaml";
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

    // Create template renderer
    const templateRendererResult = TemplateRenderer.create();
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

    // Transform documents using document aggregation service
    const transformedData = this.documentAggregationService.transformDocuments(
      result.documents,
      result.template,
    );
    if (transformedData.isError()) {
      return Result.error(transformedData.unwrapError());
    }

    // Load and process schema with directives
    const schemaDataResult = await this.schemaDirectiveProcessor.loadSchemaData(
      config.schemaPath,
    );
    if (schemaDataResult.isError()) {
      return Result.error(schemaDataResult.unwrapError());
    }

    // Apply schema directives (x-derived-from, x-derived-unique, etc.)
    const directivesResult = this.schemaDirectiveProcessor
      .applySchemaDirectives(
        transformedData.unwrap(),
        schemaDataResult.unwrap(),
      );
    if (directivesResult.isError()) {
      return Result.error(directivesResult.unwrapError());
    }

    // Render output using template output renderer
    const renderingResult = await this.templateOutputRenderer.renderOutput(
      result.template,
      directivesResult.unwrap(),
      result.outputFormat as "json" | "yaml" | "xml" | "markdown",
      config.outputPath,
    );
    if (renderingResult.isError()) {
      return Result.error(renderingResult.unwrapError());
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
