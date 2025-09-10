/**
 * DocumentPath Value Object
 *
 * Represents a validated path to a document file
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * Supported document extensions
 */
const SUPPORTED_EXTENSIONS = [".md", ".mdx", ".markdown", ".txt"] as const;
export type DocumentExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/**
 * DocumentPath value object with validation
 * Ensures path is valid and points to a supported document file
 */
export class DocumentPath {
  private constructor(
    private readonly value: string,
    private readonly extension: DocumentExtension,
  ) {}

  /**
   * Smart Constructor for DocumentPath
   * Validates path format and extension
   */
  static create(
    path: string,
  ): Result<DocumentPath, DomainError & { message: string }> {
    // Check for empty string
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Document path cannot be empty",
        ),
      };
    }

    const trimmedPath = path.trim();

    // Check for invalid characters
    if (trimmedPath.includes("\0")) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: trimmedPath,
            expectedFormat: "valid file path without null bytes",
          },
          "Document path contains invalid characters",
        ),
      };
    }

    // Check for directory traversal attempts
    if (trimmedPath.includes("../") || trimmedPath.includes("..\\")) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: trimmedPath,
            expectedFormat: "path without directory traversal",
          },
          "Document path contains directory traversal patterns",
        ),
      };
    }

    // Check for valid extension
    const lowerPath = trimmedPath.toLowerCase();
    const extension = SUPPORTED_EXTENSIONS.find((ext) =>
      lowerPath.endsWith(ext)
    );

    if (!extension) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "FileExtensionMismatch",
            path: trimmedPath,
            expected: [...SUPPORTED_EXTENSIONS],
          },
          `Document must have one of these extensions: ${
            SUPPORTED_EXTENSIONS.join(", ")
          }`,
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
          "Document path exceeds maximum length of 1024 characters",
        ),
      };
    }

    // Check for valid filename (not just extension)
    const filename = DocumentPath.extractFilename(trimmedPath);
    const nameWithoutExt = filename.slice(0, -extension.length);
    if (nameWithoutExt.length === 0) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: trimmedPath,
            expectedFormat: "filename with content before extension",
          },
          "Document filename cannot be just an extension",
        ),
      };
    }

    return {
      ok: true,
      data: new DocumentPath(trimmedPath, extension as DocumentExtension),
    };
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
  getExtension(): DocumentExtension {
    return this.extension;
  }

  /**
   * Get the filename without path
   */
  getFilename(): string {
    return DocumentPath.extractFilename(this.value);
  }

  /**
   * Get filename without extension
   */
  getBasename(): string {
    const filename = this.getFilename();
    return filename.slice(0, -this.extension.length);
  }

  /**
   * Get the directory path
   */
  getDirectory(): string {
    const lastSlash = Math.max(
      this.value.lastIndexOf("/"),
      this.value.lastIndexOf("\\"),
    );
    return lastSlash !== -1 ? this.value.slice(0, lastSlash) : "";
  }

  /**
   * Check if path is absolute
   */
  isAbsolute(): boolean {
    return (
      this.value.startsWith("/") ||
      this.value.includes(":\\") || // Windows absolute path
      this.value.startsWith("\\")
    );
  }

  /**
   * Check if this is a Markdown file
   */
  isMarkdown(): boolean {
    return (
      this.extension === ".md" ||
      this.extension === ".mdx" ||
      this.extension === ".markdown"
    );
  }

  /**
   * Create a relative path from this path
   */
  makeRelative(
    basePath: string,
  ): Result<DocumentPath, DomainError & { message: string }> {
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

    return DocumentPath.create(cleanPath);
  }

  /**
   * Join with another path segment
   */
  join(
    segment: string,
  ): Result<DocumentPath, DomainError & { message: string }> {
    if (!segment || segment.trim() === "") {
      return { ok: true, data: this };
    }

    const separator = this.value.includes("\\") ? "\\" : "/";
    const joinedPath = this.value.endsWith(separator)
      ? this.value + segment
      : this.value + separator + segment;

    return DocumentPath.create(joinedPath);
  }

  /**
   * Change the extension
   */
  withExtension(
    newExtension: DocumentExtension,
  ): Result<DocumentPath, DomainError & { message: string }> {
    const pathWithoutExt = this.value.slice(0, -this.extension.length);
    return DocumentPath.create(pathWithoutExt + newExtension);
  }

  /**
   * Extract filename from path
   */
  private static extractFilename(path: string): string {
    const lastSlash = Math.max(
      path.lastIndexOf("/"),
      path.lastIndexOf("\\"),
    );
    return lastSlash !== -1 ? path.slice(lastSlash + 1) : path;
  }

  /**
   * Check equality with another DocumentPath
   */
  equals(other: DocumentPath): boolean {
    return this.value === other.value;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `DocumentPath(${this.value})`;
  }
}
