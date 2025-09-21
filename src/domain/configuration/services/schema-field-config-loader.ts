import { err, ok, Result } from "../../shared/types/result.ts";
import {
  createError as _createError,
  ValidationError,
} from "../../shared/types/errors.ts";
import { SafePropertyAccess as _SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";
import {
  RawSchemaFieldConfig,
  SchemaFieldPatterns,
} from "../value-objects/schema-field-patterns.ts";

/**
 * Configuration loading error types
 */
export type SchemaFieldConfigLoadError =
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
 */
export interface FileSystemAdapter {
  readTextFile(path: string): Promise<Result<string, Error>>;
  exists(path: string): Promise<boolean>;
}

/**
 * YAML parsing interface for configuration loading
 */
export interface YamlParser {
  parse(yamlText: string): Promise<Result<unknown, Error>>;
}

/**
 * Safely converts validated config object to RawSchemaFieldConfig
 */
function toRawSchemaFieldConfig(
  configData: Record<string, unknown>,
  configPath: string,
): Result<RawSchemaFieldConfig, SchemaFieldConfigLoadError> {
  // Validate commandFields property exists and is an object
  if (
    !configData.commandFields || typeof configData.commandFields !== "object" ||
    Array.isArray(configData.commandFields)
  ) {
    return err({
      kind: "ConfigurationError" as const,
      message:
        `Invalid schema field configuration: commandFields must be an object at ${configPath}`,
      configPath,
    });
  }

  // Validate fallback property
  if (
    !configData.fallback || typeof configData.fallback !== "object" ||
    Array.isArray(configData.fallback)
  ) {
    return err({
      kind: "ConfigurationError" as const,
      message:
        `Invalid configuration: fallback must be an object at ${configPath}`,
      configPath,
    });
  }

  // Build the configuration object with type safety
  try {
    const rawConfig: RawSchemaFieldConfig =
      configData as unknown as RawSchemaFieldConfig;
    return ok(rawConfig);
  } catch (conversionError) {
    return err({
      kind: "ConfigurationError" as const,
      message: `Failed to convert configuration data: ${conversionError}`,
      configPath,
    });
  }
}

/**
 * Schema Field Configuration Loader Domain Service
 *
 * Loads and validates schema field pattern configurations from external files
 * Following DDD principles and Totality pattern
 */
export class SchemaFieldConfigLoader {
  constructor(
    private readonly fileSystem: FileSystemAdapter,
    private readonly yamlParser: YamlParser,
  ) {}

  /**
   * Load schema field patterns configuration from file
   */
  async loadFromFile(
    configPath: string,
  ): Promise<Result<SchemaFieldPatterns, SchemaFieldConfigLoadError>> {
    // Check if file exists
    const fileExists = await this.fileSystem.exists(configPath);
    if (!fileExists) {
      return err({
        kind: "ConfigurationError" as const,
        message: `Schema field configuration file not found: ${configPath}`,
        configPath,
      });
    }

    // Read file content
    const fileContent = await this.fileSystem.readTextFile(configPath);
    if (!fileContent.ok) {
      return err({
        kind: "ConfigurationError" as const,
        message:
          `Failed to read schema field configuration file: ${fileContent.error.message}`,
        configPath,
        parseError: fileContent.error.message,
      });
    }

    // Parse YAML
    const parsedYaml = await this.yamlParser.parse(fileContent.data);
    if (!parsedYaml.ok) {
      return err({
        kind: "ConfigurationError" as const,
        message:
          `Failed to parse schema field configuration YAML: ${parsedYaml.error.message}`,
        configPath,
        parseError: parsedYaml.error.message,
      });
    }

    // Validate structure
    if (typeof parsedYaml.data !== "object" || parsedYaml.data === null) {
      return err({
        kind: "ConfigurationError" as const,
        message: "Schema field configuration must be an object",
        configPath,
      });
    }

    // Convert to typed configuration
    const rawConfigResult = toRawSchemaFieldConfig(
      parsedYaml.data as Record<string, unknown>,
      configPath,
    );
    if (!rawConfigResult.ok) {
      return rawConfigResult;
    }

    // Create SchemaFieldPatterns value object
    const schemaFieldPatternsResult = SchemaFieldPatterns.create(
      rawConfigResult.data,
    );
    if (!schemaFieldPatternsResult.ok) {
      return err({
        kind: "ConfigurationError" as const,
        message:
          `Failed to create schema field patterns: ${schemaFieldPatternsResult.error.message}`,
        configPath,
      });
    }

    return ok(schemaFieldPatternsResult.data);
  }

  /**
   * Load configuration with fallback to defaults
   */
  async loadWithFallback(
    configPath: string,
  ): Promise<Result<SchemaFieldPatterns, SchemaFieldConfigLoadError>> {
    const configResult = await this.loadFromFile(configPath);

    if (configResult.ok) {
      return configResult;
    }

    // Log warning about falling back to defaults
    // TODO: Replace with proper domain logging
    // console.warn(
    //   `Failed to load schema field configuration from ${configPath}: ${configResult.error.message}. Using defaults.`,
    // );

    // Return default configuration
    const defaultResult = SchemaFieldPatterns.createDefault();
    if (!defaultResult.ok) {
      return err({
        kind: "ConfigurationError" as const,
        message:
          `Failed to create default schema field patterns: ${defaultResult.error.message}`,
        configPath: "defaults",
      });
    }

    return ok(defaultResult.data);
  }
}
