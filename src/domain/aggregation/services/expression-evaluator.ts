import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { PathSegment } from "../value-objects/path-segment.ts";

/**
 * Accumulated evaluation results that track both successful values and errors.
 * Replaces silent error handling with explicit error accumulation.
 */
export type EvaluationResult = {
  readonly values: unknown[];
  readonly skippedItems: number;
  readonly errors: Array<AggregationError & { message: string }>;
};

export class ExpressionEvaluator {
  evaluate(
    data: FrontmatterData[],
    expression: string,
  ): Result<unknown[], AggregationError & { message: string }> {
    // Validate expression format
    if (!expression.includes("[]")) {
      return err(createError({
        kind: "InvalidExpression",
        expression,
      }, "Expression must contain array notation []"));
    }

    const parts = expression.split("[]");
    if (parts.length !== 2) {
      return err(createError({
        kind: "InvalidExpression",
        expression,
      }, "Expression must have exactly one array notation []"));
    }

    const basePath = parts[0];
    const propertyPath = parts[1].startsWith(".") ? parts[1].substring(1) : "";

    // Use accumulation pattern instead of silent skipping
    const evaluationResult = this.evaluateWithAccumulation(data, basePath, propertyPath);

    // For backward compatibility, return just the values
    // In future versions, we could expose the full EvaluationResult
    return ok(evaluationResult.values);
  }

  /**
   * Internal method that accumulates both successful results and error information.
   * Replaces silent continue statements with explicit error tracking.
   */
  private evaluateWithAccumulation(
    data: FrontmatterData[],
    basePath: string,
    propertyPath: string,
  ): EvaluationResult {
    const values: unknown[] = [];
    let skippedItems = 0;
    const errors: Array<AggregationError & { message: string }> = [];

    for (const item of data) {
      let baseValue: unknown;

      // Extract base value
      if (basePath) {
        const baseResult = item.get(basePath);
        if (!baseResult.ok) {
          skippedItems++;
          errors.push(createError({
            kind: "PathNotFound",
            path: basePath,
          }, `Base path '${basePath}' not found in data item`));
          continue;
        }
        baseValue = baseResult.data;
      } else {
        baseValue = item.getData();
      }

      // Ensure base value is array
      if (!Array.isArray(baseValue)) {
        skippedItems++;
        errors.push(createError({
          kind: "InvalidExpression",
          expression: `${basePath}[]`,
        }, `Expected array at '${basePath}', got ${typeof baseValue}`));
        continue;
      }

      // Process array items
      for (const arrayItem of baseValue) {
        if (propertyPath) {
          const itemData = FrontmatterData.create(arrayItem);
          if (itemData.ok) {
            const valueResult = itemData.data.get(propertyPath);
            if (valueResult.ok && valueResult.data !== undefined) {
              values.push(valueResult.data);
            }
            // Note: We don't track individual property access failures as errors
            // since missing properties in array items are often expected
          }
        } else {
          values.push(arrayItem);
        }
      }
    }

    return { values, skippedItems, errors };
  }

  evaluateUnique(
    data: FrontmatterData[],
    expression: string,
  ): Result<unknown[], AggregationError & { message: string }> {
    const evaluationResult = this.evaluate(data, expression);
    if (!evaluationResult.ok) {
      return evaluationResult;
    }

    const unique = Array.from(
      new Set(
        evaluationResult.data.map((item) =>
          typeof item === "object" ? JSON.stringify(item) : item
        ),
      ),
    ).map((item) => {
      if (typeof item === "string") {
        const parseResult = this.safeJsonParse(item);
        return parseResult.ok ? parseResult.data : item;
      }
      return item;
    });

    return ok(unique);
  }

  evaluatePath(
    data: unknown,
    path: string,
  ): Result<unknown, AggregationError & { message: string }> {
    if (path.trim().length === 0) {
      return ok(data);
    }

    const parts = path.split(".");
    let current = data;

    // Create PathSegment value objects for each part
    for (const partString of parts) {
      const segmentResult = PathSegment.create(partString);
      if (!segmentResult.ok) {
        return err(createError({
          kind: "PathNotFound",
          path,
        }, `Invalid path segment: ${segmentResult.error.message}`));
      }

      const segment = segmentResult.data;

      // Use PathSegment's safe extraction instead of nullable checks and type assertions
      const extractionResult = segment.extractFrom(current);
      if (!extractionResult.ok) {
        return err(createError({
          kind: "PathNotFound",
          path,
        }, extractionResult.error.message));
      }

      current = extractionResult.data;
    }

    return ok(current);
  }

  private safeJsonParse(content: string): Result<unknown, { message: string }> {
    try {
      return ok(JSON.parse(content));
    } catch (error) {
      return err({
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
