import { Result } from "../../shared/types/result.ts";
import { AggregationError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { AggregationStrategy } from "../services/aggregation-strategy.ts";
import { AggregationId } from "../value-objects/aggregation-id.ts";

/**
 * Aggregation entity representing a collection of processed frontmatter data.
 * Coordinates the combination and transformation of multiple document sources.
 */
export class Aggregation {
  private constructor(
    private readonly id: AggregationId,
    private readonly sources: FrontmatterData[],
    private readonly strategy: AggregationStrategy,
    private readonly metadata: AggregationMetadata,
  ) {}

  /**
   * Creates an Aggregation from frontmatter sources and strategy.
   */
  static create(
    sources: FrontmatterData[],
    strategy: AggregationStrategy,
    options: AggregationOptions = {},
  ): Result<Aggregation, AggregationError> {
    if (sources.length === 0) {
      return Result.error(
        new AggregationError(
          "Cannot create aggregation with empty sources",
          "EMPTY_SOURCES",
          { sources },
        ),
      );
    }

    const id = AggregationId.generate();
    const metadata = AggregationMetadata.create({
      sourceCount: sources.length,
      createdAt: new Date(),
      strategyType: strategy.getType(),
      executionTime: 0,
      version: "1.0.0",
      ...options.metadata,
    });

    return Result.ok(new Aggregation(id, sources, strategy, metadata));
  }

  /**
   * Executes the aggregation strategy to combine all sources.
   */
  aggregate(): Result<AggregationResult, AggregationError> {
    try {
      const startTime = performance.now();

      const strategyResult = this.strategy.combine(this.sources);
      if (strategyResult.isError()) {
        return Result.error(
          new AggregationError(
            `Aggregation strategy failed: ${strategyResult.unwrapError().message}`,
            "STRATEGY_ERROR",
            { id: this.id.toString(), strategy: this.strategy.getType() },
          ),
        );
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      return Result.ok({
        id: this.id,
        data: strategyResult.unwrap(),
        metadata: this.metadata.withExecutionTime(executionTime),
        sourceCount: this.sources.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new AggregationError(
          `Aggregation execution failed: ${errorMessage}`,
          "EXECUTION_ERROR",
          { id: this.id.toString(), error },
        ),
      );
    }
  }

  /**
   * Returns the aggregation ID.
   */
  getId(): AggregationId {
    return this.id;
  }

  /**
   * Returns the number of source documents.
   */
  getSourceCount(): number {
    return this.sources.length;
  }

  /**
   * Returns the aggregation strategy type.
   */
  getStrategyType(): string {
    return this.strategy.getType();
  }

  /**
   * Returns aggregation metadata.
   */
  getMetadata(): AggregationMetadata {
    return this.metadata;
  }

  /**
   * Checks if this aggregation can handle the given sources.
   */
  canProcess(sources: FrontmatterData[]): boolean {
    return this.strategy.isCompatible(sources);
  }

  /**
   * Returns a string representation of the aggregation.
   */
  toString(): string {
    return `Aggregation(${this.id.toString()}, ${this.sources.length} sources, ${this.strategy.getType()})`;
  }

  /**
   * Compares this aggregation with another for equality based on ID.
   */
  equals(other: Aggregation): boolean {
    return this.id.equals(other.id);
  }
}

/**
 * Options for creating an aggregation.
 */
export interface AggregationOptions {
  readonly metadata?: Partial<AggregationMetadataData>;
}

/**
 * Result of aggregation execution.
 */
export interface AggregationResult {
  readonly id: AggregationId;
  readonly data: Record<string, unknown>;
  readonly metadata: AggregationMetadata;
  readonly sourceCount: number;
}

/**
 * Aggregation metadata containing execution information.
 */
export class AggregationMetadata {
  private constructor(private readonly data: AggregationMetadataData) {}

  static create(data: AggregationMetadataData): AggregationMetadata {
    return new AggregationMetadata({
      sourceCount: data.sourceCount,
      createdAt: data.createdAt,
      strategyType: data.strategyType,
      executionTime: data.executionTime || 0,
      version: data.version || "1.0.0",
    });
  }

  withExecutionTime(executionTime: number): AggregationMetadata {
    return new AggregationMetadata({
      ...this.data,
      executionTime,
    });
  }

  getSourceCount(): number {
    return this.data.sourceCount;
  }

  getCreatedAt(): Date {
    return this.data.createdAt;
  }

  getStrategyType(): string {
    return this.data.strategyType;
  }

  getExecutionTime(): number {
    return this.data.executionTime;
  }

  getVersion(): string {
    return this.data.version;
  }

  toJSON(): AggregationMetadataData {
    return { ...this.data };
  }
}

/**
 * Internal data structure for aggregation metadata.
 */
interface AggregationMetadataData {
  readonly sourceCount: number;
  readonly createdAt: Date;
  readonly strategyType: string;
  readonly executionTime: number;
  readonly version: string;
}
