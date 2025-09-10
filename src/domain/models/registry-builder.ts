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
import { DEFAULT_VALUES } from "../constants/index.ts";
import type { Template } from "./entities.ts";
import type { Schema } from "./entities.ts";
import type { Command } from "../core/command-types.ts";

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
 * Type guards for safe data access without type assertions
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string");
}

function isCommandArray(value: unknown): value is Command[] {
  return Array.isArray(value) &&
    value.every((item) => item && typeof item === "object" && "c1" in item);
}

function isValidToolsObject(value: unknown): value is {
  availableConfigs: string[];
  commands: Command[];
} {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return "availableConfigs" in obj &&
    "commands" in obj &&
    isStringArray(obj.availableConfigs) &&
    isCommandArray(obj.commands);
}

function isValidRegistryData(value: unknown): value is {
  version: string;
  description: string;
  tools: { availableConfigs: string[]; commands: Command[] };
} {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return "version" in obj &&
    "description" in obj &&
    "tools" in obj &&
    typeof obj.version === "string" &&
    typeof obj.description === "string" &&
    isValidToolsObject(obj.tools);
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
        version: context.version || DEFAULT_VALUES.SCHEMA_VERSION,
        description: context.description || DEFAULT_VALUES.REGISTRY_DESCRIPTION,
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
      const c1Value = command.c1;
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
      const _schemaProps = schema.getProperties();
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

      // Validate tools structure using type guard
      if (!isValidToolsObject(registryData.tools)) {
        return {
          ok: false,
          error: createDomainError({
            kind: "SchemaValidationFailed",
            schema: {},
            data: {},
            field: "tools",
            details:
              "Registry tools must have valid availableConfigs and commands arrays",
          }),
        };
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
      // Apply template rules to registry data
      const mappingResult = template.applyRules(registryData, {
        kind: "SimpleMapping",
      });
      // mappingResult is the transformed data directly
      const mappedData = typeof mappingResult === "object" &&
          mappingResult !== null &&
          !Array.isArray(mappingResult)
        ? mappingResult as Record<string, unknown>
        : {};

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

    // Use type guard to validate complete registry structure
    if (!isValidRegistryData(data)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: {},
          data: {},
          field: "registry",
          details:
            "Invalid registry structure: must have version, description, and valid tools object",
        }),
      };
    }

    // After type guard validation, data is safely typed
    const registry: Registry = {
      version: data.version,
      description: data.description,
      tools: {
        availableConfigs: data.tools.availableConfigs,
        commands: data.tools.commands,
      },
    };

    return { ok: true, data: registry };
  }
}

/**
 * Type guard for Registry interface
 */
export function isRegistry(value: unknown): value is Registry {
  return isValidRegistryData(value);
}
