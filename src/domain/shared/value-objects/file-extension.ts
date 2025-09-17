/**
 * File Extension Value Object
 *
 * Encapsulates file extension validation and comparison logic following
 * Totality principles with smart constructor pattern.
 *
 * @module domain/shared/value-objects/file-extension
 */

import { Result } from "../types/result.ts";
import { ValidationError } from "../types/errors.ts";

/**
 * Valid file extension pattern
 * Must start with a dot and contain only alphanumeric characters
 */
const VALID_EXTENSION_PATTERN = /^\.[a-zA-Z0-9]+$/;

/**
 * FileExtension value object
 * Represents a validated file extension with type safety
 */
export class FileExtension {
  private constructor(private readonly value: string) {}

  /**
   * Smart constructor for FileExtension
   * Validates and normalizes the extension
   */
  static create(
    extension: string,
  ): Result<FileExtension, ValidationError & { message: string }> {
    // Normalize: ensure it starts with a dot
    const normalized = extension.startsWith(".")
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`;

    // Validate format
    if (!VALID_EXTENSION_PATTERN.test(normalized)) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          format: "file extension",
          value: extension,
          field: "extension",
          message:
            `Invalid file extension format: ${extension}. Must contain only alphanumeric characters.`,
        },
      };
    }

    // Validate length (reasonable limit)
    if (normalized.length > 20) {
      return {
        ok: false,
        error: {
          kind: "TooLong",
          value: extension,
          maxLength: 20,
          message:
            `File extension too long: ${extension}. Maximum 20 characters.`,
        },
      };
    }

    return {
      ok: true,
      data: new FileExtension(normalized),
    };
  }

  /**
   * Get the extension value (with dot)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Get extension without dot
   */
  getWithoutDot(): string {
    return this.value.substring(1);
  }

  /**
   * Check if this extension equals another
   */
  equals(other: FileExtension): boolean {
    return this.value === other.value;
  }

  /**
   * Check if this extension matches a string (case-insensitive)
   */
  matches(extension: string): boolean {
    const normalized = extension.startsWith(".")
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`;
    return this.value === normalized;
  }

  /**
   * String representation
   */
  toString(): string {
    return this.value;
  }

  /**
   * Create from file path
   */
  static fromPath(
    filePath: string,
  ): Result<FileExtension, ValidationError & { message: string }> {
    const lastDotIndex = filePath.lastIndexOf(".");

    if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          format: "file path",
          value: filePath,
          field: "filePath",
          message: `No file extension found in path: ${filePath}`,
        },
      };
    }

    const extension = filePath.substring(lastDotIndex);
    return FileExtension.create(extension);
  }
}
