/**
 * DataPathResolver - Resolves path expressions in data structures with array expansion support.
 *
 * @module
 */

import { PathError, PathErrorCode } from "./path-error.ts";
import { parsePath } from "./path-parser.ts";
import { Result } from "./result.ts";
import type { PathSegment } from "./types.ts";

/**
 * Resolves path expressions in data structures with advanced array expansion support.
 *
 * Features:
 * - Dot notation: "user.profile.name"
 * - Array index: "items[0].name"
 * - Array expansion: "items[].name" → collects from all elements
 * - Double expansion: "articles[].tags[]" → deep flattening
 * - Type-safe with Result<T, E>
 */
export class DataPathResolver {
  constructor(private readonly data: unknown) {}

  /**
   * Resolves a path expression to its value(s).
   *
   * @param path - Path expression (e.g., "items[].name")
   * @returns Result containing the resolved value or error
   *
   * Behavior:
   * - If path contains [], returns array (even for single result)
   * - If path doesn't contain [], returns single value
   * - If path doesn't exist, returns PathNotFoundError
   */
  resolve<T = unknown>(path: string): Result<T, PathError> {
    const segmentsResult = parsePath(path);
    if (segmentsResult.isError()) {
      return Result.error(segmentsResult.unwrapError());
    }

    const segments = segmentsResult.unwrap();
    const result = this.resolveSegments(this.data, segments, path, 0);

    if (result.isError()) {
      return Result.error(result.unwrapError());
    }

    return Result.ok(result.unwrap() as T);
  }

  /**
   * Checks if a path exists in the data.
   *
   * @param path - Path expression to check
   * @returns true if path resolves successfully
   */
  exists(path: string): boolean {
    const result = this.resolve(path);
    return result.isOk();
  }

  /**
   * Resolves a path and ensures the result is an array.
   *
   * @param path - Path expression
   * @returns Result containing an array (empty if nothing found)
   *
   * Behavior:
   * - "items[].name" → returns array
   * - "user.name" → returns [value] (wrapped in array)
   * - Non-existent path → returns [] (empty array)
   */
  resolveAsArray<T = unknown>(path: string): Result<T[], PathError> {
    const result = this.resolve(path);

    if (result.isError()) {
      const error = result.unwrapError();
      // PATH_NOT_FOUND returns empty array for x-derived-from use case
      if (error.code === PathErrorCode.PATH_NOT_FOUND) {
        return Result.ok([]);
      }
      return Result.error(error);
    }

    const value = result.unwrap();

    // Already an array
    if (Array.isArray(value)) {
      return Result.ok(value as T[]);
    }

    // null/undefined → empty array
    if (value === null || value === undefined) {
      return Result.ok([]);
    }

    // Wrap single value in array
    return Result.ok([value] as T[]);
  }

  /**
   * Resolves segments sequentially.
   */
  private resolveSegments(
    current: unknown,
    segments: PathSegment[],
    path: string,
    index: number,
  ): Result<unknown, PathError> {
    if (index >= segments.length) {
      return Result.ok(current);
    }

    const segment = segments[index];
    if (!segment) {
      return Result.error(
        new PathError(
          PathErrorCode.INVALID_PATH_SYNTAX,
          "Invalid segment at index",
          path,
          { index },
        ),
      );
    }

    switch (segment.type) {
      case "property":
        return this.resolveProperty(
          current,
          segment.value,
          segments,
          path,
          index,
        );

      case "arrayIndex":
        return this.resolveArrayIndex(
          current,
          segment.value,
          segments,
          path,
          index,
        );

      case "arrayExpansion":
        return this.resolveArrayExpansion(current, segments, path, index);
    }
  }

  /**
   * Resolves property access.
   */
  private resolveProperty(
    current: unknown,
    propertyName: string,
    segments: PathSegment[],
    path: string,
    index: number,
  ): Result<unknown, PathError> {
    // null/undefined check
    if (current == null) {
      return Result.error(
        new PathError(
          PathErrorCode.PATH_NOT_FOUND,
          `Cannot access property '${propertyName}' on null/undefined`,
          path,
          { segment: propertyName, current },
        ),
      );
    }

    // Object check
    if (typeof current !== "object" || Array.isArray(current)) {
      return Result.error(
        new PathError(
          PathErrorCode.INVALID_STRUCTURE,
          `Expected object but got ${typeof current}`,
          path,
          { segment: propertyName, current },
        ),
      );
    }

    const value = (current as Record<string, unknown>)[propertyName];

    if (value === undefined) {
      return Result.error(
        new PathError(
          PathErrorCode.PATH_NOT_FOUND,
          `Property '${propertyName}' not found`,
          path,
          { segment: propertyName, current },
        ),
      );
    }

    return this.resolveSegments(value, segments, path, index + 1);
  }

  /**
   * Resolves array index access.
   */
  private resolveArrayIndex(
    current: unknown,
    arrayIndex: number,
    segments: PathSegment[],
    path: string,
    index: number,
  ): Result<unknown, PathError> {
    // Array check
    if (!Array.isArray(current)) {
      return Result.error(
        new PathError(
          PathErrorCode.ARRAY_EXPECTED,
          `Expected array but got ${typeof current}`,
          path,
          { segment: `[${arrayIndex}]`, current },
        ),
      );
    }

    // Bounds check
    if (arrayIndex < 0 || arrayIndex >= current.length) {
      return Result.error(
        new PathError(
          PathErrorCode.INDEX_OUT_OF_BOUNDS,
          `Index ${arrayIndex} out of bounds [0, ${current.length})`,
          path,
          { segment: `[${arrayIndex}]`, arrayLength: current.length },
        ),
      );
    }

    const value = current[arrayIndex];
    return this.resolveSegments(value, segments, path, index + 1);
  }

  /**
   * Resolves array expansion ([]).
   */
  private resolveArrayExpansion(
    current: unknown,
    segments: PathSegment[],
    path: string,
    index: number,
  ): Result<unknown, PathError> {
    // Array check
    if (!Array.isArray(current)) {
      return Result.error(
        new PathError(
          PathErrorCode.ARRAY_EXPECTED,
          `Expected array for expansion but got ${typeof current}`,
          path,
          { segment: "[]", current },
        ),
      );
    }

    const results: unknown[] = [];
    const remainingSegments = segments.slice(index + 1);

    for (const item of current) {
      if (remainingSegments.length === 0) {
        // No more segments, add item as-is
        results.push(item);
      } else {
        // Resolve remaining path for each element
        const result = this.resolveSegments(item, remainingSegments, path, 0);

        if (result.isError()) {
          // Skip elements that don't match (Rule 5: missing elements are skipped)
          continue;
        }

        const value = result.unwrap();

        // Flatten nested arrays (Double expansion support)
        if (Array.isArray(value)) {
          results.push(...value);
        } else {
          results.push(value);
        }
      }
    }

    return Result.ok(results);
  }
}
