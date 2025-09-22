/**
 * @fileoverview ExtractFromProcessor - Domain Service for x-extract-from directive processing
 * @description Implementation of Issue #899: x-frontmatter-part array processing with x-extract-from integration
 * Following DDD, Totality, and Smart Constructor principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";
import {
  PropertyExtractor,
  PropertyPath,
} from "../extractors/property-extractor.ts";
import {
  OptimizedPropertyExtractor,
  OptimizedPropertyExtractorFactory,
} from "../extractors/optimized-extractor.ts";
import { ExtractFromDirective } from "../value-objects/extract-from-directive.ts";

/**
 * Domain Service for processing x-extract-from directives
 * Following DDD Service pattern for coordinating domain operations
 * Enhanced with performance optimization support
 */
export class ExtractFromProcessor {
  private constructor(
    private readonly propertyExtractor: PropertyExtractor,
    private readonly optimizedExtractor?: OptimizedPropertyExtractor,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Ensures valid state on creation
   */
  static create(
    propertyExtractor?: PropertyExtractor,
  ): Result<ExtractFromProcessor, DomainError & { message: string }> {
    const extractor = propertyExtractor ?? PropertyExtractor.create();
    return ok(new ExtractFromProcessor(extractor));
  }

  /**
   * Smart Constructor with performance optimization
   * Creates an ExtractFromProcessor with OptimizedPropertyExtractor
   */
  static createOptimized(
    optimizedConfig?: {
      enablePathCache?: boolean;
      enableExtractionCache?: boolean;
      enableMetrics?: boolean;
      maxConcurrentExtractions?: number;
    },
  ): Result<ExtractFromProcessor, DomainError & { message: string }> {
    const optimizedExtractorResult = OptimizedPropertyExtractorFactory.create({
      enablePathCache: optimizedConfig?.enablePathCache ?? true,
      enableExtractionCache: optimizedConfig?.enableExtractionCache ?? true,
      enableMetrics: optimizedConfig?.enableMetrics ?? true,
      maxConcurrentExtractions: optimizedConfig?.maxConcurrentExtractions ?? 20,
      timeoutMs: 15000, // 15 seconds timeout
    });

    if (!optimizedExtractorResult.ok) {
      return err(createError({
        kind: "InvalidFormat",
        format: "optimized-extractor",
        value: optimizedConfig,
        message:
          `Failed to create optimized extractor: ${optimizedExtractorResult.error.message}`,
      }));
    }

    const fallbackExtractor = PropertyExtractor.create();
    return ok(
      new ExtractFromProcessor(
        fallbackExtractor,
        optimizedExtractorResult.data,
      ),
    );
  }

  /**
   * Process multiple x-extract-from directives on frontmatter data
   * Following DDD principles - coordinates domain operations without business logic
   * Enhanced with async support for optimized extractors
   */
  async processDirectives(
    data: FrontmatterData,
    directives: ExtractFromDirective[],
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    if (directives.length === 0) {
      return ok(data);
    }

    const rawData = this.frontmatterDataToNestedObject(data);
    let currentData = data;

    for (const directive of directives) {
      const extractionResult = await this.extractFromRawData(
        rawData,
        directive,
      );
      if (!extractionResult.ok) {
        return extractionResult;
      }

      const normalizedValue = this.normalizeExtractedValue(
        directive,
        extractionResult.data,
      );

      if (this.shouldSkipDirectiveApplication(directive, normalizedValue)) {
        continue;
      }

      const applyResult = this.applyDirectiveResult(
        rawData,
        directive,
        normalizedValue,
      );
      if (!applyResult.ok) {
        return applyResult;
      }

      currentData = applyResult.data;
    }

    return ok(currentData);
  }

  /**
   * Synchronous version for backward compatibility
   * Uses basic PropertyExtractor only
   */
  processDirectivesSync(
    data: FrontmatterData,
    directives: ExtractFromDirective[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    if (directives.length === 0) {
      return ok(data);
    }

    if (this.optimizedExtractor) {
      return err(createError(
        {
          kind: "InvalidFormat",
          format: "synchronous-processing",
          value: "optimized-extractor-enabled",
        },
        "Cannot use synchronous processing with OptimizedPropertyExtractor. Use processDirectives() instead.",
      ));
    }

    const rawData = this.frontmatterDataToNestedObject(data);
    let currentData = data;

    for (const directive of directives) {
      const extractionResult = this.extractFromRawDataSync(
        rawData,
        directive,
      );
      if (!extractionResult.ok) {
        return extractionResult;
      }

      const normalizedValue = this.normalizeExtractedValue(
        directive,
        extractionResult.data,
      );

      if (this.shouldSkipDirectiveApplication(directive, normalizedValue)) {
        continue;
      }

      const applyResult = this.applyDirectiveResult(
        rawData,
        directive,
        normalizedValue,
      );
      if (!applyResult.ok) {
        return applyResult;
      }

      currentData = applyResult.data;
    }

    return ok(currentData);
  }

  private async extractFromRawData(
    rawData: Record<string, unknown>,
    directive: ExtractFromDirective,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    if (this.optimizedExtractor) {
      try {
        const extractionResult = await this.optimizedExtractor.extract(
          rawData,
          directive.getSourcePath(),
          {
            operation: "x-extract-from",
            correlationId: `extract-${Date.now()}`,
          },
        );

        if (!extractionResult.ok) {
          const errorMessage = "message" in extractionResult.error
            ? extractionResult.error.message
            : `Error kind: ${extractionResult.error.kind}`;
          return err(createError({
            kind: "ExtractionFailed",
            path: directive.getSourcePath(),
            message:
              `Optimized extraction failed from path '${directive.getSourcePath()}': ${errorMessage}`,
          }));
        }

        return ok(extractionResult.data);
      } catch (_error) {
        // Fall back to basic extractor if optimized extraction fails
      }
    }

    const pathResult = PropertyPath.create(directive.getSourcePath());
    if (!pathResult.ok) {
      return err(createError({
        kind: "InvalidFormat",
        format: "property-path",
        value: directive.getSourcePath(),
        message: `Invalid property path: ${directive.getSourcePath()}`,
      }));
    }

    const extractionResult = this.propertyExtractor.extract(
      rawData,
      pathResult.data,
    );

    if (!extractionResult.ok) {
      return err(createError({
        kind: "ExtractionFailed",
        path: directive.getSourcePath(),
        message:
          `Failed to extract from path '${directive.getSourcePath()}': Property extraction failed`,
      }));
    }

    return ok(extractionResult.data);
  }

  private extractFromRawDataSync(
    rawData: Record<string, unknown>,
    directive: ExtractFromDirective,
  ): Result<unknown, DomainError & { message: string }> {
    const pathResult = PropertyPath.create(directive.getSourcePath());
    if (!pathResult.ok) {
      return err(createError({
        kind: "InvalidFormat",
        format: "property-path",
        value: directive.getSourcePath(),
        message: `Invalid property path: ${directive.getSourcePath()}`,
      }));
    }

    const extractionResult = this.propertyExtractor.extract(
      rawData,
      pathResult.data,
    );

    if (!extractionResult.ok) {
      return err(createError({
        kind: "ExtractionFailed",
        path: directive.getSourcePath(),
        message:
          `Failed to extract from path '${directive.getSourcePath()}': Property extraction failed`,
      }));
    }

    return ok(extractionResult.data);
  }

  /**
   * Convert FrontmatterData to nested object structure
   * Reconstructs the nested structure from flattened keys
   */
  private frontmatterDataToNestedObject(
    data: FrontmatterData,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Get all keys and reconstruct nested structure
    const keys = data.getAllKeys();
    for (const key of keys) {
      const valueResult = data.get(key);
      if (valueResult.ok) {
        this.setNestedValue(result, key, valueResult.data);
      }
    }

    return result;
  }

  /**
   * Set a value in a nested object using dot notation path
   * Handles creating intermediate objects as needed
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current: any = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (
        !(part in current) || typeof current[part] !== "object" ||
        current[part] === null
      ) {
        current[part] = {};
      }
      current = current[part];
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }

  private normalizeExtractedValue(
    directive: ExtractFromDirective,
    value: unknown,
  ): unknown {
    const expectsArray = directive.hasTargetArrayExpansion() ||
      directive.isTargetArray();

    if (!expectsArray) {
      return value;
    }

    if (value === null || value === undefined) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
  }

  private shouldSkipDirectiveApplication(
    directive: ExtractFromDirective,
    value: unknown,
  ): boolean {
    const expectsArray = directive.hasTargetArrayExpansion() ||
      directive.isTargetArray();

    if (expectsArray) {
      return false;
    }

    return value === undefined;
  }

  private applyDirectiveResult(
    rawData: Record<string, unknown>,
    directive: ExtractFromDirective,
    value: unknown,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const applyResult = directive.hasTargetArrayExpansion()
      ? this.applyArrayTarget(rawData, directive, value)
      : this.applySimpleTarget(rawData, directive, value);

    if (!applyResult.ok) {
      return applyResult;
    }

    const updatedFrontmatter = FrontmatterDataFactory.fromParsedData(rawData);
    if (!updatedFrontmatter.ok) {
      return err(createError({
        kind: "ExtractionFailed",
        path: directive.getTargetPath(),
        message: `Failed to build frontmatter after applying directive '${directive.getTargetPath()}'`,
      }));
    }

    return ok(updatedFrontmatter.data);
  }

  private applySimpleTarget(
    rawData: Record<string, unknown>,
    directive: ExtractFromDirective,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    const segments = directive.getTargetSegments();
    const normalizedSegments = segments.map((segment) => segment.replace("[]", ""));

    this.setNestedProperty(rawData, normalizedSegments, value);
    return ok(undefined);
  }

  private applyArrayTarget(
    rawData: Record<string, unknown>,
    directive: ExtractFromDirective,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    const propertyPath = directive.getTargetPropertyPath();
    const preSegments = propertyPath.getPreArraySegments();
    const postSegments = propertyPath.getPostArraySegments();

    if (preSegments.length === 0) {
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-target-path",
        value: directive.getTargetPath(),
        message: `Target path '${directive.getTargetPath()}' must specify a property before array notation`,
      }));
    }

    const parent = this.ensureObjectPath(rawData, preSegments.slice(0, -1));
    const arrayKey = preSegments[preSegments.length - 1];

    if (!Array.isArray(parent[arrayKey])) {
      parent[arrayKey] = [];
    }

    const targetArray = parent[arrayKey] as unknown[];
    const valuesArray = Array.isArray(value)
      ? value
      : value === undefined || value === null
        ? []
        : [value];

    if (postSegments.length === 0) {
      parent[arrayKey] = valuesArray;
      return ok(undefined);
    }

    for (let i = 0; i < valuesArray.length; i++) {
      const itemValue = valuesArray[i];
      const existing = targetArray[i];
      if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
        targetArray[i] = {};
      }

      this.setNestedProperty(
        targetArray[i] as Record<string, unknown>,
        postSegments,
        itemValue,
      );
    }

    return ok(undefined);
  }

  private ensureObjectPath(
    root: Record<string, unknown>,
    segments: readonly string[],
  ): Record<string, unknown> {
    let current = root;
    for (const segment of segments) {
      const existing = current[segment];
      if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }
    return current;
  }

  private setNestedProperty(
    target: Record<string, unknown>,
    segments: readonly string[],
    value: unknown,
  ): void {
    if (segments.length === 0) {
      return;
    }

    let current = target;
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      const existing = current[segment];
      if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    current[segments[segments.length - 1]] = value;
  }

  /**
   * Get performance statistics if using optimized extractor
   */
  getPerformanceStats(): {
    isOptimized: boolean;
    stats?: any;
  } {
    if (this.optimizedExtractor) {
      return {
        isOptimized: true,
        stats: this.optimizedExtractor.getPerformanceStats(),
      };
    }

    return {
      isOptimized: false,
    };
  }

  /**
   * Clear caches if using optimized extractor
   */
  clearCaches(): Result<void, DomainError & { message: string }> {
    if (this.optimizedExtractor) {
      try {
        this.optimizedExtractor.clearCaches();
        return ok(undefined);
      } catch (error) {
        return err(createError({
          kind: "ExtractionFailed",
          path: "cache-clear",
          message: `Failed to clear caches: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }));
      }
    }

    return ok(undefined);
  }

  /**
   * Perform cache maintenance if using optimized extractor
   */
  performMaintenance(): Result<void, DomainError & { message: string }> {
    if (this.optimizedExtractor) {
      const maintenanceResult = this.optimizedExtractor.performMaintenance();
      if (!maintenanceResult.ok) {
        const errorMessage = "message" in maintenanceResult.error
          ? maintenanceResult.error.message
          : `Error kind: ${maintenanceResult.error.kind}`;
        return err(createError({
          kind: "ExtractionFailed",
          path: "cache-maintenance",
          message: `Cache maintenance failed: ${errorMessage}`,
        }));
      }
    }

    return ok(undefined);
  }
}
