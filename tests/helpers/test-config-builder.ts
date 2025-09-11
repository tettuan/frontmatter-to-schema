/**
 * Test Configuration Builder
 *
 * Smart Constructor for ApplicationConfiguration in tests
 * Eliminates configuration duplication and provides type-safe test configs
 * Follows Builder pattern with DDD value object principles
 *
 * Part of Issue #664: Test Setup Duplication Refactoring
 */

import type { Result } from "../../src/domain/core/result.ts";
import type { ApplicationConfiguration } from "../../src/application/value-objects/configuration-types.value-object.ts";
import {
  OutputFormat,
  SchemaFormat,
  TemplateFormat,
} from "../../src/application/value-objects/configuration-formats.value-object.ts";

/**
 * Configuration creation error types
 */
export type ConfigCreationError =
  | { kind: "InvalidSchemaFormat"; format: string; message: string }
  | { kind: "InvalidTemplateFormat"; format: string; message: string }
  | { kind: "InvalidOutputFormat"; format: string; message: string }
  | { kind: "InvalidFilePath"; path: string; message: string };

/**
 * Smart Constructor Builder for test configurations
 * Provides fluent API for creating valid ApplicationConfiguration instances
 */
export class TestConfigBuilder {
  private constructor() {
    // Prevent instantiation - static factory only
  }

  /**
   * Create basic file input configuration with defaults
   * Safe defaults for common test scenarios
   */
  static forFile(
    filePath: string,
  ): Result<ApplicationConfiguration, ConfigCreationError> {
    if (!filePath || filePath.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "InvalidFilePath",
          path: filePath,
          message: "File path cannot be empty",
        },
      };
    }

    const schemaFormatResult = SchemaFormat.create("json");
    if (!schemaFormatResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InvalidSchemaFormat",
          format: "json",
          message: "Failed to create default schema format",
        },
      };
    }

    const templateFormatResult = TemplateFormat.create("handlebars");
    if (!templateFormatResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InvalidTemplateFormat",
          format: "handlebars",
          message: "Failed to create default template format",
        },
      };
    }

    const outputFormatResult = OutputFormat.create("json");
    if (!outputFormatResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InvalidOutputFormat",
          format: "json",
          message: "Failed to create default output format",
        },
      };
    }

    const config: ApplicationConfiguration = {
      input: {
        kind: "FileInput",
        path: filePath,
      },
      schema: {
        definition: JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": {},
        }),
        format: schemaFormatResult.data,
      },
      template: {
        definition: "{{title}}",
        format: templateFormatResult.data,
      },
      output: {
        path: "/tmp/test-output.json",
        format: outputFormatResult.data,
      },
      processing: {
        kind: "BasicProcessing",
      },
    };

    return {
      ok: true,
      data: config,
    };
  }

  /**
   * Create directory input configuration with pattern matching
   * For batch processing test scenarios
   */
  static forDirectory(
    dirPath: string,
    pattern: string = "\\.md$",
  ): Result<ApplicationConfiguration, ConfigCreationError> {
    const fileConfigResult = this.forFile(dirPath);
    if (!fileConfigResult.ok) {
      return fileConfigResult;
    }

    const config = fileConfigResult.data;
    config.input = {
      kind: "DirectoryInput",
      path: dirPath,
      pattern,
    };

    return {
      ok: true,
      data: config,
    };
  }

  /**
   * Create configuration with custom schema definition
   * For schema validation test scenarios
   */
  static withCustomSchema(
    filePath: string,
    schemaDefinition: string | object,
    schemaFormat: "json" | "yaml" = "json",
  ): Result<ApplicationConfiguration, ConfigCreationError> {
    const baseConfigResult = this.forFile(filePath);
    if (!baseConfigResult.ok) {
      return baseConfigResult;
    }

    const schemaFormatResult = SchemaFormat.create(schemaFormat);
    if (!schemaFormatResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InvalidSchemaFormat",
          format: schemaFormat,
          message: `Failed to create schema format: ${schemaFormat}`,
        },
      };
    }

    const config = baseConfigResult.data;
    config.schema = {
      definition: typeof schemaDefinition === "string"
        ? schemaDefinition
        : JSON.stringify(schemaDefinition),
      format: schemaFormatResult.data,
    };

    return {
      ok: true,
      data: config,
    };
  }

  /**
   * Create configuration with custom template
   * For template rendering test scenarios
   */
  static withCustomTemplate(
    filePath: string,
    templateContent: string,
    templateFormat: "handlebars" | "mustache" | "liquid" = "handlebars",
  ): Result<ApplicationConfiguration, ConfigCreationError> {
    const baseConfigResult = this.forFile(filePath);
    if (!baseConfigResult.ok) {
      return baseConfigResult;
    }

    const templateFormatResult = TemplateFormat.create(templateFormat);
    if (!templateFormatResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InvalidTemplateFormat",
          format: templateFormat,
          message: `Failed to create template format: ${templateFormat}`,
        },
      };
    }

    const config = baseConfigResult.data;
    config.template = {
      definition: templateContent,
      format: templateFormatResult.data,
    };

    return {
      ok: true,
      data: config,
    };
  }

  /**
   * Create configuration with custom output settings
   * For output format test scenarios
   */
  static withCustomOutput(
    filePath: string,
    outputPath: string,
    outputFormat: "json" | "yaml" | "xml" = "json",
  ): Result<ApplicationConfiguration, ConfigCreationError> {
    const baseConfigResult = this.forFile(filePath);
    if (!baseConfigResult.ok) {
      return baseConfigResult;
    }

    const outputFormatResult = OutputFormat.create(outputFormat);
    if (!outputFormatResult.ok) {
      return {
        ok: false,
        error: {
          kind: "InvalidOutputFormat",
          format: outputFormat,
          message: `Failed to create output format: ${outputFormat}`,
        },
      };
    }

    const config = baseConfigResult.data;
    config.output = {
      path: outputPath,
      format: outputFormatResult.data,
    };

    return {
      ok: true,
      data: config,
    };
  }

  /**
   * Create configuration for error testing scenarios
   * Intentionally invalid configurations for negative testing
   */
  static forErrorTesting(): {
    invalidJsonSchema(): ApplicationConfiguration;
    invalidTemplatePath(): ApplicationConfiguration;
    missingFile(): ApplicationConfiguration;
    malformedTemplate(): ApplicationConfiguration;
  } {
    return {
      invalidJsonSchema(): ApplicationConfiguration {
        const configResult = TestConfigBuilder.forFile("/tmp/test.md");
        if (!configResult.ok) {
          throw new Error("Failed to create base config for error testing");
        }
        const config = configResult.data;
        config.schema.definition = "{ invalid json schema";
        return config;
      },

      invalidTemplatePath(): ApplicationConfiguration {
        const configResult = TestConfigBuilder.forFile("/tmp/test.md");
        if (!configResult.ok) {
          throw new Error("Failed to create base config for error testing");
        }
        const config = configResult.data;
        config.template.definition = "{{#missing template file}}";
        return config;
      },

      missingFile(): ApplicationConfiguration {
        const configResult = TestConfigBuilder.forFile(
          "/nonexistent/path/file.md",
        );
        if (!configResult.ok) {
          throw new Error("Failed to create base config for error testing");
        }
        return configResult.data;
      },

      malformedTemplate(): ApplicationConfiguration {
        const configResult = TestConfigBuilder.forFile("/tmp/test.md");
        if (!configResult.ok) {
          throw new Error("Failed to create base config for error testing");
        }
        const config = configResult.data;
        config.template.definition = "{ malformed template content";
        return config;
      },
    };
  }

  /**
   * Utility: Create unsafe configuration (throws on error)
   * For tests where configuration creation failure should terminate test
   */
  static forFileUnsafe(filePath: string): ApplicationConfiguration {
    const result = this.forFile(filePath);
    if (!result.ok) {
      throw new Error(`Config creation failed: ${result.error.message}`);
    }
    return result.data;
  }

  /**
   * Utility: Create unsafe directory configuration (throws on error)
   */
  static forDirectoryUnsafe(
    dirPath: string,
    pattern?: string,
  ): ApplicationConfiguration {
    const result = this.forDirectory(dirPath, pattern);
    if (!result.ok) {
      throw new Error(`Config creation failed: ${result.error.message}`);
    }
    return result.data;
  }
}
