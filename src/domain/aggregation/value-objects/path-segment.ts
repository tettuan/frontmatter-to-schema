import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

/**
 * Value object representing a single segment of a property path.
 * Eliminates nullable checks and unsafe type assertions in path evaluation.
 */
export class PathSegment {
  private constructor(private readonly segment: string) {}

  static create(
    segment: string,
  ): Result<PathSegment, DomainError & { message: string }> {
    if (typeof segment !== "string") {
      return ErrorHandler.validation({
        operation: "create",
        method: "validateSegmentType",
      }).invalidType("string", typeof segment);
    }

    if (segment.trim().length === 0) {
      return ErrorHandler.validation({
        operation: "create",
        method: "validateSegmentNotEmpty",
      }).emptyInput();
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
  extractFrom(
    target: unknown,
  ): Result<unknown, DomainError & { message: string }> {
    if (target === null || target === undefined) {
      return ErrorHandler.aggregation({
        operation: "extractFrom",
        method: "validateTarget",
      }).pathNotFound(this.segment);
    }

    // Handle array notation
    if (this.isArrayNotation()) {
      if (Array.isArray(target)) {
        return ok(target);
      }
      return ErrorHandler.aggregation({
        operation: "extractFrom",
        method: "validateArrayNotation",
      }).pathNotFound(this.segment);
    }

    // Handle object property access
    if (!this.isValidObjectForPropertyAccess(target)) {
      return ErrorHandler.aggregation({
        operation: "extractFrom",
        method: "validateObjectType",
      }).pathNotFound(this.segment);
    }

    const objectResult = SafePropertyAccess.asRecord(target);
    if (!objectResult.ok) {
      return ErrorHandler.aggregation({
        operation: "extractFrom",
        method: "validateObjectRecord",
      }).pathNotFound(this.segment);
    }

    const valueResult = SafePropertyAccess.getProperty(
      objectResult.data,
      this.segment,
    );
    if (!valueResult.ok) {
      return ErrorHandler.aggregation({
        operation: "extractFrom",
        method: "accessProperty",
      }).pathNotFound(this.segment);
    }

    return ok(valueResult.data);
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
