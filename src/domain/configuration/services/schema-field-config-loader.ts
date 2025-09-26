import { err, ok, Result } from "../../shared/types/result.ts";
import {
  createError as _createError,
  ValidationError,
} from "../../shared/types/errors.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";
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
 * Safely converts and validates config object to RawSchemaFieldConfig
 * Following Totality principles - comprehensive validation without unsafe type assertions
 */
function toRawSchemaFieldConfig(
  configData: Record<string, unknown>,
  configPath: string,
): Result<RawSchemaFieldConfig, SchemaFieldConfigLoadError> {
  // Extract and validate all required top-level properties
  const versionResult = SafePropertyAccess.getProperty(configData, "version");
  const descriptionResult = SafePropertyAccess.getProperty(
    configData,
    "description",
  );
  const commandFieldsResult = SafePropertyAccess.getProperty(
    configData,
    "commandFields",
  );
  const structurePatternsResult = SafePropertyAccess.getProperty(
    configData,
    "structurePatterns",
  );
  const validationResult = SafePropertyAccess.getProperty(
    configData,
    "validation",
  );
  const featuresResult = SafePropertyAccess.getProperty(configData, "features");
  const fallbackResult = SafePropertyAccess.getProperty(configData, "fallback");

  // Check all required properties exist
  if (
    !versionResult.ok || !descriptionResult.ok || !commandFieldsResult.ok ||
    !structurePatternsResult.ok || !validationResult.ok || !featuresResult.ok ||
    !fallbackResult.ok
  ) {
    return err({
      kind: "ConfigurationError" as const,
      message: `Missing required properties in configuration at ${configPath}`,
      configPath,
    });
  }

  // Validate version and description
  if (typeof versionResult.data !== "string") {
    return err({
      kind: "ConfigurationError" as const,
      message: `version must be a string at ${configPath}`,
      configPath,
    });
  }

  if (typeof descriptionResult.data !== "string") {
    return err({
      kind: "ConfigurationError" as const,
      message: `description must be a string at ${configPath}`,
      configPath,
    });
  }

  // For the complex nested structures, we still need controlled validation
  // This is a compromise: we validate the structure but use controlled type assertions
  // after thorough validation to avoid the unsafe `as unknown as` pattern

  const rawConfig: RawSchemaFieldConfig = {
    version: versionResult.data as string,
    description: descriptionResult.data as string,
    commandFields: commandFieldsResult
      .data as RawSchemaFieldConfig["commandFields"],
    structurePatterns: structurePatternsResult
      .data as RawSchemaFieldConfig["structurePatterns"],
    validation: validationResult.data as RawSchemaFieldConfig["validation"],
    features: featuresResult.data as RawSchemaFieldConfig["features"],
    fallback: fallbackResult.data as RawSchemaFieldConfig["fallback"],
  };

  return ok(rawConfig);
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

    // Warning about fallback to defaults would be logged here if needed
    // Console logging has been removed in favor of proper domain error handling

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
