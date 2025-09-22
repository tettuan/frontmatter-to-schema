import { err, ok, Result } from "../types/result.ts";
import { DomainError } from "../types/errors.ts";
import { ErrorHandler } from "../services/unified-error-handler.ts";

/**
 * ResultValidator - Utility for handling Result validation patterns
 *
 * Consolidates common error handling patterns to reduce code duplication
 * Following DRY principle and Totality principle
 */
export class ResultValidator {
  /**
   * Validates a result and returns early if it contains an error
   * Common pattern: if (!result.ok) { return err(result.error); }
   */
  static validateOrReturn<T, E extends DomainError>(
    result: Result<T, E>,
  ): Result<T, E> {
    if (!result.ok) {
      return err(result.error);
    }
    return result;
  }

  /**
   * Validates multiple results and returns the first error if any
   * Useful for validating a sequence of operations
   */
  static validateAll<E extends DomainError>(
    ...results: Array<Result<unknown, E>>
  ): Result<void, E> {
    for (const result of results) {
      if (!result.ok) {
        return err(result.error);
      }
    }
    return ok(undefined);
  }

  /**
   * Maps a successful result or returns the error
   * Common pattern for transforming successful results
   */
  static mapOrReturn<T, U, E extends DomainError>(
    result: Result<T, E>,
    mapper: (value: T) => U,
  ): Result<U, E> {
    if (!result.ok) {
      return err(result.error);
    }
    return ok(mapper(result.data));
  }

  /**
   * Chains a result with another operation that returns a Result
   * Common pattern for sequential async operations
   */
  static async chainOrReturn<T, U, E extends DomainError>(
    result: Result<T, E>,
    operation: (value: T) => Promise<Result<U, E>>,
  ): Promise<Result<U, E>> {
    if (!result.ok) {
      return err(result.error);
    }
    return await operation(result.data);
  }

  /**
   * Unwraps a result or throws an error with context
   * For cases where we need to fail fast with clear error messages
   */
  static unwrapOrThrow<T, E extends DomainError>(
    result: Result<T, E>,
    context: string,
  ): T {
    if (!result.ok) {
      const errorMessage = "message" in result.error
        ? (result.error as any).message
        : `Error kind: ${result.error.kind}`;
      throw new Error(`${context}: ${errorMessage}`);
    }
    return result.data;
  }

  /**
   * Creates a standardized error result
   * Consolidates error creation pattern
   */
  static createErrorResult<T>(
    kind: DomainError["kind"],
    message: string,
  ): Result<T, DomainError & { message: string }> {
    // For error kinds that have a message field, create directly
    if (kind === "ConfigurationError" || kind === "InitializationError") {
      return ErrorHandler.system({
        operation: "createErrorResult",
        method: "createSystemError",
      }).configurationError(message);
    }
    // For other error kinds, use the appropriate structure
    const invalidTypeResult = ErrorHandler.validation({
      operation: "createErrorResult",
      method: "createGenericError",
    }).invalidType("unknown", "unknown");
    return invalidTypeResult;
  }

  /**
   * Validates and collects multiple results into an array
   * Returns first error or all successful values
   */
  static collectResults<T, E extends DomainError>(
    results: Array<Result<T, E>>,
  ): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (!result.ok) {
        return err(result.error);
      }
      values.push(result.data);
    }
    return ok(values);
  }

  /**
   * Executes an operation and wraps any thrown errors
   * Useful for integrating with non-Result based code
   */
  static async tryAsync<T>(
    operation: () => Promise<T>,
    _errorKind: DomainError["kind"] = "ConfigurationError",
  ): Promise<Result<T, DomainError & { message: string }>> {
    try {
      const result = await operation();
      return ok(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ErrorHandler.system({
        operation: "tryAsync",
        method: "handleException",
      }).configurationError(message);
    }
  }

  /**
   * Synchronous version of tryAsync
   */
  static try<T>(
    operation: () => T,
    _errorKind: DomainError["kind"] = "ConfigurationError",
  ): Result<T, DomainError & { message: string }> {
    try {
      const result = operation();
      return ok(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ErrorHandler.system({
        operation: "try",
        method: "handleException",
      }).configurationError(message);
    }
  }
}
