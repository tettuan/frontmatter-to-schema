/**
 * @fileoverview x-derived-unique Directive Handler
 * @description Handles removal of duplicate values from arrays
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../entities/schema.ts";
import {
  BaseDirectiveHandler,
  DirectiveConfig,
  DirectiveHandlerError,
  DirectiveHandlerFactory,
  DirectiveProcessingResult,
  LegacySchemaProperty,
} from "../interfaces/directive-handler.ts";

/**
 * Configuration for x-derived-unique directive
 */
interface DerivedUniqueConfig {
  enabled: boolean;
}

/**
 * Metadata for unique processing
 */
interface DerivedUniqueMetadata {
  originalCount: number;
  uniqueCount: number;
  duplicatesRemoved: number;
}

/**
 * Handler for x-derived-unique directive
 * Removes duplicate values from arrays after aggregation
 */
export class DerivedUniqueDirectiveHandler extends BaseDirectiveHandler<
  DerivedUniqueConfig,
  DerivedUniqueMetadata
> {
  constructor() {
    super("x-derived-unique", 31, ["x-derived-from"]); // Priority 31 - processes after x-derived-from
  }

  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<DerivedUniqueConfig>, DirectiveHandlerError> {
    const derivedUnique = schema["x-derived-unique"];

    if (derivedUnique === undefined) {
      return DirectiveHandlerFactory.createConfig(
        this.directiveName,
        { enabled: false },
        false,
      );
    }

    if (typeof derivedUnique !== "boolean") {
      return err({
        kind: "ValidationError",
        directiveName: this.directiveName,
        message: "x-derived-unique must be a boolean",
        invalidValue: derivedUnique,
      });
    }

    return DirectiveHandlerFactory.createConfig(
      this.directiveName,
      { enabled: derivedUnique },
      true,
    );
  }

  processData(
    data: FrontmatterData,
    config: DirectiveConfig<DerivedUniqueConfig>,
    _schema: Schema,
  ): Result<
    DirectiveProcessingResult<DerivedUniqueMetadata>,
    DirectiveHandlerError
  > {
    if (!config.isPresent || !config.configuration.enabled) {
      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        data,
        {
          originalCount: 0,
          uniqueCount: 0,
          duplicatesRemoved: 0,
        },
      );
    }

    const processedDataMap = new Map<string, unknown>();
    let totalOriginal = 0;
    let totalUnique = 0;
    let totalDuplicates = 0;

    // Process each entry in the frontmatter data
    for (const [key, value] of Object.entries(data.getData())) {
      if (Array.isArray(value)) {
        // Remove duplicates from array
        const uniqueValues = this.getUniqueValues(value);
        processedDataMap.set(key, uniqueValues);

        totalOriginal += value.length;
        totalUnique += uniqueValues.length;
        totalDuplicates += value.length - uniqueValues.length;
      } else {
        // Non-array values pass through unchanged
        processedDataMap.set(key, value);
      }
    }

    // Create new FrontmatterData with unique values
    const processedDataResult = FrontmatterData.create(
      Object.fromEntries(processedDataMap),
    );

    if (!processedDataResult.ok) {
      return err({
        kind: "ProcessingError",
        directiveName: this.directiveName,
        message: "Failed to create processed frontmatter data",
        cause: processedDataResult.error,
      });
    }

    return DirectiveHandlerFactory.createResult(
      this.directiveName,
      processedDataResult.data,
      {
        originalCount: totalOriginal,
        uniqueCount: totalUnique,
        duplicatesRemoved: totalDuplicates,
      },
    );
  }

  extractExtension(
    schema: LegacySchemaProperty,
  ): Result<{ key: string; value: unknown } | null, DirectiveHandlerError> {
    const derivedUnique = schema["x-derived-unique"];

    if (derivedUnique === undefined) {
      return ok(null);
    }

    return ok({
      key: "x-derived-unique",
      value: derivedUnique,
    });
  }

  /**
   * Get unique values from an array
   * Preserves order of first occurrence
   */
  private getUniqueValues(array: unknown[]): unknown[] {
    const seen = new Set<string>();
    const unique: unknown[] = [];

    for (const item of array) {
      // Create a string key for comparison
      const key = this.createKey(item);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }

    return unique;
  }

  /**
   * Create a unique key for value comparison
   * Handles primitives and objects
   */
  private createKey(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";

    const type = typeof value;

    if (type === "object") {
      // For objects and arrays, use JSON stringification
      try {
        return JSON.stringify(value);
      } catch {
        // Fallback for circular references
        return String(value);
      }
    }

    // For primitives, use string representation
    return String(value);
  }
}
