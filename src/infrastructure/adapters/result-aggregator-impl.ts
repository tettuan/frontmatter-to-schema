// Result aggregator implementation

import {
  createError,
  type ProcessingError,
  type Result,
} from "../../domain/shared/types.ts";
import {
  AggregatedResult,
  type AnalysisResult,
} from "../../domain/models/entities.ts";
import type { ResultAggregator } from "../../domain/services/interfaces.ts";

export class ResultAggregatorImpl implements ResultAggregator {
  constructor(
    private readonly format: "json" | "yaml" = "json",
  ) {}

  aggregate(
    results: AnalysisResult[],
  ): Result<AggregatedResult, ProcessingError & { message: string }> {
    try {
      if (results.length === 0) {
        return {
          ok: false,
          error: createError({
            kind: "AggregationFailed",
            reason: "No results to aggregate",
          }),
        };
      }

      const aggregated = AggregatedResult.create(results, this.format);
      return { ok: true, data: aggregated };
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "AggregationFailed",
          reason: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }
}
