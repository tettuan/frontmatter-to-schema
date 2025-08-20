export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; data: T } {
  return result.ok === true;
}

export function isError<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return result.ok === false;
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (isOk(result)) {
    return { ok: true, data: fn(result.data) };
  }
  return result;
}

export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (isError(result)) {
    return { ok: false, error: fn(result.error) };
  }
  return result;
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result;
}

export async function mapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>,
): Promise<Result<U, E>> {
  if (isOk(result)) {
    return { ok: true, data: await fn(result.data) };
  }
  return result;
}

export async function flatMapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>,
): Promise<Result<U, E>> {
  if (isOk(result)) {
    return await fn(result.data);
  }
  return result;
}

export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const data: T[] = [];

  for (const result of results) {
    if (isError(result)) {
      return result;
    }
    data.push(result.data);
  }

  return { ok: true, data };
}

export function combineWithErrors<T, E>(
  results: Result<T, E>[],
): { successes: T[]; errors: E[] } {
  const successes: T[] = [];
  const errors: E[] = [];

  for (const result of results) {
    if (isOk(result)) {
      successes.push(result.data);
    } else {
      errors.push(result.error);
    }
  }

  return { successes, errors };
}
