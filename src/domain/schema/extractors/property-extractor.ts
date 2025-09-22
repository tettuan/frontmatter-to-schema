/**
 * @fileoverview Property Extractor - Extracts values from nested property paths
 * @description Implements the x-extract-from directive for extracting values from frontmatter data
 * Following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";

/**
 * Value Object representing a property path
 * Following Totality principle - immutable value object with private constructor
 */
export class PropertyPath {
  private constructor(
    private readonly segments: readonly string[],
    private readonly hasArrayNotation: boolean,
  ) {}

  /**
   * Smart Constructor for property path
   * Parses paths like "id.full" or "traceability[].id.full"
   */
  static create(path: string): Result<PropertyPath, SchemaError> {
    if (!path || path.trim() === "") {
      return err({
        kind: "PropertyNotFound" as const,
        path: "Property path cannot be empty",
      });
    }

    // Check for invalid patterns
    if (path.includes("..")) {
      return err({
        kind: "PropertyNotFound" as const,
        path: `Invalid path: '${path}' - consecutive dots are not allowed`,
      });
    }

    // Check if path contains array notation []
    const hasArrayNotation = path.includes("[]");

    // Parse the path into segments
    // Handle array notation by temporarily replacing [] with a marker
    const normalizedPath = path.replace(/\[\]/g, "__ARRAY__");
    const segments = normalizedPath.split(".")
      .map((segment) => segment.replace(/__ARRAY__/g, "[]"))
      .filter((segment) => segment !== "");

    if (segments.length === 0) {
      return err({
        kind: "PropertyNotFound" as const,
        path: `Invalid path: '${path}' - no valid segments found`,
      });
    }

    return ok(new PropertyPath(segments, hasArrayNotation));
  }

  /**
   * Get the path segments
   */
  getSegments(): readonly string[] {
    return this.segments;
  }

  /**
   * Check if path contains array notation
   */
  hasArrayExpansion(): boolean {
    return this.hasArrayNotation;
  }

  /**
   * Get segments before array notation
   */
  getPreArraySegments(): string[] {
    const arrayIndex = this.segments.findIndex((s) => s.includes("[]"));
    if (arrayIndex === -1) return [...this.segments];

    // Get segments up to and including the one with array notation
    const segmentsUpToArray = this.segments.slice(0, arrayIndex + 1);

    // Remove the [] from the last segment
    return segmentsUpToArray.map((s, i) => {
      if (i === segmentsUpToArray.length - 1) {
        return s.replace("[]", "");
      }
      return s;
    }).filter((s) => s !== ""); // Remove empty segments
  }

  /**
   * Get segments after array notation
   */
  getPostArraySegments(): string[] {
    const arrayIndex = this.segments.findIndex((s) => s.includes("[]"));
    if (arrayIndex === -1) return [];
    return this.segments.slice(arrayIndex + 1);
  }

  /**
   * String representation
   */
  toString(): string {
    return this.segments.join(".");
  }
}

/**
 * Service for extracting values from data using property paths
 * Following DDD Service pattern
 */
export class PropertyExtractor {
  private constructor() {}

  /**
   * Smart Constructor
   */
  static create(): PropertyExtractor {
    return new PropertyExtractor();
  }

  /**
   * Extract value from data using property path
   * Handles both simple paths and array notation
   */
  extract(
    data: unknown,
    path: PropertyPath,
  ): Result<unknown, SchemaError> {
    try {
      if (path.hasArrayExpansion()) {
        return this.extractWithArrayExpansion(data, path);
      }
      return this.extractSimplePath(data, path);
    } catch (error) {
      return err({
        kind: "InvalidSchema" as const,
        message: `Failed to extract value: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Extract value using simple dot notation
   */
  private extractSimplePath(
    data: unknown,
    path: PropertyPath,
  ): Result<unknown, SchemaError> {
    let current: unknown = data;

    for (const segment of path.getSegments()) {
      if (current === null || current === undefined) {
        return ok(undefined);
      }

      if (typeof current !== "object") {
        return err({
          kind: "PropertyNotFound" as const,
          path: `Cannot access property '${segment}' on non-object value`,
        });
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return ok(current);
  }

  /**
   * Extract value with array expansion notation
   * Handles paths like "traceability[].id.full"
   */
  private extractWithArrayExpansion(
    data: unknown,
    path: PropertyPath,
  ): Result<unknown[], SchemaError> {
    // Get the part before []
    const preArraySegments = path.getPreArraySegments();
    const postArraySegments = path.getPostArraySegments();

    // Edge case: path is just "[]" with no property name
    // This is invalid and should return empty array
    if (preArraySegments.length === 0) {
      return ok([]);
    }

    // Navigate to the array/value
    let current: unknown = data;
    for (const segment of preArraySegments) {
      if (current === null || current === undefined) {
        return ok([]);
      }

      if (typeof current !== "object") {
        return err({
          kind: "PropertyNotFound" as const,
          path: `Cannot access property '${segment}' on non-object value`,
        });
      }

      current = (current as Record<string, unknown>)[segment];
    }

    // Normalize to array
    const arrayData = this.normalizeToArray(current);

    // If no post-array segments, return the normalized array
    if (postArraySegments.length === 0) {
      return ok(arrayData);
    }

    // Extract from each array element
    const results: unknown[] = [];
    for (const item of arrayData) {
      let itemCurrent: unknown = item;
      for (const segment of postArraySegments) {
        if (itemCurrent === null || itemCurrent === undefined) {
          itemCurrent = undefined;
          break;
        }

        if (typeof itemCurrent !== "object") {
          itemCurrent = undefined;
          break;
        }

        itemCurrent = (itemCurrent as Record<string, unknown>)[segment];
      }
      if (itemCurrent !== undefined) {
        results.push(itemCurrent);
      }
    }

    return ok(results);
  }

  /**
   * Normalize value to array
   * Single values are wrapped in array, arrays are returned as-is
   */
  private normalizeToArray(value: unknown): unknown[] {
    if (value === null || value === undefined) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    return [value];
  }
}
