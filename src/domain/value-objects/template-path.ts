/**
 * TemplatePath Value Object
 *
 * Represents a validated path to a template file
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * Supported template extensions
 */
const SUPPORTED_EXTENSIONS = [
  ".hbs",
  ".handlebars",
  ".mustache",
  ".liquid",
  ".ejs",
  ".pug",
  ".html",
  ".htm",
  ".txt",
  ".json",
] as const;
export type TemplateExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/**
 * TemplatePath value object with validation
 * Ensures path is valid and points to a supported template file
 */
export class TemplatePath {
  private constructor(
    private readonly value: string,
    private readonly extension: TemplateExtension,
  ) {}

  /**
   * Smart Constructor for TemplatePath
   * Validates path format and extension
   */
  static create(
    path: string,
  ): Result<TemplatePath, DomainError & { message: string }> {
    // Check for empty string
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Template path cannot be empty",
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
          "Template path contains invalid characters",
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
          "Template path contains directory traversal patterns",
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
          `Template must have one of these extensions: ${
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
          "Template path exceeds maximum length of 1024 characters",
        ),
      };
    }

    // Check for valid filename (not just extension)
    const filename = TemplatePath.extractFilename(trimmedPath);
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
          "Template filename cannot be just an extension",
        ),
      };
    }

    return {
      ok: true,
      data: new TemplatePath(trimmedPath, extension as TemplateExtension),
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
  getExtension(): TemplateExtension {
    return this.extension;
  }

  /**
   * Get the filename without path
   */
  getFilename(): string {
    return TemplatePath.extractFilename(this.value);
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
   * Get template engine type based on extension
   */
  getTemplateEngine(): string {
    switch (this.extension) {
      case ".hbs":
      case ".handlebars":
        return "handlebars";
      case ".mustache":
        return "mustache";
      case ".liquid":
        return "liquid";
      case ".ejs":
        return "ejs";
      case ".pug":
        return "pug";
      case ".html":
      case ".htm":
        return "html";
      case ".txt":
        return "text";
      case ".json":
        return "json";
      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = this.extension;
        return `unknown-${String(_exhaustiveCheck)}`;
      }
    }
  }

  /**
   * Check if this is a Handlebars template
   */
  isHandlebars(): boolean {
    return this.extension === ".hbs" || this.extension === ".handlebars";
  }

  /**
   * Check if this is a Mustache template
   */
  isMustache(): boolean {
    return this.extension === ".mustache";
  }

  /**
   * Check if this is a Liquid template
   */
  isLiquid(): boolean {
    return this.extension === ".liquid";
  }

  /**
   * Check if this is an HTML template
   */
  isHtml(): boolean {
    return this.extension === ".html" || this.extension === ".htm";
  }

  /**
   * Check if this is a JSON template
   */
  isJson(): boolean {
    return this.extension === ".json";
  }

  /**
   * Create a relative path from this path
   */
  makeRelative(
    basePath: string,
  ): Result<TemplatePath, DomainError & { message: string }> {
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
    const cleanPath = relativePath.startsWith("/") ||
        relativePath.startsWith("\\")
      ? relativePath.slice(1)
      : relativePath;

    return TemplatePath.create(cleanPath);
  }

  /**
   * Join with another path segment
   */
  join(
    segment: string,
  ): Result<TemplatePath, DomainError & { message: string }> {
    if (!segment || segment.trim() === "") {
      return { ok: true, data: this };
    }

    const separator = this.value.includes("\\") ? "\\" : "/";
    const joinedPath = this.value.endsWith(separator)
      ? this.value + segment
      : this.value + separator + segment;

    return TemplatePath.create(joinedPath);
  }

  /**
   * Change the extension
   */
  withExtension(
    newExtension: TemplateExtension,
  ): Result<TemplatePath, DomainError & { message: string }> {
    const pathWithoutExt = this.value.slice(0, -this.extension.length);
    return TemplatePath.create(pathWithoutExt + newExtension);
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
   * Check equality with another TemplatePath
   */
  equals(other: TemplatePath): boolean {
    return this.value === other.value;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `TemplatePath(${this.value})`;
  }
}
