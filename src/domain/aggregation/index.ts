/**
 * Aggregation Domain Module
 *
 * Exports all aggregation-related domain components.
 */

export {
  AggregatedResult,
  AggregationContext,
  type AggregationMetadata,
  type AggregationOptions,
  type AggregationProcessState,
  type AggregationStatistics,
  DerivationRule,
} from "./value-objects.ts";

export {
  createExpressionEvaluator,
  ExpressionEvaluator,
} from "./expression-evaluator.ts";

export {
  AggregationService,
  createAggregationService,
} from "./aggregation-service.ts";
