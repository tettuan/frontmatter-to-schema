// Core domain types following totality principle

import {
  type ErrorCode,
  ErrorMessages,
  getErrorCode,
} from "./error-messages.ts";

// Import Result type from the canonical location
import type { Result } from "../core/result.ts";

// Re-export for backward compatibility
export type { Result };

export type ValidationError = {
  kind: "ValidationError";
  message: string;
};

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
): E & { message: string; code: ErrorCode } {
  const code = getErrorCode(error.kind);
  return {
    ...error,
    code,
    message: message ?? getDefaultMessage(error, code),
  };
}

function getDefaultMessage(
  error: { kind: string; [key: string]: unknown },
  code: ErrorCode,
): string {
  const baseMessage = (() => {
    switch (error.kind) {
      case "ValidationError":
        return String(error["message"] ?? "Validation failed");
      case "EmptyInput":
        return ErrorMessages.EMPTY_INPUT;
      case "InvalidFormat":
        return ErrorMessages.INVALID_FORMAT(
          String(error["format"]),
          String(error["input"]),
        );
      case "PatternMismatch":
        return ErrorMessages.PATTERN_MISMATCH(
          String(error["pattern"]),
          String(error["input"]),
        );
      case "OutOfRange":
        return ErrorMessages.OUT_OF_RANGE(
          error["value"],
          error["min"] as number | undefined,
          error["max"] as number | undefined,
        );
      case "InvalidPath":
        return ErrorMessages.INVALID_PATH(
          String(error["path"]),
          String(error["reason"]),
        );
      case "SchemaValidation":
        return ErrorMessages.SCHEMA_VALIDATION(error["errors"] as unknown[]);
      case "TemplateValidation":
        return ErrorMessages.TEMPLATE_VALIDATION(error["errors"] as unknown[]);
      case "FileNotFound":
        return ErrorMessages.FILE_NOT_FOUND(String(error["path"]));
      case "PermissionDenied":
        return ErrorMessages.PERMISSION_DENIED(String(error["path"]));
      case "ReadError":
        return ErrorMessages.READ_ERROR(
          String(error["path"]),
          String(error["reason"]),
        );
      case "WriteError":
        return ErrorMessages.WRITE_ERROR(
          String(error["path"]),
          String(error["reason"]),
        );
      case "ExtractionFailed":
        return ErrorMessages.EXTRACTION_FAILED(
          String(error["document"]),
          String(error["reason"]),
        );
      case "AnalysisFailed":
        return ErrorMessages.ANALYSIS_FAILED(
          String(error["document"]),
          String(error["reason"]),
        );
      case "MappingFailed":
        return ErrorMessages.MAPPING_FAILED(
          String(error["document"]),
          String(error["reason"]),
        );
      case "AggregationFailed":
        return ErrorMessages.AGGREGATION_FAILED(String(error["reason"]));
      case "ConfigurationInvalid":
        return ErrorMessages.CONFIGURATION_INVALID(
          error["errors"] as unknown[],
        );
      case "PromptTooLong":
        return ErrorMessages.PROMPT_TOO_LONG(
          Number(error["length"]),
          Number(error["maxLength"]),
        );
      case "APIError":
        return ErrorMessages.API_ERROR(
          String(error["message"]),
          error["code"] as string | undefined,
        );
      case "RateLimited":
        return ErrorMessages.RATE_LIMITED(
          error["retryAfter"] as number | undefined,
        );
      case "InvalidResponse":
        return ErrorMessages.INVALID_RESPONSE(String(error["response"]));
      default:
        return `Error: ${error.kind}`;
    }
  })();

  return `[${code}] ${baseMessage}`;
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
