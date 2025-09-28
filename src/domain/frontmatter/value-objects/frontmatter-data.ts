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
          { data }
        )
      );
    }

    if (typeof data !== "object") {
      return Result.error(
        new FrontmatterError(
          "Frontmatter data must be an object",
          "INVALID_DATA",
          { data, type: typeof data }
        )
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
   */
  getNestedProperty(path: string): unknown {
    const segments = path.split(".");
    let current: unknown = this.data;

    for (const segment of segments) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }

  /**
   * Gets a property as an array. Returns undefined if the property
   * is not an array or doesn't exist.
   */
  getArrayProperty(key: string): unknown[] | undefined {
    const value = this.getProperty(key);
    return Array.isArray(value) ? value : undefined;
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