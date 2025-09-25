import type { Result } from "../../shared/types/result.ts";
import type { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import type { Schema } from "../../schema/entities/schema.ts";
import type { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import type { ProcessingBounds } from "../../shared/types/processing-bounds.ts";

/**
 * Core transformation orchestration errors following Totality principles
 */
export type TransformationError =
  | { kind: "OrchestrationFailure"; stage: string; cause: string }
  | { kind: "DocumentProcessingFailure"; cause: string }
  | { kind: "SchemaProcessingFailure"; cause: string }
  | { kind: "DataAggregationFailure"; cause: string }
  | { kind: "ProcessingConfigurationFailure"; cause: string }
  | { kind: "ValidationRuleCreationFailure"; cause: string };

/**
 * Metadata about the transformation process
 */
export interface TransformationMetadata {
  readonly fileCount: number;
  readonly processingStrategy: "parallel" | "sequential";
  readonly processingTime: number;
  readonly usingResolvedSchema: boolean;
  readonly hasValidationRuleAdjustment: boolean;
}

/**
 * Complete transformation output
 */
export interface TransformationOutput {
  readonly transformedData: FrontmatterData;
  readonly metadata: TransformationMetadata;
}

/**
 * Configuration for transformation orchestration
 */
export interface TransformationConfig {
  readonly inputPattern: string;
  readonly validationRules: ValidationRules;
  readonly schema: Schema;
  readonly processingBounds?: ProcessingBounds;
  readonly processingOptions?: {
    readonly parallel?: boolean;
    readonly maxWorkers?: number;
  };
}

/**
 * Domain service interface for transformation orchestration following DDD principles.
 * Coordinates between DocumentProcessor, SchemaProcessor, and DataAggregator.
 *
 * Core Domain: Transformation Orchestration
 * Responsibility: Pipeline coordination, service composition, error propagation
 * Dependencies: DocumentProcessor, SchemaProcessor, DataAggregator
 */
export interface TransformationOrchestrator {
  /**
   * Main transformation orchestration method
   * Coordinates document processing, schema validation, and data aggregation
   */
  orchestrateTransformation(
    config: TransformationConfig,
  ): Promise<
    Result<TransformationOutput, TransformationError & { message: string }>
  >;
}
