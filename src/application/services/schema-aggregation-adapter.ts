/**
 * Schema Aggregation Adapter
 *
 * Bridges the gap between schema extensions and aggregation service,
 * converting between different representations of derivation rules.
 */

import type { Result } from "../../domain/core/result.ts";
import type {
  DerivedFieldInfo,
  ExtendedSchema,
  ExtendedSchemaProperty,
} from "../../domain/models/schema-extensions.ts";
import { SchemaTemplateInfo } from "../../domain/models/schema-extensions.ts";
import {
  AggregatedResult,
  AggregationContext,
  DerivationRule,
} from "../../domain/aggregation/value-objects.ts";
import { AggregationService } from "../../domain/aggregation/aggregation-service.ts";
import { ExpressionEvaluator } from "../../domain/aggregation/expression-evaluator.ts";

/**
 * Adapter to integrate schema extensions with aggregation service
 */
export class SchemaAggregationAdapter {
  private readonly aggregationService: AggregationService;

  constructor(evaluator?: ExpressionEvaluator) {
    this.aggregationService = new AggregationService(
      evaluator || new ExpressionEvaluator(),
    );
  }

  /**
   * Convert DerivedFieldInfo to DerivationRule
   */
  private convertToDerivationRule(
    info: DerivedFieldInfo,
  ): Result<DerivationRule, { kind: string; message: string }> {
    return DerivationRule.create(
      info.fieldPath,
      info.sourceExpression,
      {
        unique: info.unique,
        flatten: info.flatten,
      },
    );
  }

  /**
   * Extract aggregation context from schema
   */
  extractAggregationContext(
    schema: ExtendedSchema,
  ): Result<AggregationContext, { kind: string; message: string }> {
    // Extract template info from schema
    const templateInfoResult = SchemaTemplateInfo.extract(schema);
    if (!templateInfoResult.ok) {
      return templateInfoResult as Result<
        AggregationContext,
        { kind: string; message: string }
      >;
    }

    const templateInfo = templateInfoResult.data;
    const derivationRules = templateInfo.getDerivationRules();

    // Convert DerivedFieldInfo to DerivationRule
    const rules: DerivationRule[] = [];
    const errors: string[] = [];

    for (const [_, info] of derivationRules) {
      const ruleResult = this.convertToDerivationRule(info);
      if (!ruleResult.ok) {
        errors.push(ruleResult.error.message);
      } else {
        rules.push(ruleResult.data);
      }
    }

    if (errors.length > 0) {
      return {
        ok: false,
        error: {
          kind: "ConversionError",
          message: `Failed to convert derivation rules: ${errors.join(", ")}`,
        },
      };
    }

    // Create aggregation context with default options
    const context = AggregationContext.create(rules, {
      skipNull: true,
      skipUndefined: true,
    });

    return { ok: true, data: context };
  }

  /**
   * Process aggregation for multiple documents using schema rules
   */
  processAggregation(
    documents: unknown[],
    schema: ExtendedSchema,
  ): Result<Record<string, unknown>, { kind: string; message: string }> {
    // Extract aggregation context from schema
    const contextResult = this.extractAggregationContext(schema);
    if (!contextResult.ok) {
      return contextResult as Result<
        Record<string, unknown>,
        { kind: string; message: string }
      >;
    }

    // Execute aggregation
    const aggregationResult = this.aggregationService.aggregate(
      documents,
      contextResult.data,
    );

    if (!aggregationResult.ok) {
      return aggregationResult as Result<
        Record<string, unknown>,
        { kind: string; message: string }
      >;
    }

    // Return aggregated data
    return {
      ok: true,
      data: aggregationResult.data.getData(),
    };
  }

  /**
   * Check if schema has x-frontmatter-part marking
   */
  isFrontmatterPartSchema(schema: ExtendedSchema): boolean {
    return schema["x-frontmatter-part"] === true;
  }

  /**
   * Find all properties marked with x-frontmatter-part
   */
  findFrontmatterParts(
    schema: ExtendedSchema,
  ): string[] {
    const parts: string[] = [];

    const traverseProperties = (
      properties: Record<string, ExtendedSchemaProperty> | undefined,
      prefix: string = "",
    ): void => {
      if (!properties) return;

      for (const [key, prop] of Object.entries(properties)) {
        const path = prefix ? `${prefix}.${key}` : key;

        if (prop["x-frontmatter-part"] === true) {
          parts.push(path);
        }

        // Check nested properties
        if (prop.properties) {
          traverseProperties(prop.properties, path);
        }

        // Check array items
        if (prop.items && !Array.isArray(prop.items) && prop.items.properties) {
          traverseProperties(prop.items.properties, `${path}[]`);
        }
      }
    };

    // Check root level
    if (schema["x-frontmatter-part"] === true) {
      parts.push("$");
    }

    // Check properties
    traverseProperties(schema.properties);

    return parts;
  }

  /**
   * Apply aggregated data to a template
   */
  applyToTemplate(
    template: Record<string, unknown>,
    aggregatedData: Record<string, unknown>,
  ): Record<string, unknown> {
    // Create a proper AggregatedResult using the factory method
    const aggregatedResult = AggregatedResult.create(aggregatedData, {
      processedCount: 0,
      aggregatedAt: new Date(),
      appliedRules: [],
    });

    if (!aggregatedResult.ok) {
      // If creation fails, return template unchanged
      return template;
    }

    return this.aggregationService.applyAggregatedData(
      template,
      aggregatedResult.data,
    );
  }
}

/**
 * Factory function to create schema aggregation adapter
 */
export function createSchemaAggregationAdapter(
  evaluator?: ExpressionEvaluator,
): SchemaAggregationAdapter {
  return new SchemaAggregationAdapter(evaluator);
}
