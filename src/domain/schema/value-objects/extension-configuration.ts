/**
 * Extension Configuration Value Object
 *
 * Immutable configuration for extension properties
 * Implements Totality validation patterns and Smart Constructor
 * Following DDD principles for the Schema Extension bounded context
 */

import type { Result } from "../../core/result.ts";

/**
 * Extension property configuration interface
 */
export interface ExtensionPropertySet {
  readonly frontmatterPart: string;
  readonly derivedFrom: string;
  readonly derivedUnique: string;
  readonly template: string;
}

/**
 * Configuration validation error types
 */
export type ConfigurationError =
  | { kind: "InvalidPropertySet"; properties: unknown }
  | { kind: "DuplicatePropertyNames"; duplicates: string[] }
  | { kind: "EmptyPropertyName"; property: string };

/**
 * Error creation helper
 */
export const createConfigurationError = (
  error: ConfigurationError,
  customMessage?: string,
): ConfigurationError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultConfigurationErrorMessage(error),
});

function getDefaultConfigurationErrorMessage(
  error: ConfigurationError,
): string {
  switch (error.kind) {
    case "InvalidPropertySet":
      return `Invalid property set provided: ${
        JSON.stringify(error.properties)
      }`;
    case "DuplicatePropertyNames":
      return `Duplicate property names found: ${error.duplicates.join(", ")}`;
    case "EmptyPropertyName":
      return `Empty property name found for: ${error.property}`;
  }
}

/**
 * Immutable configuration for extension properties
 * Implements Totality validation patterns
 */
export class ExtensionConfiguration {
  private constructor(
    private readonly properties: ExtensionPropertySet,
  ) {}

  /**
   * Smart Constructor with validation
   */
  static create(
    properties: unknown,
  ): Result<ExtensionConfiguration, ConfigurationError & { message: string }> {
    // Validate property structure
    const validationResult = validateExtensionPropertySet(properties);
    if (!validationResult.ok) {
      return {
        ok: false,
        error: createConfigurationError({
          kind: "InvalidPropertySet",
          properties,
        }),
      };
    }

    // Check for duplicate values
    const values = Object.values(validationResult.data);
    const duplicates = values.filter((value, index) =>
      values.indexOf(value) !== index
    );

    if (duplicates.length > 0) {
      return {
        ok: false,
        error: createConfigurationError({
          kind: "DuplicatePropertyNames",
          duplicates,
        }),
      };
    }

    // Check for empty property names
    for (const [key, value] of Object.entries(validationResult.data)) {
      if (!value || typeof value !== "string" || value.trim() === "") {
        return {
          ok: false,
          error: createConfigurationError({
            kind: "EmptyPropertyName",
            property: key,
          }),
        };
      }
    }

    return {
      ok: true,
      data: new ExtensionConfiguration(validationResult.data),
    };
  }

  /**
   * Create default configuration with standard x-* properties
   */
  static createDefault(): ExtensionConfiguration {
    return new ExtensionConfiguration({
      frontmatterPart: "x-frontmatter-part",
      derivedFrom: "x-derived-from",
      derivedUnique: "x-derived-unique",
      template: "x-template",
    });
  }

  /**
   * Get frontmatter part property name
   */
  getFrontmatterPartProperty(): string {
    return this.properties.frontmatterPart;
  }

  /**
   * Get derived from property name
   */
  getDerivedFromProperty(): string {
    return this.properties.derivedFrom;
  }

  /**
   * Get derived unique property name
   */
  getDerivedUniqueProperty(): string {
    return this.properties.derivedUnique;
  }

  /**
   * Get template property name
   */
  getTemplateProperty(): string {
    return this.properties.template;
  }

  /**
   * Get all properties as readonly object
   */
  getProperties(): Readonly<ExtensionPropertySet> {
    return { ...this.properties };
  }

  /**
   * Validate configuration integrity
   */
  validate(): Result<boolean, ConfigurationError> {
    // All validation is done in the constructor
    return { ok: true, data: true };
  }

  /**
   * Check if two configurations are equal
   */
  equals(other: ExtensionConfiguration): boolean {
    return (
      this.properties.frontmatterPart === other.properties.frontmatterPart &&
      this.properties.derivedFrom === other.properties.derivedFrom &&
      this.properties.derivedUnique === other.properties.derivedUnique &&
      this.properties.template === other.properties.template
    );
  }
}

/**
 * Extension Property Set validation utilities
 */
export function validateExtensionPropertySet(
  properties: unknown,
): Result<ExtensionPropertySet, ConfigurationError> {
  if (!properties || typeof properties !== "object") {
    return {
      ok: false,
      error: { kind: "InvalidPropertySet", properties },
    };
  }

  const props = properties as Record<string, unknown>;

  // Check required properties
  const required = [
    "frontmatterPart",
    "derivedFrom",
    "derivedUnique",
    "template",
  ];
  for (const key of required) {
    if (!(key in props)) {
      return {
        ok: false,
        error: { kind: "InvalidPropertySet", properties },
      };
    }
  }

  return {
    ok: true,
    data: {
      frontmatterPart: props.frontmatterPart as string,
      derivedFrom: props.derivedFrom as string,
      derivedUnique: props.derivedUnique as string,
      template: props.template as string,
    },
  };
}
