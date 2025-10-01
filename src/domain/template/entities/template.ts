import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import {
  ItemsDetectionResult,
  ItemsDetector,
} from "../services/items-detector.ts";

/**
 * Template content types supported by the system
 */
export type TemplateFormat = "json" | "yaml" | "xml" | "markdown";

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
    const result = this.getNestedProperty(propertyPath);
    return result.isOk() && result.unwrap() !== undefined;
  }

  /**
   * Gets a nested property using dot notation (e.g., "metadata.title").
   * Returns Result<T,E> following the Totality principle.
   */
  getNestedProperty(propertyPath: string): Result<unknown, TemplateError> {
    if (!propertyPath || propertyPath.trim().length === 0) {
      return Result.error(
        new TemplateError(
          "Property path cannot be empty",
          "INVALID_PROPERTY_PATH",
          { path: this.path.toString(), propertyPath },
        ),
      );
    }

    const segments = propertyPath.split(".");
    let current: unknown = this.data.content;

    for (const segment of segments) {
      // Handle array indices
      if (Array.isArray(current)) {
        const index = parseInt(segment, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return Result.error(
            new TemplateError(
              `Invalid array index '${segment}' for array of length ${current.length}`,
              "INVALID_ARRAY_INDEX",
              {
                path: this.path.toString(),
                propertyPath,
                segment,
                arrayLength: current.length,
              },
            ),
          );
        }
        current = current[index];
      } else if (this.isValidObject(current)) {
        current = current[segment];
      } else {
        return Result.error(
          new TemplateError(
            `Cannot access property '${segment}' on non-object value`,
            "INVALID_PROPERTY_ACCESS",
            {
              path: this.path.toString(),
              propertyPath,
              segment,
              currentType: typeof current,
            },
          ),
        );
      }
    }

    return Result.ok(current);
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
   * Gets detailed {@items} detection results using ItemsDetector.
   * Returns comprehensive information about {@items} patterns in this template.
   */
  getItemsDetectionResult(
    detector?: ItemsDetector,
  ): Result<ItemsDetectionResult, TemplateError> {
    const itemsDetector = detector ?? ItemsDetector.create();
    return itemsDetector.detectItems(this.data.content);
  }

  /**
   * Checks if this template requires items processing.
   * Uses enhanced detection logic to determine if {@items} processing is needed.
   */
  requiresItemsProcessing(detector?: ItemsDetector): boolean {
    const detectionResult = this.getItemsDetectionResult(detector);
    return detectionResult.isOk() && detectionResult.unwrap().isExpandable;
  }

  /**
   * Creates an items context for template processing.
   * Provides context information needed for {@items} expansion.
   */
  createItemsContext(
    arrayData: readonly unknown[],
    globalVariables: Record<string, unknown> = {},
  ): {
    containerTemplate: Template;
    arrayData: readonly unknown[];
    globalVariables: Record<string, unknown>;
  } {
    return {
      containerTemplate: this,
      arrayData,
      globalVariables,
    };
  }

  /**
   * Creates a new template with resolved variables.
   * Variables are in the format {variable.path} or ${variable.path}.
   *
   * @param variables - Data to use for variable resolution
   * @param schema - Optional JSON Schema to determine frontmatter property name
   */
  resolveVariables(
    variables: Record<string, unknown>,
    schema?: Record<string, unknown>,
  ): Result<Template, TemplateError> {
    try {
      const frontmatterProperty = schema
        ? this.findFrontmatterPartProperty(schema)
        : "items";
      const resolvedContent = this.resolveObject(
        this.data.content,
        variables,
        frontmatterProperty,
      );
      const resolvedData: TemplateData = {
        content: resolvedContent as Record<string, unknown>,
        format: this.data.format,
      };

      return Result.ok(new Template(this.path, resolvedData));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
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
   * Finds the property name marked with x-frontmatter-part: true in schema.
   * Returns "items" as default if not found or schema is invalid.
   */
  private findFrontmatterPartProperty(schema: Record<string, unknown>): string {
    try {
      if (!schema.properties || typeof schema.properties !== "object") {
        return "items";
      }

      const properties = schema.properties as Record<string, unknown>;
      for (const [propName, propSchema] of Object.entries(properties)) {
        if (
          propSchema &&
          typeof propSchema === "object" &&
          "x-frontmatter-part" in propSchema &&
          propSchema["x-frontmatter-part"] === true
        ) {
          return propName;
        }
      }
    } catch {
      // If any error occurs during schema inspection, fall back to default
    }
    return "items";
  }

  /**
   * Returns a string representation of the template.
   */
  toString(): string {
    const itemsStatus = this.isItemsTemplate()
      ? "items template"
      : "container template";
    return `Template(${this.path.toString()}, ${this.data.format}, ${itemsStatus})`;
  }

  /**
   * Compares this template with another for equality based on path.
   */
  equals(other: Template): boolean {
    return this.path.equals(other.path);
  }

  /**
   * Type guard to check if a value is a valid object for property access.
   */
  private isValidObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
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

    if (this.isValidObject(obj)) {
      return Object.values(obj).some((value) =>
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
    frontmatterProperty: string,
  ): unknown {
    if (typeof obj === "string") {
      const resolved = this.resolveStringVariables(
        obj,
        variables,
        frontmatterProperty,
      );
      // resolveStringVariables can return non-string for {@items}
      return resolved;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) =>
        this.resolveObject(item, variables, frontmatterProperty)
      );
    }

    if (this.isValidObject(obj)) {
      const resolved: Record<string, unknown> = {};
      for (
        const [key, value] of Object.entries(obj)
      ) {
        resolved[key] = this.resolveObject(
          value,
          variables,
          frontmatterProperty,
        );
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Resolves variables in a string.
   * Supports both {variable.path} and ${variable.path} syntax.
   * Special handling for {@items} which is replaced with frontmatter property array.
   *
   * @param str - String to resolve variables in
   * @param variables - Variable data
   * @param frontmatterProperty - Property name from schema (e.g., "traceability", "items")
   */
  private resolveStringVariables(
    str: string,
    variables: Record<string, unknown>,
    frontmatterProperty: string,
  ): string | unknown {
    // Special handling for {@items} - use schema property name
    if (str === "{@items}") {
      const value = this.resolveVariablePath(variables, frontmatterProperty);
      return value !== undefined ? value : str;
    }

    // Check if the entire string is a single variable placeholder
    const singleVarMatch = str.match(/^(\$)?\{([^}]+)\}$/);
    if (singleVarMatch) {
      const dollarPrefix = singleVarMatch[1];
      const variablePath = singleVarMatch[2].trim();

      // Special handling for @items - use schema property name
      if (variablePath === "@items") {
        const value = this.resolveVariablePath(variables, frontmatterProperty);
        return value !== undefined ? value : str;
      }

      const value = this.resolveVariablePath(variables, variablePath);
      // If using ${} syntax, always convert to string (template literal behavior)
      // If using {} syntax without $, preserve type for JSON templates
      if (dollarPrefix === "$") {
        return value !== undefined && value !== null ? String(value) : str;
      } else {
        // Return the raw value to preserve its type (array, object, etc.)
        return value !== undefined ? value : str;
      }
    }

    // For strings with embedded variables, replace them with string representations
    return str.replace(/\$?\{([^}]+)\}/g, (match, variablePath) => {
      // Skip @items pattern in embedded context
      if (variablePath.trim() === "@items") {
        const items = this.resolveVariablePath(variables, "items");
        return Array.isArray(items) ? JSON.stringify(items) : match;
      }

      const value = this.resolveVariablePath(variables, variablePath.trim());
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  /**
   * Resolves a variable path to its value.
   * Supports dot notation (object.property) and array access (array[0]).
   *
   * @param data - Data object to resolve from
   * @param path - Variable path (e.g., "user.name", "items[0].title")
   * @returns The resolved value or undefined if not found
   */
  private resolveVariablePath(
    data: unknown,
    path: string,
  ): unknown {
    if (!path || data === null || data === undefined) {
      return undefined;
    }

    // Handle simple property access (no dots or brackets)
    if (!path.includes(".") && !path.includes("[")) {
      return this.isValidObject(data) ? data[path] : undefined;
    }

    // Parse path segments
    const segments = this.parseVariablePath(path);
    let current: unknown = data;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = parseInt(segment, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
      } else if (this.isValidObject(current)) {
        current = current[segment];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Parses a variable path into segments.
   * Supports dot notation and array brackets.
   *
   * @param path - Path string (e.g., "user.items[0].name")
   * @returns Array of path segments
   */
  private parseVariablePath(path: string): string[] {
    const segments: string[] = [];
    let current = "";
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === "[") {
        if (current) {
          segments.push(current);
          current = "";
        }
        inBrackets = true;
      } else if (char === "]") {
        if (inBrackets && current) {
          segments.push(current);
          current = "";
        }
        inBrackets = false;
      } else if (char === "." && !inBrackets) {
        if (current) {
          segments.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current) {
      segments.push(current);
    }

    return segments;
  }
}
