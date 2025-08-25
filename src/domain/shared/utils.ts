/**
 * Consolidated utility functions for error handling and JSON operations
 */

import type { Result } from "../core/result.ts";
import type { IOError } from "./types.ts";
type IOErrorType = IOError;

// Error utilities (from error-utils.ts)
type IOErrorWithReason = IOErrorType & { reason?: string };

/**
 * Creates an IOError with the provided details and message
 */
export function createIOError(
  error: IOErrorType,
  message?: string,
): IOErrorType & { message: string } {
  // Determine message based on error kind
  const defaultMessage = getDefaultMessage(error);

  return {
    ...error,
    message: message || defaultMessage,
  } as IOErrorType & { message: string };
}

function getDefaultMessage(error: IOErrorType): string {
  const errorWithReason = error as IOErrorWithReason;
  switch (error.kind) {
    case "FileNotFound":
      return `File not found: ${error.path}`;
    case "ReadError":
      return `Read error at ${error.path}: ${
        errorWithReason.reason || "unknown"
      }`;
    case "WriteError":
      return `Write error at ${error.path}: ${
        errorWithReason.reason || "unknown"
      }`;
    case "PermissionDenied":
      return `Permission denied: ${error.path}`;
    default:
      return "An IO error occurred";
  }
}

// JSON utilities (from json-util.ts)

/**
 * Safe JSON parsing with Result type return
 */
export function safeJsonParse<T = unknown>(
  content: string,
  context?: string,
): Result<T, IOError> {
  try {
    const parsed = JSON.parse(content);
    return { ok: true, data: parsed };
  } catch (error) {
    return {
      ok: false,
      error: createIOError({
        kind: "ReadError",
        path: context || "JSON string",
        reason: `Failed to parse JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }),
    };
  }
}

/**
 * Safe JSON stringification with Result type return
 */
export function safeJsonStringify(
  value: unknown,
  indent?: number,
): Result<string, IOError> {
  try {
    const stringified = JSON.stringify(value, null, indent);
    return { ok: true, data: stringified };
  } catch (error) {
    return {
      ok: false,
      error: createIOError({
        kind: "WriteError",
        path: "object",
        reason: `Failed to stringify JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }),
    };
  }
}

/**
 * Type guard to check if a value is a valid JSON object
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
