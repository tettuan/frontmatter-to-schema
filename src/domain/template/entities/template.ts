import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import {
  ItemsDetectionResult,
  ItemsDetector,
} from "../services/items-detector.ts";
import { VariableResolver } from "../../../../sub_modules/json-template/src/variable-resolver.ts";

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
   * Uses sub_modules/json-template for variable substitution.
   * Variables are in the format {variable.path} or ${variable.path}.
   */
  resolveVariables(
    variables: Record<string, unknown>,
  ): Result<Template, TemplateError> {
    try {
      const resolver = new VariableResolver(variables);
      const resolvedContent = this.resolveObject(this.data.content, resolver);
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
   * Recursively resolves variables in an object using VariableResolver.
   */
  private resolveObject(
    obj: unknown,
    resolver: VariableResolver,
  ): unknown {
    if (typeof obj === "string") {
      const resolved = this.resolveStringVariables(obj, resolver);
      // resolveStringVariables can return non-string for {@items}
      return resolved;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveObject(item, resolver));
    }

    if (this.isValidObject(obj)) {
      const resolved: Record<string, unknown> = {};
      for (
        const [key, value] of Object.entries(obj)
      ) {
        resolved[key] = this.resolveObject(value, resolver);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Resolves variables in a string using VariableResolver from json-template module.
   * Supports both {variable.path} and ${variable.path} syntax.
   * Special handling for {@items} which is replaced with items array.
   */
  private resolveStringVariables(
    str: string,
    resolver: VariableResolver,
  ): string | unknown {
    // Special handling for {@items} - check if "items" exists in the data
    if (str === "{@items}") {
      try {
        return resolver.resolve("items");
      } catch {
        return str; // Keep original if items not found
      }
    }

    // Check if the entire string is a single variable placeholder
    const singleVarMatch = str.match(/^(\$)?\{([^}]+)\}$/);
    if (singleVarMatch) {
      const dollarPrefix = singleVarMatch[1];
      const variablePath = singleVarMatch[2].trim();

      // Special handling for @items
      if (variablePath === "@items") {
        try {
          return resolver.resolve("items");
        } catch {
          return str; // Keep original if items not found
        }
      }

      try {
        const value = resolver.resolve(variablePath);
        // If using ${} syntax, always convert to string (template literal behavior)
        // If using {} syntax without $, preserve type for JSON templates
        if (dollarPrefix === "$") {
          return value !== undefined && value !== null ? String(value) : str;
        } else {
          // Return the raw value to preserve its type (array, object, etc.)
          return value !== undefined ? value : str;
        }
      } catch {
        return str; // Keep original if variable resolution fails
      }
    }

    // For strings with embedded variables, replace them with string representations
    return str.replace(/\$?\{([^}]+)\}/g, (match, variablePath) => {
      // Skip @items pattern in embedded context
      if (variablePath.trim() === "@items") {
        try {
          const items = resolver.resolve("items");
          return Array.isArray(items) ? JSON.stringify(items) : match;
        } catch {
          return match;
        }
      }

      try {
        const value = resolver.resolve(variablePath.trim());
        return value !== undefined && value !== null ? String(value) : match;
      } catch {
        return match; // Keep original if variable resolution fails
      }
    });
  }

}
