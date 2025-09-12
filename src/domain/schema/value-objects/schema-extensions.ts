/**
 * Schema Extension Constants
 *
 * Centralized definition of x-* schema extension properties
 * following DDD value object patterns and Totality principles.
 * Addresses Issue #646: Hardcoding Violation
 */

import type { Result } from "../../core/result.ts";

/**
 * Schema extension property names as const for type safety
 */
export const SchemaExtensions = {
  // Template extensions
  TEMPLATE: "x-template",

  // Aggregation extensions
  DERIVED_FROM: "x-derived-from",
  DERIVED_UNIQUE: "x-derived-unique",
  DERIVED_FLATTEN: "x-derived-flatten",

  // Transform extensions
  FRONTMATTER_PART: "x-frontmatter-part",

  // Validation extensions
  SCHEMA_VERSION: "x-schema-version",
  VALIDATION: "x-validation",
  REQUIRED: "x-required",
  MIN_ITEMS: "x-min-items",
  MAX_ITEMS: "x-max-items",

  // Organizational extensions
  LEVEL: "x-level",

  // Template aggregation extensions
  TEMPLATE_AGGREGATION_OPTIONS: "x-template-aggregation-options",
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
 * Smart Constructor for Schema Extension Access following Totality principles
 */
export class SchemaExtensionAccessor {
  private constructor(
    private readonly extensions: Record<SchemaExtensionKey, unknown>,
  ) {}

  /**
   * Create a validated accessor for schema extensions
   */
  static create(
    schema: Record<string, unknown>,
  ): Result<SchemaExtensionAccessor, { kind: string; message: string }> {
    if (!schema || typeof schema !== "object") {
      return {
        ok: false,
        error: {
          kind: "InvalidSchema",
          message: "Schema must be a valid object",
        },
      };
    }

    const extensions: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (key.startsWith("x-")) {
        const validationResult = SchemaExtensionValidator.validateKey(key);
        if (validationResult.ok) {
          extensions[validationResult.data] = value;
        } else {
          // Log warning but continue (backward compatibility)
          console.warn(
            `Warning: ${validationResult.error.message}`,
          );
        }
      }
    }

    return {
      ok: true,
      data: new SchemaExtensionAccessor(
        extensions as Record<SchemaExtensionKey, unknown>,
      ),
    };
  }

  /**
   * Get template path with type safety
   */
  getTemplatePath(): Result<string, { kind: string; message: string }> {
    const value = this.extensions[SchemaExtensions.TEMPLATE];
    if (typeof value === "string") {
      return { ok: true, data: value };
    }
    return {
      ok: false,
      error: {
        kind: "InvalidTemplateValue",
        message: "Template value must be a string",
      },
    };
  }

  /**
   * Check if this is a frontmatter part with type safety
   */
  isFrontmatterPart(): boolean {
    return this.extensions[SchemaExtensions.FRONTMATTER_PART] === true;
  }

  /**
   * Get derived-from configuration with type safety
   */
  getDerivedFrom(): Result<string, { kind: string; message: string }> {
    const value = this.extensions[SchemaExtensions.DERIVED_FROM];
    if (typeof value === "string") {
      return { ok: true, data: value };
    }
    return {
      ok: false,
      error: {
        kind: "InvalidDerivedFromValue",
        message: "Derived-from value must be a string",
      },
    };
  }

  /**
   * Check if derived unique is enabled
   */
  isDerivedUnique(): boolean {
    return this.extensions[SchemaExtensions.DERIVED_UNIQUE] === true;
  }

  /**
   * Check if derived flatten is enabled
   */
  isDerivedFlatten(): boolean {
    return this.extensions[SchemaExtensions.DERIVED_FLATTEN] === true;
  }

  /**
   * Get all extensions as read-only record
   */
  getAllExtensions(): Readonly<Record<SchemaExtensionKey, unknown>> {
    return Object.freeze({ ...this.extensions });
  }
}

/**
 * Smart Constructor for Schema Extension Keys following Totality principles
 */
export class SchemaExtensionValidator {
  private constructor() {}

  /**
   * Validate and create a schema extension key
   */
  static validateKey(
    key: string,
  ): Result<SchemaExtensionKey, { kind: string; message: string }> {
    if (isSchemaExtension(key)) {
      return { ok: true, data: key };
    }
    return {
      ok: false,
      error: {
        kind: "InvalidSchemaExtension",
        message: `Invalid schema extension key: ${key}. Valid keys are: ${
          Object.values(SchemaExtensions).join(", ")
        }`,
      },
    };
  }

  /**
   * Extract all x-* extensions from a schema object with validation
   */
  static extractValidExtensions(
    schema: Record<string, unknown>,
  ): Result<
    Record<SchemaExtensionKey, unknown>,
    { kind: string; message: string }
  > {
    const extensions: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (key.startsWith("x-")) {
        const validationResult = this.validateKey(key);
        if (validationResult.ok) {
          extensions[validationResult.data] = value;
        } else {
          // Log warning but continue (backward compatibility)
          console.warn(
            `Warning: ${validationResult.error.message}`,
          );
        }
      }
    }

    return {
      ok: true,
      data: extensions as Record<SchemaExtensionKey, unknown>,
    };
  }
}

/**
 * Extract all x-* extensions from a schema object (legacy compatibility)
 */
export function extractExtensions(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const extensions: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith("x-")) {
      extensions[key] = value;
    }
  }

  return extensions;
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
