import { err, ok, Result } from "../../../domain/shared/types/result.ts";
import {
  createError,
  ValidationError,
} from "../../../domain/shared/types/errors.ts";
import { SafePropertyAccess } from "../../../domain/shared/utils/safe-property-access.ts";

/**
 * Configuration access error types for pipeline commands
 */
export type ConfigError = ValidationError & { message: string };

/**
 * Safe configuration accessor for pipeline commands following Totality principles
 * Eliminates unsafe `(config as any)` patterns in favor of Result<T,E> types
 */
export class PipelineConfigAccessor {
  /**
   * Safely extract schema path from configuration
   * Replaces `(config as any).schemaPath as string` patterns
   */
  static getSchemaPath(config: unknown): Result<string, ConfigError> {
    const recordResult = SafePropertyAccess.asRecord(config);
    if (!recordResult.ok) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof config,
      }, "Configuration must be an object to access schemaPath"));
    }

    const record = recordResult.data;
    const schemaPath = record.schemaPath;

    if (typeof schemaPath !== "string") {
      return err(createError({
        kind: "InvalidType",
        expected: "string",
        actual: typeof schemaPath,
      }, "schemaPath must be a string"));
    }

    if (schemaPath.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "schemaPath",
      }, "schemaPath cannot be empty"));
    }

    return ok(schemaPath);
  }

  /**
   * Safely extract output path from configuration
   * Replaces `(config as any).outputPath as string` patterns
   */
  static getOutputPath(config: unknown): Result<string, ConfigError> {
    const recordResult = SafePropertyAccess.asRecord(config);
    if (!recordResult.ok) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof config,
      }, "Configuration must be an object to access outputPath"));
    }

    const record = recordResult.data;
    const outputPath = record.outputPath;

    if (typeof outputPath !== "string") {
      return err(createError({
        kind: "InvalidType",
        expected: "string",
        actual: typeof outputPath,
      }, "outputPath must be a string"));
    }

    if (outputPath.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "outputPath",
      }, "outputPath cannot be empty"));
    }

    return ok(outputPath);
  }

  /**
   * Safely extract input pattern from configuration
   * Replaces `(config as any).inputPattern as string` patterns
   */
  static getInputPattern(config: unknown): Result<string, ConfigError> {
    const recordResult = SafePropertyAccess.asRecord(config);
    if (!recordResult.ok) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof config,
      }, "Configuration must be an object to access inputPattern"));
    }

    const record = recordResult.data;
    const inputPattern = record.inputPattern;

    if (typeof inputPattern !== "string") {
      return err(createError({
        kind: "InvalidType",
        expected: "string",
        actual: typeof inputPattern,
      }, "inputPattern must be a string"));
    }

    if (inputPattern.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "inputPattern",
      }, "inputPattern cannot be empty"));
    }

    return ok(inputPattern);
  }

  /**
   * Safely extract verbosity configuration from configuration
   * Replaces `(config as any).verbosityConfig` patterns
   */
  static getVerbosityConfig(config: unknown): Result<unknown, ConfigError> {
    const recordResult = SafePropertyAccess.asRecord(config);
    if (!recordResult.ok) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof config,
      }, "Configuration must be an object to access verbosityConfig"));
    }

    const record = recordResult.data;
    return ok(record.verbosityConfig);
  }

  /**
   * Safely extract verbosity enabled flag from configuration
   * Replaces `verbosityConfig?.enabled` patterns
   */
  static getVerbosityEnabled(config: unknown): Result<boolean, ConfigError> {
    const verbosityConfigResult = this.getVerbosityConfig(config);
    if (!verbosityConfigResult.ok) {
      return err(verbosityConfigResult.error);
    }

    const verbosityConfig = verbosityConfigResult.data;

    // If verbosityConfig is null or undefined, default to false
    if (verbosityConfig == null) {
      return ok(false);
    }

    // If verbosityConfig is not an object, default to false
    if (typeof verbosityConfig !== "object") {
      return ok(false);
    }

    const verbosityRecordResult = SafePropertyAccess.asRecord(verbosityConfig);
    if (!verbosityRecordResult.ok) {
      return ok(false); // Default to false if not a valid record
    }

    const verbosityRecord = verbosityRecordResult.data;
    const enabled = verbosityRecord.enabled;

    // If enabled is not defined or not a boolean, default to false
    if (typeof enabled !== "boolean") {
      return ok(false);
    }

    return ok(enabled);
  }

  /**
   * Safely convert configuration to Record<string, unknown>
   * Replaces `config as Record<string, unknown>` patterns
   */
  static asRecord(
    config: unknown,
  ): Result<Record<string, unknown>, ConfigError> {
    const result = SafePropertyAccess.asRecord(config);
    if (!result.ok) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof config,
      }, "Configuration must be an object"));
    }

    return result;
  }

  /**
   * Safely extract template path from configuration
   * For use in template-related commands
   */
  static getTemplatePath(
    config: unknown,
  ): Result<string | undefined, ConfigError> {
    const recordResult = SafePropertyAccess.asRecord(config);
    if (!recordResult.ok) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof config,
      }, "Configuration must be an object to access templatePath"));
    }

    const record = recordResult.data;
    const templatePath = record.templatePath;

    if (templatePath === undefined) {
      return ok(undefined);
    }

    if (typeof templatePath !== "string") {
      return err(createError({
        kind: "InvalidType",
        expected: "string",
        actual: typeof templatePath,
      }, "templatePath must be a string"));
    }

    if (templatePath.trim().length === 0) {
      return err(createError({
        kind: "EmptyInput",
        field: "templatePath",
      }, "templatePath cannot be empty"));
    }

    return ok(templatePath);
  }

  /**
   * Safely extract template configuration from configuration
   * Replaces `(config as any).templateConfig` patterns
   */
  static getTemplateConfig(config: unknown): Result<unknown, ConfigError> {
    const recordResult = SafePropertyAccess.asRecord(config);
    if (!recordResult.ok) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof config,
      }, "Configuration must be an object to access templateConfig"));
    }

    const record = recordResult.data;
    return ok(record.templateConfig);
  }

  /**
   * Safely extract path from path-like objects
   * Handles objects with getPath() method or converts to string
   */
  static extractPath(pathLike: unknown): string {
    if (pathLike == null) {
      return "";
    }

    // Check if object has getPath method
    if (typeof pathLike === "object" && pathLike !== null) {
      const objResult = SafePropertyAccess.asRecord(pathLike);
      if (objResult.ok) {
        const obj = objResult.data;
        if (typeof obj.getPath === "function") {
          try {
            const result = obj.getPath();
            return typeof result === "string" ? result : String(result);
          } catch {
            // Fall through to string conversion
          }
        }
      }
    }

    // Convert to string as fallback
    return String(pathLike);
  }

  /**
   * Generic property accessor for configuration objects
   * Provides type-safe access to any configuration property
   * Note: The T generic represents the expected type, but runtime validation
   * should be performed by the caller for complete type safety
   */
  static getProperty<T = unknown>(
    config: unknown,
    propertyName: string,
  ): Result<T, ConfigError> {
    const recordResult = SafePropertyAccess.asRecord(config);
    if (!recordResult.ok) {
      return err(createError({
        kind: "InvalidType",
        expected: "object",
        actual: typeof config,
      }, `Configuration must be an object to access ${propertyName}`));
    }

    const record = recordResult.data;
    // This type assertion is acceptable here as T is a generic parameter
    // The caller is responsible for runtime validation of the returned type
    return ok(record[propertyName] as T);
  }
}
