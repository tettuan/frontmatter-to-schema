/**
 * Configuration Orchestrator Service
 * Extracted from configuration.ts for better domain separation
 * Orchestrates all configuration validation operations following DDD principles
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import type { ApplicationConfiguration } from "../value-objects/configuration-types.value-object.ts";
import { InputConfigurationValidator } from "./input-configuration-validator.service.ts";
import { SchemaConfigurationValidator } from "./schema-configuration-validator.service.ts";
import { TemplateConfigurationValidator } from "./template-configuration-validator.service.ts";
import { OutputConfigurationValidator } from "./output-configuration-validator.service.ts";
import { ProcessingConfigurationValidator } from "./processing-configuration-validator.service.ts";

/**
 * Configuration Orchestrator Service - Main orchestrator for all configuration validation
 * Follows DDD principles with proper service composition
 */
export class ConfigurationOrchestrator {
  private readonly inputValidator: InputConfigurationValidator;
  private readonly schemaValidator: SchemaConfigurationValidator;
  private readonly templateValidator: TemplateConfigurationValidator;
  private readonly outputValidator: OutputConfigurationValidator;
  private readonly processingValidator: ProcessingConfigurationValidator;

  constructor() {
    this.inputValidator = new InputConfigurationValidator();
    this.schemaValidator = new SchemaConfigurationValidator();
    this.templateValidator = new TemplateConfigurationValidator();
    this.outputValidator = new OutputConfigurationValidator();
    this.processingValidator = new ProcessingConfigurationValidator();
  }

  /**
   * Main configuration validation method
   */
  validate(
    config: unknown,
  ): Result<ApplicationConfiguration, DomainError & { message: string }> {
    if (!config || typeof config !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config,
        }, "Configuration must be an object"),
      };
    }

    // Use type guard instead of type assertion
    if (!this.isRecord(config)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ConfigurationError",
          config,
        }, "Configuration must be an object"),
      };
    }

    // Validate input using discriminated union pattern
    const inputResult = this.inputValidator.validateInputConfiguration(
      config.input,
    );
    if (!inputResult.ok) return inputResult;

    // Validate schema using Smart Constructor
    const schemaResult = this.schemaValidator.validateSchemaConfiguration(
      config.schema,
    );
    if (!schemaResult.ok) return schemaResult;

    // Validate template using Smart Constructor
    const templateResult = this.templateValidator.validateTemplateConfiguration(
      config.template,
    );
    if (!templateResult.ok) return templateResult;

    // Validate output using Smart Constructor
    const outputResult = this.outputValidator.validateOutputConfiguration(
      config.output,
    );
    if (!outputResult.ok) return outputResult;

    // Validate processing using discriminated union pattern (defaults to BasicProcessing)
    const processingResult = this.processingValidator
      .validateProcessingConfiguration(
        config.processing,
      );
    if (!processingResult.ok) return processingResult;

    return {
      ok: true,
      data: {
        input: inputResult.data,
        schema: schemaResult.data,
        template: templateResult.data,
        output: outputResult.data,
        processing: processingResult.data,
      },
    };
  }

  /**
   * Type guard to check if value is a record
   */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
}
