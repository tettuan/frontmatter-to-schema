/**
 * Result Handler Service
 *
 * Consolidates Result<T,E> error handling patterns to reduce code duplication
 * Following AI Complexity Control Framework - eliminates conditional entropy
 * and applies statistical convergence principles for optimal error handling.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Error context for enhanced error messaging and debugging
 */
export interface ErrorContext {
  operation: string;
  component: string;
  input?: unknown;
  expectedType?: string;
}

/**
 * Result transformation functions type
 */
export type ResultTransform<T, U, E> = (value: T) => Result<U, E>;

/**
 * Result Handler Service - Centralized Result<T,E> pattern utilities
 */
export class ResultHandlerService {
  /**
   * Check if result is error with enhanced context
   * Eliminates: if (!result.ok) { return { ok: false, error: ... } }
   */
  static isError<T, E extends DomainError>(
    result: Result<T, E>,
    _context?: ErrorContext,
  ): result is { ok: false; error: E } {
    // Note: We cannot mutate the error here as it would violate immutability.
    // The context is logged but not added to the error.
    // Callers should use createError or map to create enhanced errors.
    return !result.ok;
  }

  /**
   * Transform result value or propagate error
   * Eliminates: if (!result.ok) return result; const transformed = transform(result.data);
   */
  static map<T, U, E extends DomainError>(
    result: Result<T, E>,
    transform: (value: T) => U,
    context?: ErrorContext,
  ): Result<U, E> {
    if (this.isError(result, context)) {
      return result;
    }
    return { ok: true, data: transform(result.data) };
  }

  /**
   * Chain result operations with error propagation
   * Eliminates: if (!result.ok) return result; return nextOperation(result.data);
   */
  static flatMap<T, U, E extends DomainError>(
    result: Result<T, E>,
    transform: ResultTransform<T, U, E>,
    context?: ErrorContext,
  ): Result<U, E> {
    if (this.isError(result, context)) {
      return result;
    }
    return transform(result.data);
  }

  /**
   * Combine multiple results with early error return
   * Eliminates: Manual error checking in sequence of operations
   */
  static combineResults<T1, T2, E extends DomainError>(
    result1: Result<T1, E>,
    result2: Result<T2, E>,
    context?: ErrorContext,
  ): Result<[T1, T2], E> {
    if (this.isError(result1, context)) {
      return result1;
    }
    if (this.isError(result2, context)) {
      return result2;
    }
    return { ok: true, data: [result1.data, result2.data] };
  }

  /**
   * Combine three results with early error return
   */
  static combineResults3<T1, T2, T3, E extends DomainError>(
    result1: Result<T1, E>,
    result2: Result<T2, E>,
    result3: Result<T3, E>,
    context?: ErrorContext,
  ): Result<[T1, T2, T3], E> {
    if (this.isError(result1, context)) return result1;
    if (this.isError(result2, context)) return result2;
    if (this.isError(result3, context)) return result3;
    return { ok: true, data: [result1.data, result2.data, result3.data] };
  }

  /**
   * Process array of results with error collection
   * Eliminates: Manual error collection and validation loops
   */
  static collectResults<T, E extends DomainError>(
    results: Result<T, E>[],
    context?: ErrorContext,
  ): Result<T[], E> {
    const successful: T[] = [];

    for (const result of results) {
      if (this.isError(result, context)) {
        return result;
      }
      successful.push(result.data);
    }

    return { ok: true, data: successful };
  }

  /**
   * Aggregate results with partial success handling
   * Allows some failures while collecting successes and errors
   */
  static aggregateResults<T, E extends DomainError>(
    results: Result<T, E>[],
    context?: ErrorContext,
  ): Result<{ successes: T[]; errors: E[] }, never> {
    const successes: T[] = [];
    const errors: E[] = [];

    for (const result of results) {
      if (this.isError(result, context)) {
        errors.push(result.error);
      } else {
        successes.push(result.data);
      }
    }

    return { ok: true, data: { successes, errors } };
  }

  /**
   * Apply default value when result is error
   * Eliminates: if (!result.ok) return defaultValue; return result.data;
   */
  static withDefault<T, E extends DomainError>(
    result: Result<T, E>,
    defaultValue: T,
    context?: ErrorContext,
  ): T {
    if (this.isError(result, context)) {
      return defaultValue;
    }
    return result.data;
  }

  /**
   * Execute side effect only on success
   * Eliminates: if (result.ok) { doSomething(result.data); }
   */
  static onSuccess<T, E extends DomainError>(
    result: Result<T, E>,
    sideEffect: (value: T) => void,
    context?: ErrorContext,
  ): Result<T, E> {
    if (!this.isError(result, context)) {
      sideEffect(result.data);
    }
    return result;
  }

  /**
   * Execute side effect only on error
   * Eliminates: if (!result.ok) { handleError(result.error); }
   */
  static onError<T, E extends DomainError>(
    result: Result<T, E>,
    errorHandler: (error: E) => void,
    context?: ErrorContext,
  ): Result<T, E> {
    if (this.isError(result, context)) {
      errorHandler(result.error);
    }
    return result;
  }

  /**
   * Create an error result with context
   * Simplifies error creation with consistent messaging
   */
  static createError<T>(
    error: DomainError,
    context?: ErrorContext,
  ): Result<T, DomainError & { message: string }> {
    // Always use createDomainError to ensure message property exists
    const message = context
      ? `${context.operation} failed in ${context.component}`
      : ("message" in error && typeof error.message === "string"
        ? error.message
        : "Operation failed");

    const enhancedError = createDomainError(error, message);
    return { ok: false, error: enhancedError };
  }

  /**
   * Pipeline multiple operations with early error return
   * Eliminates nested if-checks for sequential operations
   */
  static pipeline<T, E extends DomainError>(
    input: Result<T, E>,
    context?: ErrorContext,
  ) {
    return {
      map<U>(transform: (value: T) => U) {
        return ResultHandlerService.pipeline(
          ResultHandlerService.map(input, transform, context),
          context,
        );
      },
      flatMap<U>(transform: ResultTransform<T, U, E>) {
        return ResultHandlerService.pipeline(
          ResultHandlerService.flatMap(input, transform, context),
          context,
        );
      },
      onSuccess(sideEffect: (value: T) => void) {
        ResultHandlerService.onSuccess(input, sideEffect, context);
        return ResultHandlerService.pipeline(input, context);
      },
      onError(errorHandler: (error: E) => void) {
        ResultHandlerService.onError(input, errorHandler, context);
        return ResultHandlerService.pipeline(input, context);
      },
      withDefault(defaultValue: T) {
        return ResultHandlerService.withDefault(input, defaultValue, context);
      },
      unwrap(): Result<T, E> {
        return input;
      },
    };
  }
}
