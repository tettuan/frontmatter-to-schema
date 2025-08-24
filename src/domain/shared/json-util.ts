/**
 * Common JSON handling utilities with unified error handling
 */

import type { Result } from "../core/result.ts";
import { createIOError, type IOError } from "./errors.ts";

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
      error: createIOError(
        `Failed to parse JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
        context || "JSON string",
        "read",
      ),
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
      error: createIOError(
        `Failed to stringify JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
        "object",
        "write",
      ),
    };
  }
}

/**
 * Type guard to check if a value is a valid JSON object
 */
export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
