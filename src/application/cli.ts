import { parseArgs } from "jsr:@std/cli/parse-args";
import { isError, type Result } from "../domain/core/result.ts";
import { type DomainError, errorToString } from "../domain/shared/errors.ts";
import {
  type ApplicationConfiguration,
  ConfigurationValidator,
} from "./configuration.ts";
import { DocumentProcessor } from "./document-processor.ts";
import { FrontMatterExtractor } from "../domain/services/frontmatter-extractor.ts";
import { SchemaValidator } from "../domain/services/schema-validator.ts";
import { TemplateMapper } from "../domain/services/template-mapper.ts";
import { DenoFileSystemProvider } from "./climpt/climpt-adapter.ts";
import { ClaudeAnalyzerAdapter } from "../infrastructure/adapters/claude-analyzer.ts";
import { LoggerFactory } from "../domain/shared/logging/logger.ts";

export class CLI {
  private readonly configValidator = new ConfigurationValidator();
  private readonly fileSystem = new DenoFileSystemProvider();
  private readonly aiAnalyzer = new ClaudeAnalyzerAdapter();
  private readonly frontMatterExtractor = new FrontMatterExtractor();
  private readonly schemaValidator = new SchemaValidator();
  private readonly templateMapper = new TemplateMapper();
  private readonly processor: DocumentProcessor;

  constructor() {
    this.processor = new DocumentProcessor(
      this.fileSystem,
      this.aiAnalyzer,
      this.frontMatterExtractor,
      this.schemaValidator,
      this.templateMapper,
    );
  }

  async run(args: string[]): Promise<void> {
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
      return;
    }

    // Load configuration
    const configResult = await this.loadConfiguration(parsed);
    if (isError(configResult)) {
      const logger = LoggerFactory.createLogger("cli-config");
      logger.error("Configuration error", {
        error: errorToString(configResult.error),
      });
      Deno.exit(1);
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

    if (isError(result)) {
      const errorLogger = LoggerFactory.createLogger("cli-error");
      errorLogger.error("Processing error", {
        error: errorToString(result.error),
      });
      Deno.exit(1);
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
        error: errorToString(error.error),
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
  }

  private async loadConfiguration(
    args: Record<string, unknown>,
  ): Promise<Result<ApplicationConfiguration, DomainError>> {
    // If config file is specified, load it
    if (args.config) {
      const configPath = args.config as string;
      const fileResult = await this.fileSystem.readFile(configPath);
      if (isError(fileResult)) {
        return fileResult;
      }

      try {
        const config = JSON.parse(fileResult.data);
        return this.configValidator.validate(config);
      } catch (error) {
        return {
          ok: false,
          error: {
            kind: "ConfigurationError",
            message: `Failed to parse configuration file: ${error}`,
          },
        };
      }
    }

    // Build configuration from command line arguments
    const config: Partial<ApplicationConfiguration> = {};

    // Input configuration
    if (args.input) {
      config.input = {
        path: args.input as string,
      };
    }

    // Schema configuration
    if (args.schema) {
      const schemaPath = args.schema as string;
      const fileResult = await this.fileSystem.readFile(schemaPath);
      if (isError(fileResult)) {
        return fileResult;
      }

      try {
        const schema = JSON.parse(fileResult.data);
        config.schema = {
          definition: schema,
          format: "json",
        };
      } catch {
        config.schema = {
          definition: fileResult.data,
          format: "custom",
        };
      }
    }

    // Template configuration
    if (args.template) {
      const templatePath = args.template as string;
      const fileResult = await this.fileSystem.readFile(templatePath);
      if (isError(fileResult)) {
        return fileResult;
      }

      config.template = {
        definition: fileResult.data,
        format: templatePath.endsWith(".json")
          ? "json"
          : templatePath.endsWith(".yaml") || templatePath.endsWith(".yml")
          ? "yaml"
          : "custom",
      };
    }

    // Output configuration
    if (args.output) {
      const outputPath = args.output as string;
      config.output = {
        path: outputPath,
        format: outputPath.endsWith(".json")
          ? "json"
          : outputPath.endsWith(".yaml") || outputPath.endsWith(".yml")
          ? "yaml"
          : "markdown",
      };
    }

    return this.configValidator.validate(config);
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
