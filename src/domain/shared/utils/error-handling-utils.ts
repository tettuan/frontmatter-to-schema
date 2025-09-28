/**
 * @fileoverview Error Handling Utilities for DDD/Totality Compliance
 * @description Centralized error handling functions following Result<T,E> pattern
 * Eliminates code duplication and ensures consistent error processing
 */

import { err, ok, Result } from "../types/result.ts";
import { createError, DomainError } from "../types/errors.ts";

/**
 * Common error handling patterns for processing operations
 */
export type ProcessingError = DomainError & { message: string };

/**
 * Error aggregation result
 */
export interface ErrorAggregation {
  readonly hasErrors: boolean;
  readonly errorCount: number;
  readonly criticalErrors: ProcessingError[];
  readonly warnings: ProcessingError[];
  readonly summary: string;
}

/**
 * Error handling utilities following Totality principles
 * All error operations return structured results
 */
export class ErrorHandlingUtils {
  /**
   * Convert exception to domain error with Result pattern
   */
  static handleException(
    error: unknown,
    context: string,
    operation: string,
  ): ProcessingError {
    if (error instanceof Error) {
      return createError({
        kind: "EXCEPTION_CAUGHT",
        code: "EXCEPTION_CAUGHT",
        message: `${context}: ${operation} failed - ${error.message}`,
        originalError: error,
      });
    }

    return createError({
      kind: "UNKNOWN_ERROR",
      code: "UNKNOWN_ERROR",
      message: `${context}: ${operation} failed - Unknown error occurred`,
      originalError: error,
    });
  }

  /**
   * Execute operation with error boundary
   * Converts exceptions to Result<T,E> pattern
   */
  static async executeWithErrorBoundary<T>(
    operation: () => Promise<T>,
    context: string,
    operationName: string,
  ): Promise<Result<T, ProcessingError>> {
    try {
      const result = await operation();
      return ok(result);
    } catch (error) {
      const domainError = this.handleException(error, context, operationName);
      return err(domainError);
    }
  }

  /**
   * Execute synchronous operation with error boundary
   */
  static executeSync<T>(
    operation: () => T,
    context: string,
    operationName: string,
  ): Result<T, ProcessingError> {
    try {
      const result = operation();
      return ok(result);
    } catch (error) {
      const domainError = this.handleException(error, context, operationName);
      return err(domainError);
    }
  }

  /**
   * Aggregate multiple errors into summary
   */
  static aggregateErrors(
    errors: ProcessingError[],
    context: string,
  ): ErrorAggregation {
    const criticalErrors = errors.filter(this.isCriticalError);
    const warnings = errors.filter(this.isWarning);

    return {
      hasErrors: errors.length > 0,
      errorCount: errors.length,
      criticalErrors,
      warnings,
      summary: this.createErrorSummary(errors, context),
    };
  }

  /**
   * Check if error is critical
   */
  static isCriticalError(error: ProcessingError): boolean {
    const criticalKinds = [
      "MemoryBoundsViolation",
      "MemoryBoundsExceeded",
      "FileWriteError",
      "ReadFailed",
      "WriteFailed",
      "PermissionDenied",
      "EXCEPTION_CAUGHT",
    ];
    return criticalKinds.includes(error.kind);
  }

  /**
   * Check if error is a warning
   */
  static isWarning(error: ProcessingError): boolean {
    const warningKinds = [
      "PerformanceViolation",
      "MemoryMonitorError",
      "RETRY_EXHAUSTED",
      "NO_PROCESSING_ACTIVITY",
    ];
    return warningKinds.includes(error.kind);
  }

  /**
   * Create human-readable error summary
   */
  static createErrorSummary(
    errors: ProcessingError[],
    context: string,
  ): string {
    if (errors.length === 0) {
      return `${context}: No errors`;
    }

    if (errors.length === 1) {
      return `${context}: ${errors[0].message}`;
    }

    const critical = errors.filter(this.isCriticalError).length;
    const warnings = errors.filter(this.isWarning).length;
    const other = errors.length - critical - warnings;

    const parts = [];
    if (critical > 0) parts.push(`${critical} critical`);
    if (warnings > 0) parts.push(`${warnings} warnings`);
    if (other > 0) parts.push(`${other} other`);

    return `${context}: ${errors.length} total errors (${parts.join(", ")})`;
  }

  /**
   * Chain multiple error-prone operations
   * Short-circuits on first error following Result pattern
   */
  static async chainOperations<T>(
    operations: Array<() => Promise<Result<T, ProcessingError>>>,
    context: string,
  ): Promise<Result<T[], ProcessingError>> {
    const results: T[] = [];

    for (let i = 0; i < operations.length; i++) {
      const result = await operations[i]();
      if (!result.ok) {
        return err(createError({
          kind: "CHAIN_FAILURE",
          code: "CHAIN_FAILURE",
          message: `${context}: Operation ${
            i + 1
          } failed - ${result.error.message}`,
          originalError: result.error,
        }));
      }
      results.push(result.data);
    }

    return ok(results);
  }

  /**
   * Collect all results even with errors (opposite of chain)
   * Useful for batch processing where partial success is acceptable
   */
  static async collectAllResults<T>(
    operations: Array<() => Promise<Result<T, ProcessingError>>>,
    _context: string,
  ): Promise<{ results: T[]; errors: ProcessingError[] }> {
    const results: T[] = [];
    const errors: ProcessingError[] = [];

    for (const operation of operations) {
      const result = await operation();
      if (result.ok) {
        results.push(result.data);
      } else {
        errors.push(result.error);
      }
    }

    return { results, errors };
  }

  /**
   * Retry operation with exponential backoff
   */
  static async retryWithBackoff<T>(
    operation: () => Promise<Result<T, ProcessingError>>,
    maxRetries: number,
    baseDelayMs: number,
    context: string,
  ): Promise<Result<T, ProcessingError>> {
    let lastError: ProcessingError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await operation();

      if (result.ok) {
        return result;
      }

      lastError = result.error;

      // Don't delay after the last attempt
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return err(createError({
      kind: "RETRY_EXHAUSTED",
      code: "RETRY_EXHAUSTED",
      message: `${context}: All ${maxRetries + 1} attempts failed`,
      originalError: lastError,
    }));
  }
}
