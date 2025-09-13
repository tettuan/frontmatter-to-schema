/**
 * Aggregation Domain Value Objects
 *
 * Value objects for the aggregation context that handle
 * derived fields and data aggregation from multiple documents.
 * REFACTORED: Eliminates hardcoding violations by using SchemaExtensionRegistry
 */

import type { Result } from "../core/result.ts";
import { JSONPathExpression } from "./jsonpath-expression.ts";
import type { SchemaExtensionRegistry } from "../schema/entities/schema-extension-registry.ts";
import { ExtensionType } from "../schema/value-objects/extension-value.ts";
import { SchemaPropertyAccessor } from "../schema/services/schema-property-accessor.ts";
import { SchemaExtensionConfig } from "../config/schema-extension-config.ts";

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
 * Represents a derivation rule for aggregating data
 */
export class DerivationRule {
  private constructor(
    private readonly targetField: string,
    private readonly sourceExpression: JSONPathExpression,
    private readonly unique: boolean = false,
    private readonly flatten: boolean = false,
  ) {}

  static create(
    targetField: string,
    sourceExpression: string,
    options?: { unique?: boolean; flatten?: boolean },
  ): Result<DerivationRule, { kind: string; message: string }> {
    // Validate target field
    if (!targetField || targetField.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "InvalidTargetField",
          message: "Target field cannot be empty",
        },
      };
    }

    // Validate target field name format (allow dot notation for nested fields and array notation)
    const trimmedTarget = targetField.trim();
    // Pattern allows: field, field.nested, field[].nested, field[].nested[].deep
    if (
      !/^[a-zA-Z_][a-zA-Z0-9_]*(\[\])?(\.[a-zA-Z_][a-zA-Z0-9_]*(\[\])?)*$/.test(
        trimmedTarget,
      )
    ) {
      return {
        ok: false,
        error: {
          kind: "InvalidTargetField",
          message: `Invalid target field name: ${trimmedTarget}`,
        },
      };
    }

    // Validate source expression using Smart Constructor
    const expressionResult = JSONPathExpression.create(sourceExpression);
    if (!expressionResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InvalidSourceExpression",
          message: expressionResult.error.message,
        },
      };
    }

    return {
      ok: true,
      data: new DerivationRule(
        trimmedTarget,
        expressionResult.data,
        options?.unique ?? false,
        options?.flatten ?? false,
      ),
    };
  }

  getTargetField(): string {
    return this.targetField;
  }

  getSourceExpression(): string {
    return this.sourceExpression.getExpression();
  }

  getSourceExpressionObject(): JSONPathExpression {
    return this.sourceExpression;
  }

  isUnique(): boolean {
    return this.unique;
  }

  shouldFlatten(): boolean {
    return this.flatten;
  }

  /**
   * Parse a derivation rule from schema properties
   * REFACTORED: Uses SchemaPropertyAccessor to eliminate hardcoding violations
   */
  static fromSchemaProperty(
    fieldName: string,
    schemaProperty: Record<string, unknown>,
    registry: SchemaExtensionRegistry,
  ): Result<DerivationRule | null, { kind: string; message: string }> {
    // Create accessor for safe property access
    const configResult = SchemaExtensionConfig.createDefault();
    if (!configResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ConfigurationError",
          message:
            `Failed to create configuration: ${configResult.error.message}`,
        },
      };
    }
    const accessor = new SchemaPropertyAccessor(configResult.data);

    // Check for x-derived-count extension first
    if (accessor.hasDerivedCount(schemaProperty)) {
      const countValue = accessor.getDerivedCount(schemaProperty);
      if (typeof countValue === "string") {
        return DerivationRule.create(
          fieldName,
          `count(${countValue})`,
          {
            unique: false,
            flatten: false,
          },
        );
      }
    }

    // Check for x-derived-average extension
    if (accessor.hasDerivedAverage(schemaProperty)) {
      const averageValue = accessor.getDerivedAverage(schemaProperty);
      if (typeof averageValue === "string") {
        return DerivationRule.create(
          fieldName,
          `average(${averageValue})`,
          {
            unique: false,
            flatten: false,
          },
        );
      }
    }

    // Check for x-derived-count-where extension
    if (accessor.hasDerivedCountWhere(schemaProperty)) {
      const countWhereValue = accessor.getDerivedCountWhere(schemaProperty);
      if (countWhereValue) {
        return DerivationRule.create(
          fieldName,
          `count_where(${countWhereValue.from}, ${countWhereValue.where})`,
          {
            unique: false,
            flatten: false,
          },
        );
      }
    }

    // Check if x-derived-from property exists and is a string (reject non-string values)
    const derivedFromProperty = registry.getDerivedFromProperty();
    if (!(derivedFromProperty in schemaProperty)) {
      return { ok: true, data: null };
    }

    const rawValue = schemaProperty[derivedFromProperty];
    if (typeof rawValue !== "string") {
      // Reject non-string values gracefully
      return { ok: true, data: null };
    }

    // Use registry to extract derived-from extension
    const derivedFromExtraction = registry.extractExtensionValue(
      schemaProperty,
      ExtensionType.DERIVED_FROM,
    );

    if (!derivedFromExtraction.ok) {
      return {
        ok: false,
        error: {
          kind: "ExtensionExtractionFailed",
          message: derivedFromExtraction.error.message,
        },
      };
    }

    if (
      !derivedFromExtraction.data ||
      derivedFromExtraction.data.kind !== "StringExtension"
    ) {
      return { ok: true, data: null };
    }

    const derivedFrom = derivedFromExtraction.data.value;

    // Check for aggregation options in x-aggregation-options object
    const aggregationOptionsProperty =
      `${registry.getTemplateProperty()}-aggregation-options`;
    const aggregationOptions =
      schemaProperty[aggregationOptionsProperty] as Record<string, unknown> ||
      {};

    // Use registry to extract derived-unique extension
    const derivedUniqueExtraction = registry.extractExtensionValue(
      schemaProperty,
      ExtensionType.DERIVED_UNIQUE,
    );

    let unique = aggregationOptions.unique === true;
    if (
      derivedUniqueExtraction.ok &&
      derivedUniqueExtraction.data?.kind === "BooleanExtension"
    ) {
      unique = unique || derivedUniqueExtraction.data.enabled;
    }

    // Check for flatten option (using derived-flatten pattern)
    const derivedFlattenProperty =
      `${registry.getDerivedFromProperty()}-flatten`;
    const flatten = aggregationOptions.flatten === true ||
      schemaProperty[derivedFlattenProperty] === true;

    return DerivationRule.create(fieldName, derivedFrom, { unique, flatten });
  }
}

/**
 * Aggregation context containing rules and options
 */
export class AggregationContext {
  private constructor(
    private readonly rules: DerivationRule[],
    private readonly options: AggregationOptions,
  ) {}

  static create(
    rules: DerivationRule[],
    options?: Partial<AggregationOptions>,
  ): AggregationContext {
    const defaultOptions: AggregationOptions = {
      skipNull: true,
      skipUndefined: true,
      preserveOrder: false,
    };

    return new AggregationContext(
      rules,
      { ...defaultOptions, ...options },
    );
  }

  getRules(): DerivationRule[] {
    return [...this.rules];
  }

  getOptions(): AggregationOptions {
    return { ...this.options };
  }

  addRule(rule: DerivationRule): AggregationContext {
    return new AggregationContext(
      [...this.rules, rule],
      this.options,
    );
  }
}

/**
 * Options for aggregation processing
 */
export interface AggregationOptions {
  skipNull: boolean;
  skipUndefined: boolean;
  preserveOrder: boolean;
}

/**
 * Result of an aggregation process
 */
export class AggregatedResult {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly metadata: AggregationMetadata,
  ) {}

  static create(
    data: Record<string, unknown>,
    metadata: AggregationMetadata,
  ): Result<AggregatedResult, { kind: string; message: string }> {
    if (!data || typeof data !== "object") {
      return {
        ok: false,
        error: {
          kind: "InvalidData",
          message: "Aggregated data must be an object",
        },
      };
    }

    return {
      ok: true,
      data: new AggregatedResult(data, metadata),
    };
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }

  getMetadata(): AggregationMetadata {
    return { ...this.metadata };
  }

  getField(path: string): unknown {
    const parts = path.split(".");
    let current: unknown = this.data;

    for (const part of parts) {
      if (isValidRecordData(current) && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

/**
 * Metadata about the aggregation process
 * Follows Totality principles - no optional properties
 */
export type AggregationMetadata =
  & {
    processedCount: number;
    aggregatedAt: Date;
    appliedRules: string[];
  }
  & (
    | {
      kind: "WithStatistics";
      warnings: string[];
      statistics: AggregationStatistics;
    }
    | { kind: "WithWarnings"; warnings: string[]; statistics: null }
    | { kind: "Basic"; warnings: null; statistics: null }
  );

/**
 * Statistics collected during aggregation
 */
export interface AggregationStatistics {
  totalItems: number;
  uniqueValues: Record<string, number>;
  nullCount: Record<string, number>;
  arrayLengths: Record<string, number[]>;
}

/**
 * Helper functions to create AggregationMetadata following Totality principles
 */
export class AggregationMetadataBuilder {
  static basic(
    processedCount: number,
    appliedRules: string[],
    aggregatedAt: Date = new Date(),
  ): AggregationMetadata {
    return {
      processedCount,
      aggregatedAt,
      appliedRules,
      kind: "Basic",
      warnings: null,
      statistics: null,
    };
  }

  static withWarnings(
    processedCount: number,
    appliedRules: string[],
    warnings: string[],
    aggregatedAt: Date = new Date(),
  ): AggregationMetadata {
    return {
      processedCount,
      aggregatedAt,
      appliedRules,
      kind: "WithWarnings",
      warnings,
      statistics: null,
    };
  }

  static withStatistics(
    processedCount: number,
    appliedRules: string[],
    warnings: string[],
    statistics: AggregationStatistics,
    aggregatedAt: Date = new Date(),
  ): AggregationMetadata {
    return {
      processedCount,
      aggregatedAt,
      appliedRules,
      kind: "WithStatistics",
      warnings,
      statistics,
    };
  }
}

/**
 * Represents the state of an aggregation process
 */
export type AggregationProcessState =
  | { kind: "Initialized"; context: AggregationContext }
  | { kind: "Collecting"; context: AggregationContext; items: unknown[] }
  | { kind: "Processing"; context: AggregationContext; items: unknown[] }
  | { kind: "Completed"; result: AggregatedResult }
  | { kind: "Failed"; error: { kind: string; message: string } };
