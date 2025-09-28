import { Result } from "../../domain/shared/types/result.ts";
import { ProcessingError } from "../../domain/shared/types/errors.ts";
import { Schema, SchemaPath } from "../../domain/schema/index.ts";
import { SchemaId } from "../../domain/schema/entities/schema.ts";
import {
  OutputRenderingService,
  Template,
  TemplateLoader,
  TemplatePath,
} from "../../domain/template/index.ts";
import {
  DocumentId,
  MarkdownDocument,
} from "../../domain/frontmatter/entities/markdown-document.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { FilePath } from "../../domain/shared/value-objects/file-path.ts";
import { FileSystemPort } from "../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../domain/shared/types/file-errors.ts";

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
 * Coordinates Schema, Template, and Frontmatter domains to transform documents.
 * Follows totality principles - all operations return Result<T, E>.
 */
export class PipelineOrchestrator {
  private constructor(
    private readonly templateLoader: TemplateLoader,
    private readonly outputRenderer: OutputRenderingService,
    private readonly fileSystem: FileSystemPort,
  ) {}

  /**
   * Creates a PipelineOrchestrator with required dependencies.
   */
  static create(
    fileSystem: FileSystemPort,
  ): Result<PipelineOrchestrator, ProcessingError> {
    // Create template loader with FileSystemPort adapter
    const templateLoader = TemplateLoader.create({
      async readTextFile(path: string): Promise<string> {
        const result = await fileSystem.readTextFile(path);
        if (result.isError()) {
          throw new Error(createFileError(result.unwrapError()).message);
        }
        return result.unwrap();
      },
      async exists(path: string): Promise<boolean> {
        const result = await fileSystem.exists(path);
        if (result.isError()) {
          return false; // Treat errors as non-existence for backward compatibility
        }
        return result.unwrap();
      },
    });

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

    return Result.ok(
      new PipelineOrchestrator(
        templateLoader,
        outputRendererResult.unwrap(),
        fileSystem,
      ),
    );
  }

  /**
   * Executes the complete processing pipeline.
   */
  async execute(
    config: PipelineConfig,
  ): Promise<Result<PipelineResult, ProcessingError>> {
    const startTime = performance.now();

    // 1. Load and validate schema
    const schema = await this.loadSchema(config.schemaPath);
    if (schema.isError()) {
      return Result.error(schema.unwrapError());
    }

    // 2. Load template
    const template = await this.loadTemplate(config.templatePath);
    if (template.isError()) {
      return Result.error(template.unwrapError());
    }

    // 3. Process input documents
    const documents = await this.processInputDocuments(config.inputPath);
    if (documents.isError()) {
      return Result.error(documents.unwrapError());
    }

    // 4. Transform documents using schema and template
    const transformedData = this.transformDocuments(
      documents.unwrap(),
      schema.unwrap(),
      template.unwrap(),
    );
    if (transformedData.isError()) {
      return Result.error(transformedData.unwrapError());
    }

    // 5. Render output
    const outputFormat = config.outputFormat || "json";
    const renderingResult = await this.renderOutput(
      template.unwrap(),
      transformedData.unwrap(),
      outputFormat,
      config.outputPath,
    );
    if (renderingResult.isError()) {
      return Result.error(renderingResult.unwrapError());
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    return Result.ok({
      processedDocuments: documents.unwrap().length,
      outputPath: config.outputPath,
      executionTime,
      metadata: {
        schemaPath: config.schemaPath,
        templatePath: config.templatePath,
        outputFormat,
      },
    });
  }

  /**
   * Loads and validates the schema file.
   */
  private async loadSchema(
    schemaPath: string,
  ): Promise<Result<Schema, ProcessingError>> {
    // Create schema path
    const pathResult = SchemaPath.create(schemaPath);
    if (pathResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Invalid schema path: ${pathResult.unwrapError().message}`,
          "INVALID_SCHEMA_PATH",
          { schemaPath },
        ),
      );
    }

    // Read schema file using FileSystemPort
    const contentResult = await this.fileSystem.readTextFile(schemaPath);
    if (contentResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to read schema file: ${
            createFileError(contentResult.unwrapError()).message
          }`,
          "SCHEMA_READ_ERROR",
          { schemaPath, error: contentResult.unwrapError() },
        ),
      );
    }

    // Parse JSON
    try {
      JSON.parse(contentResult.unwrap());
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Invalid JSON in schema file: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "SCHEMA_PARSE_ERROR",
          { schemaPath, error },
        ),
      );
    }

    // Create schema entity
    const schemaIdResult = SchemaId.create(
      pathResult.unwrap().getSchemaName(),
    );
    if (schemaIdResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Invalid schema ID: ${schemaIdResult.unwrapError().message}`,
          "INVALID_SCHEMA_ID",
          { schemaPath },
        ),
      );
    }

    const schema = Schema.create(schemaIdResult.unwrap(), pathResult.unwrap());
    return Result.ok(schema);
  }

  /**
   * Loads the template file.
   */
  private async loadTemplate(
    templatePath: string,
  ): Promise<Result<Template, ProcessingError>> {
    // Create template path
    const pathResult = TemplatePath.create(templatePath);
    if (pathResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Invalid template path: ${pathResult.unwrapError().message}`,
          "INVALID_TEMPLATE_PATH",
          { templatePath },
        ),
      );
    }

    // Load template using domain service
    const templateResult = await this.templateLoader.loadTemplate(
      pathResult.unwrap(),
    );
    if (templateResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Template loading failed: ${templateResult.unwrapError().message}`,
          "TEMPLATE_LOAD_ERROR",
          { templatePath, error: templateResult.unwrapError() },
        ),
      );
    }

    return Result.ok(templateResult.unwrap());
  }

  /**
   * Processes input documents from the specified path.
   */
  private async processInputDocuments(
    inputPath: string,
  ): Promise<Result<MarkdownDocument[], ProcessingError>> {
    // Get file info using FileSystemPort
    const statResult = await this.fileSystem.stat(inputPath);
    if (statResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Cannot access input path: ${
            createFileError(statResult.unwrapError()).message
          }`,
          "INPUT_ACCESS_ERROR",
          { inputPath, error: statResult.unwrapError() },
        ),
      );
    }

    const fileInfo = statResult.unwrap();

    if (fileInfo.isFile) {
      // Single file processing
      const document = await this.loadMarkdownDocument(inputPath);
      if (document.isError()) {
        return Result.error(document.unwrapError());
      }
      return Result.ok([document.unwrap()]);
    } else if (fileInfo.isDirectory) {
      // Directory processing - find all markdown files
      const dirResult = await this.fileSystem.readDir(inputPath);
      if (dirResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Cannot read directory: ${
              createFileError(dirResult.unwrapError()).message
            }`,
            "DIRECTORY_READ_ERROR",
            { inputPath, error: dirResult.unwrapError() },
          ),
        );
      }

      const documents: MarkdownDocument[] = [];
      const entries = dirResult.unwrap();

      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith(".md")) {
          const filePath = `${inputPath}/${entry.name}`;
          const document = await this.loadMarkdownDocument(filePath);
          if (document.isOk()) {
            documents.push(document.unwrap());
          }
          // Continue processing other files even if one fails
        }
      }

      if (documents.length === 0) {
        return Result.error(
          new ProcessingError(
            "No valid markdown documents found in directory",
            "NO_DOCUMENTS_FOUND",
            { inputPath },
          ),
        );
      }

      return Result.ok(documents);
    } else {
      return Result.error(
        new ProcessingError(
          "Input path must be a file or directory",
          "INVALID_INPUT_PATH",
          { inputPath },
        ),
      );
    }
  }

  /**
   * Loads a single markdown document.
   */
  private async loadMarkdownDocument(
    filePath: string,
  ): Promise<Result<MarkdownDocument, ProcessingError>> {
    // Read file using FileSystemPort
    const contentResult = await this.fileSystem.readTextFile(filePath);
    if (contentResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Failed to read document: ${
            createFileError(contentResult.unwrapError()).message
          }`,
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
      return Result.error(
        new ProcessingError(
          `Frontmatter parsing failed: ${frontmatterResult.unwrapError().message}`,
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
   */
  private transformDocuments(
    documents: MarkdownDocument[],
    _schema: Schema,
    template: Template,
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
      const aggregatedData: Record<string, unknown> = {
        documents: allFrontmatterData,
        totalDocuments: documents.length,
        processedAt: new Date().toISOString(),
      };

      // Check if template requires {@items} processing
      if (template.hasItemsExpansion()) {
        return Result.ok({
          ...aggregatedData,
          items: allFrontmatterData,
        });
      }

      return Result.ok(aggregatedData);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Document transformation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TRANSFORMATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Renders the final output and writes to file.
   */
  private async renderOutput(
    template: Template,
    data: Record<string, unknown>,
    format: "json" | "yaml",
    outputPath: string,
  ): Promise<Result<void, ProcessingError>> {
    // Render using OutputRenderingService
    const renderingResult = this.outputRenderer.renderSimple(
      template,
      data,
      format,
    );
    if (renderingResult.isError()) {
      return Result.error(
        new ProcessingError(
          `Output rendering failed: ${renderingResult.unwrapError().message}`,
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
          `Failed to write output: ${
            createFileError(writeResult.unwrapError()).message
          }`,
          "OUTPUT_WRITE_ERROR",
          { outputPath, error: writeResult.unwrapError() },
        ),
      );
    }

    return Result.ok(undefined);
  }
}
