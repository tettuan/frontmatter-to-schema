import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { TemplatePath } from "../value-objects/template-path.ts";

/**
 * Template content types supported by the system
 */
export type TemplateFormat = "json" | "yaml";

/**
 * Raw template data as loaded from file
 */
export interface TemplateData {
  readonly content: Record<string, unknown>;
  readonly format: TemplateFormat;
}

/**
 * Template entity representing a loaded template file.
 * Contains the parsed template content and provides methods for variable resolution.
 */
export class Template {
  private constructor(
    private readonly path: TemplatePath,
    private readonly data: TemplateData,
  ) {}

  /**
   * Creates a Template from a path and raw content.
   */
  static create(
    path: TemplatePath,
    data: TemplateData,
  ): Result<Template, TemplateError> {
    if (!data.content || typeof data.content !== "object") {
      return Result.error(
        new TemplateError(
          "Template data must be a valid object",
          "INVALID_TEMPLATE_DATA",
          { path: path.toString(), data },
        ),
      );
    }

    return Result.ok(new Template(path, data));
  }

  /**
   * Returns the template path.
   */
  getPath(): TemplatePath {
    return this.path;
  }

  /**
   * Returns the template format.
   */
  getFormat(): TemplateFormat {
    return this.data.format;
  }

  /**
   * Returns the raw template content.
   */
  getContent(): Record<string, unknown> {
    return { ...this.data.content };
  }

  /**
   * Checks if the template contains a specific property.
   */
  hasProperty(propertyPath: string): boolean {
    return this.getNestedProperty(propertyPath) !== undefined;
  }

  /**
   * Gets a nested property using dot notation (e.g., "metadata.title").
   */
  getNestedProperty(propertyPath: string): unknown {
    const segments = propertyPath.split(".");
    let current: unknown = this.data.content;

    for (const segment of segments) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }

  /**
   * Returns true if this template contains {@items} expansion syntax.
   */
  hasItemsExpansion(): boolean {
    return this.containsItemsPattern(this.data.content);
  }

  /**
   * Returns true if this template is intended for items expansion.
   * Uses heuristics based on naming and content patterns.
   */
  isItemsTemplate(): boolean {
    return this.path.isItemsTemplate() || this.hasItemsExpansion();
  }

  /**
   * Creates a new template with resolved variables.
   * Variables are in the format ${variable.path} or ${variable}.
   */
  resolveVariables(
    variables: Record<string, unknown>,
  ): Result<Template, TemplateError> {
    try {
      const resolvedContent = this.resolveObject(this.data.content, variables);
      const resolvedData: TemplateData = {
        content: resolvedContent as Record<string, unknown>,
        format: this.data.format,
      };

      return Result.ok(new Template(this.path, resolvedData));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return Result.error(
        new TemplateError(
          `Variable resolution failed: ${errorMessage}`,
          "VARIABLE_RESOLUTION_ERROR",
          { path: this.path.toString(), variables, error },
        ),
      );
    }
  }

  /**
   * Returns a string representation of the template.
   */
  toString(): string {
    const itemsStatus = this.isItemsTemplate() ? "items template" : "container template";
    return `Template(${this.path.toString()}, ${this.data.format}, ${itemsStatus})`;
  }

  /**
   * Compares this template with another for equality based on path.
   */
  equals(other: Template): boolean {
    return this.path.equals(other.path);
  }

  /**
   * Recursively checks if an object contains {@items} patterns.
   */
  private containsItemsPattern(obj: unknown): boolean {
    if (typeof obj === "string") {
      return obj.includes("{@items}");
    }

    if (Array.isArray(obj)) {
      return obj.some((item) => this.containsItemsPattern(item));
    }

    if (obj && typeof obj === "object") {
      return Object.values(obj as Record<string, unknown>).some((value) =>
        this.containsItemsPattern(value)
      );
    }

    return false;
  }

  /**
   * Recursively resolves variables in an object.
   */
  private resolveObject(
    obj: unknown,
    variables: Record<string, unknown>,
  ): unknown {
    if (typeof obj === "string") {
      return this.resolveStringVariables(obj, variables);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveObject(item, variables));
    }

    if (obj && typeof obj === "object") {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        resolved[key] = this.resolveObject(value, variables);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Resolves variables in a string using ${variable.path} syntax.
   */
  private resolveStringVariables(
    str: string,
    variables: Record<string, unknown>,
  ): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, variablePath) => {
      const value = this.getVariableValue(variablePath.trim(), variables);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Gets a variable value using dot notation.
   */
  private getVariableValue(
    path: string,
    variables: Record<string, unknown>,
  ): unknown {
    const segments = path.split(".");
    let current: unknown = variables;

    for (const segment of segments) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }
}