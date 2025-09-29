import { Result } from "../../shared/types/result.ts";
import { ProcessingError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import {
  OutputFormat,
  OutputRenderingService,
} from "./output-rendering-service.ts";
import { FileSystemPort } from "../../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../shared/types/file-errors.ts";

/**
 * Domain service for template output rendering and file writing.
 * Coordinates template creation, rendering, and output file operations.
 * Follows totality principles with comprehensive Result-based error handling.
 */
export class TemplateOutputRenderer {
  private constructor(
    private readonly outputRenderer: OutputRenderingService,
    private readonly fileSystem: FileSystemPort,
  ) {}

  /**
   * Creates a TemplateOutputRenderer instance.
   */
  static create(
    outputRenderer: OutputRenderingService,
    fileSystem: FileSystemPort,
  ): Result<TemplateOutputRenderer, ProcessingError> {
    if (!outputRenderer) {
      return Result.error(
        new ProcessingError(
          "OutputRenderingService is required for template output rendering",
          "INVALID_DEPENDENCY",
          { dependency: "OutputRenderingService" },
        ),
      );
    }

    if (!fileSystem) {
      return Result.error(
        new ProcessingError(
          "FileSystemPort is required for template output rendering",
          "INVALID_DEPENDENCY",
          { dependency: "FileSystemPort" },
        ),
      );
    }

    return Result.ok(new TemplateOutputRenderer(outputRenderer, fileSystem));
  }

  /**
   * Renders template with data and writes output to file.
   * Handles template entity creation and format conversion.
   */
  async renderOutput(
    template: unknown,
    data: Record<string, unknown>,
    format: OutputFormat,
    outputPath: string,
  ): Promise<Result<void, ProcessingError>> {
    if (!data || typeof data !== "object") {
      return Result.error(
        new ProcessingError(
          "Data must be a valid object for template rendering",
          "INVALID_DATA_TYPE",
          { dataType: typeof data },
        ),
      );
    }

    if (!outputPath || typeof outputPath !== "string") {
      return Result.error(
        new ProcessingError(
          "Output path must be a non-empty string",
          "INVALID_OUTPUT_PATH",
          { outputPath },
        ),
      );
    }

    // Create Template entity from raw template data
    const templateEntityResult = this.createTemplateEntity(template, format);
    if (templateEntityResult.isError()) {
      return Result.error(templateEntityResult.unwrapError());
    }

    const templateEntity = templateEntityResult.unwrap();

    // Render using OutputRenderingService
    const renderingResult = this.outputRenderer.renderSimple(
      templateEntity,
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
    const writeResult = await this.writeToFile(
      outputPath,
      renderingResult.unwrap(),
    );
    if (writeResult.isError()) {
      return Result.error(writeResult.unwrapError());
    }

    return Result.ok(undefined);
  }

  /**
   * Creates a Template entity from raw template data.
   * Handles both Template instances and raw template objects.
   */
  private createTemplateEntity(
    template: unknown,
    format: OutputFormat,
  ): Result<Template, ProcessingError> {
    // If template is already a Template instance, use it directly
    if (template instanceof Template) {
      return Result.ok(template);
    }

    if (!template || typeof template !== "object") {
      return Result.error(
        new ProcessingError(
          "Template must be a valid object or Template instance",
          "INVALID_TEMPLATE_TYPE",
          { templateType: typeof template },
        ),
      );
    }

    try {
      // Create a temporary path for the template
      const tempPathResult = TemplatePath.create("temp.json");
      if (tempPathResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to create template path: ${tempPathResult.unwrapError().message}`,
            "TEMPLATE_PATH_ERROR",
            { error: tempPathResult.unwrapError() },
          ),
        );
      }

      // Create Template entity with the raw template content
      const templateData = {
        content: template as Record<string, unknown>,
        format: this.normalizeTemplateFormat(format),
      };

      const templateResult = Template.create(
        tempPathResult.unwrap(),
        templateData,
      );
      if (templateResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to create template entity: ${templateResult.unwrapError().message}`,
            "TEMPLATE_CREATION_ERROR",
            { error: templateResult.unwrapError() },
          ),
        );
      }

      return Result.ok(templateResult.unwrap());
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Template entity creation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TEMPLATE_ENTITY_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Normalizes output format to template format.
   * Maps output formats to internal template formats.
   */
  private normalizeTemplateFormat(format: OutputFormat): "json" | "yaml" {
    switch (format) {
      case "json":
      case "xml":
      case "markdown":
        return "json"; // Internal format for processing
      case "yaml":
        return "yaml";
      default: {
        // Exhaustive check for OutputFormat
        const _exhaustiveCheck: never = format;
        return "json"; // Fallback to json
      }
    }
  }

  /**
   * Writes rendered content to output file.
   */
  private async writeToFile(
    outputPath: string,
    content: string,
  ): Promise<Result<void, ProcessingError>> {
    try {
      const writeResult = await this.fileSystem.writeTextFile(
        outputPath,
        content,
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
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `File write operation failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "FILE_WRITE_ERROR",
          { outputPath, error },
        ),
      );
    }
  }

  /**
   * Validates rendering configuration.
   * Ensures all required parameters are valid for rendering.
   */
  validateRenderingConfig(
    template: unknown,
    data: Record<string, unknown>,
    format: OutputFormat,
    outputPath: string,
  ): Result<void, ProcessingError> {
    // Validate template
    if (!template) {
      return Result.error(
        new ProcessingError(
          "Template is required for rendering",
          "MISSING_TEMPLATE",
          { template },
        ),
      );
    }

    // Validate data
    if (!data || typeof data !== "object") {
      return Result.error(
        new ProcessingError(
          "Data must be a valid object for rendering",
          "INVALID_DATA",
          { dataType: typeof data },
        ),
      );
    }

    // Validate format
    const validFormats: OutputFormat[] = ["json", "yaml", "xml", "markdown"];
    if (!validFormats.includes(format)) {
      return Result.error(
        new ProcessingError(
          `Invalid output format: ${format}. Must be one of: ${
            validFormats.join(", ")
          }`,
          "INVALID_FORMAT",
          { format, validFormats },
        ),
      );
    }

    // Validate output path
    if (
      !outputPath || typeof outputPath !== "string" || outputPath.trim() === ""
    ) {
      return Result.error(
        new ProcessingError(
          "Output path must be a non-empty string",
          "INVALID_OUTPUT_PATH",
          { outputPath },
        ),
      );
    }

    return Result.ok(undefined);
  }
}
