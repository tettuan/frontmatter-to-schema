import type { Result } from "../core/result.ts";
import type { ValidationError } from "../core/result.ts";

export type SchemaFormat = "json" | "yaml" | "custom";

export class SchemaDefinition {
  private constructor(
    private readonly definition: unknown,
    private readonly format: SchemaFormat,
  ) {}

  static create(
    definition: unknown,
    format: SchemaFormat,
  ): Result<SchemaDefinition, ValidationError & { message: string }> {
    if (!definition) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Schema definition cannot be empty",
        } as ValidationError & { message: string },
      };
    }

    if (
      typeof definition !== "object" || definition === null ||
      Array.isArray(definition)
    ) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: typeof definition,
          expectedFormat: "object",
          message: "Schema definition must be a plain object",
        } as ValidationError & { message: string },
      };
    }

    return { ok: true, data: new SchemaDefinition(definition, format) };
  }

  getDefinition(): unknown {
    return this.definition;
  }

  getFormat(): SchemaFormat {
    return this.format;
  }

  validate(
    data: unknown,
  ): Result<boolean, ValidationError & { message: string }> {
    // Basic validation - reject null/undefined
    if (data === null || data === undefined) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Data to validate cannot be null or undefined",
        } as ValidationError & { message: string },
      };
    }

    // For now, just return true for any non-null data
    // In a real implementation, we'd validate against the JSON Schema
    return { ok: true, data: true };
  }
}

export class Schema {
  private constructor(
    private readonly id: string,
    private readonly definition: SchemaDefinition,
    private readonly description?: string,
  ) {}

  static create(
    id: string,
    definition: SchemaDefinition,
    description?: string,
  ): Result<Schema, ValidationError> {
    if (!id || id.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        },
      };
    }

    return {
      ok: true,
      data: new Schema(id.trim(), definition, description),
    };
  }

  getId(): string {
    return this.id;
  }

  getDefinition(): SchemaDefinition {
    return this.definition;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  validate(
    data: unknown,
  ): Result<boolean, ValidationError & { message: string }> {
    return this.definition.validate(data);
  }
}
