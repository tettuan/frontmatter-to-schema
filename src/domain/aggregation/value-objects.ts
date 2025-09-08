/**
 * Aggregation Domain Value Objects
 *
 * Value objects for the aggregation context that handle
 * derived fields and data aggregation from multiple documents.
 */

import type { Result } from "../core/result.ts";
import { JSONPathExpression } from "./jsonpath-expression.ts";

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

    // Validate target field name format
    const trimmedTarget = targetField.trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedTarget)) {
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
   */
  static fromSchemaProperty(
    fieldName: string,
    schemaProperty: Record<string, unknown>,
  ): Result<DerivationRule | null, { kind: string; message: string }> {
    const derivedFrom = schemaProperty["x-derived-from"];
    if (!derivedFrom || typeof derivedFrom !== "string") {
      return { ok: true, data: null };
    }

    const unique = schemaProperty["x-derived-unique"] === true;
    const flatten = schemaProperty["x-derived-flatten"] === true;

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
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

/**
 * Metadata about the aggregation process
 */
export interface AggregationMetadata {
  processedCount: number;
  aggregatedAt: Date;
  appliedRules: string[];
  warnings?: string[];
  statistics?: AggregationStatistics;
}

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
 * Represents the state of an aggregation process
 */
export type AggregationProcessState =
  | { kind: "Initialized"; context: AggregationContext }
  | { kind: "Collecting"; context: AggregationContext; items: unknown[] }
  | { kind: "Processing"; context: AggregationContext; items: unknown[] }
  | { kind: "Completed"; result: AggregatedResult }
  | { kind: "Failed"; error: { kind: string; message: string } };
