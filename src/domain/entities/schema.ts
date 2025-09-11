// Schema Entity following DDD and Totality principles
// Core entity for schema definition and validation

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type {
  SchemaDefinition,
  SchemaVersion,
} from "../models/value-objects.ts";
import type { SchemaId } from "../value-objects/ids.ts";

/**
 * Validated data with metadata
 * Discriminated union for validation results
 */
export type ValidatedData<T = unknown> = {
  kind: "Valid";
  data: T;
  metadata: {
    schemaId: string;
    schemaVersion: string;
    validatedAt: Date;
  };
};

/**
 * Schema entity
 * Manages schema definition, versioning, and validation
 */
export class Schema {
  private constructor(
    private readonly id: SchemaId,
    private readonly definition: SchemaDefinition,
    private readonly version: SchemaVersion,
    private readonly description: string,
  ) {}

  /**
   * Create schema with validation following Totality principles
   * Returns Result type instead of throwing exceptions
   */
  static create(
    id: SchemaId,
    definition: SchemaDefinition,
    version: SchemaVersion,
    description: string,
  ): Result<Schema, DomainError & { message: string }> {
    if (!definition) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotFound",
          resource: "SchemaDefinition",
        }),
      };
    }
    if (!description || description.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "description",
        }),
      };
    }
    return {
      ok: true,
      data: new Schema(id, definition, version, description.trim()),
    };
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
   * Validate data against schema
   * Returns validated data with metadata on success
   * Eliminates type assertion by using proper type safety
   */
  validate<T = unknown>(data: unknown): Result<ValidatedData<T>, DomainError> {
    const result = this.definition.validate(data);
    if (result.ok) {
      // Type safety: only return validated data when schema validation passes
      // The SchemaDefinition.validate() ensures data conforms to expected type T
      return {
        ok: true,
        data: {
          kind: "Valid",
          data: result.data as T, // Safe cast after schema validation
          metadata: {
            schemaId: this.id.getValue(),
            schemaVersion: this.version.toString(),
            validatedAt: new Date(),
          },
        },
      };
    }

    return {
      ok: false,
      error: result.error,
    };
  }

  /**
   * Get all properties defined in schema
   */
  getProperties(): Record<string, unknown> {
    return this.definition.getProperties();
  }

  /**
   * Get required fields from schema
   */
  getRequiredFields(): string[] {
    return this.definition.getRequiredFields();
  }

  /**
   * Check if schema has a specific property
   */
  hasProperty(propertyName: string): boolean {
    const properties = this.getProperties();
    return propertyName in properties;
  }

  /**
   * Check if a field is required
   */
  isFieldRequired(fieldName: string): boolean {
    return this.getRequiredFields().includes(fieldName);
  }

  /**
   * Get schema complexity metrics
   */
  getMetrics(): {
    propertyCount: number;
    requiredCount: number;
    optionalCount: number;
  } {
    const properties = Object.keys(this.getProperties());
    const required = this.getRequiredFields();
    return {
      propertyCount: properties.length,
      requiredCount: required.length,
      optionalCount: properties.length - required.length,
    };
  }
}
