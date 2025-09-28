/**
 * Result type implementing the Railway Pattern for error handling.
 * This follows the Totality principle by making all operations total functions
 * and explicit error handling without exceptions.
 */
export class Result<T, E> {
  private constructor(
    private readonly _isOk: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  /**
   * Creates a successful result containing a value.
   */
  static ok<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  /**
   * Creates an error result containing an error.
   */
  static error<T, E>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  /**
   * Returns true if this result represents a success.
   */
  isOk(): boolean {
    return this._isOk;
  }

  /**
   * Returns true if this result represents an error.
   */
  isError(): boolean {
    return !this._isOk;
  }

  /**
   * Unwraps the success value. Throws if this is an error result.
   * Use this only when you're certain the result is successful.
   */
  unwrap(): T {
    if (!this._isOk) {
      throw new Error("Result is an error");
    }
    return this._value!;
  }

  /**
   * Unwraps the error value. Throws if this is a success result.
   * Use this only when you're certain the result is an error.
   */
  unwrapError(): E {
    if (this._isOk) {
      throw new Error("Result is not an error");
    }
    return this._error!;
  }

  /**
   * Maps the success value to a new value using the provided function.
   * If this is an error result, returns the error unchanged.
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this._isOk) {
      return Result.ok(fn(this._value!));
    }
    return Result.error(this._error!);
  }

  /**
   * Maps the error value to a new error using the provided function.
   * If this is a success result, returns the success unchanged.
   */
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this._isOk) {
      return Result.ok(this._value!);
    }
    return Result.error(fn(this._error!));
  }

  /**
   * Chains operations that return Results. If this is an error,
   * the operation is not executed and the error is propagated.
   */
  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this._isOk) {
      return fn(this._value!);
    }
    return Result.error(this._error!);
  }

  /**
   * Pattern matching for Result. Executes the appropriate function
   * based on whether this is a success or error result.
   */
  match<U>(onSuccess: (value: T) => U, onError: (error: E) => U): U {
    if (this._isOk) {
      return onSuccess(this._value!);
    }
    return onError(this._error!);
  }
}
