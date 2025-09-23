import { ok, Result } from "../../shared/types/result.ts";
import { AggregationError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
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
import {
  DomainLogger,
  NullDomainLogger,
} from "../../shared/services/domain-logger.ts";

export interface AggregatedResult {
  readonly baseData: FrontmatterData;
  readonly derivedFields: Record<string, unknown>;
}

export class Aggregator {
  private readonly evaluator = new ExpressionEvaluator();
  private readonly circuitBreakerState: CircuitBreakerConfigurationState;
  private readonly circuitBreaker?: CircuitBreaker;
  private readonly logger: DomainLogger;

  private constructor(
    circuitBreakerState: CircuitBreakerConfigurationState,
    circuitBreaker?: CircuitBreaker,
    logger?: DomainLogger,
  ) {
    this.circuitBreakerState = circuitBreakerState;
    this.circuitBreaker = circuitBreaker;
    this.logger = logger ?? new NullDomainLogger();
  }

  /**
   * Smart constructor following Totality principle
   */
  static create(
    circuitBreakerState?: CircuitBreakerConfigurationState,
    logger?: DomainLogger,
  ): Result<Aggregator, AggregationError & { message: string }> {
    let finalCircuitBreakerState: CircuitBreakerConfigurationState;

    if (circuitBreakerState) {
      finalCircuitBreakerState = circuitBreakerState;
    } else {
      const standardStateResult = CircuitBreakerFactory.createStandard();
      if (!standardStateResult.ok) {
        return standardStateResult;
      }
      finalCircuitBreakerState = standardStateResult.data;
    }

    // Note: ArrayMerger has been deprecated and removed

    // Create CircuitBreaker if not disabled
    let circuitBreaker: CircuitBreaker | undefined;
    if (finalCircuitBreakerState.kind !== "disabled") {
      const circuitBreakerResult = CircuitBreaker.create(
        finalCircuitBreakerState.config,
      );
      if (!circuitBreakerResult.ok) {
        return ErrorHandler.aggregation({
          operation: "create",
          method: "initializeCircuitBreaker",
        }).aggregationFailed(
          `Failed to create CircuitBreaker: ${circuitBreakerResult.error.message}`,
        );
      }
      circuitBreaker = circuitBreakerResult.data;
    }

    return ok(
      new Aggregator(
        finalCircuitBreakerState,
        circuitBreaker,
        logger,
      ),
    );
  }

  /**
   * Factory method for creating Aggregator with disabled circuit breaker
   */
  static createWithDisabledCircuitBreaker(): Result<
    Aggregator,
    AggregationError & { message: string }
  > {
    return Aggregator.create(CircuitBreakerFactory.createDisabled());
  }

  /**
   * Factory method for creating Aggregator with standard circuit breaker configuration
   */
  static createWithStandardCircuitBreaker(): Result<
    Aggregator,
    AggregationError & { message: string }
  > {
    const stateResult = CircuitBreakerFactory.createStandard();
    if (!stateResult.ok) {
      return stateResult;
    }
    return Aggregator.create(stateResult.data);
  }

  /**
   * Factory method for creating Aggregator with high-throughput circuit breaker configuration
   */
  static createWithHighThroughputCircuitBreaker(): Result<
    Aggregator,
    AggregationError & { message: string }
  > {
    const stateResult = CircuitBreakerFactory.createHighThroughput();
    if (!stateResult.ok) {
      return stateResult;
    }
    return Aggregator.create(stateResult.data);
  }

  /**
   * Factory method for creating Aggregator with low-latency circuit breaker configuration
   */
  static createWithLowLatencyCircuitBreaker(): Result<
    Aggregator,
    AggregationError & { message: string }
  > {
    const stateResult = CircuitBreakerFactory.createLowLatency();
    if (!stateResult.ok) {
      return stateResult;
    }
    return Aggregator.create(stateResult.data);
  }

  /**
   * Factory method for creating Aggregator with custom circuit breaker configuration
   */
  static createWithCustomCircuitBreaker(
    circuitBreakerState: CircuitBreakerConfigurationState,
  ): Result<Aggregator, AggregationError & { message: string }> {
    return Aggregator.create(circuitBreakerState);
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
        return ErrorHandler.aggregation({
          operation: "aggregate",
          method: "evaluateRule",
        }).aggregationFailed(errorMessage);
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
        this.logger.logDebug(
          "performance-metrics",
          "Aggregation performance metrics collected",
          { performanceMetrics },
        );
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

  /**
   * Merge arrays functionality
   * Implements Issue #898: Array merging functionality
   */
  mergeArrays(
    sourceArrays: unknown[][],
    mergeConfig: {
      flatten: boolean;
      preserveOrder?: boolean;
      filterEmpty?: boolean;
    },
  ): Result<unknown[], AggregationError & { message: string }> {
    // Simplified array merging
    if (mergeConfig.flatten) {
      const flattened = sourceArrays.flat();
      return ok(
        mergeConfig.filterEmpty
          ? flattened.filter((item) => item != null)
          : flattened,
      );
    } else {
      // Preserve array structure
      return ok(
        mergeConfig.filterEmpty
          ? sourceArrays.filter((arr) => arr.length > 0)
          : sourceArrays,
      );
    }
  }

  /**
   * Merge arrays from frontmatter data sources with schema-defined configuration
   * Integrates with existing aggregation workflow
   */
  mergeArraysFromSources(
    data: FrontmatterData[],
    arrayPath: string,
    mergeConfig: {
      flatten: boolean;
      preserveOrder?: boolean;
      filterEmpty?: boolean;
    },
  ): Result<unknown[], AggregationError & { message: string }> {
    // Extract arrays from each source
    const sources = data.map((item, index) => ({
      data: item.getData(),
      path: `source-${index}`,
    }));

    // Simplified array merging
    // Extract arrays from sources at the specified path
    const extractedArrays: unknown[][] = [];
    for (const source of sources) {
      try {
        const pathResult = SafePropertyAccess.navigatePath(
          source.data,
          arrayPath.split("."),
        );
        if (pathResult.ok && Array.isArray(pathResult.data)) {
          extractedArrays.push(pathResult.data);
        }
      } catch (_error) {
        // Skip invalid sources
        continue;
      }
    }

    if (mergeConfig.flatten) {
      const flattened = extractedArrays.flat();
      return ok(
        mergeConfig.filterEmpty
          ? flattened.filter((item) => item != null)
          : flattened,
      );
    } else {
      // Preserve array structure
      return ok(
        mergeConfig.filterEmpty
          ? extractedArrays.filter((arr) => arr.length > 0)
          : extractedArrays,
      );
    }
  }
}
