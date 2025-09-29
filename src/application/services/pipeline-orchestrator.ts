import { Result } from "../../domain/shared/types/result.ts";
import { ProcessingError } from "../../domain/shared/types/errors.ts";
import { OutputRenderingService } from "../../domain/template/index.ts";
import { Template } from "../../domain/template/entities/template.ts";
import { TemplatePath } from "../../domain/template/value-objects/template-path.ts";
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

    // Load the raw schema data for directive processing
    const schemaDataResult = await this.loadSchemaData(config.schemaPath);
    if (schemaDataResult.isError()) {
      return Result.error(schemaDataResult.unwrapError());
    }

    // Apply schema directives (x-derived-from, x-derived-unique, etc.)
    const directivesResult = this.applySchemaDirectives(
      transformedData.unwrap(),
      schemaDataResult.unwrap(),
    );
    if (directivesResult.isError()) {
      return Result.error(directivesResult.unwrapError());
    }

    // Render output using configured format (no hardcoded default)
    const renderingResult = await this.renderOutput(
      result.template,
      directivesResult.unwrap(),
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
   * Loads raw schema data from file.
   */
  private async loadSchemaData(
    schemaPath: string,
  ): Promise<Result<Record<string, unknown>, ProcessingError>> {
    try {
      const contentResult = await this.fileSystem.readTextFile(schemaPath);
      if (contentResult.isError()) {
        const { createFileError } = await import(
          "../../domain/shared/types/file-errors.ts"
        );
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

      const schemaData = JSON.parse(contentResult.unwrap());
      return Result.ok(schemaData);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to parse schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "SCHEMA_PARSE_ERROR",
          { schemaPath, error },
        ),
      );
    }
  }

  /**
   * Applies schema directives to process and transform data.
   * Specifically handles x-derived-from and x-derived-unique directives.
   */
  private applySchemaDirectives(
    data: Record<string, unknown>,
    schema: any,
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      let result = { ...data };

      // Process schema properties to find directives
      if (schema.properties) {
        result = this.processSchemaProperties(result, schema.properties, []);
      }

      // Apply schema defaults (temporary until schema default processing is implemented)
      if (!result.version && schema.properties?.version?.default) {
        result.version = schema.properties.version.default;
      }
      if (!result.description && schema.properties?.description?.default) {
        result.description = schema.properties.description.default;
      }

      return Result.ok(result);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to apply schema directives: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "DIRECTIVE_APPLICATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Recursively processes schema properties to find and apply directives.
   */
  private processSchemaProperties(
    data: Record<string, unknown>,
    properties: Record<string, any>,
    currentPath: string[],
  ): Record<string, unknown> {
    let result = { ...data };

    for (const [key, propSchema] of Object.entries(properties)) {
      const path = [...currentPath, key];

      // Check for x-derived-from directive
      if (propSchema["x-derived-from"]) {
        const derivedValues = this.extractValuesFromPath(
          result,
          propSchema["x-derived-from"],
        );

        // Apply x-derived-unique if specified
        const finalValues = propSchema["x-derived-unique"]
          ? Array.from(new Set(derivedValues))
          : derivedValues;

        // Set the derived values
        this.setNestedValue(result, path, finalValues.sort());
      }

      // Recursively process nested properties
      if (propSchema.properties) {
        result = this.processSchemaProperties(
          result,
          propSchema.properties,
          path,
        );
      }
    }

    return result;
  }

  /**
   * Extracts values from a path expression like "commands[].c1" or "tools.commands[].c1".
   */
  private extractValuesFromPath(
    data: Record<string, unknown>,
    path: string,
  ): string[] {
    const values: string[] = [];

    // Handle nested array notation like "tools.commands[].c1"
    const nestedMatch = path.match(/^(.+?)\[\]\.(.+)$/);
    if (nestedMatch) {
      const [, basePath, propertyPath] = nestedMatch;

      // Navigate to the array
      let array: unknown;
      if (basePath.includes(".")) {
        // Handle nested path like "tools.commands"
        array = this.getNestedValue(data, basePath);
      } else {
        // Simple field name
        array = data[basePath];
      }

      // If array not found at specified path, try looking in items
      if (!array && data.items) {
        array = data.items;
      }

      if (Array.isArray(array)) {
        for (const item of array) {
          if (item && typeof item === "object") {
            const value = this.getNestedValue(
              item as Record<string, unknown>,
              propertyPath,
            );
            if (value !== undefined && value !== null) {
              values.push(String(value));
            }
          }
        }
      }
    }

    return values;
  }

  /**
   * Gets a nested value from an object using dot notation.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const segments = path.split(".");
    let current: unknown = obj;

    for (const segment of segments) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Sets a nested value in an object using an array of path segments.
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string[],
    value: unknown,
  ): void {
    let current = obj;

    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i];
      if (!(segment in current) || typeof current[segment] !== "object") {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    current[path[path.length - 1]] = value;
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

    // Create a Template entity from the raw template object
    // If template is already a Template instance, use it directly
    let templateEntity: Template;
    if (template instanceof Template) {
      templateEntity = template;
    } else {
      // Create a temporary path for the template
      const tempPath = TemplatePath.create("temp.json");
      if (tempPath.isError()) {
        return Result.error(
          new ProcessingError(
            "Failed to create template path",
            "TEMPLATE_PATH_ERROR",
            { error: tempPath.unwrapError() },
          ),
        );
      }

      // Create Template entity with the raw template content
      const templateData = {
        content: template,
        format: format,
      };
      const templateResult = Template.create(tempPath.unwrap(), templateData);

      if (templateResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to create template entity: ${templateResult.unwrapError().message}`,
            "TEMPLATE_CREATION_ERROR",
            { error: templateResult.unwrapError() },
          ),
        );
      }

      templateEntity = templateResult.unwrap();
    }

    // Render using OutputRenderingService with proper Template entity
    const renderingResult = this.outputRenderer.renderSimple(
      templateEntity,
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
