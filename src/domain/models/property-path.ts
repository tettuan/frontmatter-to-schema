/**
 * PropertyPath Value Object - Smart Constructor Pattern
 *
 * Implements totality principle by eliminating unsafe path operations
 * and providing explicit error handling for all path navigation scenarios.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Path Navigation Result - Discriminated Union following Totality principle
 */
export type PathNavigationResult =
  | { kind: "Success"; value: unknown }
  | { kind: "PathNotFound"; missingSegment: string; availableKeys: string[] }
  | {
    kind: "TypeMismatch";
    expectedType: "object";
    actualType: string;
    segment: string;
  };

/**
 * Path Assignment Result - Discriminated Union following Totality principle
 */
export type PathAssignmentResult =
  | { kind: "Success" }
  | { kind: "PathCreated"; createdSegments: string[] }
  | { kind: "TypeConflict"; conflictSegment: string; existingType: string };

/**
 * PropertyPath Value Object with Smart Constructor
 * Ensures path validity and provides safe navigation operations
 */
export class PropertyPath {
  private constructor(
    private readonly segments: string[],
    private readonly originalPath: string,
  ) {}

  /**
   * Smart Constructor - validates path format and creates safe PropertyPath
   */
  static create(
    path: string,
  ): Result<PropertyPath, DomainError & { message: string }> {
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "path",
        }, "Path cannot be empty"),
      };
    }

    const trimmedPath = path.trim();

    // Validate path format - no leading/trailing dots, no empty segments
    if (trimmedPath.startsWith(".") || trimmedPath.endsWith(".")) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: trimmedPath,
          expectedFormat: "dotted.property.path",
        }, "Path cannot start or end with dots"),
      };
    }

    // Split path and validate segments
    const segments = trimmedPath.split(".");
    const invalidSegments = segments.filter((segment) =>
      segment.trim() === "" || /[^\w\-_]/.test(segment)
    );

    if (invalidSegments.length > 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: trimmedPath,
          expectedFormat: "alphanumeric_segments",
        }, `Invalid path segments: ${invalidSegments.join(", ")}`),
      };
    }

    return {
      ok: true,
      data: new PropertyPath(segments, trimmedPath),
    };
  }

  /**
   * Get path segments
   */
  getSegments(): string[] {
    return [...this.segments];
  }

  /**
   * Get original path string
   */
  getPath(): string {
    return this.originalPath;
  }

  /**
   * Get the final segment (property name)
   */
  getFinalSegment(): string {
    return this.segments[this.segments.length - 1];
  }

  /**
   * Get parent path (all segments except the last one)
   */
  getParentPath(): PropertyPath | null {
    if (this.segments.length <= 1) {
      return null;
    }

    const parentSegments = this.segments.slice(0, -1);
    return new PropertyPath(parentSegments, parentSegments.join("."));
  }

  /**
   * Check if this path is a parent of another path
   */
  isParentOf(other: PropertyPath): boolean {
    if (this.segments.length >= other.segments.length) {
      return false;
    }

    return this.segments.every((segment, index) =>
      segment === other.segments[index]
    );
  }

  /**
   * Get depth of the path (number of segments)
   */
  getDepth(): number {
    return this.segments.length;
  }

  /**
   * Compare paths for equality
   */
  equals(other: PropertyPath): boolean {
    return this.originalPath === other.originalPath;
  }
}

/**
 * PropertyPathNavigator Domain Service
 *
 * Provides safe navigation and assignment operations for object properties
 * following totality principles with explicit error handling
 */
export class PropertyPathNavigator {
  private constructor() {}

  /**
   * Smart Constructor for PropertyPathNavigator
   */
  static create(): Result<
    PropertyPathNavigator,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new PropertyPathNavigator(),
    };
  }

  /**
   * Navigate to a property following the given path
   * Returns the value or explicit error information
   */
  navigate(
    obj: Record<string, unknown>,
    path: PropertyPath,
  ): Result<PathNavigationResult, DomainError & { message: string }> {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof obj,
          expectedFormat: "object",
        }, "Target must be a valid object"),
      };
    }

    const segments = path.getSegments();
    let current: unknown = obj;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Check if current is an object
      if (
        typeof current !== "object" || current === null ||
        Array.isArray(current)
      ) {
        return {
          ok: true,
          data: {
            kind: "TypeMismatch",
            expectedType: "object",
            actualType: typeof current,
            segment,
          },
        };
      }

      const currentObj = current as Record<string, unknown>;

      // Check if property exists
      if (!(segment in currentObj)) {
        return {
          ok: true,
          data: {
            kind: "PathNotFound",
            missingSegment: segment,
            availableKeys: Object.keys(currentObj),
          },
        };
      }

      current = currentObj[segment];
    }

    return {
      ok: true,
      data: {
        kind: "Success",
        value: current,
      },
    };
  }

  /**
   * Safely assign a value to a property path
   * Creates intermediate objects as needed with explicit tracking
   */
  assign(
    obj: Record<string, unknown>,
    path: PropertyPath,
    value: unknown,
  ): Result<PathAssignmentResult, DomainError & { message: string }> {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof obj,
          expectedFormat: "object",
        }, "Target must be a valid object"),
      };
    }

    const segments = path.getSegments();
    const createdSegments: string[] = [];
    let current: Record<string, unknown> = obj;

    // Navigate to parent, creating objects as needed
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];

      if (!(segment in current)) {
        // Create new object
        current[segment] = {};
        createdSegments.push(segment);
      } else {
        // Check if existing value is compatible
        const existing = current[segment];
        if (
          typeof existing !== "object" || existing === null ||
          Array.isArray(existing)
        ) {
          return {
            ok: true,
            data: {
              kind: "TypeConflict",
              conflictSegment: segment,
              existingType: typeof existing,
            },
          };
        }
      }

      current = current[segment] as Record<string, unknown>;
    }

    // Set final value
    const finalSegment = path.getFinalSegment();
    current[finalSegment] = value;

    if (createdSegments.length > 0) {
      return {
        ok: true,
        data: {
          kind: "PathCreated",
          createdSegments,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "Success",
      },
    };
  }

  /**
   * Check if a path exists in an object
   */
  pathExists(
    obj: Record<string, unknown>,
    path: PropertyPath,
  ): Result<boolean, DomainError & { message: string }> {
    const navigationResult = this.navigate(obj, path);

    if (!navigationResult.ok) {
      return navigationResult;
    }

    return {
      ok: true,
      data: navigationResult.data.kind === "Success",
    };
  }

  /**
   * Get type information for a path
   */
  getPathType(
    obj: Record<string, unknown>,
    path: PropertyPath,
  ): Result<string | null, DomainError & { message: string }> {
    const navigationResult = this.navigate(obj, path);

    if (!navigationResult.ok) {
      return navigationResult;
    }

    if (navigationResult.data.kind === "Success") {
      return {
        ok: true,
        data: typeof navigationResult.data.value,
      };
    }

    return {
      ok: true,
      data: null,
    };
  }
}

/**
 * Type guards for discriminated union results
 */
export function isNavigationSuccess(
  result: PathNavigationResult,
): result is { kind: "Success"; value: unknown } {
  return result.kind === "Success";
}

export function isPathNotFound(
  result: PathNavigationResult,
): result is {
  kind: "PathNotFound";
  missingSegment: string;
  availableKeys: string[];
} {
  return result.kind === "PathNotFound";
}

export function isTypeMismatch(
  result: PathNavigationResult,
): result is {
  kind: "TypeMismatch";
  expectedType: "object";
  actualType: string;
  segment: string;
} {
  return result.kind === "TypeMismatch";
}

export function isAssignmentSuccess(
  result: PathAssignmentResult,
): result is { kind: "Success" } {
  return result.kind === "Success";
}

export function isPathCreated(
  result: PathAssignmentResult,
): result is { kind: "PathCreated"; createdSegments: string[] } {
  return result.kind === "PathCreated";
}

export function isTypeConflict(
  result: PathAssignmentResult,
): result is {
  kind: "TypeConflict";
  conflictSegment: string;
  existingType: string;
} {
  return result.kind === "TypeConflict";
}
