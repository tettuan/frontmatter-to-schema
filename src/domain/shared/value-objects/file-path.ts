import { Result } from "../types/result.ts";
import { DomainError } from "../types/errors.ts";

/**
 * Value object representing a file path.
 * Ensures path validity and provides path manipulation utilities.
 */
export class FilePath {
  private constructor(private readonly value: string) {}

  /**
   * Creates a FilePath from a string path.
   * Validates that the path is not empty or whitespace-only.
   */
  static create(path: string): Result<FilePath, DomainError> {
    const trimmedPath = path.trim();

    if (trimmedPath.length === 0) {
      return Result.error(
        new DomainError("Path cannot be empty", "EMPTY_PATH", { path })
      );
    }

    return Result.ok(new FilePath(trimmedPath));
  }

  /**
   * Returns the string representation of the path.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Returns the file extension including the dot (e.g., ".json").
   * Returns empty string if no extension.
   */
  getExtension(): string {
    const lastDotIndex = this.value.lastIndexOf(".");
    const lastSlashIndex = Math.max(
      this.value.lastIndexOf("/"),
      this.value.lastIndexOf("\\")
    );

    if (lastDotIndex > lastSlashIndex && lastDotIndex > 0) {
      return this.value.substring(lastDotIndex);
    }
    return "";
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
   * Returns the directory path without the filename.
   */
  getDirectory(): string {
    const lastSlashIndex = Math.max(
      this.value.lastIndexOf("/"),
      this.value.lastIndexOf("\\")
    );

    if (lastSlashIndex > 0) {
      return this.value.substring(0, lastSlashIndex);
    }
    if (lastSlashIndex === 0) {
      return "/";
    }
    return ".";
  }

  /**
   * Returns true if this is an absolute path.
   */
  isAbsolute(): boolean {
    return this.value.startsWith("/") ||
           (this.value.length > 1 && this.value[1] === ":"); // Windows drive letter
  }

  /**
   * Checks if the file has the specified extension.
   */
  hasExtension(extension: string): boolean {
    return this.getExtension() === extension;
  }

  /**
   * Compares this path with another FilePath for equality.
   */
  equals(other: FilePath): boolean {
    return this.value === other.value;
  }
}