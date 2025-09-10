/**
 * File Format Detector Service
 *
 * Provides configurable file format detection to eliminate hardcoded extension checking.
 * Follows Totality principles by providing total functions for format detection.
 *
 * This service abstracts format detection logic, enabling:
 * - Configurable format mappings
 * - Support for custom file formats
 * - Extensible detection strategies
 * - Consistent format handling across the application
 */

import type { Result } from "../core/result.ts";

/**
 * Supported file formats
 */
export type FileFormat = "json" | "yaml" | "xml" | "markdown" | "custom";

/**
 * Format detection error types
 */
export type DetectionError = {
  kind: "UnsupportedFormat";
  path: string;
  detectedExtension?: string;
} | {
  kind: "InvalidPath";
  path: string;
  reason: string;
};

/**
 * Format mapping configuration
 */
export interface FormatMapping {
  readonly extensions: readonly string[];
  readonly format: FileFormat;
  readonly priority: number; // Higher priority wins for conflicts
}

/**
 * Format detection configuration
 */
export interface FormatConfiguration {
  readonly mappings: readonly FormatMapping[];
  readonly defaultFormat: FileFormat;
  readonly caseSensitive: boolean;
}

/**
 * File Format Detector Interface
 *
 * Provides total functions for detecting file formats from paths.
 * All methods return Result types following Totality principles.
 */
export interface FileFormatDetector {
  /**
   * Detect file format from file path
   *
   * @param path - File path to analyze
   * @returns Result containing detected format or detection error
   */
  detectFormat(path: string): Result<FileFormat, DetectionError>;

  /**
   * Check if a path is supported by current configuration
   *
   * @param path - File path to check
   * @returns true if path can be handled
   */
  isSupported(path: string): boolean;

  /**
   * Get all supported extensions
   *
   * @returns Array of supported file extensions
   */
  getSupportedExtensions(): string[];
}

/**
 * Default format mappings for common file types
 */
export const DEFAULT_FORMAT_MAPPINGS: readonly FormatMapping[] = [
  {
    extensions: [".json"],
    format: "json",
    priority: 100,
  },
  {
    extensions: [".yaml", ".yml"],
    format: "yaml",
    priority: 100,
  },
  {
    extensions: [".xml"],
    format: "xml",
    priority: 100,
  },
  {
    extensions: [".md", ".markdown"],
    format: "markdown",
    priority: 100,
  },
] as const;

/**
 * Default format detection configuration
 */
export const DEFAULT_FORMAT_CONFIG: FormatConfiguration = {
  mappings: DEFAULT_FORMAT_MAPPINGS,
  defaultFormat: "custom",
  caseSensitive: false,
};

/**
 * Configurable File Format Detector Implementation
 *
 * Smart Constructor pattern with dependency injection for configuration.
 * Provides total functions for format detection without throwing.
 */
export class ConfigurableFormatDetector implements FileFormatDetector {
  private readonly extensionMap: Map<string, FileFormat>;

  private constructor(private readonly config: FormatConfiguration) {
    // Build extension-to-format mapping with priority handling
    this.extensionMap = new Map();

    // Sort mappings by priority (highest first)
    const sortedMappings = [...config.mappings].sort((a, b) =>
      b.priority - a.priority
    );

    for (const mapping of sortedMappings) {
      for (const extension of mapping.extensions) {
        const normalizedExt = config.caseSensitive
          ? extension
          : extension.toLowerCase();
        // Only set if not already set (higher priority wins)
        if (!this.extensionMap.has(normalizedExt)) {
          this.extensionMap.set(normalizedExt, mapping.format);
        }
      }
    }
  }

  /**
   * Smart Constructor for Format Detector
   *
   * @param config - Format detection configuration
   * @returns Result containing configured format detector
   */
  static create(
    config: FormatConfiguration = DEFAULT_FORMAT_CONFIG,
  ): Result<ConfigurableFormatDetector, never> {
    return {
      ok: true,
      data: new ConfigurableFormatDetector(config),
    };
  }

  /**
   * Detect file format from file path
   */
  detectFormat(path: string): Result<FileFormat, DetectionError> {
    // Validate path
    if (!path || typeof path !== "string") {
      return {
        ok: false,
        error: {
          kind: "InvalidPath",
          path: String(path),
          reason: "Path must be a non-empty string",
        },
      };
    }

    // Extract extension
    const lastDotIndex = path.lastIndexOf(".");
    if (lastDotIndex === -1) {
      // No extension found, use default format
      return {
        ok: true,
        data: this.config.defaultFormat,
      };
    }

    const extension = path.substring(lastDotIndex);
    const normalizedExt = this.config.caseSensitive
      ? extension
      : extension.toLowerCase();

    // Look up format in mapping
    const format = this.extensionMap.get(normalizedExt);
    if (format) {
      return {
        ok: true,
        data: format,
      };
    }

    // Extension not found in mappings
    return {
      ok: false,
      error: {
        kind: "UnsupportedFormat",
        path,
        detectedExtension: extension,
      },
    };
  }

  /**
   * Check if a path is supported by current configuration
   */
  isSupported(path: string): boolean {
    const result = this.detectFormat(path);
    return result.ok;
  }

  /**
   * Get all supported extensions
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }
}

/**
 * File Format Detector Factory
 *
 * Provides convenient creation methods for common format detector configurations.
 */
export class FormatDetectorFactory {
  /**
   * Create format detector with default configuration
   */
  static createDefault(): Result<FileFormatDetector, never> {
    return ConfigurableFormatDetector.create();
  }

  /**
   * Create format detector with custom mappings
   */
  static createCustom(
    mappings: readonly FormatMapping[],
    defaultFormat: FileFormat = "custom",
    caseSensitive: boolean = false,
  ): Result<FileFormatDetector, never> {
    const config: FormatConfiguration = {
      mappings,
      defaultFormat,
      caseSensitive,
    };
    return ConfigurableFormatDetector.create(config);
  }

  /**
   * Create format detector with additional mappings
   */
  static createExtended(
    additionalMappings: readonly FormatMapping[],
    defaultFormat: FileFormat = "custom",
  ): Result<FileFormatDetector, never> {
    const config: FormatConfiguration = {
      mappings: [...DEFAULT_FORMAT_MAPPINGS, ...additionalMappings],
      defaultFormat,
      caseSensitive: false,
    };
    return ConfigurableFormatDetector.create(config);
  }
}

/**
 * Utility functions for creating format mappings
 */
export class FormatMappingBuilder {
  /**
   * Create a simple format mapping
   */
  static create(
    extensions: string[],
    format: FileFormat,
    priority: number = 100,
  ): FormatMapping {
    return {
      extensions: extensions.map((ext) =>
        ext.startsWith(".") ? ext : `.${ext}`
      ),
      format,
      priority,
    };
  }

  /**
   * Create multiple mappings from object notation
   */
  static createFromObject(
    mappings: Record<FileFormat, string[]>,
    priority: number = 100,
  ): FormatMapping[] {
    return Object.entries(mappings).map(([format, extensions]) =>
      FormatMappingBuilder.create(extensions, format as FileFormat, priority)
    );
  }
}
