/**
 * @fileoverview ExtractFromProcessor - Domain Service for x-extract-from directive processing
 * @description Implementation of Issue #899: x-frontmatter-part array processing with x-extract-from integration
 * Following DDD, Totality, and Smart Constructor principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import {
  PropertyExtractor,
  PropertyPath,
} from "../extractors/property-extractor.ts";
import { ExtractFromDirective } from "../value-objects/extract-from-directive.ts";

/**
 * Domain Service for processing x-extract-from directives
 * Following DDD Service pattern for coordinating domain operations
 */
export class ExtractFromProcessor {
  private constructor(private readonly propertyExtractor: PropertyExtractor) {}

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
   * Process multiple x-extract-from directives on frontmatter data
   * Following DDD principles - coordinates domain operations without business logic
   */
  processDirectives(
    data: FrontmatterData,
    directives: ExtractFromDirective[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    if (directives.length === 0) {
      // No directives to process, return data unchanged
      return ok(data);
    }

    try {
      // Process each directive and accumulate results
      const extractedData: Record<string, unknown> = {};

      for (let i = 0; i < directives.length; i++) {
        const directive = directives[i];
        const extractionResult = this.processSingleDirective(data, directive);

        if (!extractionResult.ok) {
          return extractionResult;
        }

        // Generate key for extracted data
        const key = this.generateExtractedKey(directive, i, directives.length);
        extractedData[key] = extractionResult.data;
      }

      // Create new FrontmatterData with extracted values
      const resultData = FrontmatterData.create(extractedData);
      if (!resultData.ok) {
        return err(createError({
          kind: "InvalidFormat",
          format: "frontmatter-data",
          value: extractedData,
          message: "Failed to create FrontmatterData from extracted values",
        }));
      }

      return ok(resultData.data);
    } catch (error) {
      return err(createError({
        kind: "ExtractionFailed",
        path: "directive-processing",
        message: `Failed to process directives: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  /**
   * Process a single x-extract-from directive
   * Private method following encapsulation principles
   */
  private processSingleDirective(
    data: FrontmatterData,
    directive: ExtractFromDirective,
  ): Result<unknown, DomainError & { message: string }> {
    const path = directive.getPath();

    // Check if path contains array notation (e.g., "traceability[].id.full")
    if (path.includes("[]")) {
      // Use PropertyExtractor for array notation paths
      return this.extractWithPropertyExtractor(data, directive);
    } else {
      // Use FrontmatterData's own path resolution for simple paths
      // This handles the flattened key structure correctly
      const extractionResult = data.get(path);
      if (!extractionResult.ok) {
        return err(createError({
          kind: "ExtractionFailed",
          path: path,
          message: `Failed to extract from path '${path}': ${
            extractionResult.error.message || "Unknown error"
          }`,
        }));
      }

      return ok(extractionResult.data);
    }
  }

  /**
   * Extract using PropertyExtractor for complex paths (arrays, etc.)
   * Converts FrontmatterData to nested object structure first
   */
  private extractWithPropertyExtractor(
    data: FrontmatterData,
    directive: ExtractFromDirective,
  ): Result<unknown, DomainError & { message: string }> {
    // Parse the property path from directive
    const pathResult = PropertyPath.create(directive.getPath());
    if (!pathResult.ok) {
      return err(createError({
        kind: "InvalidFormat",
        format: "property-path",
        value: directive.getPath(),
        message: `Invalid property path: ${directive.getPath()}`,
      }));
    }

    // Convert FrontmatterData to nested object structure for PropertyExtractor
    const rawData = this.frontmatterDataToNestedObject(data);

    // Extract value using PropertyExtractor
    const extractionResult = this.propertyExtractor.extract(
      rawData,
      pathResult.data,
    );
    if (!extractionResult.ok) {
      return err(createError({
        kind: "ExtractionFailed",
        path: directive.getPath(),
        message:
          `Failed to extract from path '${directive.getPath()}': Property extraction failed`,
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

  /**
   * Generate appropriate key name for extracted data
   * Handles single vs multiple directives appropriately
   */
  private generateExtractedKey(
    directive: ExtractFromDirective,
    index: number,
    totalDirectives: number,
  ): string {
    if (totalDirectives === 1) {
      // Single directive - use generic "extracted" key
      return "extracted";
    }

    // Multiple directives - generate descriptive key from path
    const path = directive.getPath();
    const segments = path.split(".");

    // Use last segment(s) to create meaningful key
    if (segments.length >= 2) {
      // Convert "user.name" to "userName", "project.title" to "projectTitle"
      const lastTwo = segments.slice(-2);
      return lastTwo.map((segment, i) =>
        i === 0 ? segment : segment.charAt(0).toUpperCase() + segment.slice(1)
      ).join("").replace(/\[\]/g, "");
    } else {
      // Fallback to simple naming
      return segments[0]?.replace(/\[\]/g, "") || `extracted${index}`;
    }
  }
}
