/**
 * @fileoverview x-derived-from Directive Handler
 * @description Handles aggregation of values from other properties
 */

import { Result, ok, err } from "../../shared/types/result.ts";
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
 * Configuration for x-derived-from directive
 */
interface DerivedFromConfig {
  sourceProperty: string;
}

/**
 * Metadata for derived values
 */
interface DerivedFromMetadata {
  sourceCount: number;
  uniqueCount?: number;
}

/**
 * Handler for x-derived-from directive
 * Aggregates values from specified source property across all frontmatter data
 */
export class DerivedFromDirectiveHandler extends BaseDirectiveHandler<
  DerivedFromConfig,
  DerivedFromMetadata
> {
  constructor() {
    super("x-derived-from", 30, []); // Priority 30 - processes after basic extraction
  }

  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<DerivedFromConfig>, DirectiveHandlerError> {
    const derivedFrom = schema["x-derived-from"];

    if (!derivedFrom) {
      return DirectiveHandlerFactory.createConfig(
        this.directiveName,
        { sourceProperty: "" },
        false,
      );
    }

    if (typeof derivedFrom !== "string") {
      return err({
        kind: "ValidationError",
        directiveName: this.directiveName,
        message: "x-derived-from must be a string",
        invalidValue: derivedFrom,
      });
    }

    return DirectiveHandlerFactory.createConfig(
      this.directiveName,
      { sourceProperty: derivedFrom },
      true,
    );
  }

  processData(
    data: FrontmatterData,
    config: DirectiveConfig<DerivedFromConfig>,
    _schema: Schema,
  ): Result<DirectiveProcessingResult<DerivedFromMetadata>, DirectiveHandlerError> {
    if (!config.isPresent) {
      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        data,
        { sourceCount: 0 },
      );
    }

    const { sourceProperty } = config.configuration;

    // Get the source values from the frontmatter data
    const sourceValues = this.extractSourceValues(data, sourceProperty);

    // Create new data with aggregated values
    const processedDataMap = new Map(Object.entries(data.getData()));

    // Store aggregated values (could be an array of values from different files)
    if (sourceValues.length > 0) {
      processedDataMap.set(sourceProperty, sourceValues);
    }

    // Create new FrontmatterData with aggregated values
    const processedDataResult = FrontmatterData.create(Object.fromEntries(processedDataMap));

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
        sourceCount: sourceValues.length,
      },
    );
  }

  extractExtension(
    schema: LegacySchemaProperty,
  ): Result<{ key: string; value: unknown } | null, DirectiveHandlerError> {
    const derivedFrom = schema["x-derived-from"];

    if (!derivedFrom) {
      return ok(null);
    }

    return ok({
      key: "x-derived-from",
      value: derivedFrom,
    });
  }

  /**
   * Extract values from source property path
   * Supports nested property access with dot notation
   */
  private extractSourceValues(data: FrontmatterData, sourcePath: string): unknown[] {
    const values: unknown[] = [];
    const dataMap = data.getData();

    // Split path for nested access
    const pathParts = sourcePath.split(".");

    // Iterate through data to find matching values
    for (const [key, value] of Object.entries(dataMap)) {
      if (pathParts[0] === key) {
        if (pathParts.length === 1) {
          // Direct property match
          if (Array.isArray(value)) {
            values.push(...value);
          } else {
            values.push(value);
          }
        } else {
          // Nested property access
          const nestedValue = this.getNestedValue(value, pathParts.slice(1));
          if (nestedValue !== undefined) {
            if (Array.isArray(nestedValue)) {
              values.push(...nestedValue);
            } else {
              values.push(nestedValue);
            }
          }
        }
      }
    }

    return values;
  }

  /**
   * Get nested value from object using path parts
   */
  private getNestedValue(obj: unknown, pathParts: string[]): unknown {
    if (!obj || typeof obj !== "object") {
      return undefined;
    }

    let current: unknown = obj;

    for (const part of pathParts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}