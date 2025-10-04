/**
 * Result type for YAML Schema Mapper
 *
 * Simplified Result type for this sub-module (no dependencies on parent project)
 */
export class Result<T, E> {
  private constructor(
    private readonly _isOk: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  static ok<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static error<T, E>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  isOk(): boolean {
    return this._isOk;
  }

  isError(): boolean {
    return !this._isOk;
  }

  unwrap(): T {
    if (!this._isOk) {
      throw new Error("Result is an error");
    }
    return this._value!;
  }

  unwrapError(): E {
    if (this._isOk) {
      throw new Error("Result is not an error");
    }
    return this._error!;
  }

  unwrapOr(defaultValue: T): T {
    if (this._isOk) {
      return this._value!;
    }
    return defaultValue;
  }

  unwrapOrElse(fn: (error: E) => T): T {
    if (this._isOk) {
      return this._value!;
    }
    return fn(this._error!);
  }

  getValue(): T | undefined {
    if (this._isOk) {
      return this._value!;
    }
    return undefined;
  }

  getError(): E | undefined {
    if (!this._isOk) {
      return this._error!;
    }
    return undefined;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this._isOk) {
      return Result.ok(fn(this._value!));
    }
    return Result.error(this._error!);
  }

  mapError<F>(fn: (error: E) => F): Result<T, F> {
    if (this._isOk) {
      return Result.ok(this._value!);
    }
    return Result.error(fn(this._error!));
  }

  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this._isOk) {
      return fn(this._value!);
    }
    return Result.error(this._error!);
  }

  match<U>(onSuccess: (value: T) => U, onError: (error: E) => U): U {
    if (this._isOk) {
      return onSuccess(this._value!);
    }
    return onError(this._error!);
  }
}
