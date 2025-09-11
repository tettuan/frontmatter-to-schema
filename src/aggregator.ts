import type { DomainError, Result } from "./types.ts";
import type { ValidatedData } from "./schema-resolver.ts";
import type { TemplateData } from "./template-renderer.ts";

export class Aggregator {
  private constructor() {}

  static create(): Result<Aggregator, DomainError> {
    return { ok: true, data: new Aggregator() };
  }

  aggregate(
    validationResults: Result<ValidatedData, DomainError>[],
  ): Result<TemplateData, DomainError> {
    // Separate successful and failed validations
    const successes: ValidatedData[] = [];
    const errors: DomainError[] = [];

    for (const result of validationResults) {
      if (result.ok) {
        successes.push(result.data);
      } else {
        errors.push(result.error);
      }
    }

    // If all validations failed, return first error
    if (successes.length === 0 && errors.length > 0) {
      return { ok: false, error: errors[0] };
    }

    // Aggregate successful data
    const aggregatedData = this.aggregateValidatedData(successes);

    return {
      ok: true,
      data: { aggregatedData },
    };
  }

  private aggregateValidatedData(
    validatedData: ValidatedData[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {
      files: [],
      totalFiles: validatedData.length,
      metadata: {
        processedAt: new Date().toISOString(),
        source: "frontmatter-to-schema",
      },
    };

    // Collect all file data
    const fileEntries: Array<Record<string, unknown>> = [];
    const aggregatedFields: Record<string, unknown[]> = {};

    for (const validated of validatedData) {
      // Add individual file entry
      fileEntries.push({
        path: validated.path,
        data: validated.data,
      });

      // Aggregate fields across all files
      for (const [key, value] of Object.entries(validated.data)) {
        if (!aggregatedFields[key]) {
          aggregatedFields[key] = [];
        }
        aggregatedFields[key].push(value);
      }
    }

    result.files = fileEntries;

    // Add aggregated field collections
    for (const [fieldName, values] of Object.entries(aggregatedFields)) {
      // Create unique collections for arrays and primitive values
      const uniqueValues = this.uniqueValues(values);
      result[`all_${fieldName}`] = uniqueValues;

      // Add counts
      result[`${fieldName}_count`] = values.length;
      result[`unique_${fieldName}_count`] = uniqueValues.length;
    }

    return result;
  }

  private uniqueValues(values: unknown[]): unknown[] {
    const seen = new Set<string>();
    const unique: unknown[] = [];

    for (const value of values) {
      const key = this.valueToKey(value);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    }

    return unique;
  }

  private valueToKey(value: unknown): string {
    if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      return JSON.stringify(value);
    }
    return String(value);
  }
}
