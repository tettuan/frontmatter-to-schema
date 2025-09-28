import { Result } from "../../shared/types/result.ts";
import { FrontmatterError } from "../../shared/types/errors.ts";

/**
 * Value object representing frontmatter data extracted from Markdown documents.
 * Provides safe access to frontmatter properties with type checking.
 */
export class FrontmatterData {
  private constructor(private readonly data: Record<string, unknown>) {}

  /**
   * Creates FrontmatterData from a data object.
   * Validates that the data is a valid object.
   */
  static create(data: unknown): Result<FrontmatterData, FrontmatterError> {
    if (data === null || data === undefined) {
      return Result.error(
        new FrontmatterError(
          "Frontmatter data cannot be null or undefined",
          "INVALID_DATA",
          { data },
        ),
      );
    }

    if (typeof data !== "object") {
      return Result.error(
        new FrontmatterError(
          "Frontmatter data must be an object",
          "INVALID_DATA",
          { data, type: typeof data },
        ),
      );
    }

    return Result.ok(new FrontmatterData(data as Record<string, unknown>));
  }

  /**
   * Returns the raw data object.
   */
  getData(): Record<string, unknown> {
    return { ...this.data }; // Return a copy to maintain immutability
  }

  /**
   * Gets a property value by key.
   */
  getProperty(key: string): unknown {
    return this.data[key];
  }

  /**
   * Checks if a property exists (even if its value is null/undefined).
   */
  hasProperty(key: string): boolean {
    return key in this.data;
  }

  /**
   * Gets a nested property using dot notation (e.g., "metadata.title").
   * Returns Result<T,E> following the Totality principle.
   */
  getNestedProperty(path: string): Result<unknown, FrontmatterError> {
    if (!path || path.trim().length === 0) {
      return Result.error(
        new FrontmatterError(
          "Property path cannot be empty",
          "INVALID_PROPERTY_PATH",
          { path },
        ),
      );
    }

    const segments = path.split(".");
    let current: unknown = this.data;

    for (const segment of segments) {
      // Handle array indices
      if (Array.isArray(current)) {
        const index = parseInt(segment, 10);
        if (isNaN(index) || index < 0 || index >= current.length) {
          return Result.error(
            new FrontmatterError(
              `Invalid array index '${segment}' for array of length ${current.length}`,
              "INVALID_ARRAY_INDEX",
              { path, segment, arrayLength: current.length },
            ),
          );
        }
        current = current[index];
      } else if (this.isValidObject(current)) {
        current = current[segment];
      } else {
        return Result.error(
          new FrontmatterError(
            `Cannot access property '${segment}' on non-object value`,
            "INVALID_PROPERTY_ACCESS",
            { path, segment, currentType: typeof current },
          ),
        );
      }
    }

    return Result.ok(current);
  }

  /**
   * Type guard to check if a value is a valid object for property access.
   */
  private isValidObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  /**
   * Gets a property as an array. Returns Result<T,E> following the Totality principle.
   */
  getArrayProperty(key: string): Result<unknown[], FrontmatterError> {
    const value = this.getProperty(key);

    if (value === undefined) {
      return Result.error(
        new FrontmatterError(
          `Property '${key}' does not exist`,
          "PROPERTY_NOT_FOUND",
          { key },
        ),
      );
    }

    if (!Array.isArray(value)) {
      return Result.error(
        new FrontmatterError(
          `Property '${key}' is not an array`,
          "TYPE_MISMATCH",
          { key, actualType: typeof value, expectedType: "array" },
        ),
      );
    }

    return Result.ok(value);
  }

  /**
   * Merges this frontmatter data with another, with the other taking precedence
   * for conflicting properties.
   */
  merge(other: FrontmatterData): FrontmatterData {
    const mergedData = {
      ...this.data,
      ...other.data,
    };

    return new FrontmatterData(mergedData);
  }

  /**
   * Returns true if the frontmatter data is empty (no properties).
   */
  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }

  /**
   * Returns a string representation of the frontmatter data.
   */
  toString(): string {
    return `FrontmatterData(${Object.keys(this.data).length} properties)`;
  }

  /**
   * Compares this frontmatter data with another for deep equality.
   */
  equals(other: FrontmatterData): boolean {
    return JSON.stringify(this.data) === JSON.stringify(other.data);
  }
}
