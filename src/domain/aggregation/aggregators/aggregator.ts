import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";
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
    // Performance variance monitoring for aggregation
    const aggregationStartTime = performance.now();
    const initialMemory = Deno.memoryUsage();

    // Debug: Track aggregation scale and complexity
    const aggregationMetrics = {
      datasetSize: data.length,
      rulesCount: rules.length,
      estimatedComplexity: data.length * rules.length,
      hasBaseData: !!baseData,
      memoryAtStart: Math.round(initialMemory.heapUsed / 1024 / 1024),
    };

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

    // Performance variance monitoring - END
    const aggregationEndTime = performance.now();
    const finalMemory = Deno.memoryUsage();
    const processingTime = aggregationEndTime - aggregationStartTime;
    const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;

    // Debug: Log performance metrics for variance analysis
    const performanceMetrics = {
      ...aggregationMetrics,
      processingTimeMs: Math.round(processingTime * 100) / 100,
      memoryDeltaMB: Math.round(memoryDelta / 1024 / 1024 * 100) / 100,
      memoryAtEnd: Math.round(finalMemory.heapUsed / 1024 / 1024),
      throughputItemsPerMs: data.length / processingTime,
    };

    // Log performance data for analysis (conditional on debug mode)
    if (
      typeof globalThis !== "undefined" && (globalThis as any).DEBUG_PERFORMANCE
    ) {
      console.debug("[PERF-AGGREGATION]", JSON.stringify(performanceMetrics));
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
          const itemResult = FrontmatterDataFactory.fromParsedData(arrayItem);
          if (itemResult.ok) {
            results.push(itemResult.data);
          }
        }
      }
    }

    return ok(results);
  }
}
