/**
 * Enhanced Configuration Validation with Totality Principles
 *
 * This module provides comprehensive validation for application configuration
 * using discriminated unions and smart constructors to ensure only valid
 * configurations can be created.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type {
  ConfigPath,
  DocumentPath,
  OutputPath,
  TemplatePath,
} from "./value-objects.ts";

/**
 * Configuration validation state - discriminated union
 */
export type ConfigurationValidationState =
  | { kind: "Valid"; config: ValidatedConfiguration }
  | { kind: "Invalid"; errors: ConfigurationValidationError[] }
  | {
    kind: "PartiallyValid";
    config: ValidatedConfiguration;
    warnings: string[];
  };

/**
 * Configuration-specific validation errors
 */
export type ConfigurationValidationError =
  | { kind: "MissingRequiredField"; field: string; section: string }
  | {
    kind: "InvalidFieldType";
    field: string;
    expected: string;
    actual: string;
  }
  | {
    kind: "InvalidFieldValue";
    field: string;
    value: unknown;
    constraints: string;
  }
  | { kind: "PathNotAccessible"; field: string; path: string; reason: string }
  | { kind: "IncompatibleSettings"; settings: string[]; reason: string }
  | {
    kind: "InvalidAIProvider";
    provider: string;
    supportedProviders: string[];
  }
  | {
    kind: "MissingAPICredentials";
    provider: string;
    requiredFields: string[];
  }
  | {
    kind: "InvalidConcurrencySettings";
    maxConcurrency: number;
    reason: string;
  }
  | {
    kind: "InvalidAPICredentials";
    provider: string;
    requiredFields: string[];
  };

/**
 * AI provider configuration - discriminated union for type safety
 */
export type AIProviderConfig =
  | {
    kind: "Claude";
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
  | {
    kind: "OpenAI";
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }
  | { kind: "Local"; endpoint: string; model: string; timeout?: number }
  | { kind: "Mock"; responseDelay?: number };

/**
 * Processing strategy configuration - discriminated union
 */
export type ProcessingStrategy =
  | { kind: "Sequential"; continueOnError: boolean }
  | { kind: "Parallel"; maxConcurrency: number; continueOnError: boolean }
  | {
    kind: "Batch";
    batchSize: number;
    maxConcurrency: number;
    continueOnError: boolean;
  };

/**
 * Output format configuration - discriminated union
 */
export type OutputFormatConfig =
  | { kind: "JSON"; pretty: boolean; indent: number }
  | { kind: "YAML"; flowStyle: boolean }
  | { kind: "CSV"; delimiter: string; includeHeaders: boolean }
  | { kind: "Custom"; format: string; options: Record<string, unknown> };

/**
 * Validated configuration with all constraints enforced
 */
export class ValidatedConfiguration {
  private constructor(
    private readonly documentsPath: DocumentPath,
    private readonly schemaPath: ConfigPath,
    private readonly templatePath: TemplatePath,
    private readonly outputPath: OutputPath,
    private readonly aiProvider: AIProviderConfig,
    private readonly processingStrategy: ProcessingStrategy,
    private readonly outputFormat: OutputFormatConfig,
    private readonly additionalOptions: ConfigurationOptions,
  ) {}

  /**
   * Smart Constructor for validated configuration
   */
  static create(
    rawConfig: RawConfiguration,
  ): Result<ValidatedConfiguration, ConfigurationValidationError[]> {
    const errors: ConfigurationValidationError[] = [];

    // Validate required fields
    const requiredFields = [
      "documentsPath",
      "schemaPath",
      "templatePath",
      "outputPath",
      "aiProvider",
    ];

    for (const field of requiredFields) {
      if (!rawConfig[field as keyof RawConfiguration]) {
        errors.push({
          kind: "MissingRequiredField",
          field,
          section: "root",
        });
      }
    }

    if (errors.length > 0) {
      return { ok: false, error: errors };
    }

    // Validate AI provider configuration
    const aiProviderResult = this.validateAIProvider(rawConfig.aiProvider);
    if (!aiProviderResult.ok) {
      errors.push(...aiProviderResult.error);
    }

    // Validate processing strategy
    const processingResult = this.validateProcessingStrategy(
      rawConfig.processingStrategy,
    );
    if (!processingResult.ok) {
      errors.push(...processingResult.error);
    }

    // Validate output format
    const outputResult = this.validateOutputFormat(rawConfig.outputFormat);
    if (!outputResult.ok) {
      errors.push(...outputResult.error);
    }

    // Validate path accessibility (this would normally check file system)
    const pathsResult = this.validatePaths(rawConfig);
    if (!pathsResult.ok) {
      errors.push(...pathsResult.error);
    }

    // Check for incompatible settings
    const compatibilityResult = this.validateSettingsCompatibility(rawConfig);
    if (!compatibilityResult.ok) {
      errors.push(...compatibilityResult.error);
    }

    if (errors.length > 0) {
      return { ok: false, error: errors };
    }

    // All validations passed, create the validated configuration
    // We know these are safe because we checked for errors above
    const aiProvider = aiProviderResult.ok
      ? aiProviderResult.data
      : { kind: "Mock" as const };
    const processingStrategy = processingResult.ok
      ? processingResult.data
      : { kind: "Sequential" as const, continueOnError: false };
    const outputFormat = outputResult.ok
      ? outputResult.data
      : { kind: "JSON" as const, pretty: true, indent: 2 };

    return {
      ok: true,
      data: new ValidatedConfiguration(
        rawConfig.documentsPath,
        rawConfig.schemaPath,
        rawConfig.templatePath,
        rawConfig.outputPath,
        aiProvider,
        processingStrategy,
        outputFormat,
        rawConfig.additionalOptions || {},
      ),
    };
  }

  /**
   * Validate AI provider configuration
   */
  private static validateAIProvider(
    config: unknown,
  ): Result<AIProviderConfig, ConfigurationValidationError[]> {
    const errors: ConfigurationValidationError[] = [];

    if (!config || typeof config !== "object") {
      errors.push({
        kind: "InvalidFieldType",
        field: "aiProvider",
        expected: "object",
        actual: typeof config,
      });
      return { ok: false, error: errors };
    }

    const aiConfig = config as Record<string, unknown>;
    const kind = aiConfig.kind as string;

    switch (kind) {
      case "Claude": {
        if (!aiConfig.apiKey || typeof aiConfig.apiKey !== "string") {
          errors.push({
            kind: "MissingAPICredentials",
            provider: "Claude",
            requiredFields: ["apiKey"],
          });
        }
        if (errors.length === 0) {
          return {
            ok: true,
            data: {
              kind: "Claude",
              apiKey: aiConfig.apiKey as string,
              model: aiConfig.model as string | undefined,
              maxTokens: aiConfig.maxTokens as number | undefined,
              temperature: aiConfig.temperature as number | undefined,
            },
          };
        }
        break;
      }
      case "OpenAI": {
        if (!aiConfig.apiKey || typeof aiConfig.apiKey !== "string") {
          errors.push({
            kind: "MissingAPICredentials",
            provider: "OpenAI",
            requiredFields: ["apiKey"],
          });
        }
        if (errors.length === 0) {
          return {
            ok: true,
            data: {
              kind: "OpenAI",
              apiKey: aiConfig.apiKey as string,
              model: aiConfig.model as string | undefined,
              maxTokens: aiConfig.maxTokens as number | undefined,
              temperature: aiConfig.temperature as number | undefined,
            },
          };
        }
        break;
      }
      case "Local": {
        if (!aiConfig.endpoint || typeof aiConfig.endpoint !== "string") {
          errors.push({
            kind: "MissingRequiredField",
            field: "endpoint",
            section: "aiProvider",
          });
        }
        if (!aiConfig.model || typeof aiConfig.model !== "string") {
          errors.push({
            kind: "MissingRequiredField",
            field: "model",
            section: "aiProvider",
          });
        }
        if (errors.length === 0) {
          return {
            ok: true,
            data: {
              kind: "Local",
              endpoint: aiConfig.endpoint as string,
              model: aiConfig.model as string,
              timeout: aiConfig.timeout as number | undefined,
            },
          };
        }
        break;
      }
      case "Mock": {
        return {
          ok: true,
          data: {
            kind: "Mock",
            responseDelay: aiConfig.responseDelay as number | undefined,
          },
        };
      }
      default:
        errors.push({
          kind: "InvalidAIProvider",
          provider: kind || "undefined",
          supportedProviders: ["Claude", "OpenAI", "Local", "Mock"],
        });
    }

    return { ok: false, error: errors };
  }

  /**
   * Validate processing strategy configuration
   */
  private static validateProcessingStrategy(
    config: unknown,
  ): Result<ProcessingStrategy, ConfigurationValidationError[]> {
    const errors: ConfigurationValidationError[] = [];

    if (!config || typeof config !== "object") {
      // Default to sequential processing
      return {
        ok: true,
        data: { kind: "Sequential", continueOnError: false },
      };
    }

    const strategyConfig = config as Record<string, unknown>;
    const kind = strategyConfig.kind as string;

    switch (kind) {
      case "Sequential":
        return {
          ok: true,
          data: {
            kind: "Sequential",
            continueOnError: Boolean(strategyConfig.continueOnError),
          },
        };
      case "Parallel": {
        const maxConcurrency = strategyConfig.maxConcurrency as number;
        if (!maxConcurrency || maxConcurrency < 1 || maxConcurrency > 100) {
          errors.push({
            kind: "InvalidConcurrencySettings",
            maxConcurrency: maxConcurrency || 0,
            reason: "maxConcurrency must be between 1 and 100",
          });
        }
        if (errors.length === 0) {
          return {
            ok: true,
            data: {
              kind: "Parallel",
              maxConcurrency,
              continueOnError: Boolean(strategyConfig.continueOnError),
            },
          };
        }
        break;
      }
      case "Batch": {
        const batchSize = strategyConfig.batchSize as number;
        const maxConcurrency = strategyConfig.maxConcurrency as number;

        if (!batchSize || batchSize < 1 || batchSize > 1000) {
          errors.push({
            kind: "InvalidFieldValue",
            field: "batchSize",
            value: batchSize,
            constraints: "must be between 1 and 1000",
          });
        }
        if (!maxConcurrency || maxConcurrency < 1 || maxConcurrency > 100) {
          errors.push({
            kind: "InvalidConcurrencySettings",
            maxConcurrency: maxConcurrency || 0,
            reason: "maxConcurrency must be between 1 and 100",
          });
        }
        if (errors.length === 0) {
          return {
            ok: true,
            data: {
              kind: "Batch",
              batchSize,
              maxConcurrency,
              continueOnError: Boolean(strategyConfig.continueOnError),
            },
          };
        }
        break;
      }
      default:
        errors.push({
          kind: "InvalidFieldValue",
          field: "processingStrategy.kind",
          value: kind,
          constraints: "must be one of: Sequential, Parallel, Batch",
        });
    }

    return { ok: false, error: errors };
  }

  /**
   * Validate output format configuration
   */
  private static validateOutputFormat(
    config: unknown,
  ): Result<OutputFormatConfig, ConfigurationValidationError[]> {
    if (!config || typeof config !== "object") {
      // Default to pretty JSON
      return {
        ok: true,
        data: { kind: "JSON", pretty: true, indent: 2 },
      };
    }

    const formatConfig = config as Record<string, unknown>;
    const kind = formatConfig.kind as string;

    switch (kind) {
      case "JSON":
        return {
          ok: true,
          data: {
            kind: "JSON",
            pretty: Boolean(formatConfig.pretty ?? true),
            indent: (formatConfig.indent as number) || 2,
          },
        };
      case "YAML":
        return {
          ok: true,
          data: {
            kind: "YAML",
            flowStyle: Boolean(formatConfig.flowStyle),
          },
        };
      case "CSV":
        return {
          ok: true,
          data: {
            kind: "CSV",
            delimiter: (formatConfig.delimiter as string) || ",",
            includeHeaders: Boolean(formatConfig.includeHeaders ?? true),
          },
        };
      case "Custom":
        return {
          ok: true,
          data: {
            kind: "Custom",
            format: formatConfig.format as string || "json",
            options: (formatConfig.options as Record<string, unknown>) || {},
          },
        };
      default:
        return {
          ok: false,
          error: [{
            kind: "InvalidFieldValue",
            field: "outputFormat.kind",
            value: kind,
            constraints: "must be one of: JSON, YAML, CSV, Custom",
          }],
        };
    }
  }

  /**
   * Validate path accessibility
   */
  private static validatePaths(
    config: RawConfiguration,
  ): Result<void, ConfigurationValidationError[]> {
    // In a real implementation, this would check file system accessibility
    // For now, just validate that paths are not empty
    const errors: ConfigurationValidationError[] = [];

    if (!config.documentsPath?.getValue()) {
      errors.push({
        kind: "PathNotAccessible",
        field: "documentsPath",
        path: config.documentsPath?.getValue() || "",
        reason: "path is empty",
      });
    }

    return errors.length > 0
      ? { ok: false, error: errors }
      : { ok: true, data: undefined };
  }

  /**
   * Validate settings compatibility
   */
  private static validateSettingsCompatibility(
    config: RawConfiguration,
  ): Result<void, ConfigurationValidationError[]> {
    const errors: ConfigurationValidationError[] = [];

    // Example compatibility check: Mock AI provider with production settings
    if (
      config.aiProvider &&
      typeof config.aiProvider === "object" &&
      (config.aiProvider as Record<string, unknown>).kind === "Mock"
    ) {
      const outputPath = config.outputPath?.getValue();
      if (outputPath?.includes("production") || outputPath?.includes("prod")) {
        errors.push({
          kind: "IncompatibleSettings",
          settings: ["aiProvider=Mock", "outputPath contains 'production'"],
          reason:
            "Mock AI provider should not be used with production output paths",
        });
      }
    }

    return errors.length > 0
      ? { ok: false, error: errors }
      : { ok: true, data: undefined };
  }

  // Getters for configuration values
  getDocumentsPath(): DocumentPath {
    return this.documentsPath;
  }
  getSchemaPath(): ConfigPath {
    return this.schemaPath;
  }
  getTemplatePath(): TemplatePath {
    return this.templatePath;
  }
  getOutputPath(): OutputPath {
    return this.outputPath;
  }
  getAIProvider(): AIProviderConfig {
    return this.aiProvider;
  }
  getProcessingStrategy(): ProcessingStrategy {
    return this.processingStrategy;
  }
  getOutputFormat(): OutputFormatConfig {
    return this.outputFormat;
  }
  getAdditionalOptions(): ConfigurationOptions {
    return this.additionalOptions;
  }

  /**
   * Validate configuration against current system state
   */
  validateRuntimeCompatibility(): Result<void, ConfigurationValidationError[]> {
    const errors: ConfigurationValidationError[] = [];

    // Example runtime validation
    switch (this.aiProvider.kind) {
      case "Claude":
        if (!this.aiProvider.apiKey.startsWith("sk-")) {
          errors.push({
            kind: "InvalidAPICredentials",
            provider: "Claude",
            requiredFields: ["valid API key format"],
          });
        }
        break;
      case "Local":
        // Could validate endpoint accessibility here
        break;
    }

    return errors.length > 0
      ? { ok: false, error: errors }
      : { ok: true, data: undefined };
  }
}

/**
 * Raw configuration from external sources (files, CLI args, etc.)
 */
export interface RawConfiguration {
  documentsPath: DocumentPath;
  schemaPath: ConfigPath;
  templatePath: TemplatePath;
  outputPath: OutputPath;
  aiProvider: unknown;
  processingStrategy?: unknown;
  outputFormat?: unknown;
  additionalOptions?: ConfigurationOptions;
}

/**
 * Additional configuration options
 */
export interface ConfigurationOptions {
  verbose?: boolean;
  dryRun?: boolean;
  logLevel?: "debug" | "info" | "warn" | "error";
  timeout?: number;
  retryCount?: number;
  [key: string]: unknown;
}

/**
 * Configuration validation result helper
 */
export class ConfigurationValidator {
  /**
   * Validate and create configuration with detailed error reporting
   */
  static validate(
    rawConfig: RawConfiguration,
  ): Result<ValidatedConfiguration, DomainError & { message: string }> {
    const result = ValidatedConfiguration.create(rawConfig);

    if (!result.ok) {
      const errorMessages = result.error.map((error) =>
        this.formatValidationError(error)
      );
      return {
        ok: false,
        error: createDomainError(
          { kind: "ConfigurationError", config: rawConfig },
          `Configuration validation failed: ${errorMessages.join("; ")}`,
        ),
      };
    }

    return result;
  }

  /**
   * Format validation error for human-readable output
   */
  private static formatValidationError(
    error: ConfigurationValidationError,
  ): string {
    switch (error.kind) {
      case "MissingRequiredField":
        return `Missing required field '${error.field}' in section '${error.section}'`;
      case "InvalidFieldType":
        return `Field '${error.field}' has invalid type: expected ${error.expected}, got ${error.actual}`;
      case "InvalidFieldValue":
        return `Field '${error.field}' has invalid value ${
          JSON.stringify(error.value)
        }: ${error.constraints}`;
      case "PathNotAccessible":
        return `Path '${error.path}' for field '${error.field}' is not accessible: ${error.reason}`;
      case "IncompatibleSettings":
        return `Incompatible settings: ${
          error.settings.join(", ")
        } - ${error.reason}`;
      case "InvalidAIProvider":
        return `Invalid AI provider '${error.provider}': must be one of ${
          error.supportedProviders.join(", ")
        }`;
      case "MissingAPICredentials":
        return `Missing API credentials for ${error.provider}: required fields are ${
          error.requiredFields.join(", ")
        }`;
      case "InvalidConcurrencySettings":
        return `Invalid concurrency settings: maxConcurrency=${error.maxConcurrency} - ${error.reason}`;
      case "InvalidAPICredentials":
        return `Invalid API credentials for ${error.provider}: required fields are ${
          error.requiredFields.join(", ")
        }`;
      default: {
        const _exhaustiveCheck: never = error;
        return `Unknown validation error: ${String(_exhaustiveCheck)}`;
      }
    }
  }
}
