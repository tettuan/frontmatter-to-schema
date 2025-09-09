/**
 * Result Aggregation Service
 * Extracted from process-documents-usecase.ts for better domain separation
 * Handles result aggregation and derivation rules following DDD principles
 */

import type { Result } from "../../domain/core/result.ts";
import {
  AggregationService,
  createExpressionEvaluator,
} from "../../domain/aggregation/index.ts";
import type { SchemaTemplateInfo } from "../../domain/models/schema-extensions.ts";
import { SchemaAggregationAdapter } from "./schema-aggregation-adapter.ts";

/**
 * Result Aggregation Service - Handles aggregation and derivation of processed data
 */
export class ResultAggregationService {
  private readonly aggregationService: AggregationService;
  private readonly schemaAggregationAdapter: SchemaAggregationAdapter;

  constructor() {
    this.aggregationService = new AggregationService(
      createExpressionEvaluator(),
    );
    this.schemaAggregationAdapter = new SchemaAggregationAdapter();
  }

  /**
   * Aggregate processed results with derivation rules
   */
  aggregateResults(
    processedData: unknown[],
    templateInfo: SchemaTemplateInfo,
  ): Result<unknown[], { kind: string; message: string }> {
    try {
      // Convert template info to aggregation config
      const conversionResult = this.schemaAggregationAdapter
        .convertTemplateInfo(
          templateInfo,
        );
      if (!conversionResult.ok) {
        return {
          ok: false,
          error: {
            kind: "AggregationConfigError",
            message:
              `Failed to convert template info: ${conversionResult.error.message}`,
          },
        };
      }

      const aggregationConfig = conversionResult.data;

      // Check if aggregation is needed
      if (aggregationConfig.getRules().length === 0) {
        // No aggregation rules, return processed data as-is
        return {
          ok: true,
          data: processedData,
        };
      }

      // Apply aggregation with derivation rules
      const aggregationResult = this.aggregationService.aggregate(
        processedData,
        aggregationConfig,
      );

      if (!aggregationResult.ok) {
        return {
          ok: false,
          error: {
            kind: "AggregationError",
            message: `Aggregation failed: ${aggregationResult.error.message}`,
          },
        };
      }

      // Convert AggregatedResult to array format
      return {
        ok: true,
        data: [aggregationResult.data.getData()],
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "AggregationProcessingError",
          message: error instanceof Error
            ? `Failed to aggregate results: ${error.message}`
            : "Failed to aggregate results: Unknown error",
        },
      };
    }
  }
}
