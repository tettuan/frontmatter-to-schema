/**
 * Consolidated utility functions for error handling and JSON operations
 */

import type { FileSystemError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
// JSON utilities (from json-util.ts)

/**
 * Safe JSON parsing with Result type return
 */
export function safeJsonParse<T = unknown>(
  content: string,
  context?: string,
): Result<T, FileSystemError & { message: string }> {
  try {
    const parsed = JSON.parse(content);
    return { ok: true, data: parsed };
  } catch (error) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "ReadError",
          path: context || "JSON string",
          details: `Failed to parse JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        `Failed to parse JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
): Result<string, FileSystemError & { message: string }> {
  try {
    const stringified = JSON.stringify(value, null, indent);
    return { ok: true, data: stringified };
  } catch (error) {
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "WriteError",
          path: "object",
          details: `Failed to stringify JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        `Failed to stringify JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
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
