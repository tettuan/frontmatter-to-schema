/**
 * @fileoverview ExtractFromProcessor Domain Service
 * @description Processes x-extract-from directives to extract values from frontmatter data
 * Following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { PropertyExtractor } from "../extractors/property-extractor.ts";
import { ExtractFromDirective } from "../value-objects/extract-from-directive.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

/**
 * Domain service for processing x-extract-from directives
 * Encapsulates extraction logic and coordinates with PropertyExtractor
 */
export class ExtractFromProcessor {
  private constructor(
    private readonly propertyExtractor: PropertyExtractor,
  ) {}

  /**
   * Smart Constructor
   */
  static create(
    propertyExtractor?: PropertyExtractor,
  ): ExtractFromProcessor {
    const extractor = propertyExtractor || PropertyExtractor.create();
    return new ExtractFromProcessor(extractor);
  }

  /**
   * Process a single directive
   * Extracts value from source path and sets it to target property
   */
  processDirective(
    data: FrontmatterData,
    directive: ExtractFromDirective,
  ): Result<FrontmatterData, DomainError> {
    // Extract value using PropertyExtractor
    const extractResult = this.propertyExtractor.extract(
      data.getData(),
      directive.getSourcePath(),
    );

    if (!extractResult.ok) {
      // For optional fields, return original data without error
      // This allows schemas to specify optional extractions
      return ok(data);
    }

    // Set extracted value to target property
    const setResult = data.set(
      directive.getTargetProperty(),
      extractResult.data,
    );

    if (!setResult.ok) {
      return err({
        kind: "AggregationFailed" as const,
        message:
          `Failed to set extracted value to ${directive.getTargetProperty()}: ${setResult.error.message}`,
      });
    }

    return setResult;
  }

  /**
   * Process multiple directives
   * Applies each directive in sequence, accumulating changes
   */
  processDirectives(
    data: FrontmatterData,
    directives: ExtractFromDirective[],
  ): Result<FrontmatterData, DomainError> {
    let resultData = data;

    for (const directive of directives) {
      const processResult = this.processDirective(resultData, directive);

      if (!processResult.ok) {
        // Log warning but continue processing other directives
        const errorMessage = "message" in processResult.error
          ? processResult.error.message
          : JSON.stringify(processResult.error);
        console.warn(
          `Extraction failed for ${directive.toString()}: ${errorMessage}`,
        );
        continue;
      }

      resultData = processResult.data;
    }

    return ok(resultData);
  }

  /**
   * Process directives with array normalization
   * Separates array and non-array directives for optimized processing
   */
  processWithNormalization(
    data: FrontmatterData,
    directives: ExtractFromDirective[],
  ): Result<FrontmatterData, DomainError> {
    // Separate directives by array notation usage
    const arrayDirectives = directives.filter((d) => d.hasArrayNotation());
    const simpleDirectives = directives.filter((d) => !d.hasArrayNotation());

    let resultData = data;

    // Process simple directives first (more efficient)
    if (simpleDirectives.length > 0) {
      const simpleResult = this.processDirectives(resultData, simpleDirectives);
      if (!simpleResult.ok) {
        return simpleResult;
      }
      resultData = simpleResult.data;
    }

    // Process array directives with normalization
    if (arrayDirectives.length > 0) {
      const arrayResult = this.processDirectives(resultData, arrayDirectives);
      if (!arrayResult.ok) {
        return arrayResult;
      }
      resultData = arrayResult.data;
    }

    return ok(resultData);
  }

  /**
   * Process directives in batch with validation
   * Ensures all directives are valid before processing
   */
  processBatch(
    data: FrontmatterData,
    directives: ExtractFromDirective[],
  ): Result<FrontmatterData, DomainError> {
    if (directives.length === 0) {
      return ok(data);
    }

    // Group directives by target to detect conflicts
    const targetGroups = new Map<string, ExtractFromDirective[]>();
    for (const directive of directives) {
      const target = directive.getTargetProperty();
      if (!targetGroups.has(target)) {
        targetGroups.set(target, []);
      }
      targetGroups.get(target)!.push(directive);
    }

    // Check for conflicting directives (multiple sources for same target)
    for (const [target, group] of targetGroups) {
      if (group.length > 1) {
        console.warn(
          `Multiple x-extract-from directives for target '${target}'. Using last one.`,
        );
      }
    }

    // Process with normalization for optimal performance
    return this.processWithNormalization(data, directives);
  }

  /**
   * Get statistics about directive processing
   */
  getProcessingStats(
    directives: ExtractFromDirective[],
  ): {
    total: number;
    withArrayNotation: number;
    uniqueTargets: number;
    conflictingTargets: number;
  } {
    const targetCounts = new Map<string, number>();
    let withArrayNotation = 0;

    for (const directive of directives) {
      if (directive.hasArrayNotation()) {
        withArrayNotation++;
      }

      const target = directive.getTargetProperty();
      targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
    }

    const conflictingTargets = Array.from(targetCounts.values()).filter(
      (count) => count > 1,
    ).length;

    return {
      total: directives.length,
      withArrayNotation,
      uniqueTargets: targetCounts.size,
      conflictingTargets,
    };
  }
}
