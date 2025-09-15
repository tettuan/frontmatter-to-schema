import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, FrontmatterError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";

/**
 * Factory for creating FrontmatterData instances following DDD and Totality principles.
 * Centralizes creation logic and provides specialized factory methods for common use cases.
 */
export class FrontmatterDataFactory {
  /**
   * Create FrontmatterData from unknown parsed data (default behavior)
   */
  static fromParsedData(
    data: unknown,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    return FrontmatterData.create(data);
  }

  /**
   * Create FrontmatterData from a known object structure
   */
  static fromObject(
    obj: Record<string, unknown>,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return err(createError({
        kind: "MalformedFrontmatter",
        content: JSON.stringify(obj).substring(0, 100),
      }));
    }
    return FrontmatterData.create(obj);
  }

  /**
   * Create an array of FrontmatterData from an array of items
   */
  static fromArray(
    items: unknown[],
  ): Result<FrontmatterData[], FrontmatterError & { message: string }> {
    if (!Array.isArray(items)) {
      return err(createError({
        kind: "MalformedFrontmatter",
        content: `Expected array but got ${typeof items}`,
      }));
    }

    const results: FrontmatterData[] = [];
    for (const item of items) {
      const result = FrontmatterData.create(item);
      if (!result.ok) {
        return result;
      }
      results.push(result.data);
    }
    return ok(results);
  }

  /**
   * Create empty FrontmatterData
   */
  static empty(): FrontmatterData {
    return FrontmatterData.empty();
  }

  /**
   * Create FrontmatterData with default fallback for undefined/null values
   */
  static withDefault(
    data: unknown,
    defaultData: Record<string, unknown> = {},
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (data === null || data === undefined) {
      return FrontmatterData.create(defaultData);
    }
    return FrontmatterData.create(data);
  }

  /**
   * Create FrontmatterData from multiple sources with merging
   */
  static fromMerged(
    ...sources: unknown[]
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    let merged: Record<string, unknown> = {};

    for (const source of sources) {
      if (source && typeof source === "object" && !Array.isArray(source)) {
        merged = { ...merged, ...source as Record<string, unknown> };
      }
    }

    return FrontmatterData.create(merged);
  }

  /**
   * Batch create multiple FrontmatterData instances
   * Returns all successful creations and errors separately
   */
  static batchCreate(
    items: unknown[],
  ): {
    successful: FrontmatterData[];
    failed: Array<{
      index: number;
      error: FrontmatterError & { message: string };
    }>;
  } {
    const successful: FrontmatterData[] = [];
    const failed: Array<{
      index: number;
      error: FrontmatterError & { message: string };
    }> = [];

    items.forEach((item, index) => {
      const result = FrontmatterData.create(item);
      if (result.ok) {
        successful.push(result.data);
      } else {
        failed.push({ index, error: result.error });
      }
    });

    return { successful, failed };
  }

  /**
   * Merge multiple FrontmatterData instances into one
   */
  static merge(
    dataArray: FrontmatterData[],
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (dataArray.length === 0) {
      return ok(FrontmatterData.empty());
    }

    let merged: Record<string, unknown> = {};
    for (const data of dataArray) {
      // Use getData to get the raw data
      merged = { ...merged, ...data.getData() };
    }

    return FrontmatterData.create(merged);
  }

  /**
   * Apply defaults to FrontmatterData
   */
  static withDefaults(
    data: FrontmatterData,
    defaults: Record<string, unknown>,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    // Use getData to get the raw data, then merge with defaults (data overrides defaults)
    const base = data.getData();
    const merged = { ...defaults, ...base };
    return FrontmatterData.create(merged);
  }
}
