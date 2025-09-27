import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { DerivationRule } from "../value-objects/derivation-rule.ts";

/**
 * Legacy type for backward compatibility
 */
export type AggregatedResult = FrontmatterData;

/**
 * Aggregator (Legacy Compatibility)
 *
 * Handles data aggregation with derivation rules.
 * This maintains compatibility during transition to 3-domain architecture.
 */
export class Aggregator {
  static create(): Result<Aggregator, DomainError & { message: string }> {
    return ok(new Aggregator());
  }

  /**
   * Create an aggregator with disabled circuit breaker (for testing or simple use cases)
   */
  static createWithDisabledCircuitBreaker(): Result<
    Aggregator,
    DomainError & { message: string }
  > {
    // For compatibility - circuit breaker is not implemented in this legacy version
    return ok(new Aggregator());
  }

  /**
   * Create an aggregator with standard circuit breaker
   */
  static createWithStandardCircuitBreaker(): Result<
    Aggregator,
    DomainError & { message: string }
  > {
    // For compatibility - circuit breaker is not implemented in this legacy version
    return ok(new Aggregator());
  }

  /**
   * Aggregate data using derivation rules
   */
  aggregate(
    data: FrontmatterData[],
    rules: DerivationRule[],
    baseData?: FrontmatterData,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    try {
      // Basic aggregation - in 3-domain architecture, this is handled by DataProcessingInstructionDomainService
      if (data.length === 0) {
        return baseData ? ok(baseData) : err(createError({
          kind: "NO_PROCESSING_ACTIVITY",
        }, "No data to aggregate"));
      }

      // Simple merging for compatibility
      const aggregatedData: Record<string, unknown> = {};

      // Copy base data if provided
      if (baseData) {
        Object.assign(aggregatedData, baseData.getData());
      }

      // Apply derivation rules
      for (const rule of rules) {
        const derivedValues: unknown[] = [];

        for (const item of data) {
          const itemData = item.getData();
          const value = this.extractValueFromPath(
            itemData,
            rule.getSourcePath(),
          );
          if (value !== undefined) {
            if (Array.isArray(value)) {
              derivedValues.push(...value);
            } else {
              derivedValues.push(value);
            }
          }
        }

        if (rule.isUnique()) {
          aggregatedData[rule.getTargetField()] = [...new Set(derivedValues)];
        } else {
          aggregatedData[rule.getTargetField()] = derivedValues;
        }
      }

      return FrontmatterData.create(aggregatedData);
    } catch (error) {
      return err(createError(
        {
          kind: "EXCEPTION_CAUGHT",
          originalError: error,
        },
        `Aggregation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ));
    }
  }

  /**
   * Merge with base data
   */
  mergeWithBase(
    data: FrontmatterData,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    return ok(data); // Simple pass-through for compatibility
  }

  /**
   * Extract value from object path
   */
  private extractValueFromPath(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    if (path.includes("[]")) {
      const [arrayPath, propertyPath] = path.split("[].");
      const arrayValue = this.getNestedProperty(obj, arrayPath);

      if (Array.isArray(arrayValue)) {
        return arrayValue.map((item) => {
          if (propertyPath && typeof item === "object" && item !== null) {
            return this.getNestedProperty(
              item as Record<string, unknown>,
              propertyPath,
            );
          }
          return item;
        }).filter((value) => value !== undefined);
      }
    } else {
      return this.getNestedProperty(obj, path);
    }

    return undefined;
  }

  /**
   * Get nested property from object
   */
  private getNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
