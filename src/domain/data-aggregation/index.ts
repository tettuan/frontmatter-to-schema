// Data Aggregation Domain Exports
// This module provides data aggregation and derivation capabilities following DDD principles

// Interfaces
export type {
  AggregatedData,
  AggregationError,
  AggregationMetadata,
  DataAggregator,
} from "./interfaces/data-aggregator.ts";

// Services
export { FrontmatterDataAggregator } from "./services/frontmatter-data-aggregator.ts";
