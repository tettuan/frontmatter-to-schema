/**
 * Simple Replacement Processor - Domain Service
 * Handles simple placeholder replacement processing
 * Part of Template Context - Domain Layer
 * Follows Totality principles with Result types
 */

import type { DomainError } from "../../core/result.ts";
import type {
  ProcessingStatistics,
  TemplateProcessingContext,
  TemplateProcessingResult,
} from "../models/template-processing-types.ts";
import { PlaceholderPattern } from "./placeholder-pattern.ts";
import { getValueByPath, isDomainError } from "./template-utils.service.ts";

/**
 * Domain service for simple replacement processing
 * Consolidates PlaceholderProcessor logic
 */
export class SimpleReplacementProcessor {
  /**
   * Process simple replacement using placeholder patterns
   */
  static process(
    content: string,
    context: Extract<TemplateProcessingContext, { kind: "SimpleReplacement" }>,
  ): TemplateProcessingResult | DomainError {
    const pattern = PlaceholderPattern.create(context.placeholderPattern);
    if (isDomainError(pattern)) {
      return pattern;
    }

    const replacedVariables: string[] = [];
    let totalReplacements = 0;

    const processedContent = content.replace(
      pattern.pattern,
      (match, variableName) => {
        const trimmedName = variableName.trim();
        const value = getValueByPath(context.data, trimmedName);

        if (value !== undefined) {
          replacedVariables.push(trimmedName);
          totalReplacements++;
          return String(value);
        }

        return match; // Keep original if not found
      },
    );

    const statistics: ProcessingStatistics = {
      replacedVariables,
      totalReplacements,
      processingTimeMs: 0, // Will be set by caller
    };

    return {
      kind: "Success",
      content: processedContent,
      statistics,
    };
  }
}
