// Result aggregator implementation

import type { DomainError, Result } from "../../domain/core/result.ts";
import {
  createDomainError,
  createProcessingStageError,
} from "../../domain/core/result.ts";
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
  ): Result<AggregatedResult, DomainError & { message: string }> {
    try {
      if (results.length === 0) {
        return {
          ok: false,
          error: createProcessingStageError(
            "aggregation",
            createDomainError({ kind: "EmptyInput" }),
          ),
        };
      }

      const aggregated = AggregatedResult.create(results, this.format);
      return { ok: true, data: aggregated };
    } catch (error) {
      return {
        ok: false,
        error: createProcessingStageError(
          "aggregation",
          createDomainError({
            kind: "ReadError",
            path: "aggregation",
            details: error instanceof Error ? error.message : "Unknown error",
          }),
        ),
      };
    }
  }
}
