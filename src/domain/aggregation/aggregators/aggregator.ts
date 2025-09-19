import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";
import { DerivationRule } from "../value-objects/derivation-rule.ts";
import { ExpressionEvaluator } from "../services/expression-evaluator.ts";
import {
  CircuitBreaker,
  CircuitBreakerConfigurationState,
  CircuitBreakerFactory,
} from "../services/circuit-breaker.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

export interface AggregatedResult {
  readonly baseData: FrontmatterData;
  readonly derivedFields: Record<string, unknown>;
}

export class Aggregator {
  private readonly evaluator = new ExpressionEvaluator();
  private readonly circuitBreakerState: CircuitBreakerConfigurationState;
  private readonly circuitBreaker?: CircuitBreaker;

  constructor(circuitBreakerState?: CircuitBreakerConfigurationState) {
    this.circuitBreakerState = circuitBreakerState ??
      CircuitBreakerFactory.createStandard();

    // Only create CircuitBreaker if not disabled
    if (this.circuitBreakerState.kind !== "disabled") {
      this.circuitBreaker = new CircuitBreaker(this.circuitBreakerState.config);
    }
  }

  /**
   * Factory method for creating Aggregator with disabled circuit breaker
   */
  static createWithDisabledCircuitBreaker(): Aggregator {
    return new Aggregator(CircuitBreakerFactory.createDisabled());
  }

  /**
   * Factory method for creating Aggregator with standard circuit breaker configuration
   */
  static createWithStandardCircuitBreaker(): Aggregator {
    return new Aggregator(CircuitBreakerFactory.createStandard());
  }

  /**
   * Factory method for creating Aggregator with high-throughput circuit breaker configuration
   */
  static createWithHighThroughputCircuitBreaker(): Aggregator {
    return new Aggregator(CircuitBreakerFactory.createHighThroughput());
  }

  /**
   * Factory method for creating Aggregator with low-latency circuit breaker configuration
   */
  static createWithLowLatencyCircuitBreaker(): Aggregator {
    return new Aggregator(CircuitBreakerFactory.createLowLatency());
  }

  /**
   * Factory method for creating Aggregator with custom circuit breaker configuration
   */
  static createWithCustomCircuitBreaker(
    circuitBreakerState: CircuitBreakerConfigurationState,
  ): Aggregator {
    return new Aggregator(circuitBreakerState);
  }

  /**
   * @deprecated Use factory methods instead. This constructor will be removed in the next version.
   * Use Aggregator.createWithStandardCircuitBreaker() for equivalent behavior.
   */
  static create(): Aggregator {
    return new Aggregator(CircuitBreakerFactory.createStandard());
  }

  aggregate(
    data: FrontmatterData[],
    rules: DerivationRule[],
    baseData?: FrontmatterData,
  ): Result<AggregatedResult, AggregationError & { message: string }> {
    // Circuit breaker check before processing (only if enabled)
    if (this.circuitBreaker) {
      const canProcessResult = this.circuitBreaker.canProcess(
        data.length,
        rules.length,
      );
      if (!canProcessResult.ok) {
        return canProcessResult;
      }
    }

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
        const errorMessage =
          `Failed to evaluate rule ${rule.toString()}: ${evaluationResult.error.message}`;
        if (this.circuitBreaker) {
          this.circuitBreaker.recordFailure(errorMessage);
        }
        return err(createError({
          kind: "AggregationFailed",
          message: errorMessage,
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
    if (typeof globalThis !== "undefined") {
      const globalResult = SafePropertyAccess.asRecord(globalThis);
      if (
        globalResult.ok &&
        SafePropertyAccess.hasProperty(
          globalResult.data,
          "DEBUG_PERFORMANCE",
        ) &&
        Boolean(
          SafePropertyAccess.getProperty(
            globalResult.data,
            "DEBUG_PERFORMANCE",
          ),
        )
      ) {
        console.debug("[PERF-AGGREGATION]", JSON.stringify(performanceMetrics));
      }
    }

    // Record success in circuit breaker (only if enabled)
    if (this.circuitBreaker) {
      this.circuitBreaker.recordSuccess(
        processingTime,
        Math.round(memoryDelta / 1024 / 1024 * 100) / 100,
      );
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
