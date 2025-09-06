/**
 * RegistryBuilder - Aggregate Root for Stage 2 Processing
 *
 * Handles registry aggregation:
 * - Aggregates individual commands into final registry
 * - Builds availableConfigs from unique c1 values
 * - Applies registry schema and template
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { Template } from "./entities.ts";
import type { Schema } from "./entities.ts";
import type { Command } from "./command-processor.ts";

/**
 * Registry represents the final aggregated structure (最終成果物Z)
 */
export interface Registry {
  version: string;
  description: string;
  tools: {
    availableConfigs: string[];
    commands: Command[];
  };
}

/**
 * Registry building context
 */
export interface RegistryBuildingContext {
  registrySchema: Schema;
  registryTemplate: Template;
  version?: string;
  description?: string;
}

/**
 * RegistryBuilder - Aggregate Root for Stage 2 processing
 */
export class RegistryBuilder {
  private constructor() {}

  /**
   * Smart constructor following totality principle
   */
  static create(): Result<RegistryBuilder, DomainError & { message: string }> {
    return { ok: true, data: new RegistryBuilder() };
  }

  /**
   * Build registry from processed commands (最終成果物Z)
   */
  async buildRegistry(
    commands: Command[],
    context: RegistryBuildingContext,
  ): Promise<Result<Registry, DomainError & { message: string }>> {
    try {
      // Stage 2.1: Create availableConfigs from unique c1 values
      const availableConfigs = this.extractAvailableConfigs(commands);

      // Stage 2.2: Create registry data structure
      const registryData = {
        version: context.version || "1.0.0",
        description: context.description || "Climpt Command Registry",
        tools: {
          availableConfigs,
          commands,
        },
      };

      // Stage 2.3: Apply registry schema validation
      const schemaValidation = await this.validateWithRegistrySchema(
        registryData,
        context.registrySchema,
      );
      if (!schemaValidation.ok) {
        return schemaValidation;
      }

      // Stage 2.4: Apply registry template formatting
      const templateResult = await this.applyRegistryTemplate(
        registryData,
        context.registryTemplate,
      );
      if (!templateResult.ok) {
        return templateResult;
      }

      return { ok: true, data: templateResult.data };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "registry-processing",
          error: createDomainError({
            kind: "InvalidFormat",
            input: "registry commands",
            expectedFormat: "valid commands array",
          }),
        }),
      };
    }
  }

  /**
   * Extract unique c1 values for availableConfigs
   *
   * As specified in requirements: "availableConfigs を利用可能なコマンドの c1 の集合体で構築する"
   */
  private extractAvailableConfigs(commands: Command[]): string[] {
    const uniqueC1Values = new Set<string>();

    for (const command of commands) {
      const c1Value = command.getC1();
      if (c1Value && c1Value.trim()) {
        uniqueC1Values.add(c1Value.trim());
      }
    }

    // Return sorted array for consistent output
    return Array.from(uniqueC1Values).sort();
  }

  /**
   * Validate registry data against registry schema
   */
  private validateWithRegistrySchema(
    registryData: Record<string, unknown>,
    schema: Schema,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    try {
      // Validate registry structure matches schema
      const schemaProps = schema.getProperties();
      const requiredFields = schema.getRequiredFields();

      // Check required fields
      for (const requiredField of requiredFields) {
        if (!(requiredField in registryData)) {
          return {
            ok: false,
            error: createDomainError({
              kind: "SchemaValidationFailed",
              schema: {},
              data: {},
              field: requiredField,
              details: `Required registry field '${requiredField}' is missing`,
            }),
          };
        }
      }

      // Validate tools structure
      if (registryData.tools && typeof registryData.tools === "object") {
        const tools = registryData.tools as Record<string, unknown>;

        if (!Array.isArray(tools.availableConfigs)) {
          return {
            ok: false,
            error: createDomainError({
              kind: "SchemaValidationFailed",
              schema: {},
              data: {},
              field: "tools.availableConfigs",
              details: "availableConfigs must be an array",
            }),
          };
        }

        if (!Array.isArray(tools.commands)) {
          return {
            ok: false,
            error: createDomainError({
              kind: "SchemaValidationFailed",
              schema: {},
              data: {},
              field: "tools.commands",
              details: "commands must be an array",
            }),
          };
        }
      }

      return { ok: true, data: registryData };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: {},
          data: {},
          details: _error instanceof Error
            ? _error.message
            : "Registry schema validation failed",
        }),
      };
    }
  }

  /**
   * Apply registry template to create final formatted structure
   */
  private applyRegistryTemplate(
    registryData: Record<string, unknown>,
    template: Template,
  ): Result<Registry, DomainError & { message: string }> {
    try {
      // Apply template mapping
      const mappingResult = (template as unknown as {
        substituteTemplateValues: (
          arg1: unknown,
          arg2: unknown,
        ) => Result<unknown, DomainError>;
      }).substituteTemplateValues({}, registryData) as Result<
        unknown,
        DomainError
      >;
      if (!mappingResult.ok) {
        return mappingResult as Result<
          Registry,
          DomainError & { message: string }
        >;
      }

      const mappedData =
        (mappingResult as { data: { getData: () => Record<string, unknown> } })
          .data.getData();

      // Validate final registry structure
      const registryValidation = this.validateRegistryStructure(mappedData);
      if (!registryValidation.ok) {
        return registryValidation;
      }

      return { ok: true, data: registryValidation.data };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ProcessingStageError",
          stage: "registry-processing",
          error: createDomainError({
            kind: "TemplateMappingFailed",
            template: {},
            source: {},
          }),
        }),
      };
    }
  }

  /**
   * Validate the final registry structure
   */
  private validateRegistryStructure(
    data: Record<string, unknown>,
  ): Result<Registry, DomainError & { message: string }> {
    // Validate required registry fields
    if (typeof data.version !== "string" || !data.version.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: {},
          data: {},
          field: "version",
          details:
            "Registry version is required and must be a non-empty string",
        }),
      };
    }

    if (typeof data.description !== "string" || !data.description.trim()) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: {},
          data: {},
          field: "description",
          details:
            "Registry description is required and must be a non-empty string",
        }),
      };
    }

    if (!data.tools || typeof data.tools !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: {},
          data: {},
          field: "tools",
          details: "Registry tools object is required",
        }),
      };
    }

    const tools = data.tools as Record<string, unknown>;

    if (!Array.isArray(tools.availableConfigs)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: {},
          data: {},
          field: "tools.availableConfigs",
          details: "availableConfigs must be an array",
        }),
      };
    }

    if (!Array.isArray(tools.commands)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: {},
          data: {},
        }),
      };
    }

    // Create validated registry object
    const registry: Registry = {
      version: data.version as string,
      description: data.description as string,
      tools: {
        availableConfigs: tools.availableConfigs as string[],
        commands: tools.commands as Command[],
      },
    };

    return { ok: true, data: registry };
  }
}

/**
 * Type guard for Registry interface
 */
export function isRegistry(value: unknown): value is Registry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const registry = value as Record<string, unknown>;

  const isValidVersion: boolean = typeof registry.version === "string";
  const isValidDescription: boolean = typeof registry.description === "string";
  const hasTools: boolean = Boolean(
    registry.tools && typeof registry.tools === "object",
  );
  const hasValidAvailableConfigs: boolean = hasTools &&
    Array.isArray((registry.tools as Record<string, unknown>).availableConfigs);
  const hasValidCommands: boolean = hasTools &&
    Array.isArray((registry.tools as Record<string, unknown>).commands);

  return isValidVersion && isValidDescription && hasValidAvailableConfigs &&
    hasValidCommands;
}
