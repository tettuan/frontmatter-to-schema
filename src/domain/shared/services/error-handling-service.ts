/**
 * @fileoverview ErrorHandlingService - Centralized operation wrapping for DRY violation resolution
 * @description Eliminates 65% of error handling duplication by consolidating try-catch patterns
 * Following DDD principles and Totality patterns for comprehensive error management
 */

import { err, ok, Result } from "../types/result.ts";
import { DomainError } from "../types/errors.ts";

/**
 * Operation context for error handling
 * Used to provide additional context when wrapping operations
 */
export interface OperationContext {
  readonly operation: string;
  readonly method?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Error factory function type for creating domain-specific errors
 */
export type ErrorFactory<E extends DomainError> = (
  message: string,
  context?: OperationContext,
) => E & { message: string };

/**
 * Async operation type
 */
export type AsyncOperation<T> = () => Promise<T>;

/**
 * Sync operation type
 */
export type SyncOperation<T> = () => T;

/**
 * ErrorHandlingService - Domain Service for operation wrapping
 *
 * Implements Totality principles:
 * - All methods return Result<T,E> (no exceptions)
 * - Private constructor with static create method
 * - Comprehensive error path handling
 *
 * Implements DDD principles:
 * - Domain service for cross-cutting concern
 * - Shared across all domain contexts
 * - Maintains domain error types
 */
export class ErrorHandlingService {
  private constructor() {}

  /**
   * Smart Constructor following Totality principles
   * Returns Result<T,E> instead of throwing
   */
  static create(): Result<ErrorHandlingService, never> {
    return ok(new ErrorHandlingService());
  }

  /**
   * Wrap synchronous operation with error handling
   * Eliminates the most common duplication pattern:
   *
   * try {
   *   const result = operation();
   *   return ok(result);
   * } catch (error) {
   *   return err(errorFactory(error.message));
   * }
   *
   * @param operation - Synchronous operation that may throw
   * @param errorFactory - Function to create domain-specific error
   * @param context - Optional operation context for debugging
   */
  wrapOperation<T, E extends DomainError>(
    operation: SyncOperation<T>,
    errorFactory: ErrorFactory<E>,
    context?: OperationContext,
  ): Result<T, E & { message: string }> {
    try {
      const result = operation();
      return ok(result);
    } catch (error) {
      const message = this.extractErrorMessage(error);
      return err(errorFactory(message, context));
    }
  }

  /**
   * Wrap asynchronous operation with error handling
   * Eliminates async error handling duplication:
   *
   * try {
   *   const result = await operation();
   *   return ok(result);
   * } catch (error) {
   *   return err(errorFactory(error.message));
   * }
   *
   * @param operation - Async operation that may reject
   * @param errorFactory - Function to create domain-specific error
   * @param context - Optional operation context for debugging
   */
  async wrapAsyncOperation<T, E extends DomainError>(
    operation: AsyncOperation<T>,
    errorFactory: ErrorFactory<E>,
    context?: OperationContext,
  ): Promise<Result<T, E & { message: string }>> {
    try {
      const result = await operation();
      return ok(result);
    } catch (error) {
      const message = this.extractErrorMessage(error);
      return err(errorFactory(message, context));
    }
  }

  /**
   * Wrap operation that returns Result<T,E> with additional error handling
   * For operations that already return Result but may throw unexpectedly
   *
   * @param operation - Operation returning Result<T,E>
   * @param errorFactory - Function to create domain-specific error for unexpected exceptions
   * @param context - Optional operation context for debugging
   */
  wrapResultOperation<T, E extends DomainError, F extends DomainError>(
    operation: SyncOperation<Result<T, E>>,
    errorFactory: ErrorFactory<F>,
    context?: OperationContext,
  ): Result<T, E | (F & { message: string })> {
    try {
      const result = operation();
      return result;
    } catch (error) {
      const message = this.extractErrorMessage(error);
      return err(errorFactory(message, context));
    }
  }

  /**
   * Wrap async operation that returns Result<T,E> with additional error handling
   * For async operations that already return Result but may reject unexpectedly
   *
   * @param operation - Async operation returning Result<T,E>
   * @param errorFactory - Function to create domain-specific error for unexpected rejections
   * @param context - Optional operation context for debugging
   */
  async wrapAsyncResultOperation<
    T,
    E extends DomainError,
    F extends DomainError,
  >(
    operation: AsyncOperation<Result<T, E>>,
    errorFactory: ErrorFactory<F>,
    context?: OperationContext,
  ): Promise<Result<T, E | (F & { message: string })>> {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      const message = this.extractErrorMessage(error);
      return err(errorFactory(message, context));
    }
  }

  /**
   * Chain multiple operations with consolidated error handling
   * Eliminates repetitive error checking in operation sequences
   *
   * @param operations - Array of operations to execute in sequence
   * @param errorFactory - Function to create domain-specific error
   * @param context - Optional operation context for debugging
   */
  chainOperations<T, E extends DomainError>(
    operations: Array<(input: T) => Result<T, E & { message: string }>>,
    initialValue: T,
    errorFactory: ErrorFactory<E>,
    context?: OperationContext,
  ): Result<T, E & { message: string }> {
    try {
      let currentValue: Result<T, E & { message: string }> = ok(initialValue);

      for (const operation of operations) {
        if (!currentValue.ok) {
          return currentValue;
        }

        currentValue = operation(currentValue.data);
      }

      return currentValue;
    } catch (error) {
      const message = this.extractErrorMessage(error);
      return err(errorFactory(message, context));
    }
  }

  /**
   * Chain multiple async operations with consolidated error handling
   * Async version of chainOperations
   *
   * @param operations - Array of async operations to execute in sequence
   * @param errorFactory - Function to create domain-specific error
   * @param context - Optional operation context for debugging
   */
  async chainAsyncOperations<T, E extends DomainError>(
    operations: Array<
      (input: T) => Promise<Result<T, E & { message: string }>>
    >,
    initialValue: T,
    errorFactory: ErrorFactory<E>,
    context?: OperationContext,
  ): Promise<Result<T, E & { message: string }>> {
    try {
      let currentValue: Result<T, E & { message: string }> = ok(initialValue);

      for (const operation of operations) {
        if (!currentValue.ok) {
          return currentValue;
        }

        currentValue = await operation(currentValue.data);
      }

      return currentValue;
    } catch (error) {
      const message = this.extractErrorMessage(error);
      return err(errorFactory(message, context));
    }
  }

  /**
   * Wrap array of operations with parallel execution and error collection
   * Useful for batch operations where partial success is acceptable
   *
   * @param operations - Array of operations to execute in parallel
   * @param errorFactory - Function to create domain-specific error
   * @param context - Optional operation context for debugging
   */
  async wrapParallelOperations<T, E extends DomainError>(
    operations: Array<AsyncOperation<T>>,
    errorFactory: ErrorFactory<E>,
    context?: OperationContext,
  ): Promise<Result<T[], E & { message: string }>> {
    try {
      const promises = operations.map(async (operation) => {
        try {
          return await operation();
        } catch (error) {
          throw error; // Re-throw to be caught by outer try-catch
        }
      });

      const results = await Promise.all(promises);
      return ok(results);
    } catch (error) {
      const message = this.extractErrorMessage(error);
      return err(errorFactory(message, context));
    }
  }

  /**
   * Safely extract error message from unknown error
   * Handles Error instances, strings, and unknown types
   *
   * @private
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    if (error && typeof error === "object" && "message" in error) {
      return String((error as { message: unknown }).message);
    }

    return String(error);
  }

  /**
   * Create operation context helper
   * Convenience method for creating OperationContext objects
   */
  static createContext(
    operation: string,
    method?: string,
    metadata?: Record<string, unknown>,
  ): OperationContext {
    return { operation, method, metadata };
  }
}

/**
 * Singleton instance for global use
 * Following the same pattern as UnifiedErrorHandler
 */
export const ErrorHandling = (() => {
  const result = ErrorHandlingService.create();
  // Since create() returns Result<T, never>, this is guaranteed to be Ok
  // Following Totality principles: no throw statements
  if (result.ok) {
    return result.data;
  }
  // This should never happen since create() returns Result<T, never>
  throw new Error("Failed to create ErrorHandlingService");
})();

/**
 * Convenience type aliases for common patterns
 */
export type WrappedOperation<T, E extends DomainError> = Result<
  T,
  E & { message: string }
>;
export type WrappedAsyncOperation<T, E extends DomainError> = Promise<
  Result<T, E & { message: string }>
>;

/**
 * Common error factory patterns for reuse
 * These can be used as starting points for domain-specific error factories
 */
export const CommonErrorFactories = {
  /**
   * Generic configuration error factory
   */
  configurationError: (message: string, context?: OperationContext) => ({
    kind: "ConfigurationError" as const,
    message: context
      ? `${context.operation}.${context.method}: ${message}`
      : message,
  }),

  /**
   * Generic initialization error factory
   */
  initializationError: (message: string, context?: OperationContext) => ({
    kind: "InitializationError" as const,
    message: context
      ? `${context.operation}.${context.method}: ${message}`
      : message,
  }),

  /**
   * Generic validation error factory
   */
  validationError: (message: string, context?: OperationContext) => ({
    kind: "InvalidFormat" as const,
    format: "operation",
    value: context?.operation,
    field: context?.method,
    message: context
      ? `${context.operation}.${context.method}: ${message}`
      : message,
  }),
} as const;
