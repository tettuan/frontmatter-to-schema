import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

/**
 * Represents a segment in a data access path
 * Following Totality principles with discriminated union
 */
export type PathSegment =
  | { kind: "property"; value: string }
  | { kind: "arrayIndex"; value: number };

/**
 * PathParser handles parsing of complex data access paths.
 * Supports both property access (dot notation) and array index access.
 * Follows DDD Smart Constructor pattern and Totality principles.
 */
export class PathParser {
  private constructor() {}

  /**
   * Smart Constructor for PathParser
   * @returns Result containing PathParser instance or error
   */
  static create(): Result<
    PathParser,
    ValidationError & { message: string }
  > {
    return ok(new PathParser());
  }

  /**
   * Parses a path string into an array of path segments
   * Supports:
   * - Simple properties: "name", "title"
   * - Dot notation: "user.name", "config.settings"
   * - Array indices: "items[0]", "commands[1]"
   * - Mixed paths: "commands[0].name", "config.items[1].value"
   *
   * @param path - The path string to parse
   * @returns Result containing array of PathSegments or error
   */
  parse(
    path: string,
  ): Result<PathSegment[], ValidationError & { message: string }> {
    if (!path || path.trim() === "") {
      return err(createError(
        { kind: "EmptyInput" },
        "Path cannot be empty",
      ));
    }

    const trimmedPath = path.trim();

    try {
      const segments: PathSegment[] = [];
      let currentIndex = 0;

      while (currentIndex < trimmedPath.length) {
        // Parse next segment (property or array index)
        const segmentResult = this.parseNextSegment(
          trimmedPath,
          currentIndex,
        );

        if (!segmentResult.ok) {
          return segmentResult;
        }

        segments.push(segmentResult.data.segment);
        currentIndex = segmentResult.data.nextIndex;

        // Skip dot separator if present
        if (
          currentIndex < trimmedPath.length && trimmedPath[currentIndex] === "."
        ) {
          currentIndex++;
        }
      }

      if (segments.length === 0) {
        return err(createError(
          { kind: "ParseError", input: path },
          "No valid segments found in path",
        ));
      }

      return ok(segments);
    } catch (error) {
      return err(createError(
        { kind: "ParseError", input: path },
        error instanceof Error
          ? `Path parsing failed: ${error.message}`
          : "Path parsing failed",
      ));
    }
  }

  /**
   * Parses the next segment from the given position in the path
   * @param path - The complete path string
   * @param startIndex - Current position in the path
   * @returns Result containing the parsed segment and next index position
   */
  private parseNextSegment(
    path: string,
    startIndex: number,
  ): Result<
    { segment: PathSegment; nextIndex: number },
    ValidationError & { message: string }
  > {
    let currentIndex = startIndex;
    let segmentName = "";

    // Parse property name until we hit '[', '.', or end of string
    while (
      currentIndex < path.length &&
      path[currentIndex] !== "[" &&
      path[currentIndex] !== "."
    ) {
      segmentName += path[currentIndex];
      currentIndex++;
    }

    if (segmentName === "") {
      return err(createError(
        { kind: "ParseError", input: path },
        `Empty property name at position ${startIndex}`,
      ));
    }

    // Check if this is followed by an array index
    if (currentIndex < path.length && path[currentIndex] === "[") {
      // First, add the property segment
      const propertySegment: PathSegment = {
        kind: "property",
        value: segmentName,
      };

      // Now parse the array index
      const indexResult = this.parseArrayIndex(path, currentIndex);
      if (!indexResult.ok) {
        return indexResult;
      }

      // For array access, we need to return both the property and the index
      // But since we can only return one segment at a time, we'll return the property
      // and let the caller handle the array index on the next iteration
      return ok({ segment: propertySegment, nextIndex: currentIndex });
    }

    // Just a regular property segment
    return ok({
      segment: { kind: "property", value: segmentName },
      nextIndex: currentIndex,
    });
  }

  /**
   * Parses an array index from the current position
   * @param path - The complete path string
   * @param startIndex - Position of the '[' character
   * @returns Result containing the array index segment and next position
   */
  private parseArrayIndex(
    path: string,
    startIndex: number,
  ): Result<
    { segment: PathSegment; nextIndex: number },
    ValidationError & { message: string }
  > {
    if (path[startIndex] !== "[") {
      return err(createError(
        { kind: "ParseError", input: path },
        `Expected '[' at position ${startIndex}`,
      ));
    }

    let currentIndex = startIndex + 1; // Skip the '['
    let indexStr = "";

    // Parse the index number
    while (currentIndex < path.length && path[currentIndex] !== "]") {
      const char = path[currentIndex];
      if (char >= "0" && char <= "9") {
        indexStr += char;
        currentIndex++;
      } else {
        return err(createError(
          { kind: "ParseError", input: path },
          `Invalid character in array index: '${char}' at position ${currentIndex}`,
        ));
      }
    }

    if (currentIndex >= path.length || path[currentIndex] !== "]") {
      return err(createError(
        { kind: "ParseError", input: path },
        "Unterminated array index - missing ']'",
      ));
    }

    if (indexStr === "") {
      return err(createError(
        { kind: "ParseError", input: path },
        "Empty array index",
      ));
    }

    const index = parseInt(indexStr, 10);
    if (isNaN(index) || index < 0) {
      return err(createError(
        { kind: "ParseError", input: path },
        `Invalid array index: ${indexStr}`,
      ));
    }

    currentIndex++; // Skip the ']'

    return ok({
      segment: { kind: "arrayIndex", value: index },
      nextIndex: currentIndex,
    });
  }

  /**
   * Enhanced path parsing that properly handles array notation
   * This is the main entry point that handles complex paths correctly
   */
  parseComplex(
    path: string,
  ): Result<PathSegment[], ValidationError & { message: string }> {
    if (!path || path.trim() === "") {
      return err(createError(
        { kind: "EmptyInput" },
        "Path cannot be empty",
      ));
    }

    const trimmedPath = path.trim();

    try {
      const segments: PathSegment[] = [];

      // First, validate for invalid patterns
      if (/\[[^\d\]]*[^\d\]]+\]/.test(trimmedPath)) {
        return err(createError(
          { kind: "ParseError", input: path },
          "Invalid characters in array index",
        ));
      }

      if (/\[-\d+\]/.test(trimmedPath)) {
        return err(createError(
          { kind: "ParseError", input: path },
          "Negative array indices are not supported",
        ));
      }

      // Use regex to split the path into meaningful parts
      // This regex captures:
      // - Property names (word characters)
      // - Array indices [number]
      // - Dots (separators)
      const pathRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)|(\[[0-9]+\])/g;
      let match;

      while ((match = pathRegex.exec(trimmedPath)) !== null) {
        if (match[1]) {
          // Property name
          segments.push({ kind: "property", value: match[1] });
        } else if (match[2]) {
          // Array index [n]
          const indexStr = match[2].slice(1, -1); // Remove [ and ]
          const index = parseInt(indexStr, 10);
          if (isNaN(index) || index < 0) {
            return err(createError(
              { kind: "ParseError", input: path },
              `Invalid array index: ${indexStr}`,
            ));
          }
          segments.push({ kind: "arrayIndex", value: index });
        }
      }

      if (segments.length === 0) {
        return err(createError(
          { kind: "ParseError", input: path },
          "No valid segments found in path",
        ));
      }

      return ok(segments);
    } catch (error) {
      return err(createError(
        { kind: "ParseError", input: path },
        error instanceof Error
          ? `Path parsing failed: ${error.message}`
          : "Path parsing failed",
      ));
    }
  }
}
