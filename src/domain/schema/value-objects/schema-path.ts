import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Value object representing a schema file path.
 * Ensures the path points to a valid JSON schema file.
 */
export class SchemaPath {
  private constructor(private readonly value: string) {}

  /**
   * Creates a SchemaPath from a string path.
   * Validates that the path has a .json extension and is not empty.
   */
  static create(path: string): Result<SchemaPath, SchemaError> {
    const trimmedPath = path.trim();

    if (trimmedPath.length === 0) {
      return Result.error(
        new SchemaError("Schema path cannot be empty", "EMPTY_PATH", { path })
      );
    }

    if (!trimmedPath.endsWith(".json")) {
      return Result.error(
        new SchemaError(
          "Schema path must have .json extension",
          "INVALID_EXTENSION",
          { path }
        )
      );
    }

    return Result.ok(new SchemaPath(trimmedPath));
  }

  /**
   * Returns the string representation of the schema path.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Returns the filename including extension.
   */
  getBasename(): string {
    const lastSlashIndex = Math.max(
      this.value.lastIndexOf("/"),
      this.value.lastIndexOf("\\")
    );

    if (lastSlashIndex >= 0) {
      return this.value.substring(lastSlashIndex + 1);
    }
    return this.value;
  }

  /**
   * Returns the schema name without the .json extension.
   */
  getSchemaName(): string {
    const basename = this.getBasename();
    return basename.substring(0, basename.length - 5); // Remove ".json"
  }

  /**
   * Compares this schema path with another SchemaPath for equality.
   */
  equals(other: SchemaPath): boolean {
    return this.value === other.value;
  }

  /**
   * Returns true if this appears to be a reference schema (commonly used in $ref).
   * This is a heuristic based on common naming patterns.
   */
  isReference(): boolean {
    const schemaName = this.getSchemaName();

    // Common patterns for reference schemas
    return schemaName.includes("_command_") ||
           schemaName.includes("_item_") ||
           schemaName.includes("_ref_") ||
           (schemaName.endsWith("_schema") &&
            schemaName !== "schema" &&
            !schemaName.startsWith("registry_"));
  }
}