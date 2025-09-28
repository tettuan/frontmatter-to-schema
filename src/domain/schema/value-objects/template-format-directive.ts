import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import type { TemplateFormat } from "../../template/entities/template.ts";

/**
 * Value object representing the x-template-format directive.
 * Specifies the output format for template rendering.
 */
export class TemplateFormatDirective {
  private constructor(
    private readonly format: TemplateFormat,
  ) {}

  /**
   * Creates a TemplateFormatDirective from a format string.
   */
  static create(
    value: unknown,
  ): Result<TemplateFormatDirective, SchemaError> {
    if (typeof value !== "string") {
      return Result.error(
        new SchemaError(
          "x-template-format directive value must be a string",
          "INVALID_DIRECTIVE_VALUE",
          { directive: "x-template-format", value, expected: "string" },
        ),
      );
    }

    const validFormats: TemplateFormat[] = ["json", "yaml"];
    const trimmed = value.trim().toLowerCase();

    if (!validFormats.includes(trimmed as TemplateFormat)) {
      return Result.error(
        new SchemaError(
          `x-template-format directive value must be one of: ${
            validFormats.join(", ")
          }`,
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: "x-template-format",
            value,
            expected: `one of: ${validFormats.join(", ")}`,
          },
        ),
      );
    }

    return Result.ok(
      new TemplateFormatDirective(trimmed as TemplateFormat),
    );
  }

  /**
   * Returns the template format.
   */
  getFormat(): TemplateFormat {
    return this.format;
  }

  /**
   * Returns whether the format is JSON.
   */
  isJson(): boolean {
    return this.format === "json";
  }

  /**
   * Returns whether the format is YAML.
   */
  isYaml(): boolean {
    return this.format === "yaml";
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: TemplateFormatDirective): boolean {
    return this.format === other.format;
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    return `x-template-format: "${this.format}"`;
  }
}
