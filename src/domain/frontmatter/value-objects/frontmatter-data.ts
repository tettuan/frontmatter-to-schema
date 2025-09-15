import { err, ok, Result } from "../../shared/types/result.ts";
import {
  createError,
  FrontmatterError,
  ValidationError,
} from "../../shared/types/errors.ts";
import { PathParser, PathSegment } from "../services/path-parser.ts";

export type FrontmatterContent = Record<string, unknown>;

export class FrontmatterData {
  private constructor(private readonly data: FrontmatterContent) {}

  static create(
    data: unknown,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (!data) {
      return err(createError({ kind: "NoFrontmatter" }));
    }

    if (typeof data !== "object" || Array.isArray(data)) {
      return err(createError({
        kind: "MalformedFrontmatter",
        content: JSON.stringify(data).substring(0, 100),
      }));
    }

    return ok(new FrontmatterData(data as FrontmatterContent));
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
      return err(createError({
        kind: "EmptyInput",
      }, "Path cannot be empty"));
    }

    // Try enhanced path parsing first (supports array indices)
    const parserResult = PathParser.create();
    if (!parserResult.ok) {
      return err(parserResult.error);
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
        return err(createError({
          kind: "FieldNotFound",
          path,
        }, `Field not found: ${path}`));
      }

      if (typeof current !== "object") {
        return err(createError({
          kind: "InvalidType",
          expected: "object",
          actual: typeof current,
        }, `Expected object at path: ${path}`));
      }

      if (part === "[]" && Array.isArray(current)) {
        return ok(current);
      }

      current = (current as Record<string, unknown>)[part];
    }

    if (current === undefined) {
      return err(createError({
        kind: "FieldNotFound",
        path,
      }, `Value not found at path: ${path}`));
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
        return err(createError({
          kind: "FieldNotFound",
          path: originalPath,
        }, `Field not found at segment ${i}: ${originalPath}`));
      }

      switch (segment.kind) {
        case "property": {
          if (typeof current !== "object") {
            return err(createError(
              {
                kind: "InvalidType",
                expected: "object",
                actual: typeof current,
              },
              `Expected object at property '${segment.value}' in path: ${originalPath}`,
            ));
          }

          current = (current as Record<string, unknown>)[segment.value];
          break;
        }
        case "arrayIndex": {
          if (!Array.isArray(current)) {
            return err(createError(
              {
                kind: "InvalidType",
                expected: "array",
                actual: typeof current,
              },
              `Expected array at index ${segment.value} in path: ${originalPath}`,
            ));
          }

          if (segment.value >= current.length || segment.value < 0) {
            return err(createError(
              {
                kind: "FieldNotFound",
                path: originalPath,
              },
              `Array index ${segment.value} out of bounds (length: ${current.length}) in path: ${originalPath}`,
            ));
          }

          current = current[segment.value];
          break;
        }
      }
    }

    if (current === undefined) {
      return err(createError({
        kind: "FieldNotFound",
        path: originalPath,
      }, `Value not found at path: ${originalPath}`));
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
    const record = obj as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
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

    let current: any = newData;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    return new FrontmatterData(newData);
  }

  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }
}
