import type { DomainError, ProcessingConfig, Result } from "./types.ts";
import type { ExtractedData } from "./frontmatter-extractor.ts";

export interface ResolvedSchema {
  readonly definition: Record<string, unknown>;
  readonly format: string;
}

export interface ValidatedData {
  readonly path: string;
  readonly data: Record<string, unknown>;
  readonly isValid: true;
}

export class SchemaResolver {
  private constructor() {}

  static create(): Result<SchemaResolver, DomainError> {
    return { ok: true, data: new SchemaResolver() };
  }

  async resolveSchema(
    config: ProcessingConfig["schema"],
  ): Promise<Result<ResolvedSchema, DomainError>> {
    try {
      const content = await Deno.readTextFile(config.path);

      let definition: Record<string, unknown>;
      if (config.format === "json") {
        definition = JSON.parse(content);
      } else {
        // Simple YAML parsing for schema
        definition = this.parseYamlSchema(content);
      }

      return {
        ok: true,
        data: { definition, format: config.format },
      };
    } catch (error) {
      return {
        ok: false,
        error: { kind: "ReadError", path: config.path, details: String(error) },
      };
    }
  }

  validate(
    schema: ResolvedSchema,
    data: ExtractedData,
  ): Result<ValidatedData, DomainError> {
    // Simplified validation logic following totality principles
    const schemaProps =
      schema.definition.properties as Record<string, unknown> || {};

    for (const [key, schemaValue] of Object.entries(schemaProps)) {
      const dataValue = data.data[key];

      if (!this.isValidType(dataValue, schemaValue)) {
        return {
          ok: false,
          error: {
            kind: "SchemaValidationFailed",
            schema: schemaValue,
            data: dataValue,
          },
        };
      }
    }

    return {
      ok: true,
      data: {
        path: data.path,
        data: data.data,
        isValid: true,
      },
    };
  }

  private parseYamlSchema(content: string): Record<string, unknown> {
    // Simplified YAML parsing for schema files
    // This would be enhanced with proper YAML library in production
    try {
      return JSON.parse(content.replace(/'/g, '"'));
    } catch {
      return {};
    }
  }

  private isValidType(value: unknown, schemaSpec: unknown): boolean {
    // Basic type validation - enhanced in production
    if (typeof schemaSpec !== "object" || !schemaSpec) return true;

    const spec = schemaSpec as { type?: string };
    if (!spec.type) return true;

    switch (spec.type) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number";
      case "boolean":
        return typeof value === "boolean";
      case "array":
        return Array.isArray(value);
      case "object":
        return typeof value === "object" && value !== null;
      default:
        return true;
    }
  }
}
