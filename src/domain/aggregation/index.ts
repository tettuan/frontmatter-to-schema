// Aggregation domain exports

// Entities
export { Aggregation } from "./entities/aggregation.ts";
export type {
  AggregationMetadata,
  AggregationOptions,
  AggregationResult,
} from "./entities/aggregation.ts";

// Value Objects
export { AggregationId } from "./value-objects/aggregation-id.ts";

// Services
export { AggregationService } from "./services/aggregation-service.ts";
export type { ValidationResult } from "./services/aggregation-service.ts";
export {
  ArrayAggregationStrategy,
  MergeAggregationStrategy,
  SingleSourceStrategy,
} from "./services/aggregation-strategy.ts";
export type {
  AggregationStrategy,
  ArrayStrategyConfig,
  MergeStrategyConfig,
  StrategyConfiguration,
} from "./services/aggregation-strategy.ts";
export { DocumentAggregationService } from "./services/document-aggregation-service.ts";
export type {
  AggregationConfig,
  ConfigurationManager,
} from "./services/document-aggregation-service.ts";
