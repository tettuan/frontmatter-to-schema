/**
 * Configuration Repository Implementation
 * Handles loading and validation of processing configurations
 * Follows Totality principles with Result types and no partial functions
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import {
  ConfigPath,
  DocumentPath,
  OutputPath,
  TemplatePath,
} from "../../domain/models/value-objects.ts";
import type {
  ConfigurationRepository,
  ProcessingConfiguration,
  ProcessingOptions,
} from "../../domain/services/interfaces.ts";

export class ConfigurationRepositoryImpl implements ConfigurationRepository {
  validate(
    config: ProcessingConfiguration,
  ): Result<void, DomainError & { message: string }> {
    // Validate all paths exist
    if (
      !config.documentsPath || !config.schemaPath || !config.templatePath ||
      !config.outputPath
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "MissingRequiredField",
          fields: ["documentsPath", "schemaPath", "templatePath", "outputPath"],
        }, "Invalid configuration: missing required paths"),
      };
    }

    return { ok: true, data: undefined };
  }

  async loadProcessingConfig(
    path: ConfigPath,
  ): Promise<
    Result<ProcessingConfiguration, DomainError & { message: string }>
  > {
    try {
      const configPath = path.getValue();
      const content = await Deno.readTextFile(configPath);
      const config = JSON.parse(content);

      // Validate and create value objects
      const documentsPathResult = DocumentPath.create(
        config.documentsPath || config.documents_path || ".",
      );
      if (!documentsPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: configPath,
            details: "Invalid documents path",
          }),
        };
      }

      const schemaPathResult = ConfigPath.create(
        config.schemaPath || config.schema_path || "schema.json",
      );
      if (!schemaPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: configPath,
            details: "Invalid schema path",
          }),
        };
      }

      const templatePathResult = TemplatePath.create(
        config.templatePath || config.template_path || "template.json",
      );
      if (!templatePathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: configPath,
            details: "Invalid template path",
          }),
        };
      }

      const outputPathResult = OutputPath.create(
        config.outputPath || config.output_path || "output.json",
      );
      if (!outputPathResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: configPath,
            details: "Invalid output path",
          }),
        };
      }

      // Create ProcessingOptions using discriminated union following Totality principle
      const options = this.createProcessingOptions(config.options);

      const processingConfig: ProcessingConfiguration = {
        documentsPath: documentsPathResult.data,
        schemaPath: schemaPathResult.data,
        templatePath: templatePathResult.data,
        outputPath: outputPathResult.data,
        options,
      };

      return { ok: true, data: processingConfig };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path: path.getValue(),
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  /**
   * Create ProcessingOptions using discriminated union
   * Follows Totality principle - exhaustive pattern matching
   */
  private createProcessingOptions(
    options?: Record<string, unknown>,
  ): ProcessingOptions {
    const parallel = Boolean(options?.parallel ?? true);
    const maxConcurrency = Number(options?.maxConcurrency) || 5;
    const continueOnError = Boolean(options?.continueOnError ?? false);

    if (parallel && continueOnError) {
      return {
        kind: "FullOptions",
        maxConcurrency,
        continueOnError,
      };
    } else if (parallel) {
      return {
        kind: "ParallelOptions",
        maxConcurrency,
      };
    } else if (continueOnError) {
      return {
        kind: "ResilientOptions",
        continueOnError,
      };
    } else {
      return { kind: "BasicOptions" };
    }
  }
}
