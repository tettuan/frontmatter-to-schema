/**
 * Extension Value Discriminated Union Types
 *
 * Type-safe representation of extension values
 * Implements Discriminated Union pattern for Totality compliance
 * Following DDD principles for the Schema Extension bounded context
 */

/**
 * Extension type enumeration
 */
export type ExtensionTypeValue =
  | "frontmatter-part"
  | "derived-from"
  | "derived-unique"
  | "derived-count"
  | "derived-average"
  | "derived-count-where"
  | "template";

/**
 * Extension metadata for traceability
 */
export interface ExtensionMetadata {
  readonly extensionType: ExtensionTypeValue;
  readonly sourceProperty: string;
  readonly validationRules?: ValidationRule[];
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  readonly name: string;
  readonly constraint: string;
  readonly message?: string;
}

/**
 * Type-safe representation of extension values
 * Implements Discriminated Union pattern for Totality
 */
export type ExtensionValue =
  | BooleanExtensionValue
  | StringExtensionValue
  | ObjectExtensionValue
  | ArrayExtensionValue;

/**
 * Boolean-based extension (e.g., x-frontmatter-part: true)
 */
export interface BooleanExtensionValue {
  readonly kind: "BooleanExtension";
  readonly enabled: boolean;
  readonly metadata?: ExtensionMetadata;
}

/**
 * String-based extension (e.g., x-derived-from: "authors")
 */
export interface StringExtensionValue {
  readonly kind: "StringExtension";
  readonly value: string;
  readonly metadata?: ExtensionMetadata;
}

/**
 * Object-based extension (e.g., x-template: { "article": "template.json" })
 */
export interface ObjectExtensionValue {
  readonly kind: "ObjectExtension";
  readonly configuration: Record<string, unknown>;
  readonly metadata?: ExtensionMetadata;
}

/**
 * Array-based extension (e.g., x-derived-unique: ["id", "slug"])
 */
export interface ArrayExtensionValue {
  readonly kind: "ArrayExtension";
  readonly items: unknown[];
  readonly metadata?: ExtensionMetadata;
}

/**
 * Type-safe extension type enumeration with Smart Constructor
 */
export class ExtensionType {
  private constructor(
    private readonly value: ExtensionTypeValue,
  ) {}

  static readonly FRONTMATTER_PART: ExtensionType = new ExtensionType(
    "frontmatter-part",
  );
  static readonly DERIVED_FROM: ExtensionType = new ExtensionType(
    "derived-from",
  );
  static readonly DERIVED_UNIQUE: ExtensionType = new ExtensionType(
    "derived-unique",
  );
  static readonly DERIVED_COUNT: ExtensionType = new ExtensionType(
    "derived-count",
  );
  static readonly DERIVED_AVERAGE: ExtensionType = new ExtensionType(
    "derived-average",
  );
  static readonly DERIVED_COUNT_WHERE: ExtensionType = new ExtensionType(
    "derived-count-where",
  );
  static readonly TEMPLATE: ExtensionType = new ExtensionType("template");

  /**
   * Smart Constructor with validation
   */
  static create(
    value: string,
  ): Result<ExtensionType, ValidationError & { message: string }> {
    if (!ExtensionType.isValidExtensionType(value)) {
      return {
        ok: false,
        error: createValidationError({
          kind: "InvalidExtensionType",
          value,
        }),
      };
    }

    return {
      ok: true,
      data: new ExtensionType(value as ExtensionTypeValue),
    };
  }

  private static isValidExtensionType(
    value: string,
  ): value is ExtensionTypeValue {
    return [
      "frontmatter-part",
      "derived-from",
      "derived-unique",
      "derived-count",
      "derived-average",
      "derived-count-where",
      "template",
    ]
      .includes(value);
  }

  getValue(): ExtensionTypeValue {
    return this.value;
  }

  equals(other: ExtensionType): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Validation error types
 */
export type ValidationError =
  | { kind: "InvalidExtensionType"; value: string }
  | { kind: "MissingRequiredProperty"; property: string }
  | { kind: "InvalidValueFormat"; value: unknown; format: string };

/**
 * Error creation helper
 */
export const createValidationError = (
  error: ValidationError,
  customMessage?: string,
): ValidationError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultValidationErrorMessage(error),
});

function getDefaultValidationErrorMessage(error: ValidationError): string {
  switch (error.kind) {
    case "InvalidExtensionType":
      return `Invalid extension type: ${error.value}. Valid types are: frontmatter-part, derived-from, derived-unique, derived-count, derived-average, derived-count-where, template`;
    case "MissingRequiredProperty":
      return `Missing required property: ${error.property}`;
    case "InvalidValueFormat":
      return `Invalid value format: ${
        JSON.stringify(error.value)
      } for format: ${error.format}`;
  }
}

/**
 * Extension value factory with type safety
 */
export class ExtensionValueFactory {
  /**
   * Create boolean extension value
   */
  static createBoolean(
    enabled: boolean,
    metadata?: ExtensionMetadata,
  ): BooleanExtensionValue {
    return {
      kind: "BooleanExtension",
      enabled,
      metadata,
    };
  }

  /**
   * Create string extension value
   */
  static createString(
    value: string,
    metadata?: ExtensionMetadata,
  ): StringExtensionValue {
    return {
      kind: "StringExtension",
      value,
      metadata,
    };
  }

  /**
   * Create object extension value
   */
  static createObject(
    configuration: Record<string, unknown>,
    metadata?: ExtensionMetadata,
  ): ObjectExtensionValue {
    return {
      kind: "ObjectExtension",
      configuration,
      metadata,
    };
  }

  /**
   * Create array extension value
   */
  static createArray(
    items: unknown[],
    metadata?: ExtensionMetadata,
  ): ArrayExtensionValue {
    return {
      kind: "ArrayExtension",
      items,
      metadata,
    };
  }

  /**
   * Create extension value from unknown input with type inference
   */
  static createFromValue(
    value: unknown,
    extensionType: ExtensionType,
    sourceProperty: string,
  ): ExtensionValue {
    const metadata: ExtensionMetadata = {
      extensionType: extensionType.getValue(),
      sourceProperty,
    };

    if (typeof value === "boolean") {
      return this.createBoolean(value, metadata);
    }

    if (typeof value === "string") {
      return this.createString(value, metadata);
    }

    if (Array.isArray(value)) {
      return this.createArray(value, metadata);
    }

    if (value && typeof value === "object") {
      return this.createObject(value as Record<string, unknown>, metadata);
    }

    // Fallback to string representation
    return this.createString(String(value), metadata);
  }
}

/**
 * Type guards for extension values
 */
export function isBooleanExtension(
  value: ExtensionValue,
): value is BooleanExtensionValue {
  return value.kind === "BooleanExtension";
}

export function isStringExtension(
  value: ExtensionValue,
): value is StringExtensionValue {
  return value.kind === "StringExtension";
}

export function isObjectExtension(
  value: ExtensionValue,
): value is ObjectExtensionValue {
  return value.kind === "ObjectExtension";
}

export function isArrayExtension(
  value: ExtensionValue,
): value is ArrayExtensionValue {
  return value.kind === "ArrayExtension";
}

// Import Result type at the top to avoid circular dependency
import type { Result } from "../../core/result.ts";
