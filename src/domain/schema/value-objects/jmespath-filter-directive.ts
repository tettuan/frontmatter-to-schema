import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Value object representing the x-jmespath-filter directive.
 * Specifies a JMESPath expression for filtering aggregated data.
 */
export class JmesPathFilterDirective {
  private constructor(
    private readonly expression: string,
  ) {}

  /**
   * Creates a JmesPathFilterDirective from a JMESPath expression string.
   */
  static create(
    value: unknown,
  ): Result<JmesPathFilterDirective, SchemaError> {
    if (typeof value !== "string") {
      return Result.error(
        new SchemaError(
          "x-jmespath-filter directive value must be a string",
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: "x-jmespath-filter",
            value,
            expected: "string (JMESPath expression)",
          },
        ),
      );
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return Result.error(
        new SchemaError(
          "x-jmespath-filter directive expression cannot be empty",
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: "x-jmespath-filter",
            value,
            expected: "non-empty string (JMESPath expression)",
          },
        ),
      );
    }

    return Result.ok(
      new JmesPathFilterDirective(trimmed),
    );
  }

  /**
   * Returns the JMESPath filter expression.
   */
  getExpression(): string {
    return this.expression;
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: JmesPathFilterDirective): boolean {
    return this.expression === other.expression;
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    return `x-jmespath-filter: "${this.expression}"`;
  }
}
