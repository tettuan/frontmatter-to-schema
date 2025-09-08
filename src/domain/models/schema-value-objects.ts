/**
 * Schema-related Value Objects implementing Domain-Driven Design patterns
 *
 * These value objects follow the Totality principle:
 * - Smart constructors ensure only valid instances can be created
 * - All functions are total (no exceptions, use Result types)
 * - Immutable after creation
 * - Self-validating with business rules embedded
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { VERSION_CONFIG } from "../../config/version.ts";

/**
 * Represents a schema definition for validating frontmatter data
 *
 * Business Rules:
 * - Definition must be a valid object structure
 * - Cannot be null, undefined, or an array
 * - Must preserve both processed and raw versions
 * - Immutable after creation
 *
 * @example
 * const result = SchemaDefinition.create({
 *   type: "object",
 *   properties: { title: { type: "string" } }
 * });
 * if (result.ok) {
 *   console.log(result.data.getProperties()); // { title: { type: "string" } }
 * }
 */
export class SchemaDefinition {
  private constructor(
    private readonly value: unknown,
    private readonly rawDefinition: unknown,
    private readonly version: string,
  ) {}

  /**
   * Creates a validated SchemaDefinition instance
   *
   * @param definition - The schema definition object
   * @param version - Schema version (defaults to VERSION_CONFIG.DEFAULT_SCHEMA_VERSION)
   * @returns Result containing either a valid SchemaDefinition or validation error
   */
  static create(
    definition: unknown,
    version: string = VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
  ): Result<SchemaDefinition, DomainError & { message: string }> {
    if (!definition) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Schema definition cannot be empty"),
      };
    }

    if (
      typeof definition !== "object" || definition === null ||
      Array.isArray(definition)
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof definition,
          expectedFormat: "object",
        }, "Schema definition must be a plain object"),
      };
    }

    // Store both raw and processed versions
    // The raw definition preserves the original JSON schema structure
    const rawCopy = JSON.parse(JSON.stringify(definition));
    return {
      ok: true,
      data: new SchemaDefinition(definition, rawCopy, version),
    };
  }

  /**
   * Gets the processed schema definition
   */
  getValue(): unknown {
    return this.value;
  }

  /**
   * Gets the raw schema definition (original structure)
   */
  getRawDefinition(): unknown {
    return this.rawDefinition;
  }

  /**
   * Gets the schema version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Validates data against this schema
   *
   * @param data - Data to validate
   * @returns Result indicating validation success or failure
   */
  validate(
    data: unknown,
  ): Result<boolean, DomainError & { message: string }> {
    // Basic validation - reject null/undefined
    if (data === null || data === undefined) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Data to validate cannot be null or undefined"),
      };
    }

    // For now, just return true for any non-null data
    // In a real implementation, we'd validate against the JSON Schema
    return { ok: true, data: true };
  }

  /**
   * Get all properties defined in the schema
   * @returns An object mapping property names to their definitions
   */
  getProperties(): Record<string, unknown> {
    const definition = this.value as Record<string, unknown>;

    // Handle JSON Schema format
    if (definition.properties && typeof definition.properties === "object") {
      return definition.properties as Record<string, unknown>;
    }

    // Handle simple object format (direct properties)
    // Filter out metadata fields like $schema, $id, type, etc.
    const metadataFields = [
      "$schema",
      "$id",
      "type",
      "title",
      "description",
      "required",
      "additionalProperties",
    ];
    const properties: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(definition)) {
      if (!metadataFields.includes(key)) {
        properties[key] = value;
      }
    }

    return properties;
  }

  /**
   * Get list of required fields from the schema
   * @returns Array of required field names
   */
  getRequiredFields(): string[] {
    const definition = this.value as Record<string, unknown>;

    // Handle JSON Schema format with required array
    if (Array.isArray(definition.required)) {
      return definition.required.filter((field): field is string =>
        typeof field === "string"
      );
    }

    // Handle properties with required flag
    if (definition.properties && typeof definition.properties === "object") {
      const required: string[] = [];
      const properties = definition.properties as Record<string, unknown>;

      for (const [key, propDef] of Object.entries(properties)) {
        if (
          propDef &&
          typeof propDef === "object" &&
          "required" in propDef &&
          (propDef as Record<string, unknown>).required === true
        ) {
          required.push(key);
        }
      }

      if (required.length > 0) {
        return required;
      }
    }

    // Default to all properties being required if no explicit required field
    return Object.keys(this.getProperties());
  }
}

/**
 * Represents a semantic version for schema compatibility
 *
 * Business Rules:
 * - Must follow semantic versioning format (X.Y.Z)
 * - Major version determines compatibility
 * - Immutable after creation
 *
 * @example
 * const result = SchemaVersion.create("2.1.3");
 * if (result.ok) {
 *   console.log(result.data.toString()); // "2.1.3"
 *   const other = SchemaVersion.create("2.0.0").data;
 *   console.log(result.data.isCompatibleWith(other)); // true (same major)
 * }
 */
export class SchemaVersion {
  private constructor(
    private readonly major: number,
    private readonly minor: number,
    private readonly patch: number,
  ) {}

  /**
   * Creates a validated SchemaVersion instance
   *
   * @param version - Version string in X.Y.Z format
   * @returns Result containing either a valid SchemaVersion or validation error
   */
  static create(
    version: string,
  ): Result<SchemaVersion, DomainError & { message: string }> {
    // Strict semantic versioning validation
    // Only accept proper semantic version format: X.Y.Z
    const trimmedVersion = version.trim();

    // Check for valid semantic version pattern (X.Y.Z)
    const strictPattern = /^(\d+)\.(\d+)\.(\d+)$/;
    const match = trimmedVersion.match(strictPattern);

    if (match) {
      const [, major, minor, patch] = match;
      return {
        ok: true,
        data: new SchemaVersion(
          parseInt(major),
          parseInt(minor),
          parseInt(patch),
        ),
      };
    }

    // Reject invalid formats
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: version,
          expectedFormat: "X.Y.Z (semantic version)",
        },
        `Invalid version format. Expected X.Y.Z (semantic version), got: ${version}`,
      ),
    };
  }

  /**
   * Gets the version as a string
   */
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }

  /**
   * Checks if this version is compatible with another version
   * Compatibility is based on major version match
   *
   * @param other - Another SchemaVersion to check compatibility with
   * @returns true if versions are compatible (same major version)
   */
  isCompatibleWith(other: SchemaVersion): boolean {
    return this.major === other.major;
  }
}
