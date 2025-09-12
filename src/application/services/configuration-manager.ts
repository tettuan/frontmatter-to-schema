/**
 * ConfigurationManager - Canonical configuration management service
 * 
 * Consolidates all configuration validation and management into a single service
 * following the Single Path Principle (Issue #691)
 * 
 * Replaces:
 * - configuration-orchestrator.service.ts
 * - input-configuration-validator.service.ts
 * - output-configuration-validator.service.ts
 * - processing-configuration-validator.service.ts
 * - schema-configuration-validator.service.ts
 * - template-configuration-validator.service.ts
 */

import { Result } from "../../domain/core/result.ts";
import { createDomainError, DomainError } from "../../domain/core/result.ts";
import { DocumentPath } from "../../domain/value-objects/document-path.ts";
import { SchemaPath } from "../../domain/value-objects/schema-path.ts";
import { TemplatePath } from "../../domain/value-objects/template-path.ts";
import { FileFormatDetector } from "../../domain/services/file-format-detector.ts";
import { ProcessingConfiguration, TemplateFormat } from "../process-coordinator.ts";

export interface InputConfiguration {
  pattern: string;
  baseDirectory: string;
}

export interface SchemaConfiguration {
  path: string;
  format: "json" | "yaml";
}

export interface TemplateConfiguration {
  kind: "inline" | "file";
  definition?: string;
  format: TemplateFormat;
  path?: string;
}

export interface OutputConfiguration {
  path: string;
  format: TemplateFormat;
}

/**
 * ConfigurationManager - Consolidated configuration management
 */
export class ConfigurationManager {
  constructor() {}

  /**
   * Validates complete processing configuration
   */
  validateProcessingConfiguration(
    config: ProcessingConfiguration
  ): Result<ProcessingConfiguration, DomainError> {
    // Validate input configuration
    const inputResult = this.validateInputConfiguration(config.input);
    if (!inputResult.ok) {
      return inputResult as Result<ProcessingConfiguration, DomainError>;
    }

    // Validate schema configuration
    const schemaResult = this.validateSchemaConfiguration(config.schema);
    if (!schemaResult.ok) {
      return schemaResult as Result<ProcessingConfiguration, DomainError>;
    }

    // Validate template configuration
    const templateResult = this.validateTemplateConfiguration(config.template);
    if (!templateResult.ok) {
      return templateResult as Result<ProcessingConfiguration, DomainError>;
    }

    // Validate output configuration
    const outputResult = this.validateOutputConfiguration(config.output);
    if (!outputResult.ok) {
      return outputResult as Result<ProcessingConfiguration, DomainError>;
    }

    return { ok: true, data: config };
  }

  /**
   * Validates input configuration
   */
  private validateInputConfiguration(
    input: InputConfiguration
  ): Result<InputConfiguration, DomainError> {
    if (!input.pattern || input.pattern.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          "Input pattern is required",
          { input }
        ),
      };
    }

    if (!input.baseDirectory || input.baseDirectory.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          "Base directory is required",
          { input }
        ),
      };
    }

    const pathResult = DocumentPath.create(input.baseDirectory);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          `Invalid base directory: ${pathResult.error.message}`,
          { input }
        ),
      };
    }

    return { ok: true, data: input };
  }

  /**
   * Validates schema configuration
   */
  private validateSchemaConfiguration(
    schema: SchemaConfiguration
  ): Result<SchemaConfiguration, DomainError> {
    if (!schema.path || schema.path.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          "Schema path is required",
          { schema }
        ),
      };
    }

    const pathResult = SchemaPath.create(schema.path);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          `Invalid schema path: ${pathResult.error.message}`,
          { schema }
        ),
      };
    }

    // Detect format if not provided
    if (!schema.format) {
      const detector = new FileFormatDetector();
      const formatResult = detector.detectFormat(schema.path);
      if (!formatResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            `Cannot detect schema format: ${formatResult.error.message}`,
            { schema }
          ),
        };
      }
      // Map file format to schema format
      const format = formatResult.data.toLowerCase();
      if (format !== "json" && format !== "yaml") {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            `Invalid schema format: ${format}. Must be json or yaml`,
            { schema }
          ),
        };
      }
      schema.format = format as "json" | "yaml";
    }

    return { ok: true, data: schema };
  }

  /**
   * Validates template configuration
   */
  private validateTemplateConfiguration(
    template: TemplateConfiguration
  ): Result<TemplateConfiguration, DomainError> {
    if (template.kind === "file") {
      if (!template.path || template.path.trim() === "") {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            "Template path is required for file templates",
            { template }
          ),
        };
      }

      const pathResult = TemplatePath.create(template.path);
      if (!pathResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            `Invalid template path: ${pathResult.error.message}`,
            { template }
          ),
        };
      }

      // Detect format if not provided
      if (!template.format) {
        const detector = new FileFormatDetector();
        const formatResult = detector.detectFormat(template.path);
        if (!formatResult.ok) {
          return {
            ok: false,
            error: createDomainError(
              "validation",
              `Cannot detect template format: ${formatResult.error.message}`,
              { template }
            ),
          };
        }
        template.format = formatResult.data.toLowerCase() as TemplateFormat;
      }
    } else if (template.kind === "inline") {
      if (!template.definition || template.definition.trim() === "") {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            "Template definition is required for inline templates",
            { template }
          ),
        };
      }

      if (!template.format) {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            "Template format is required for inline templates",
            { template }
          ),
        };
      }
    } else {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          `Invalid template kind: ${template.kind}`,
          { template }
        ),
      };
    }

    return { ok: true, data: template };
  }

  /**
   * Validates output configuration
   */
  private validateOutputConfiguration(
    output: OutputConfiguration
  ): Result<OutputConfiguration, DomainError> {
    if (!output.path || output.path.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          "validation",
          "Output path is required",
          { output }
        ),
      };
    }

    // Detect format if not provided
    if (!output.format) {
      const detector = new FileFormatDetector();
      const formatResult = detector.detectFormat(output.path);
      if (!formatResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            "validation",
            `Cannot detect output format: ${formatResult.error.message}`,
            { output }
          ),
        };
      }
      output.format = formatResult.data.toLowerCase() as TemplateFormat;
    }

    return { ok: true, data: output };
  }

  /**
   * Creates default configuration
   */
  static createDefaultConfiguration(): ProcessingConfiguration {
    return {
      kind: "basic",
      input: {
        pattern: "*.md",
        baseDirectory: ".",
      },
      schema: {
        path: "./schema.json",
        format: "json",
      },
      template: {
        kind: "inline",
        definition: "{}",
        format: "json",
      },
      output: {
        path: "./output.json",
        format: "json",
      },
    };
  }
}