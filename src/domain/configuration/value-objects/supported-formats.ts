import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";

/**
 * File format configuration with metadata
 * Represents a single supported output format following domain design principles
 */
export interface FormatConfig {
  readonly extensions: readonly string[];
  readonly description: string;
  readonly mimeType: string;
  readonly default: boolean;
}

/**
 * Raw format configuration from external config file
 * Used for validation and transformation to domain objects
 */
export interface RawFormatConfig {
  readonly formats: Record<string, {
    readonly extensions: string[];
    readonly description: string;
    readonly mimeType: string;
    readonly default: boolean;
  }>;
  readonly validation?: {
    readonly requireExtension?: boolean;
    readonly caseSensitive?: boolean;
    readonly allowMultipleExtensions?: boolean;
  };
  readonly features?: {
    readonly enableFormatDetection?: boolean;
    readonly enableMimeTypeValidation?: boolean;
    readonly enableCustomFormats?: boolean;
  };
  readonly fallback?: {
    readonly extensions: string[];
    readonly defaultFormat: string;
  };
}

/**
 * Supported file formats value object following Totality principles
 * Smart Constructor pattern ensures valid state and eliminates hardcoding
 */
export class SupportedFormats {
  readonly formats: ReadonlyMap<string, FormatConfig>;
  readonly allExtensions: readonly string[];
  readonly defaultFormat: string;

  private constructor(
    formats: ReadonlyMap<string, FormatConfig>,
    allExtensions: readonly string[],
    defaultFormat: string,
  ) {
    this.formats = formats;
    this.allExtensions = allExtensions;
    this.defaultFormat = defaultFormat;
  }

  /**
   * Smart Constructor for SupportedFormats with validation
   * Follows Totality principle - returns Result type instead of throwing
   */
  static create(
    config: RawFormatConfig,
  ): Result<SupportedFormats, ValidationError & { message: string }> {
    // Validate that formats exist
    if (!config.formats || Object.keys(config.formats).length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "formats",
        message:
          "Formats configuration cannot be empty. Expected at least one format definition.",
      }));
    }

    const formatMap = new Map<string, FormatConfig>();
    const allExtensions: string[] = [];
    let defaultFormatName: string | undefined;

    // Process each format configuration
    for (const [formatName, formatConfig] of Object.entries(config.formats)) {
      // Validate format name
      if (!formatName || formatName.trim().length === 0) {
        return err(createError({
          kind: "EmptyInput",
          field: "formatName",
          message: "Format name cannot be empty",
        }));
      }

      // Validate extensions
      if (!formatConfig.extensions || formatConfig.extensions.length === 0) {
        return err(createError({
          kind: "EmptyInput",
          field: `formats.${formatName}.extensions`,
          message: `Extensions for format '${formatName}' cannot be empty`,
        }));
      }

      // Validate extensions format
      for (const ext of formatConfig.extensions) {
        if (!ext.startsWith(".")) {
          return err(createError({
            kind: "InvalidFormat",
            field: `formats.${formatName}.extensions`,
            format: "extension",
            message:
              `Extension '${ext}' for format '${formatName}' must start with a dot`,
          }));
        }
      }

      // Check for duplicate extensions
      for (const ext of formatConfig.extensions) {
        if (allExtensions.includes(ext)) {
          return err(createError({
            kind: "DuplicateValue",
            field: "extensions",
            message: `Extension '${ext}' is already defined in another format`,
          }));
        }
        allExtensions.push(ext);
      }

      // Validate required fields
      if (
        !formatConfig.description ||
        formatConfig.description.trim().length === 0
      ) {
        return err(createError({
          kind: "EmptyInput",
          field: `formats.${formatName}.description`,
          message: `Description for format '${formatName}' cannot be empty`,
        }));
      }

      if (!formatConfig.mimeType || formatConfig.mimeType.trim().length === 0) {
        return err(createError({
          kind: "EmptyInput",
          field: `formats.${formatName}.mimeType`,
          message: `MIME type for format '${formatName}' cannot be empty`,
        }));
      }

      // Track default format
      if (formatConfig.default) {
        if (defaultFormatName) {
          return err(createError({
            kind: "DuplicateValue",
            field: "defaultFormat",
            message:
              `Multiple default formats found: '${defaultFormatName}' and '${formatName}'. Only one format can be default.`,
          }));
        }
        defaultFormatName = formatName;
      }

      // Create format config
      const domainFormatConfig: FormatConfig = {
        extensions: formatConfig.extensions,
        description: formatConfig.description.trim(),
        mimeType: formatConfig.mimeType.trim(),
        default: formatConfig.default,
      };

      formatMap.set(formatName, domainFormatConfig);
    }

    // Ensure at least one default format exists
    if (!defaultFormatName) {
      // Use the first format as default if none specified
      const firstFormat = Array.from(formatMap.keys())[0];
      if (firstFormat) {
        const firstFormatConfig = formatMap.get(firstFormat)!;
        formatMap.set(firstFormat, {
          ...firstFormatConfig,
          default: true,
        });
        defaultFormatName = firstFormat;
      } else {
        return err(createError({
          kind: "MissingRequired",
          field: "defaultFormat",
          message: "No default format specified and no formats available",
        }));
      }
    }

    return ok(
      new SupportedFormats(
        formatMap,
        allExtensions,
        defaultFormatName,
      ),
    );
  }

  /**
   * Create fallback configuration for error recovery
   * Used when external configuration fails to load
   * Follows Totality principle - returns Result type instead of throwing
   */
  static createFallback(): Result<
    SupportedFormats,
    ValidationError & { message: string }
  > {
    const fallbackConfig: RawFormatConfig = {
      formats: {
        json: {
          extensions: [".json"],
          description: "JavaScript Object Notation - structured data format",
          mimeType: "application/json",
          default: true,
        },
        yaml: {
          extensions: [".yaml", ".yml"],
          description:
            "YAML Ain't Markup Language - human-readable data serialization",
          mimeType: "application/x-yaml",
          default: false,
        },
        xml: {
          extensions: [".xml"],
          description: "Extensible Markup Language - structured data format",
          mimeType: "application/xml",
          default: false,
        },
      },
    };

    return SupportedFormats.create(fallbackConfig);
  }

  /**
   * Check if a file extension is supported
   */
  isExtensionSupported(extension: string): boolean {
    return this.allExtensions.includes(extension);
  }

  /**
   * Get format configuration by extension
   */
  getFormatByExtension(extension: string): FormatConfig | undefined {
    for (const [, formatConfig] of this.formats) {
      if (formatConfig.extensions.includes(extension)) {
        return formatConfig;
      }
    }
    return undefined;
  }

  /**
   * Get format configuration by name
   */
  getFormat(formatName: string): FormatConfig | undefined {
    return this.formats.get(formatName);
  }

  /**
   * Get all supported extensions as array (for error messages)
   */
  getSupportedExtensions(): readonly string[] {
    return this.allExtensions;
  }

  /**
   * Get default format configuration
   * Follows Totality principle - returns Result type instead of throwing
   */
  getDefaultFormat(): Result<
    FormatConfig,
    ValidationError & { message: string }
  > {
    const defaultConfig = this.formats.get(this.defaultFormat);
    if (!defaultConfig) {
      return err(createError({
        kind: "ConfigNotFound",
        path: this.defaultFormat,
        field: "defaultFormat",
      }, `Default format '${this.defaultFormat}' not found`));
    }
    return ok(defaultConfig);
  }

  /**
   * Check if output path has valid extension
   */
  validateOutputPath(outputPath: string): boolean {
    return this.allExtensions.some((ext) => outputPath.endsWith(ext));
  }
}
