import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Extensions for schema properties following JSON Schema extension pattern
 * Incorporates x-template-items directive for explicit array item templating
 */
export interface SchemaExtensions {
  readonly "x-template"?: string;
  readonly "x-frontmatter-part"?: boolean;
  readonly "x-derived-from"?: string;
  readonly "x-derived-unique"?: boolean;
  readonly "x-template-items"?: string; // User-requested: explicit template for array items
  readonly "x-template-format"?: "json" | "yaml" | "toml" | "markdown"; // User-requested: output format specification
  readonly "x-base-property"?: boolean; // Base property marker
  readonly "x-default-value"?: unknown; // Default value for base properties
  readonly description?: string;
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
    return schema.extensions?.["x-template-items"] !== undefined;
  }

  /**
   * Get x-template-items path from schema property
   */
  static getTemplateItems(
    schema: SchemaProperty,
  ): Result<string, SchemaError & { message: string }> {
    const templateItems = schema.extensions?.["x-template-items"];
    if (templateItems) {
      return { ok: true, data: templateItems };
    }
    return {
      ok: false,
      error: {
        kind: "TemplateItemsNotDefined",
        message: "x-template-items directive not found in schema extensions",
      },
    };
  }

  /**
   * Check if schema property has x-template-format directive
   */
  static hasTemplateFormat(schema: SchemaProperty): boolean {
    return schema.extensions?.["x-template-format"] !== undefined;
  }

  /**
   * Get x-template-format from schema property
   */
  static getTemplateFormat(
    schema: SchemaProperty,
  ): Result<
    "json" | "yaml" | "toml" | "markdown",
    SchemaError & { message: string }
  > {
    const templateFormat = schema.extensions?.["x-template-format"];
    if (templateFormat) {
      // Validate format and ensure type safety
      if (
        templateFormat === "json" || templateFormat === "yaml" ||
        templateFormat === "toml" || templateFormat === "markdown"
      ) {
        return { ok: true, data: templateFormat };
      }
      return {
        ok: false,
        error: {
          kind: "InvalidTemplateFormat",
          message:
            `Invalid x-template-format: ${templateFormat}. Must be one of: json, yaml, toml, markdown`,
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
    return schema.extensions?.["x-frontmatter-part"] === true;
  }

  /**
   * Check if schema property has template directive
   */
  static hasTemplate(schema: SchemaProperty): boolean {
    return schema.extensions?.["x-template"] !== undefined;
  }

  /**
   * Get template path from schema property
   */
  static getTemplate(
    schema: SchemaProperty,
  ): Result<string, SchemaError & { message: string }> {
    const template = schema.extensions?.["x-template"];
    if (template) {
      return { ok: true, data: template };
    }
    return {
      ok: false,
      error: {
        kind: "TemplateNotDefined",
        message: "x-template directive not found in schema extensions",
      },
    };
  }

  /**
   * Check if schema property has derived-from directive
   */
  static hasDerivedFrom(schema: SchemaProperty): boolean {
    return schema.extensions?.["x-derived-from"] !== undefined;
  }

  /**
   * Get derived-from path from schema property
   */
  static getDerivedFrom(
    schema: SchemaProperty,
  ): Result<string, SchemaError & { message: string }> {
    const derivedFrom = schema.extensions?.["x-derived-from"];
    if (derivedFrom) {
      return { ok: true, data: derivedFrom };
    }
    return {
      ok: false,
      error: {
        kind: "DerivedFromNotDefined",
        message: "x-derived-from directive not found in schema extensions",
      },
    };
  }

  /**
   * Check if schema property is marked as derived unique
   */
  static isDerivedUnique(schema: SchemaProperty): boolean {
    return schema.extensions?.["x-derived-unique"] === true;
  }
}
