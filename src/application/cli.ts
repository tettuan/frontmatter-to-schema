import { parseArgs } from "jsr:@std/cli/parse-args";
import * as path from "jsr:@std/path";
import type { DomainError, Result } from "../domain/core/result.ts";
import {
  type ApplicationConfiguration,
  ConfigurationValidator,
  OutputFormat,
  SchemaFormat,
  TemplateFormat,
} from "./configuration.ts";
import {
  ProcessCoordinator,
  type ProcessingConfiguration,
} from "./process-coordinator.ts";
import type { ProcessingOptions } from "./services/processing-options-builder.ts";
import { DenoFileSystemProvider } from "./climpt/climpt-adapter.ts";
import { LoggerFactory } from "../domain/shared/logger.ts";
import { CliArgumentsValidator } from "./value-objects/cli-arguments.ts";
import {
  type ExitHandler,
  ExitHandlerFactory,
} from "../infrastructure/services/exit-handler.ts";
import {
  type FileFormatDetector,
  FormatDetectorFactory,
} from "../domain/services/file-format-detector.ts";
import { FilePattern } from "../domain/value-objects/file-pattern.ts";
import { CLILoggers } from "../domain/value-objects/logger-name.ts";
import { CLI_DEFAULTS } from "../domain/value-objects/cli-defaults.ts";

export class CLI {
  private readonly logger = LoggerFactory.createLogger(
    CLILoggers.MAIN.getName(),
  );
  private readonly configValidator = new ConfigurationValidator();
  private readonly fileSystem = new DenoFileSystemProvider();
  private readonly processCoordinator: ProcessCoordinator;
  private readonly exitHandler: ExitHandler;
  private readonly formatDetector: FileFormatDetector;

  private constructor(
    exitHandler: ExitHandler,
    formatDetector: FileFormatDetector,
    processCoordinator: ProcessCoordinator,
  ) {
    this.exitHandler = exitHandler;
    this.formatDetector = formatDetector;
    this.processCoordinator = processCoordinator;
  }

  /**
   * Smart Constructor following Totality principles
   * Eliminates throw new Error violations and returns Result<T,E>
   */
  static create(
    exitHandler?: ExitHandler,
    formatDetector?: FileFormatDetector,
  ): Result<CLI, DomainError & { message: string }> {
    // Initialize exit handler (default to production mode)
    const exitResult = exitHandler
      ? { ok: true as const, data: exitHandler }
      : ExitHandlerFactory.createProduction(
        LoggerFactory.createLogger(CLILoggers.EXIT.getName()),
      );
    if (!exitResult.ok) {
      return {
        ok: false,
        error: {
          kind: "NotConfigured",
          component: "exit-handler",
          message: "Failed to create exit handler",
        },
      };
    }

    // Initialize format detector (default configuration)
    const formatResult = formatDetector
      ? { ok: true as const, data: formatDetector }
      : FormatDetectorFactory.createDefault();

    // Since FormatDetectorFactory.createDefault() never fails, this check is for TypeScript
    if (!formatResult.ok) {
      return {
        ok: false,
        error: {
          kind: "NotConfigured",
          component: "format-detector",
          message: "Unexpected failure in format detector creation",
        },
      };
    }
    const formatDetectorInstance = formatResult.data;

    // Create ProcessCoordinator - the canonical processing entry point
    const processCoordinatorResult = ProcessCoordinator.create();
    if (!processCoordinatorResult.ok) {
      return {
        ok: false,
        error: {
          ...processCoordinatorResult.error,
          message:
            `Failed to create ProcessCoordinator: ${processCoordinatorResult.error.message}`,
        },
      };
    }
    const processCoordinator = processCoordinatorResult.data;

    return {
      ok: true,
      data: new CLI(
        exitResult.data,
        formatDetectorInstance,
        processCoordinator,
      ),
    };
  }

  async run(args: string[]): Promise<Result<void, DomainError>> {
    const cliConfig = CLI_DEFAULTS.getCLIArgumentConfig();
    const parsed = parseArgs(args, {
      string: [...cliConfig.stringOptions],
      boolean: [...cliConfig.booleanOptions],
      alias: { ...cliConfig.aliases },
    });

    if (parsed.help) {
      this.printHelp();
      return { ok: true, data: undefined };
    }

    // Handle positional arguments for backward compatibility
    // If no --input flag is provided but there's a positional argument, use it as input
    if (!parsed.input && parsed._ && parsed._.length > 0) {
      (parsed as Record<string, unknown>).input = String(parsed._[0]);
    }

    // Load configuration
    const configResult = await this.loadConfiguration(parsed);
    if (!configResult.ok) {
      return configResult;
    }

    const config = configResult.data;

    if (parsed.verbose) {
      const verboseLogger = LoggerFactory.createLogger(
        CLILoggers.VERBOSE.getName(),
      );
      verboseLogger.info("Configuration loaded", { config });
    }

    // Convert ApplicationConfiguration to ProcessingConfiguration
    const processingConfig = this.convertToProcessingConfiguration(
      config,
      parsed,
    );
    if (!processingConfig.ok) {
      return processingConfig;
    }

    // Process documents using canonical ProcessCoordinator
    const processLogger = LoggerFactory.createLogger(
      CLILoggers.PROCESS.getName(),
    );
    processLogger.info("Starting document processing");
    const result = await this.processCoordinator.processDocuments(
      processingConfig.data,
    );

    if (!result.ok) {
      return result;
    }

    const processingResult = result.data;

    // Print summary
    const summaryLogger = LoggerFactory.createLogger(
      CLILoggers.SUMMARY.getName(),
    );
    summaryLogger.info("Processing summary", {
      processedFiles: processingResult.processedFiles,
      processingTime: `${processingResult.processingTime}ms`,
      templateProcessed: processingResult.renderedContent.templateProcessed,
      bypassDetected: processingResult.bypassDetected,
      canonicalPathUsed: processingResult.canonicalPathUsed,
    });

    // Log validation results
    const validationResults = processingResult.validationResults.filter((r) =>
      !r.valid
    );
    if (validationResults.length > 0) {
      const errorSummaryLogger = LoggerFactory.createLogger(
        CLILoggers.ERRORS.getName(),
      );
      const errors = validationResults.map((result) => ({
        document: result.documentPath,
        errors: result.errors,
        warnings: result.warnings,
      }));
      errorSummaryLogger.warn("Processing errors encountered", {
        errorCount: validationResults.length,
        errors,
      });
    }

    const outputLogger = LoggerFactory.createLogger(
      CLILoggers.OUTPUT.getName(),
    );
    outputLogger.info("Output written successfully", {
      outputPath: processingConfig.data.output.path,
      templateVariables: processingResult.renderedContent.variables,
      aggregatedData: processingResult.aggregatedData ? "Available" : "None",
    });

    return { ok: true, data: undefined };
  }

  private async loadConfiguration(
    args: Record<string, unknown>,
  ): Promise<Result<ApplicationConfiguration, DomainError>> {
    // Validate CLI arguments first
    const validatedArgsResult = CliArgumentsValidator.validate(args);
    if (!validatedArgsResult.ok) {
      return validatedArgsResult;
    }
    const validatedArgs = validatedArgsResult.data;

    // If config file is specified, load it
    if (validatedArgs.configPath) {
      const fileResult = await this.fileSystem.readFile(
        validatedArgs.configPath.toString(),
      );
      if (!fileResult.ok) {
        return fileResult;
      }

      try {
        const config = JSON.parse(fileResult.data);
        const result = this.configValidator.validate(config);
        if (!result.ok) {
          return {
            ok: false,
            error: { kind: "ConfigurationError", config: config },
          };
        }
        return result;
      } catch (error) {
        return {
          ok: false,
          error: {
            kind: "ParseError",
            input: String(error),
            details: "Failed to parse configuration file",
          },
        };
      }
    }

    // Build configuration from command line arguments
    const config: Partial<ApplicationConfiguration> = {};

    // Input configuration - detect if path is file or directory
    if (validatedArgs.inputPath) {
      const inputPath = validatedArgs.inputPath.toString();

      // Check if path is a directory or file
      try {
        const stat = await Deno.stat(inputPath);
        if (stat.isDirectory) {
          // Use recursive pattern for directory scanning to find all markdown files
          // This fixes the issue where only files in the root directory were processed
          const recursivePatternResult = FilePattern.createGlob(
            CLI_DEFAULTS.getFilePatternDefaults().defaultRecursive,
          );
          if (!recursivePatternResult.ok) {
            return {
              ok: false,
              error: { kind: "ConfigurationError", config: config },
            };
          }

          config.input = {
            kind: "DirectoryInput",
            path: inputPath,
            pattern: recursivePatternResult.data.toString(),
          };
        } else {
          config.input = {
            kind: "FileInput",
            path: inputPath,
          };
        }
      } catch {
        // If stat fails, assume it's a file (let the file processor handle the error)
        config.input = {
          kind: "FileInput",
          path: inputPath,
        };
      }
    }

    // Schema configuration
    if (validatedArgs.schemaPath) {
      const schemaPath = validatedArgs.schemaPath.toString();
      const fileResult = await this.fileSystem.readFile(schemaPath);
      if (!fileResult.ok) {
        return fileResult;
      }

      // Use format detector to determine schema format
      const detectedFormat = this.formatDetector.detectFormat(schemaPath);
      const formatString = detectedFormat.ok ? detectedFormat.data : "custom";
      const formatResult = SchemaFormat.create(formatString);

      if (!formatResult.ok) {
        return formatResult;
      }

      config.schema = {
        definition: fileResult.data, // Keep as string
        format: formatResult.data,
      };
    }

    // Extract x-template from schema if schema is loaded and no template is provided
    if (config.schema && !validatedArgs.templatePath) {
      try {
        const schemaParsed = JSON.parse(config.schema.definition);
        if (schemaParsed["x-template"]) {
          const xTemplatePath = schemaParsed["x-template"];

          // Resolve relative path relative to schema file
          const pathDefaults = CLI_DEFAULTS.getPathDefaults();
          const schemaDir = validatedArgs.schemaPath
            ? validatedArgs.schemaPath.toString().split(pathDefaults.separator)
              .slice(0, -1).join(
                pathDefaults.separator,
              )
            : pathDefaults.currentDirectory;
          const resolvedTemplatePath =
            pathDefaults.relativePrefixes.some((prefix) =>
                xTemplatePath.startsWith(prefix)
              )
              ? `${schemaDir}${pathDefaults.separator}${xTemplatePath.slice(2)}`
              : xTemplatePath;

          const templateFileResult = await this.fileSystem.readFile(
            resolvedTemplatePath,
          );
          if (templateFileResult.ok) {
            const detectedFormat = this.formatDetector.detectFormat(
              resolvedTemplatePath,
            );
            const formatString = detectedFormat.ok
              ? detectedFormat.data
              : "json";
            const formatResult = TemplateFormat.create(formatString);

            if (formatResult.ok) {
              config.template = {
                definition: templateFileResult.data,
                format: formatResult.data,
              };
            }
          }
        }
      } catch {
        // If schema parsing fails, continue without x-template extraction
      }
    }

    // Template configuration
    if (validatedArgs.templatePath) {
      const templatePath = validatedArgs.templatePath.toString();
      const fileResult = await this.fileSystem.readFile(templatePath);
      if (!fileResult.ok) {
        return fileResult;
      }

      // Use format detector to determine template format
      const detectedFormat = this.formatDetector.detectFormat(templatePath);
      const formatString = detectedFormat.ok ? detectedFormat.data : "custom";
      const formatResult = TemplateFormat.create(formatString);
      if (!formatResult.ok) {
        return formatResult;
      }

      config.template = {
        definition: fileResult.data,
        format: formatResult.data,
      };
    }

    // Output configuration
    if (validatedArgs.outputPath) {
      const outputPath = validatedArgs.outputPath.toString();
      // Use format detector to determine output format (default to markdown)
      const detectedFormat = this.formatDetector.detectFormat(outputPath);
      const formatString = detectedFormat.ok ? detectedFormat.data : "markdown";
      const formatResult = OutputFormat.create(formatString);
      if (!formatResult.ok) {
        return formatResult;
      }

      config.output = {
        path: outputPath,
        format: formatResult.data,
      };
    }

    // Add default template configuration if not provided
    if (!config.template) {
      const defaultTemplate =
        CLI_DEFAULTS.getTemplateDefaults().defaultTemplate;
      const formatResult = TemplateFormat.create("json");
      if (!formatResult.ok) {
        return formatResult;
      }

      config.template = {
        definition: defaultTemplate,
        format: formatResult.data,
      };
    }

    // Add default processing configuration if not provided
    if (!config.processing) {
      config.processing = {
        kind: "BasicProcessing",
      };
    }

    const result = this.configValidator.validate(config);
    if (!result.ok) {
      // Better error reporting for debugging
      const validationLogger = LoggerFactory.createLogger(
        CLILoggers.VALIDATION.getName(),
      );
      validationLogger.error("Configuration validation failed", {
        error: result.error,
        config: config,
      });
      return {
        ok: false,
        error: { kind: "ConfigurationError", config: config },
      };
    }
    return result;
  }

  /**
   * Convert ApplicationConfiguration to ProcessingConfiguration for ProcessCoordinator
   */
  private convertToProcessingConfiguration(
    appConfig: ApplicationConfiguration,
    originalArgs: Record<string, unknown>,
  ): Result<ProcessingConfiguration, DomainError & { message: string }> {
    try {
      // Convert input configuration
      const inputConfig = {
        pattern: appConfig.input.kind === "DirectoryInput"
          ? appConfig.input.pattern
          : CLI_DEFAULTS.getFilePatternDefaults().defaultRecursive,
        baseDirectory: appConfig.input.path,
      };

      // Convert schema configuration
      // Use original schema path, not the loaded content
      const schemaPath = originalArgs.schema as string | undefined;
      if (!schemaPath) {
        return {
          ok: false,
          error: {
            kind: "ConfigurationError",
            config: appConfig,
            message: CLI_DEFAULTS.getErrorMessageDefaults().schemaPathRequired,
          },
        };
      }
      const schemaConfig = {
        path: schemaPath,
        format: (appConfig.schema.format.toString() as "json" | "yaml"),
      };

      // Convert template configuration
      // Check if schema has x-template
      let finalTemplatePath: string | undefined = originalArgs.template as
        | string
        | undefined;

      if (!finalTemplatePath) {
        // Try to extract x-template from schema
        try {
          const schemaContent = JSON.parse(appConfig.schema.definition);
          if (
            schemaContent && typeof schemaContent === "object" &&
            "x-template" in schemaContent
          ) {
            const xTemplate = schemaContent["x-template"];
            if (typeof xTemplate === "string") {
              // Resolve template path relative to schema directory
              const schemaDir = path.dirname(schemaPath);
              finalTemplatePath = path.resolve(schemaDir, xTemplate);
            }
          }
        } catch {
          // Schema might be YAML or invalid, skip x-template extraction
        }
      }

      // If still no template path, use default
      if (!finalTemplatePath) {
        finalTemplatePath = appConfig.template.definition;
      }

      const templateConfig = {
        kind: "file" as const,
        path: finalTemplatePath,
        format: (appConfig.template.format.toString() as
          | "json"
          | "yaml"
          | "xml"
          | "custom"),
      };

      // Convert output configuration
      const outputConfig = {
        path: appConfig.output.path,
        format: (appConfig.output.format.toString() as
          | "json"
          | "yaml"
          | "xml"
          | "custom"),
      };

      // Convert processing options using CLI defaults
      const defaultsResult = CLI_DEFAULTS.getProcessingConfiguration();
      const _processingOptions: ProcessingOptions = {
        strict: defaultsResult.strict,
        allowEmptyFrontmatter: defaultsResult.allowEmptyFrontmatter,
        allowMissingVariables: defaultsResult.allowMissingVariables,
        validateSchema: defaultsResult.validateSchema,
        parallelProcessing: defaultsResult.parallelProcessing,
        maxFiles: defaultsResult.maxFiles.getValue(),
      };

      const processingConfig: ProcessingConfiguration = {
        kind: "basic",
        schema: schemaConfig,
        input: inputConfig,
        template: templateConfig,
        output: outputConfig,
      };

      return { ok: true, data: processingConfig };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ConfigurationError" as const,
          config: appConfig,
          message: `Failed to convert configuration: ${String(error)}`,
        },
      };
    }
  }

  private printHelp(): void {
    const helpLogger = LoggerFactory.createLogger(CLILoggers.HELP.getName());
    helpLogger.info("Displaying help information");
    // Help output to stdout is intentional - not logging
    console.log(`
Frontmatter to Schema - Markdown Frontmatter Analysis Tool

Usage:
  frontmatter-to-schema [options]

Options:
  -c, --config <path>     Path to configuration file (JSON)
  -i, --input <path>      Input directory containing markdown files
  -o, --output <path>     Output file path
  -s, --schema <path>     Path to schema definition file
  -t, --template <path>   Path to template definition file
  -v, --verbose           Enable verbose output
  -h, --help              Show this help message

Examples:
  # Using a configuration file
  frontmatter-to-schema -c config.json

  # Using command line arguments
  frontmatter-to-schema -i ./docs -o output.json -s schema.json -t template.json

Configuration File Format:
  {
    "input": {
      "path": "./docs",
      "pattern": "\\\\.md$"
    },
    "schema": {
      "definition": { ... },
      "format": "json"
    },
    "template": {
      "definition": "...",
      "format": "json"
    },
    "output": {
      "path": "./output.json",
      "format": "json"
    },
    "processing": {
      "extractionPrompt": "...",
      "mappingPrompt": "...",
      "continueOnError": true
    }
  }
`);
  }
}
