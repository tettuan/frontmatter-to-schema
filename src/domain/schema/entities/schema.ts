// Schema domain entities following DDD principles

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import type {
  SchemaDefinition,
  SchemaVersion,
} from "../../../domain/models/value-objects.ts";

// Discriminated union for validated data following totality principle
export type ValidatedData<T = unknown> =
  | {
    kind: "Valid";
    data: T;
    metadata: ValidationMetadata;
  }
  | {
    kind: "PartiallyValid";
    validData: Partial<T>;
    invalidFields: Array<{ field: string; error: string }>;
    metadata: ValidationMetadata;
  };

// Validation metadata
export interface ValidationMetadata {
  schemaId: string;
  schemaVersion: string;
  validatedAt: Date;
}

export class SchemaId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<SchemaId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new SchemaId(value) };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SchemaId): boolean {
    return this.value === other.value;
  }
}

export class Schema {
  constructor(
    private readonly id: SchemaId,
    private readonly definition: SchemaDefinition,
    private readonly version: SchemaVersion,
    private readonly description: string,
  ) {}

  static create(
    id: SchemaId,
    definition: SchemaDefinition,
    version: SchemaVersion,
    description: string = "",
  ): Schema {
    return new Schema(id, definition, version, description);
  }

  getId(): SchemaId {
    return this.id;
  }

  getDefinition(): SchemaDefinition {
    return this.definition;
  }

  getVersion(): SchemaVersion {
    return this.version;
  }

  getDescription(): string {
    return this.description;
  }

  /**
   * Validate data against schema and return typed, validated data
   * Following totality principle - returns validated data instead of void
   */
  validate<T = unknown>(data: unknown): Result<ValidatedData<T>, DomainError> {
    const result = this.definition.validate(data);
    if (result.ok) {
      // Return validated data with metadata
      return {
        ok: true,
        data: {
          kind: "Valid",
          data: data as T,
          metadata: {
            schemaId: this.id.getValue(),
            schemaVersion: this.version.toString(),
            validatedAt: new Date(),
          },
        },
      };
    }

    // Return validation failure with partial data if possible
    return {
      ok: false,
      error: result.error,
    };
  }

  /**
   * Get all properties defined in the schema
   * Proxy method to SchemaDefinition.getProperties()
   */
  getProperties(): Record<string, unknown> {
    return this.definition.getProperties();
  }

  /**
   * Get list of required fields from the schema
   * Proxy method to SchemaDefinition.getRequiredFields()
   */
  getRequiredFields(): string[] {
    return this.definition.getRequiredFields();
  }
}
