/**
 * Deno implementation of the FileReader interface
 *
 * This adapter provides file system access using Deno's built-in APIs,
 * implementing the FileReader interface from the domain layer.
 *
 * Following Totality principles:
 * - No exceptions thrown, returns Result types
 * - All error cases explicitly handled
 * - Total function (handles all possible inputs)
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import type { FileReader } from "../../domain/services/interfaces.ts";

export class DenoFileReader implements FileReader {
  async readTextFile(
    path: string,
  ): Promise<Result<string, DomainError & { message: string }>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (error) {
      // Handle specific Deno errors with appropriate domain error types
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "FileNotFound",
              path: path,
            },
            `File not found: ${path}`,
          ),
        };
      }

      if (error instanceof Deno.errors.PermissionDenied) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "PermissionDenied",
              path: path,
              operation: "read",
            },
            `Permission denied to read file: ${path}`,
          ),
        };
      }

      // Handle any other file system errors
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ReadError",
            path: path,
            details: String(error),
          },
          `Failed to read file ${path}: ${error}`,
        ),
      };
    }
  }
}
