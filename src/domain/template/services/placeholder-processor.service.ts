/**
 * Placeholder Processor Service - Handles simple placeholder replacement
 * Following DDD and Totality principles with <200 lines (AI complexity control)
 */

import type { DomainError, Result } from "../../core/result.ts";
import {
  isValidRecordData,
  type PlaceholderPattern,
  type ProcessingStatistics,
  type TemplateProcessingContext,
  type TemplateProcessingResult,
} from "./template-context.service.ts";

/**
 * Placeholder Processor Service
 * Consolidates placeholder replacement logic
 */
export class PlaceholderProcessorService {
  /**
   * Process simple replacement with placeholders
   */
  static processSimpleReplacement(
    content: string,
    context: Extract<TemplateProcessingContext, { kind: "SimpleReplacement" }>,
    pattern: PlaceholderPattern,
  ): Result<TemplateProcessingResult, DomainError & { message: string }> {
    const replacedVariables: string[] = [];
    const missingVariables: string[] = [];
    let totalReplacements = 0;

    const processedContent = content.replace(
      pattern.pattern,
      (match, variableName) => {
        const trimmedName = variableName.trim();
        const value = this.getValueByPath(context.data, trimmedName);

        if (value !== undefined) {
          replacedVariables.push(trimmedName);
          totalReplacements++;
          return this.formatValue(value);
        }

        // Track missing variable
        if (!missingVariables.includes(trimmedName)) {
          missingVariables.push(trimmedName);
        }
        return match; // Keep original if not found
      },
    );

    const statistics: ProcessingStatistics = {
      replacedVariables,
      totalReplacements,
      processingTimeMs: 0, // Will be set by caller
    };

    // Return PartialSuccess if there are missing variables
    if (missingVariables.length > 0) {
      return {
        ok: true,
        data: {
          kind: "PartialSuccess",
          content: processedContent,
          statistics,
          missingVariables,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "Success",
        content: processedContent,
        statistics,
      },
    };
  }

  /**
   * Get value by path from data object
   * Supports nested paths like "user.name.first"
   */
  static getValueByPath(data: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (isValidRecordData(current)) {
        current = current[part];
      } else if (Array.isArray(current)) {
        // Handle array properties like .length
        if (part === "length") {
          current = current.length;
        } else {
          const index = parseInt(part, 10);
          if (!isNaN(index) && index >= 0 && index < current.length) {
            current = current[index];
          } else {
            return undefined;
          }
        }
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Format value for string replacement
   */
  private static formatValue(value: unknown): string {
    if (value === null) {
      return "null";
    }
    if (value === undefined) {
      return "";
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Process nested placeholders
   * Handles cases where placeholders contain other placeholders
   */
  static processNestedPlaceholders(
    content: string,
    data: Record<string, unknown>,
    pattern: PlaceholderPattern,
    maxDepth: number = 10,
  ): Result<string, DomainError & { message: string }> {
    let result = content;
    let depth = 0;
    let hasReplacements = true;

    while (hasReplacements && depth < maxDepth) {
      const before = result;
      result = result.replace(pattern.pattern, (match, variableName) => {
        const value = this.getValueByPath(data, variableName.trim());
        return value !== undefined ? this.formatValue(value) : match;
      });

      hasReplacements = before !== result;
      depth++;
    }

    if (depth >= maxDepth) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: content,
          expectedFormat: "non-circular placeholder references",
          message:
            "Maximum nesting depth exceeded - possible circular reference",
        },
      };
    }

    return { ok: true, data: result };
  }
}
