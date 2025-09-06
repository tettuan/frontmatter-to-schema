/**
 * Error Handler Service
 *
 * Centralized error message generation and Result type handling
 * following DDD principles. Eliminates code duplication patterns
 * across the codebase while maintaining consistency.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Error context for generating contextual error messages
 */
export interface ErrorContext {
  operation: string;
  resource?: string;
  details?: Record<string, unknown>;
}

/**
 * Standard error message patterns
 */
const ERROR_PATTERNS = {
  fileNotFound: (resource: string) => `${resource} file not found`,
  readError: (resource: string, details?: string) =>
    details ? `${resource} read error: ${details}` : `Failed to read ${resource}`,
  loadError: (resource: string, details?: string) =>
    details ? `${resource} load error: ${details}` : `Failed to load ${resource}`,
  validationError: (resource: string, reason?: string) =>
    reason ? `${resource} validation failed: ${reason}` : `${resource} validation failed`,
  processingError: (operation: string, reason?: string) =>
    reason ? `${operation} processing failed: ${reason}` : `${operation} processing failed`,
} as const;

/**
 * Centralized Error Handler Service
 */
export class ErrorHandlerService {
  /**
   * Generate standardized error message based on error kind and context
   */
  static generateMessage(
    error: DomainError,
    context: ErrorContext,
  ): string {
    const { operation, resource = operation, details } = context;
    const detailsString = details?.toString();

    switch (error.kind) {
      case "FileNotFound":
        return ERROR_PATTERNS.fileNotFound(resource);
      
      case "ReadError":
        return ERROR_PATTERNS.readError(resource, detailsString);
      
      case "LoadError":
        return ERROR_PATTERNS.loadError(resource, detailsString);
      
      case "ValidationError":
        return ERROR_PATTERNS.validationError(resource, detailsString);
      
      case "ProcessingError":
        return ERROR_PATTERNS.processingError(operation, detailsString);
      
      default:
        return `${operation} failed: ${error.message || 'Unknown error'}`;
    }
  }

  /**
   * Create a standardized Result error with contextual message
   */
  static createError<T>(
    errorKind: DomainError["kind"],
    context: ErrorContext,
    originalError?: unknown,
  ): Result<T, DomainError & { message: string }> {
    const baseError = createDomainError(
      { 
        kind: errorKind, 
        input: context.resource, 
        details: originalError 
      },
      "Base error"
    );

    const message = this.generateMessage(baseError.error, context);

    return {
      ok: false,
      error: {
        ...baseError.error,
        message,
      },
    };
  }

  /**
   * Transform a Result error with standardized messaging
   */
  static transformError<T>(
    result: Result<T, DomainError>,
    context: ErrorContext,
  ): Result<T, DomainError & { message: string }> {
    if (result.ok) {
      return result;
    }

    const message = this.generateMessage(result.error, context);

    return {
      ok: false,
      error: {
        ...result.error,
        message,
      },
    };
  }

  /**
   * Chain multiple Result operations with consistent error handling
   */
  static chainResults<T, U>(
    result: Result<T, DomainError>,
    transform: (value: T) => Result<U, DomainError>,
    context: ErrorContext,
  ): Result<U, DomainError & { message: string }> {
    if (!result.ok) {
      return this.transformError(result, context);
    }

    const transformedResult = transform(result.data);
    return this.transformError(transformedResult, context);
  }

  /**
   * Handle multiple Results with aggregated error reporting
   */
  static aggregateResults<T>(
    results: Result<T, DomainError>[],
    context: ErrorContext,
  ): Result<T[], DomainError & { message: string }> {
    const successful: T[] = [];
    const errors: string[] = [];

    for (const result of results) {
      if (result.ok) {
        successful.push(result.data);
      } else {
        errors.push(this.generateMessage(result.error, context));
      }
    }

    if (errors.length > 0) {
      return this.createError(
        "ProcessingError",
        {
          ...context,
          details: { errors: errors.join("; "), successCount: successful.length }
        }
      );
    }

    return { ok: true, data: successful };
  }
}