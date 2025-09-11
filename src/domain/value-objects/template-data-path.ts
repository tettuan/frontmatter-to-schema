/**
 * Template Data Path Value Object
 *
 * Represents a path to template data files (JSON, YAML, TOML)
 * Distinct from TemplatePath which is for template engine files
 * Follows Totality principles with Smart Constructor pattern
 */

import type { DomainError, Result } from "../core/result.ts";

/**
 * Template Data Path Value Object
 */
export class TemplateDataPath {
  private constructor(private readonly path: string) {}

  static create(
    path: string,
  ): Result<TemplateDataPath, DomainError & { message: string }> {
    if (typeof path !== "string") {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          input: typeof path,
          expectedFormat: "string",
          message: "Template data path must be a string",
        },
      };
    }

    if (path.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          field: "template_data_path",
          message: "Template data path cannot be empty",
        },
      };
    }

    // Validate format using domain service
    const formatValidation = TemplateDataPathValidator.validateFormat(path);
    if (!formatValidation.ok) {
      return formatValidation;
    }

    return {
      ok: true,
      data: new TemplateDataPath(path),
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
 * Template Data Format Discriminated Union (Totality Pattern)
 */
export type TemplateDataFormat =
  | { kind: "JSON"; extension: ".json" }
  | { kind: "YAML"; extension: ".yaml" | ".yml" }
  | { kind: "TOML"; extension: ".toml" };

/**
 * Template Data Path Validator Domain Service
 * Validates template data file formats
 */
export class TemplateDataPathValidator {
  private static readonly SUPPORTED_FORMATS: TemplateDataFormat[] = [
    { kind: "JSON", extension: ".json" },
    { kind: "YAML", extension: ".yaml" },
    { kind: "YAML", extension: ".yml" },
    { kind: "TOML", extension: ".toml" },
  ];

  static validateFormat(
    path: string,
  ): Result<TemplateDataFormat, DomainError & { message: string }> {
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
        message: `Template data format not supported. Supported formats: ${
          this.SUPPORTED_FORMATS.map((f) => f.extension).join(", ")
        }`,
      },
    };
  }

  static detectFormat(path: string): TemplateDataFormat | null {
    return this.SUPPORTED_FORMATS.find((format) =>
      path.endsWith(format.extension)
    ) || null;
  }
}

/**
 * Type guard for TemplateDataPath
 */
export function isTemplateDataPath(value: unknown): value is TemplateDataPath {
  return value instanceof TemplateDataPath;
}

// Export the old name for backward compatibility during migration
export { TemplateDataPath as TemplatePath };
export { TemplateDataPathValidator as TemplatePathValidator };
export { isTemplateDataPath as isTemplatePath };
export type { TemplateDataFormat as TemplateFormat };
