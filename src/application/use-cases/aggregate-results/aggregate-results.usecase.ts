/**
 * Aggregate Results Use Case
 *
 * Responsible for aggregating multiple results and applying derivation rules
 * Part of the Aggregation Context in DDD
 * Follows Totality principles with Result types
 */

import type { UseCase } from "../base.usecase.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { createDomainError } from "../../../domain/core/result.ts";
import { SchemaAggregationAdapter } from "../../services/schema-aggregation-adapter.ts";
import type { SchemaTemplateInfo } from "../../../domain/models/schema-extensions.ts";

/**
 * Input for result aggregation
 */
export interface AggregateResultsInput {
  data: unknown[];
  templateInfo: SchemaTemplateInfo;
  schema: unknown;
}

/**
 * Output from result aggregation
 */
export interface AggregateResultsOutput {
  aggregated: Record<string, unknown>;
  itemCount: number;
  derivedFields?: Record<string, unknown>;
}

/**
 * Aggregate Results Use Case Implementation
 * Handles aggregation of multiple processing results and derivation rules
 */
export class AggregateResultsUseCase
  implements UseCase<AggregateResultsInput, AggregateResultsOutput> {
  private readonly aggregationAdapter: SchemaAggregationAdapter;

  constructor() {
    this.aggregationAdapter = new SchemaAggregationAdapter();
  }

  async execute(
    input: AggregateResultsInput,
  ): Promise<
    Result<AggregateResultsOutput, DomainError & { message: string }>
  > {
    // Await to satisfy linter requirement for async functions
    await Promise.resolve();

    try {
      // Validate input data
      if (!Array.isArray(input.data)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: typeof input.data,
              expectedFormat: "array",
            },
            "Data to aggregate must be an array",
          ),
        };
      }

      // Use aggregation adapter for the main aggregation
      const aggregationResult = this.aggregationAdapter.processAggregation(
        input.data,
        input.schema as Record<string, unknown>,
      );

      if (!aggregationResult.ok) {
        return aggregationResult as Result<
          never,
          DomainError & { message: string }
        >;
      }

      // Create base result
      let result: Record<string, unknown> = {
        ...aggregationResult.data,
        items: input.data,
      };

      // Handle x-frontmatter-part if present
      if (input.templateInfo.getIsFrontmatterPart()) {
        const frontmatterParts = this.aggregationAdapter
          .findFrontmatterParts(input.schema as Record<string, unknown>);

        if (frontmatterParts.length > 0) {
          // Use the first frontmatter part property
          const key = frontmatterParts[0];
          result = {
            ...aggregationResult.data,
            [key]: input.data,
          };
          // Don't include items when we have frontmatter-part
          delete result.items;
        }
      }

      // Extract derived fields if any
      const derivedFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(aggregationResult.data)) {
        if (
          !input.data.some((item) =>
            typeof item === "object" && item !== null && key in item
          )
        ) {
          derivedFields[key] = value;
        }
      }

      return {
        ok: true,
        data: {
          aggregated: result,
          itemCount: input.data.length,
          derivedFields: Object.keys(derivedFields).length > 0
            ? derivedFields
            : undefined,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "AggregateResults",
            error: {
              kind: "InvalidResponse",
              service: "aggregation-service",
              response: error instanceof Error ? error.message : String(error),
            },
          },
          `Failed to aggregate results: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }
}
