/**
 * @fileoverview ExtractFromDirective - Minimal stub to resolve CI errors
 * TODO: Replace with full implementation when x-extract-from feature is developed
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";

/**
 * Minimal stub implementation of ExtractFromDirective
 * Exists solely to satisfy TypeScript compilation during development phase
 */
export class ExtractFromDirective {
  private constructor(private readonly path: string) {}

  static create(
    path: string,
  ): Result<ExtractFromDirective, DomainError & { message: string }> {
    if (!path || typeof path !== "string") {
      return err(createError({
        kind: "InvalidFormat",
        format: "extract-from-path",
        value: path,
        message: "Path is required",
      }));
    }
    return ok(new ExtractFromDirective(path));
  }

  getPath(): string {
    return this.path;
  }
}
