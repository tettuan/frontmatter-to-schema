import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { DIRECTIVE_NAMES } from "../constants/directive-names.ts";

/**
 * Value object representing the x-frontmatter-part directive.
 * Specifies whether arrays in frontmatter should be processed as separate parts.
 */
export class FrontmatterPartDirective {
  private constructor(
    private readonly enabled: boolean,
  ) {}

  /**
   * Creates a FrontmatterPartDirective from a boolean value.
   */
  static create(
    value: unknown,
  ): Result<FrontmatterPartDirective, SchemaError> {
    if (typeof value !== "boolean") {
      return Result.error(
        new SchemaError(
          `${DIRECTIVE_NAMES.FRONTMATTER_PART} directive value must be a boolean`,
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: DIRECTIVE_NAMES.FRONTMATTER_PART,
            value,
            expected: "boolean",
          },
        ),
      );
    }

    return Result.ok(
      new FrontmatterPartDirective(value),
    );
  }

  /**
   * Returns whether frontmatter part processing is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: FrontmatterPartDirective): boolean {
    return this.enabled === other.enabled;
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    return `x-frontmatter-part: ${this.enabled}`;
  }
}
