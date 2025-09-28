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
 */
export class PipelineOrchestrator {
  private constructor(
    private readonly templateLoader: TemplateLoader,
    private readonly outputRenderer: OutputRenderingService,
  ) {}

  /**
   * Creates a PipelineOrchestrator with required dependencies.
   */
  static create(): Result<PipelineOrchestrator, ProcessingError> {
    // Create template loader
    const templateLoader = TemplateLoader.create({
      async readTextFile(path: string): Promise<string> {
        try {
          return await Deno.readTextFile(path);
        } catch (error) {
          throw new Error(
            `Failed to read file ${path}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      async exists(path: string): Promise<boolean> {
        try {
          await Deno.stat(path);
          return true;
        } catch {
          return false;
        }
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

    try {
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
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new ProcessingError(
          `Pipeline execution failed: ${errorMessage}`,
          "PIPELINE_ERROR",
          { config, error },
        ),
      );
    }
  }

  /**
   * Loads and validates the schema file.
   */
  private async loadSchema(
    schemaPath: string,
  ): Promise<Result<Schema, ProcessingError>> {
    try {
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

      // Read schema file
      const schemaContent = await Deno.readTextFile(schemaPath);
      const _schemaData = JSON.parse(schemaContent);

      // Create schema entity - Note: This creates an unloaded schema
      // In a full implementation, we'd need a service to load and resolve the schema
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
      const schemaId = schemaIdResult.unwrap();
      const schema = Schema.create(schemaId, pathResult.unwrap());

      return Result.ok(schema);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new ProcessingError(
          `Failed to load schema: ${errorMessage}`,
          "SCHEMA_LOAD_ERROR",
          { schemaPath, error },
        ),
      );
    }
  }

  /**
   * Loads the template file.
   */
  private async loadTemplate(
    templatePath: string,
  ): Promise<Result<Template, ProcessingError>> {
    try {
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
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new ProcessingError(
          `Failed to load template: ${errorMessage}`,
          "TEMPLATE_LOAD_ERROR",
          { templatePath, error },
        ),
      );
    }
  }

  /**
   * Processes input documents from the specified path.
   */
  private async processInputDocuments(
    inputPath: string,
  ): Promise<Result<MarkdownDocument[], ProcessingError>> {
    try {
      // Check if input is a file or directory
      const fileInfo = await Deno.stat(inputPath);

      if (fileInfo.isFile) {
        // Single file processing
        const document = await this.loadMarkdownDocument(inputPath);
        if (document.isError()) {
          return Result.error(document.unwrapError());
        }
        return Result.ok([document.unwrap()]);
      } else if (fileInfo.isDirectory) {
        // Directory processing - find all markdown files
        const documents: MarkdownDocument[] = [];

        for await (const entry of Deno.readDir(inputPath)) {
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
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new ProcessingError(
          `Failed to process input documents: ${errorMessage}`,
          "INPUT_PROCESSING_ERROR",
          { inputPath, error },
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
    try {
      const content = await Deno.readTextFile(filePath);

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

      // Parse frontmatter manually (simplified implementation)
      const { frontmatter, content: markdownContent } = this.parseFrontmatter(
        content,
      );

      // Create document ID and entity
      const documentId = DocumentId.fromPath(filePathResult.unwrap());
      const frontmatterData = frontmatter
        ? FrontmatterData.create(frontmatter).unwrap()
        : undefined;
      const document = MarkdownDocument.create(
        documentId,
        filePathResult.unwrap(),
        markdownContent,
        frontmatterData,
      );

      return Result.ok(document);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new ProcessingError(
          `Failed to load document: ${errorMessage}`,
          "DOCUMENT_LOAD_ERROR",
          { filePath, error },
        ),
      );
    }
  }

  /**
   * Parses frontmatter from markdown content (simplified implementation).
   */
  private parseFrontmatter(
    content: string,
  ): { frontmatter?: Record<string, unknown>; content: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { content };
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

      return { frontmatter, content: markdownContent };
    } catch {
      // If parsing fails, treat as regular content
      return { content };
    }
  }

  /**
   * Transforms documents using schema and template.
   * For single documents, returns frontmatter data directly for variable resolution.
   * For multiple documents, returns aggregated structure.
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
        // Apply {@items} expansion using domain services
        // This would integrate with the ItemsProcessor we implemented earlier
        // For now, provide basic array data for template rendering
        return Result.ok({
          ...aggregatedData,
          items: allFrontmatterData, // Provide items for {@items} expansion
        });
      }

      return Result.ok(aggregatedData);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new ProcessingError(
          `Document transformation failed: ${errorMessage}`,
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
    try {
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

      // Write to output file
      await Deno.writeTextFile(outputPath, renderingResult.unwrap());

      return Result.ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new ProcessingError(
          `Failed to write output: ${errorMessage}`,
          "OUTPUT_WRITE_ERROR",
          { outputPath, error },
        ),
      );
    }
  }
}
