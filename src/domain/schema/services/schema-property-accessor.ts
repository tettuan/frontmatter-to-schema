/**
 * SchemaPropertyAccessor - Abstraction layer for accessing schema extension properties
 *
 * Eliminates hardcoding of x-* property names by centralizing access through configuration.
 * Following DDD and Totality principles with Result types.
 *
 * Addresses Issue #745: Hardcoding violations of x-* extension properties
 */

import type { SchemaExtensionConfig } from "../../config/schema-extension-config.ts";

/**
 * Provides configured access to schema extension properties
 * Replaces hardcoded strings like "x-template", "x-derived-from" etc.
 */
export class SchemaPropertyAccessor {
  constructor(private readonly config: SchemaExtensionConfig) {}

  /**
   * Get template configuration from schema
   * Replaces: schema["x-template"]
   */
  getTemplate(schema: Record<string, unknown>): string | undefined {
    const prop = this.config.getTemplateProperty();
    return schema[prop] as string | undefined;
  }

  /**
   * Get derived-from expression from schema
   * Replaces: schema["x-derived-from"]
   */
  getDerivedFrom(schema: Record<string, unknown>): string | undefined {
    const prop = this.config.getDerivedFromProperty();
    return schema[prop] as string | undefined;
  }

  /**
   * Check if derived-unique is enabled
   * Replaces: schema["x-derived-unique"]
   */
  isDerivedUnique(schema: Record<string, unknown>): boolean {
    const prop = this.config.getDerivedUniqueProperty();
    return schema[prop] === true;
  }

  /**
   * Check if schema has frontmatter-part marking
   * Replaces: schema["x-frontmatter-part"]
   */
  hasFrontmatterPart(schema: Record<string, unknown>): boolean {
    const prop = this.config.getFrontmatterPartProperty();
    return schema[prop] === true;
  }

  /**
   * Set template property on schema
   */
  setTemplate(schema: Record<string, unknown>, value: string): void {
    const prop = this.config.getTemplateProperty();
    schema[prop] = value;
  }

  /**
   * Set derived-from property on schema
   */
  setDerivedFrom(schema: Record<string, unknown>, value: string): void {
    const prop = this.config.getDerivedFromProperty();
    schema[prop] = value;
  }

  /**
   * Set derived-unique property on schema
   */
  setDerivedUnique(schema: Record<string, unknown>, value: boolean): void {
    const prop = this.config.getDerivedUniqueProperty();
    schema[prop] = value;
  }

  /**
   * Set frontmatter-part property on schema
   */
  setFrontmatterPart(schema: Record<string, unknown>, value: boolean): void {
    const prop = this.config.getFrontmatterPartProperty();
    schema[prop] = value;
  }

  /**
   * Check if a property is an extension property
   */
  isExtensionProperty(propertyName: string): boolean {
    return this.config.isExtensionProperty(propertyName);
  }

  /**
   * Get all extension property names
   */
  getAllExtensionProperties(): readonly string[] {
    return this.config.getAllProperties();
  }

  /**
   * Get derived-count expression from schema
   * Replaces: schema["x-derived-count"]
   */
  getDerivedCount(schema: Record<string, unknown>): string | undefined {
    return schema["x-derived-count"] as string | undefined;
  }

  /**
   * Get derived-average expression from schema
   * Replaces: schema["x-derived-average"]
   */
  getDerivedAverage(schema: Record<string, unknown>): string | undefined {
    return schema["x-derived-average"] as string | undefined;
  }

  /**
   * Get derived-count-where configuration from schema
   * Replaces: schema["x-derived-count-where"]
   */
  getDerivedCountWhere(schema: Record<string, unknown>): { from: string; where: string } | undefined {
    const value = schema["x-derived-count-where"];
    if (
      typeof value === "object" &&
      value !== null &&
      "from" in value &&
      "where" in value
    ) {
      return value as { from: string; where: string };
    }
    return undefined;
  }

  /**
   * Check if schema has derived-count extension
   */
  hasDerivedCount(schema: Record<string, unknown>): boolean {
    return "x-derived-count" in schema;
  }

  /**
   * Check if schema has derived-average extension
   */
  hasDerivedAverage(schema: Record<string, unknown>): boolean {
    return "x-derived-average" in schema;
  }

  /**
   * Check if schema has derived-count-where extension
   */
  hasDerivedCountWhere(schema: Record<string, unknown>): boolean {
    return "x-derived-count-where" in schema;
  }

  /**
   * Find all properties with frontmatter-part marking in nested schema
   */
  findFrontmatterParts(
    schema: Record<string, unknown>,
    path: string[] = [],
  ): Array<{ path: string[]; schema: Record<string, unknown> }> {
    const results: Array<{ path: string[]; schema: Record<string, unknown> }> =
      [];

    if (this.hasFrontmatterPart(schema)) {
      results.push({ path: [...path], schema });
    }

    // Check properties object for nested schemas
    if (schema.properties && typeof schema.properties === "object") {
      const properties = schema.properties as Record<string, unknown>;
      for (const [key, value] of Object.entries(properties)) {
        if (value && typeof value === "object") {
          const nested = this.findFrontmatterParts(
            value as Record<string, unknown>,
            [...path, key],
          );
          results.push(...nested);
        }
      }
    }

    // Check array items schema
    if (schema.items && typeof schema.items === "object") {
      const itemsSchema = schema.items as Record<string, unknown>;
      if (this.hasFrontmatterPart(itemsSchema)) {
        results.push({ path: [...path, "items"], schema: itemsSchema });
      }
      // Recursively check items properties
      if (itemsSchema.properties) {
        const nested = this.findFrontmatterParts(itemsSchema, [
          ...path,
          "items",
        ]);
        results.push(...nested);
      }
    }

    return results;
  }

  /**
   * Extract all derivation rules from schema
   */
  extractDerivationRules(
    schema: Record<string, unknown>,
    path: string[] = [],
  ): Array<{
    targetField: string;
    sourceExpression: string;
    isUnique: boolean;
  }> {
    const rules: Array<{
      targetField: string;
      sourceExpression: string;
      isUnique: boolean;
    }> = [];

    // Check current level for derivation
    const derivedFrom = this.getDerivedFrom(schema);
    if (derivedFrom) {
      rules.push({
        targetField: path.join("."),
        sourceExpression: derivedFrom,
        isUnique: this.isDerivedUnique(schema),
      });
    }

    // Recursively check properties
    if (schema.properties && typeof schema.properties === "object") {
      const properties = schema.properties as Record<string, unknown>;
      for (const [key, value] of Object.entries(properties)) {
        if (value && typeof value === "object") {
          const nested = this.extractDerivationRules(
            value as Record<string, unknown>,
            [...path, key],
          );
          rules.push(...nested);
        }
      }
    }

    return rules;
  }
}

/**
 * Factory function for creating SchemaPropertyAccessor
 */
export function createSchemaPropertyAccessor(
  config: SchemaExtensionConfig,
): SchemaPropertyAccessor {
  return new SchemaPropertyAccessor(config);
}
