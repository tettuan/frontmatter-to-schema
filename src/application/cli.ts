import { parseArgs } from "jsr:@std/cli/parse-args";
import type { DomainError, Result } from "../domain/core/result.ts";
import {
  type ApplicationConfiguration,
  ConfigurationValidator,
  OutputFormat,
  SchemaFormat,
  TemplateFormat,
} from "./configuration.ts";
import { DocumentProcessor } from "./document-processor.ts";
import { FrontMatterExtractorImpl } from "../infrastructure/adapters/frontmatter-extractor-impl.ts";
import { SchemaValidator } from "../domain/services/schema-validator.ts";
import { UnifiedTemplateProcessor } from "../domain/template/services/unified-template-processor.ts";
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

export class CLI {
  private readonly logger = LoggerFactory.createLogger("CLI");
  private readonly configValidator = new ConfigurationValidator();
  private readonly fileSystem = new DenoFileSystemProvider();
  private readonly frontMatterExtractor = new FrontMatterExtractorImpl();
  private readonly schemaValidator = new SchemaValidator();
  private readonly templateProcessor: UnifiedTemplateProcessor;
  private readonly processor: DocumentProcessor;
  private readonly exitHandler: ExitHandler;
  private readonly formatDetector: FileFormatDetector;

  private constructor(
    exitHandler: ExitHandler,
    formatDetector: FileFormatDetector,
    templateProcessor: UnifiedTemplateProcessor,
    processor: DocumentProcessor,
  ) {
    this.exitHandler = exitHandler;
    this.formatDetector = formatDetector;
    this.templateProcessor = templateProcessor;
    this.processor = processor;
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
        LoggerFactory.createLogger("cli-exit"),
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

    const templateProcessorResult = UnifiedTemplateProcessor.create();
    if ("kind" in templateProcessorResult) {
      return {
        ok: false,
        error: {
          kind: "NotConfigured",
          component: "template-processor",
          message: `Failed to create template processor: ${
            String(templateProcessorResult.kind)
          }`,
        },
      };
    }

    const fileSystem = new DenoFileSystemProvider();
    const frontMatterExtractor = new FrontMatterExtractorImpl();
    const schemaValidator = new SchemaValidator();

    const processorResult = DocumentProcessor.create(
      fileSystem,
      frontMatterExtractor,
      schemaValidator,
      templateProcessorResult,
    );
    if (!processorResult.ok) {
      return {
        ok: false,
        error: {
          kind: "NotConfigured",
          component: "document-processor",
          message:
            `Failed to create document processor: ${processorResult.error.message}`,
        },
      };
    }

    return {
      ok: true,
      data: new CLI(
        exitResult.data,
        formatDetectorInstance,
        templateProcessorResult,
        processorResult.data,
      ),
    };
  }

  async run(args: string[]): Promise<Result<void, DomainError>> {
    const parsed = parseArgs(args, {
      string: ["config", "input", "output", "schema", "template"],
      boolean: ["help", "verbose"],
      alias: {
        c: "config",
        i: "input",
        o: "output",
        s: "schema",
        t: "template",
        h: "help",
        v: "verbose",
      },
    });

    if (parsed.help) {
      this.printHelp();
      return { ok: true, data: undefined };
    }

    // Handle positional arguments for backward compatibility
    // If no --input flag is provided but there's a positional argument, use it as input
    if (!parsed.input && parsed._ && parsed._.length > 0) {
      parsed.input = String(parsed._[0]);
    }

    // Load configuration
    const configResult = await this.loadConfiguration(parsed);
    if (!configResult.ok) {
      return configResult;
    }

    const config = configResult.data;

    if (parsed.verbose) {
      const verboseLogger = LoggerFactory.createLogger("cli-verbose");
      verboseLogger.info("Configuration loaded", { config });
    }

    // Process documents
    const processLogger = LoggerFactory.createLogger("cli-process");
    processLogger.info("Starting document processing");
    const result = await this.processor.processDocuments(config);

    if (!result.ok) {
      return result;
    }

    const batchResult = result.data;

    // Print summary
    const summaryLogger = LoggerFactory.createLogger("cli-summary");
    summaryLogger.info("Processing summary", {
      successful: batchResult.getSuccessCount(),
      failed: batchResult.getErrorCount(),
      total: batchResult.getTotalCount(),
    });

    if (batchResult.hasErrors()) {
      const errorSummaryLogger = LoggerFactory.createLogger("cli-errors");
      const errors = batchResult.getErrors().map((error) => ({
        document: error.document.getPath().getValue(),
        error: String(error.error.kind),
      }));
      errorSummaryLogger.warn("Processing errors encountered", {
        errorCount: batchResult.getErrorCount(),
        errors,
      });
    }

    const outputLogger = LoggerFactory.createLogger("cli-output");
    outputLogger.info("Output written successfully", {
      outputPath: config.output.path,
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
          config.input = {
            kind: "DirectoryInput",
            path: inputPath,
            pattern: "*.md", // Default pattern for markdown files
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
      const defaultTemplate = '{"template": "default"}'; // Simple default template
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
      const validationLogger = LoggerFactory.createLogger("cli-validation");
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

  private printHelp(): void {
    const helpLogger = LoggerFactory.createLogger("cli-help");
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
