/**
 * Template Repository Interface
 *
 * Following DDD repository pattern for Template aggregate
 * Provides abstraction for template persistence
 */

import type { Result } from "../core/result.ts";
import type { ValidationError } from "../shared/errors.ts";
import type { Template } from "../models/template.ts";

/**
 * Template path value object
 * Ensures paths are valid and normalized
 */
export class TemplatePath {
  private constructor(private readonly value: string) {}

  static create(path: string): Result<TemplatePath, ValidationError> {
    if (typeof path !== "string") {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Template path must be a string",
        },
      };
    }

    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Template path cannot be empty",
        },
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
          error: {
            kind: "ValidationError",
            message:
              `Invalid template file extension: ${ext}. Valid extensions: ${
                validExtensions.join(", ")
              }`,
          },
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

/**
 * Repository interface for Template aggregate
 * Implementations handle actual storage/retrieval
 */
export interface TemplateRepository {
  /**
   * Load a template by ID
   */
  load(templateId: string): Promise<Result<Template, ValidationError>>;

  /**
   * Load a template from a specific path
   */
  loadFromPath(path: TemplatePath): Promise<Result<Template, ValidationError>>;

  /**
   * Save a template
   */
  save(template: Template): Promise<Result<void, ValidationError>>;

  /**
   * Check if a template exists
   */
  exists(templateId: string): Promise<boolean>;

  /**
   * List all available template IDs
   */
  list(): Promise<Result<string[], ValidationError>>;
}
