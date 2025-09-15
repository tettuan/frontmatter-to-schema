export type Ok<T> = {
  readonly ok: true;
  readonly data: T;
};

export type Err<E> = {
  readonly ok: false;
  readonly error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

// Context-aware result types for enhanced error tracking
export type ContextualOk<T> = {
  readonly ok: true;
  readonly data: T;
  readonly context?: import("./error-context.ts").ErrorContext;
};

export type ContextualErr<E> = {
  readonly ok: false;
  readonly error: E;
  readonly context: import("./error-context.ts").ErrorContext;
};

export type ContextualResult<T, E> = ContextualOk<T> | ContextualErr<E>;

export const ok = <T>(data: T): Ok<T> => ({
  ok: true,
  data,
});

export const err = <E>(error: E): Err<E> => ({
  ok: false,
  error,
});

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
  result.ok === true;

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
  result.ok === false;

export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => {
  if (isOk(result)) {
    return ok(fn(result.data));
  }
  return result;
};

export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> => {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
};

export const chain = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result;
};

export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isOk(result)) {
    return result.data;
  }
  throw new Error(
    `Attempted to unwrap an error: ${JSON.stringify(result.error)}`,
  );
};

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
};

export const combine = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.data);
  }
  return ok(values);
};

// Context-aware result helpers
export const contextualOk = <T>(
  data: T,
  context?: import("./error-context.ts").ErrorContext,
): ContextualOk<T> => ({
  ok: true,
  data,
  context,
});

export const contextualErr = <E>(
  error: E,
  context: import("./error-context.ts").ErrorContext,
): ContextualErr<E> => ({
  ok: false,
  error,
  context,
});

export const isContextualOk = <T, E>(
  result: ContextualResult<T, E>,
): result is ContextualOk<T> => result.ok === true;

export const isContextualErr = <T, E>(
  result: ContextualResult<T, E>,
): result is ContextualErr<E> => result.ok === false;

export const mapContextual = <T, U, E>(
  result: ContextualResult<T, E>,
  fn: (value: T) => U,
): ContextualResult<U, E> => {
  if (isContextualOk(result)) {
    return contextualOk(fn(result.data), result.context);
  }
  return result;
};

export const mapContextualError = <T, E, F>(
  result: ContextualResult<T, E>,
  fn: (error: E) => F,
): ContextualResult<T, F> => {
  if (isContextualErr(result)) {
    return contextualErr(fn(result.error), result.context);
  }
  return result;
};

export const chainContextual = <T, U, E>(
  result: ContextualResult<T, E>,
  fn: (value: T) => ContextualResult<U, E>,
): ContextualResult<U, E> => {
  if (isContextualOk(result)) {
    const newResult = fn(result.data);
    // Preserve parent context in chain
    if (isContextualErr(newResult) && result.context) {
      return contextualErr(
        newResult.error,
        newResult.context.withParent(result.context),
      );
    }
    return newResult;
  }
  return result;
};

// Convert regular Result to ContextualResult
export const addContext = <T, E>(
  result: Result<T, E>,
  context: import("./error-context.ts").ErrorContext,
): ContextualResult<T, E> => {
  if (isOk(result)) {
    return contextualOk(result.data, context);
  }
  return contextualErr(result.error, context);
};

// Convert ContextualResult to regular Result (strips context)
export const stripContext = <T, E>(
  result: ContextualResult<T, E>,
): Result<T, E> => {
  if (isContextualOk(result)) {
    return ok(result.data);
  }
  return err(result.error);
};
