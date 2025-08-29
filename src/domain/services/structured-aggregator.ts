/**
 * StructuredAggregator Domain Service
 *
 * Implements Smart Constructor pattern following Totality principle
 * Responsible for aggregating multiple documents into unified template structure
 * Following CD5: Result Integration Domain from domain boundary design
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { AnalysisResult, Template } from "../models/entities.ts";

/**
 * Aggregation Strategy - Discriminated Union following Totality principle
 */
export type AggregationStrategy =
  | { kind: "merge_arrays"; mergeKey: string } // Merge array fields
  | { kind: "replace_values"; priority: "latest" } // Replace scalar values
  | { kind: "accumulate_fields"; pattern: string }; // Accumulate matching fields

/**
 * Template Structure Analysis Result
 */
export type TemplateStructure = {
  kind: "parent_template";
  arrayFields: string[]; // Fields that should accumulate arrays
  scalarFields: string[]; // Fields that should be replaced
  nestedStructures: Record<string, TemplateStructure>;
};

/**
 * Aggregated Structure Value Object
 */
export class AggregatedStructure {
  private constructor(
    private readonly structure: Record<string, unknown>,
    private readonly strategy: AggregationStrategy,
    private readonly templateStructure: TemplateStructure,
  ) {}

  static create(
    structure: Record<string, unknown>,
    strategy: AggregationStrategy,
    templateStructure: TemplateStructure,
  ): Result<AggregatedStructure, DomainError & { message: string }> {
    if (
      !structure || typeof structure !== "object" || Array.isArray(structure)
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof structure,
          expectedFormat: "object",
        }, "Aggregated structure must be a valid object"),
      };
    }

    return {
      ok: true,
      data: new AggregatedStructure(structure, strategy, templateStructure),
    };
  }

  getStructure(): Record<string, unknown> {
    return { ...this.structure };
  }

  getStrategy(): AggregationStrategy {
    return this.strategy;
  }

  getTemplateStructure(): TemplateStructure {
    return this.templateStructure;
  }
}

/**
 * StructuredAggregator Domain Service
 * Follows CD5: Result Integration Domain patterns
 */
export class StructuredAggregator {
  private constructor() {}

  /**
   * Smart Constructor following Totality principle
   */
  static create(): Result<
    StructuredAggregator,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new StructuredAggregator(),
    };
  }

  /**
   * Analyze template structure to determine aggregation strategy
   */
  analyzeTemplateStructure(
    template: Template,
  ): Result<TemplateStructure, DomainError & { message: string }> {
    try {
      const templateFormat = template.getFormat();
      const templateContent = templateFormat.getTemplate();

      // Parse template to identify array fields
      let parsed: unknown;

      if (templateFormat.getFormat() === "json") {
        parsed = JSON.parse(templateContent);
      } else {
        // For other formats, treat as basic structure analysis
        return {
          ok: true,
          data: {
            kind: "parent_template",
            arrayFields: [],
            scalarFields: [],
            nestedStructures: {},
          },
        };
      }

      if (
        typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
      ) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: templateContent,
            expectedFormat: "JSON object",
          }, "Template must be a valid JSON object for structure analysis"),
        };
      }

      const structure = this.analyzeObjectStructure(
        parsed as Record<string, unknown>,
      );

      return {
        ok: true,
        data: structure,
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: template.getFormat().getTemplate(),
          details: String(error),
        }, "Failed to analyze template structure"),
      };
    }
  }

  /**
   * Aggregate multiple analysis results following template structure
   */
  aggregate(
    results: AnalysisResult[],
    templateStructure: TemplateStructure,
    strategy: AggregationStrategy,
  ): Result<AggregatedStructure, DomainError & { message: string }> {
    if (results.length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "results",
        }, "Cannot aggregate empty results array"),
      };
    }

    try {
      // Initialize aggregated structure
      let aggregated: Record<string, unknown> = {};

      // Process each result according to template structure
      for (const result of results) {
        const mappedData = result.getMappedData();
        const data = mappedData.getData();

        if (typeof data !== "object" || data === null || Array.isArray(data)) {
          continue; // Skip invalid data
        }

        aggregated = this.mergeIntoStructure(
          aggregated,
          data as Record<string, unknown>,
          templateStructure,
          strategy,
        );
      }

      return AggregatedStructure.create(
        aggregated,
        strategy,
        templateStructure,
      );
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: templateStructure,
          source: results,
        }, `Aggregation failed: ${error}`),
      };
    }
  }

  /**
   * Private helper: Analyze object structure for array fields
   */
  private analyzeObjectStructure(
    obj: Record<string, unknown>,
  ): TemplateStructure {
    const arrayFields: string[] = [];
    const scalarFields: string[] = [];
    const nestedStructures: Record<string, TemplateStructure> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        arrayFields.push(key);
      } else if (typeof value === "object" && value !== null) {
        nestedStructures[key] = this.analyzeObjectStructure(
          value as Record<string, unknown>,
        );
      } else if (typeof value === "string" && value.includes("{{")) {
        // Template placeholder - likely scalar field
        scalarFields.push(key);
      } else {
        scalarFields.push(key);
      }
    }

    return {
      kind: "parent_template",
      arrayFields,
      scalarFields,
      nestedStructures,
    };
  }

  /**
   * Private helper: Merge data into aggregated structure
   */
  private mergeIntoStructure(
    aggregated: Record<string, unknown>,
    data: Record<string, unknown>,
    structure: TemplateStructure,
    strategy: AggregationStrategy,
  ): Record<string, unknown> {
    const result = { ...aggregated };

    // Handle array fields - accumulate arrays
    for (const arrayField of structure.arrayFields) {
      if (data[arrayField] !== undefined) {
        if (!result[arrayField]) {
          result[arrayField] = [];
        }

        if (Array.isArray(data[arrayField])) {
          (result[arrayField] as unknown[]).push(
            ...(data[arrayField] as unknown[]),
          );
        } else {
          (result[arrayField] as unknown[]).push(data[arrayField]);
        }
      }
    }

    // Handle scalar fields based on strategy
    for (const scalarField of structure.scalarFields) {
      if (data[scalarField] !== undefined) {
        switch (strategy.kind) {
          case "replace_values":
            // Latest value wins
            result[scalarField] = data[scalarField];
            break;
          case "merge_arrays":
          case "accumulate_fields":
            // First value wins for scalars in these strategies
            if (result[scalarField] === undefined) {
              result[scalarField] = data[scalarField];
            }
            break;
        }
      }
    }

    // Handle nested structures recursively
    for (
      const [nestedKey, nestedStructure] of Object.entries(
        structure.nestedStructures,
      )
    ) {
      if (
        data[nestedKey] && typeof data[nestedKey] === "object" &&
        !Array.isArray(data[nestedKey])
      ) {
        const currentNested = result[nestedKey] as Record<string, unknown> ||
          {};
        result[nestedKey] = this.mergeIntoStructure(
          currentNested,
          data[nestedKey] as Record<string, unknown>,
          nestedStructure,
          strategy,
        );
      }
    }

    return result;
  }
}

/**
 * Type guard for AggregatedStructure
 */
export function isAggregatedStructure(
  value: unknown,
): value is AggregatedStructure {
  return value instanceof AggregatedStructure;
}
