/**
 * Schema Extension Constants
 *
 * Centralized definition of x-* schema extension properties
 * following DDD value object patterns and Totality principles.
 * Addresses Issue #646: Hardcoding Violation
 */

/**
 * Schema extension property names as const for type safety
 */
export const SchemaExtensions = {
  // Template extensions
  TEMPLATE: "x-template",

  // Aggregation extensions
  DERIVED_FROM: "x-derived-from",
  DERIVED_UNIQUE: "x-derived-unique",

  // Transform extensions
  FRONTMATTER_PART: "x-frontmatter-part",

  // Validation extensions
  SCHEMA_VERSION: "x-schema-version",
  VALIDATION: "x-validation",
  REQUIRED: "x-required",
  MIN_ITEMS: "x-min-items",
  MAX_ITEMS: "x-max-items",
} as const;

/**
 * Type-safe schema extension keys
 */
export type SchemaExtensionKey =
  typeof SchemaExtensions[keyof typeof SchemaExtensions];

/**
 * Type guard to check if a property is a schema extension
 */
export function isSchemaExtension(
  property: string,
): property is SchemaExtensionKey {
  return Object.values(SchemaExtensions).includes(
    property as SchemaExtensionKey,
  );
}

/**
 * Extract all x-* extensions from a schema object
 */
export function extractSchemaExtensions(
  schema: Record<string, unknown>,
): Record<SchemaExtensionKey, unknown> {
  const extensions: Partial<Record<SchemaExtensionKey, unknown>> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (isSchemaExtension(key)) {
      extensions[key] = value;
    }
  }

  return extensions as Record<SchemaExtensionKey, unknown>;
}
