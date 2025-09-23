/**
 * @fileoverview FrontmatterPropertyOperations - Utility service for property manipulation
 * @description Extracted from FrontmatterTransformationService to follow DDD boundaries
 * Following Shared Context responsibilities for utility operations
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

/**
 * FrontmatterPropertyOperations - Utility Service for Property Manipulation
 *
 * Responsibilities:
 * - Nested property extraction from objects
 * - Nested property setting with path notation
 * - Safe property access with error handling
 *
 * Following DDD principles:
 * - Utility service in Shared Context
 * - Stateless operations
 * - Totality: All methods return Result<T,E>
 */
export class FrontmatterPropertyOperations {
  private constructor() {}

  /**
   * Smart Constructor following Totality principles
   * Creates property operations utility service
   */
  static create(): Result<
    FrontmatterPropertyOperations,
    DomainError & { message: string }
  > {
    return ok(new FrontmatterPropertyOperations());
  }

  /**
   * Extract nested property value using dot notation path
   * Follows Totality principles with safe property access
   */
  extractNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): Result<unknown, DomainError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
      }, "Property path cannot be empty"));
    }

    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object") {
        const currentResult = SafePropertyAccess.asRecord(current);
        if (currentResult.ok && part in currentResult.data) {
          current = currentResult.data[part];
        } else {
          return err(createError({
            kind: "PropertyNotFound",
            path: path,
          }, `Property not found at path: ${path}`));
        }
      } else {
        return err(createError({
          kind: "InvalidType",
          expected: "object",
          actual: typeof current,
        }, `Cannot navigate through non-object value at path: ${path}`));
      }
    }

    return ok(current);
  }

  /**
   * Set nested property value using dot notation path
   * Creates intermediate objects as needed
   * Follows Totality principles with comprehensive error handling
   */
  setNestedProperty(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
      }, "Property path cannot be empty"));
    }

    const parts = path.split(".");
    let current = obj;

    // Navigate to the parent of the target property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }

      // Use SafePropertyAccess to eliminate type assertion
      const propertyResult = SafePropertyAccess.asRecord(current[part]);
      if (!propertyResult.ok) {
        // If property is not a record, create a new one
        current[part] = {};
        const newRecordResult = SafePropertyAccess.asRecord(current[part]);
        if (newRecordResult.ok) {
          current = newRecordResult.data;
        } else {
          // This should never happen since we just created an empty object
          // But following Totality principles, we return an error instead of throwing
          return err(createError(
            {
              kind: "PropertyNotFound",
              path: parts.slice(0, i + 1).join("."),
            },
            `Failed to create record for nested property at: ${
              parts.slice(0, i + 1).join(".")
            }`,
          ));
        }
      } else {
        current = propertyResult.data;
      }
    }

    // Set the final property
    const finalProperty = parts[parts.length - 1];
    current[finalProperty] = value;

    return ok(void 0);
  }

  /**
   * Check if nested property exists at given path
   * Safe alternative to direct property access
   */
  hasNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): Result<boolean, DomainError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
      }, "Property path cannot be empty"));
    }

    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object") {
        const currentResult = SafePropertyAccess.asRecord(current);
        if (currentResult.ok && part in currentResult.data) {
          current = currentResult.data[part];
        } else {
          return ok(false);
        }
      } else {
        return ok(false);
      }
    }

    return ok(true);
  }

  /**
   * Get all property paths from an object
   * Useful for debugging and analysis
   */
  getPropertyPaths(
    obj: Record<string, unknown>,
    prefix = "",
  ): Result<string[], DomainError & { message: string }> {
    const paths: string[] = [];

    try {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = prefix ? `${prefix}.${key}` : key;
        paths.push(currentPath);

        if (value && typeof value === "object" && !Array.isArray(value)) {
          const recordResult = SafePropertyAccess.asRecord(value);
          if (recordResult.ok) {
            const nestedPathsResult = this.getPropertyPaths(
              recordResult.data,
              currentPath,
            );
            if (nestedPathsResult.ok) {
              paths.push(...nestedPathsResult.data);
            } else {
              // Continue processing other properties even if one fails
              continue;
            }
          }
        }
      }
    } catch (_error) {
      return err(createError({
        kind: "InvalidFormat",
        format: "object-structure",
        value: "object",
      }, "Failed to extract property paths from object"));
    }

    return ok(paths);
  }

  /**
   * Deep clone object with property filtering
   * Useful for creating clean data structures
   */
  cloneWithProperties(
    obj: Record<string, unknown>,
    includePaths: string[],
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    const result: Record<string, unknown> = {};

    for (const path of includePaths) {
      const valueResult = this.extractNestedProperty(obj, path);
      if (valueResult.ok) {
        const setResult = this.setNestedProperty(
          result,
          path,
          valueResult.data,
        );
        if (!setResult.ok) {
          return setResult;
        }
      }
      // If property doesn't exist, skip it (don't treat as error)
    }

    return ok(result);
  }
}
