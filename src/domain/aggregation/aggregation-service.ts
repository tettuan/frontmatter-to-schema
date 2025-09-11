/**
 * Aggregation Service
 *
 * Domain service for aggregating data from multiple documents
 * and applying derivation rules.
 * REFACTORED: Eliminates hardcoding violations by using SchemaExtensionRegistry
 */

import type { Result } from "../core/result.ts";
import {
  AggregatedResult,
  type AggregationContext,
  type AggregationMetadata,
  type AggregationStatistics,
  DerivationRule,
} from "./value-objects.ts";
import { ExpressionEvaluator } from "./expression-evaluator.ts";
import type { SchemaExtensionRegistry } from "../schema/entities/schema-extension-registry.ts";

/**
 * Type guard for validating unknown data as Record<string, unknown>
 * Eliminates type assertions following Totality principles
 */
function isValidRecordData(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" &&
    data !== null &&
    !Array.isArray(data);
}

/**
 * Service for executing aggregation processes
 */
export class AggregationService {
  constructor(
    private readonly evaluator: ExpressionEvaluator,
    private readonly registry: SchemaExtensionRegistry,
  ) {}

  /**
   * Execute aggregation with derivation rules
   */
  aggregate(
    items: unknown[],
    context: AggregationContext,
  ): Result<AggregatedResult, { kind: string; message: string }> {
    const aggregated: Record<string, unknown> = {};
    const warnings: string[] = [];
    const statistics: AggregationStatistics = {
      totalItems: items.length,
      uniqueValues: {},
      nullCount: {},
      arrayLengths: {},
    };

    // Process each derivation rule
    for (const rule of context.getRules()) {
      const targetField = rule.getTargetField();
      const sourceExpression = rule.getSourceExpression();

      // Collect values from all items
      const allValues: unknown[] = [];

      for (const item of items) {
        const evalResult = this.evaluator.evaluate(item, sourceExpression);

        if (evalResult.ok) {
          const values = evalResult.data;
          if (rule.shouldFlatten()) {
            // Deep flatten nested arrays recursively
            const flatten = (arr: unknown[]): unknown[] => {
              const result: unknown[] = [];
              for (const val of arr) {
                if (Array.isArray(val)) {
                  result.push(...flatten(val));
                } else {
                  result.push(val);
                }
              }
              return result;
            };
            allValues.push(...flatten(values));
          } else {
            allValues.push(...values);
          }
        } else {
          warnings.push(
            `Failed to evaluate "${sourceExpression}" for field "${targetField}": ${evalResult.error.message}`,
          );
        }
      }

      // Filter out null/undefined based on options
      const filtered = this.filterValues(allValues, context.getOptions());

      // Apply uniqueness if required
      let finalValues: unknown[] = filtered;
      if (rule.isUnique()) {
        finalValues = this.getUniqueValues(filtered);
        statistics.uniqueValues[targetField] = finalValues.length;
      }

      // Collect statistics
      statistics.nullCount[targetField] = allValues.filter((v) =>
        v == null
      ).length;
      if (finalValues.length > 0 && Array.isArray(finalValues[0])) {
        statistics.arrayLengths[targetField] = finalValues.map((v) =>
          Array.isArray(v) ? v.length : 0
        );
      }

      aggregated[targetField] = finalValues;
    }

    // Create metadata using Totality principles
    const hasStatistics = Object.keys(statistics.uniqueValues).length > 0 ||
      Object.keys(statistics.arrayLengths).length > 0;

    const metadata: AggregationMetadata = (() => {
      const baseData = {
        processedCount: items.length,
        aggregatedAt: new Date(),
        appliedRules: context.getRules().map((r) => r.getTargetField()),
      };

      if (hasStatistics && warnings.length > 0) {
        return {
          ...baseData,
          kind: "WithStatistics" as const,
          warnings,
          statistics,
        };
      } else if (warnings.length > 0) {
        return {
          ...baseData,
          kind: "WithWarnings" as const,
          warnings,
          statistics: null,
        };
      } else if (hasStatistics) {
        return {
          ...baseData,
          kind: "WithStatistics" as const,
          warnings: [],
          statistics,
        };
      } else {
        return {
          ...baseData,
          kind: "Basic" as const,
          warnings: null,
          statistics: null,
        };
      }
    })();

    return AggregatedResult.create(aggregated, metadata);
  }

  /**
   * Extract derivation rules from a schema
   */
  extractRulesFromSchema(
    schema: Record<string, unknown>,
  ): Result<DerivationRule[], { kind: string; message: string }> {
    // Handle null or invalid schema gracefully
    if (!schema || typeof schema !== "object") {
      return {
        ok: true,
        data: [],
      };
    }

    const rules: DerivationRule[] = [];
    const errors: string[] = [];

    const processProperties = (
      properties: Record<string, unknown>,
      prefix = "",
    ): void => {
      for (const [key, value] of Object.entries(properties)) {
        if (!isValidRecordData(value)) continue;

        const fieldName = prefix ? `${prefix}.${key}` : key;
        const property = value;

        // Use registry to check for derived extensions
        const ruleResult = DerivationRule.fromSchemaProperty(
          fieldName,
          property,
          this.registry,
        );
        if (!ruleResult.ok) {
          errors.push(`${fieldName}: ${ruleResult.error.message}`);
        } else if (ruleResult.data) {
          rules.push(ruleResult.data);
        }

        // Recursively process nested properties
        if (property.properties && isValidRecordData(property.properties)) {
          processProperties(
            property.properties,
            fieldName,
          );
        }

        // Process array items
        if (property.items && isValidRecordData(property.items)) {
          const items = property.items;
          if (items.properties && isValidRecordData(items.properties)) {
            processProperties(
              items.properties,
              `${fieldName}[]`,
            );
          }
        }
      }
    };

    // Start processing from root properties
    if (schema.properties && isValidRecordData(schema.properties)) {
      processProperties(schema.properties);
    }

    if (errors.length > 0) {
      return {
        ok: false,
        error: {
          kind: "SchemaExtractionError",
          message: `Failed to extract rules: ${errors.join(", ")}`,
        },
      };
    }

    return { ok: true, data: rules };
  }

  /**
   * Apply aggregated data to a base object
   */
  applyAggregatedData(
    base: Record<string, unknown>,
    aggregated: AggregatedResult,
  ): Record<string, unknown> {
    const result = { ...base };
    const data = aggregated.getData();

    for (const [key, value] of Object.entries(data)) {
      // Navigate to the target location
      const parts = key.split(".");
      let current: unknown = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (isValidRecordData(current)) {
          if (!(part in current)) {
            current[part] = {};
          }
          current = current[part];
        }
      }

      // Set the value
      const lastPart = parts[parts.length - 1];
      if (isValidRecordData(current)) {
        current[lastPart] = value;
      }
    }

    return result;
  }

  /**
   * Filter values based on aggregation options
   */
  private filterValues(
    values: unknown[],
    options: { skipNull: boolean; skipUndefined: boolean },
  ): unknown[] {
    return values.filter((value) => {
      if (options.skipNull && value === null) return false;
      if (options.skipUndefined && value === undefined) return false;
      return true;
    });
  }

  /**
   * Get unique values from an array
   */
  private getUniqueValues(values: unknown[]): unknown[] {
    const seen = new Set<string>();
    const unique: unknown[] = [];

    for (const value of values) {
      const key = this.getUniqueKey(value);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    }

    return unique;
  }

  /**
   * Generate a unique key for value comparison
   */
  private getUniqueKey(value: unknown): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return "[object]";
      }
    }
    return String(value);
  }
}

/**
 * Factory function to create an aggregation service
 * REFACTORED: Now requires registry dependency to eliminate hardcoding
 */
export function createAggregationService(
  registry: SchemaExtensionRegistry,
  evaluator?: ExpressionEvaluator,
): AggregationService {
  return new AggregationService(
    evaluator || new ExpressionEvaluator(),
    registry,
  );
}
