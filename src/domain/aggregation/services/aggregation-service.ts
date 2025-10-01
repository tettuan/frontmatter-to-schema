import { Result } from "../../shared/types/result.ts";
import { AggregationError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import {
  Aggregation,
  AggregationOptions,
  AggregationResult,
} from "../entities/aggregation.ts";
import {
  AggregationStrategy,
  ArrayAggregationStrategy,
  MergeAggregationStrategy,
  SingleSourceStrategy,
} from "./aggregation-strategy.ts";

/**
 * Domain service for managing document aggregation.
 * Coordinates strategy selection and aggregation execution.
 */
export class AggregationService {
  private constructor(
    private readonly strategies: Map<string, AggregationStrategy>,
  ) {}

  /**
   * Creates an AggregationService with default strategies.
   */
  static create(): Result<AggregationService, AggregationError> {
    try {
      const strategies = new Map<string, AggregationStrategy>();

      // Register default strategies
      strategies.set("single", SingleSourceStrategy.create());
      strategies.set("array", ArrayAggregationStrategy.create());
      strategies.set("merge", MergeAggregationStrategy.create());

      return Result.ok(new AggregationService(strategies));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new AggregationError(
          `Failed to create AggregationService: ${errorMessage}`,
          "INITIALIZATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Creates an AggregationService with custom strategies.
   */
  static createWithStrategies(
    strategies: Record<string, AggregationStrategy>,
  ): Result<AggregationService, AggregationError> {
    try {
      const strategyMap = new Map<string, AggregationStrategy>();

      for (const [key, strategy] of Object.entries(strategies)) {
        if (!strategy || typeof strategy.getType !== "function") {
          return Result.error(
            new AggregationError(
              `Invalid strategy for key '${key}': must implement AggregationStrategy interface`,
              "INVALID_STRATEGY",
              { key, strategy },
            ),
          );
        }
        strategyMap.set(key, strategy);
      }

      return Result.ok(new AggregationService(strategyMap));
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new AggregationError(
          `Failed to create AggregationService with custom strategies: ${errorMessage}`,
          "INITIALIZATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Aggregates frontmatter data using the specified strategy.
   */
  aggregate(
    sources: FrontmatterData[],
    strategyType: string,
    options: AggregationOptions = {},
  ): Result<AggregationResult, AggregationError> {
    // Validate inputs
    if (!Array.isArray(sources)) {
      return Result.error(
        new AggregationError(
          "Sources must be an array",
          "INVALID_SOURCES",
          { sources },
        ),
      );
    }

    if (sources.length === 0) {
      return Result.error(
        new AggregationError(
          "Cannot aggregate empty sources array",
          "EMPTY_SOURCES",
          { strategyType },
        ),
      );
    }

    // Get strategy
    const strategy = this.strategies.get(strategyType);
    if (!strategy) {
      return Result.error(
        new AggregationError(
          `Unknown aggregation strategy: ${strategyType}`,
          "UNKNOWN_STRATEGY",
          {
            strategyType,
            availableStrategies: Array.from(this.strategies.keys()),
          },
        ),
      );
    }

    // Check compatibility
    if (!strategy.isCompatible(sources)) {
      return Result.error(
        new AggregationError(
          `Strategy '${strategyType}' is not compatible with provided sources`,
          "INCOMPATIBLE_STRATEGY",
          { strategyType, sourceCount: sources.length },
        ),
      );
    }

    // Create and execute aggregation
    const aggregationResult = Aggregation.create(sources, strategy, options);
    if (aggregationResult.isError()) {
      return Result.error(aggregationResult.unwrapError());
    }

    const aggregation = aggregationResult.unwrap();
    return aggregation.aggregate();
  }

  /**
   * Automatically selects and applies the best strategy for the given sources.
   */
  autoAggregate(
    sources: FrontmatterData[],
    options: AggregationOptions = {},
  ): Result<AggregationResult, AggregationError> {
    const strategyType = this.selectBestStrategy(sources);
    return this.aggregate(sources, strategyType, options);
  }

  /**
   * Selects the best aggregation strategy based on source characteristics.
   */
  selectBestStrategy(sources: FrontmatterData[]): string {
    if (sources.length === 0) {
      return "array"; // Default fallback
    }

    if (sources.length === 1) {
      return "single";
    }

    // For multiple sources, prefer array aggregation by default
    // This could be enhanced with more sophisticated logic
    return "array";
  }

  /**
   * Registers a new aggregation strategy.
   */
  registerStrategy(
    name: string,
    strategy: AggregationStrategy,
  ): Result<void, AggregationError> {
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Result.error(
        new AggregationError(
          "Strategy name must be a non-empty string",
          "INVALID_STRATEGY_NAME",
          { name },
        ),
      );
    }

    if (!strategy || typeof strategy.getType !== "function") {
      return Result.error(
        new AggregationError(
          "Strategy must implement AggregationStrategy interface",
          "INVALID_STRATEGY",
          { name, strategy },
        ),
      );
    }

    this.strategies.set(name.trim(), strategy);
    return Result.ok(undefined);
  }

  /**
   * Removes a registered strategy.
   */
  unregisterStrategy(name: string): Result<boolean, AggregationError> {
    if (!name || typeof name !== "string") {
      return Result.error(
        new AggregationError(
          "Strategy name must be a string",
          "INVALID_STRATEGY_NAME",
          { name },
        ),
      );
    }

    const existed = this.strategies.has(name);
    this.strategies.delete(name);
    return Result.ok(existed);
  }

  /**
   * Returns all available strategy types.
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Gets configuration for a specific strategy.
   */
  getStrategyConfiguration(name: string): Result<any, AggregationError> {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      return Result.error(
        new AggregationError(
          `Strategy '${name}' not found`,
          "STRATEGY_NOT_FOUND",
          { name, availableStrategies: this.getAvailableStrategies() },
        ),
      );
    }

    return Result.ok(strategy.getConfiguration());
  }

  /**
   * Validates that the service is properly configured.
   */
  validateConfiguration(): Result<ValidationResult, AggregationError> {
    const issues: string[] = [];
    const strategies = this.getAvailableStrategies();

    if (strategies.length === 0) {
      issues.push("No aggregation strategies registered");
    }

    // Check for required strategies
    const requiredStrategies = ["single", "array"];
    for (const required of requiredStrategies) {
      if (!strategies.includes(required)) {
        issues.push(`Missing required strategy: ${required}`);
      }
    }

    const isValid = issues.length === 0;
    return Result.ok({
      isValid,
      issues,
      registeredStrategies: strategies,
    });
  }
}

/**
 * Result of service validation.
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly issues: string[];
  readonly registeredStrategies: string[];
}
