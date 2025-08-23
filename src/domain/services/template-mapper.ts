import type { Result } from "../core/result.ts";
import {
  createValidationError,
  type ValidationError,
} from "../shared/errors.ts";
import type { Template } from "../models/template.ts";

export class TemplateMapper {
  map(
    data: unknown,
    template: Template,
  ): Result<string, ValidationError> {
    const format = template.getDefinition().getFormat();
    const definition = template.getDefinition().getDefinition();

    switch (format) {
      case "json":
        return this.mapToJson(data, definition);
      case "yaml":
        return this.mapToYaml(data, definition);
      case "handlebars":
        return this.mapWithHandlebars(data, definition);
      case "custom":
        return this.mapWithCustom(data, definition);
      default:
        return {
          ok: false,
          error: createValidationError(
            `Unsupported template format: ${format}`,
          ),
        };
    }
  }

  private mapToJson(
    data: unknown,
    templateDefinition: string,
  ): Result<string, ValidationError> {
    try {
      // Parse template to understand structure
      const template = JSON.parse(templateDefinition);
      const result = this.applyDataToTemplate(data, template);
      return { ok: true, data: JSON.stringify(result, null, 2) };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(`Failed to map to JSON: ${error}`),
      };
    }
  }

  private mapToYaml(
    data: unknown,
    _templateDefinition: string,
  ): Result<string, ValidationError> {
    try {
      // Simple YAML generation (in production, use a proper YAML library)
      const result = this.convertToYaml(data, 0);
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(`Failed to map to YAML: ${error}`),
      };
    }
  }

  private mapWithHandlebars(
    _data: unknown,
    _templateDefinition: string,
  ): Result<string, ValidationError> {
    // This would use a Handlebars library in production
    return {
      ok: false,
      error: createValidationError("Handlebars support not yet implemented"),
    };
  }

  private mapWithCustom(
    data: unknown,
    _templateDefinition: string,
  ): Result<string, ValidationError> {
    try {
      // Custom template processing
      // For now, just return the data as JSON
      return { ok: true, data: JSON.stringify(data, null, 2) };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to map with custom template: ${error}`,
        ),
      };
    }
  }

  private applyDataToTemplate(
    data: unknown,
    template: unknown,
  ): unknown {
    if (template === null || template === undefined) {
      return data;
    }

    if (typeof template === "string") {
      // Check if it's a placeholder
      if (template.startsWith("{{") && template.endsWith("}}")) {
        const path = template.slice(2, -2).trim();
        return this.getValueByPath(data, path);
      }
      return template;
    }

    if (Array.isArray(template)) {
      return template.map((item) => this.applyDataToTemplate(data, item));
    }

    if (typeof template === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.applyDataToTemplate(data, value);
      }
      return result;
    }

    return template;
  }

  private getValueByPath(data: unknown, path: string): unknown {
    const parts = path.split(".");
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private convertToYaml(data: unknown, indent: number): string {
    const indentStr = "  ".repeat(indent);

    if (data === null || data === undefined) {
      return `${indentStr}null`;
    }

    if (typeof data === "string") {
      // Quote if contains special characters
      if (data.includes(":") || data.includes("#") || data.includes('"')) {
        return `${indentStr}"${data.replace(/"/g, '\\"')}"`;
      }
      return `${indentStr}${data}`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return `${indentStr}${data}`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return `${indentStr}[]`;
      }
      return data
        .map((item) => {
          const itemStr = this.convertToYaml(item, indent + 1);
          return `${indentStr}- ${itemStr.trim()}`;
        })
        .join("\n");
    }

    if (typeof data === "object") {
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length === 0) {
        return `${indentStr}{}`;
      }
      return entries
        .map(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            return `${indentStr}${key}:\n${
              this.convertToYaml(value, indent + 1)
            }`;
          }
          const valueStr = this.convertToYaml(value, 0);
          return `${indentStr}${key}: ${valueStr.trim()}`;
        })
        .join("\n");
    }

    return `${indentStr}${String(data)}`;
  }
}
