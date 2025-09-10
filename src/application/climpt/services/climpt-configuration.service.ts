/**
 * Climpt Configuration Service - Configuration Provider Implementation
 *
 * Implements the ConfigurationProvider interface for Climpt-specific configurations.
 * Extracted from climpt-adapter.ts for better organization.
 */

import type {
  ConfigurationProvider,
  PromptConfiguration,
} from "../../../domain/core/abstractions.ts";
import { VERSION_CONFIG } from "../../../config/version.ts";
import type { ClimptRegistrySchema } from "../models/climpt-schema.models.ts";

/**
 * Climpt configuration provider
 */
export class ClimptConfigurationProvider
  implements ConfigurationProvider<ClimptRegistrySchema> {
  constructor(
    private readonly schemaPath?: string,
    private readonly templatePath?: string,
    private readonly extractPromptPath =
      "scripts/prompts/extract_frontmatter.md",
    private readonly mapPromptPath = "scripts/prompts/map_to_schema.md",
  ) {}

  async getSchema(): Promise<ClimptRegistrySchema> {
    if (this.schemaPath) {
      const content = await Deno.readTextFile(this.schemaPath);
      return JSON.parse(content);
    }

    // Return default Climpt schema
    return this.getDefaultSchema();
  }

  async getTemplate(): Promise<ClimptRegistrySchema> {
    if (this.templatePath) {
      const content = await Deno.readTextFile(this.templatePath);
      return JSON.parse(content);
    }

    // Return default Climpt template
    return this.getDefaultTemplate();
  }

  async getPrompts(): Promise<PromptConfiguration> {
    const [extractionPrompt, mappingPrompt] = await Promise.all([
      Deno.readTextFile(this.extractPromptPath),
      Deno.readTextFile(this.mapPromptPath),
    ]);

    return {
      extractionPrompt,
      mappingPrompt,
    };
  }

  private getDefaultSchema(): ClimptRegistrySchema {
    return {
      version: "string",
      description: "string",
      tools: {
        availableConfigs: ["string[]"],
        commands: [{
          c1: "string (domain/category)",
          c2: "string (action/directive)",
          c3: "string (target/layer)",
          description: "string",
          usage: "string (optional)",
          options: {
            input: ["default"],
            adaptation: ["default"],
            input_file: [false],
            stdin: [false],
            destination: [false],
          },
        }],
      },
    };
  }

  private getDefaultTemplate(): ClimptRegistrySchema {
    return {
      version: VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
      description:
        "Climpt comprehensive configuration for MCP server and command registry",
      tools: {
        availableConfigs: ["code", "docs", "git", "meta", "spec", "test"],
        commands: [],
      },
    };
  }
}
