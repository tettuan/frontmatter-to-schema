import { Result } from "../shared/result.ts";
import { ValidationError } from "../shared/errors.ts";

export type SchemaFormat = "json" | "yaml" | "custom";

export class SchemaDefinition {
  private constructor(
    private readonly definition: unknown,
    private readonly format: SchemaFormat,
  ) {}

  static create(
    definition: unknown,
    format: SchemaFormat,
  ): Result<SchemaDefinition, ValidationError> {
    if (!definition) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Schema definition cannot be empty",
        },
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

  validate(data: unknown): Result<unknown, ValidationError> {
    // This would be implemented by specific validators
    // For now, we return the data as-is
    return { ok: true, data };
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
          kind: "ValidationError",
          message: "Schema ID cannot be empty",
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

  validate(data: unknown): Result<unknown, ValidationError> {
    return this.definition.validate(data);
  }
}