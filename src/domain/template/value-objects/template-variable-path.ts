/**
 * Template Variable Path Value Object
 *
 * Represents a hierarchical path for template variable resolution (e.g., "id.full").
 * Implements Totality principles with smart constructor and comprehensive validation.
 *
 * This value object addresses the core issue where hierarchical variables like {id.full}
 * were not properly parsed and validated before resolution attempts.
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";

/**
 * Template Variable Path - Smart Constructor Pattern
 *
 * Encapsulates the logic for parsing and validating hierarchical variable paths.
 * Supports both simple variables ("name") and hierarchical paths ("id.full").
 */
export class TemplateVariablePath {
  private constructor(
    private readonly segments: readonly string[],
    private readonly isHierarchical: boolean,
  ) {}

  /**
   * Smart Constructor for TemplateVariablePath
   * Validates path format and creates immutable instance
   * @param path - The variable path (e.g., "id.full", "name")
   * @returns Result containing TemplateVariablePath or validation error
   */
  static create(
    path: string,
  ): Result<TemplateVariablePath, ValidationError & { message: string }> {
    // Validate input
    if (typeof path !== "string") {
      return err({
        kind: "InvalidType" as const,
        expected: "string",
        actual: typeof path,
        message: `Path must be a string, got ${typeof path}`,
      });
    }

    if (path.trim().length === 0) {
      return err({
        kind: "EmptyInput" as const,
        message: "Path cannot be empty or whitespace only",
      });
    }

    const normalizedPath = path.trim();

    // Validate path format
    if (normalizedPath.startsWith(".") || normalizedPath.endsWith(".")) {
      return err({
        kind: "InvalidFormat" as const,
        format: "template-variable-path",
        value: normalizedPath,
        message: `Path cannot start or end with dot: "${normalizedPath}"`,
      });
    }

    if (normalizedPath.includes("..")) {
      return err({
        kind: "InvalidFormat" as const,
        format: "template-variable-path",
        value: normalizedPath,
        message: `Path cannot contain consecutive dots: "${normalizedPath}"`,
      });
    }

    // Split into segments and validate each
    const segments = normalizedPath.split(".");
    for (const [index, segment] of segments.entries()) {
      if (segment.length === 0) {
        return err({
          kind: "EmptyInput" as const,
          message:
            `Empty segment at position ${index} in path: "${normalizedPath}"`,
        });
      }

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) {
        return err({
          kind: "PatternMismatch" as const,
          value: segment,
          pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$",
          message:
            `Invalid segment "${segment}" at position ${index}. Segments must start with letter or underscore and contain only alphanumeric characters and underscores`,
        });
      }
    }

    const isHierarchical = segments.length > 1;

    return ok(new TemplateVariablePath(segments, isHierarchical));
  }

  /**
   * Get all path segments
   * @returns Array of path segments (immutable)
   */
  getSegments(): readonly string[] {
    return this.segments;
  }

  /**
   * Get the root segment (first part of the path)
   * @returns The root segment
   */
  getRoot(): string {
    return this.segments[0];
  }

  /**
   * Get the leaf segment (last part of the path)
   * @returns The leaf segment
   */
  getLeaf(): string {
    return this.segments[this.segments.length - 1];
  }

  /**
   * Check if this is a hierarchical path (contains dots)
   * @returns True if hierarchical, false if simple
   */
  isHierarchicalPath(): boolean {
    return this.isHierarchical;
  }

  /**
   * Get the depth of the path (number of segments)
   * @returns Path depth
   */
  getDepth(): number {
    return this.segments.length;
  }

  /**
   * Get the full path as string
   * @returns Original path string
   */
  toString(): string {
    return this.segments.join(".");
  }

  /**
   * Create a sub-path from a given index
   * @param fromIndex - Starting index (inclusive)
   * @returns Result containing new TemplateVariablePath or error
   */
  getSubPath(
    fromIndex: number,
  ): Result<TemplateVariablePath, ValidationError & { message: string }> {
    if (fromIndex < 0 || fromIndex >= this.segments.length) {
      return err({
        kind: "OutOfRange" as const,
        value: fromIndex,
        min: 0,
        max: this.segments.length - 1,
        message:
          `Index ${fromIndex} is out of range for path with ${this.segments.length} segments`,
      });
    }

    const subSegments = this.segments.slice(fromIndex);
    const subPath = subSegments.join(".");

    return TemplateVariablePath.create(subPath);
  }

  /**
   * Create a parent path (all segments except the last)
   * @returns Result containing parent path or error if no parent exists
   */
  getParentPath(): Result<
    TemplateVariablePath,
    ValidationError & { message: string }
  > {
    if (this.segments.length <= 1) {
      return err({
        kind: "MissingRequired" as const,
        field: "parent",
        message: `Path "${this.toString()}" has no parent`,
      });
    }

    const parentSegments = this.segments.slice(0, -1);
    const parentPath = parentSegments.join(".");

    return TemplateVariablePath.create(parentPath);
  }

  /**
   * Check if this path starts with another path
   * @param prefix - The prefix path to check
   * @returns True if this path starts with the prefix
   */
  startsWith(prefix: TemplateVariablePath): boolean {
    if (prefix.segments.length > this.segments.length) {
      return false;
    }

    for (let i = 0; i < prefix.segments.length; i++) {
      if (this.segments[i] !== prefix.segments[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Equality comparison
   * @param other - Another TemplateVariablePath to compare with
   * @returns True if paths are equal
   */
  equals(other: TemplateVariablePath): boolean {
    if (this.segments.length !== other.segments.length) {
      return false;
    }

    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i] !== other.segments[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert to JSON representation for debugging
   * @returns JSON object representation
   */
  toJSON(): {
    path: string;
    segments: string[];
    isHierarchical: boolean;
    depth: number;
  } {
    return {
      path: this.toString(),
      segments: [...this.segments],
      isHierarchical: this.isHierarchical,
      depth: this.segments.length,
    };
  }
}
