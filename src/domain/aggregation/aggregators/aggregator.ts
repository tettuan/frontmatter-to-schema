import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { DerivationRule } from "../value-objects/derivation-rule.ts";
import { ExpressionEvaluator } from "../services/expression-evaluator.ts";

export interface AggregatedResult {
  readonly baseData: FrontmatterData;
  readonly derivedFields: Record<string, unknown>;
}

export class Aggregator {
  private readonly evaluator = new ExpressionEvaluator();

  aggregate(
    data: FrontmatterData[],
    rules: DerivationRule[],
    baseData?: FrontmatterData,
  ): Result<AggregatedResult, AggregationError & { message: string }> {
    const derivedFields: Record<string, unknown> = {};
    const base = baseData || FrontmatterData.empty();

    for (const rule of rules) {
      const evaluationResult = rule.isUnique()
        ? this.evaluator.evaluateUnique(data, rule.getSourceExpression())
        : this.evaluator.evaluate(data, rule.getSourceExpression());

      if (!evaluationResult.ok) {
        return err(createError({
          kind: "AggregationFailed",
          message:
            `Failed to evaluate rule ${rule.toString()}: ${evaluationResult.error.message}`,
        }));
      }

      derivedFields[rule.getTargetField()] = evaluationResult.data;
    }

    return ok({
      baseData: base,
      derivedFields,
    });
  }

  mergeWithBase(
    result: AggregatedResult,
  ): Result<FrontmatterData, AggregationError & { message: string }> {
    let merged = result.baseData;

    for (const [field, value] of Object.entries(result.derivedFields)) {
      merged = merged.withField(field, value);
    }

    return ok(merged);
  }

  aggregateMultiple(
    dataGroups: FrontmatterData[][],
    rules: DerivationRule[],
  ): Result<FrontmatterData[], AggregationError & { message: string }> {
    const results: FrontmatterData[] = [];

    for (const group of dataGroups) {
      if (group.length === 0) continue;

      const aggregationResult = this.aggregate(group, rules);
      if (!aggregationResult.ok) {
        return aggregationResult;
      }

      const mergeResult = this.mergeWithBase(aggregationResult.data);
      if (!mergeResult.ok) {
        return mergeResult;
      }

      results.push(mergeResult.data);
    }

    return ok(results);
  }

  extractFromArray(
    data: FrontmatterData[],
    arrayPath: string,
  ): Result<FrontmatterData[], AggregationError & { message: string }> {
    const results: FrontmatterData[] = [];

    for (const item of data) {
      const arrayValue = item.get(arrayPath);
      if (Array.isArray(arrayValue)) {
        for (const arrayItem of arrayValue) {
          const itemResult = FrontmatterData.create(arrayItem);
          if (itemResult.ok) {
            results.push(itemResult.data);
          }
        }
      }
    }

    return ok(results);
  }
}
