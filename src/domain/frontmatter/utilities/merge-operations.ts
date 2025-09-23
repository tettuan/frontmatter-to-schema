/**
 * @fileoverview Merge Operations Utilities
 * @description Utilities for deep merging objects and frontmatter data
 * Following Totality principles with proper error handling
 */

import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { FrontmatterDataCreationService } from "../services/frontmatter-data-creation-service.ts";

/**
 * Utilities for merge operations following Totality principles
 */
export class MergeOperations {
  constructor(
    private readonly frontmatterDataCreationService:
      FrontmatterDataCreationService,
  ) {}

  /**
   * Deep merge two FrontmatterData objects
   */
  deepMerge(
    baseData: FrontmatterData,
    derivedData: FrontmatterData,
  ): Result<FrontmatterData, DomainError> {
    const baseObj = baseData.getData();
    const derivedObj = derivedData.getData();

    const mergedObj = this.deepMergeObjects(baseObj, derivedObj);
    const mergedResult = this.frontmatterDataCreationService.createFromRaw(
      mergedObj,
    );

    if (!mergedResult.ok) {
      return ErrorHandler.aggregation({
        operation: "deepMerge",
        method: "createMergedData",
      }).mergeFailed(`Deep merge failed: ${mergedResult.error.message}`);
    }

    return ok(mergedResult.data);
  }

  /**
   * Deep merge two objects recursively
   */
  deepMergeObjects(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === "object" &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof result[key] === "object" &&
          result[key] !== null &&
          !Array.isArray(result[key])
        ) {
          // Both are objects - merge recursively
          const resultValueResult = SafePropertyAccess.asRecord(result[key]);
          const sourceValueResult = SafePropertyAccess.asRecord(source[key]);

          if (resultValueResult.ok && sourceValueResult.ok) {
            result[key] = this.deepMergeObjects(
              resultValueResult.data,
              sourceValueResult.data,
            );
          } else {
            // Fallback to source value if type conversion fails
            result[key] = source[key];
          }
        } else {
          // Replace value (for arrays, primitives, or when target is not object)
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Fallback for direct merging when no frontmatter-part schema exists
   * Follows Totality principle with proper error handling
   */
  mergeDataDirectly(
    data: FrontmatterData[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    if (data.length === 0) {
      return ok(FrontmatterData.empty());
    }

    let merged = data[0];
    for (let i = 1; i < data.length; i++) {
      merged = merged.merge(data[i]);
    }
    return ok(merged);
  }

  /**
   * Create FrontmatterData from raw object data
   * Public method to access frontmatter data creation functionality
   */
  createFromRawData(
    rawData: Record<string, unknown>,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    return this.frontmatterDataCreationService.createFromRaw(rawData);
  }
}
