/**
 * @fileoverview Array Merger Domain Service - Implementation of x-merge-arrays directive
 * @description Implements Issue #898: x-merge-arrays directive for flattening arrays from multiple files
 *
 * Following DDD and Totality principles:
 * - Smart Constructor pattern
 * - Result<T,E> error handling
 * - Discriminated union for merge strategies
 * - Immutable value objects
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { AggregationError, createError } from "../../shared/types/errors.ts";

/**
 * Merge strategy using discriminated union (Totality principle)
 */
export type ArrayMergeStrategy =
  | { readonly kind: "flatten" }
  | { readonly kind: "preserve" };

/**
 * Array merge configuration value object
 */
export class ArrayMergeConfig {
  private constructor(
    private readonly strategy: ArrayMergeStrategy,
    private readonly preserveOrder: boolean,
    private readonly filterEmpty: boolean,
  ) {}

  /**
   * Smart Constructor for flattening merge (x-merge-arrays: true)
   */
  static createFlattening(options: {
    preserveOrder?: boolean;
    filterEmpty?: boolean;
  } = {}): ArrayMergeConfig {
    return new ArrayMergeConfig(
      { kind: "flatten" },
      options.preserveOrder ?? true,
      options.filterEmpty ?? true,
    );
  }

  /**
   * Smart Constructor for preserving merge (x-merge-arrays: false)
   */
  static createPreserving(options: {
    preserveOrder?: boolean;
    filterEmpty?: boolean;
  } = {}): ArrayMergeConfig {
    return new ArrayMergeConfig(
      { kind: "preserve" },
      options.preserveOrder ?? true,
      options.filterEmpty ?? true,
    );
  }

  getStrategy(): ArrayMergeStrategy {
    return this.strategy;
  }

  shouldPreserveOrder(): boolean {
    return this.preserveOrder;
  }

  shouldFilterEmpty(): boolean {
    return this.filterEmpty;
  }

  toString(): string {
    return `ArrayMergeConfig(${this.strategy.kind}, order=${this.preserveOrder}, filter=${this.filterEmpty})`;
  }
}

/**
 * Array merge result value object
 */
export class ArrayMergeResult {
  private constructor(
    private readonly mergedData: unknown[],
    private readonly sourceCount: number,
    private readonly itemCount: number,
    private readonly strategy: ArrayMergeStrategy,
  ) {}

  static create(
    mergedData: unknown[],
    sourceCount: number,
    itemCount: number,
    strategy: ArrayMergeStrategy,
  ): ArrayMergeResult {
    return new ArrayMergeResult(mergedData, sourceCount, itemCount, strategy);
  }

  getData(): unknown[] {
    return [...this.mergedData]; // Return copy to maintain immutability
  }

  getSourceCount(): number {
    return this.sourceCount;
  }

  getItemCount(): number {
    return this.itemCount;
  }

  getStrategy(): ArrayMergeStrategy {
    return this.strategy;
  }

  toString(): string {
    return `ArrayMergeResult(${this.itemCount} items from ${this.sourceCount} sources, strategy=${this.strategy.kind})`;
  }
}

/**
 * Array Merger Domain Service
 *
 * Implements x-merge-arrays directive functionality:
 * - x-merge-arrays: true  → Flatten arrays: [["A", "B"], ["C"]] → ["A", "B", "C"]
 * - x-merge-arrays: false → Preserve arrays: [["A", "B"], ["C"]] → [["A", "B"], ["C"]]
 *
 * Following DDD principles:
 * - Single responsibility: Array merging logic
 * - Domain-specific error handling
 * - Immutable operations
 */
export class ArrayMerger {
  /**
   * Smart Constructor following Totality principle
   */
  static create(): Result<ArrayMerger, AggregationError & { message: string }> {
    return ok(new ArrayMerger());
  }

  private constructor() {}

  /**
   * Merge arrays based on x-merge-arrays directive
   * Total function returning Result<T,E>
   */
  merge(
    sourceArrays: unknown[][],
    config: ArrayMergeConfig,
  ): Result<ArrayMergeResult, AggregationError & { message: string }> {
    try {
      // Validate input
      if (!Array.isArray(sourceArrays)) {
        return err(createError({
          kind: "AggregationFailed",
          message: "Source data must be an array of arrays",
        }));
      }

      // Filter empty arrays if configured
      const filteredArrays = config.shouldFilterEmpty()
        ? sourceArrays.filter((arr) => Array.isArray(arr) && arr.length > 0)
        : sourceArrays.filter((arr) => Array.isArray(arr));

      const strategy = config.getStrategy();

      // Process based on strategy (exhaustive switch - Totality principle)
      switch (strategy.kind) {
        case "flatten": {
          const result = this.flattenArrays(filteredArrays, config);
          return ok(ArrayMergeResult.create(
            result,
            sourceArrays.length,
            result.length,
            strategy,
          ));
        }
        case "preserve": {
          const result = this.preserveArrays(filteredArrays, config);
          return ok(ArrayMergeResult.create(
            result,
            sourceArrays.length,
            this.countTotalItems(result),
            strategy,
          ));
        }
      }
    } catch (error) {
      return err(createError({
        kind: "AggregationFailed",
        message: `Array merge failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  /**
   * Flatten arrays into a single array
   * Implementation for x-merge-arrays: true
   */
  private flattenArrays(
    sourceArrays: unknown[][],
    config: ArrayMergeConfig,
  ): unknown[] {
    if (sourceArrays.length === 0) {
      return [];
    }

    // Flatten all arrays into a single array
    const flattened: unknown[] = [];

    if (config.shouldPreserveOrder()) {
      // Preserve source order: process arrays in sequence
      for (const sourceArray of sourceArrays) {
        if (Array.isArray(sourceArray)) {
          flattened.push(...sourceArray);
        }
      }
    } else {
      // Alternative: could implement different ordering strategies here
      for (const sourceArray of sourceArrays) {
        if (Array.isArray(sourceArray)) {
          flattened.push(...sourceArray);
        }
      }
    }

    return flattened;
  }

  /**
   * Preserve array structure
   * Implementation for x-merge-arrays: false
   */
  private preserveArrays(
    sourceArrays: unknown[][],
    config: ArrayMergeConfig,
  ): unknown[][] {
    if (sourceArrays.length === 0) {
      return [];
    }

    if (config.shouldPreserveOrder()) {
      // Return arrays in original order
      return sourceArrays.map((arr) => [...arr]); // Deep copy for immutability
    } else {
      // Alternative: could implement different ordering strategies
      return sourceArrays.map((arr) => [...arr]);
    }
  }

  /**
   * Count total items across all arrays
   */
  private countTotalItems(arrays: unknown[][]): number {
    return arrays.reduce(
      (total, arr) => total + (Array.isArray(arr) ? arr.length : 0),
      0,
    );
  }

  /**
   * Merge arrays from multiple frontmatter data sources
   * High-level interface for aggregation integration
   */
  mergeFromSources(
    sources: Array<{ data: unknown; path?: string }>,
    arrayPath: string,
    config: ArrayMergeConfig,
  ): Result<ArrayMergeResult, AggregationError & { message: string }> {
    try {
      // Extract arrays from each source
      const sourceArrays: unknown[][] = [];

      for (const source of sources) {
        const extracted = this.extractArrayFromSource(source.data, arrayPath);
        if (extracted.ok) {
          sourceArrays.push(extracted.data);
        } else {
          // Note: Failed to extract array from source, continuing with empty array
          // Error is handled through Result pattern - no logging needed here
          sourceArrays.push([]); // Add empty array to maintain source count
        }
      }

      return this.merge(sourceArrays, config);
    } catch (error) {
      return err(createError({
        kind: "AggregationFailed",
        message: `Failed to merge arrays from sources: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  /**
   * Extract array from source data using path
   */
  private extractArrayFromSource(
    data: unknown,
    path: string,
  ): Result<unknown[], AggregationError & { message: string }> {
    if (!data || typeof data !== "object") {
      return ok([]); // Return empty array for non-object data
    }

    try {
      // Simple path traversal for now (could be enhanced with proper path parsing)
      let current: unknown = data;
      const segments = path.split(".");

      for (const segment of segments) {
        if (current === null || current === undefined) {
          return ok([]);
        }

        if (typeof current !== "object") {
          return ok([]);
        }

        current = (current as Record<string, unknown>)[segment];
      }

      // Ensure result is an array
      if (Array.isArray(current)) {
        return ok(current);
      } else if (current !== null && current !== undefined) {
        // Wrap non-array values in array
        return ok([current]);
      } else {
        return ok([]);
      }
    } catch (error) {
      return err(createError({
        kind: "AggregationFailed",
        message: `Failed to extract array at path "${path}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }
}
