/**
 * Configuration Orchestrator
 *
 * Coordinates all configuration services and provides unified interface
 * Part of the Infrastructure Layer - Service coordination
 * Follows Totality principles with Result types
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import type { FileSystemRepository } from "../../domain/repositories/file-system-repository.ts";
import {
  ConfigurationFileService,
  type RawConfigurationData,
} from "../file-system/configuration-file.service.ts";
import { SchemaConfigurationService } from "../../domain/schema/schema-configuration.service.ts";
import { TemplateConfigurationService } from "../../domain/template/template-configuration.service.ts";
import { ResultManagementService } from "../file-system/result-management.service.ts";
import {
  ConfigPath,
  DocumentPath,
  OutputPath,
  TemplatePath,
} from "../../domain/models/value-objects.ts";
import type { Schema, Template } from "../../domain/models/entities.ts";
import type {
  ConfigurationRepository,
  ProcessingConfiguration,
  ProcessingOptions,
  ResultRepository,
  SchemaRepository as _SchemaRepository,
  TemplateRepository as _TemplateRepository,
} from "../../domain/services/interfaces.ts";
import type {
  AggregatedResult,
  AnalysisResult,
} from "../../domain/models/entities.ts";

/**
 * Configuration orchestrator that coordinates all configuration services
 * Provides unified interface for configuration operations
 *
 * Note: This class provides methods from multiple repository interfaces
 * but doesn't formally implement conflicting interfaces due to method signature conflicts
 */
export class ConfigurationOrchestrator
  implements ConfigurationRepository, ResultRepository {
  private readonly configFileService: ConfigurationFileService;
  private readonly schemaConfigService: SchemaConfigurationService;
  private readonly templateConfigService: TemplateConfigurationService;
  private readonly resultManagementService: ResultManagementService;

  constructor(_fileSystemRepository: FileSystemRepository) {
    this.configFileService = new ConfigurationFileService();
    this.schemaConfigService = new SchemaConfigurationService();
    this.templateConfigService = new TemplateConfigurationService();
    this.resultManagementService = new ResultManagementService();
  }

  /**
   * Load processing configuration from file
   * Implements ConfigurationRepository interface
   */
  async loadProcessingConfig(
    path: ConfigPath,
  ): Promise<
    Result<ProcessingConfiguration, DomainError & { message: string }>
  > {
    // Load raw configuration
    const configResult = await this.configFileService.loadConfigurationFile(
      path,
    );
    if (!configResult.ok) {
      return configResult;
    }

    // Process configuration data into ProcessingConfiguration
    return this.createProcessingConfiguration(
      configResult.data,
      path.getValue(),
    );
  }

  /**
   * Load schema from configuration path
   * SchemaRepository-compatible method
   */
  loadSchema(
    _path: ConfigPath,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    // SchemaConfigurationService doesn't have loadSchema method
    // This is a compatibility method that needs proper implementation
    return Promise.resolve({
      ok: false,
      error: {
        kind: "NotConfigured",
        component: "SchemaConfigurationService",
        message: "Schema loading not implemented in configuration service",
      },
    });
  }

  /**
   * Legacy method name for backward compatibility
   * @deprecated Use loadSchema instead
   */
  async load(
    path: ConfigPath,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    return await this.loadSchema(path);
  }

  /**
   * Save results to output file
   * Implements ResultRepository interface
   */
  async save(
    results: AggregatedResult | AnalysisResult | unknown,
    path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>> {
    return await this.resultManagementService.saveResults(results, path);
  }

  /**
   * Append results to existing output file
   * Implements ResultRepository interface
   */
  async append(
    results: AggregatedResult | AnalysisResult | unknown,
    path: OutputPath,
  ): Promise<Result<void, DomainError & { message: string }>> {
    return await this.resultManagementService.appendResults(results, path);
  }

  /**
   * Validate processing configuration
   * Implements ConfigurationRepository interface
   */
  validate(
    config: ProcessingConfiguration,
  ): Result<void, DomainError & { message: string }> {
    try {
      // Basic configuration validation
      if (!config.documentsPath || !config.schemaPath || !config.outputPath) {
        return {
          ok: false,
          error: createDomainError({
            kind: "NotConfigured",
            component: "processing configuration",
          }, "Configuration missing required paths"),
        };
      }

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: "configuration validation",
          details: error instanceof Error ? error.message : "Unknown error",
        }, "Configuration validation failed"),
      };
    }
  }

  /**
   * Validate schema
   * Note: This method is for schema validation specifically
   */
  validateSchema(
    schema: Schema,
  ): Result<void, DomainError & { message: string }> {
    try {
      // Perform basic checks on schema structure
      const id = schema.getId();
      const definition = schema.getDefinition();

      if (!id || !definition) {
        return {
          ok: false,
          error: createDomainError({
            kind: "NotConfigured",
            component: "schema validation",
          }, "Schema missing required components"),
        };
      }

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: "schema validation",
          details: error instanceof Error ? error.message : "Unknown error",
        }, "Schema validation failed"),
      };
    }
  }

  /**
   * Load template from configuration path
   * Note: This is for backward compatibility
   */
  async loadTemplate(
    path: ConfigPath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    return await this.templateConfigService.loadTemplate(path);
  }

  /**
   * Load template from specific template path
   * Note: This is for backward compatibility
   */
  async loadFromPath(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    return await this.templateConfigService.loadFromPath(path);
  }

  /**
   * Create ProcessingConfiguration from raw configuration data
   */
  private createProcessingConfiguration(
    config: RawConfigurationData,
    configPath: string,
  ): Result<ProcessingConfiguration, DomainError & { message: string }> {
    try {
      // Create DocumentPath
      const documentsPathResult = DocumentPath.create(
        config.documentsPath || config.documents_path || ".",
      );
      if (!documentsPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: config.documentsPath || config.documents_path || ".",
            expectedFormat: "valid documents path",
          }, "Failed to create DocumentPath"),
        };
      }

      // Create schema ConfigPath
      const schemaPathResult = ConfigPath.create(
        config.schemaPath || config.schema_path || "schema.json",
      );
      if (!schemaPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: config.schemaPath || config.schema_path || "schema.json",
            expectedFormat: "valid schema path",
          }, "Failed to create schema ConfigPath"),
        };
      }

      // Create template TemplatePath
      const templatePathResult = TemplatePath.create(
        config.templatePath || config.template_path || "template.hbs",
      );
      if (!templatePathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: config.templatePath || config.template_path ||
              "template.hbs",
            expectedFormat: "valid template path",
          }, "Failed to create TemplatePath"),
        };
      }

      // Create OutputPath
      const outputPathResult = OutputPath.create(
        config.outputPath || config.output_path || "output.json",
      );
      if (!outputPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: config.outputPath || config.output_path || "output.json",
            expectedFormat: "valid output path",
          }, "Failed to create OutputPath"),
        };
      }

      // Create ProcessingOptions based on configuration
      const isParallel = config.parallel ?? false;
      const continueOnError = config.continueOnError ??
        config.continue_on_error ?? false;

      // Validate processing options combination
      if (isParallel && continueOnError) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidState",
            expected: "single processing mode",
            actual: "parallel + continueOnError",
          }, "Cannot use both parallel and continueOnError options together"),
        };
      }

      // Create appropriate ProcessingOptions discriminated union
      const options: ProcessingOptions = isParallel
        ? { kind: "ParallelOptions", maxConcurrency: 5 } // Default concurrency
        : { kind: "BasicOptions" };

      // Create ProcessingConfiguration
      const processingConfiguration: ProcessingConfiguration = {
        documentsPath: documentsPathResult.data,
        schemaPath: schemaPathResult.data,
        templatePath: templatePathResult.data,
        outputPath: outputPathResult.data,
        options,
      };

      return { ok: true, data: processingConfiguration };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: configPath,
          details: error instanceof Error ? error.message : "Unknown error",
        }, "Failed to create ProcessingConfiguration"),
      };
    }
  }
}
