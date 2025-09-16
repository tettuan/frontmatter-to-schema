import { defaultSchemaExtensionRegistry } from "../../src/domain/schema/value-objects/schema-extension-registry.ts";

/**
 * Test constants for schema extension keys.
 * Uses the SchemaExtensionRegistry to avoid hardcoding.
 *
 * This module provides a centralized location for test extension keys,
 * ensuring consistency between tests and production code.
 */
export const TEST_EXTENSIONS = {
  FRONTMATTER_PART: defaultSchemaExtensionRegistry.getFrontmatterPartKey()
    .getValue(),
  TEMPLATE: defaultSchemaExtensionRegistry.getTemplateKey().getValue(),
  TEMPLATE_ITEMS: defaultSchemaExtensionRegistry.getTemplateItemsKey()
    .getValue(),
  DERIVED_FROM: defaultSchemaExtensionRegistry.getDerivedFromKey().getValue(),
  DERIVED_UNIQUE: defaultSchemaExtensionRegistry.getDerivedUniqueKey()
    .getValue(),
  JMESPATH_FILTER: defaultSchemaExtensionRegistry.getJmespathFilterKey()
    .getValue(),
  TEMPLATE_FORMAT: defaultSchemaExtensionRegistry.getTemplateFormatKey()
    .getValue(),
  BASE_PROPERTY: defaultSchemaExtensionRegistry.getBasePropertyKey().getValue(),
  DEFAULT_VALUE: defaultSchemaExtensionRegistry.getDefaultValueKey().getValue(),
} as const;

/**
 * Type-safe extension key type
 */
export type TestExtensionKey = keyof typeof TEST_EXTENSIONS;

/**
 * Helper function to get extension value with type safety
 */
export function getExtensionKey(key: TestExtensionKey): string {
  return TEST_EXTENSIONS[key];
}

/**
 * Helper to create an extensions object with type safety
 */
export function createExtensions(extensions: {
  frontmatterPart?: boolean;
  template?: string;
  templateItems?: string;
  derivedFrom?: string;
  derivedUnique?: boolean;
  jmespathFilter?: string;
  templateFormat?: "json" | "yaml" | "markdown";
  baseProperty?: boolean;
  defaultValue?: unknown;
  description?: string;
}): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (extensions.frontmatterPart !== undefined) {
    result[TEST_EXTENSIONS.FRONTMATTER_PART] = extensions.frontmatterPart;
  }
  if (extensions.template !== undefined) {
    result[TEST_EXTENSIONS.TEMPLATE] = extensions.template;
  }
  if (extensions.templateItems !== undefined) {
    result[TEST_EXTENSIONS.TEMPLATE_ITEMS] = extensions.templateItems;
  }
  if (extensions.derivedFrom !== undefined) {
    result[TEST_EXTENSIONS.DERIVED_FROM] = extensions.derivedFrom;
  }
  if (extensions.derivedUnique !== undefined) {
    result[TEST_EXTENSIONS.DERIVED_UNIQUE] = extensions.derivedUnique;
  }
  if (extensions.jmespathFilter !== undefined) {
    result[TEST_EXTENSIONS.JMESPATH_FILTER] = extensions.jmespathFilter;
  }
  if (extensions.templateFormat !== undefined) {
    result[TEST_EXTENSIONS.TEMPLATE_FORMAT] = extensions.templateFormat;
  }
  if (extensions.baseProperty !== undefined) {
    result[TEST_EXTENSIONS.BASE_PROPERTY] = extensions.baseProperty;
  }
  if (extensions.defaultValue !== undefined) {
    result[TEST_EXTENSIONS.DEFAULT_VALUE] = extensions.defaultValue;
  }
  if (extensions.description !== undefined) {
    result.description = extensions.description;
  }

  return result;
}
