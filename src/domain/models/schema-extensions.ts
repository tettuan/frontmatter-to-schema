/**
 * Schema Extension Properties Support
 *
 * Handles x-* extension properties in JSON Schema for
 * frontmatter processing configuration.
 */

import type { Result } from "../core/result.ts";

/**
 * Schema extension properties interface
 */
export interface SchemaExtensions {
  "x-frontmatter-part"?: boolean;
  "x-derived-from"?: string;
  "x-derived-unique"?: boolean;
  "x-derived-flatten"?: boolean;
  "x-template"?: string;
  [key: string]: unknown; // Allow other x-* properties
}

/**
 * Extended schema with x-* properties
 */
export interface ExtendedSchema extends Record<string, unknown> {
  $schema?: string;
  type?: string;
  properties?: Record<string, ExtendedSchemaProperty>;
  items?: ExtendedSchemaProperty | ExtendedSchemaProperty[];
  "x-frontmatter-part"?: boolean;
  "x-derived-from"?: string;
  "x-derived-unique"?: boolean;
  "x-derived-flatten"?: boolean;
  "x-template"?: string;
}

/**
 * Extended schema property with x-* extensions
 */
export interface ExtendedSchemaProperty extends Record<string, unknown> {
  type?: string | string[];
  properties?: Record<string, ExtendedSchemaProperty>;
  items?: ExtendedSchemaProperty | ExtendedSchemaProperty[];
  "x-frontmatter-part"?: boolean;
  "x-derived-from"?: string;
  "x-derived-unique"?: boolean;
  "x-derived-flatten"?: boolean;
  "x-template"?: string;
}

/**
 * Template information extracted from schema
 */
export class SchemaTemplateInfo {
  private constructor(
    private readonly templatePath: string | undefined,
    private readonly isFrontmatterPart: boolean,
    private readonly derivationRules: Map<string, DerivedFieldInfo>,
  ) {}

  static extract(
    schema: ExtendedSchema,
  ): Result<SchemaTemplateInfo, { kind: string; message: string }> {
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
    
    const templatePath = schema["x-template"] as string | undefined;
    const isFrontmatterPart = schema["x-frontmatter-part"] === true;
    const derivationRules = new Map<string, DerivedFieldInfo>();

    // Extract derivation rules from properties
    if (schema.properties) {
      const extractResult = extractDerivationRules(schema.properties);
      if (!extractResult.ok) {
        return extractResult as Result<
          SchemaTemplateInfo,
          { kind: string; message: string }
        >;
      }
      for (const [key, rule] of extractResult.data) {
        derivationRules.set(key, rule);
      }
    }

    return {
      ok: true,
      data: new SchemaTemplateInfo(
        templatePath,
        isFrontmatterPart,
        derivationRules,
      ),
    };
  }

  getTemplatePath(): string | undefined {
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
 * Extract derivation rules from schema properties
 */
function extractDerivationRules(
  properties: Record<string, ExtendedSchemaProperty>,
  prefix = "",
): Result<Map<string, DerivedFieldInfo>, { kind: string; message: string }> {
  const rules = new Map<string, DerivedFieldInfo>();

  for (const [key, prop] of Object.entries(properties)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;

    // Check for x-derived-from
    if (prop["x-derived-from"]) {
      const sourceExpression = prop["x-derived-from"] as string;
      const unique = prop["x-derived-unique"] === true;
      const flatten = prop["x-derived-flatten"] === true;

      rules.set(fieldPath, {
        fieldPath,
        sourceExpression,
        unique,
        flatten,
      });
    }

    // Recursively process nested properties
    if (prop.properties) {
      const nestedResult = extractDerivationRules(prop.properties, fieldPath);
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
      const items = prop.items as ExtendedSchemaProperty;
      if (items.properties) {
        const itemsResult = extractDerivationRules(
          items.properties,
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
 * Check if a schema property marks a frontmatter part
 */
export function isFrontmatterPart(prop: ExtendedSchemaProperty): boolean {
  return prop["x-frontmatter-part"] === true;
}

/**
 * Get template path from schema or property
 */
export function getTemplatePath(
  schemaOrProp: ExtendedSchema | ExtendedSchemaProperty,
): string | undefined {
  const template = schemaOrProp["x-template"];
  return typeof template === "string" ? template : undefined;
}

/**
 * Check if a property has derivation rules
 */
export function hasDerivationRule(prop: ExtendedSchemaProperty): boolean {
  return typeof prop["x-derived-from"] === "string";
}

/**
 * Extract all x-* properties from a schema object
 */
export function extractExtensions(
  schema: Record<string, unknown>,
): SchemaExtensions {
  const extensions: SchemaExtensions = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith("x-")) {
      extensions[key] = value;
    }
  }

  return extensions;
}
