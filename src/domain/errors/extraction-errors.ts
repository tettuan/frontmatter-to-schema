/**
 * @fileoverview Extraction Errors - Enhanced error types for property extraction operations
 * @description Provides detailed, user-friendly error messages for x-extract-from and related operations
 * Following DDD and Totality principles for comprehensive error handling
 */

import { SchemaError } from "../shared/types/errors.ts";

/**
 * Enhanced error types for extraction operations
 * Following Totality principle with discriminated unions and detailed context
 */
export type ExtractionError =
  | {
    kind: "PropertyPathInvalid";
    path: string;
    reason: string;
    suggestion?: string;
  }
  | {
    kind: "PropertyNotFound";
    path: string;
    availablePaths: string[];
    searchContext: string;
  }
  | {
    kind: "TypeMismatchInExtraction";
    expected: string;
    actual: string;
    path: string;
    value: unknown;
  }
  | {
    kind: "ArrayExpansionFailed";
    path: string;
    reason: string;
    dataStructure: string;
  }
  | {
    kind: "CircularDependency";
    dependencyChain: string[];
    conflictingPath: string;
  }
  | {
    kind: "DirectiveConflict";
    conflictingDirectives: string[];
    path: string;
    resolution: string;
  }
  | {
    kind: "ExtractionRecoverable";
    path: string;
    partialResult: unknown;
    issue: string;
  }
  | {
    kind: "SchemaValidationFailed";
    schemaPath: string;
    validationErrors: string[];
  };

/**
 * Error context for debugging and troubleshooting
 */
export interface ExtractionErrorContext {
  readonly operation: string;
  readonly sourceData?: unknown;
  readonly schemaContext?: unknown;
  readonly processingStage:
    | "validation"
    | "extraction"
    | "transformation"
    | "aggregation";
  readonly timestamp: string;
  readonly debugInfo?: Record<string, unknown>;
}

/**
 * Enhanced extraction result with recovery options
 */
export type ExtractionResult<T> =
  | { success: true; data: T; warnings?: ExtractionError[] }
  | {
    success: false;
    error: ExtractionError;
    partialData?: T;
    context: ExtractionErrorContext;
  };

/**
 * Extraction Error Factory - Creates detailed error messages
 * Following DDD Factory pattern for consistent error creation
 */
export class ExtractionErrorFactory {
  private constructor() {}

  /**
   * Create property path invalid error with suggestions
   */
  static createPropertyPathInvalid(
    path: string,
    reason: string,
    suggestion?: string,
  ): ExtractionError & { message: string } {
    return {
      kind: "PropertyPathInvalid",
      path,
      reason,
      suggestion,
      message: this.formatPropertyPathInvalidMessage(path, reason, suggestion),
    };
  }

  /**
   * Create property not found error with available alternatives
   */
  static createPropertyNotFound(
    path: string,
    availablePaths: string[],
    searchContext: string,
  ): ExtractionError & { message: string } {
    return {
      kind: "PropertyNotFound",
      path,
      availablePaths,
      searchContext,
      message: this.formatPropertyNotFoundMessage(
        path,
        availablePaths,
        searchContext,
      ),
    };
  }

  /**
   * Create type mismatch error with detailed type information
   */
  static createTypeMismatchInExtraction(
    expected: string,
    actual: string,
    path: string,
    value: unknown,
  ): ExtractionError & { message: string } {
    return {
      kind: "TypeMismatchInExtraction",
      expected,
      actual,
      path,
      value,
      message: this.formatTypeMismatchMessage(expected, actual, path, value),
    };
  }

  /**
   * Create array expansion failed error
   */
  static createArrayExpansionFailed(
    path: string,
    reason: string,
    dataStructure: string,
  ): ExtractionError & { message: string } {
    return {
      kind: "ArrayExpansionFailed",
      path,
      reason,
      dataStructure,
      message: this.formatArrayExpansionFailedMessage(
        path,
        reason,
        dataStructure,
      ),
    };
  }

  /**
   * Create circular dependency error
   */
  static createCircularDependency(
    dependencyChain: string[],
    conflictingPath: string,
  ): ExtractionError & { message: string } {
    return {
      kind: "CircularDependency",
      dependencyChain,
      conflictingPath,
      message: this.formatCircularDependencyMessage(
        dependencyChain,
        conflictingPath,
      ),
    };
  }

  /**
   * Create directive conflict error with resolution guidance
   */
  static createDirectiveConflict(
    conflictingDirectives: string[],
    path: string,
    resolution: string,
  ): ExtractionError & { message: string } {
    return {
      kind: "DirectiveConflict",
      conflictingDirectives,
      path,
      resolution,
      message: this.formatDirectiveConflictMessage(
        conflictingDirectives,
        path,
        resolution,
      ),
    };
  }

  /**
   * Create recoverable extraction error
   */
  static createExtractionRecoverable(
    path: string,
    partialResult: unknown,
    issue: string,
  ): ExtractionError & { message: string } {
    return {
      kind: "ExtractionRecoverable",
      path,
      partialResult,
      issue,
      message: this.formatRecoverableExtractionMessage(path, issue),
    };
  }

  /**
   * Format property path invalid message
   */
  private static formatPropertyPathInvalidMessage(
    path: string,
    reason: string,
    suggestion?: string,
  ): string {
    let message = `Invalid path: '${path}' - ${reason}`;
    if (suggestion) {
      message += `\\n💡 Suggestion: ${suggestion}`;
    }
    return message;
  }

  /**
   * Format property not found message with alternatives
   */
  private static formatPropertyNotFoundMessage(
    path: string,
    availablePaths: string[],
    searchContext: string,
  ): string {
    let message = `Property '${path}' not found in ${searchContext}`;

    if (availablePaths.length > 0) {
      const suggestions = availablePaths.slice(0, 5); // Limit suggestions
      message += `\\n📋 Available paths: ${suggestions.join(", ")}`;
      if (availablePaths.length > 5) {
        message += ` (and ${availablePaths.length - 5} more...)`;
      }
    }

    // Find similar paths
    const similarPaths = this.findSimilarPaths(path, availablePaths);
    if (similarPaths.length > 0) {
      message += `\\n💡 Did you mean: ${similarPaths.slice(0, 3).join(", ")}?`;
    }

    return message;
  }

  /**
   * Format type mismatch message
   */
  private static formatTypeMismatchMessage(
    expected: string,
    actual: string,
    path: string,
    value: unknown,
  ): string {
    let message =
      `Type mismatch at path '${path}': expected ${expected} but got ${actual}`;

    // Add value information if useful
    if (value !== undefined && value !== null) {
      const valueStr = typeof value === "string"
        ? `"${value.slice(0, 50)}${value.length > 50 ? "..." : ""}"`
        : String(value).slice(0, 100);
      message += `\\n📄 Actual value: ${valueStr}`;
    }

    // Add conversion suggestions
    if (expected === "array" && actual !== "array") {
      message +=
        `\\n💡 Tip: Use [] notation in path to normalize single values to arrays`;
    }

    return message;
  }

  /**
   * Format array expansion failed message
   */
  private static formatArrayExpansionFailedMessage(
    path: string,
    reason: string,
    dataStructure: string,
  ): string {
    return `Array expansion failed for path '${path}': ${reason}\\n📊 Data structure: ${dataStructure}\\n💡 Ensure the path points to an array or use [] notation for normalization`;
  }

  /**
   * Format circular dependency message
   */
  private static formatCircularDependencyMessage(
    dependencyChain: string[],
    conflictingPath: string,
  ): string {
    const chain = dependencyChain.join(" → ");
    return `Circular dependency detected: ${chain} → ${conflictingPath}\\n⚠️  This would create an infinite loop during processing\\n💡 Remove the circular reference or restructure the dependencies`;
  }

  /**
   * Format directive conflict message
   */
  private static formatDirectiveConflictMessage(
    conflictingDirectives: string[],
    path: string,
    resolution: string,
  ): string {
    const directives = conflictingDirectives.join(", ");
    return `Conflicting directives at '${path}': ${directives}\\n🔧 Resolution: ${resolution}`;
  }

  /**
   * Format recoverable extraction message
   */
  private static formatRecoverableExtractionMessage(
    path: string,
    issue: string,
  ): string {
    return `Extraction issue at '${path}': ${issue}\\n⚠️  Processing continued with partial results\\n💡 Check the output for missing or incomplete data`;
  }

  /**
   * Find similar paths using simple string similarity
   */
  private static findSimilarPaths(
    targetPath: string,
    availablePaths: string[],
  ): string[] {
    const target = targetPath.toLowerCase();
    const similarities = availablePaths
      .map((path) => ({
        path,
        similarity: this.calculateSimilarity(target, path.toLowerCase()),
      }))
      .filter((item) => item.similarity > 0.4) // Only reasonably similar
      .sort((a, b) => b.similarity - a.similarity)
      .map((item) => item.path);

    return similarities;
  }

  /**
   * Simple string similarity calculation using Levenshtein distance
   */
  private static calculateSimilarity(a: string, b: string): number {
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1;

    const distance = this.levenshteinDistance(a, b);
    return (maxLength - distance) / maxLength;
  }

  /**
   * Levenshtein distance calculation
   */
  private static levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() =>
      Array(a.length + 1).fill(null)
    );

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }
}

/**
 * Error context factory for creating debugging context
 */
export class ExtractionErrorContextFactory {
  /**
   * Create error context for debugging
   */
  static create(
    operation: string,
    processingStage:
      | "validation"
      | "extraction"
      | "transformation"
      | "aggregation",
    sourceData?: unknown,
    schemaContext?: unknown,
    debugInfo?: Record<string, unknown>,
  ): ExtractionErrorContext {
    return {
      operation,
      sourceData,
      schemaContext,
      processingStage,
      timestamp: new Date().toISOString(),
      debugInfo,
    };
  }

  /**
   * Create extraction result with error context
   */
  static createErrorResult<T>(
    error: ExtractionError,
    context: ExtractionErrorContext,
    partialData?: T,
  ): ExtractionResult<T> {
    return {
      success: false,
      error,
      partialData,
      context,
    };
  }

  /**
   * Create successful extraction result
   */
  static createSuccessResult<T>(
    data: T,
    warnings?: ExtractionError[],
  ): ExtractionResult<T> {
    return {
      success: true,
      data,
      warnings,
    };
  }
}

/**
 * Convert extraction error to schema error for compatibility
 */
export function extractionErrorToSchemaError(
  extractionError: ExtractionError & { message: string },
): SchemaError & { message: string } {
  switch (extractionError.kind) {
    case "PropertyPathInvalid":
    case "PropertyNotFound":
      return {
        kind: "PropertyNotFound",
        path: extractionError.path,
        message: extractionError.message,
      };
    case "TypeMismatchInExtraction":
      return {
        kind: "InvalidSchema",
        message:
          `Type mismatch: expected ${extractionError.expected}, got ${extractionError.actual}`,
      };
    case "ArrayExpansionFailed":
      return {
        kind: "InvalidSchema",
        message: `Array expansion failed: ${extractionError.reason}`,
      };
    case "CircularDependency":
    case "DirectiveConflict":
    case "SchemaValidationFailed":
      return {
        kind: "InvalidSchema",
        message: extractionError.message,
      };
    case "ExtractionRecoverable":
      return {
        kind: "ExtractFromNotDefined",
        message: extractionError.message,
      };
  }
}
