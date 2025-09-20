import { err, ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { PropertyPath } from "../extractors/property-extractor.ts";

/**
 * Represents an x-extract-from directive that specifies how to extract
 * values from frontmatter data and where to place them in the output.
 *
 * This value object encapsulates:
 * - The source path to extract from (using PropertyPath)
 * - The target property name where the extracted value will be placed
 *
 * Follows Totality principles with Smart Constructor pattern.
 */
export class ExtractFromDirective {
  private constructor(
    private readonly sourcePath: PropertyPath,
    private readonly targetProperty: string,
  ) {}

  /**
   * Smart Constructor - Creates an ExtractFromDirective instance
   * Validates both the source path and target property
   *
   * @param pathString - The path to extract from (e.g., "user.name" or "items[].id")
   * @param targetProperty - The property name to place the extracted value
   * @returns Result containing the directive or an error
   */
  static create(
    pathString: string,
    targetProperty: string,
  ): Result<ExtractFromDirective, SchemaError> {
    // Validate source path is not empty
    if (!pathString || pathString.trim() === "") {
      return err({
        kind: "InvalidSchema" as const,
        message: "Source path for x-extract-from cannot be empty",
      });
    }

    // Create PropertyPath using its Smart Constructor
    const pathResult = PropertyPath.create(pathString);
    if (!pathResult.ok) {
      return err({
        kind: "InvalidSchema" as const,
        message: `Invalid x-extract-from path '${pathString}': ${
          pathResult.error.kind === "PropertyNotFound"
            ? pathResult.error.path
            : "Invalid path format"
        }`,
      });
    }

    // Validate target property is not empty
    if (!targetProperty || targetProperty.trim() === "") {
      return err({
        kind: "InvalidSchema" as const,
        message: "Target property for x-extract-from cannot be empty",
      });
    }

    // Validate target property format
    // Must start with letter or underscore, followed by letters, numbers, or underscores
    // Can have dots for nested properties
    const targetPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
    if (!targetPattern.test(targetProperty)) {
      return err({
        kind: "InvalidSchema" as const,
        message:
          `Invalid target property format '${targetProperty}': must be a valid property path`,
      });
    }

    return ok(new ExtractFromDirective(pathResult.data, targetProperty));
  }

  /**
   * Get the source PropertyPath for extraction
   */
  getSourcePath(): PropertyPath {
    return this.sourcePath;
  }

  /**
   * Get the raw source path string
   */
  getSourcePathString(): string {
    return this.sourcePath.toString();
  }

  /**
   * Get the target property name where extracted value will be placed
   */
  getTargetProperty(): string {
    return this.targetProperty;
  }

  /**
   * Check if this directive uses array notation ([])
   * Useful for determining if normalization is needed
   */
  hasArrayNotation(): boolean {
    return this.sourcePath.hasArrayExpansion();
  }

  /**
   * Check if the target is a nested property (contains dots)
   */
  hasNestedTarget(): boolean {
    return this.targetProperty.includes(".");
  }

  /**
   * Get the target property segments for nested properties
   */
  getTargetSegments(): string[] {
    return this.targetProperty.split(".");
  }

  /**
   * Convert to a human-readable string for debugging
   */
  toString(): string {
    return `ExtractFrom(${this.sourcePath.toString()} -> ${this.targetProperty})`;
  }

  /**
   * Convert to a JSON representation
   */
  toJSON(): { source: string; target: string; hasArrayNotation: boolean } {
    return {
      source: this.sourcePath.toString(),
      target: this.targetProperty,
      hasArrayNotation: this.hasArrayNotation(),
    };
  }

  /**
   * Check equality with another directive
   */
  equals(other: ExtractFromDirective): boolean {
    return this.sourcePath.toString() === other.sourcePath.toString() &&
      this.targetProperty === other.targetProperty;
  }
}
