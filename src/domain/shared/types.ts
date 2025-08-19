// Core domain types following totality principle

export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export type ValidationError =
  | { kind: "EmptyInput" }
  | { kind: "InvalidFormat"; format: string; input: string }
  | { kind: "PatternMismatch"; pattern: string; input: string }
  | { kind: "OutOfRange"; value: unknown; min?: number; max?: number }
  | { kind: "InvalidPath"; path: string; reason: string }
  | { kind: "SchemaValidation"; errors: unknown[] }
  | { kind: "TemplateValidation"; errors: unknown[] };

export type ProcessingError =
  | { kind: "ExtractionFailed"; document: string; reason: string }
  | { kind: "AnalysisFailed"; document: string; reason: string }
  | { kind: "MappingFailed"; document: string; reason: string }
  | { kind: "AggregationFailed"; reason: string }
  | { kind: "ConfigurationInvalid"; errors: ValidationError[] };

export type IOError =
  | { kind: "FileNotFound"; path: string }
  | { kind: "PermissionDenied"; path: string }
  | { kind: "ReadError"; path: string; reason: string }
  | { kind: "WriteError"; path: string; reason: string };

export type AIError =
  | { kind: "PromptTooLong"; length: number; maxLength: number }
  | { kind: "APIError"; message: string; code?: string }
  | { kind: "RateLimited"; retryAfter?: number }
  | { kind: "InvalidResponse"; response: string };

// Error creation helpers
export function createError<E extends { kind: string }>(
  error: E,
  message?: string,
): E & { message: string } {
  return {
    ...error,
    message: message ?? getDefaultMessage(error),
  };
}

function getDefaultMessage(
  error: { kind: string; [key: string]: unknown },
): string {
  switch (error.kind) {
    case "EmptyInput":
      return "Input cannot be empty";
    case "InvalidFormat":
      return `Invalid format, expected ${error["format"]}, got: ${
        error["input"]
      }`;
    case "PatternMismatch":
      return `Input does not match pattern ${error["pattern"]}: ${
        error["input"]
      }`;
    case "OutOfRange":
      return `Value ${error["value"]} is out of range`;
    case "InvalidPath":
      return `Invalid path: ${error["path"]} - ${error["reason"]}`;
    case "FileNotFound":
      return `File not found: ${error["path"]}`;
    case "PermissionDenied":
      return `Permission denied: ${error["path"]}`;
    default:
      return `Error: ${error.kind}`;
  }
}

// Result combinators
export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; data: T } {
  return result.ok;
}

export function isError<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.data : defaultValue;
}

export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? { ok: true, data: fn(result.data) } : result;
}

export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.data) : result;
}

export async function wrapAsync<T, E>(
  promise: Promise<T>,
  errorMapper: (error: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: errorMapper(error) };
  }
}
