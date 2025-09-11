/**
 * Schema Extension Processor Service
 *
 * Handles x-* schema extensions for dynamic template selection,
 * field transformations, and other schema-specific behaviors.
 * Follows DDD principles with Result types for error handling.
 *
 * Adapted for develop branch architecture while maintaining compatibility
 * with main branch patterns.
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import { SchemaExtensions } from "../value-objects/schema-extensions.ts";

export interface FileSystemProvider {
  readFile(path: string): Promise<Result<string, DomainError>>;
}

export interface Template {
  layout: string;
  sections?: string[];
  [key: string]: unknown;
}

export class SchemaExtensionProcessor {
  constructor(private readonly fileSystem?: FileSystemProvider) {}

  /**
   * Select template based on x-template configuration and document type
   */
  async selectTemplate(
    schema: Record<string, unknown>,
    document: Record<string, unknown>,
  ): Promise<Result<Template, DomainError>> {
    const xTemplate = schema[SchemaExtensions.TEMPLATE];

    if (!xTemplate || typeof xTemplate !== "object") {
      return {
        ok: true,
        data: { layout: "default", sections: ["main"] },
      };
    }

    const templateMap = xTemplate as Record<string, string>;
    const documentType = document.type as string || "default";
    const templatePath = templateMap[documentType] || templateMap.default ||
      "default-template.json";

    if (!this.fileSystem) {
      return {
        ok: true,
        data: { layout: documentType, sections: ["main"] },
      };
    }

    const fileResult = await this.fileSystem.readFile(templatePath);
    if (!fileResult.ok) {
      // Fallback to default if template file not found
      return {
        ok: true,
        data: { layout: "default", sections: ["main"] },
      };
    }

    try {
      const template = JSON.parse(fileResult.data) as Template;
      return { ok: true, data: template };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ParseError",
          input: templatePath,
          details: `Failed to parse template: ${error}`,
        } as DomainError,
      };
    }
  }

  /**
   * Transform frontmatter parts based on x-frontmatter-part configuration
   */
  transformFrontmatterParts(
    input: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError> {
    const result: Record<string, unknown> = {};
    const properties = schema.properties as Record<string, unknown> || {};

    for (const [key, propSchema] of Object.entries(properties)) {
      const prop = propSchema as Record<string, unknown>;
      const xPart = prop[SchemaExtensions.FRONTMATTER_PART] as boolean;

      if (xPart && prop.type === "array") {
        // Transform single value to array for x-frontmatter-part fields
        // Look for singular form of the field name (e.g., "author" for "authors")
        const singularKey = key.endsWith("s") ? key.slice(0, -1) : key;
        const sourceValue = input[singularKey] || input[key];

        if (sourceValue === undefined) {
          result[key] = [];
        } else if (Array.isArray(sourceValue)) {
          result[key] = sourceValue;
        } else {
          result[key] = [sourceValue];
        }
      } else if (input[key] !== undefined) {
        result[key] = input[key];
      }
    }

    // Copy over any input fields not defined in schema
    for (const [key, value] of Object.entries(input)) {
      if (!(key in result)) {
        result[key] = value;
      }
    }

    return { ok: true, data: result };
  }

  /**
   * Extract schema extension properties from a schema field
   */
  extractExtensions(
    fieldSchema: Record<string, unknown>,
  ): Record<string, unknown> {
    const extensions: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(fieldSchema)) {
      if (key.startsWith("x-")) {
        extensions[key] = value;
      }
    }

    return extensions;
  }

  /**
   * Validate schema extensions according to known patterns
   */
  validateExtensions(
    extensions: Record<string, unknown>,
  ): Result<boolean, DomainError> {
    for (const [key, value] of Object.entries(extensions)) {
      // Validate x-template
      if (key === SchemaExtensions.TEMPLATE) {
        if (typeof value !== "object" && typeof value !== "string") {
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: key,
              expectedFormat: "object or string",
            }),
          };
        }
      }

      // Validate x-derived-from
      if (key === SchemaExtensions.DERIVED_FROM) {
        if (typeof value !== "string") {
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: key,
              expectedFormat: "string",
            }),
          };
        }
      }

      // Validate x-derived-unique
      if (key === SchemaExtensions.DERIVED_UNIQUE) {
        if (typeof value !== "boolean") {
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: key,
              expectedFormat: "boolean",
            }),
          };
        }
      }

      // Validate x-frontmatter-part
      if (key === SchemaExtensions.FRONTMATTER_PART) {
        if (typeof value !== "boolean") {
          return {
            ok: false,
            error: createDomainError({
              kind: "InvalidFormat",
              input: key,
              expectedFormat: "boolean",
            }),
          };
        }
      }
    }

    return { ok: true, data: true };
  }

  /**
   * Process schema with all x-* extensions
   */
  async processExtensions(
    document: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): Promise<Result<Record<string, unknown>, DomainError>> {
    let processed = { ...document };

    // Apply x-frontmatter-part transformations
    const transformResult = this.transformFrontmatterParts(processed, schema);
    if (!transformResult.ok) {
      return transformResult;
    }
    processed = transformResult.data;

    // Apply x-template selection
    if (schema[SchemaExtensions.TEMPLATE]) {
      const templateResult = await this.selectTemplate(schema, processed);
      if (!templateResult.ok) {
        return templateResult;
      }
      processed._template = templateResult.data;
    }

    return { ok: true, data: processed };
  }

  /**
   * Find all fields marked with x-frontmatter-part in schema
   */
  findFrontmatterParts(schema: Record<string, unknown>): string[] {
    const parts: string[] = [];
    const properties = schema.properties as Record<string, unknown> || {};

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const field = fieldSchema as Record<string, unknown>;
      if (field[SchemaExtensions.FRONTMATTER_PART] === true) {
        parts.push(fieldName);
      }
    }

    return parts;
  }

  /**
   * Apply derived field processing compatible with develop branch aggregation service
   */
  processDerivedFields(
    documents: Array<Record<string, unknown>>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError> {
    const properties = schema.properties as Record<string, unknown> || {};
    const derived: Record<string, unknown> = {};

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const field = fieldSchema as Record<string, unknown>;
      const derivedFrom = field[SchemaExtensions.DERIVED_FROM] as string;

      if (derivedFrom) {
        const values: unknown[] = [];

        for (const doc of documents) {
          const value = this.extractNestedValue(doc, derivedFrom);
          if (value !== undefined) {
            if (Array.isArray(value)) {
              values.push(...value);
            } else {
              values.push(value);
            }
          }
        }

        // Apply x-derived-unique if specified
        if (field[SchemaExtensions.DERIVED_UNIQUE] === true) {
          derived[fieldName] = this.getUniqueValues(values);
        } else {
          derived[fieldName] = values;
        }
      }
    }

    return { ok: true, data: derived };
  }

  /**
   * Extract nested value using dot notation path
   */
  private extractNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    // Handle array notation like "items[].category"
    const arrayMatch = path.match(/^(.+)\[\]\.(.+)$/);
    if (arrayMatch) {
      const [, arrayPath, itemPath] = arrayMatch;
      const arrayValue = this.getNestedProperty(obj, arrayPath);
      if (Array.isArray(arrayValue)) {
        return arrayValue.map((item) =>
          typeof item === "object" && item !== null
            ? this.getNestedProperty(item as Record<string, unknown>, itemPath)
            : undefined
        ).filter((v) => v !== undefined);
      }
      return undefined;
    }

    return this.getNestedProperty(obj, path);
  }

  /**
   * Get nested property using dot notation
   */
  private getNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object" && !Array.isArray(current)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Get unique values from array
   */
  private getUniqueValues(values: unknown[]): unknown[] {
    const seen = new Set<string>();
    const unique: unknown[] = [];

    for (const value of values) {
      const key = this.getValueKey(value);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    }

    return unique;
  }

  /**
   * Get string key for value comparison
   */
  private getValueKey(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "[object]";
      }
    }
    return String(value);
  }
}

/**
 * Factory function to create schema extension processor
 */
export function createSchemaExtensionProcessor(
  fileSystem?: FileSystemProvider,
): SchemaExtensionProcessor {
  return new SchemaExtensionProcessor(fileSystem);
}
