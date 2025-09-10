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
} from "../domain/services/exit-handler.ts";
import {
  type FileFormatDetector,
  FormatDetectorFactory,
} from "../domain/services/file-format-detector.ts";

export class CLI {
  private readonly configValidator = new ConfigurationValidator();
  private readonly fileSystem = new DenoFileSystemProvider();
  private readonly frontMatterExtractor = new FrontMatterExtractorImpl();
  private readonly schemaValidator = new SchemaValidator();
  private readonly templateProcessor: UnifiedTemplateProcessor;
  private readonly processor: DocumentProcessor;
  private readonly exitHandler: ExitHandler;
  private readonly formatDetector: FileFormatDetector;

  constructor(
    exitHandler?: ExitHandler,
    formatDetector?: FileFormatDetector,
  ) {
    // Initialize exit handler (default to production mode)
    const exitResult = exitHandler
      ? { ok: true as const, data: exitHandler }
      : ExitHandlerFactory.createProduction(
        LoggerFactory.createLogger("cli-exit"),
      );
    if (!exitResult.ok) {
      throw new Error("Failed to create exit handler");
    }
    this.exitHandler = exitResult.data;

    // Initialize format detector (default configuration)
    const formatResult = formatDetector
      ? { ok: true as const, data: formatDetector }
      : FormatDetectorFactory.createDefault();
    if (!formatResult.ok) {
      throw new Error("Failed to create format detector");
    }
    this.formatDetector = formatResult.data;

    const templateProcessorResult = UnifiedTemplateProcessor.create();
    if ("kind" in templateProcessorResult) {
      throw new Error(
        `Failed to create template processor: ${
          String(templateProcessorResult.kind)
        }`,
      );
    }
    this.templateProcessor = templateProcessorResult;

    this.processor = new DocumentProcessor(
      this.fileSystem,
      this.frontMatterExtractor,
      this.schemaValidator,
      this.templateProcessor,
    );
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

    // Input configuration
    if (validatedArgs.inputPath) {
      config.input = {
        kind: "FileInput",
        path: validatedArgs.inputPath.toString(),
      };
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

    // Add default processing configuration if not provided
    if (!config.processing) {
      config.processing = {
        kind: "BasicProcessing",
      };
    }

    const result = this.configValidator.validate(config);
    if (!result.ok) {
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
