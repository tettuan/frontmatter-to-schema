/**
 * Validated data value objects with Smart Constructors
 * Replaces unsafe type assertions with type-safe validation
 * Follows Totality principles for complete type safety
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Type guard for Record<string, unknown>
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

/**
 * Validated input data for frontmatter processing
 * Ensures data is a proper object with Smart Constructor
 */
export class ValidatedInputData {
  private constructor(readonly data: Record<string, unknown>) {}

  static create(
    input: unknown,
  ): Result<ValidatedInputData, DomainError & { message: string }> {
    if (!isRecord(input)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(input),
            expectedFormat: "object",
          },
          "Input data must be a valid object",
        ),
      };
    }

    return { ok: true, data: new ValidatedInputData(input) };
  }

  getValue(): Record<string, unknown> {
    return this.data;
  }

  hasField(fieldName: string): boolean {
    return fieldName in this.data;
  }

  getField(fieldName: string): unknown {
    return this.data[fieldName];
  }
}

/**
 * Validated JSON Schema definition
 * Ensures schema is a proper object with required validation structure
 */
export class ValidatedSchema {
  private constructor(readonly schema: Record<string, unknown>) {}

  static create(
    input: unknown,
  ): Result<ValidatedSchema, DomainError & { message: string }> {
    if (!isRecord(input)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(input),
            expectedFormat: "object",
          },
          "Schema must be a valid object",
        ),
      };
    }

    return { ok: true, data: new ValidatedSchema(input) };
  }

  getValue(): Record<string, unknown> {
    return this.schema;
  }

  getRequiredFields(): string[] {
    const required = this.schema.required;
    if (Array.isArray(required)) {
      return required.filter((field): field is string =>
        typeof field === "string"
      );
    }
    return [];
  }

  getProperties(): ValidatedSchemaProperties | null {
    const properties = this.schema.properties;
    if (isRecord(properties)) {
      const result = ValidatedSchemaProperties.create(properties);
      return result.ok ? result.data : null;
    }
    return null;
  }

  /**
   * Check if data is compatible with schema level constraints
   * Returns true if data level matches schema constraints or no constraints exist
   */
  isLevelCompatible(data: Record<string, unknown>): boolean {
    const properties = this.getProperties();
    if (!properties) return true;

    // Check for id.level constraints in nested schema
    const idPropertySchema = properties.getPropertySchema("id");
    if (!idPropertySchema) return true;

    const idProperties = idPropertySchema.getValue().properties;
    if (!isRecord(idProperties)) return true;

    const levelProperty = idProperties.level;
    if (!isRecord(levelProperty)) return true;

    const levelConstraint = levelProperty.const;
    if (typeof levelConstraint !== "string") return true;

    // Check if data has matching level
    const dataId = data.id;
    if (!isRecord(dataId)) return false;

    const dataLevel = dataId.level;
    return typeof dataLevel === "string" && dataLevel === levelConstraint;
  }
}

/**
 * Validated schema properties object
 * Ensures properties is a proper object structure
 */
export class ValidatedSchemaProperties {
  private constructor(readonly properties: Record<string, unknown>) {}

  static create(
    input: unknown,
  ): Result<ValidatedSchemaProperties, DomainError & { message: string }> {
    if (!isRecord(input)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(input),
            expectedFormat: "object",
          },
          "Schema properties must be a valid object",
        ),
      };
    }

    return { ok: true, data: new ValidatedSchemaProperties(input) };
  }

  getValue(): Record<string, unknown> {
    return this.properties;
  }

  getPropertySchema(propertyName: string): ValidatedPropertySchema | null {
    const prop = this.properties[propertyName];
    if (isRecord(prop)) {
      const result = ValidatedPropertySchema.create(prop);
      return result.ok ? result.data : null;
    }
    return null;
  }

  getPropertyNames(): string[] {
    return Object.keys(this.properties);
  }
}

/**
 * Validated individual property schema
 * Ensures individual property definition is a proper object
 */
export class ValidatedPropertySchema {
  private constructor(readonly propertySchema: Record<string, unknown>) {}

  static create(
    input: unknown,
  ): Result<ValidatedPropertySchema, DomainError & { message: string }> {
    if (!isRecord(input)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(input),
            expectedFormat: "object",
          },
          "Property schema must be a valid object",
        ),
      };
    }

    return { ok: true, data: new ValidatedPropertySchema(input) };
  }

  getValue(): Record<string, unknown> {
    return this.propertySchema;
  }

  getType(): string | null {
    const type = this.propertySchema.type;
    return typeof type === "string" ? type : null;
  }

  getConstValue(): unknown {
    return this.propertySchema.const;
  }

  hasConstConstraint(): boolean {
    return "const" in this.propertySchema;
  }
}

/**
 * Validation result with comprehensive error collection
 * Represents the complete validation state of frontmatter data
 */
export class ValidationResult {
  private constructor(
    readonly valid: boolean,
    readonly data: Record<string, unknown>,
    readonly validationErrors: string[],
  ) {}

  static createValid(
    data: ValidatedInputData,
  ): ValidationResult {
    return new ValidationResult(true, data.getValue(), []);
  }

  static createInvalid(
    data: ValidatedInputData,
    errors: string[],
  ): ValidationResult {
    return new ValidationResult(false, data.getValue(), errors);
  }

  isValid(): boolean {
    return this.valid;
  }

  getData(): Record<string, unknown> {
    return this.data;
  }

  getErrors(): string[] {
    return this.validationErrors;
  }

  hasErrors(): boolean {
    return this.validationErrors.length > 0;
  }
}
