/**
 * Schema Extension Properties Support
 *
 * Handles x-* extension properties in JSON Schema for
 * frontmatter processing configuration.
 */

import type { Result } from "../core/result.ts";
import { SchemaExtensionAccessor } from "../schema/value-objects/schema-extensions.ts";

/**
 * Schema extension properties interface
 */
export interface SchemaExtensions {
  "x-frontmatter-part"?: boolean;
  "x-derived-from"?: string;
  "x-derived-unique"?: boolean;
  "x-derived-flatten"?: boolean;
  "x-derived-count"?: string;
  "x-derived-count-where"?: { from: string; where: string };
  "x-derived-average"?: string;
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
  "x-derived-count"?: string;
  "x-derived-count-where"?: { from: string; where: string };
  "x-derived-average"?: string;
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
  "x-derived-count"?: string;
  "x-derived-count-where"?: { from: string; where: string };
  "x-derived-average"?: string;
  "x-template"?: string;
}

/**
 * Template information extracted from schema
 */
export class SchemaTemplateInfo {
  private constructor(
    private readonly templatePath: Result<string, void>,
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

    // Use Smart Constructor for type-safe access
    const accessorResult = SchemaExtensionAccessor.create(schema);
    if (!accessorResult.ok) {
      return {
        ok: false,
        error: accessorResult.error,
      };
    }

    const accessor = accessorResult.data;
    const templatePathResult = accessor.getTemplatePath();
    const templatePath = templatePathResult.ok
      ? { ok: true as const, data: templatePathResult.data }
      : { ok: false as const, error: undefined };
    const isFrontmatterPart = accessor.isFrontmatterPart();
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
}

/**
 * Information about a derived field
 */
export interface DerivedFieldInfo {
  fieldPath: string;
  sourceExpression: string;
  unique: boolean;
  flatten: boolean;
  operation?: "from" | "count" | "average" | "count_where"; // Add operation type
  operationSource?: string; // Source for count/average operations
  whereCondition?: string; // Condition for count_where operations
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

    // Check for x-derived-* extensions using Smart Constructor pattern
    const accessorResult = SchemaExtensionAccessor.create(prop);
    if (accessorResult.ok) {
      const accessor = accessorResult.data;

      // Check for x-derived-from
      const derivedFromResult = accessor.getDerivedFrom();
      if (derivedFromResult.ok) {
        const sourceExpression = derivedFromResult.data;
        const unique = accessor.isDerivedUnique();
        const flatten = accessor.isDerivedFlatten();

        rules.set(fieldPath, {
          fieldPath,
          sourceExpression,
          unique,
          flatten,
          operation: "from",
        });
      }

      // Check for x-derived-count
      const derivedCountResult = accessor.getDerivedCount();
      if (derivedCountResult.ok) {
        const operationSource = derivedCountResult.data;

        rules.set(fieldPath, {
          fieldPath,
          sourceExpression: `count(${operationSource})`, // Generate expression for count operation
          unique: false,
          flatten: false,
          operation: "count",
          operationSource,
        });
      }

      // Check for x-derived-average
      const derivedAverageResult = accessor.getDerivedAverage();
      if (derivedAverageResult.ok) {
        const operationSource = derivedAverageResult.data;

        rules.set(fieldPath, {
          fieldPath,
          sourceExpression: `average(${operationSource})`, // Generate expression for average operation
          unique: false,
          flatten: false,
          operation: "average",
          operationSource,
        });
      }

      // Check for x-derived-count-where
      const derivedCountWhereResult = accessor.getDerivedCountWhere();
      if (derivedCountWhereResult.ok) {
        const { from, where } = derivedCountWhereResult.data;

        rules.set(fieldPath, {
          fieldPath,
          sourceExpression: `count_where(${from}, ${where})`, // Generate expression for conditional count operation
          unique: false,
          flatten: false,
          operation: "count_where",
          operationSource: from,
          whereCondition: where, // Additional property for the condition
        });
      }
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
  const accessorResult = SchemaExtensionAccessor.create(prop);
  return accessorResult.ok ? accessorResult.data.isFrontmatterPart() : false;
}

/**
 * Get template path from schema or property
 */
export function getTemplatePath(
  schemaOrProp: ExtendedSchema | ExtendedSchemaProperty,
): Result<string, void> {
  const accessorResult = SchemaExtensionAccessor.create(schemaOrProp);
  if (accessorResult.ok) {
    const templateResult = accessorResult.data.getTemplatePath();
    return templateResult.ok
      ? { ok: true as const, data: templateResult.data }
      : { ok: false as const, error: undefined };
  }
  return { ok: false as const, error: undefined };
}

/**
 * Check if a property has derivation rules
 */
export function hasDerivationRule(prop: ExtendedSchemaProperty): boolean {
  const accessorResult = SchemaExtensionAccessor.create(prop);
  return accessorResult.ok ? accessorResult.data.getDerivedFrom().ok : false;
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
