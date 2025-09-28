/**
 * @fileoverview Field Operations Utilities
 * @description Utilities for nested field manipulation using dot notation paths
 * Following Totality principles with proper error handling
 */

import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

/**
 * Utilities for field operations following Totality principles
 */
export class FieldOperations {
  /**
   * Set nested field in object using dot notation path
   * Helper method for applying derived field values to nested structure
   */
  static setNestedField(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }

      // Use SafePropertyAccess to eliminate type assertion
      const propertyResult = SafePropertyAccess.asRecord(current[parts[i]]);
      if (!propertyResult.ok) {
        // If property is not a record, create a new one
        current[parts[i]] = {};
        const newRecordResult = SafePropertyAccess.asRecord(current[parts[i]]);
        if (newRecordResult.ok) {
          current = newRecordResult.data;
        } else {
          // This should never happen since we just created an empty object
          // But following Totality principles, we return an error instead of throwing
          return ErrorHandler.validation({
            operation: "setNestedField",
            method: "createNestedRecord",
          }).invalidStructure(
            path,
            "Failed to create record for nested path after initialization",
          );
        }
      } else {
        current = propertyResult.data;
      }
    }

    current[parts[parts.length - 1]] = value;
    return ok(void 0);
  }

  /**
   * Get nested field value from object using dot notation path
   * Safe property access with proper error handling
   */
  static getNestedField(
    obj: Record<string, unknown>,
    path: string,
  ): Result<unknown, DomainError & { message: string }> {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return ErrorHandler.validation({
          operation: "getNestedField",
          method: "accessProperty",
        }).invalidStructure(
          path,
          `Cannot access property '${part}' on null or undefined`,
        );
      }

      const recordResult = SafePropertyAccess.asRecord(current);
      if (!recordResult.ok) {
        return ErrorHandler.validation({
          operation: "getNestedField",
          method: "accessProperty",
        }).invalidStructure(
          path,
          `Cannot access property '${part}' on non-object value`,
        );
      }

      current = recordResult.data[part];
    }

    return ok(current);
  }

  /**
   * Check if nested field exists in object using dot notation path
   */
  static hasNestedField(
    obj: Record<string, unknown>,
    path: string,
  ): Result<boolean, DomainError & { message: string }> {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return ok(false);
      }

      const recordResult = SafePropertyAccess.asRecord(current);
      if (!recordResult.ok) {
        return ok(false);
      }

      if (!(part in recordResult.data)) {
        return ok(false);
      }

      current = recordResult.data[part];
    }

    return ok(true);
  }

  /**
   * Delete nested field from object using dot notation path
   */
  static deleteNestedField(
    obj: Record<string, unknown>,
    path: string,
  ): Result<boolean, DomainError & { message: string }> {
    const parts = path.split(".");
    if (parts.length === 0) {
      return ok(false);
    }

    if (parts.length === 1) {
      const existed = parts[0] in obj;
      delete obj[parts[0]];
      return ok(existed);
    }

    const parentPath = parts.slice(0, -1).join(".");
    const fieldName = parts[parts.length - 1];

    const parentResult = FieldOperations.getNestedField(obj, parentPath);
    if (!parentResult.ok) {
      return ok(false); // Parent doesn't exist, so field doesn't exist
    }

    const recordResult = SafePropertyAccess.asRecord(parentResult.data);
    if (!recordResult.ok) {
      return ok(false); // Parent is not an object, so field doesn't exist
    }

    const existed = fieldName in recordResult.data;
    delete recordResult.data[fieldName];
    return ok(existed);
  }
}
