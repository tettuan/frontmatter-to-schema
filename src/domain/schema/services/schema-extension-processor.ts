/**
 * Schema Extension Processor Service (Refactored)
 *
 * Handles x-* schema extensions for dynamic template selection,
 * field transformations, and other schema-specific behaviors.
 * Follows DDD principles with Result types for error handling.
 *
 * REFACTORED: Eliminates hardcoding violations by using SchemaExtensionRegistry
 * Implements configurable extension processing through registry abstraction
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import type { SchemaExtensionRegistry } from "../entities/schema-extension-registry.ts";
import { ExtensionType } from "../value-objects/extension-value.ts";
import { ExtensionProcessor } from "./extension-processor.ts";
import { PluralizationConfig } from "../../shared/value-objects/pluralization-config.ts";

export interface FileSystemProvider {
  readFile(path: string): Promise<Result<string, DomainError>>;
}

export interface Template {
  layout: string;
  sections?: string[];
  [key: string]: unknown;
}

export class SchemaExtensionProcessor {
  private readonly extensionProcessor: ExtensionProcessor;
  private readonly pluralizationConfig: PluralizationConfig;

  constructor(
    private readonly registry: SchemaExtensionRegistry,
    private readonly fileSystem?: FileSystemProvider,
    pluralizationConfig?: PluralizationConfig,
  ) {
    this.extensionProcessor = new ExtensionProcessor(registry);

    // Use provided config or create default (following Totality principles)
    if (pluralizationConfig) {
      this.pluralizationConfig = pluralizationConfig;
    } else {
      // Use createOrDefault pattern for Totality compliance
      this.pluralizationConfig = PluralizationConfig.createOrDefault();
    }
  }

  /**
   * Select template based on x-template configuration and document type
   * REFACTORED: Uses registry to access template property instead of hardcoded string
   */
  async selectTemplate(
    schema: Record<string, unknown>,
    document: Record<string, unknown>,
  ): Promise<Result<Template, DomainError>> {
    // Use registry to get template extension value
    const templateExtraction = this.registry.extractExtensionValue(
      schema,
      ExtensionType.TEMPLATE,
    );

    if (!templateExtraction.ok) {
      return {
        ok: false,
        error: {
          kind: "ParseError",
          input: "template_extraction",
          details: templateExtraction.error.message,
        } as DomainError,
      };
    }

    const templateValue = templateExtraction.data;
    if (!templateValue) {
      return {
        ok: true,
        data: { layout: "default", sections: ["main"] },
      };
    }

    let xTemplate: unknown;
    if (templateValue.kind === "ObjectExtension") {
      xTemplate = templateValue.configuration;
    } else if (templateValue.kind === "StringExtension") {
      xTemplate = { default: templateValue.value };
    } else {
      xTemplate = null;
    }

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
   * REFACTORED: Uses registry to access frontmatter-part property instead of hardcoded string
   */
  transformFrontmatterParts(
    input: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError> {
    const result: Record<string, unknown> = {};
    const properties = schema.properties as Record<string, unknown> || {};

    for (const [key, propSchema] of Object.entries(properties)) {
      const prop = propSchema as Record<string, unknown>;

      // Use registry to extract frontmatter-part extension
      const frontmatterExtraction = this.registry.extractExtensionValue(
        prop,
        ExtensionType.FRONTMATTER_PART,
      );

      let xPart = false;
      if (
        frontmatterExtraction.ok &&
        frontmatterExtraction.data?.kind === "BooleanExtension"
      ) {
        xPart = frontmatterExtraction.data.enabled;
      }

      if (xPart && prop.type === "array") {
        // Transform single value to array for x-frontmatter-part fields
        // Look for singular form of the field name using configurable pluralization
        // REFACTORED: Eliminates English-specific hardcoding (Issue #663)
        const singularResult = this.pluralizationConfig.singularize(key);
        const singularKey = singularResult.ok ? singularResult.data : key;
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
   * REFACTORED: Uses registry property names for validation instead of hardcoded strings
   */
  validateExtensions(
    extensions: Record<string, unknown>,
  ): Result<boolean, DomainError> {
    for (const [key, value] of Object.entries(extensions)) {
      // Validate template extension
      if (key === this.registry.getTemplateProperty()) {
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

      // Validate derived-from extension
      if (key === this.registry.getDerivedFromProperty()) {
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

      // Validate derived-unique extension
      if (key === this.registry.getDerivedUniqueProperty()) {
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

      // Validate frontmatter-part extension
      if (key === this.registry.getFrontmatterPartProperty()) {
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

    // Apply template selection using registry
    if (this.registry.hasExtension(schema, ExtensionType.TEMPLATE)) {
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
   * REFACTORED: Uses registry to access frontmatter-part property instead of hardcoded string
   */
  findFrontmatterParts(schema: Record<string, unknown>): string[] {
    const parts: string[] = [];
    const properties = schema.properties as Record<string, unknown> || {};

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const field = fieldSchema as Record<string, unknown>;

      // Use registry to check frontmatter-part extension
      const frontmatterExtraction = this.registry.extractExtensionValue(
        field,
        ExtensionType.FRONTMATTER_PART,
      );

      if (
        frontmatterExtraction.ok &&
        frontmatterExtraction.data?.kind === "BooleanExtension" &&
        frontmatterExtraction.data.enabled
      ) {
        parts.push(fieldName);
      }
    }

    return parts;
  }

  /**
   * Apply derived field processing compatible with develop branch aggregation service
   * REFACTORED: Uses registry to access derived extension properties instead of hardcoded strings
   */
  processDerivedFields(
    documents: Array<Record<string, unknown>>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError> {
    const properties = schema.properties as Record<string, unknown> || {};
    const derived: Record<string, unknown> = {};

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const field = fieldSchema as Record<string, unknown>;

      // Use registry to extract derived-from extension
      const derivedFromExtraction = this.registry.extractExtensionValue(
        field,
        ExtensionType.DERIVED_FROM,
      );

      let derivedFrom: string | null = null;
      if (
        derivedFromExtraction.ok &&
        derivedFromExtraction.data?.kind === "StringExtension"
      ) {
        derivedFrom = derivedFromExtraction.data.value;
      }

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

        // Use registry to check derived-unique extension
        const derivedUniqueExtraction = this.registry.extractExtensionValue(
          field,
          ExtensionType.DERIVED_UNIQUE,
        );

        let isUnique = false;
        if (
          derivedUniqueExtraction.ok &&
          derivedUniqueExtraction.data?.kind === "BooleanExtension"
        ) {
          isUnique = derivedUniqueExtraction.data.enabled;
        }

        if (isUnique) {
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
 * REFACTORED: Now requires registry dependency to eliminate hardcoding
 */
export function createSchemaExtensionProcessor(
  registry: SchemaExtensionRegistry,
  fileSystem?: FileSystemProvider,
): SchemaExtensionProcessor {
  return new SchemaExtensionProcessor(registry, fileSystem);
}
