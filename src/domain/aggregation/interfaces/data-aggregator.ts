import { Result } from "../../shared/types/result.ts";
import { DomainError as _DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { DerivationRule } from "../value-objects/derivation-rule.ts";

/**
 * Result of data aggregation following DDD principles
 */
export interface AggregatedData {
  readonly aggregatedFrontmatter: FrontmatterData;
  readonly aggregationMetadata: AggregationMetadata;
}

/**
 * Metadata about the aggregation process
 */
export interface AggregationMetadata {
  readonly inputCount: number;
  readonly hasDerivationRules: boolean;
  readonly derivationRuleCount: number;
  readonly aggregationStrategy:
    | "with-derivation"
    | "without-derivation"
    | "direct-merge";
}

/**
 * Discriminated union for aggregation errors following Totality principles
 */
export type AggregationError =
  | { kind: "AggregationFailure"; strategy: string; cause: string }
  | { kind: "DerivationRuleProcessingFailure"; rule: string; cause: string }
  | { kind: "DataMergingFailure"; operation: string; cause: string }
  | { kind: "SchemaStructureCreationFailure"; cause: string }
  | { kind: "AggregatorCreationFailure"; cause: string };

/**
 * Domain service interface for data aggregation following DDD principles.
 * Handles the core responsibility of combining and deriving data from multiple sources.
 *
 * Core Domain: Data Aggregation
 * Responsibility: Frontmatter part processing, derivation rules, data merging
 * Dependencies: DerivationEngine, DataMerger, SchemaPathResolver
 */
export interface DataAggregator {
  /**
   * Aggregate multiple frontmatter data objects into a single aggregated result.
   * Applies derivation rules and schema-driven structure creation when present.
   * Follows Totality principle - all error cases are handled and represented in the type system.
   *
   * @param data Array of frontmatter data to aggregate
   * @param schema Schema containing derivation rules and aggregation directives
   * @returns Result containing aggregated data or error information
   */
  aggregateData(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<AggregatedData, AggregationError & { message: string }>;

  /**
   * Apply derivation rules to aggregate data.
   * Processes x-derived-from directives and calculates derived fields.
   *
   * @param baseData Base frontmatter data to apply rules to
   * @param derivationRules Array of derivation rules from schema
   * @returns Result containing data with applied derivation rules
   */
  applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: DerivationRule[],
  ): Result<FrontmatterData, AggregationError & { message: string }>;

  /**
   * Calculate derived fields from source data according to derivation rules.
   * Supports unique value extraction and array flattening.
   *
   * @param sourceData Array of source frontmatter data
   * @param derivationRules Array of rules defining how to derive fields
   * @returns Result containing calculated derived fields
   */
  calculateDerivedFields(
    sourceData: FrontmatterData[],
    derivationRules: DerivationRule[],
  ): Result<Record<string, unknown>, AggregationError & { message: string }>;
}
