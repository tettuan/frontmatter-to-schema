import { ok, Result } from "../../shared/types/result.ts";
import {
  FrontmatterError,
  ValidationError,
} from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { PathParser, PathSegment } from "../services/path-parser.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

export type FrontmatterContent = Record<string, unknown>;

export class FrontmatterData {
  private constructor(private readonly data: FrontmatterContent) {}

  static create(
    data: unknown,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (!data) {
      return ErrorHandler.frontmatter({
        operation: "create",
        method: "validateData",
      }).noFrontmatter();
    }

    // Use SafePropertyAccess to eliminate type assertion
    const recordResult = SafePropertyAccess.asRecord(data);
    if (!recordResult.ok) {
      return ErrorHandler.frontmatter({
        operation: "create",
        method: "validateRecord",
      }).malformedFrontmatter(JSON.stringify(data).substring(0, 100));
    }

    return ok(new FrontmatterData(recordResult.data));
  }

  static empty(): FrontmatterData {
    return new FrontmatterData({});
  }

  getData(): FrontmatterContent {
    return { ...this.data };
  }

  get(
    path: string,
  ): Result<unknown, ValidationError & { message: string }> {
    if (!path || path.trim() === "") {
      return ErrorHandler.validation({
        operation: "get",
        method: "validatePath",
      }).emptyInput();
    }

    // Try enhanced path parsing first (supports array indices)
    const parserResult = PathParser.create();
    if (!parserResult.ok) {
      return parserResult;
    }

    const segmentsResult = parserResult.data.parseComplex(path);
    if (segmentsResult.ok) {
      // Use enhanced path resolution
      return this.getBySegments(segmentsResult.data, path);
    }

    // Fallback to simple dot notation for backward compatibility
    const parts = path.split(".");
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return ErrorHandler.validation({
          operation: "get",
          method: "traversePath",
        }).fieldNotFound(path, `Field not found: ${path}`);
      }

      if (typeof current !== "object") {
        return ErrorHandler.validation({
          operation: "get",
          method: "validateObjectType",
        }).invalidType("object", typeof current);
      }

      if (part === "[]" && Array.isArray(current)) {
        return ok(current);
      }

      // Use SafePropertyAccess to eliminate type assertion
      const propertyResult = SafePropertyAccess.getProperty(current, part);
      if (!propertyResult.ok) {
        return ErrorHandler.validation({
          operation: "get",
          method: "accessProperty",
        }).invalidType("object", typeof current);
      }

      current = propertyResult.data;
    }

    if (current === undefined) {
      return ErrorHandler.validation({
        operation: "get",
        method: "validateValue",
      }).fieldNotFound(path, `Value not found at path: ${path}`);
    }

    return ok(current);
  }

  /**
   * Navigate through data using parsed path segments
   * Supports both property access and array index access
   * @param segments - Array of path segments from PathParser
   * @param originalPath - Original path string for error reporting
   * @returns Result containing the value or error
   */
  private getBySegments(
    segments: PathSegment[],
    originalPath: string,
  ): Result<unknown, ValidationError & { message: string }> {
    let current: unknown = this.data;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (current === null || current === undefined) {
        return ErrorHandler.validation({
          operation: "getBySegments",
          method: "traverseSegments",
        }).fieldNotFound(
          originalPath,
          `Field not found at segment ${i}: ${originalPath}`,
        );
      }

      switch (segment.kind) {
        case "property": {
          if (typeof current !== "object") {
            return ErrorHandler.validation({
              operation: "getBySegments",
              method: "validatePropertyAccess",
            }).invalidType("object", typeof current);
          }

          // Use SafePropertyAccess to eliminate type assertion
          const propertyResult = SafePropertyAccess.getProperty(
            current,
            segment.value,
          );
          if (!propertyResult.ok) {
            return ErrorHandler.validation({
              operation: "getBySegments",
              method: "accessProperty",
            }).invalidType("object", typeof current);
          }

          current = propertyResult.data;
          break;
        }
        case "arrayIndex": {
          if (!Array.isArray(current)) {
            return ErrorHandler.validation({
              operation: "getBySegments",
              method: "validateArrayAccess",
            }).invalidType("array", typeof current);
          }

          if (segment.value >= current.length || segment.value < 0) {
            return ErrorHandler.validation({
              operation: "getBySegments",
              method: "validateArrayIndex",
            }).fieldNotFound(
              originalPath,
              `Array index ${segment.value} out of bounds (length: ${current.length}) in path: ${originalPath}`,
            );
          }

          current = current[segment.value];
          break;
        }
      }
    }

    if (current === undefined) {
      return ErrorHandler.validation({
        operation: "getBySegments",
        method: "validateFinalValue",
      }).fieldNotFound(
        originalPath,
        `Value not found at path: ${originalPath}`,
      );
    }

    return ok(current);
  }

  // Legacy method for backward compatibility - prefer get() with Result type
  getLegacy(path: string): unknown {
    const result = this.get(path);
    return result.ok ? result.data : undefined;
  }

  has(path: string): boolean {
    const result = this.get(path);
    return result.ok;
  }

  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }

  /**
   * Get all keys available in the frontmatter data
   * Returns both top-level keys and nested keys using dot notation
   */
  getAllKeys(): string[] {
    return this.extractKeysRecursively(this.data, "");
  }

  /**
   * Recursively extract all keys from nested objects using dot notation
   */
  private extractKeysRecursively(obj: unknown, prefix: string): string[] {
    if (obj === null || obj === undefined || typeof obj !== "object") {
      return [];
    }

    if (Array.isArray(obj)) {
      // For arrays, we don't expand individual indices as keys
      // The array itself is the value for the current path
      return prefix ? [prefix] : [];
    }

    const keys: string[] = [];

    // Use SafePropertyAccess to eliminate type assertion
    const recordResult = SafePropertyAccess.asRecord(obj);
    if (!recordResult.ok) {
      return [];
    }

    for (const [key, value] of Object.entries(recordResult.data)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;

      if (
        value !== null && typeof value === "object" && !Array.isArray(value)
      ) {
        // Recursively extract nested keys
        keys.push(...this.extractKeysRecursively(value, currentPath));
      } else {
        // Add this key (for primitives, arrays, and null values)
        keys.push(currentPath);
      }
    }

    return keys;
  }

  merge(other: FrontmatterData): FrontmatterData {
    return new FrontmatterData({
      ...this.data,
      ...other.data,
    });
  }

  withField(path: string, value: unknown): FrontmatterData {
    const parts = path.split(".");
    const newData = JSON.parse(JSON.stringify(this.data));

    let current: Record<string, unknown> = newData;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return new FrontmatterData(newData);
  }

  /**
   * Set a value at the specified path, returning a new FrontmatterData instance
   * This is a safer version of withField that returns a Result type
   */
  set(
    path: string,
    value: unknown,
  ): Result<FrontmatterData, ValidationError & { message: string }> {
    if (!path || path.trim() === "") {
      return ErrorHandler.validation({
        operation: "set",
        method: "validatePath",
      }).emptyInput();
    }

    try {
      const newData = this.withField(path, value);
      return ok(newData);
    } catch (_error) {
      return ErrorHandler.validation({
        operation: "set",
        method: "setField",
      }).invalidType("valid path", "invalid");
    }
  }

  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }
}
