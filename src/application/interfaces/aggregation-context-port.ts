import { Result } from "../../domain/shared/types/result.ts";
import { AggregationError as AggregationErrorType } from "../../domain/shared/types/errors.ts";
import { ValidatedData } from "./frontmatter-context-port.ts";
import { EnrichedResult } from "./template-context-port.ts";
import { DerivationRule } from "../../domain/aggregation/value-objects/derivation-rule.ts";

/**
 * Aggregation Context Port - DDD Boundary Interface
 *
 * Defines the contract for Aggregation Context interactions following DDD principles.
 * This interface encapsulates all Aggregation-related operations following the
 * medium lifecycle pattern defined in the architecture.
 */

export interface AggregatedResult {
  readonly originalData: ValidatedData[];
  readonly aggregatedFields: Record<string, unknown>;
  readonly appliedRules: DerivationRule[];
  readonly processedAt: Date;
}

/**
 * Aggregation Context Port Interface
 *
 * Following the DDD architecture design from docs/domain/domain-boundary.md:
 * - Medium lifecycle context for data aggregation
 * - Receives ValidatedData[] from Frontmatter Context
 * - Provides EnrichedResult to Template Context
 * - Handles derivation rules and field generation
 */
export interface AggregationContextPort {
  /**
   * Aggregate multiple validated data items
   * Core aggregation processing logic
   */
  aggregateData(
    items: ValidatedData[],
    rules: DerivationRule[],
  ): Result<AggregatedResult, AggregationErrorType>;

  /**
   * Apply derivation rules to generate new fields
   * Supports complex field derivation scenarios
   */
  applyDerivationRules(
    data: ValidatedData[],
    rules: DerivationRule[],
  ): Result<Record<string, unknown>, AggregationErrorType>;

  /**
   * Evaluate expression against data set
   * Supports JMESPath-like expressions for field extraction
   */
  evaluateExpression(
    data: ValidatedData[],
    expression: string,
  ): Result<unknown[], AggregationErrorType>;

  /**
   * Create enriched result for template rendering
   * Combines original and derived data for template context
   */
  createEnrichedResult(
    originalData: ValidatedData[],
    aggregatedResult: AggregatedResult,
  ): Result<EnrichedResult, AggregationErrorType>;

  /**
   * Extract unique values from expression results
   * Supports unique field derivation scenarios
   */
  extractUniqueValues(
    data: ValidatedData[],
    expression: string,
  ): Result<unknown[], AggregationErrorType>;

  /**
   * Merge multiple data sources into unified structure
   * Supports complex data composition scenarios
   */
  mergeDataSources(
    mainData: ValidatedData[],
    additionalData: Record<string, unknown>,
  ): Result<EnrichedResult, AggregationErrorType>;

  /**
   * Merge arrays based on x-merge-arrays directive
   * Implements Issue #898: x-merge-arrays directive functionality
   */
  mergeArrays(
    sourceArrays: unknown[][],
    mergeConfig: {
      flatten: boolean;
      preserveOrder?: boolean;
      filterEmpty?: boolean;
    },
  ): Result<unknown[], AggregationErrorType>;
}

/**
 * Aggregation Context Factory
 *
 * Factory interface for creating Aggregation Context instances.
 * Allows dependency injection while maintaining context boundaries.
 */
export interface AggregationContextFactory {
  create(): AggregationContextPort;
}
