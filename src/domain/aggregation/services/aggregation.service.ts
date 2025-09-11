/**
 * Aggregation Service
 *
 * Handles field aggregation across multiple documents with support
 * for x-derived-from, x-derived-unique, and other aggregation patterns.
 * Follows DDD principles with robust error handling.
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { SchemaExtensions } from "../../schema/value-objects/schema-extensions.ts";

export interface AggregationOptions {
  unique?: boolean;
  flatten?: boolean;
  sort?: boolean;
}

export interface AggregationRequest {
  documents: Array<Record<string, unknown>>;
  schema: Record<string, unknown>;
  targetField: string;
  sourceField: string;
  options?: AggregationOptions;
}

export class AggregationService {
  /**
   * Aggregate values from multiple documents based on schema configuration
   */
  aggregate(
    request: AggregationRequest,
  ): Result<Record<string, unknown>, DomainError> {
    const { documents, schema, targetField, sourceField, options = {} } =
      request;

    // Validate schema structure
    const properties = schema.properties as Record<string, unknown>;
    if (!properties || !properties[targetField]) {
      return {
        ok: false,
        error: {
          kind: "NotFound",
          resource: "schema property",
          name: targetField,
        } as DomainError,
      };
    }

    // Collect values from all documents
    const collectedValues: unknown[] = [];

    for (const doc of documents) {
      const value = this.extractValue(doc, sourceField);
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Always flatten arrays when collecting from multiple documents
          collectedValues.push(...value);
        } else {
          collectedValues.push(value);
        }
      }
    }

    // Apply aggregation options
    let processedValues = collectedValues;

    if (options.unique) {
      processedValues = this.deduplicateValues(processedValues);
    }

    if (options.sort) {
      processedValues = this.sortValues(processedValues);
    }

    // Return aggregated result
    const result: Record<string, unknown> = {
      [targetField]: processedValues,
    };

    return { ok: true, data: result };
  }

  /**
   * Extract value from document using field path
   */
  private extractValue(
    document: Record<string, unknown>,
    fieldPath: string,
  ): unknown {
    const parts = fieldPath.split(".");
    let current: unknown = document;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Remove duplicate values from array
   */
  private deduplicateValues(values: unknown[]): unknown[] {
    const seen = new Set<string>();
    const unique: unknown[] = [];

    for (const value of values) {
      const key = this.getValueKey(value);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    }

    return unique;
  }

  /**
   * Get string key for value (for deduplication)
   */
  private getValueKey(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Sort values array
   */
  private sortValues(values: unknown[]): unknown[] {
    return [...values].sort((a, b) => {
      const aStr = this.getValueKey(a);
      const bStr = this.getValueKey(b);
      return aStr.localeCompare(bStr);
    });
  }

  /**
   * Process schema-driven aggregation
   */
  processSchemaAggregation(
    documents: Array<Record<string, unknown>>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError> {
    const aggregatedData: Record<string, unknown> = {};
    const properties = schema.properties as Record<string, unknown> || {};

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const field = fieldSchema as Record<string, unknown>;
      const xDerivedFrom = field[SchemaExtensions.DERIVED_FROM] as string;

      if (xDerivedFrom) {
        const xDerivedUnique =
          field[SchemaExtensions.DERIVED_UNIQUE] as boolean;

        const aggregationResult = this.aggregate({
          documents,
          schema,
          targetField: fieldName,
          sourceField: xDerivedFrom,
          options: {
            unique: xDerivedUnique || false,
            flatten: true,
            sort: false,
          },
        });

        if (!aggregationResult.ok) {
          return aggregationResult;
        }

        Object.assign(aggregatedData, aggregationResult.data);
      }
    }

    return { ok: true, data: aggregatedData };
  }

  /**
   * Merge multiple aggregation results
   */
  mergeAggregations(
    aggregations: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const aggregation of aggregations) {
      for (const [key, value] of Object.entries(aggregation)) {
        if (Array.isArray(merged[key]) && Array.isArray(value)) {
          // Merge arrays
          (merged[key] as unknown[]).push(...value);
        } else {
          // Overwrite or set value
          merged[key] = value;
        }
      }
    }

    return merged;
  }
}
