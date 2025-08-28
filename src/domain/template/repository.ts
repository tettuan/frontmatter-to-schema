/**
 * Template Repository Interface
 *
 * Following DDD repository pattern for Template aggregate
 * Provides abstraction for template persistence
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Template path value object
 * Ensures paths are valid and normalized
 */
export class TemplatePath {
  private constructor(private readonly value: string) {}

  static create(
    path: string,
  ): Result<TemplatePath, DomainError & { message: string }> {
    if (typeof path !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(path),
          expectedFormat: "string",
        }),
      };
    }

    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "path",
        }),
      };
    }

    // Normalize path
    const normalized = path.trim().replace(/\\/g, "/");

    // Validate extension if file path
    if (normalized.includes(".")) {
      const ext = normalized.split(".").pop()?.toLowerCase();
      const validExtensions = ["json", "yaml", "yml", "hbs", "template"];
      if (!ext || !validExtensions.includes(ext)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileExtensionMismatch",
            path: normalized,
            expected: validExtensions,
          }),
        };
      }
    }

    return {
      ok: true,
      data: new TemplatePath(normalized),
    };
  }

  getValue(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}
