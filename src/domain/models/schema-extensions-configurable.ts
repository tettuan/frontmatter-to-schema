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
  items?:
    | ConfigurableExtendedSchemaProperty
    | ConfigurableExtendedSchemaProperty[];
  // Extension properties are accessed dynamically via configuration
}

/**
 * Extended schema property with configurable extensions
 */
export interface ConfigurableExtendedSchemaProperty
  extends Record<string, unknown> {
  type?: string | string[];
  properties?: Record<string, ConfigurableExtendedSchemaProperty>;
  items?:
    | ConfigurableExtendedSchemaProperty
    | ConfigurableExtendedSchemaProperty[];
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
    config?: SchemaExtensionConfig,
  ): Result<ConfigurableSchemaTemplateInfo, { kind: string; message: string }> {
    // Handle default config creation
    let actualConfig: SchemaExtensionConfig;
    if (config) {
      actualConfig = config;
    } else {
      const defaultConfigResult = SchemaExtensionConfig.createDefault();
      if (!defaultConfigResult.ok) {
        return {
          ok: false,
          error: {
            kind: "ConfigError",
            message: `Failed to create default config: ${defaultConfigResult.error.message}`,
          },
        };
      }
      actualConfig = defaultConfigResult.data;
    }
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
    const templateProperty = actualConfig.getTemplateProperty();
    const frontmatterPartProperty = actualConfig.getFrontmatterPartProperty();

    const templatePath = typeof schema[templateProperty] === "string"
      ? { ok: true as const, data: schema[templateProperty] as string }
      : { ok: false as const, error: undefined };

    const isFrontmatterPart = schema[frontmatterPartProperty] === true;
    const derivationRules = new Map<string, DerivedFieldInfo>();

    // Extract derivation rules from properties
    if (schema.properties) {
      const extractResult = extractDerivationRules(schema.properties, actualConfig);
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
        actualConfig,
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
      const nestedResult = extractDerivationRules(
        prop.properties,
        config,
        fieldPath,
      );
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
  config?: SchemaExtensionConfig,
): Result<boolean, { kind: string; message: string }> {
  // Handle default config creation
  let actualConfig: SchemaExtensionConfig;
  if (config) {
    actualConfig = config;
  } else {
    const defaultConfigResult = SchemaExtensionConfig.createDefault();
    if (!defaultConfigResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ConfigError",
          message: `Failed to create default config: ${defaultConfigResult.error.message}`,
        },
      };
    }
    actualConfig = defaultConfigResult.data;
  }

  const frontmatterPartProperty = actualConfig.getFrontmatterPartProperty();
  return { ok: true, data: prop[frontmatterPartProperty] === true };
}

/**
 * Get template path from schema or property using configuration
 */
export function getConfigurableTemplatePath(
  schemaOrProp: ConfigurableExtendedSchema | ConfigurableExtendedSchemaProperty,
  config?: SchemaExtensionConfig,
): Result<string, { kind: string; message: string }> {
  // Handle default config creation
  let actualConfig: SchemaExtensionConfig;
  if (config) {
    actualConfig = config;
  } else {
    const defaultConfigResult = SchemaExtensionConfig.createDefault();
    if (!defaultConfigResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ConfigError",
          message: `Failed to create default config: ${defaultConfigResult.error.message}`,
        },
      };
    }
    actualConfig = defaultConfigResult.data;
  }

  const templateProperty = actualConfig.getTemplateProperty();
  const template = schemaOrProp[templateProperty];
  return typeof template === "string"
    ? { ok: true, data: template }
    : { ok: false, error: { kind: "TemplateNotFound", message: "No template path found" } };
}

/**
 * Check if a property has derivation rules using configuration
 */
export function hasConfigurableDerivationRule(
  prop: ConfigurableExtendedSchemaProperty,
  config?: SchemaExtensionConfig,
): Result<boolean, { kind: string; message: string }> {
  // Handle default config creation
  let actualConfig: SchemaExtensionConfig;
  if (config) {
    actualConfig = config;
  } else {
    const defaultConfigResult = SchemaExtensionConfig.createDefault();
    if (!defaultConfigResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ConfigError",
          message: `Failed to create default config: ${defaultConfigResult.error.message}`,
        },
      };
    }
    actualConfig = defaultConfigResult.data;
  }

  const derivedFromProperty = actualConfig.getDerivedFromProperty();
  return { ok: true, data: typeof prop[derivedFromProperty] === "string" };
}

/**
 * Extract all configured extension properties from a schema object
 */
export function extractConfigurableExtensions(
  schema: Record<string, unknown>,
  config?: SchemaExtensionConfig,
): Result<ConfigurableSchemaExtensions, { kind: string; message: string }> {
  // Handle default config creation
  let actualConfig: SchemaExtensionConfig;
  if (config) {
    actualConfig = config;
  } else {
    const defaultConfigResult = SchemaExtensionConfig.createDefault();
    if (!defaultConfigResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ConfigError",
          message: `Failed to create default config: ${defaultConfigResult.error.message}`,
        },
      };
    }
    actualConfig = defaultConfigResult.data;
  }

  const extensions: ConfigurableSchemaExtensions = {};
  const configuredProperties = actualConfig.getAllProperties();

  for (const [key, value] of Object.entries(schema)) {
    if (configuredProperties.includes(key)) {
      extensions[key] = value;
    }
  }

  return { ok: true, data: extensions };
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

  return legacyProperties.some((prop) => prop in schema);
}

/**
 * Migration helper: Convert legacy hardcoded properties to configurable format
 */
export function migrateLegacyProperties(
  schema: Record<string, unknown>,
  config?: SchemaExtensionConfig,
): Result<Record<string, unknown>, { kind: string; message: string }> {
  // Handle default config creation
  let actualConfig: SchemaExtensionConfig;
  if (config) {
    actualConfig = config;
  } else {
    const defaultConfigResult = SchemaExtensionConfig.createDefault();
    if (!defaultConfigResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ConfigError",
          message: `Failed to create default config: ${defaultConfigResult.error.message}`,
        },
      };
    }
    actualConfig = defaultConfigResult.data;
  }

  const migrated = { ...schema };

  // Map legacy properties to configured properties
  const propertyMigrationMap = {
    "x-template": actualConfig.getTemplateProperty(),
    "x-derived-from": actualConfig.getDerivedFromProperty(),
    "x-derived-unique": actualConfig.getDerivedUniqueProperty(),
    "x-derived-flatten": actualConfig.getDerivedFlattenProperty(),
    "x-frontmatter-part": actualConfig.getFrontmatterPartProperty(),
  };

  for (
    const [legacyProp, configuredProp] of Object.entries(propertyMigrationMap)
  ) {
    if (legacyProp in migrated) {
      migrated[configuredProp] = migrated[legacyProp];
      delete migrated[legacyProp];
    }
  }

  return { ok: true, data: migrated };
}
