/**
 * Path Configuration Module
 *
 * Provides centralized path configuration management to eliminate hardcoding
 * and improve maintainability. All path-related configurations should be
 * defined here to ensure consistency across the application.
 *
 * This module follows the DDD principle of encapsulating domain knowledge
 * and provides a single source of truth for path configurations.
 */

import type { EnvironmentRepository, FileSystemRepository } from "../repositories/file-system-repository.ts";

export interface PathConfiguration {
  readonly registryPrompts: string;
  readonly registryOutput: string;
  readonly schemaPath: string;
  readonly templatePath: string;
  readonly commandSchemaPath: string;
  readonly commandTemplatePath: string;
}

export interface ExamplePathConfiguration {
  readonly climptRegistry: {
    readonly base: string;
    readonly schema: string;
    readonly template: string;
  };
  readonly articlesIndex: {
    readonly base: string;
    readonly schema: string;
    readonly template: string;
  };
  readonly sampleDocs: string;
  readonly outputDir: string;
}

/**
 * Default path configuration for the application
 * These can be overridden via environment variables or configuration files
 */
export class DefaultPathConfiguration implements PathConfiguration {
  readonly registryPrompts: string;
  readonly registryOutput: string;
  readonly schemaPath: string;
  readonly templatePath: string;
  readonly commandSchemaPath: string;
  readonly commandTemplatePath: string;

  constructor(environmentRepo?: EnvironmentRepository) {
    // Support environment variable overrides for all paths
    this.registryPrompts = this.getPath(
      "REGISTRY_PROMPTS_PATH",
      ".agent/climpt/prompts",
      environmentRepo,
    );
    this.registryOutput = this.getPath(
      "REGISTRY_OUTPUT_PATH",
      ".agent/climpt/registry.json",
      environmentRepo,
    );
    this.schemaPath = this.getPath("DEFAULT_SCHEMA_PATH", "schema.json", environmentRepo);
    this.templatePath = this.getPath("DEFAULT_TEMPLATE_PATH", "template.json", environmentRepo);
    this.commandSchemaPath = this.getPath(
      "COMMAND_SCHEMA_PATH",
      "registry_command_schema.json",
      environmentRepo,
    );
    this.commandTemplatePath = this.getPath(
      "COMMAND_TEMPLATE_PATH",
      "registry_command_template.json",
      environmentRepo,
    );
  }

  private getPath(envVar: string, defaultValue: string, environmentRepo?: EnvironmentRepository): string {
    if (environmentRepo) {
      return environmentRepo.getOrDefault(envVar, defaultValue);
    }
    // Fallback for cases where repository is not provided (legacy support)
    return defaultValue;
  }
}

/**
 * Example-specific path configuration
 * Used for documentation and testing purposes
 */
export class ExamplePathConfig implements ExamplePathConfiguration {
  readonly climptRegistry = {
    base: "examples/climpt-registry",
    schema: "examples/climpt-registry/schema.json",
    template: "examples/climpt-registry/template.json",
  };

  readonly articlesIndex = {
    base: "examples/articles-index",
    schema: "examples/articles-index/schema.json",
    template: "examples/articles-index/template.yaml",
  };

  readonly sampleDocs = "examples/sample-docs";
  readonly outputDir = "examples/output";

  constructor(overrides?: Partial<ExamplePathConfiguration>) {
    if (overrides) {
      Object.assign(this, overrides);
    }
  }
}

/**
 * Path configuration factory
 * Creates appropriate configuration based on context
 */
export class PathConfigurationFactory {
  constructor(private readonly environmentRepo?: EnvironmentRepository, private readonly fileSystemRepo?: FileSystemRepository) {}
  
  createDefault(): PathConfiguration {
    return new DefaultPathConfiguration(this.environmentRepo);
  }

  static createExample(): ExamplePathConfiguration {
    return new ExamplePathConfig();
  }

  createFromEnvironment(): PathConfiguration {
    return new DefaultPathConfiguration(this.environmentRepo);
  }

  /**
   * Create configuration from a JSON file
   * Supports flexible configuration loading for different environments
   */
  async createFromFile(filePath: string): Promise<PathConfiguration> {
    if (!this.fileSystemRepo) {
      // If no file system repository, return default configuration
      return new DefaultPathConfiguration(this.environmentRepo);
    }
    
    const readResult = await this.fileSystemRepo.readFile(filePath);
    if (!readResult.ok) {
      console.error(
        `Failed to load path configuration from ${filePath}:`,
        readResult.error,
      );
      return new DefaultPathConfiguration(this.environmentRepo);
    }
    
    try {
      const config = JSON.parse(readResult.data);

      return {
        registryPrompts: config.registryPrompts || ".agent/climpt/prompts",
        registryOutput: config.registryOutput || ".agent/climpt/registry.json",
        schemaPath: config.schemaPath || "schema.json",
        templatePath: config.templatePath || "template.json",
        commandSchemaPath: config.commandSchemaPath ||
          "registry_command_schema.json",
        commandTemplatePath: config.commandTemplatePath ||
          "registry_command_template.json",
      };
    } catch (error) {
      console.error(
        `Failed to parse path configuration from ${filePath}:`,
        error,
      );
      return new DefaultPathConfiguration(this.environmentRepo);
    }
  }
}

/**
 * Path resolver utility
 * Resolves relative paths and ensures consistency
 */
export class PathResolver {
  constructor(
    private basePath?: string,
    private environmentRepo?: EnvironmentRepository,
  ) {
    if (!this.basePath) {
      this.basePath = this.environmentRepo?.getCurrentDirectory() || ".";
    }
  }

  resolve(path: string): string {
    if (path.startsWith("/")) {
      return path;
    }
    return `${this.basePath}/${path}`.replace(/\/+/g, "/");
  }

  resolveAll(paths: string[]): string[] {
    return paths.map((path) => this.resolve(path));
  }
}
