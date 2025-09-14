export type Ok<T> = {
  readonly ok: true;
  readonly data: T;
};

export type Err<E> = {
  readonly ok: false;
  readonly error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

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
