import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { defaultSchemaExtensionRegistry } from "./schema-extension-registry.ts";

/**
 * Extensions for schema properties following JSON Schema extension pattern
 * Uses dynamic property access to avoid hardcoding extension keys
 * All extension keys should be managed through SchemaExtensionRegistry
 */
export interface SchemaExtensions {
  readonly description?: string;
  // Dynamic access for all extension properties
  // Extension keys are managed by SchemaExtensionRegistry
  readonly [key: string]: unknown;
}

/**
 * String-specific validation constraints
 */
export interface StringConstraints {
  readonly pattern?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly format?: string;
}

/**
 * Number/Integer-specific validation constraints
 */
export interface NumberConstraints {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly exclusiveMinimum?: boolean;
  readonly exclusiveMaximum?: boolean;
  readonly multipleOf?: number;
}

/**
 * Array-specific validation constraints
 */
export interface ArrayConstraints {
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly uniqueItems?: boolean;
}

/**
 * Object-specific validation constraints
 */
export interface ObjectConstraints {
  readonly minProperties?: number;
  readonly maxProperties?: number;
  readonly additionalProperties?: boolean | SchemaProperty;
}

/**
 * Reference to another schema property
 */
export interface RefSchema {
  readonly $ref: string;
}

/**
 * Collection of named schema properties
 */
export interface SchemaProperties {
  readonly [key: string]: SchemaProperty;
}

/**
 * Totality-compliant schema property using discriminated unions
 * Eliminates invalid states like optional properties that allow undefined combinations
 */
export type SchemaProperty =
  | {
    readonly kind: "string";
    readonly constraints?: StringConstraints;
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "number";
    readonly constraints?: NumberConstraints;
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "integer";
    readonly constraints?: NumberConstraints;
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "boolean";
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "array";
    readonly items: SchemaProperty | RefSchema;
    readonly constraints?: ArrayConstraints;
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "object";
    readonly properties: SchemaProperties;
    readonly required: readonly string[];
    readonly constraints?: ObjectConstraints;
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "ref";
    readonly ref: string;
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "enum";
    readonly values: readonly unknown[];
    readonly baseType?: "string" | "number" | "integer" | "boolean";
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "null";
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  }
  | {
    readonly kind: "any";
    readonly extensions?: SchemaExtensions;
    readonly default?: unknown;
  };

/**
 * Type guard to check if a schema property is a reference
 */
export function isRefSchema(
  schema: SchemaProperty | RefSchema,
): schema is RefSchema {
  return "$ref" in schema;
}

/**
 * Type guard functions for schema property kinds
 */
export const SchemaPropertyGuards = {
  isString: (
    schema: SchemaProperty,
  ): schema is SchemaProperty & { kind: "string" } => schema.kind === "string",

  isNumber: (
    schema: SchemaProperty,
  ): schema is SchemaProperty & { kind: "number" } => schema.kind === "number",

  isInteger: (
    schema: SchemaProperty,
  ): schema is SchemaProperty & { kind: "integer" } =>
    schema.kind === "integer",

  isBoolean: (
    schema: SchemaProperty,
  ): schema is SchemaProperty & { kind: "boolean" } =>
    schema.kind === "boolean",

  isArray: (
    schema: SchemaProperty,
  ): schema is SchemaProperty & { kind: "array" } => schema.kind === "array",

  isObject: (
    schema: SchemaProperty,
  ): schema is SchemaProperty & { kind: "object" } => schema.kind === "object",

  isRef: (schema: SchemaProperty): schema is SchemaProperty & { kind: "ref" } =>
    schema.kind === "ref",

  isEnum: (
    schema: SchemaProperty,
  ): schema is SchemaProperty & { kind: "enum" } => schema.kind === "enum",

  isNull: (
    schema: SchemaProperty,
  ): schema is SchemaProperty & { kind: "null" } => schema.kind === "null",

  isAny: (schema: SchemaProperty): schema is SchemaProperty & { kind: "any" } =>
    schema.kind === "any",
} as const;

/**
 * Smart constructors for creating schema properties with validation
 */
export class SchemaPropertyFactory {
  static createString(
    constraints?: StringConstraints,
    extensions?: SchemaExtensions,
    defaultValue?: unknown,
  ): SchemaProperty {
    return {
      kind: "string",
      constraints,
      extensions,
      default: defaultValue,
    };
  }

  static createNumber(
    constraints?: NumberConstraints,
    extensions?: SchemaExtensions,
    defaultValue?: unknown,
  ): SchemaProperty {
    return {
      kind: "number",
      constraints,
      extensions,
      default: defaultValue,
    };
  }

  static createInteger(
    constraints?: NumberConstraints,
    extensions?: SchemaExtensions,
    defaultValue?: unknown,
  ): SchemaProperty {
    return {
      kind: "integer",
      constraints,
      extensions,
      default: defaultValue,
    };
  }

  static createBoolean(
    extensions?: SchemaExtensions,
    defaultValue?: unknown,
  ): SchemaProperty {
    return {
      kind: "boolean",
      extensions,
      default: defaultValue,
    };
  }

  static createArray(
    items: SchemaProperty | RefSchema,
    constraints?: ArrayConstraints,
    extensions?: SchemaExtensions,
  ): SchemaProperty {
    return {
      kind: "array",
      items,
      constraints,
      extensions,
    };
  }

  static createObject(
    properties: SchemaProperties,
    required: readonly string[] = [],
    constraints?: ObjectConstraints,
    extensions?: SchemaExtensions,
  ): SchemaProperty {
    return {
      kind: "object",
      properties,
      required,
      constraints,
      extensions,
    };
  }

  static createRef(ref: string, extensions?: SchemaExtensions): SchemaProperty {
    return {
      kind: "ref",
      ref,
      extensions,
    };
  }

  static createEnum(
    values: readonly unknown[],
    baseType?: "string" | "number" | "integer" | "boolean",
    extensions?: SchemaExtensions,
  ): SchemaProperty {
    return {
      kind: "enum",
      values,
      baseType,
      extensions,
    };
  }

  static createNull(extensions?: SchemaExtensions): SchemaProperty {
    return {
      kind: "null",
      extensions,
    };
  }

  static createAny(extensions?: SchemaExtensions): SchemaProperty {
    return {
      kind: "any",
      extensions,
    };
  }
}

/**
 * Utility functions for working with schema properties
 */
export class SchemaPropertyUtils {
  /**
   * Check if schema property has x-template-items directive
   */
  static hasTemplateItems(schema: SchemaProperty): boolean {
    const key = defaultSchemaExtensionRegistry.getTemplateItemsKey().getValue();
    return schema.extensions?.[key] !== undefined;
  }

  /**
   * Get x-template-items path from schema property
   */
  static getTemplateItems(
    schema: SchemaProperty,
  ): Result<string, SchemaError & { message: string }> {
    const key = defaultSchemaExtensionRegistry.getTemplateItemsKey().getValue();
    const templateItems = schema.extensions?.[key] as string | undefined;
    if (templateItems) {
      return { ok: true, data: templateItems };
    }
    return {
      ok: false,
      error: {
        kind: "TemplateItemsNotDefined",
        message: `${key} directive not found in schema extensions`,
      },
    };
  }

  /**
   * Check if schema property has x-template-format directive
   */
  static hasTemplateFormat(schema: SchemaProperty): boolean {
    const registry = defaultSchemaExtensionRegistry;
    return schema.extensions?.[registry.getTemplateFormatKey().getValue()] !==
      undefined;
  }

  /**
   * Get x-template-format from schema property
   */
  static getTemplateFormat(
    schema: SchemaProperty,
  ): Result<
    "json" | "yaml" | "markdown",
    SchemaError & { message: string }
  > {
    const registry = defaultSchemaExtensionRegistry;
    const templateFormat = schema.extensions
      ?.[registry.getTemplateFormatKey().getValue()];
    if (templateFormat) {
      // Validate format and ensure type safety
      if (
        templateFormat === "json" || templateFormat === "yaml" ||
        templateFormat === "markdown"
      ) {
        return { ok: true, data: templateFormat };
      }
      return {
        ok: false,
        error: {
          kind: "InvalidTemplateFormat",
          message:
            `Invalid x-template-format: ${templateFormat}. Must be one of: json, yaml, markdown`,
        },
      };
    }
    return {
      ok: false,
      error: {
        kind: "TemplateFormatNotDefined",
        message: "x-template-format directive not found in schema extensions",
      },
    };
  }

  /**
   * Check if schema property has frontmatter part directive
   */
  static hasFrontmatterPart(schema: SchemaProperty): boolean {
    const key = defaultSchemaExtensionRegistry.getFrontmatterPartKey()
      .getValue();
    return schema.extensions?.[key] === true;
  }

  /**
   * Check if schema property has template directive
   */
  static hasTemplate(schema: SchemaProperty): boolean {
    const key = defaultSchemaExtensionRegistry.getTemplateKey().getValue();
    return schema.extensions?.[key] !== undefined;
  }

  /**
   * Get template path from schema property
   */
  static getTemplate(
    schema: SchemaProperty,
  ): Result<string, SchemaError & { message: string }> {
    const key = defaultSchemaExtensionRegistry.getTemplateKey().getValue();
    const template = schema.extensions?.[key] as string | undefined;
    if (template) {
      return { ok: true, data: template };
    }
    return {
      ok: false,
      error: {
        kind: "TemplateNotDefined",
        message: `${key} directive not found in schema extensions`,
      },
    };
  }

  /**
   * Check if schema property has derived-from directive
   */
  static hasDerivedFrom(schema: SchemaProperty): boolean {
    const key = defaultSchemaExtensionRegistry.getDerivedFromKey().getValue();
    return schema.extensions?.[key] !== undefined;
  }

  /**
   * Get derived-from path from schema property
   */
  static getDerivedFrom(
    schema: SchemaProperty,
  ): Result<string, SchemaError & { message: string }> {
    const key = defaultSchemaExtensionRegistry.getDerivedFromKey().getValue();
    const derivedFrom = schema.extensions?.[key] as string | undefined;
    if (derivedFrom) {
      return { ok: true, data: derivedFrom };
    }
    return {
      ok: false,
      error: {
        kind: "DerivedFromNotDefined",
        message: `${key} directive not found in schema extensions`,
      },
    };
  }

  /**
   * Check if schema property is marked as derived unique
   */
  static isDerivedUnique(schema: SchemaProperty): boolean {
    const key = defaultSchemaExtensionRegistry.getDerivedUniqueKey().getValue();
    return schema.extensions?.[key] === true;
  }

  /**
   * Check if schema property has JMESPath filter directive
   */
  static hasJMESPathFilter(schema: SchemaProperty): boolean {
    const key = defaultSchemaExtensionRegistry.getJmespathFilterKey()
      .getValue();
    return schema.extensions?.[key] !== undefined;
  }

  /**
   * Get JMESPath filter expression from schema property
   */
  static getJMESPathFilter(
    schema: SchemaProperty,
  ): Result<string, SchemaError & { message: string }> {
    const key = defaultSchemaExtensionRegistry.getJmespathFilterKey()
      .getValue();
    const jmespathFilter = schema.extensions?.[key] as string | undefined;
    if (jmespathFilter) {
      return { ok: true, data: jmespathFilter };
    }
    return {
      ok: false,
      error: {
        kind: "JMESPathFilterNotDefined",
        message: `${key} directive not found in schema extensions`,
      },
    };
  }

  /**
   * Check if schema property has extract-from directive
   */
  static hasExtractFrom(schema: SchemaProperty): boolean {
    const key = defaultSchemaExtensionRegistry.getExtractFromKey().getValue();
    return schema.extensions?.[key] !== undefined;
  }

  /**
   * Get extract-from path from schema property
   */
  static getExtractFrom(
    schema: SchemaProperty,
  ): Result<string, SchemaError & { message: string }> {
    const key = defaultSchemaExtensionRegistry.getExtractFromKey().getValue();
    const extractFrom = schema.extensions?.[key] as string | undefined;
    if (extractFrom) {
      return { ok: true, data: extractFrom };
    }
    return {
      ok: false,
      error: {
        kind: "ExtractFromNotDefined",
        message: `${key} directive not found in schema extensions`,
      },
    };
  }

  /**
   * Check if schema property has merge-arrays directive
   */
  static hasMergeArrays(schema: SchemaProperty): boolean {
    const key = defaultSchemaExtensionRegistry.getMergeArraysKey().getValue();
    return schema.extensions?.[key] !== undefined;
  }

  /**
   * Get merge-arrays configuration from schema property
   */
  static getMergeArrays(
    schema: SchemaProperty,
  ): Result<boolean, SchemaError & { message: string }> {
    const key = defaultSchemaExtensionRegistry.getMergeArraysKey().getValue();
    const mergeArrays = schema.extensions?.[key] as boolean | undefined;
    if (mergeArrays !== undefined) {
      return { ok: true, data: mergeArrays };
    }
    return {
      ok: false,
      error: {
        kind: "PropertyNotFound",
        path: key,
        message: `${key} directive not found in schema extensions`,
      },
    };
  }
}
