/**
 * Schema Extension Configuration
 *
 * Configurable property names for schema extensions to eliminate hardcoding
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";
import { SchemaExtensions } from "../schema/value-objects/schema-extensions.ts";

/**
 * Configuration for schema extension property names
 * Makes x-* property names configurable instead of hardcoded
 */
export class SchemaExtensionConfig {
  private constructor(
    private readonly templateProperty: string,
    private readonly derivedFromProperty: string,
    private readonly derivedUniqueProperty: string,
    private readonly derivedFlattenProperty: string,
    private readonly frontmatterPartProperty: string,
  ) {}

  /**
   * Smart Constructor for SchemaExtensionConfig
   * Validates all property names are valid and unique
   */
  static create(config: {
    templateProperty?: string;
    derivedFromProperty?: string;
    derivedUniqueProperty?: string;
    derivedFlattenProperty?: string;
    frontmatterPartProperty?: string;
  }): Result<SchemaExtensionConfig, DomainError & { message: string }> {
    // Use defaults if not provided
    const templateProperty = config.templateProperty ??
      SchemaExtensions.TEMPLATE;
    const derivedFromProperty = config.derivedFromProperty ??
      SchemaExtensions.DERIVED_FROM;
    const derivedUniqueProperty = config.derivedUniqueProperty ??
      SchemaExtensions.DERIVED_UNIQUE;
    const derivedFlattenProperty = config.derivedFlattenProperty ??
      SchemaExtensions.DERIVED_FLATTEN;
    const frontmatterPartProperty = config.frontmatterPartProperty ??
      SchemaExtensions.FRONTMATTER_PART;

    // Validate property names
    const properties = [
      { name: "templateProperty", value: templateProperty },
      { name: "derivedFromProperty", value: derivedFromProperty },
      { name: "derivedUniqueProperty", value: derivedUniqueProperty },
      { name: "derivedFlattenProperty", value: derivedFlattenProperty },
      { name: "frontmatterPartProperty", value: frontmatterPartProperty },
    ];

    // Check for empty or invalid property names
    for (const prop of properties) {
      if (!prop.value || prop.value.trim() === "") {
        return {
          ok: false,
          error: createDomainError(
            { kind: "EmptyInput" },
            `${prop.name} cannot be empty`,
          ),
        };
      }

      const trimmed = prop.value.trim();

      // Check for valid property name format
      if (!trimmed.match(/^[a-zA-Z][a-zA-Z0-9\-_]*$/)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: trimmed,
              expectedFormat: "alphanumeric with hyphens and underscores",
            },
            `${prop.name} must be a valid property name: ${trimmed}`,
          ),
        };
      }
    }

    // Check for uniqueness
    const propertyValues = properties.map((p) => p.value.trim());
    const uniqueValues = new Set(propertyValues);
    if (uniqueValues.size !== propertyValues.length) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidState",
            expected: "unique property names",
            actual: `duplicate values: ${propertyValues.join(", ")}`,
          },
          "All schema extension property names must be unique",
        ),
      };
    }

    return {
      ok: true,
      data: new SchemaExtensionConfig(
        templateProperty.trim(),
        derivedFromProperty.trim(),
        derivedUniqueProperty.trim(),
        derivedFlattenProperty.trim(),
        frontmatterPartProperty.trim(),
      ),
    };
  }

  /**
   * Create default configuration with standard x-* property names
   */
  static createDefault(): Result<SchemaExtensionConfig, DomainError & { message: string }> {
    return SchemaExtensionConfig.create({});
  }

  /**
   * Get the template property name (default: "x-template")
   */
  getTemplateProperty(): string {
    return this.templateProperty;
  }

  /**
   * Get the derived-from property name (default: "x-derived-from")
   */
  getDerivedFromProperty(): string {
    return this.derivedFromProperty;
  }

  /**
   * Get the derived-unique property name (default: "x-derived-unique")
   */
  getDerivedUniqueProperty(): string {
    return this.derivedUniqueProperty;
  }

  /**
   * Get the derived-flatten property name (default: "x-derived-flatten")
   */
  getDerivedFlattenProperty(): string {
    return this.derivedFlattenProperty;
  }

  /**
   * Get the frontmatter-part property name (default: "x-frontmatter-part")
   */
  getFrontmatterPartProperty(): string {
    return this.frontmatterPartProperty;
  }

  /**
   * Get all property names as a readonly array
   */
  getAllProperties(): ReadonlyArray<string> {
    return [
      this.templateProperty,
      this.derivedFromProperty,
      this.derivedUniqueProperty,
      this.derivedFlattenProperty,
      this.frontmatterPartProperty,
    ];
  }

  /**
   * Check if a property name is a configured extension property
   */
  isExtensionProperty(propertyName: string): boolean {
    return this.getAllProperties().includes(propertyName);
  }

  /**
   * Get extension property type for a given property name
   */
  getExtensionType(
    propertyName: string,
  ): Result<ExtensionPropertyType, DomainError & { message: string }> {
    switch (propertyName) {
      case this.templateProperty:
        return { ok: true, data: "template" };
      case this.derivedFromProperty:
        return { ok: true, data: "derivedFrom" };
      case this.derivedUniqueProperty:
        return { ok: true, data: "derivedUnique" };
      case this.derivedFlattenProperty:
        return { ok: true, data: "derivedFlatten" };
      case this.frontmatterPartProperty:
        return { ok: true, data: "frontmatterPart" };
      default:
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "NotFound",
              resource: "extension property",
              name: propertyName,
            },
            `Unknown extension property: ${propertyName}`,
          ),
        };
    }
  }

  /**
   * Create property validation map for schema validation
   */
  createPropertyValidationMap(): Record<string, ExtensionPropertyType> {
    return {
      [this.templateProperty]: "template",
      [this.derivedFromProperty]: "derivedFrom",
      [this.derivedUniqueProperty]: "derivedUnique",
      [this.derivedFlattenProperty]: "derivedFlatten",
      [this.frontmatterPartProperty]: "frontmatterPart",
    };
  }

  /**
   * Check equality with another SchemaExtensionConfig
   */
  equals(other: SchemaExtensionConfig): boolean {
    return (
      this.templateProperty === other.templateProperty &&
      this.derivedFromProperty === other.derivedFromProperty &&
      this.derivedUniqueProperty === other.derivedUniqueProperty &&
      this.derivedFlattenProperty === other.derivedFlattenProperty &&
      this.frontmatterPartProperty === other.frontmatterPartProperty
    );
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `SchemaExtensionConfig(template:${this.templateProperty}, derivedFrom:${this.derivedFromProperty}, derivedUnique:${this.derivedUniqueProperty}, derivedFlatten:${this.derivedFlattenProperty}, frontmatterPart:${this.frontmatterPartProperty})`;
  }
}

/**
 * Types of extension properties
 */
export type ExtensionPropertyType =
  | "template"
  | "derivedFrom"
  | "derivedUnique"
  | "derivedFlatten"
  | "frontmatterPart";

/**
 * Type guard for extension property types
 */
export function isExtensionPropertyType(
  value: string,
): value is ExtensionPropertyType {
  return [
    "template",
    "derivedFrom",
    "derivedUnique",
    "derivedFlatten",
    "frontmatterPart",
  ].includes(value);
}
