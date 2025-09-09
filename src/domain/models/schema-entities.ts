// Schema-related entities following DDD principles

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import type { SchemaDefinition, SchemaVersion } from "./value-objects.ts";

// Validation metadata interface
export interface ValidationMetadata {
  schemaId: string;
  schemaVersion: string;
  validatedAt: Date;
}

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

// SchemaId value object
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
          field: "SchemaId",
        },
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

// Schema entity
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
  validate(data: unknown): Result<ValidatedData<unknown>, DomainError> {
    const result = this.definition.validate(data);
    if (result.ok) {
      // Return validated data with metadata
      // The schema has validated the data, so we return it with metadata
      return {
        ok: true,
        data: {
          kind: "Valid",
          data: data,
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
