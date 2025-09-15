import { err, ok, Result } from "../../../domain/shared/types/result.ts";
import {
  createError,
  FileSystemError,
} from "../../../domain/shared/types/errors.ts";

/**
 * Path Expansion Service for CLI
 *
 * Handles directory and glob pattern expansion following DDD principles
 * Converts user-friendly input patterns to file system compatible patterns
 */
export class PathExpansionService {
  private constructor() {}

  /**
   * Smart constructor following Totality principles
   */
  static create(): Result<PathExpansionService, never> {
    return ok(new PathExpansionService());
  }

  /**
   * Expand directory paths to markdown file patterns
   * Follows Totality principle - returns Result type
   */
  expandDirectoryPath(
    directoryPath: string,
  ): Result<string, FileSystemError & { message: string }> {
    if (!this.isDirectoryPath(directoryPath)) {
      return err(createError({
        kind: "InvalidPath",
        path: directoryPath,
        message: `Path is not a directory: ${directoryPath}`,
      }));
    }

    // Normalize directory path
    const normalizedPath = directoryPath.endsWith("/")
      ? directoryPath.slice(0, -1)
      : directoryPath;

    // Convert to markdown glob pattern
    const globPattern = `${normalizedPath}/**/*.md`;

    return ok(globPattern);
  }

  /**
   * Validate and normalize glob patterns
   */
  normalizeGlobPattern(
    pattern: string,
  ): Result<string, FileSystemError & { message: string }> {
    if (!pattern || pattern.trim().length === 0) {
      return err(createError({
        kind: "InvalidPath",
        path: pattern,
        message: "Glob pattern cannot be empty",
      }));
    }

    const normalizedPattern = pattern.trim();

    // Basic glob pattern validation
    if (!this.isValidGlobPattern(normalizedPattern)) {
      return err(createError({
        kind: "InvalidPath",
        path: pattern,
        message:
          `Invalid glob pattern: ${pattern}. Examples: "*.md", "docs/**/*.md"`,
      }));
    }

    return ok(normalizedPattern);
  }

  /**
   * Determine the appropriate expansion strategy for input pattern
   */
  expandInputPattern(
    inputPattern: string,
  ): Result<string, FileSystemError & { message: string }> {
    if (this.isDirectoryPath(inputPattern)) {
      return this.expandDirectoryPath(inputPattern);
    }

    if (this.isGlobPattern(inputPattern)) {
      return this.normalizeGlobPattern(inputPattern);
    }

    // Single file - ensure it's a markdown file
    if (inputPattern.endsWith(".md")) {
      return ok(inputPattern);
    }

    // If no extension, assume it's a directory
    if (!inputPattern.includes(".")) {
      return this.expandDirectoryPath(inputPattern);
    }

    return err(createError({
      kind: "InvalidPath",
      path: inputPattern,
      message:
        `Unsupported input pattern: ${inputPattern}. Expected: directory, *.md file, or glob pattern`,
    }));
  }

  /**
   * Generate helpful suggestions for common path expansion errors
   */
  generatePathSuggestions(
    originalPath: string,
    error: FileSystemError,
  ): string[] {
    const suggestions: string[] = [];

    if (error.kind === "InvalidPath") {
      if (this.isDirectoryPath(originalPath)) {
        suggestions.push(`Try: ${originalPath}/**/*.md`);
        suggestions.push(`Or: ${originalPath}/*.md`);
      } else if (!originalPath.includes("*")) {
        suggestions.push(`Try: ${originalPath}*.md`);
        suggestions.push(`Or: **/${originalPath}*.md`);
      }

      suggestions.push("Valid patterns:");
      suggestions.push('  - "docs/"           (directory)');
      suggestions.push('  - "*.md"            (current directory)');
      suggestions.push('  - "docs/**/*.md"    (recursive)');
      suggestions.push('  - "docs/readme.md"  (single file)');
    }

    return suggestions;
  }

  /**
   * Check if path appears to be a directory
   */
  private isDirectoryPath(path: string): boolean {
    return path.endsWith("/") ||
      (!path.includes("*") && !path.includes("?") && !path.includes("."));
  }

  /**
   * Check if pattern is a glob pattern
   */
  private isGlobPattern(pattern: string): boolean {
    return pattern.includes("*") || pattern.includes("?");
  }

  /**
   * Validate glob pattern syntax
   */
  private isValidGlobPattern(pattern: string): boolean {
    // Basic validation - more sophisticated validation can be added
    if (pattern.includes("***")) return false; // Invalid triple star
    if (pattern.includes("//")) return false; // Invalid double slash

    // Must contain markdown extension if not using wildcards for extension
    if (!pattern.includes("*") && !pattern.endsWith(".md")) {
      return false;
    }

    return true;
  }
}
