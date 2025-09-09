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

          // Apply level-based filtering before assigning data
          const filteredData = this.applyLevelFiltering(
            input.data,
            input.schema as Record<string, unknown>,
            key,
          );

          result = {
            ...aggregationResult.data,
            [key]: filteredData,
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

  /**
   * Apply level-based filtering for traceability items
   * Filters items based on schema constraints (e.g., level: "req")
   */
  private applyLevelFiltering(
    data: unknown[],
    schema: Record<string, unknown>,
    key: string,
  ): unknown[] {
    try {
      // Extract the required level from schema constraints
      const requiredLevel = this.extractRequiredLevel(schema, key);
      if (!requiredLevel) {
        // No level constraint found, return all data
        return data;
      }

      // Filter data based on traceability level
      return data.filter((item) => {
        if (!this.isValidRecord(item)) return false;

        const traceability = item.traceability;
        if (!Array.isArray(traceability)) return false;

        // Check if any traceability item matches the required level
        return traceability.some((trace: unknown) => {
          if (!this.isValidRecord(trace)) return false;

          const id = trace.id;
          if (!this.isValidRecord(id)) return false;

          return id.level === requiredLevel;
        });
      });
    } catch (error) {
      // On error, return original data to maintain functionality
      console.warn("Level filtering failed:", error);
      return data;
    }
  }

  /**
   * Extract required level from schema constraints
   */
  private extractRequiredLevel(
    schema: Record<string, unknown>,
    propertyKey: string,
  ): string | null {
    try {
      // First, check if the schema itself specifies a level constraint
      // This would be in schemas like level_req_schema.json
      // The property key should give us a hint about the level (e.g., "req", "spec", "design")
      if (propertyKey === "req" || propertyKey === "spec" || 
          propertyKey === "design" || propertyKey === "impl" || 
          propertyKey === "test") {
        return propertyKey;
      }

      // Otherwise, check the property definition
      const properties = schema.properties;
      if (!this.isValidRecord(properties)) return null;

      const property = properties[propertyKey];
      if (!this.isValidRecord(property)) return null;

      // Check if the property has an x-level constraint
      if (typeof property["x-level"] === "string") {
        return property["x-level"];
      }

      const items = property.items;
      if (!this.isValidRecord(items)) return null;

      // Check if items have an x-level constraint
      if (typeof items["x-level"] === "string") {
        return items["x-level"];
      }

      // Handle $ref resolution - get the referenced schema
      const ref = items["$ref"];
      if (typeof ref === "string") {
        // Extract level from various ref patterns
        // e.g., traceability_req_schema.json -> "req"
        // e.g., level_req_schema.json -> "req"
        const patterns = [
          /traceability_(\w+)_schema\.json/,
          /level_(\w+)_schema\.json/,
          /_(\w+)_schema\.json/
        ];
        
        for (const pattern of patterns) {
          const match = ref.match(pattern);
          if (match && ["req", "spec", "design", "impl", "test"].includes(match[1])) {
            return match[1];
          }
        }
      }

      return null;
    } catch (error) {
      console.warn("Failed to extract required level:", error);
      return null;
    }
  }

  /**
   * Type guard for record objects
   */
  private isValidRecord(data: unknown): data is Record<string, unknown> {
    return typeof data === "object" && data !== null && !Array.isArray(data);
  }
}
