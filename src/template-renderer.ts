import type { DomainError, ProcessingConfig, Result } from "./types.ts";
import { getTemplatePath } from "./domain/models/schema-extensions.ts";
import { ERROR_TEMPLATE_PREVIEW_LIMIT } from "./domain/shared/constants.ts";

/**
 * Template data with discriminated union for Totality compliance
 * Eliminates optional properties and makes template processing explicit
 */
export type TemplateData =
  | {
    readonly kind: "aggregated";
    readonly aggregatedData: Record<string, unknown>;
  }
  | {
    readonly kind: "schema-aware";
    readonly aggregatedData: Record<string, unknown>;
    readonly schema: Record<string, unknown>;
  };

export class TemplateRenderer {
  private constructor() {}

  static create(): Result<TemplateRenderer, DomainError> {
    return { ok: true, data: new TemplateRenderer() };
  }

  async render(
    templateConfig: ProcessingConfig["template"],
    data: TemplateData,
  ): Promise<Result<string, DomainError>> {
    try {
      // Read template file
      const templateContent = await Deno.readTextFile(templateConfig.path);

      // Render based on format
      switch (templateConfig.format) {
        case "json":
          return await this.renderJson(templateContent, data);
        case "yaml":
          return this.renderYaml(templateContent, data);
        case "xml":
          return this.renderXml(templateContent, data);
        case "custom":
          return this.renderCustom(templateContent, data);
        default:
          return {
            ok: false,
            error: {
              kind: "TemplateRenderFailed",
              template: templateConfig.path,
              data: data.aggregatedData,
            },
          };
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ReadError",
          path: templateConfig.path,
          details: String(error),
        },
      };
    }
  }

  private async renderJson(
    template: string,
    data: TemplateData,
  ): Promise<Result<string, DomainError>> {
    try {
      // Enhanced template processing with x-template array resolution
      const processedResult = await this.processTemplateWithSchema(
        template,
        data,
      );
      if (!processedResult.ok) return processedResult;

      // Validate JSON output
      JSON.parse(processedResult.data);

      return processedResult;
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: template.slice(0, ERROR_TEMPLATE_PREVIEW_LIMIT.getValue()),
          data: data.aggregatedData,
        },
      };
    }
  }

  private renderYaml(
    template: string,
    data: TemplateData,
  ): Result<string, DomainError> {
    try {
      const rendered = this.replaceVariables(template, data.aggregatedData);
      return { ok: true, data: rendered };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: template.slice(0, ERROR_TEMPLATE_PREVIEW_LIMIT.getValue()),
          data: data.aggregatedData,
        },
      };
    }
  }

  private renderXml(
    template: string,
    data: TemplateData,
  ): Result<string, DomainError> {
    try {
      const rendered = this.replaceVariables(template, data.aggregatedData);
      return { ok: true, data: rendered };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: template.slice(0, ERROR_TEMPLATE_PREVIEW_LIMIT.getValue()),
          data: data.aggregatedData,
        },
      };
    }
  }

  private renderCustom(
    template: string,
    data: TemplateData,
  ): Result<string, DomainError> {
    try {
      const rendered = this.replaceVariables(template, data.aggregatedData);
      return { ok: true, data: rendered };
    } catch (_error) {
      return {
        ok: false,
        error: {
          kind: "TemplateRenderFailed",
          template: template.slice(0, ERROR_TEMPLATE_PREVIEW_LIMIT.getValue()),
          data: data.aggregatedData,
        },
      };
    }
  }

  private replaceVariables(
    template: string,
    data: Record<string, unknown>,
  ): string {
    let result = template;

    // Replace variables with single curly braces: {variableName} or {path.to.value}
    // This matches the actual template format used in the project
    const variablePattern = /\{([^}]+)\}/g;

    result = result.replace(variablePattern, (match, path) => {
      // Handle nested paths like {id.full} or {data.value}
      const value = this.getNestedValue(data, path);
      return value !== undefined ? this.valueToString(value) : match;
    });

    return result;
  }

  /**
   * Resolve value from data using path notation
   * Supports: simple.path, array[0], nested.array[1].property
   */
  private resolvePathValue(
    data: Record<string, unknown>,
    path: string,
  ): unknown {
    // Handle array notation: convert path[0].prop to path.0.prop for processing
    const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");

    // Use existing getNestedValue method for dot notation
    return this.getNestedValue(data, normalizedPath);
  }

  private valueToString(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Process template with schema-driven x-template array resolution
   * Eliminates need for $includeArray by automatically resolving array templates
   */
  private async processTemplateWithSchema(
    template: string,
    data: TemplateData,
  ): Promise<Result<string, DomainError>> {
    try {
      // Parse template as JSON to process structured content
      const templateObj = JSON.parse(template);

      // Process template object with schema awareness
      const processedObj = await this.processTemplateObject(templateObj, data);

      // Convert back to JSON string
      return { ok: true, data: JSON.stringify(processedObj, null, 2) };
    } catch (_error) {
      // Fallback to simple variable replacement for non-JSON templates
      const rendered = this.replaceVariables(template, data.aggregatedData);
      return { ok: true, data: rendered };
    }
  }

  /**
   * Recursively process template object, resolving x-template arrays
   */
  private async processTemplateObject(
    obj: unknown,
    data: TemplateData,
  ): Promise<unknown> {
    if (Array.isArray(obj)) {
      const results = await Promise.all(
        obj.map((item) => this.processTemplateObject(item, data)),
      );
      return results;
    }

    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        // Check for deprecated $includeArray usage
        if (key === "$includeArray") {
          console.warn(
            `DEPRECATION WARNING: $includeArray is deprecated. Use x-template in schema instead.`,
          );
          // Process the array with x-template if available
          result[key] = await this.processTemplateObject(value, data);
          continue;
        }

        // Check if this property corresponds to an array in data with x-template
        const arrayData = this.getArrayDataForProperty(key, data);
        if (arrayData && data.kind === "schema-aware") {
          const templateResult = await this.resolveArrayTemplate(
            key,
            arrayData,
            data.schema,
          );
          if (templateResult.ok) {
            result[key] = templateResult.data;
            continue;
          }
        }

        // Regular processing
        if (typeof value === "string") {
          result[key] = this.replaceVariables(value, data.aggregatedData);
        } else {
          result[key] = await this.processTemplateObject(value, data);
        }
      }

      return result;
    }

    // Primitive values - apply variable replacement if string
    if (typeof obj === "string") {
      return this.replaceVariables(obj, data.aggregatedData);
    }

    return obj;
  }

  /**
   * Get array data for a specific property name
   */
  private getArrayDataForProperty(
    propertyName: string,
    data: TemplateData,
  ): unknown[] | null {
    const nestedValue = this.getNestedValue(data.aggregatedData, propertyName);
    return Array.isArray(nestedValue) ? nestedValue : null;
  }

  /**
   * Get nested value from object using dot notation
   * Safe type guard implementation following Totality principle
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key: string) => {
      // Safe type guard instead of type assertion
      if (this.isRecord(current) && key in current) {
        return current[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Type guard to safely check if value is Record<string, unknown>
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value !== undefined;
  }

  /**
   * Resolve array template using x-template from schema
   */
  private async resolveArrayTemplate(
    propertyName: string,
    arrayData: unknown[],
    schema: Record<string, unknown>,
  ): Promise<Result<unknown[], DomainError>> {
    try {
      // Find the array property schema
      const arraySchema = this.findArrayPropertySchema(propertyName, schema);
      if (!arraySchema) {
        return {
          ok: false,
          error: { kind: "SchemaNotFound", path: propertyName },
        };
      }

      // Get x-template from array items schema
      const itemsSchema = arraySchema.items;
      if (!itemsSchema || typeof itemsSchema !== "object") {
        return {
          ok: false,
          error: { kind: "ArrayItemsSchemaNotFound", path: propertyName },
        };
      }

      // Safe type check before using schema
      if (!this.isRecord(itemsSchema)) {
        return {
          ok: false,
          error: { kind: "InvalidArrayItemsSchema", path: propertyName },
        };
      }

      const templatePathResult = getTemplatePath(itemsSchema);
      if (!templatePathResult.ok) {
        // No x-template found, return original data
        return { ok: true, data: arrayData };
      }

      // Load and process the array item template for each element
      return await this.processArrayWithTemplate(
        arrayData,
        templatePathResult.data,
      );
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ArrayTemplateResolutionFailed",
          path: propertyName,
          details: String(error),
        },
      };
    }
  }

  /**
   * Find array property schema in the main schema
   */
  private findArrayPropertySchema(
    propertyName: string,
    schema: Record<string, unknown>,
  ): Record<string, unknown> | null {
    // Safe property access using type guard
    if (!this.isRecord(schema.properties)) {
      return null;
    }

    // Handle nested property paths (e.g., "tools.commands")
    const pathParts = propertyName.split(".");
    let currentSchema: unknown = schema.properties;

    for (const part of pathParts) {
      if (!this.isRecord(currentSchema) || !(part in currentSchema)) {
        return null;
      }
      currentSchema = currentSchema[part];
    }

    return this.isRecord(currentSchema) ? currentSchema : null;
  }

  /**
   * Process array data using the specified template
   */
  private async processArrayWithTemplate(
    arrayData: unknown[],
    templatePath: string,
  ): Promise<Result<unknown[], DomainError>> {
    try {
      // Load the array item template
      const templateContent = await Deno.readTextFile(templatePath);

      // Process each array item with the template
      const processedItems = await Promise.all(
        arrayData.map(async (item) => {
          // Use safe type guard instead of assertion
          if (this.isRecord(item)) {
            // For JSON templates, parse and process
            try {
              const templateObj = JSON.parse(templateContent);
              return await this.processTemplateObject(templateObj, {
                kind: "aggregated" as const,
                aggregatedData: item,
              });
            } catch {
              // If not JSON, treat as simple string template
              return this.replaceVariables(templateContent, item);
            }
          }
          return item;
        }),
      );

      return { ok: true, data: processedItems };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "TemplateLoadFailed",
          path: templatePath,
          details: String(error),
        },
      };
    }
  }
}
