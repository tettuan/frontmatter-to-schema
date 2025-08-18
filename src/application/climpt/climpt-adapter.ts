/**
 * Climpt-specific adapter for the generic frontmatter analysis system
 *
 * This module provides adapters and configurations specifically for the Climpt
 * command registry use case, implementing the required interfaces with Climpt-specific logic.
 */

import type {
  ConfigurationProvider,
  ExternalAnalysisService,
  FileSystemProvider,
  PromptConfiguration,
} from "../../domain/core/abstractions.ts";
import {
  FrontMatterAnalysisPipeline,
  type FrontMatterInput,
  type FrontMatterOutput,
  type FrontMatterPipelineConfig,
  FrontMatterPipelineFactory,
} from "../../domain/pipeline/generic-pipeline.ts";
import {
  SchemaAnalysisFactory,
  type SchemaAnalysisProcessor as _SchemaAnalysisProcessor,
} from "../../domain/analysis/schema-driven.ts";

/**
 * Climpt command registry schema definition
 */
export interface ClimptRegistrySchema {
  version: string;
  description: string;
  tools: {
    availableConfigs: string[];
    commands: ClimptCommand[];
  };
}

/**
 * Climpt command structure
 */
export interface ClimptCommand {
  c1: string; // Domain/category
  c2: string; // Action/directive
  c3: string; // Target/layer
  description: string;
  usage?: string;
  options?: {
    input?: string[];
    adaptation?: string[];
    input_file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };
}

/**
 * Claude CLI service adapter
 */
export class ClaudeCLIService implements ExternalAnalysisService {
  async analyze(
    prompt: string,
    _context?: Record<string, unknown>,
  ): Promise<unknown> {
    // Create temporary file for the prompt
    const tempFile = await Deno.makeTempFile({ suffix: ".txt" });

    try {
      await Deno.writeTextFile(tempFile, prompt);

      // Execute claude -p command
      const command = new Deno.Command("claude", {
        args: ["-p", tempFile],
        stdout: "piped",
        stderr: "piped",
      });

      const { stdout, stderr } = await command.output();

      if (stderr.length > 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new Error(`Claude CLI error: ${errorText}`);
      }

      const output = new TextDecoder().decode(stdout);

      // Try to parse as JSON, fallback to raw text
      try {
        return JSON.parse(output);
      } catch {
        return { raw: output };
      }
    } finally {
      // Clean up temporary file
      try {
        await Deno.remove(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Deno file system provider
 */
export class DenoFileSystemProvider implements FileSystemProvider {
  async readFile(path: string): Promise<string> {
    return await Deno.readTextFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    // Ensure directory exists
    const dir = path.split("/").slice(0, -1).join("/");
    if (dir) {
      await Deno.mkdir(dir, { recursive: true });
    }

    await Deno.writeTextFile(path, content);
  }

  async readDirectory(path: string): Promise<string[]> {
    const files: string[] = [];

    try {
      for await (const dirEntry of Deno.readDir(path)) {
        if (dirEntry.isFile && dirEntry.name.endsWith(".md")) {
          files.push(dirEntry.name);
        }
      }
    } catch (error) {
      throw new Error(`Failed to read directory ${path}: ${error}`);
    }

    return files;
  }

  async exists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

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
      version: "1.0.0",
      description:
        "Climpt comprehensive configuration for MCP server and command registry",
      tools: {
        availableConfigs: ["code", "docs", "git", "meta", "spec", "test"],
        commands: [],
      },
    };
  }
}

/**
 * Climpt-specific pipeline that extends the generic pipeline with additional functionality
 */
export class ClimptAnalysisPipeline extends FrontMatterAnalysisPipeline<
  ClimptRegistrySchema,
  ClimptRegistrySchema
> {
  async processAndSave(
    promptsDir: string,
    outputPath: string,
    options?: Record<string, unknown>,
  ): Promise<ClimptRegistrySchema> {
    const input: FrontMatterInput = {
      sourceDirectory: promptsDir,
      filePattern: /\.md$/,
      options,
    };

    const output = await this.process(input);

    // Aggregate all successful results into a single registry
    const aggregatedRegistry = this.aggregateResults(output);

    // Save to file
    const fileSystem = new DenoFileSystemProvider();
    await fileSystem.writeFile(
      outputPath,
      JSON.stringify(aggregatedRegistry, null, 2),
    );

    // Log summary
    this.logProcessingSummary(output.summary);

    return aggregatedRegistry;
  }

  private aggregateResults(
    output: FrontMatterOutput<ClimptRegistrySchema>,
  ): ClimptRegistrySchema {
    const baseRegistry: ClimptRegistrySchema = {
      version: "1.0.0",
      description:
        "Climpt comprehensive configuration for MCP server and command registry",
      tools: {
        availableConfigs: ["code", "docs", "git", "meta", "spec", "test"],
        commands: [],
      },
    };

    const allCommands: ClimptCommand[] = [];
    const configsSet = new Set(baseRegistry.tools.availableConfigs);

    for (const result of output.results) {
      if (result.isValid && result.data.tools?.commands) {
        // Add commands
        allCommands.push(...result.data.tools.commands);

        // Merge available configs
        if (result.data.tools.availableConfigs) {
          result.data.tools.availableConfigs.forEach((config) =>
            configsSet.add(config)
          );
        }
      }
    }

    return {
      ...baseRegistry,
      tools: {
        availableConfigs: Array.from(configsSet).sort(),
        commands: this.deduplicateCommands(allCommands),
      },
    };
  }

  private deduplicateCommands(commands: ClimptCommand[]): ClimptCommand[] {
    const seen = new Set<string>();
    const deduplicated: ClimptCommand[] = [];

    for (const command of commands) {
      const key = `${command.c1}/${command.c2}/${command.c3}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(command);
      }
    }

    return deduplicated.sort((a, b) =>
      a.c1.localeCompare(b.c1) || a.c2.localeCompare(b.c2) ||
      a.c3.localeCompare(b.c3)
    );
  }

  private logProcessingSummary(summary: unknown): void {
    const summaryObj = summary as {
      totalFiles?: number;
      processedFiles?: number;
      successfulFiles?: number;
      failedFiles?: number;
      errors?: string[];
    };

    console.log(`\n📊 Processing Summary:`);
    console.log(`  Total files: ${summaryObj.totalFiles ?? "N/A"}`);
    console.log(`  Processed: ${summaryObj.processedFiles ?? "N/A"}`);
    console.log(`  Successful: ${summaryObj.successfulFiles ?? "N/A"}`);
    console.log(`  Failed: ${summaryObj.failedFiles ?? "N/A"}`);

    if (summaryObj.errors && summaryObj.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      summaryObj.errors.forEach((error: string) => console.log(`  - ${error}`));
    }
  }
}

/**
 * Factory for creating Climpt-specific analysis pipelines
 */
export class ClimptPipelineFactory {
  static async create(
    schemaPath?: string,
    templatePath?: string,
    extractPromptPath?: string,
    mapPromptPath?: string,
  ): Promise<ClimptAnalysisPipeline> {
    // Initialize services and providers
    const claudeService = new ClaudeCLIService();
    const fileSystem = new DenoFileSystemProvider();
    const configProvider = new ClimptConfigurationProvider(
      schemaPath,
      templatePath,
      extractPromptPath,
      mapPromptPath,
    );

    // Load configuration
    const [schema, template, prompts] = await Promise.all([
      configProvider.getSchema(),
      configProvider.getTemplate(),
      configProvider.getPrompts(),
    ]);

    // Create analysis processor
    const analysisProcessor = SchemaAnalysisFactory.createProcessor(
      claudeService,
      prompts,
      schema,
      template,
    );

    // Create pipeline configuration
    const config: FrontMatterPipelineConfig<
      ClimptRegistrySchema,
      ClimptRegistrySchema
    > = {
      schema,
      template,
      prompts,
      fileSystem,
      analysisProcessor,
    };

    // Create and return pipeline
    const factory = new FrontMatterPipelineFactory(config);
    return factory.createPipeline() as ClimptAnalysisPipeline;
  }

  static async createDefault(): Promise<ClimptAnalysisPipeline> {
    return await this.create();
  }
}
