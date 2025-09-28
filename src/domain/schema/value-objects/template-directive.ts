import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Value object representing the x-template directive.
 * Specifies the template file path for output generation.
 */
export class TemplateDirective {
  private constructor(
    private readonly templatePath: string,
  ) {}

  /**
   * Creates a TemplateDirective from a template path string.
   */
  static create(
    value: unknown,
  ): Result<TemplateDirective, SchemaError> {
    if (typeof value !== "string") {
      return Result.error(
        new SchemaError(
          "x-template directive value must be a string",
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: "x-template",
            value,
            expected: "string (template file path)",
          },
        ),
      );
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return Result.error(
        new SchemaError(
          "x-template directive path cannot be empty",
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: "x-template",
            value,
            expected: "non-empty string (template file path)",
          },
        ),
      );
    }

    return Result.ok(
      new TemplateDirective(trimmed),
    );
  }

  /**
   * Returns the template file path.
   */
  getTemplatePath(): string {
    return this.templatePath;
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: TemplateDirective): boolean {
    return this.templatePath === other.templatePath;
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    return `x-template: "${this.templatePath}"`;
  }
}
