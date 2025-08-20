// Simple template mapper implementation

import {
  createError,
  type ProcessingError,
  type Result,
} from "../../domain/shared/types.ts";
import {
  type ExtractedData,
  MappedData,
  type Template,
} from "../../domain/models/entities.ts";
import type { TemplateMapper } from "../../domain/services/interfaces.ts";

export class SimpleTemplateMapper implements TemplateMapper {
  map(
    data: ExtractedData,
    template: Template,
  ): Result<MappedData, ProcessingError & { message: string }> {
    try {
      // Apply mapping rules from template
      const mappedData = template.applyRules(data.getData());

      // Merge with template defaults if needed
      const templateStr = template.getFormat().getTemplate();
      const format = template.getFormat().getFormat();

      let finalData: Record<string, unknown>;

      if (format === "json") {
        const templateData = this.parseJSONTemplate(templateStr);
        finalData = this.mergeWithTemplate(mappedData, templateData);
      } else if (format === "yaml") {
        const templateData = this.parseYAMLTemplate(templateStr);
        finalData = this.mergeWithTemplate(mappedData, templateData);
      } else {
        // For other formats, use mapped data directly
        finalData = mappedData;
      }

      return { ok: true, data: MappedData.create(finalData) };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "MappingFailed",
          document: "unknown",
          reason: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  private parseJSONTemplate(template: string): Record<string, unknown> {
    try {
      return JSON.parse(template);
    } catch {
      return {};
    }
  }

  private parseYAMLTemplate(template: string): Record<string, unknown> {
    // Simplified YAML parsing - would use a proper YAML library in production
    const result: Record<string, unknown> = {};
    const lines = template.split("\n");
    let currentKey: string | null = null;
    let currentArray: unknown[] | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Handle array items
      if (trimmed.startsWith("- ")) {
        const value = trimmed.substring(2).trim();
        if (currentArray && currentKey) {
          currentArray.push(this.parseYAMLValue(value));
        }
        continue;
      }

      // Handle key-value pairs
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (value === "") {
          // Start of array or object
          currentKey = key;
          currentArray = [];
          result[key] = currentArray;
        } else {
          // Simple key-value
          result[key] = this.parseYAMLValue(value);
          currentKey = null;
          currentArray = null;
        }
      }
    }

    return result;
  }

  private parseYAMLValue(value: string): unknown {
    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    // Check for boolean
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;

    // Check for number
    const num = Number(value);
    if (!isNaN(num)) return num;

    return value;
  }

  private mergeWithTemplate(
    mappedData: Record<string, unknown>,
    templateData: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...templateData };

    // Deep merge mapped data into template
    for (const [key, value] of Object.entries(mappedData)) {
      if (value !== undefined && value !== null) {
        if (
          typeof value === "object" && !Array.isArray(value) &&
          typeof result[key] === "object" && !Array.isArray(result[key])
        ) {
          // Recursively merge objects
          result[key] = this.mergeWithTemplate(
            value as Record<string, unknown>,
            result[key] as Record<string, unknown>,
          );
        } else {
          // Replace value
          result[key] = value;
        }
      }
    }

    return result;
  }
}
