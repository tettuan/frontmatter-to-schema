import { err, ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";
import {
  RawFormatConfig,
  SupportedFormats,
} from "../value-objects/supported-formats.ts";

/**
 * Configuration loading error types
 */
export type ConfigLoadError =
  | (ValidationError & {
    message: string;
    readonly configPath?: string;
    readonly parseError?: string;
  })
  | {
    readonly kind: "ConfigurationError";
    readonly message: string;
    readonly configPath?: string;
    readonly parseError?: string;
  };

/**
 * File system interface for configuration loading
 * Abstraction to enable testing and different file system implementations
 */
export interface FileSystemAdapter {
  readTextFile(path: string): Promise<Result<string, Error>>;
  exists(path: string): Promise<boolean>;
}

/**
 * YAML parsing interface for configuration loading
 * Abstraction to enable testing and different YAML parser implementations
 */
export interface YamlParser {
  parse(yamlText: string): Promise<Result<unknown, Error>>;
}

/**
 * Safely converts validated config object to RawFormatConfig
 * Performs complete validation to ensure type safety without assertions
 */
function toRawFormatConfig(
  configData: Record<string, unknown>,
  configPath: string,
): Result<RawFormatConfig, ConfigLoadError> {
  // Validate formats property exists and is an object
  if (
    !configData.formats || typeof configData.formats !== "object" ||
    Array.isArray(configData.formats)
  ) {
    return err(createConfigLoadError(
      "MissingRequired",
      "Configuration 'formats' must be an object",
      { configPath, field: "formats" },
    ));
  }

  const formatsResult = SafePropertyAccess.asRecord(configData.formats);
  if (!formatsResult.ok) {
    return err(createConfigLoadError(
      "InvalidStructure",
      `Configuration 'formats' is not a valid object: ${formatsResult.error.message}`,
      { configPath, field: "formats" },
    ));
  }

  // Validate each format object structure
  const formatEntries = Object.entries(formatsResult.data);
  for (const [formatName, formatConfig] of formatEntries) {
    if (typeof formatConfig !== "object" || !formatConfig) {
      return err(createConfigLoadError(
        "InvalidStructure",
        `Format '${formatName}' must be an object`,
        { configPath, field: `formats.${formatName}` },
      ));
    }

    const formatObjResult = SafePropertyAccess.asRecord(formatConfig);
    if (!formatObjResult.ok) {
      return err(createConfigLoadError(
        "InvalidStructure",
        `Format '${formatName}' is not a valid object: ${formatObjResult.error.message}`,
        { configPath, field: `formats.${formatName}` },
      ));
    }

    const formatObj = formatObjResult.data;

    // Validate required properties
    if (!Array.isArray(formatObj.extensions)) {
      return err(createConfigLoadError(
        "MissingRequired",
        `Format '${formatName}' must have 'extensions' array`,
        { configPath, field: `formats.${formatName}.extensions` },
      ));
    }

    if (typeof formatObj.description !== "string") {
      return err(createConfigLoadError(
        "MissingRequired",
        `Format '${formatName}' must have 'description' string`,
        { configPath, field: `formats.${formatName}.description` },
      ));
    }

    if (typeof formatObj.mimeType !== "string") {
      return err(createConfigLoadError(
        "MissingRequired",
        `Format '${formatName}' must have 'mimeType' string`,
        { configPath, field: `formats.${formatName}.mimeType` },
      ));
    }

    if (typeof formatObj.default !== "boolean") {
      return err(createConfigLoadError(
        "MissingRequired",
        `Format '${formatName}' must have 'default' boolean`,
        { configPath, field: `formats.${formatName}.default` },
      ));
    }
  }

  // Validate validation property if present
  let validationData: RawFormatConfig["validation"] = undefined;
  if (configData.validation) {
    if (typeof configData.validation !== "object") {
      return err(createConfigLoadError(
        "InvalidStructure",
        "Validation property must be an object",
        { configPath, field: "validation" },
      ));
    }

    const validationResult = SafePropertyAccess.asRecord(configData.validation);
    if (!validationResult.ok) {
      return err(createConfigLoadError(
        "InvalidStructure",
        `Validation is not a valid object: ${validationResult.error.message}`,
        { configPath, field: "validation" },
      ));
    }

    validationData = validationResult.data;
  }

  // Create a properly typed formats object after validation
  const validatedFormats: Record<string, {
    readonly extensions: string[];
    readonly description: string;
    readonly mimeType: string;
    readonly default: boolean;
  }> = {};

  // Copy validated format data with proper typing
  for (const [formatName, formatConfig] of formatEntries) {
    const formatObjResult = SafePropertyAccess.asRecord(formatConfig);
    if (formatObjResult.ok) {
      const formatObj = formatObjResult.data;
      validatedFormats[formatName] = {
        extensions: formatObj.extensions as string[],
        description: formatObj.description as string,
        mimeType: formatObj.mimeType as string,
        default: formatObj.default as boolean,
      };
    }
  }

  // Create a properly typed RawFormatConfig object with validated data
  const rawConfig: RawFormatConfig = {
    formats: validatedFormats,
    validation: validationData,
  };

  return ok(rawConfig);
}

/**
 * Helper function to create ConfigLoadError objects safely
 * Eliminates type assertions for error creation
 */
function createConfigLoadError(
  kind: ValidationError["kind"] | "ConfigurationError",
  message: string,
  options: {
    configPath?: string;
    parseError?: string;
    field?: string;
    path?: string;
    input?: string;
  } = {},
): ConfigLoadError {
  const baseError = {
    kind,
    message,
    configPath: options.configPath,
    parseError: options.parseError,
  };

  // Add ValidationError-specific fields based on kind
  switch (kind) {
    case "ConfigNotFound":
      return {
        ...baseError,
        kind: "ConfigNotFound",
        path: options.path || "",
        field: options.field || "configPath",
      };
    case "ConfigReadError":
      return {
        ...baseError,
        kind: "ConfigReadError",
        field: options.field || "configFile",
      };
    case "ParseError":
      return {
        ...baseError,
        kind: "ParseError",
        input: options.input || "",
        field: options.field || "yamlContent",
      };
    case "InvalidStructure":
      return {
        ...baseError,
        kind: "InvalidStructure",
        field: options.field || "configuration",
      };
    case "MissingRequired":
      return {
        ...baseError,
        kind: "MissingRequired",
        field: options.field || "formats",
      };
    case "EmptyInput":
      return {
        ...baseError,
        kind: "EmptyInput",
      };
    case "UnknownError":
      return {
        ...baseError,
        kind: "UnknownError",
        field: options.field || "configuration",
      };
    default:
      return {
        ...baseError,
        kind: "ConfigurationError",
      };
  }
}

/**
 * Format configuration loader service following DDD principles
 * Handles external configuration loading with graceful fallback
 */
export class FormatConfigLoader {
  private readonly fileSystem: FileSystemAdapter;
  private readonly yamlParser: YamlParser;
  private readonly configPath: string;
  private cachedConfig?: SupportedFormats;

  constructor(
    fileSystem: FileSystemAdapter,
    yamlParser: YamlParser,
    configPath: string = "config/supported-formats.yml",
  ) {
    this.fileSystem = fileSystem;
    this.yamlParser = yamlParser;
    this.configPath = configPath;
  }

  /**
   * Load supported formats configuration from external file
   * Returns Result type following Totality principles
   */
  async loadConfiguration(): Promise<
    Result<SupportedFormats, ConfigLoadError>
  > {
    // Return cached configuration if available
    if (this.cachedConfig) {
      return ok(this.cachedConfig);
    }

    try {
      // Check if configuration file exists
      const exists = await this.fileSystem.exists(this.configPath);
      if (!exists) {
        return err(createConfigLoadError(
          "ConfigNotFound",
          `Configuration file not found: ${this.configPath}`,
          {
            configPath: this.configPath,
            path: this.configPath,
            field: "configPath",
          },
        ));
      }

      // Read configuration file
      const fileResult = await this.fileSystem.readTextFile(this.configPath);
      if (!fileResult.ok) {
        return err(createConfigLoadError(
          "ConfigReadError",
          `Failed to read configuration file: ${this.configPath}. ${fileResult.error.message}`,
          {
            configPath: this.configPath,
            field: "configFile",
          },
        ));
      }

      // Parse YAML content
      const parseResult = await this.yamlParser.parse(fileResult.data);
      if (!parseResult.ok) {
        return err(createConfigLoadError(
          "ParseError",
          `Failed to parse YAML configuration: ${parseResult.error.message}`,
          {
            configPath: this.configPath,
            field: "yamlContent",
            input: "",
            parseError: parseResult.error.message,
          },
        ));
      }

      // Validate configuration structure
      const validationResult = this.validateConfigStructure(parseResult.data);
      if (!validationResult.ok) {
        return validationResult;
      }

      // Safely convert parsed data to RawFormatConfig
      const configDataResult = SafePropertyAccess.asRecord(parseResult.data);
      if (!configDataResult.ok) {
        return err(createConfigLoadError(
          "InvalidStructure",
          `Configuration data is not a valid object: ${configDataResult.error.message}`,
          {
            configPath: this.configPath,
            field: "configuration",
          },
        ));
      }

      // Validate the data has the required formats property for RawFormatConfig
      const configData = configDataResult.data;
      if (!configData.formats) {
        return err(createConfigLoadError(
          "MissingRequired",
          "Configuration must contain 'formats' property",
          {
            configPath: this.configPath,
            field: "formats",
          },
        ));
      }

      // Convert to RawFormatConfig safely
      const rawConfigResult = toRawFormatConfig(configData, this.configPath);
      if (!rawConfigResult.ok) {
        return err(rawConfigResult.error);
      }

      // Create SupportedFormats value object
      const formatsResult = SupportedFormats.create(
        rawConfigResult.data,
      );
      if (!formatsResult.ok) {
        return err(createConfigLoadError(
          formatsResult.error.kind,
          formatsResult.error.message,
          {
            configPath: this.configPath,
          },
        ));
      }

      // Cache successful configuration
      this.cachedConfig = formatsResult.data;
      return ok(formatsResult.data);
    } catch (error) {
      return err(createConfigLoadError(
        "UnknownError",
        `Unexpected error loading configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          configPath: this.configPath,
          field: "configuration",
        },
      ));
    }
  }

  /**
   * Load configuration with fallback to default
   * Always returns a valid SupportedFormats object for robustness
   */
  async loadConfigurationWithFallback(): Promise<SupportedFormats> {
    const result = await this.loadConfiguration();
    if (result.ok) {
      return result.data;
    }

    // Log warning about fallback (in production, this would use proper logging)
    // TODO: Replace with proper domain logging
    // console.warn(
    //   `Failed to load configuration from ${this.configPath}: ${result.error.message}. Using fallback configuration.`,
    // );

    const fallbackResult = SupportedFormats.createFallback();
    if (fallbackResult.ok) {
      return fallbackResult.data;
    }

    // If even fallback fails, this is a critical system error
    // Since this method promises to always return a valid config, throw here
    // This should never happen with our hardcoded fallback
    throw new Error(
      `Critical: Both config loading and fallback failed: ${fallbackResult.error.message}`,
    );
  }

  /**
   * Clear cached configuration (useful for testing or hot-reload scenarios)
   */
  clearCache(): void {
    this.cachedConfig = undefined;
  }

  /**
   * Get configuration file path for debugging
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Validate basic structure of parsed configuration
   */
  private validateConfigStructure(
    config: unknown,
  ): Result<void, ConfigLoadError> {
    if (!config || typeof config !== "object") {
      return err(createConfigLoadError(
        "InvalidStructure",
        "Configuration must be an object",
        {
          configPath: this.configPath,
          field: "configuration",
        },
      ));
    }

    const configObjResult = SafePropertyAccess.asRecord(config);
    if (!configObjResult.ok) {
      return err(createConfigLoadError(
        "InvalidStructure",
        `Configuration is not a valid object: ${configObjResult.error.message}`,
        {
          configPath: this.configPath,
          field: "configuration",
        },
      ));
    }

    const configObj = configObjResult.data;

    if (!configObj.formats || typeof configObj.formats !== "object") {
      return err(createConfigLoadError(
        "MissingRequired",
        "Configuration must contain 'formats' object",
        {
          configPath: this.configPath,
          field: "formats",
        },
      ));
    }

    const formatsResult = SafePropertyAccess.asRecord(configObj.formats);
    if (!formatsResult.ok) {
      return err(createConfigLoadError(
        "InvalidStructure",
        `Formats is not a valid object: ${formatsResult.error.message}`,
        {
          configPath: this.configPath,
          field: "formats",
        },
      ));
    }

    const formats = formatsResult.data;
    if (Object.keys(formats).length === 0) {
      return err(createConfigLoadError(
        "EmptyInput",
        "Formats configuration cannot be empty",
        {
          configPath: this.configPath,
          field: "formats",
        },
      ));
    }

    return ok(void 0);
  }
}

/**
 * Factory for creating FormatConfigLoader with default adapters
 * Simplifies dependency injection for common use cases
 */
export class FormatConfigLoaderFactory {
  /**
   * Create loader with Deno file system and YAML parser
   */
  static createWithDenoAdapters(configPath?: string): FormatConfigLoader {
    const fileSystem = new DenoFileSystemAdapter();
    const yamlParser = new DenoYamlParser();
    return new FormatConfigLoader(fileSystem, yamlParser, configPath);
  }
}

/**
 * Deno-specific file system adapter
 */
class DenoFileSystemAdapter implements FileSystemAdapter {
  async readTextFile(path: string): Promise<Result<string, Error>> {
    try {
      const content = await Deno.readTextFile(path);
      return ok(content);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Deno-specific YAML parser adapter
 */
class DenoYamlParser implements YamlParser {
  async parse(yamlText: string): Promise<Result<unknown, Error>> {
    try {
      const parsed = await this.parseYaml(yamlText);
      return ok(parsed);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async parseYaml(yamlText: string): Promise<unknown> {
    // Import YAML parser dynamically to avoid circular dependencies
    const { parse } = await import("jsr:@std/yaml@^1.0.5");
    return parse(yamlText);
  }
}
