import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { DIRECTIVE_NAMES } from "../constants/directive-names.ts";

/**
 * Value object representing the x-flatten-arrays directive.
 * Specifies a property name whose array values should be flattened.
 */
export class FlattenArraysDirective {
  private constructor(
    private readonly propertyName: string,
  ) {}

  /**
   * Creates a FlattenArraysDirective from a property name.
   * The property name must be non-empty.
   */
  static create(
    value: unknown,
  ): Result<FlattenArraysDirective, SchemaError> {
    if (typeof value !== "string") {
      return Result.error(
        new SchemaError(
          `${DIRECTIVE_NAMES.FLATTEN_ARRAYS} directive value must be a string`,
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: DIRECTIVE_NAMES.FLATTEN_ARRAYS,
            value,
            expected: "string (property name to flatten)",
          },
        ),
      );
    }

    const trimmedName = value.trim();

    if (trimmedName.length === 0) {
      return Result.error(
        new SchemaError(
          `${DIRECTIVE_NAMES.FLATTEN_ARRAYS} directive property name cannot be empty`,
          "EMPTY_PROPERTY_NAME",
          {
            directive: DIRECTIVE_NAMES.FLATTEN_ARRAYS,
            value,
            expected: "non-empty string (property name to flatten)",
          },
        ),
      );
    }

    return Result.ok(
      new FlattenArraysDirective(trimmedName),
    );
  }

  /**
   * Returns the property name to be flattened.
   */
  getPropertyName(): string {
    return this.propertyName;
  }

  /**
   * Flattens the specified property in the given data object.
   * - If the property contains nested arrays, flattens them recursively
   * - If the property contains a single value, wraps it in an array
   * - If the property is undefined or null, returns an empty array
   */
  apply(data: Record<string, unknown>): Record<string, unknown> {
    const value = data[this.propertyName];

    if (value === undefined || value === null) {
      return {
        ...data,
        [this.propertyName]: [],
      };
    }

    if (!Array.isArray(value)) {
      return {
        ...data,
        [this.propertyName]: [value],
      };
    }

    // Flatten nested arrays recursively
    const flattened = this.flattenArray(value);
    return {
      ...data,
      [this.propertyName]: flattened,
    };
  }

  /**
   * Recursively flattens a nested array structure.
   */
  private flattenArray(arr: unknown[]): unknown[] {
    const result: unknown[] = [];

    for (const item of arr) {
      if (Array.isArray(item)) {
        result.push(...this.flattenArray(item));
      } else {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: FlattenArraysDirective): boolean {
    return this.propertyName === other.propertyName;
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    return `${DIRECTIVE_NAMES.FLATTEN_ARRAYS}: "${this.propertyName}"`;
  }
}
