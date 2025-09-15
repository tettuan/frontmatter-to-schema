/**
 * Domain Service for centralized FrontmatterData creation following DDD principles
 *
 * Eliminates FrontmatterData.create() duplication across the codebase by providing
 * a single authority for all creation scenarios with consistent error handling.
 *
 * Follows Totality principle by ensuring all creation methods return Result types.
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, FrontmatterError } from "../../shared/types/errors.ts";
import {
  FrontmatterContent,
  FrontmatterData,
} from "../value-objects/frontmatter-data.ts";

export class FrontmatterDataCreationService {
  private constructor() {}

  static create(): FrontmatterDataCreationService {
    return new FrontmatterDataCreationService();
  }

  /**
   * Create FrontmatterData from raw unknown data
   * Centralizes the primary creation pattern used throughout the codebase
   */
  createFromRaw(
    data: unknown,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    return FrontmatterData.create(data);
  }

  /**
   * Create multiple FrontmatterData instances from array of unknown data
   * Replaces scattered array processing logic
   */
  createFromArray(
    items: unknown[],
  ): Result<FrontmatterData[], FrontmatterError & { message: string }> {
    const results: FrontmatterData[] = [];
    for (let i = 0; i < items.length; i++) {
      const result = FrontmatterData.create(items[i]);
      if (!result.ok) {
        return err(createError(
          { kind: "MalformedFrontmatter", content: `Array item at index ${i}` },
          `Failed to create FrontmatterData from array item at index ${i}: ${result.error.message}`,
        ));
      }
      results.push(result.data);
    }
    return ok(results);
  }

  /**
   * Create FrontmatterData with default values applied when data is null/undefined
   * Centralizes default handling pattern
   */
  createWithDefaults(
    data: unknown,
    defaults: FrontmatterContent,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    if (data === null || data === undefined) {
      return FrontmatterData.create(defaults);
    }
    return FrontmatterData.create(data);
  }

  /**
   * Create FrontmatterData by merging multiple data sources
   * Centralizes merge-then-create pattern
   */
  createFromMerge(
    baseData: FrontmatterContent,
    ...additionalData: FrontmatterContent[]
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    let merged = { ...baseData };
    for (const data of additionalData) {
      merged = { ...merged, ...data };
    }
    return FrontmatterData.create(merged);
  }

  /**
   * Create FrontmatterData from an existing instance with additional defaults
   * Centralizes the pattern of applying defaults to existing data
   */
  createWithDefaultsFromExisting(
    data: FrontmatterData,
    defaults: FrontmatterContent,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    const base = data.getData();
    const merged = { ...defaults, ...base };
    return FrontmatterData.create(merged);
  }

  /**
   * Batch create multiple FrontmatterData instances with partial failure handling
   * Returns successful creations and collected errors
   */
  createBatch(
    items: unknown[],
  ): {
    successful: FrontmatterData[];
    errors: Array<
      { index: number; error: FrontmatterError & { message: string } }
    >;
  } {
    const successful: FrontmatterData[] = [];
    const errors: Array<
      { index: number; error: FrontmatterError & { message: string } }
    > = [];

    items.forEach((item, index) => {
      const result = FrontmatterData.create(item);
      if (result.ok) {
        successful.push(result.data);
      } else {
        errors.push({ index, error: result.error });
      }
    });

    return { successful, errors };
  }

  /**
   * Create empty FrontmatterData - convenience method
   */
  createEmpty(): FrontmatterData {
    return FrontmatterData.empty();
  }

  /**
   * Validate and create with enhanced error context
   * Provides more detailed error information for debugging
   */
  createWithContext(
    data: unknown,
    context: string,
  ): Result<FrontmatterData, FrontmatterError & { message: string }> {
    const result = FrontmatterData.create(data);
    if (!result.ok) {
      return err(createError(
        result.error,
        `${result.error.message} (Context: ${context})`,
      ));
    }
    return result;
  }
}

/**
 * Default singleton instance for convenience
 * Can be injected into services that need FrontmatterData creation
 */
export const defaultFrontmatterDataCreationService:
  FrontmatterDataCreationService = FrontmatterDataCreationService.create();
