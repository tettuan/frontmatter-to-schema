/**
 * Schema Extension Registry Factory
 *
 * Factory for creating configured extension registries
 * Implements different configuration strategies
 * Following DDD factory patterns with Totality compliance
 */

import type { Result } from "../../core/result.ts";
import { SchemaExtensionRegistry } from "../entities/schema-extension-registry.ts";
import { ExtensionConfiguration } from "../value-objects/extension-configuration.ts";
import { SchemaExtensions } from "../value-objects/schema-extensions.ts";

/**
 * Factory error types
 */
export type FactoryError =
  | { kind: "ConfigurationParsingFailed"; source: unknown; reason: string }
  | { kind: "DefaultCreationFailed"; reason: string }
  | { kind: "CustomMappingsFailed"; mappings: unknown; reason: string };

/**
 * Extension property mappings interface
 */
export interface ExtensionPropertyMappings {
  readonly frontmatterPart?: string;
  readonly derivedFrom?: string;
  readonly derivedUnique?: string;
  readonly template?: string;
}

/**
 * Factory configuration options
 */
export interface FactoryConfiguration {
  readonly useDefaults?: boolean;
  readonly customMappings?: ExtensionPropertyMappings;
  readonly validateConfiguration?: boolean;
}

/**
 * Error creation helper
 */
export const createFactoryError = (
  error: FactoryError,
  customMessage?: string,
): FactoryError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultFactoryErrorMessage(error),
});

function getDefaultFactoryErrorMessage(error: FactoryError): string {
  switch (error.kind) {
    case "ConfigurationParsingFailed":
      return `Configuration parsing failed: ${error.reason}`;
    case "DefaultCreationFailed":
      return `Default registry creation failed: ${error.reason}`;
    case "CustomMappingsFailed":
      return `Custom mappings failed: ${error.reason}`;
  }
}

/**
 * Factory for creating configured extension registries
 * Implements different configuration strategies
 */
export class SchemaExtensionRegistryFactory {
  /**
   * Create default registry with standard x-* properties
   */
  static createDefault(): Result<
    SchemaExtensionRegistry,
    FactoryError & { message: string }
  > {
    try {
      const config = ExtensionConfiguration.createDefault();
      const registryResult = SchemaExtensionRegistry.create(config);

      if (!registryResult.ok) {
        return {
          ok: false,
          error: createFactoryError({
            kind: "DefaultCreationFailed",
            reason: registryResult.error.message,
          }),
        };
      }

      return registryResult;
    } catch (error) {
      return {
        ok: false,
        error: createFactoryError({
          kind: "DefaultCreationFailed",
          reason: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Create registry from external configuration
   */
  static fromConfiguration(
    configData: Record<string, unknown>,
  ): Result<SchemaExtensionRegistry, FactoryError & { message: string }> {
    try {
      // Parse and validate configuration
      const configResult = ExtensionConfiguration.create(configData);
      if (!configResult.ok) {
        return {
          ok: false,
          error: createFactoryError({
            kind: "ConfigurationParsingFailed",
            source: configData,
            reason: configResult.error.message,
          }),
        };
      }

      const registryResult = SchemaExtensionRegistry.create(configResult.data);
      if (!registryResult.ok) {
        return {
          ok: false,
          error: createFactoryError({
            kind: "ConfigurationParsingFailed",
            source: configData,
            reason: registryResult.error.message,
          }),
        };
      }
      return registryResult;
    } catch (error) {
      return {
        ok: false,
        error: createFactoryError({
          kind: "ConfigurationParsingFailed",
          source: configData,
          reason: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Create registry with custom property mappings
   */
  static withCustomMappings(
    mappings: ExtensionPropertyMappings,
  ): Result<SchemaExtensionRegistry, FactoryError & { message: string }> {
    try {
      // Merge with defaults
      const defaultConfig = ExtensionConfiguration.createDefault();
      const mergedConfig = {
        frontmatterPart: mappings.frontmatterPart ||
          defaultConfig.getFrontmatterPartProperty(),
        derivedFrom: mappings.derivedFrom ||
          defaultConfig.getDerivedFromProperty(),
        derivedUnique: mappings.derivedUnique ||
          defaultConfig.getDerivedUniqueProperty(),
        template: mappings.template || defaultConfig.getTemplateProperty(),
      };

      const configResult = ExtensionConfiguration.create(mergedConfig);
      if (!configResult.ok) {
        return {
          ok: false,
          error: createFactoryError({
            kind: "CustomMappingsFailed",
            mappings,
            reason: configResult.error.message,
          }),
        };
      }

      const registryResult = SchemaExtensionRegistry.create(configResult.data);
      if (!registryResult.ok) {
        return {
          ok: false,
          error: createFactoryError({
            kind: "CustomMappingsFailed",
            mappings,
            reason: registryResult.error.message,
          }),
        };
      }
      return registryResult;
    } catch (error) {
      return {
        ok: false,
        error: createFactoryError({
          kind: "CustomMappingsFailed",
          mappings,
          reason: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Create registry from configuration file path
   */
  static async fromConfigurationFile(
    filePath: string,
    fileSystem?: FileSystemProvider,
  ): Promise<
    Result<SchemaExtensionRegistry, FactoryError & { message: string }>
  > {
    if (!fileSystem) {
      return {
        ok: false,
        error: createFactoryError({
          kind: "ConfigurationParsingFailed",
          source: filePath,
          reason: "No file system provider available",
        }),
      };
    }

    try {
      const fileResult = await fileSystem.readFile(filePath);
      if (!fileResult.ok) {
        return {
          ok: false,
          error: createFactoryError({
            kind: "ConfigurationParsingFailed",
            source: filePath,
            reason: `Failed to read file: ${fileResult.error.details}`,
          }),
        };
      }

      const configData = JSON.parse(fileResult.data);
      return this.fromConfiguration(configData);
    } catch (error) {
      return {
        ok: false,
        error: createFactoryError({
          kind: "ConfigurationParsingFailed",
          source: filePath,
          reason: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Create registry with factory configuration options
   */
  static withOptions(
    options: FactoryConfiguration,
  ): Result<SchemaExtensionRegistry, FactoryError & { message: string }> {
    try {
      if (options.useDefaults === false && !options.customMappings) {
        return {
          ok: false,
          error: createFactoryError({
            kind: "ConfigurationParsingFailed",
            source: options,
            reason:
              "Either useDefaults must be true or customMappings must be provided",
          }),
        };
      }

      if (options.customMappings) {
        return this.withCustomMappings(options.customMappings);
      }

      return this.createDefault();
    } catch (error) {
      return {
        ok: false,
        error: createFactoryError({
          kind: "ConfigurationParsingFailed",
          source: options,
          reason: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Validate configuration before creating registry
   */
  static validateConfiguration(
    configData: Record<string, unknown>,
  ): Result<boolean, FactoryError & { message: string }> {
    try {
      const configResult = ExtensionConfiguration.create(configData);
      if (configResult.ok) {
        return { ok: true, data: true };
      } else {
        return {
          ok: false,
          error: createFactoryError({
            kind: "ConfigurationParsingFailed",
            source: configData,
            reason: configResult.error.message,
          }),
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: createFactoryError({
          kind: "ConfigurationParsingFailed",
          source: configData,
          reason: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  }

  /**
   * Get available configuration templates
   */
  static getConfigurationTemplates(): Record<
    string,
    ExtensionPropertyMappings
  > {
    return {
      default: {
        frontmatterPart: SchemaExtensions.FRONTMATTER_PART,
        derivedFrom: SchemaExtensions.DERIVED_FROM,
        derivedUnique: SchemaExtensions.DERIVED_UNIQUE,
        template: SchemaExtensions.TEMPLATE,
      },
      minimal: {
        frontmatterPart: "x-part",
        derivedFrom: "x-from",
        derivedUnique: "x-unique",
        template: "x-tmpl",
      },
      verbose: {
        frontmatterPart: "x-frontmatter-part-enabled",
        derivedFrom: "x-derived-from-field",
        derivedUnique: "x-derived-unique-fields",
        template: "x-template-configuration",
      },
    };
  }
}

/**
 * File system provider interface (for external configuration loading)
 */
export interface FileSystemProvider {
  readFile(path: string): Promise<Result<string, { details: string }>>;
}
