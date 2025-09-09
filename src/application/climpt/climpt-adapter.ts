/**
 * Climpt-specific adapter for the generic frontmatter analysis system
 *
 * This module provides adapters and configurations specifically for the Climpt
 * command registry use case, implementing the required interfaces with Climpt-specific logic.
 */

import type {
  ConfigurationProvider,
  ExternalAnalysisService,
  PromptConfiguration,
} from "../../domain/core/abstractions.ts";
import type {
  FileInfo,
  FileSystemPort,
} from "../../infrastructure/ports/index.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";
import type { Logger } from "../../domain/shared/logger.ts";
import type { LoggerProvider } from "../../domain/core/logging-service.ts";
// Removed complex factory imports - using direct creation instead
import {
  FrontMatterAnalysisPipeline,
  type FrontMatterInput,
  type FrontMatterOutput,
  type FrontMatterPipelineConfig,
} from "../../domain/pipeline/generic-pipeline.ts";
import {
  SchemaAnalysisFactory,
  type SchemaAnalysisProcessor as _SchemaAnalysisProcessor,
} from "../../domain/analysis/schema-driven.ts";
import { VERSION_CONFIG } from "../../config/version.ts";

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
export class DenoFileSystemProvider implements FileSystemPort {
  async readFile(path: string): Promise<Result<string, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "FileNotFound", path },
      };
    }
  }

  async writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, DomainError>> {
    try {
      // Ensure directory exists
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir) {
        await Deno.mkdir(dir, { recursive: true });
      }

      await Deno.writeTextFile(path, content);
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "write" },
      };
    }
  }

  async exists(path: string): Promise<Result<boolean, DomainError>> {
    try {
      await Deno.stat(path);
      return { ok: true, data: true };
    } catch (_error) {
      if (_error instanceof Deno.errors.NotFound) {
        return { ok: true, data: false };
      }
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "read" },
      };
    }
  }

  async listFiles(
    path: string,
    pattern?: string,
  ): Promise<Result<FileInfo[], DomainError>> {
    try {
      const files: FileInfo[] = [];

      for await (const dirEntry of Deno.readDir(path)) {
        if (dirEntry.isFile && (!pattern || dirEntry.name.match(pattern))) {
          const stat = await Deno.stat(`${path}/${dirEntry.name}`);
          files.push({
            path: `${path}/${dirEntry.name}`,
            name: dirEntry.name,
            isDirectory: false,
            size: stat.size,
            modifiedAt: stat.mtime || new Date(),
          });
        }
      }

      return { ok: true, data: files };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "read" },
      };
    }
  }

  async createDirectory(path: string): Promise<Result<void, DomainError>> {
    try {
      await Deno.mkdir(path, { recursive: true });
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "write" },
      };
    }
  }

  async deleteFile(path: string): Promise<Result<void, DomainError>> {
    try {
      await Deno.remove(path);
      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: { kind: "PermissionDenied", path, operation: "delete" },
      };
    }
  }

  // Legacy methods for backward compatibility
  async readDirectory(path: string): Promise<string[]> {
    const result = await this.listFiles(path, "\\.md$");
    if (result.ok) {
      return result.data.map((f) => f.name); // Return just the name, not full path
    }
    throw new Error(`Failed to read directory: ${result.error.kind}`);
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

/**
 * Climpt-specific pipeline that extends the generic pipeline with additional functionality
 */
export class ClimptAnalysisPipeline extends FrontMatterAnalysisPipeline<
  ClimptRegistrySchema,
  { isValid: boolean; data: ClimptRegistrySchema }
> {
  constructor(
    config: FrontMatterPipelineConfig<
      ClimptRegistrySchema,
      { isValid: boolean; data: ClimptRegistrySchema }
    >,
    private readonly loggerProvider?: LoggerProvider,
  ) {
    super(config);
  }

  override processTyped(
    _input: FrontMatterInput,
  ): Promise<
    FrontMatterOutput<
      ClimptRegistrySchema,
      { isValid: boolean; data: ClimptRegistrySchema }
    >
  > {
    // For now, return a stub implementation matching the expected type
    return Promise.resolve({
      results: [],
      metadata: {},
      summary: {
        totalFiles: 0,
        processedFiles: 0,
        successfulFiles: 0,
        failedFiles: 0,
        errors: [],
      },
    });
  }

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

    const output = await this.processTyped(input);

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
    output: FrontMatterOutput<
      ClimptRegistrySchema,
      { isValid: boolean; data: ClimptRegistrySchema }
    >,
  ): ClimptRegistrySchema {
    const baseRegistry: ClimptRegistrySchema = {
      version: VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
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

    const logger = this.loggerProvider?.getLogger("climpt-summary") ??
      // Fallback for backward compatibility - proper Logger implementation
      new (class implements Logger {
        info(): void {}
        warn(): void {}
        error(): void {}
        debug(): void {}
      })();

    logger.info("Processing summary", {
      totalFiles: summaryObj.totalFiles ?? "N/A",
      processedFiles: summaryObj.processedFiles ?? "N/A",
      successfulFiles: summaryObj.successfulFiles ?? "N/A",
      failedFiles: summaryObj.failedFiles ?? "N/A",
    });

    if (summaryObj.errors && summaryObj.errors.length > 0) {
      logger.warn("Processing errors encountered", {
        errorCount: summaryObj.errors.length,
        errors: summaryObj.errors,
      });
    }
  }
}

/**
 * Enhanced Factory for creating Climpt-specific analysis pipelines
 * Uses the unified component factory architecture
 * @deprecated Use MasterComponentFactory.createDomainComponents(ComponentDomain.Pipeline) for production use
 * @internal For Climpt-specific integration only
 */
export class ClimptPipelineFactory {
  static async create(
    schemaPath?: string,
    templatePath?: string,
    extractPromptPath?: string,
    mapPromptPath?: string,
    loggerProvider?: LoggerProvider,
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

    // Direct processor creation - simpler and more direct than factory pattern
    const analysisProcessor = SchemaAnalysisFactory.createProcessor(
      claudeService,
      prompts,
      schema,
      template,
    );

    // Create pipeline configuration
    const config: FrontMatterPipelineConfig<
      ClimptRegistrySchema,
      { isValid: boolean; data: ClimptRegistrySchema }
    > = {
      schema,
      template,
      prompts,
      fileSystem,
      analysisProcessor,
    };

    // Create ClimptAnalysisPipeline with the unified configuration
    return new ClimptAnalysisPipeline(config, loggerProvider);
  }

  static async createDefault(): Promise<ClimptAnalysisPipeline> {
    return await this.create();
  }

  // Removed createWithUnifiedFactory method - deprecated factory pattern eliminated
}
