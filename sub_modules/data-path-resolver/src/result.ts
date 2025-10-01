/**
 * Result type for error handling without exceptions (Totality principle).
 *
 * @module
 */

/**
 * Result type representing either success (Ok) or failure (Error).
 */
export class Result<T, E> {
  private constructor(
    private readonly value?: T,
    private readonly error?: E,
    private readonly ok: boolean = true,
  ) {}

  /**
   * Creates a successful Result.
   */
  static ok<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(value, undefined, true);
  }

  /**
   * Creates a failed Result.
   */
  static error<T, E>(error: E): Result<T, E> {
    return new Result<T, E>(undefined, error, false);
  }

  /**
   * Checks if the result is Ok.
   */
  isOk(): boolean {
    return this.ok;
  }

  /**
   * Checks if the result is Error.
   */
  isError(): boolean {
    return !this.ok;
  }

  /**
   * Unwraps the value (throws if Error).
   */
  unwrap(): T {
    if (!this.ok || this.value === undefined) {
      throw new Error("Called unwrap on an Error Result");
    }
    return this.value;
  }

  /**
   * Unwraps the error (throws if Ok).
   */
  unwrapError(): E {
    if (this.ok || this.error === undefined) {
      throw new Error("Called unwrapError on an Ok Result");
    }
    return this.error;
  }

  /**
   * Pattern matching for Result.
   */
  match<U>(handlers: { ok: (value: T) => U; error: (error: E) => U }): U {
    if (this.ok && this.value !== undefined) {
      return handlers.ok(this.value);
    }
    if (!this.ok && this.error !== undefined) {
      return handlers.error(this.error);
    }
    throw new Error("Invalid Result state");
  }
}
