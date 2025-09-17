/**
 * Supported Formats Registry
 *
 * Central configuration for all supported file formats in the system.
 * Uses discriminated unions for type-safe format handling.
 *
 * @module domain/shared/value-objects/supported-formats
 */

import { FileExtension } from "./file-extension.ts";
import { Result } from "../types/result.ts";
import { ValidationError } from "../types/errors.ts";

/**
 * Format categories using discriminated unions for totality
 */
export type FormatCategory =
  | { kind: "schema"; extensions: readonly string[] }
  | { kind: "template"; extensions: readonly string[] }
  | { kind: "markdown"; extensions: readonly string[] }
  | { kind: "output"; extensions: readonly string[] }
  | { kind: "configuration"; extensions: readonly string[] };

/**
 * Supported file formats registry
 * Central source of truth for all file extensions
 */
export class SupportedFormats {
  private static readonly FORMATS: readonly FormatCategory[] = [
    {
      kind: "schema",
      extensions: [".json", ".jsonschema", ".yaml", ".yml"],
    },
    {
      kind: "template",
      extensions: [".json", ".yaml", ".yml"],
    },
    {
      kind: "markdown",
      extensions: [".md", ".markdown", ".mdx"],
    },
    {
      kind: "output",
      extensions: [".json", ".yaml", ".yml"],
    },
    {
      kind: "configuration",
      extensions: [".json", ".yaml", ".yml", ".toml"],
    },
  ] as const;

  /**
   * Check if an extension is supported for a specific category
   */
  static isSupported(
    extension: FileExtension,
    category: FormatCategory["kind"],
  ): boolean {
    const format = this.FORMATS.find((f) => f.kind === category);
    if (!format) {
      return false;
    }
    return format.extensions.some((ext) => extension.matches(ext));
  }

  /**
   * Get all supported extensions for a category
   */
  static getExtensions(
    category: FormatCategory["kind"],
  ): Result<readonly FileExtension[], ValidationError & { message: string }> {
    const format = this.FORMATS.find((f) => f.kind === category);
    if (!format) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          format: "category",
          value: category,
          field: "category",
          message: `Unknown format category: ${category}`,
        },
      };
    }

    const extensions: FileExtension[] = [];
    for (const ext of format.extensions) {
      const result = FileExtension.create(ext);
      if (result.ok) {
        extensions.push(result.data);
      }
    }

    return {
      ok: true,
      data: extensions,
    };
  }

  /**
   * Validate a file path has a supported extension for a category
   */
  static validatePath(
    filePath: string,
    category: FormatCategory["kind"],
  ): Result<FileExtension, ValidationError & { message: string }> {
    const extensionResult = FileExtension.fromPath(filePath);
    if (!extensionResult.ok) {
      return extensionResult;
    }

    const extension = extensionResult.data;
    if (!this.isSupported(extension, category)) {
      const supportedResult = this.getExtensions(category);
      const supported = supportedResult.ok
        ? supportedResult.data.map((e) => e.toString()).join(", ")
        : "unknown";

      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          format: category,
          value: filePath,
          field: "filePath",
          message:
            `Unsupported ${category} format: ${extension.toString()}. Supported: ${supported}`,
        },
      };
    }

    return {
      ok: true,
      data: extension,
    };
  }

  /**
   * Get suggested file name examples for a category
   */
  static getSuggestedExamples(category: FormatCategory["kind"]): string[] {
    const format = this.FORMATS.find((f) => f.kind === category);
    if (!format) {
      return [];
    }

    const baseNames: Record<FormatCategory["kind"], string[]> = {
      schema: ["schema", "command_schema", "registry_schema"],
      template: ["template", "registry_template", "output_template"],
      markdown: ["README", "document", "specification"],
      output: ["output", "result", "data"],
      configuration: ["config", "settings", "frontmatter-to-schema"],
    };

    const names = baseNames[category] || ["file"];
    const examples: string[] = [];

    for (const name of names.slice(0, 2)) {
      for (const ext of format.extensions.slice(0, 2)) {
        examples.push(`${name}${ext}`);
      }
    }

    return examples;
  }

  /**
   * Detect category from file path
   */
  static detectCategory(
    filePath: string,
  ): Result<FormatCategory["kind"], ValidationError & { message: string }> {
    const extensionResult = FileExtension.fromPath(filePath);
    if (!extensionResult.ok) {
      return extensionResult;
    }

    const extension = extensionResult.data;

    // Check by common naming patterns
    const lowerPath = filePath.toLowerCase();
    if (lowerPath.includes("schema")) {
      if (this.isSupported(extension, "schema")) {
        return { ok: true, data: "schema" };
      }
    }
    if (lowerPath.includes("template")) {
      if (this.isSupported(extension, "template")) {
        return { ok: true, data: "template" };
      }
    }

    // Check by extension
    for (const format of this.FORMATS) {
      if (format.extensions.some((ext) => extension.matches(ext))) {
        return { ok: true, data: format.kind };
      }
    }

    return {
      ok: false,
      error: {
        kind: "InvalidFormat",
        format: "unknown",
        value: filePath,
        field: "filePath",
        message: `Cannot detect format category for: ${filePath}`,
      },
    };
  }
}
