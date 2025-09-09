/**
 * Template Repository Domain Interface
 *
 * Following DDD patterns - defines domain contract for template loading
 * Infrastructure layer will implement this interface
 */

import type { DomainError, Result } from "../core/result.ts";
import type { Template } from "../models/entities.ts";

/**
 * Template Path Value Object
 */
export class TemplatePath {
  private constructor(private readonly path: string) {}

  static create(
    path: string,
  ): Result<TemplatePath, DomainError & { message: string }> {
    if (typeof path !== "string") {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: typeof path,
          expectedFormat: "string",
          message: "Template path must be a string",
        },
      };
    }

    if (path.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          field: "template_path",
          message: "Template path cannot be empty",
        },
      };
    }

    // Totality principle: Use general solution instead of hardcoded special case
    const formatValidation = TemplatePathValidator.validateFormat(path);
    if (!formatValidation.ok) {
      return formatValidation;
    }

    return {
      ok: true,
      data: new TemplatePath(path),
    };
  }

  getPath(): string {
    return this.path;
  }

  toString(): string {
    return this.path;
  }
}

/**
 * Template Repository Domain Interface
 * Following CD4: Template Management Domain from domain boundary design
 */
export interface ITemplateRepository {
  /**
   * Load template by path
   */
  load(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>>;

  /**
   * Check if template exists at path
   */
  exists(
    path: TemplatePath,
  ): Promise<Result<boolean, DomainError & { message: string }>>;

  /**
   * Get template base directory for resolving relative paths
   */
  getBaseDirectory(): Result<string, DomainError & { message: string }>;
}

/**
 * Template Format Discriminated Union (Totality Pattern)
 */
export type TemplateFormat =
  | { kind: "JSON"; extension: ".json" }
  | { kind: "YAML"; extension: ".yaml" | ".yml" }
  | { kind: "TOML"; extension: ".toml" };

/**
 * Template Path Validator Domain Service
 * Implements DDD domain service for template format validation
 * Follows Totality principle - no hardcoded special cases
 */
export class TemplatePathValidator {
  private static readonly SUPPORTED_FORMATS: TemplateFormat[] = [
    { kind: "JSON", extension: ".json" },
    { kind: "YAML", extension: ".yaml" },
    { kind: "YAML", extension: ".yml" },
    { kind: "TOML", extension: ".toml" },
  ];

  static validateFormat(
    path: string,
  ): Result<TemplateFormat, DomainError & { message: string }> {
    const matchedFormat = this.SUPPORTED_FORMATS.find((format) =>
      path.endsWith(format.extension)
    );

    if (matchedFormat) {
      return { ok: true, data: matchedFormat };
    }

    return {
      ok: false,
      error: {
        kind: "FileExtensionMismatch",
        path,
        expected: this.SUPPORTED_FORMATS.map((f) => f.extension),
        message: `Template format not supported. Supported formats: ${
          this.SUPPORTED_FORMATS.map((f) => f.extension).join(", ")
        }`,
      },
    };
  }

  static detectFormat(path: string): TemplateFormat | null {
    return this.SUPPORTED_FORMATS.find((format) =>
      path.endsWith(format.extension)
    ) || null;
  }
}

/**
 * Type guard for TemplatePath
 */
export function isTemplatePath(value: unknown): value is TemplatePath {
  return value instanceof TemplatePath;
}
