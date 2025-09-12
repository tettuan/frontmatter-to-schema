/**
 * FilePath Value Object
 *
 * Represents a validated file system path for markdown files
 * following the Smart Constructor pattern with Totality principles
 */

import type { Result } from "./result.ts";
import type { DomainError } from "./result.ts";
import { createDomainError } from "./result.ts";

/**
 * FilePath represents a validated file system path
 */
export class FilePath {
  private constructor(
    private readonly path: string,
  ) {}

  /**
   * Smart Constructor - Creates FilePath from string path
   */
  static create(
    path: string,
  ): Result<FilePath, DomainError & { message: string }> {
    // Validate path is not empty
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "FilePath cannot be empty",
        ),
      };
    }

    const trimmedPath = path.trim();

    // Validate path doesn't contain null bytes (security)
    if (trimmedPath.includes("\0")) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: path,
            expectedFormat: "path without null bytes",
          },
          "FilePath cannot contain null bytes",
        ),
      };
    }

    // Validate path is not just dots or slashes
    if (/^[./\\]+$/.test(trimmedPath)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: path,
            expectedFormat: "valid file path",
          },
          "FilePath must be a valid file path, not just dots or slashes",
        ),
      };
    }

    return {
      ok: true,
      data: new FilePath(trimmedPath),
    };
  }

  /**
   * Get the raw path string
   */
  toString(): string {
    return this.path;
  }

  /**
   * Get the path value (alias for toString for convenience)
   */
  getValue(): string {
    return this.path;
  }

  /**
   * Get the file name (last part of path)
   */
  getFileName(): string {
    const parts = this.path.split(/[/\\]/);
    return parts[parts.length - 1] || "";
  }

  /**
   * Get the file extension (including the dot)
   */
  getExtension(): string {
    const fileName = this.getFileName();
    const lastDot = fileName.lastIndexOf(".");
    return lastDot === -1 ? "" : fileName.substring(lastDot);
  }

  /**
   * Check if this is a markdown file
   */
  isMarkdownFile(): boolean {
    const ext = this.getExtension().toLowerCase();
    return ext === ".md" || ext === ".markdown";
  }

  /**
   * Get the directory path (all but the last part)
   */
  getDirectoryPath(): string {
    const parts = this.path.split(/[/\\]/);
    if (parts.length <= 1) return "";
    return parts.slice(0, -1).join("/");
  }

  /**
   * Check if path is absolute
   */
  isAbsolute(): boolean {
    // Unix absolute path starts with /
    // Windows absolute path starts with drive letter like C:
    return this.path.startsWith("/") || /^[A-Za-z]:/.test(this.path);
  }

  /**
   * Check if path is relative
   */
  isRelative(): boolean {
    return !this.isAbsolute();
  }

  /**
   * Join with another path segment
   */
  join(segment: string): Result<FilePath, DomainError & { message: string }> {
    if (!segment || segment.trim() === "") {
      return { ok: true, data: this };
    }

    const separator = this.path.includes("\\") ? "\\" : "/";
    const joinedPath = this.path + separator + segment.trim();

    return FilePath.create(joinedPath);
  }

  /**
   * Value equality comparison
   */
  equals(other: FilePath): boolean {
    return this.path === other.path;
  }

  /**
   * String representation for debugging
   */
  toDebugString(): string {
    return `FilePath[${this.path}]`;
  }
}
