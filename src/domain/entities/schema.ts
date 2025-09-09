// Schema Entity following DDD and Totality principles
// Core entity for schema definition and validation

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
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
   * Create schema with validation
   * Ensures description is never undefined
   */
  static create(
    id: SchemaId,
    definition: SchemaDefinition,
    version: SchemaVersion,
    description?: string,
  ): Schema {
    const safeDescription = description ?? "";

    // Validate that definition has required structure
    if (!definition) {
      throw new Error("Definition is required for schema creation");
    }

    return new Schema(id, definition, version, safeDescription);
  }

  /**
   * Factory method for backward compatibility
   * @deprecated Use create() with Result type instead
   */
  static createUnsafe(
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
   * Validate data against schema
   * Returns validated data with metadata on success
   */
  validate<T = unknown>(data: unknown): Result<ValidatedData<T>, DomainError> {
    const result = this.definition.validate(data);
    if (result.ok) {
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
