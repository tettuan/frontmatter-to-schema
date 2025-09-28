import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Value object representing the x-template-items directive.
 * Specifies template variable substitution for array items processing.
 */
export class TemplateItemsDirective {
  private constructor(
    private readonly templateVariable: string,
  ) {}

  /**
   * Creates a TemplateItemsDirective from a template variable string.
   */
  static create(
    value: unknown,
  ): Result<TemplateItemsDirective, SchemaError> {
    if (typeof value !== "string") {
      return Result.error(
        new SchemaError(
          "x-template-items directive value must be a string",
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: "x-template-items",
            value,
            expected: "string (template variable)",
          },
        ),
      );
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return Result.error(
        new SchemaError(
          "x-template-items directive template variable cannot be empty",
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: "x-template-items",
            value,
            expected: "non-empty string (template variable)",
          },
        ),
      );
    }

    return Result.ok(
      new TemplateItemsDirective(trimmed),
    );
  }

  /**
   * Returns the template variable for items processing.
   */
  getTemplateVariable(): string {
    return this.templateVariable;
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: TemplateItemsDirective): boolean {
    return this.templateVariable === other.templateVariable;
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    return `x-template-items: "${this.templateVariable}"`;
  }
}
