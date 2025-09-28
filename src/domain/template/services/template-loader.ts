import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import {
  Template,
  TemplateData,
  TemplateFormat,
} from "../entities/template.ts";
import { TemplatePath } from "../value-objects/template-path.ts";

/**
 * File system operations interface for template loading.
 * This allows for dependency injection and testing.
 */
export interface FileSystemOperations {
  readTextFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
}

/**
 * Service for loading and parsing template files.
 * Supports JSON template files with future extensibility for YAML.
 */
export class TemplateLoader {
  private constructor(private readonly fileSystem: FileSystemOperations) {}

  /**
   * Creates a new TemplateLoader with the given file system operations.
   */
  static create(fileSystem: FileSystemOperations): TemplateLoader {
    return new TemplateLoader(fileSystem);
  }

  /**
   * Loads a template from the specified path.
   * Currently supports JSON format only.
   */
  async loadTemplate(
    templatePath: TemplatePath,
  ): Promise<Result<Template, TemplateError>> {
    try {
      // Check if file exists
      const pathString = templatePath.toString();
      const exists = await this.fileSystem.exists(pathString);

      if (!exists) {
        return Result.error(
          new TemplateError(
            `Template file not found: ${pathString}`,
            "TEMPLATE_NOT_FOUND",
            { path: pathString },
          ),
        );
      }

      // Read file content
      const content = await this.fileSystem.readTextFile(pathString);

      if (content.trim().length === 0) {
        return Result.error(
          new TemplateError(
            `Template file is empty: ${pathString}`,
            "EMPTY_TEMPLATE_FILE",
            { path: pathString },
          ),
        );
      }

      // Parse content based on file extension
      const format = this.determineFormat(templatePath);
      const parseResult = this.parseContent(content, format);

      if (parseResult.isError()) {
        return Result.error(
          new TemplateError(
            `Failed to parse template: ${parseResult.unwrapError().message}`,
            "TEMPLATE_PARSE_ERROR",
            {
              path: pathString,
              format,
              originalError: parseResult.unwrapError(),
            },
          ),
        );
      }

      const templateData: TemplateData = {
        content: parseResult.unwrap(),
        format,
      };

      // Create Template entity
      return Template.create(templatePath, templateData);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `Failed to load template: ${errorMessage}`,
          "TEMPLATE_LOAD_ERROR",
          { path: templatePath.toString(), error },
        ),
      );
    }
  }

  /**
   * Loads multiple templates from the given paths.
   * Returns results for all templates, including errors.
   */
  async loadTemplates(
    templatePaths: TemplatePath[],
  ): Promise<Array<Result<Template, TemplateError>>> {
    const loadPromises = templatePaths.map((path) => this.loadTemplate(path));
    return await Promise.all(loadPromises);
  }

  /**
   * Loads templates and returns only successful results.
   * Logs or collects errors for failed loads.
   */
  async loadTemplatesSuccessfully(
    templatePaths: TemplatePath[],
  ): Promise<{ templates: Template[]; errors: TemplateError[] }> {
    const results = await this.loadTemplates(templatePaths);
    const templates: Template[] = [];
    const errors: TemplateError[] = [];

    for (const result of results) {
      if (result.isOk()) {
        templates.push(result.unwrap());
      } else {
        errors.push(result.unwrapError());
      }
    }

    return { templates, errors };
  }

  /**
   * Validates that a template can be loaded without actually creating the entity.
   * Useful for checking template validity before processing.
   */
  async validateTemplate(
    templatePath: TemplatePath,
  ): Promise<Result<void, TemplateError>> {
    const loadResult = await this.loadTemplate(templatePath);

    if (loadResult.isError()) {
      return Result.error(loadResult.unwrapError());
    }

    return Result.ok(undefined);
  }

  /**
   * Determines the template format based on file extension.
   */
  private determineFormat(templatePath: TemplatePath): TemplateFormat {
    const pathString = templatePath.toString().toLowerCase();

    if (pathString.endsWith(".json")) {
      return "json";
    }

    if (pathString.endsWith(".yaml") || pathString.endsWith(".yml")) {
      return "yaml";
    }

    // Default to JSON for .json extension requirement
    return "json";
  }

  /**
   * Parses template content based on format.
   */
  private parseContent(
    content: string,
    format: TemplateFormat,
  ): Result<Record<string, unknown>, Error> {
    try {
      switch (format) {
        case "json":
          return this.parseJsonContent(content);
        case "yaml":
          return this.parseYamlContent(content);
        default:
          return Result.error(
            new Error(`Unsupported template format: ${format}`),
          );
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown parsing error";
      return Result.error(new Error(`Parse error: ${errorMessage}`));
    }
  }

  /**
   * Parses JSON template content.
   */
  private parseJsonContent(
    content: string,
  ): Result<Record<string, unknown>, Error> {
    try {
      const parsed = JSON.parse(content);

      if (
        typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
      ) {
        return Result.error(new Error("JSON template must be an object"));
      }

      return Result.ok(parsed as Record<string, unknown>);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Invalid JSON";
      return Result.error(new Error(`JSON parsing failed: ${errorMessage}`));
    }
  }

  /**
   * Parses YAML template content.
   * Currently returns an error as YAML support is not yet implemented.
   */
  private parseYamlContent(
    _content: string,
  ): Result<Record<string, unknown>, Error> {
    return Result.error(new Error("YAML template support not yet implemented"));
  }
}
