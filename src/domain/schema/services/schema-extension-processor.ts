/**
 * Schema Extension Processor Service
 *
 * Handles x-* schema extensions for dynamic template selection,
 * field transformations, and other schema-specific behaviors.
 * Follows DDD principles with Result types for error handling.
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
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
      const xPart = prop[SchemaExtensions.FRONTMATTER_PART] as string;

      if (xPart && prop.type === "array") {
        // Transform single value to array
        const sourceValue = input[xPart];
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

    return { ok: true, data: result };
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
}
