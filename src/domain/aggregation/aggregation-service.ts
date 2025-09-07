/**
 * Aggregation Service
 *
 * Domain service for aggregating data from multiple documents
 * and applying derivation rules.
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

/**
 * Service for executing aggregation processes
 */
export class AggregationService {
  constructor(
    private readonly evaluator: ExpressionEvaluator,
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
          if (rule.shouldFlatten() && Array.isArray(values)) {
            // Flatten nested arrays
            for (const val of values) {
              if (Array.isArray(val)) {
                allValues.push(...val);
              } else {
                allValues.push(val);
              }
            }
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

    // Create metadata
    const metadata: AggregationMetadata = {
      processedCount: items.length,
      aggregatedAt: new Date(),
      appliedRules: context.getRules().map((r) => r.getTargetField()),
      warnings: warnings.length > 0 ? warnings : undefined,
      statistics,
    };

    return AggregatedResult.create(aggregated, metadata);
  }

  /**
   * Extract derivation rules from a schema
   */
  extractRulesFromSchema(
    schema: Record<string, unknown>,
  ): Result<DerivationRule[], { kind: string; message: string }> {
    const rules: DerivationRule[] = [];
    const errors: string[] = [];

    const processProperties = (
      properties: Record<string, unknown>,
      prefix = "",
    ): void => {
      for (const [key, value] of Object.entries(properties)) {
        if (!value || typeof value !== "object") continue;

        const fieldName = prefix ? `${prefix}.${key}` : key;
        const property = value as Record<string, unknown>;

        // Check for x-derived-from
        const ruleResult = DerivationRule.fromSchemaProperty(
          fieldName,
          property,
        );
        if (!ruleResult.ok) {
          errors.push(`${fieldName}: ${ruleResult.error.message}`);
        } else if (ruleResult.data) {
          rules.push(ruleResult.data);
        }

        // Recursively process nested properties
        if (property.properties && typeof property.properties === "object") {
          processProperties(
            property.properties as Record<string, unknown>,
            fieldName,
          );
        }

        // Process array items
        if (property.items && typeof property.items === "object") {
          const items = property.items as Record<string, unknown>;
          if (items.properties && typeof items.properties === "object") {
            processProperties(
              items.properties as Record<string, unknown>,
              `${fieldName}[]`,
            );
          }
        }
      }
    };

    // Start processing from root properties
    if (schema.properties && typeof schema.properties === "object") {
      processProperties(schema.properties as Record<string, unknown>);
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
        if (typeof current === "object" && current !== null) {
          const obj = current as Record<string, unknown>;
          if (!(part in obj)) {
            obj[part] = {};
          }
          current = obj[part];
        }
      }

      // Set the value
      const lastPart = parts[parts.length - 1];
      if (typeof current === "object" && current !== null) {
        (current as Record<string, unknown>)[lastPart] = value;
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
 */
export function createAggregationService(
  evaluator?: ExpressionEvaluator,
): AggregationService {
  return new AggregationService(
    evaluator || new ExpressionEvaluator(),
  );
}
