import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Value object representing the x-flatten-arrays directive.
 * Manages array flattening configuration for frontmatter processing.
 */
export class FlattenArraysDirective {
  private constructor(
    private readonly targetPropertyName: string,
    private readonly sourcePropertyName: string,
    private readonly optional: boolean = false,
  ) {}

  /**
   * Creates a required FlattenArraysDirective.
   * Both target and source property names must be non-empty.
   */
  static create(
    targetProperty: string,
    sourceProperty: string,
  ): Result<FlattenArraysDirective, SchemaError> {
    const trimmedTarget = targetProperty.trim();
    const trimmedSource = sourceProperty.trim();

    if (trimmedTarget.length === 0) {
      return Result.error(
        new SchemaError(
          "Target property name cannot be empty",
          "EMPTY_TARGET_PROPERTY",
          { targetProperty },
        ),
      );
    }

    if (trimmedSource.length === 0) {
      return Result.error(
        new SchemaError(
          "Source property name cannot be empty",
          "EMPTY_SOURCE_PROPERTY",
          { sourceProperty },
        ),
      );
    }

    return Result.ok(
      new FlattenArraysDirective(trimmedTarget, trimmedSource, false),
    );
  }

  /**
   * Creates an optional FlattenArraysDirective.
   * This directive will be applied only if the source property exists.
   */
  static createOptional(
    targetProperty: string,
    sourceProperty: string,
  ): Result<FlattenArraysDirective, SchemaError> {
    return this.create(targetProperty, sourceProperty)
      .map((directive) =>
        new FlattenArraysDirective(
          directive.targetPropertyName,
          directive.sourcePropertyName,
          true,
        )
      );
  }

  /**
   * Returns the target property name where flattened data will be stored.
   */
  getTargetPropertyName(): string {
    return this.targetPropertyName;
  }

  /**
   * Returns the source property name to be flattened.
   */
  getSourcePropertyName(): string {
    return this.sourcePropertyName;
  }

  /**
   * Returns true if this directive is optional.
   */
  isOptional(): boolean {
    return this.optional;
  }

  /**
   * Returns true if this directive should be applied.
   * For required directives, always returns true.
   * For optional directives, could implement additional logic.
   */
  isApplicable(): boolean {
    return true; // Basic implementation - could be enhanced with data context
  }

  /**
   * Compares this directive with another for equality.
   */
  equals(other: FlattenArraysDirective): boolean {
    return this.targetPropertyName === other.targetPropertyName &&
      this.sourcePropertyName === other.sourcePropertyName &&
      this.optional === other.optional;
  }

  /**
   * Returns a string representation of this directive.
   */
  toString(): string {
    return `FlattenArraysDirective(target: ${this.targetPropertyName}, source: ${this.sourcePropertyName}, optional: ${this.optional})`;
  }
}
