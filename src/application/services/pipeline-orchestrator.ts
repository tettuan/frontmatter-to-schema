import { Result } from "../../domain/shared/types/result.ts";
import { ProcessingError } from "../../domain/shared/types/errors.ts";
import { OutputRenderingService } from "../../domain/template/index.ts";
import {
  DocumentId,
  MarkdownDocument,
} from "../../domain/frontmatter/entities/markdown-document.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { FilePath } from "../../domain/shared/value-objects/file-path.ts";
import { FileSystemPort } from "../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../domain/shared/types/file-errors.ts";
import {
  UniversalPipeline,
  UniversalPipelineConfig,
} from "../universal-pipeline.ts";
import { DocumentLoader } from "../strategies/input-processing-strategy.ts";
import { ConfigurationManager } from "../strategies/configuration-strategy.ts";

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
    private readonly outputRenderer: OutputRenderingService,
    private readonly fileSystem: FileSystemPort,
    private readonly configManager: ConfigurationManager,
  ) {}

  /**
   * Creates a PipelineOrchestrator with required dependencies.
   */
  static create(
    fileSystem: FileSystemPort,
    customConfig?: ConfigurationManager,
  ): Result<PipelineOrchestrator, ProcessingError> {
    // Create output renderer
    const outputRendererResult = OutputRenderingService.create();
    if (outputRendererResult.isError()) {
      const configManager = customConfig || new ConfigurationManager();
      const errorMessages = configManager.getObjectDefault("errorMessages")
        .unwrap() as Record<string, string>;

      return Result.error(
        new ProcessingError(
          `${
            errorMessages["INITIALIZATION_ERROR"] ||
            "Failed to create output renderer"
          }: ${outputRendererResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: outputRendererResult.unwrapError() },
        ),
      );
    }

    const configManager = customConfig || new ConfigurationManager();

    return Result.ok(
      new PipelineOrchestrator(
        outputRendererResult.unwrap(),
        fileSystem,
        configManager,
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

    // Transform documents using schema and template
    const transformedData = this.transformDocuments(
      result.documents,
      result.schema,
      result.template,
    );
    if (transformedData.isError()) {
      return Result.error(transformedData.unwrapError());
    }

    // Render output using configured format (no hardcoded default)
    const renderingResult = await this.renderOutput(
      result.template,
      transformedData.unwrap(),
      result.outputFormat as "json" | "yaml",
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
    // Read file using FileSystemPort
    const contentResult = await this.fileSystem.readTextFile(filePath);
    if (contentResult.isError()) {
      const errorMessages = this.configManager.getObjectDefault("errorMessages")
        .unwrap() as Record<string, string>;
      return Result.error(
        new ProcessingError(
          `${
            errorMessages["DOCUMENT_READ_ERROR"] || "Failed to read document"
          }: ${createFileError(contentResult.unwrapError()).message}`,
          "DOCUMENT_READ_ERROR",
          { filePath, error: contentResult.unwrapError() },
        ),
      );
    }

    // Create file path object
    const filePathResult = FilePath.create(filePath);
    if (filePathResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Invalid file path: ${filePathResult.unwrapError().message}`,
          "INVALID_FILE_PATH",
          { filePath },
        ),
      );
    }

    // Parse frontmatter
    const frontmatterResult = this.parseFrontmatter(contentResult.unwrap());
    if (frontmatterResult.isError()) {
      const errorMessages = this.configManager.getObjectDefault("errorMessages")
        .unwrap() as Record<string, string>;
      return Result.error(
        new ProcessingError(
          `${
            errorMessages["FRONTMATTER_PARSE_ERROR"] ||
            "Frontmatter parsing failed"
          }: ${frontmatterResult.unwrapError().message}`,
          "FRONTMATTER_PARSE_ERROR",
          { filePath, error: frontmatterResult.unwrapError() },
        ),
      );
    }

    const { frontmatter, content: markdownContent } = frontmatterResult
      .unwrap();

    // Create document ID and entity
    const documentId = DocumentId.fromPath(filePathResult.unwrap());

    // Handle frontmatter data creation safely
    let frontmatterData: FrontmatterData | undefined;
    if (frontmatter) {
      const frontmatterDataResult = FrontmatterData.create(frontmatter);
      if (frontmatterDataResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Invalid frontmatter data: ${frontmatterDataResult.unwrapError().message}`,
            "INVALID_FRONTMATTER_DATA",
            { filePath, error: frontmatterDataResult.unwrapError() },
          ),
        );
      }
      frontmatterData = frontmatterDataResult.unwrap();
    }

    const document = MarkdownDocument.create(
      documentId,
      filePathResult.unwrap(),
      markdownContent,
      frontmatterData,
    );

    return Result.ok(document);
  }

  /**
   * Parses frontmatter from markdown content.
   * Returns Result type following totality principles.
   */
  private parseFrontmatter(
    content: string,
  ): Result<
    { frontmatter?: Record<string, unknown>; content: string },
    ProcessingError
  > {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return Result.ok({ content });
    }

    try {
      // Simple YAML parsing - in production would use proper YAML parser
      const yamlContent = match[1];
      const markdownContent = match[2];

      // Basic key-value parsing (simplified)
      const frontmatter: Record<string, unknown> = {};
      const lines = yamlContent.split("\n");

      for (const line of lines) {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, "");
          frontmatter[key] = cleanValue;
        }
      }

      return Result.ok({ frontmatter, content: markdownContent });
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to parse YAML frontmatter: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "YAML_PARSE_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Transforms documents using schema and template.
   * Uses configuration strategy for metadata generation.
   */
  private transformDocuments(
    documents: MarkdownDocument[],
    _schema: any,
    template: any,
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      // Extract frontmatter data from all documents
      const allFrontmatterData: Record<string, unknown>[] = [];

      for (const document of documents) {
        const frontmatter = document.getFrontmatter();
        if (frontmatter) {
          allFrontmatterData.push(frontmatter.getData());
        }
      }

      // Single document processing: return frontmatter directly for variable resolution
      if (documents.length === 1 && allFrontmatterData.length === 1) {
        return Result.ok(allFrontmatterData[0]);
      }

      // Multiple document processing: create aggregate data structure
      const includeMetadataResult = this.configManager.getBooleanDefault(
        "includeMetadata",
      );
      const includeMetadata = includeMetadataResult.isOk()
        ? includeMetadataResult.unwrap()
        : true;

      const aggregatedData: Record<string, unknown> = {
        documents: allFrontmatterData,
        totalDocuments: documents.length,
      };

      if (includeMetadata) {
        aggregatedData.processedAt = new Date().toISOString();
      }

      // Check if template requires {@items} processing
      if (template.hasItemsExpansion()) {
        return Result.ok({
          ...aggregatedData,
          items: allFrontmatterData,
        });
      }

      return Result.ok(aggregatedData);
    } catch (error) {
      const errorMessages = this.configManager.getObjectDefault("errorMessages")
        .unwrap() as Record<string, string>;
      return Result.error(
        new ProcessingError(
          `${
            errorMessages["TRANSFORMATION_ERROR"] ||
            "Document transformation failed"
          }: ${error instanceof Error ? error.message : String(error)}`,
          "TRANSFORMATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Renders the final output and writes to file.
   * Uses configuration strategy for error messages.
   */
  private async renderOutput(
    template: any,
    data: Record<string, unknown>,
    format: "json" | "yaml",
    outputPath: string,
  ): Promise<Result<void, ProcessingError>> {
    const errorMessages = this.configManager.getObjectDefault("errorMessages")
      .unwrap() as Record<string, string>;

    // Render using OutputRenderingService
    const renderingResult = this.outputRenderer.renderSimple(
      template,
      data,
      format,
    );
    if (renderingResult.isError()) {
      return Result.error(
        new ProcessingError(
          `${
            errorMessages["RENDERING_ERROR"] || "Output rendering failed"
          }: ${renderingResult.unwrapError().message}`,
          "RENDERING_ERROR",
          { error: renderingResult.unwrapError() },
        ),
      );
    }

    // Write to output file using FileSystemPort
    const writeResult = await this.fileSystem.writeTextFile(
      outputPath,
      renderingResult.unwrap(),
    );
    if (writeResult.isError()) {
      return Result.error(
        new ProcessingError(
          `${
            errorMessages["OUTPUT_WRITE_ERROR"] || "Failed to write output"
          }: ${createFileError(writeResult.unwrapError()).message}`,
          "OUTPUT_WRITE_ERROR",
          { outputPath, error: writeResult.unwrapError() },
        ),
      );
    }

    return Result.ok(undefined);
  }
}
