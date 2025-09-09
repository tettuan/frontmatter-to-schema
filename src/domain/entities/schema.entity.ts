/**
 * Schema domain entity
 * Extracted from entities-original.ts for better organization
 * Represents a schema definition with validation capabilities
 * Follows Totality principles with Result types and Smart Constructors
 */

import type { DomainError, Result } from "../core/result.ts";
import type {
  SchemaDefinition,
  SchemaVersion,
} from "../models/value-objects.ts";
import type { ValidatedData } from "../types/domain-types.ts";
import type { SchemaId } from "../value-objects/identifier-value-objects.ts";

/**
 * Schema entity representing a data validation schema
 * Encapsulates schema identity, definition, version, and validation logic
 */
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
