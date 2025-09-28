import { Result } from "../../shared/types/result.ts";
import { AggregationError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

/**
 * Strategy interface for different aggregation approaches.
 * Defines how multiple frontmatter data sources are combined.
 */
export interface AggregationStrategy {
  /**
   * Returns the strategy type identifier.
   */
  getType(): string;

  /**
   * Combines multiple frontmatter data sources into a single result.
   */
  combine(
    sources: FrontmatterData[],
  ): Result<Record<string, unknown>, AggregationError>;

  /**
   * Checks if this strategy is compatible with the given sources.
   */
  isCompatible(sources: FrontmatterData[]): boolean;

  /**
   * Returns configuration information for this strategy.
   */
  getConfiguration(): StrategyConfiguration;
}

/**
 * Configuration information for aggregation strategies.
 */
export interface StrategyConfiguration {
  readonly name: string;
  readonly description: string;
  readonly supportedSourceTypes: string[];
  readonly minimumSources: number;
  readonly maximumSources?: number;
  readonly requiresSchema?: boolean;
}

/**
 * Array aggregation strategy - combines sources into an array structure.
 * Most basic aggregation approach for multiple documents.
 */
export class ArrayAggregationStrategy implements AggregationStrategy {
  private constructor(private readonly config: Required<ArrayStrategyConfig>) {}

  static create(config: ArrayStrategyConfig = {}): ArrayAggregationStrategy {
    const defaultConfig: Required<ArrayStrategyConfig> = {
      preserveOrder: config.preserveOrder ?? true,
      includeMetadata: config.includeMetadata ?? true,
      arrayKey: config.arrayKey ?? "documents",
    };

    return new ArrayAggregationStrategy(defaultConfig);
  }

  getType(): string {
    return "array";
  }

  combine(
    sources: FrontmatterData[],
  ): Result<Record<string, unknown>, AggregationError> {
    try {
      if (sources.length === 0) {
        return Result.error(
          new AggregationError(
            "Cannot aggregate empty sources array",
            "EMPTY_SOURCES",
            { strategy: this.getType() },
          ),
        );
      }

      const documents = sources.map((source) => source.getData());

      const result: Record<string, unknown> = {
        totalDocuments: sources.length,
      };

      result[this.config.arrayKey] = documents;

      if (this.config.includeMetadata) {
        result.aggregationMetadata = {
          strategy: this.getType(),
          processedAt: new Date().toISOString(),
          sourceCount: sources.length,
          preservedOrder: this.config.preserveOrder,
        };
      }

      return Result.ok(result);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new AggregationError(
          `Array aggregation failed: ${errorMessage}`,
          "AGGREGATION_ERROR",
          { strategy: this.getType(), error },
        ),
      );
    }
  }

  isCompatible(sources: FrontmatterData[]): boolean {
    return sources.length > 0;
  }

  getConfiguration(): StrategyConfiguration {
    return {
      name: "Array Aggregation",
      description: "Combines all sources into a single array structure",
      supportedSourceTypes: ["frontmatter"],
      minimumSources: 1,
      requiresSchema: false,
    };
  }
}

/**
 * Merge aggregation strategy - deeply merges all sources into a single object.
 * Useful when documents have complementary data that should be combined.
 */
export class MergeAggregationStrategy implements AggregationStrategy {
  private constructor(private readonly config: MergeStrategyConfig) {}

  static create(config: MergeStrategyConfig = {}): MergeAggregationStrategy {
    const defaultConfig: Required<MergeStrategyConfig> = {
      conflictResolution: config.conflictResolution ?? "last-wins",
      preserveArrays: config.preserveArrays ?? true,
      deepMerge: config.deepMerge ?? true,
      ...config,
    };

    return new MergeAggregationStrategy(defaultConfig);
  }

  getType(): string {
    return "merge";
  }

  combine(
    sources: FrontmatterData[],
  ): Result<Record<string, unknown>, AggregationError> {
    try {
      if (sources.length === 0) {
        return Result.error(
          new AggregationError(
            "Cannot merge empty sources array",
            "EMPTY_SOURCES",
            { strategy: this.getType() },
          ),
        );
      }

      if (sources.length === 1) {
        return Result.ok(sources[0].getData());
      }

      let merged: Record<string, unknown> = {};

      for (const source of sources) {
        const data = source.getData();
        merged = this.mergeObjects(merged, data);
      }

      return Result.ok(merged);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new AggregationError(
          `Merge aggregation failed: ${errorMessage}`,
          "AGGREGATION_ERROR",
          { strategy: this.getType(), error },
        ),
      );
    }
  }

  private mergeObjects(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (!(key in result)) {
        result[key] = value;
      } else {
        const existingValue = result[key];

        if (
          this.config.deepMerge && this.isObject(existingValue) &&
          this.isObject(value)
        ) {
          result[key] = this.mergeObjects(
            existingValue,
            value,
          );
        } else if (
          this.config.preserveArrays && Array.isArray(existingValue) &&
          Array.isArray(value)
        ) {
          result[key] = [...existingValue, ...value];
        } else {
          // Apply conflict resolution
          switch (this.config.conflictResolution) {
            case "first-wins":
              // Keep existing value
              break;
            case "last-wins":
              result[key] = value;
              break;
            case "array-combine":
              result[key] = Array.isArray(existingValue)
                ? [...existingValue, value]
                : [existingValue, value];
              break;
          }
        }
      }
    }

    return result;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  isCompatible(sources: FrontmatterData[]): boolean {
    return sources.length > 0;
  }

  getConfiguration(): StrategyConfiguration {
    return {
      name: "Merge Aggregation",
      description: "Deeply merges all sources into a single object",
      supportedSourceTypes: ["frontmatter"],
      minimumSources: 1,
      requiresSchema: false,
    };
  }
}

/**
 * Single source strategy - for processing individual documents.
 * Returns the source data directly without aggregation.
 */
export class SingleSourceStrategy implements AggregationStrategy {
  private constructor() {}

  static create(): SingleSourceStrategy {
    return new SingleSourceStrategy();
  }

  getType(): string {
    return "single";
  }

  combine(
    sources: FrontmatterData[],
  ): Result<Record<string, unknown>, AggregationError> {
    if (sources.length !== 1) {
      return Result.error(
        new AggregationError(
          `Single source strategy requires exactly 1 source, got ${sources.length}`,
          "INVALID_SOURCE_COUNT",
          { strategy: this.getType(), sourceCount: sources.length },
        ),
      );
    }

    return Result.ok(sources[0].getData());
  }

  isCompatible(sources: FrontmatterData[]): boolean {
    return sources.length === 1;
  }

  getConfiguration(): StrategyConfiguration {
    return {
      name: "Single Source",
      description: "Returns single source data without aggregation",
      supportedSourceTypes: ["frontmatter"],
      minimumSources: 1,
      maximumSources: 1,
      requiresSchema: false,
    };
  }
}

/**
 * Configuration for array aggregation strategy.
 */
export interface ArrayStrategyConfig {
  readonly preserveOrder?: boolean;
  readonly includeMetadata?: boolean;
  readonly arrayKey?: string;
}

/**
 * Configuration for merge aggregation strategy.
 */
export interface MergeStrategyConfig {
  readonly conflictResolution?: "first-wins" | "last-wins" | "array-combine";
  readonly preserveArrays?: boolean;
  readonly deepMerge?: boolean;
}
