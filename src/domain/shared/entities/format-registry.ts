/**
 * Format Registry - Entity
 *
 * Eliminates hardcoded file extension lists (Issue #663)
 * Implements DDD Entity pattern with plugin-style format support
 * Provides extensible file format detection and validation
 */

import type { Result } from "../../core/result.ts";
import {
  DEFAULT_FORMAT_PRIORITY,
  DOCUMENT_FORMAT_PRIORITY,
  OUTPUT_JSON_FORMAT_PRIORITY,
  OUTPUT_TOML_FORMAT_PRIORITY,
  OUTPUT_YAML_FORMAT_PRIORITY,
  SCHEMA_YAML_PRIMARY_FORMAT_PRIORITY,
  SCHEMA_YML_SECONDARY_FORMAT_PRIORITY,
  TEMPLATE_JSON_FORMAT_PRIORITY,
  TEMPLATE_YAML_FORMAT_PRIORITY,
  TEMPLATE_YML_FORMAT_PRIORITY,
} from "../constants.ts";

/**
 * Format registry error types following Totality principles
 */
export type FormatRegistryError =
  | { kind: "FormatNotFound"; extension: string; message: string }
  | { kind: "DuplicateFormat"; extension: string; message: string }
  | { kind: "InvalidExtension"; extension: string; message: string }
  | { kind: "EmptyRegistry"; message: string }
  | { kind: "RegistryCorrupted"; details: string; message: string };

/**
 * File format definition
 */
export interface FileFormat {
  readonly extension: string; // e.g., "json", "yaml", "yml"
  readonly mediaType: string; // e.g., "application/json"
  readonly category: FormatCategory;
  readonly priority: number; // Higher priority formats are preferred
  readonly aliases?: readonly string[]; // Alternative extensions
  readonly validator?: (content: string) => boolean;
}

/**
 * Format categories for different use cases
 */
export type FormatCategory =
  | "schema" // Schema definition files
  | "template" // Template files
  | "output" // Output formats
  | "config" // Configuration files
  | "document"; // Document files

/**
 * Format detection result
 */
export interface FormatDetectionResult {
  readonly format: FileFormat;
  readonly confidence: number; // 0-1 score
  readonly detectedBy: "extension" | "content" | "mediaType";
}

/**
 * Default format definitions
 * Consolidates all hardcoded extension lists from the codebase
 */
const DEFAULT_FORMATS: readonly FileFormat[] = [
  // Schema formats (from schema-path.ts and cli-arguments.ts)
  {
    extension: "json",
    mediaType: "application/json",
    category: "schema",
    priority: DEFAULT_FORMAT_PRIORITY.getValue(),
    validator: (content: string) => {
      try {
        JSON.parse(content);
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    extension: "yaml",
    mediaType: "application/x-yaml",
    category: "schema",
    priority: SCHEMA_YAML_PRIMARY_FORMAT_PRIORITY.getValue(),
    aliases: ["yml"],
  },
  {
    extension: "yml",
    mediaType: "application/x-yaml",
    category: "schema",
    priority: SCHEMA_YML_SECONDARY_FORMAT_PRIORITY.getValue(),
  },

  // Template formats
  {
    extension: "json",
    mediaType: "application/json",
    category: "template",
    priority: TEMPLATE_JSON_FORMAT_PRIORITY.getValue(),
  },
  {
    extension: "yaml",
    mediaType: "application/x-yaml",
    category: "template",
    priority: TEMPLATE_YAML_FORMAT_PRIORITY.getValue(),
    aliases: ["yml"],
  },
  {
    extension: "yml",
    mediaType: "application/x-yaml",
    category: "template",
    priority: TEMPLATE_YML_FORMAT_PRIORITY.getValue(),
  },

  // Output formats (from cli-arguments.ts)
  {
    extension: "json",
    mediaType: "application/json",
    category: "output",
    priority: OUTPUT_JSON_FORMAT_PRIORITY.getValue(),
  },
  {
    extension: "yaml",
    mediaType: "application/x-yaml",
    category: "output",
    priority: OUTPUT_YAML_FORMAT_PRIORITY.getValue(),
    aliases: ["yml"],
  },
  {
    extension: "toml",
    mediaType: "application/toml",
    category: "output",
    priority: OUTPUT_TOML_FORMAT_PRIORITY.getValue(),
  },

  // Document formats (from domain architecture docs)
  {
    extension: "md",
    mediaType: "text/markdown",
    category: "document",
    priority: DOCUMENT_FORMAT_PRIORITY.getValue(),
    aliases: ["markdown", "mdown", "mkd"],
  },
] as const;

/**
 * Format Registry Entity
 *
 * Follows DDD Entity pattern with identity and lifecycle management
 * Eliminates hardcoded extension arrays throughout the codebase
 */
export class FormatRegistry {
  private readonly formats = new Map<string, FileFormat>();
  private readonly categorizedFormats = new Map<FormatCategory, FileFormat[]>();

  private constructor(
    private readonly id: string,
  ) {
    // Constructor only initializes basic structure
    // Format registration is handled by factory methods
  }

  /**
   * Create registry with default formats
   */
  static createDefault(): Result<FormatRegistry, FormatRegistryError> {
    const id = `format-registry-${Date.now()}-${
      Math.random().toString(36).substr(2, 9)
    }`;

    const registry = new FormatRegistry(id);
    const registerResult = registry.registerFormats(DEFAULT_FORMATS);
    
    if (!registerResult.ok) {
      return registerResult; // Return the specific registration error
    }
    
    return {
      ok: true,
      data: registry,
    };
  }

  /**
   * Create registry with custom formats
   */
  static create(
    formats: readonly FileFormat[],
    id?: string,
  ): Result<FormatRegistry, FormatRegistryError> {
    if (formats.length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyRegistry",
          message: "Registry must contain at least one format",
        },
      };
    }

    const registryId = id || `custom-registry-${Date.now()}`;
    const registry = new FormatRegistry(registryId);
    const registerResult = registry.registerFormats(formats);
    
    if (!registerResult.ok) {
      return registerResult; // Return the specific registration error
    }
    
    return {
      ok: true,
      data: registry,
    };
  }

  /**
   * Register formats with validation
   */
  private registerFormats(formats: readonly FileFormat[]): Result<void, FormatRegistryError> {
    for (const format of formats) {
      const result = this.registerSingleFormat(format);
      if (!result.ok) {
        return result; // Early return on first error
      }
    }
    return { ok: true, data: undefined };
  }

  private registerSingleFormat(format: FileFormat): Result<void, FormatRegistryError> {
    // Validate extension
    if (!format.extension || format.extension.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "InvalidExtension",
          extension: format.extension || "",
          message: `Invalid extension: ${format.extension}`,
        },
      };
    }

    const normalizedExt = this.normalizeExtension(format.extension);

    // Always register in global formats map (may overwrite with higher priority)
    const existing = this.formats.get(normalizedExt);
    if (!existing || format.priority >= existing.priority) {
      this.formats.set(normalizedExt, format);
    }

    // Always add to categorized index (different categories can have same extension)
    if (!this.categorizedFormats.has(format.category)) {
      this.categorizedFormats.set(format.category, []);
    }
    const categoryFormats = this.categorizedFormats.get(format.category)!;

    // Remove existing format with same extension from this category
    const existingIndex = categoryFormats.findIndex((f) =>
      f.extension === format.extension
    );
    if (existingIndex >= 0) {
      categoryFormats.splice(existingIndex, 1);
    }

    // Insert in priority order
    const insertIndex = categoryFormats.findIndex((f) =>
      f.priority < format.priority
    );
    if (insertIndex >= 0) {
      categoryFormats.splice(insertIndex, 0, format);
    } else {
      categoryFormats.push(format);
    }

    // Register aliases in global map
    if (format.aliases) {
      for (const alias of format.aliases) {
        const normalizedAlias = this.normalizeExtension(alias);
        // For aliases, we need to ensure the aliased format can be found in the right category
        this.formats.set(normalizedAlias, format);
      }
    }
    
    return { ok: true, data: undefined };
  }

  /**
   * Detect format from file path
   * Replaces hardcoded validExtensions arrays
   */
  detectFormat(
    filePath: string,
    category?: FormatCategory,
  ): Result<FormatDetectionResult, FormatRegistryError> {
    if (!filePath || filePath.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "InvalidExtension",
          extension: filePath,
          message: "File path cannot be empty",
        },
      };
    }

    const extension = this.extractExtension(filePath);
    if (!extension) {
      return {
        ok: false,
        error: {
          kind: "InvalidExtension",
          extension: filePath,
          message: `Cannot extract extension from path: ${filePath}`,
        },
      };
    }

    const normalizedExt = this.normalizeExtension(extension);
    const format = this.formats.get(normalizedExt);

    if (!format) {
      return {
        ok: false,
        error: {
          kind: "FormatNotFound",
          extension: normalizedExt,
          message: `No format registered for extension: ${normalizedExt}`,
        },
      };
    }

    // Check category filter if provided
    if (category) {
      const categoryFormats = this.categorizedFormats.get(category) || [];
      const inCategory = categoryFormats.some((f) =>
        f.extension === normalizedExt ||
        (f.aliases && f.aliases.includes(normalizedExt))
      );

      if (!inCategory) {
        return {
          ok: false,
          error: {
            kind: "FormatNotFound",
            extension: normalizedExt,
            message:
              `Extension ${normalizedExt} not found in category: ${category}`,
          },
        };
      }
    }

    return {
      ok: true,
      data: {
        format,
        confidence: 0.9, // High confidence for extension-based detection
        detectedBy: "extension",
      },
    };
  }

  /**
   * Get all supported extensions for a category
   * Replaces hardcoded arrays like ["json", "yml", "yaml", "toml"]
   */
  getSupportedExtensions(category?: FormatCategory): readonly string[] {
    if (category) {
      const categoryFormats = this.categorizedFormats.get(category) || [];
      // Remove duplicates and return unique extensions
      const uniqueExtensions = Array.from(
        new Set(categoryFormats.map((f) => f.extension)),
      );
      return uniqueExtensions;
    }

    // Get unique extensions from all formats
    const allFormats = Array.from(this.formats.values());
    const uniqueExtensions = Array.from(
      new Set(allFormats.map((f) => f.extension)),
    );
    return uniqueExtensions;
  }

  /**
   * Check if extension is supported
   */
  isSupported(
    extension: string,
    category?: FormatCategory,
  ): boolean {
    const normalizedExt = this.normalizeExtension(extension);

    if (category) {
      // Check if extension exists in the specific category
      const categoryFormats = this.categorizedFormats.get(category) || [];
      return categoryFormats.some((f) =>
        f.extension === normalizedExt ||
        (f.aliases && f.aliases.includes(normalizedExt))
      );
    }

    // Check global formats
    return this.formats.has(normalizedExt);
  }

  /**
   * Get format by extension
   */
  getFormat(extension: string): Result<FileFormat, FormatRegistryError> {
    const normalizedExt = this.normalizeExtension(extension);
    const format = this.formats.get(normalizedExt);

    if (!format) {
      return {
        ok: false,
        error: {
          kind: "FormatNotFound",
          extension: normalizedExt,
          message: `No format found for extension: ${normalizedExt}`,
        },
      };
    }

    return { ok: true, data: format };
  }

  /**
   * Register additional format at runtime
   */
  registerFormat(format: FileFormat): Result<void, FormatRegistryError> {
    try {
      this.registerSingleFormat(format);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "InvalidExtension",
          extension: format.extension,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Get registry identity
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get all registered formats
   */
  getAllFormats(): readonly FileFormat[] {
    return Array.from(this.formats.values()).filter((format, index, self) =>
      self.findIndex((f) => f.extension === format.extension) === index
    );
  }

  /**
   * Extract extension from file path
   */
  private extractExtension(filePath: string): string | null {
    const lastDot = filePath.lastIndexOf(".");
    if (lastDot === -1 || lastDot === filePath.length - 1) {
      return null;
    }

    return filePath.substring(lastDot + 1);
  }

  /**
   * Normalize extension (remove dots, lowercase)
   */
  private normalizeExtension(extension: string): string {
    return extension.toLowerCase().replace(/^\./, "");
  }
}

/**
 * Error creation helper following Totality principles
 */
export const createFormatRegistryError = (
  error: FormatRegistryError,
  customMessage?: string,
): FormatRegistryError & { message: string } => ({
  ...error,
  message: customMessage || error.message,
});
