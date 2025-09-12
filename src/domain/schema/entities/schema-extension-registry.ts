/**
 * Schema Extension Registry - Aggregate Root
 *
 * Aggregate Root for Schema Extension Management
 * Implements Smart Constructor and Totality patterns
 * Eliminates hardcoding violations through configurable property access
 * Following DDD principles for the Schema Extension bounded context
 */

import type { Result } from "../../core/result.ts";
import type { ExtensionConfiguration } from "../value-objects/extension-configuration.ts";
import type {
  ExtensionType,
  ExtensionValue,
  ValidationError,
} from "../value-objects/extension-value.ts";
import { ExtensionValueFactory } from "../value-objects/extension-value.ts";

/**
 * Registry-specific error types
 */
export type RegistryError =
  | { kind: "ConfigurationError"; details: ValidationError }
  | { kind: "ExtensionNotFound"; extensionType: string }
  | { kind: "InvalidExtensionValue"; value: unknown; expectedType: string };

/**
 * Extraction error types
 */
export type ExtractionError =
  | {
    kind: "PropertyNotFound";
    property: string;
    schema: Record<string, unknown>;
  }
  | { kind: "InvalidValueType"; value: unknown; property: string }
  | { kind: "SchemaValidationFailed"; errors: ValidationError[] };

/**
 * Error creation helpers for consistent error handling
 */
export const createRegistryError = (
  error: RegistryError,
  customMessage?: string,
): RegistryError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultRegistryErrorMessage(error),
});

export const createExtractionError = (
  error: ExtractionError,
  customMessage?: string,
): ExtractionError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultExtractionErrorMessage(error),
});

function getDefaultRegistryErrorMessage(error: RegistryError): string {
  switch (error.kind) {
    case "ConfigurationError":
      return `Registry configuration error: ${error.details.kind}`;
    case "ExtensionNotFound":
      return `Extension not found: ${error.extensionType}`;
    case "InvalidExtensionValue":
      return `Invalid extension value: ${
        JSON.stringify(error.value)
      } for type: ${error.expectedType}`;
  }
}

function getDefaultExtractionErrorMessage(error: ExtractionError): string {
  switch (error.kind) {
    case "PropertyNotFound":
      return `Property not found: ${error.property}`;
    case "InvalidValueType":
      return `Invalid value type for property: ${error.property}`;
    case "SchemaValidationFailed":
      return `Schema validation failed: ${error.errors.length} errors`;
  }
}

/**
 * Extension key mappings derived from configuration
 */
export class ExtensionKeyMappings {
  constructor(
    public readonly frontmatterPart: string,
    public readonly derivedFrom: string,
    public readonly derivedUnique: string,
    public readonly template: string,
  ) {}

  /**
   * Create mappings from configuration
   */
  static fromConfiguration(
    config: ExtensionConfiguration,
  ): ExtensionKeyMappings {
    return new ExtensionKeyMappings(
      config.getFrontmatterPartProperty(),
      config.getDerivedFromProperty(),
      config.getDerivedUniqueProperty(),
      config.getTemplateProperty(),
    );
  }

  /**
   * Get property name by extension type
   */
  getPropertyName(extensionType: ExtensionType): string {
    switch (extensionType.getValue()) {
      case "frontmatter-part":
        return this.frontmatterPart;
      case "derived-from":
        return this.derivedFrom;
      case "derived-unique":
        return this.derivedUnique;
      case "template":
        return this.template;
      default:
        throw new Error(`Unknown extension type: ${extensionType.getValue()}`);
    }
  }
}

/**
 * Aggregate Root for Schema Extension Management
 * Implements Smart Constructor and Totality patterns
 */
export class SchemaExtensionRegistry {
  private constructor(
    private readonly configuration: ExtensionConfiguration,
    private readonly keyMappings: ExtensionKeyMappings,
  ) {}

  /**
   * Smart Constructor with validation
   */
  static create(
    config: ExtensionConfiguration,
  ): Result<SchemaExtensionRegistry, RegistryError & { message: string }> {
    // Validation logic with Result pattern
    const validationResult = config.validate();
    if (!validationResult.ok) {
      return {
        ok: false,
        error: createRegistryError({
          kind: "ConfigurationError",
          details: {
            kind: "InvalidExtensionType",
            value: "configuration_error",
          },
        }),
      };
    }

    return {
      ok: true,
      data: new SchemaExtensionRegistry(
        config,
        ExtensionKeyMappings.fromConfiguration(config),
      ),
    };
  }

  /**
   * Get extension property name without hardcoding
   */
  getFrontmatterPartProperty(): string {
    return this.keyMappings.frontmatterPart;
  }

  getDerivedFromProperty(): string {
    return this.keyMappings.derivedFrom;
  }

  getDerivedUniqueProperty(): string {
    return this.keyMappings.derivedUnique;
  }

  getTemplateProperty(): string {
    return this.keyMappings.template;
  }

  /**
   * Get property name by extension type
   */
  getPropertyName(extensionType: ExtensionType): string {
    return this.keyMappings.getPropertyName(extensionType);
  }

  /**
   * Type-safe extension value extraction
   */
  extractExtensionValue(
    schema: Record<string, unknown>,
    extensionType: ExtensionType,
  ): Result<ExtensionValue | null, ExtractionError & { message: string }> {
    const propertyName = this.keyMappings.getPropertyName(extensionType);

    if (!(propertyName in schema)) {
      // Extension not found - this is valid, return null
      return { ok: true, data: null };
    }

    const value = schema[propertyName];

    try {
      const extensionValue = ExtensionValueFactory.createFromValue(
        value,
        extensionType,
        propertyName,
      );

      return { ok: true, data: extensionValue };
    } catch (_error) {
      return {
        ok: false,
        error: createExtractionError({
          kind: "InvalidValueType",
          value,
          property: propertyName,
        }),
      };
    }
  }

  /**
   * Extract all extensions from a schema
   */
  async extractAllExtensions(
    schema: Record<string, unknown>,
  ): Promise<
    Result<
      Map<ExtensionType, ExtensionValue>,
      ExtractionError & { message: string }
    >
  > {
    const extensions = new Map<ExtensionType, ExtensionValue>();
    const errors: ExtractionError[] = [];

    // Import ExtensionType constants
    const { ExtensionType: ExtensionTypeClass } = await import(
      "../value-objects/extension-value.ts"
    );

    const allTypes = [
      ExtensionTypeClass.FRONTMATTER_PART,
      ExtensionTypeClass.DERIVED_FROM,
      ExtensionTypeClass.DERIVED_UNIQUE,
      ExtensionTypeClass.TEMPLATE,
    ];

    for (const extensionType of allTypes) {
      const extractionResult = this.extractExtensionValue(
        schema,
        extensionType,
      );

      if (!extractionResult.ok) {
        errors.push(extractionResult.error);
      } else if (extractionResult.data !== null) {
        extensions.set(extensionType, extractionResult.data);
      }
    }

    if (errors.length > 0) {
      return {
        ok: false,
        error: createExtractionError({
          kind: "SchemaValidationFailed",
          errors: [{
            kind: "InvalidExtensionType",
            value: "multiple_errors",
          }],
        }),
      };
    }

    return { ok: true, data: extensions };
  }

  /**
   * Check if schema has specific extension
   */
  hasExtension(
    schema: Record<string, unknown>,
    extensionType: ExtensionType,
  ): boolean {
    const propertyName = this.keyMappings.getPropertyName(extensionType);
    return propertyName in schema;
  }

  /**
   * Validate extension combination rules
   */
  validateExtensions(
    _extensions: Map<ExtensionType, ExtensionValue>,
  ): Result<boolean, ValidationError & { message: string }> {
    // Business rule validation can be implemented here
    // For now, return success
    return { ok: true, data: true };
  }

  /**
   * Get configuration (read-only)
   */
  getConfiguration(): ExtensionConfiguration {
    return this.configuration;
  }

  /**
   * Check if two registries are equal
   */
  equals(other: SchemaExtensionRegistry): boolean {
    return this.configuration.equals(other.configuration);
  }
}
