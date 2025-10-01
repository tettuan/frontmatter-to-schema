import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { DIRECTIVE_NAMES } from "../constants/directive-names.ts";

/**
 * Value object representing the x-derived-unique directive.
 * Specifies whether derived values should be unique across all processed documents.
 */
export class DerivedUniqueDirective {
  private constructor(
    private readonly unique: boolean,
  ) {}

  /**
   * Creates a DerivedUniqueDirective from a boolean value.
   */
  static create(
    value: unknown,
  ): Result<DerivedUniqueDirective, SchemaError> {
    if (typeof value !== "boolean") {
      return Result.error(
        new SchemaError(
          "x-derived-unique directive value must be a boolean",
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: DIRECTIVE_NAMES.DERIVED_UNIQUE,
            value,
            expected: "boolean",
          },
        ),
      );
    }

    return Result.ok(
      new DerivedUniqueDirective(value),
    );
  }

  /**
   * Returns whether uniqueness is required for derived values.
   */
  isUnique(): boolean {
    return this.unique;
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: DerivedUniqueDirective): boolean {
    return this.unique === other.unique;
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    return `x-derived-unique: ${this.unique}`;
  }
}
