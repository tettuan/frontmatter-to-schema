/**
 * RegistryBuilderAdapter - Stage 2 Processing Adapter
 *
 * Adapts existing result aggregation patterns into Stage 2 of two-stage processing:
 * Commands[] → Registry conversion with availableConfigs extraction and template application
 *
 * This adapter follows the Adapter Pattern to enable Stage 2 processing while maintaining
 * compatibility with existing result aggregation infrastructure.
 */

import {
  ExtractedData,
  type Schema,
  type Template,
} from "../../domain/models/entities.ts";
import type { DomainError } from "../../domain/core/result.ts";
import type {
  SchemaValidationMode,
  TemplateMapper,
} from "../../domain/services/interfaces.ts";
import type { Command } from "./command-processor-adapter.ts";

/**
 * Registry structure for Stage 2 output
 * Represents the final aggregated result of two-stage processing
 */
export interface Registry {
  /** Available configurations (unique c1 values) */
  readonly availableConfigs: string[];
  /** All processed commands organized by categories */
  readonly commands: RegistryCommand[];
  /** Metadata about the registry */
  readonly metadata: RegistryMetadata;
}

/**
 * Command representation in the registry
 */
export interface RegistryCommand {
  /** Command identifier (c1-c2-c3) */
  readonly id: string;
  /** Command category (c1) */
  readonly category: string;
  /** Command layer (c2) */
  readonly layer: string;
  /** Command directive (c3) */
  readonly directive: string;
  /** Command description from template */
  readonly description?: string;
  /** Command options */
  readonly options: Record<string, unknown>;
  /** Usage information */
  readonly usage?: string;
  /** Examples */
  readonly examples?: string[];
}

/**
 * Registry metadata
 */
export interface RegistryMetadata {
  /** Total number of commands */
  readonly totalCommands: number;
  /** Number of unique categories (c1 values) */
  readonly totalCategories: number;
  /** Generation timestamp */
  readonly generatedAt: string;
  /** Source files processed */
  readonly sourceFiles: string[];
}

/**
 * Stage 2 processing result using Totality principles
 */
export type RegistryBuildingResult =
  | { kind: "Success"; registry: Registry }
  | { kind: "NoCommands" }
  | { kind: "SchemaValidationError"; error: DomainError & { message: string } }
  | { kind: "TemplateMappingError"; error: DomainError & { message: string } }
  | { kind: "AggregationError"; commandCount: number; error: string };

/**
 * RegistryBuilderAdapter
 *
 * Aggregates Command[] from Stage 1 into final Registry structure for Stage 2.
 * Extracts availableConfigs, applies registry-level templates, and creates
 * comprehensive command registry output.
 */
export class RegistryBuilderAdapter {
  constructor(
    private readonly templateMapper: TemplateMapper,
  ) {}

  /**
   * Builds a registry from commands through Stage 2 of two-stage pipeline
   *
   * Flow:
   * 1. Validate input commands array
   * 2. Extract availableConfigs (unique c1 values)
   * 3. Create registry structure
   * 4. Apply registry schema validation
   * 5. Apply registry template mapping
   * 6. Return Registry object
   */
  buildRegistry(
    commands: Command[],
    registrySchema: Schema,
    registryTemplate: Template,
  ): Promise<RegistryBuildingResult> {
    // Step 1: Validate input
    if (!commands || commands.length === 0) {
      return Promise.resolve({ kind: "NoCommands" });
    }

    try {
      // Step 2: Extract availableConfigs
      const availableConfigs = this.extractAvailableConfigs(commands);

      // Step 3: Build registry structure
      const registryCommands = this.buildRegistryCommands(commands);
      const metadata = this.buildMetadata(commands, availableConfigs);

      const registryData: Registry = {
        availableConfigs,
        commands: registryCommands,
        metadata,
      };

      // Step 4: Apply schema validation through ExtractedData
      const extractedData = this.convertRegistryToExtractedData(registryData);

      // Step 5: Apply template mapping
      const schemaMode: SchemaValidationMode = {
        kind: "WithSchema",
        schema: registrySchema.getDefinition().getValue(),
      };
      const mappingResult = this.templateMapper.map(
        extractedData,
        registryTemplate,
        schemaMode,
      );

      if (!mappingResult.ok) {
        return Promise.resolve({
          kind: "TemplateMappingError",
          error: mappingResult.error,
        });
      }

      // Apply template transformations to registry
      const finalRegistry = this.applyTemplateTransformations(
        registryData,
        mappingResult.data,
      );

      return Promise.resolve({ kind: "Success", registry: finalRegistry });
    } catch (error) {
      return Promise.resolve({
        kind: "AggregationError",
        commandCount: commands.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Extracts availableConfigs from commands (unique c1 values, sorted)
   */
  private extractAvailableConfigs(commands: Command[]): string[] {
    const uniqueC1Values = new Set<string>();

    for (const command of commands) {
      uniqueC1Values.add(command.c1);
    }

    return Array.from(uniqueC1Values).sort();
  }

  /**
   * Builds RegistryCommand objects from Command objects
   */
  private buildRegistryCommands(commands: Command[]): RegistryCommand[] {
    return commands.map((command) => ({
      id: `${command.c1}-${command.c2}-${command.c3}`,
      category: command.c1,
      layer: command.c2,
      directive: command.c3,
      description: this.extractDescription(command),
      options: command.options,
      usage: this.extractUsage(command),
      examples: this.extractExamples(command),
    })).sort((a, b) => {
      // Sort by category (c1), then layer (c2), then directive (c3)
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      if (a.layer !== b.layer) return a.layer.localeCompare(b.layer);
      return a.directive.localeCompare(b.directive);
    });
  }

  /**
   * Builds registry metadata
   */
  private buildMetadata(
    commands: Command[],
    availableConfigs: string[],
  ): RegistryMetadata {
    const sourceFiles = Array.from(
      new Set(commands.map((cmd) => cmd.sourcePath)),
    ).sort();

    return {
      totalCommands: commands.length,
      totalCategories: availableConfigs.length,
      generatedAt: new Date().toISOString(),
      sourceFiles,
    };
  }

  /**
   * Converts Registry to ExtractedData for template processing
   */
  private convertRegistryToExtractedData(registry: Registry): ExtractedData {
    // Convert registry to a format that ExtractedData can handle
    return ExtractedData.create({
      availableConfigs: registry.availableConfigs,
      commands: registry.commands,
      metadata: registry.metadata,
      // Add computed fields for template usage
      totalCommands: registry.metadata.totalCommands,
      totalCategories: registry.metadata.totalCategories,
      commandsByCategory: this.groupCommandsByCategory(registry.commands),
    });
  }

  /**
   * Groups commands by category for easier template processing
   */
  private groupCommandsByCategory(
    commands: RegistryCommand[],
  ): Record<string, RegistryCommand[]> {
    const grouped: Record<string, RegistryCommand[]> = {};

    for (const command of commands) {
      if (!grouped[command.category]) {
        grouped[command.category] = [];
      }
      grouped[command.category].push(command);
    }

    return grouped;
  }

  /**
   * Applies template transformations to the registry
   */
  private applyTemplateTransformations(
    originalRegistry: Registry,
    mappedData: import("../../domain/models/entities.ts").MappedData,
  ): Registry {
    // Apply template-based transformations to the registry
    // This could include placeholder resolution, formatting, etc.

    const transformedCommands = originalRegistry.commands.map((command) => ({
      ...command,
      description: this.applyTemplatePlaceholders(
        command.description,
        mappedData,
      ),
      usage: this.applyTemplatePlaceholders(command.usage, mappedData),
    }));

    return {
      ...originalRegistry,
      commands: transformedCommands,
    };
  }

  /**
   * Applies template placeholder resolution
   */
  private applyTemplatePlaceholders(
    text: string | undefined,
    mappedData: import("../../domain/models/entities.ts").MappedData,
  ): string | undefined {
    if (!text) return text;

    // Simple placeholder resolution - can be enhanced
    let result = text;
    const templateData = mappedData.getData();

    if (typeof templateData === "object" && templateData !== null) {
      for (const [key, value] of Object.entries(templateData)) {
        const placeholder = `{${key}}`;
        if (result.includes(placeholder)) {
          result = result.replace(
            new RegExp(`\\{${key}\\}`, "g"),
            String(value),
          );
        }
      }
    }

    return result;
  }

  /**
   * Extracts description from command options or generates default
   */
  private extractDescription(command: Command): string | undefined {
    // Look for description in command options
    if (
      command.options.description &&
      typeof command.options.description === "string"
    ) {
      return command.options.description;
    }

    // Generate default description
    return `${command.c1} ${command.c2} ${command.c3} command`;
  }

  /**
   * Extracts usage information from command options
   */
  private extractUsage(command: Command): string | undefined {
    if (command.options.usage && typeof command.options.usage === "string") {
      return command.options.usage;
    }

    // Generate default usage
    return `${command.c1}-${command.c2} ${command.c3} [options]`;
  }

  /**
   * Extracts examples from command options
   */
  private extractExamples(command: Command): string[] | undefined {
    if (Array.isArray(command.options.examples)) {
      return command.options.examples.filter((ex) =>
        typeof ex === "string"
      ) as string[];
    }

    if (
      command.options.example && typeof command.options.example === "string"
    ) {
      return [command.options.example];
    }

    return undefined;
  }

  /**
   * Validates registry structure against schema
   * This is a placeholder for more sophisticated validation
   */
  private validateRegistryStructure(registry: Registry): boolean {
    return (
      Array.isArray(registry.availableConfigs) &&
      Array.isArray(registry.commands) &&
      registry.metadata &&
      typeof registry.metadata.totalCommands === "number"
    );
  }
}
