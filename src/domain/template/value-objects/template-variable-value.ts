/**
 * Template Variable Value Object
 *
 * Represents a resolved template variable value with type safety and validation.
 * Implements Totality principles to ensure all variable values are properly typed and validated.
 *
 * This value object ensures that template variable values are consistently handled
 * and provides proper error context when values cannot be processed.
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";

/**
 * Supported template variable value types
 */
export type TemplateVariableValueType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "null"
  | "undefined";

/**
 * Template Variable Value - Smart Constructor Pattern
 *
 * Wraps resolved variable values with type information and validation.
 * Provides safe access to values with proper error handling.
 */
export class TemplateVariableValue {
  private constructor(
    private readonly value: unknown,
    private readonly type: TemplateVariableValueType,
    private readonly _isComplexType: boolean,
  ) {}

  /**
   * Smart Constructor for TemplateVariableValue
   * Validates and categorizes the value type
   * @param value - The resolved variable value
   * @returns Result containing TemplateVariableValue or validation error
   */
  static create(
    value: unknown,
  ): Result<TemplateVariableValue, ValidationError & { message: string }> {
    try {
      const valueType = TemplateVariableValue.determineValueType(value);
      const isComplexType = TemplateVariableValue.isComplexValueType(valueType);

      return ok(new TemplateVariableValue(value, valueType, isComplexType));
    } catch (error) {
      return err({
        kind: "UnknownError" as const,
        field: "TemplateVariableValue",
        message: `Failed to create TemplateVariableValue: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Determine the type of a value
   * @param value - The value to analyze
   * @returns The determined type
   */
  private static determineValueType(value: unknown): TemplateVariableValueType {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";

    // Fallback for any other types
    return "object";
  }

  /**
   * Check if a value type is complex (object/array)
   * @param type - The value type to check
   * @returns True if the type is complex
   */
  private static isComplexValueType(type: TemplateVariableValueType): boolean {
    return type === "object" || type === "array";
  }

  /**
   * Get the raw value
   * @returns The raw value
   */
  getValue(): unknown {
    return this.value;
  }

  /**
   * Get the value type
   * @returns The determined value type
   */
  getType(): TemplateVariableValueType {
    return this.type;
  }

  /**
   * Check if this is a complex type (object or array)
   * @returns True if complex type
   */
  isComplexType(): boolean {
    return this._isComplexType;
  }

  /**
   * Check if the value is null or undefined
   * @returns True if null or undefined
   */
  isNullOrUndefined(): boolean {
    return this.type === "null" || this.type === "undefined";
  }

  /**
   * Get value as string with safe conversion
   * @returns Result containing string representation or error
   */
  asString(): Result<string, ValidationError & { message: string }> {
    if (this.isNullOrUndefined()) {
      return err({
        kind: "MissingRequired" as const,
        field: "value",
        message: "Cannot convert null or undefined to string",
      });
    }

    try {
      if (typeof this.value === "string") {
        return ok(this.value);
      }

      if (this._isComplexType) {
        return ok(JSON.stringify(this.value));
      }

      return ok(String(this.value));
    } catch (error) {
      return err({
        kind: "UnknownError" as const,
        field: "string-conversion",
        message: `Failed to convert value to string: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Get value as number with safe conversion
   * @returns Result containing number or error
   */
  asNumber(): Result<number, ValidationError & { message: string }> {
    if (this.isNullOrUndefined()) {
      return err({
        kind: "MissingRequired" as const,
        field: "value",
        message: "Cannot convert null or undefined to number",
      });
    }

    if (typeof this.value === "number") {
      if (isNaN(this.value) || !isFinite(this.value)) {
        return err({
          kind: "InvalidType" as const,
          expected: "finite-number",
          actual: "invalid-number",
          message: `Value is not a finite number: ${this.value}`,
        });
      }
      return ok(this.value);
    }

    if (typeof this.value === "string") {
      const parsed = Number(this.value);
      if (isNaN(parsed) || !isFinite(parsed)) {
        return err({
          kind: "InvalidType" as const,
          expected: "number",
          actual: "non-numeric-string",
          message: `Cannot convert string "${this.value}" to number`,
        });
      }
      return ok(parsed);
    }

    return err({
      kind: "InvalidType" as const,
      expected: "number",
      actual: this.type,
      message: `Cannot convert ${this.type} to number`,
    });
  }

  /**
   * Get value as boolean with safe conversion
   * @returns Result containing boolean or error
   */
  asBoolean(): Result<boolean, ValidationError & { message: string }> {
    if (this.isNullOrUndefined()) {
      return err({
        kind: "MissingRequired" as const,
        field: "value",
        message: "Cannot convert null or undefined to boolean",
      });
    }

    if (typeof this.value === "boolean") {
      return ok(this.value);
    }

    if (typeof this.value === "string") {
      const lower = this.value.toLowerCase();
      if (lower === "true" || lower === "1" || lower === "yes") {
        return ok(true);
      }
      if (lower === "false" || lower === "0" || lower === "no") {
        return ok(false);
      }
      return err({
        kind: "InvalidType" as const,
        expected: "boolean",
        actual: "non-boolean-string",
        message: `Cannot convert string "${this.value}" to boolean`,
      });
    }

    if (typeof this.value === "number") {
      return ok(this.value !== 0);
    }

    return err({
      kind: "InvalidType" as const,
      expected: "boolean",
      actual: this.type,
      message: `Cannot convert ${this.type} to boolean`,
    });
  }

  /**
   * Get value as array with safe conversion
   * @returns Result containing array or error
   */
  asArray(): Result<unknown[], ValidationError & { message: string }> {
    if (this.isNullOrUndefined()) {
      return err({
        kind: "MissingRequired" as const,
        field: "value",
        message: "Cannot convert null or undefined to array",
      });
    }

    if (Array.isArray(this.value)) {
      return ok(this.value);
    }

    if (typeof this.value === "string") {
      try {
        const parsed = JSON.parse(this.value);
        if (Array.isArray(parsed)) {
          return ok(parsed);
        }
        return err({
          kind: "InvalidType" as const,
          expected: "array",
          actual: "non-array",
          message: "Parsed JSON is not an array",
        });
      } catch {
        return err({
          kind: "ParseError" as const,
          input: String(this.value),
          field: "json-array",
          message: `Cannot parse string as JSON array: "${this.value}"`,
        });
      }
    }

    return err({
      kind: "InvalidType" as const,
      expected: "array",
      actual: this.type,
      message: `Cannot convert ${this.type} to array`,
    });
  }

  /**
   * Get value as object with safe conversion
   * @returns Result containing object or error
   */
  asObject(): Result<
    Record<string, unknown>,
    ValidationError & { message: string }
  > {
    if (this.isNullOrUndefined()) {
      return err({
        kind: "MissingRequired" as const,
        field: "value",
        message: "Cannot convert null or undefined to object",
      });
    }

    if (typeof this.value === "object" && !Array.isArray(this.value)) {
      return ok(this.value as Record<string, unknown>);
    }

    if (typeof this.value === "string") {
      try {
        const parsed = JSON.parse(this.value);
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          return ok(parsed);
        }
        return err({
          kind: "InvalidType" as const,
          expected: "object",
          actual: "non-object",
          message: "Parsed JSON is not an object",
        });
      } catch {
        return err({
          kind: "ParseError" as const,
          input: String(this.value),
          field: "json-object",
          message: `Cannot parse string as JSON object: "${this.value}"`,
        });
      }
    }

    return err({
      kind: "InvalidType" as const,
      expected: "object",
      actual: this.type,
      message: `Cannot convert ${this.type} to object`,
    });
  }

  /**
   * Check if value is truthy according to template logic
   * @returns True if value should be considered truthy in templates
   */
  isTruthy(): boolean {
    if (this.isNullOrUndefined()) return false;
    if (typeof this.value === "boolean") return this.value;
    if (typeof this.value === "string") return this.value.length > 0;
    if (typeof this.value === "number") return this.value !== 0;
    if (Array.isArray(this.value)) return this.value.length > 0;
    if (typeof this.value === "object") {
      return Object.keys(this.value as Record<string, unknown>).length > 0;
    }
    return true;
  }

  /**
   * Get a safe string representation for templates
   * Returns empty string for null/undefined instead of "null"/"undefined"
   * @param verboseNulls - If true, show "null"/"undefined", otherwise empty string
   * @returns Safe string representation
   */
  toTemplateString(verboseNulls: boolean = false): string {
    if (this.isNullOrUndefined()) {
      return verboseNulls ? String(this.value) : "";
    }

    const stringResult = this.asString();
    return stringResult.ok ? stringResult.data : "";
  }

  /**
   * Equality comparison
   * @param other - Another TemplateVariableValue to compare
   * @returns True if values are equal
   */
  equals(other: TemplateVariableValue): boolean {
    if (this.type !== other.type) return false;

    if (this._isComplexType && other._isComplexType) {
      try {
        return JSON.stringify(this.value) === JSON.stringify(other.value);
      } catch {
        return false;
      }
    }

    return this.value === other.value;
  }

  /**
   * Convert to JSON representation for debugging
   * @returns JSON object representation
   */
  toJSON(): {
    value: unknown;
    type: TemplateVariableValueType;
    isComplex: boolean;
    isTruthy: boolean;
  } {
    return {
      value: this.value,
      type: this.type,
      isComplex: this._isComplexType,
      isTruthy: this.isTruthy(),
    };
  }
}
