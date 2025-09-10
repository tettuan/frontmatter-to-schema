/**
 * SchemaPath Value Object
 *
 * Represents a validated path to a schema file
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * SchemaPath value object with validation
 * Ensures path is valid and points to a schema file
 */
export class SchemaPath {
  private constructor(private readonly value: string) {}

  /**
   * Smart Constructor for SchemaPath
   * Validates path format and extension
   */
  static create(
    path: string,
  ): Result<SchemaPath, DomainError & { message: string }> {
    // Check for empty string
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Schema path cannot be empty",
        ),
      };
    }

    const trimmedPath = path.trim();

    // Check for valid path format (basic validation)
    if (trimmedPath.includes("\0") || trimmedPath.includes("..")) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: trimmedPath,
            expectedFormat: "valid file path",
          },
          "Schema path contains invalid characters",
        ),
      };
    }

    // Check for schema file extension
    const validExtensions = [".json", ".yaml", ".yml"];
    const hasValidExtension = validExtensions.some((ext) =>
      trimmedPath.toLowerCase().endsWith(ext)
    );

    if (!hasValidExtension) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: trimmedPath,
            expectedFormat: "*.json, *.yaml, or *.yml",
          },
          `Schema path must end with one of: ${validExtensions.join(", ")}`,
        ),
      };
    }

    // Check path length
    if (trimmedPath.length > 1024) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "TooLong",
            value: trimmedPath,
            maxLength: 1024,
          },
          "Schema path exceeds maximum length of 1024 characters",
        ),
      };
    }

    return { ok: true, data: new SchemaPath(trimmedPath) };
  }

  /**
   * Get the validated path value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Get the file extension
   */
  getExtension(): string {
    const lastDot = this.value.lastIndexOf(".");
    return lastDot !== -1 ? this.value.slice(lastDot) : "";
  }

  /**
   * Get the filename without path
   */
  getFilename(): string {
    const lastSlash = Math.max(
      this.value.lastIndexOf("/"),
      this.value.lastIndexOf("\\"),
    );
    return lastSlash !== -1 ? this.value.slice(lastSlash + 1) : this.value;
  }

  /**
   * Check if path is absolute
   */
  isAbsolute(): boolean {
    return this.value.startsWith("/") ||
      this.value.includes(":\\") || // Windows absolute path
      this.value.startsWith("\\");
  }

  /**
   * Create a relative path from this path
   */
  makeRelative(
    basePath: string,
  ): Result<SchemaPath, DomainError & { message: string }> {
    if (!this.value.startsWith(basePath)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: this.value,
            expectedFormat: `path starting with ${basePath}`,
          },
          `Cannot make relative path: ${this.value} does not start with ${basePath}`,
        ),
      };
    }

    const relativePath = this.value.slice(basePath.length);
    const cleanPath =
      relativePath.startsWith("/") || relativePath.startsWith("\\")
        ? relativePath.slice(1)
        : relativePath;

    return SchemaPath.create(cleanPath);
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `SchemaPath(${this.value})`;
  }
}
