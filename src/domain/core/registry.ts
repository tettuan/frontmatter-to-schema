/**
 * Generic registry for managing analysis results
 */

import type { AnalysisResult } from './types.ts';
import type { Transformer } from './interfaces.ts';

/**
 * Registry aggregates analysis results and provides transformation capabilities
 */
export class Registry<T = unknown> {
  private results = new Map<string, AnalysisResult<T>>();

  /**
   * Adds an analysis result to the registry
   */
  add(key: string, result: AnalysisResult<T>): void {
    this.results.set(key, result);
  }

  /**
   * Gets a specific result by key
   */
  get(key: string): AnalysisResult<T> | undefined {
    return this.results.get(key);
  }

  /**
   * Checks if a key exists
   */
  has(key: string): boolean {
    return this.results.has(key);
  }

  /**
   * Gets all keys
   */
  keys(): string[] {
    return Array.from(this.results.keys());
  }

  /**
   * Gets all results
   */
  values(): AnalysisResult<T>[] {
    return Array.from(this.results.values());
  }

  /**
   * Gets the number of results
   */
  size(): number {
    return this.results.size;
  }

  /**
   * Clears all results
   */
  clear(): void {
    this.results.clear();
  }

  /**
   * Transforms the registry using a transformer
   */
  transform<U>(transformer: Transformer<T, U>): U {
    return transformer.transform(this.results);
  }

  /**
   * Merges another registry into this one
   */
  merge(other: Registry<T>): void {
    for (const [key, value] of other.results) {
      this.results.set(key, value);
    }
  }

  /**
   * Filters results based on a predicate
   */
  filter(predicate: (result: AnalysisResult<T>) => boolean): Registry<T> {
    const filtered = new Registry<T>();
    for (const [key, result] of this.results) {
      if (predicate(result)) {
        filtered.add(key, result);
      }
    }
    return filtered;
  }

  /**
   * Maps results to a new type
   */
  map<U>(mapper: (result: AnalysisResult<T>) => AnalysisResult<U>): Registry<U> {
    const mapped = new Registry<U>();
    for (const [key, result] of this.results) {
      mapped.add(key, mapper(result));
    }
    return mapped;
  }

  /**
   * Converts to a plain object
   */
  toObject(): Record<string, T> {
    const obj: Record<string, T> = {};
    for (const [key, result] of this.results) {
      obj[key] = result.extractedData;
    }
    return obj;
  }

  /**
   * Converts to an array of results
   */
  toArray(): Array<{ key: string; result: AnalysisResult<T> }> {
    return Array.from(this.results.entries()).map(([key, result]) => ({
      key,
      result
    }));
  }
}