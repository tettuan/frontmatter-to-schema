/**
 * Schema Extension Properties Support (Configurable)
 *
 * Handles configurable extension properties in JSON Schema for
 * frontmatter processing configuration. Eliminates hardcoding violations.
 */

import type { Result } from "../core/result.ts";
import { SchemaExtensionConfig } from "../config/schema-extension-config.ts";

/**
 * Dynamic schema extension properties interface
 * Properties are determined by configuration instead of hardcoded
 */
export interface ConfigurableSchemaExtensions {
  [key: string]: unknown; // Allow configurable extension properties
}

/**
 * Extended schema with configurable extension properties
 */
export interface ConfigurableExtendedSchema extends Record<string, unknown> {
  $schema?: string;
  type?: string;
  properties?: Record<string, ConfigurableExtendedSchemaProperty>;
  items?: ConfigurableExtendedSchemaProperty | ConfigurableExtendedSchemaProperty[];
  // Extension properties are accessed dynamically via configuration
}

/**
 * Extended schema property with configurable extensions
 */
export interface ConfigurableExtendedSchemaProperty extends Record<string, unknown> {
  type?: string | string[];
  properties?: Record<string, ConfigurableExtendedSchemaProperty>;
  items?: ConfigurableExtendedSchemaProperty | ConfigurableExtendedSchemaProperty[];
  // Extension properties are accessed dynamically via configuration
}

/**
 * Template information extracted from schema using configuration
 */
export class ConfigurableSchemaTemplateInfo {
  private constructor(
    private readonly config: SchemaExtensionConfig,
    private readonly templatePath: Result<string, void>,
    private readonly isFrontmatterPart: boolean,
    private readonly derivationRules: Map<string, DerivedFieldInfo>,
  ) {}

  static extract(
    schema: ConfigurableExtendedSchema,
    config: SchemaExtensionConfig = SchemaExtensionConfig.createDefault(),
  ): Result<ConfigurableSchemaTemplateInfo, { kind: string; message: string }> {
    // Validate schema is an object
    if (!schema || typeof schema !== "object") {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          message: "Schema must be an object",
        },
      };
    }

    // Use configuration to get property names
    const templateProperty = config.getTemplateProperty();
    const frontmatterPartProperty = config.getFrontmatterPartProperty();

    const templatePath = typeof schema[templateProperty] === "string"
      ? { ok: true as const, data: schema[templateProperty] as string }
      : { ok: false as const, error: undefined };
      
    const isFrontmatterPart = schema[frontmatterPartProperty] === true;
    const derivationRules = new Map<string, DerivedFieldInfo>();

    // Extract derivation rules from properties
    if (schema.properties) {
      const extractResult = extractDerivationRules(schema.properties, config);
      if (!extractResult.ok) {
        return extractResult as Result<
          ConfigurableSchemaTemplateInfo,
          { kind: string; message: string }
        >;
      }
      for (const [key, rule] of extractResult.data) {
        derivationRules.set(key, rule);
      }
    }

    return {
      ok: true,
      data: new ConfigurableSchemaTemplateInfo(
        config,
        templatePath,
        isFrontmatterPart,
        derivationRules,
      ),
    };
  }

  getTemplatePath(): Result<string, void> {
    return this.templatePath;
  }

  getIsFrontmatterPart(): boolean {
    return this.isFrontmatterPart;
  }

  getDerivationRules(): Map<string, DerivedFieldInfo> {
    return new Map(this.derivationRules);
  }

  hasDerivationRules(): boolean {
    return this.derivationRules.size > 0;
  }

  getConfig(): SchemaExtensionConfig {
    return this.config;
  }
}

/**
 * Information about a derived field
 */
export interface DerivedFieldInfo {
  fieldPath: string;
  sourceExpression: string;
  unique: boolean;
  flatten: boolean;
}

/**
 * Extract derivation rules from schema properties using configuration
 */
function extractDerivationRules(
  properties: Record<string, ConfigurableExtendedSchemaProperty>,
  config: SchemaExtensionConfig,
  prefix = "",
): Result<Map<string, DerivedFieldInfo>, { kind: string; message: string }> {
  const rules = new Map<string, DerivedFieldInfo>();

  // Get property names from configuration
  const derivedFromProperty = config.getDerivedFromProperty();
  const derivedUniqueProperty = config.getDerivedUniqueProperty();
  const derivedFlattenProperty = config.getDerivedFlattenProperty();

  for (const [key, prop] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    // Check for configured derived-from property
    if (prop[derivedFromProperty]) {
      const sourceExpression = prop[derivedFromProperty] as string;
      const unique = prop[derivedUniqueProperty] === true;
      const flatten = prop[derivedFlattenProperty] === true;

      rules.set(fieldPath, {
        fieldPath,
        sourceExpression,
        unique,
        flatten,
      });
    }

    // Recursively process nested properties
    if (prop.properties) {
      const nestedResult = extractDerivationRules(prop.properties, config, fieldPath);
      if (!nestedResult.ok) {
        return nestedResult;
      }
      for (const [nestedKey, nestedRule] of nestedResult.data) {
        rules.set(nestedKey, nestedRule);
      }
    }

    // Process array items
    if (
      prop.items && typeof prop.items === "object" && !Array.isArray(prop.items)
    ) {
      const items = prop.items as ConfigurableExtendedSchemaProperty;
      if (items.properties) {
        const itemsResult = extractDerivationRules(
          items.properties,
          config,
          `${fieldPath}[]`,
        );
        if (!itemsResult.ok) {
          return itemsResult;
        }
        for (const [itemKey, itemRule] of itemsResult.data) {
          rules.set(itemKey, itemRule);
        }
      }
    }
  }

  return { ok: true, data: rules };
}

/**
 * Check if a schema property marks a frontmatter part using configuration
 */
export function isConfigurableFrontmatterPart(
  prop: ConfigurableExtendedSchemaProperty,
  config: SchemaExtensionConfig = SchemaExtensionConfig.createDefault(),
): boolean {
  const frontmatterPartProperty = config.getFrontmatterPartProperty();
  return prop[frontmatterPartProperty] === true;
}

/**
 * Get template path from schema or property using configuration
 */
export function getConfigurableTemplatePath(
  schemaOrProp: ConfigurableExtendedSchema | ConfigurableExtendedSchemaProperty,
  config: SchemaExtensionConfig = SchemaExtensionConfig.createDefault(),
): Result<string, void> {
  const templateProperty = config.getTemplateProperty();
  const template = schemaOrProp[templateProperty];
  return typeof template === "string"
    ? { ok: true as const, data: template }
    : { ok: false as const, error: undefined };
}

/**
 * Check if a property has derivation rules using configuration
 */
export function hasConfigurableDerivationRule(
  prop: ConfigurableExtendedSchemaProperty,
  config: SchemaExtensionConfig = SchemaExtensionConfig.createDefault(),
): boolean {
  const derivedFromProperty = config.getDerivedFromProperty();
  return typeof prop[derivedFromProperty] === "string";
}

/**
 * Extract all configured extension properties from a schema object
 */
export function extractConfigurableExtensions(
  schema: Record<string, unknown>,
  config: SchemaExtensionConfig = SchemaExtensionConfig.createDefault(),
): ConfigurableSchemaExtensions {
  const extensions: ConfigurableSchemaExtensions = {};
  const configuredProperties = config.getAllProperties();

  for (const [key, value] of Object.entries(schema)) {
    if (configuredProperties.includes(key)) {
      extensions[key] = value;
    }
  }

  return extensions;
}

/**
 * Migration helper: Check if an object uses legacy hardcoded properties
 */
export function hasLegacyHardcodedProperties(
  schema: Record<string, unknown>,
): boolean {
  const legacyProperties = [
    "x-template",
    "x-derived-from", 
    "x-derived-unique",
    "x-derived-flatten",
    "x-frontmatter-part",
  ];
  
  return legacyProperties.some(prop => prop in schema);
}

/**
 * Migration helper: Convert legacy hardcoded properties to configurable format
 */
export function migrateLegacyProperties(
  schema: Record<string, unknown>,
  config: SchemaExtensionConfig = SchemaExtensionConfig.createDefault(),
): Record<string, unknown> {
  const migrated = { ...schema };
  
  // Map legacy properties to configured properties
  const propertyMigrationMap = {
    "x-template": config.getTemplateProperty(),
    "x-derived-from": config.getDerivedFromProperty(),
    "x-derived-unique": config.getDerivedUniqueProperty(),
    "x-derived-flatten": config.getDerivedFlattenProperty(),
    "x-frontmatter-part": config.getFrontmatterPartProperty(),
  };

  for (const [legacyProp, configuredProp] of Object.entries(propertyMigrationMap)) {
    if (legacyProp in migrated) {
      migrated[configuredProp] = migrated[legacyProp];
      delete migrated[legacyProp];
    }
  }

  return migrated;
}