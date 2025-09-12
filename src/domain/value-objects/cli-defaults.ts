/**
 * CLI Defaults Configuration Object
 *
 * Centralizes all hardcoded CLI values with validation and type safety
 * following DDD and Totality principles
 *
 * Addresses Issue #677: CLI Hardcoding Violations
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type ValidationError } from "../core/result.ts";
import { MaxFiles, type ProcessingMode } from "./max-files.ts";

/**
 * Processing options configuration with validation
 */
export interface ProcessingConfiguration {
  readonly strict: boolean;
  readonly allowEmptyFrontmatter: boolean;
  readonly allowMissingVariables: boolean;
  readonly validateSchema: boolean;
  readonly parallelProcessing: boolean;
  readonly maxFiles: MaxFiles;
}

/**
 * File pattern configuration
 */
export interface FilePatternDefaults {
  readonly defaultRecursive: string;
  readonly defaultDirectory: string;
  readonly defaultSingle: string;
}

/**
 * Template configuration defaults
 */
export interface TemplateDefaults {
  readonly defaultTemplate: string;
  readonly defaultFormat: "json" | "yaml" | "xml" | "custom";
}

/**
 * Path resolution defaults
 */
export interface PathDefaults {
  readonly separator: string;
  readonly relativePrefixes: readonly string[];
  readonly currentDirectory: string;
}

/**
 * CLI argument configuration
 */
export interface CLIArgumentConfig {
  readonly stringOptions: readonly string[];
  readonly booleanOptions: readonly string[];
  readonly aliases: Readonly<Record<string, string>>;
}

/**
 * Error message defaults
 */
export interface ErrorMessageDefaults {
  readonly schemaPathRequired: string;
  readonly configurationValidationFailed: string;
  readonly exitHandlerCreationFailed: string;
  readonly formatDetectorCreationFailed: string;
}

/**
 * CLIDefaults - Centralized configuration for CLI hardcoded values
 *
 * Provides validated, configurable defaults replacing scattered hardcoded values
 */
export class CLIDefaults {
  private constructor(
    private readonly processing: ProcessingConfiguration,
    private readonly filePatterns: FilePatternDefaults,
    private readonly templates: TemplateDefaults,
    private readonly paths: PathDefaults,
    private readonly cliArgs: CLIArgumentConfig,
    private readonly errorMessages: ErrorMessageDefaults,
  ) {}

  /**
   * Create CLIDefaults with validation
   */
  static create(
    config?: Partial<{
      processingMode: ProcessingMode;
      maxFiles: number;
      customTemplateDefault: string;
      customPatterns: Partial<FilePatternDefaults>;
    }>,
  ): Result<CLIDefaults, ValidationError & { message: string }> {
    try {
      // Create processing configuration
      const processingResult = CLIDefaults.createProcessingConfig(config);
      if (!processingResult.ok) return processingResult;

      // Create other configurations
      const filePatterns = CLIDefaults.createFilePatternDefaults(
        config?.customPatterns,
      );
      const templates = CLIDefaults.createTemplateDefaults(
        config?.customTemplateDefault,
      );
      const paths = CLIDefaults.createPathDefaults();
      const cliArgs = CLIDefaults.createCLIArgumentConfig();
      const errorMessages = CLIDefaults.createErrorMessageDefaults();

      return {
        ok: true,
        data: new CLIDefaults(
          processingResult.data,
          filePatterns,
          templates,
          paths,
          cliArgs,
          errorMessages,
        ),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: JSON.stringify(config),
          message: `Failed to create CLI defaults: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        }),
      };
    }
  }

  /**
   * Create CLIDefaults with standard application defaults
   */
  static createStandard(): CLIDefaults {
    const result = CLIDefaults.create();
    if (!result.ok) {
      throw new Error(
        `Failed to create standard CLI defaults: ${result.error.message}`,
      );
    }
    return result.data;
  }

  // Getters for configuration sections
  getProcessingConfiguration(): ProcessingConfiguration {
    return this.processing;
  }

  getFilePatternDefaults(): FilePatternDefaults {
    return this.filePatterns;
  }

  getTemplateDefaults(): TemplateDefaults {
    return this.templates;
  }

  getPathDefaults(): PathDefaults {
    return this.paths;
  }

  getCLIArgumentConfig(): CLIArgumentConfig {
    return this.cliArgs;
  }

  getErrorMessageDefaults(): ErrorMessageDefaults {
    return this.errorMessages;
  }

  /**
   * Create processing configuration with validation
   */
  private static createProcessingConfig(config?: {
    processingMode?: ProcessingMode;
    maxFiles?: number;
  }): Result<ProcessingConfiguration, ValidationError & { message: string }> {
    const mode: ProcessingMode = config?.processingMode || {
      kind: "strict",
      description: "Conservative limits for reliability",
    };

    const maxFilesResult = config?.maxFiles
      ? MaxFiles.create(config.maxFiles, mode)
      : MaxFiles.createForMode(mode);

    if (!maxFilesResult.ok) {
      return maxFilesResult;
    }

    return {
      ok: true,
      data: {
        strict: false,
        allowEmptyFrontmatter: false,
        allowMissingVariables: true,
        validateSchema: true,
        parallelProcessing: false,
        maxFiles: maxFilesResult.data,
      },
    };
  }

  /**
   * Create file pattern defaults
   */
  private static createFilePatternDefaults(
    custom?: Partial<FilePatternDefaults>,
  ): FilePatternDefaults {
    return {
      defaultRecursive: custom?.defaultRecursive || "**/*.md",
      defaultDirectory: custom?.defaultDirectory || ".",
      defaultSingle: custom?.defaultSingle || "*.md",
    };
  }

  /**
   * Create template defaults
   */
  private static createTemplateDefaults(
    customTemplate?: string,
  ): TemplateDefaults {
    return {
      defaultTemplate: customTemplate || '{"template": "default"}',
      defaultFormat: "json",
    };
  }

  /**
   * Create path resolution defaults
   */
  private static createPathDefaults(): PathDefaults {
    return {
      separator: "/",
      relativePrefixes: ["./", "../"] as const,
      currentDirectory: ".",
    };
  }

  /**
   * Create CLI argument configuration
   */
  private static createCLIArgumentConfig(): CLIArgumentConfig {
    return {
      stringOptions: [
        "config",
        "input",
        "output",
        "schema",
        "template",
      ] as const,
      booleanOptions: ["help", "verbose"] as const,
      aliases: {
        c: "config",
        i: "input",
        o: "output",
        s: "schema",
        t: "template",
        h: "help",
        v: "verbose",
      } as const,
    };
  }

  /**
   * Create error message defaults
   */
  private static createErrorMessageDefaults(): ErrorMessageDefaults {
    return {
      schemaPathRequired:
        "Schema path is required but not provided in original arguments",
      configurationValidationFailed: "Configuration validation failed",
      exitHandlerCreationFailed: "Failed to create exit handler",
      formatDetectorCreationFailed:
        "Unexpected failure in format detector creation",
    };
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `CLIDefaults(maxFiles: ${this.processing.maxFiles.toString()})`;
  }
}

/**
 * Default CLI configuration instance for application use
 */
export const CLI_DEFAULTS = CLIDefaults.createStandard();

/**
 * Utility functions for CLI defaults
 */
export const CLIDefaultsUtils = {
  /**
   * Create performance-optimized CLI defaults
   */
  createPerformanceDefaults(): CLIDefaults {
    const result = CLIDefaults.create({
      processingMode: {
        kind: "performance",
        description: "Higher limits for performance",
      },
      maxFiles: 5000,
    });
    return result.ok ? result.data : CLIDefaults.createStandard();
  },

  /**
   * Create bulk processing CLI defaults
   */
  createBulkDefaults(): CLIDefaults {
    const result = CLIDefaults.create({
      processingMode: {
        kind: "bulk",
        description: "Maximum limits for bulk processing",
      },
      maxFiles: 25000,
    });
    return result.ok ? result.data : CLIDefaults.createStandard();
  },

  /**
   * Validate CLI argument against configuration
   */
  isValidCLIArgument(arg: string, defaults: CLIDefaults): boolean {
    const config = defaults.getCLIArgumentConfig();
    return config.stringOptions.includes(arg) ||
      config.booleanOptions.includes(arg) ||
      Object.keys(config.aliases).includes(arg);
  },

  /**
   * Get full argument name from alias
   */
  resolveAlias(alias: string, defaults: CLIDefaults): string {
    const config = defaults.getCLIArgumentConfig();
    return config.aliases[alias] || alias;
  },
};
