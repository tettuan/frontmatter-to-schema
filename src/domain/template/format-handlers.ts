/**
 * Template Format Handlers
 *
 * Implements unified template format processing following DDD and Totality principles.
 * Consolidates duplicate JSON/YAML parsing logic from multiple locations.
 */

import type { Result } from "../core/result.ts";
import type { ValidationError } from "../shared/errors.ts";
import { createValidationError } from "../shared/errors.ts";

/**
 * Common interface for template format handling
 * Following Totality principle - all operations return Result types
 */
export interface TemplateFormatHandler {
  /**
   * Check if this handler can process the given format
   */
  canHandle(format: string): boolean;

  /**
   * Parse template content into structured data
   */
  parse(content: string): Result<unknown, ValidationError>;

  /**
   * Serialize structured data back to template format
   */
  serialize(data: unknown): Result<string, ValidationError>;

  /**
   * Get the format name for logging/debugging
   */
  getFormatName(): string;
}

/**
 * Smart Constructor for Template Format validation
 * Following Totality principle - constrained value type
 */
export class TemplateFormat {
  private constructor(readonly value: string) {}

  static create(format: string): Result<TemplateFormat, ValidationError> {
    const validFormats = ["json", "yaml", "yml", "handlebars", "custom"];

    if (validFormats.includes(format.toLowerCase())) {
      return { ok: true, data: new TemplateFormat(format.toLowerCase()) };
    }

    return {
      ok: false,
      error: createValidationError(
        `Invalid template format "${format}". Valid formats: ${
          validFormats.join(", ")
        }`,
      ),
    };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: TemplateFormat): boolean {
    return this.value === other.value;
  }
}

/**
 * JSON Template Format Handler
 * Consolidates JSON parsing logic from SimpleTemplateMapper and NativeTemplateStrategy
 */
export class JSONTemplateHandler implements TemplateFormatHandler {
  canHandle(format: string): boolean {
    return format.toLowerCase() === "json";
  }

  parse(content: string): Result<unknown, ValidationError> {
    if (!content || content.trim() === "") {
      return {
        ok: false,
        error: createValidationError("JSON template content cannot be empty"),
      };
    }

    try {
      const parsed = JSON.parse(content);
      return { ok: true, data: parsed };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to parse JSON template: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  serialize(data: unknown): Result<string, ValidationError> {
    try {
      const serialized = JSON.stringify(data, null, 2);
      return { ok: true, data: serialized };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to serialize data to JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  getFormatName(): string {
    return "JSON";
  }
}

/**
 * YAML Template Format Handler
 * Consolidates YAML parsing logic from SimpleTemplateMapper
 * Simplified implementation - in production would use proper YAML library
 */
export class YAMLTemplateHandler implements TemplateFormatHandler {
  canHandle(format: string): boolean {
    const lowercaseFormat = format.toLowerCase();
    return lowercaseFormat === "yaml" || lowercaseFormat === "yml";
  }

  parse(content: string): Result<unknown, ValidationError> {
    if (!content || content.trim() === "") {
      return {
        ok: false,
        error: createValidationError("YAML template content cannot be empty"),
      };
    }

    try {
      const result = this.parseYAMLContent(content);
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to parse YAML template: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  serialize(data: unknown): Result<string, ValidationError> {
    try {
      const yaml = this.dataToYaml(data, 0);
      return { ok: true, data: yaml };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to serialize data to YAML: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  getFormatName(): string {
    return "YAML";
  }

  /**
   * Parse YAML content into structured data
   * Consolidated from SimpleTemplateMapper.parseYAMLTemplate()
   */
  private parseYAMLContent(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split("\n");
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

  /**
   * Parse individual YAML value
   * Consolidated from SimpleTemplateMapper.parseYAMLValue()
   */
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

  /**
   * Convert data to YAML format
   * Consolidated from NativeTemplateStrategy.dataToYaml()
   */
  private dataToYaml(data: unknown, indent: number): string {
    const indentStr = "  ".repeat(indent);

    if (data === null || data === undefined) {
      return `${indentStr}null`;
    }

    if (typeof data === "string") {
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
          const itemStr = this.dataToYaml(item, indent + 1);
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
            return `${indentStr}${key}:\n${this.dataToYaml(value, indent + 1)}`;
          }
          const valueStr = this.dataToYaml(value, 0);
          return `${indentStr}${key}: ${valueStr.trim()}`;
        })
        .join("\n");
    }

    return `${indentStr}${String(data)}`;
  }
}

/**
 * Handlebars Template Format Handler
 * For future extensibility
 */
export class HandlebarsTemplateHandler implements TemplateFormatHandler {
  canHandle(format: string): boolean {
    return format.toLowerCase() === "handlebars" ||
      format.toLowerCase() === "hbs";
  }

  parse(content: string): Result<unknown, ValidationError> {
    // For now, treat as plain text
    return { ok: true, data: content };
  }

  serialize(data: unknown): Result<string, ValidationError> {
    // For now, convert to JSON string representation
    try {
      const serialized = typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);
      return { ok: true, data: serialized };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to serialize handlebars template: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  getFormatName(): string {
    return "Handlebars";
  }
}

/**
 * Template Format Handler Factory
 * Provides centralized access to format handlers
 *
 * @deprecated Use TemplateDomainFactory from component-factory.ts for better domain separation
 */
export class TemplateFormatHandlerFactory {
  private static readonly handlers: TemplateFormatHandler[] = [
    new JSONTemplateHandler(),
    new YAMLTemplateHandler(),
    new HandlebarsTemplateHandler(),
  ];

  /**
   * Get handler for specific format
   */
  static getHandler(
    format: string,
  ): Result<TemplateFormatHandler, ValidationError> {
    const handler = this.handlers.find((h) => h.canHandle(format));

    if (handler) {
      return { ok: true, data: handler };
    }

    return {
      ok: false,
      error: createValidationError(
        `No handler found for template format: ${format}. Available formats: ${
          this.handlers.map((h) => h.getFormatName()).join(", ")
        }`,
      ),
    };
  }

  /**
   * Get all available handlers
   */
  static getAllHandlers(): TemplateFormatHandler[] {
    return [...this.handlers];
  }

  /**
   * Get all supported formats
   */
  static getSupportedFormats(): string[] {
    return this.handlers.map((h) => h.getFormatName().toLowerCase());
  }
}
