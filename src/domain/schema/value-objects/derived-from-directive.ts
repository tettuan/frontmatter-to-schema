import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Value object representing the x-derived-from directive.
 * Specifies JMESPath expressions used to derive field values from other fields.
 */
export class DerivedFromDirective {
  private constructor(
    private readonly expressions: string[],
  ) {}

  /**
   * Creates a DerivedFromDirective from a string or array of strings.
   */
  static create(
    value: unknown,
  ): Result<DerivedFromDirective, SchemaError> {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return Result.error(
          new SchemaError(
            "x-derived-from directive expression cannot be empty",
            "INVALID_DIRECTIVE_VALUE",
            {
              directive: "x-derived-from",
              value,
              expected: "non-empty string",
            },
          ),
        );
      }
      return Result.ok(new DerivedFromDirective([trimmed]));
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return Result.error(
          new SchemaError(
            "x-derived-from directive array cannot be empty",
            "INVALID_DIRECTIVE_VALUE",
            {
              directive: "x-derived-from",
              value,
              expected: "non-empty array of strings",
            },
          ),
        );
      }

      const expressions: string[] = [];
      for (const item of value) {
        if (typeof item !== "string") {
          return Result.error(
            new SchemaError(
              "All x-derived-from directive array items must be strings",
              "INVALID_DIRECTIVE_VALUE",
              { directive: "x-derived-from", value: item, expected: "string" },
            ),
          );
        }

        const trimmed = item.trim();
        if (trimmed.length === 0) {
          return Result.error(
            new SchemaError(
              "x-derived-from directive expressions cannot be empty",
              "INVALID_DIRECTIVE_VALUE",
              {
                directive: "x-derived-from",
                value: item,
                expected: "non-empty string",
              },
            ),
          );
        }

        expressions.push(trimmed);
      }

      return Result.ok(new DerivedFromDirective(expressions));
    }

    return Result.error(
      new SchemaError(
        "x-derived-from directive must be a string or array of strings",
        "INVALID_DIRECTIVE_VALUE",
        {
          directive: "x-derived-from",
          value,
          expected: "string or array of strings",
        },
      ),
    );
  }

  /**
   * Returns the JMESPath expressions.
   */
  getExpressions(): string[] {
    return [...this.expressions];
  }

  /**
   * Returns the first expression (for backwards compatibility).
   */
  getPrimaryExpression(): string {
    return this.expressions[0];
  }

  /**
   * Returns whether this directive has multiple expressions.
   */
  hasMultipleExpressions(): boolean {
    return this.expressions.length > 1;
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: DerivedFromDirective): boolean {
    return this.expressions.length === other.expressions.length &&
      this.expressions.every((expr, index) =>
        expr === other.expressions[index]
      );
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    if (this.expressions.length === 1) {
      return `x-derived-from: "${this.expressions[0]}"`;
    }
    return `x-derived-from: [${
      this.expressions.map((e) => `"${e}"`).join(", ")
    }]`;
  }
}
