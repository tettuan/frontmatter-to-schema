import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";

/**
 * Value object representing a single segment of a property path.
 * Eliminates nullable checks and unsafe type assertions in path evaluation.
 */
export class PathSegment {
  private constructor(private readonly segment: string) {}

  static create(segment: string): Result<PathSegment, DomainError & { message: string }> {
    if (typeof segment !== "string") {
      return err(createError({
        kind: "InvalidType",
        expected: "string",
        actual: typeof segment,
      }, "Path segment must be a string"));
    }

    if (segment.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
      }, "Path segment cannot be empty"));
    }

    return ok(new PathSegment(segment.trim()));
  }

  getValue(): string {
    return this.segment;
  }

  isArrayNotation(): boolean {
    return this.segment === "[]";
  }

  /**
   * Safely extract property from an object, returning Result instead of undefined.
   */
  extractFrom(target: unknown): Result<unknown, DomainError & { message: string }> {
    if (target === null || target === undefined) {
      return err(createError({
        kind: "PathNotFound",
        path: this.segment,
        message: `Cannot access property '${this.segment}' on null or undefined`,
      }));
    }

    // Handle array notation
    if (this.isArrayNotation()) {
      if (Array.isArray(target)) {
        return ok(target);
      }
      return err(createError({
        kind: "PathNotFound",
        path: this.segment,
        message: `Expected array for '[]' notation, got ${typeof target}`,
      }));
    }

    // Handle object property access
    if (!this.isValidObjectForPropertyAccess(target)) {
      return err(createError({
        kind: "PathNotFound",
        path: this.segment,
        message: `Cannot access property '${this.segment}' on ${typeof target}`,
      }));
    }

    const objectTarget = target as Record<string, unknown>;
    const value = objectTarget[this.segment];

    return ok(value);
  }

  private isValidObjectForPropertyAccess(value: unknown): boolean {
    return typeof value === "object" &&
           value !== null &&
           !Array.isArray(value);
  }

  toString(): string {
    return this.segment;
  }
}