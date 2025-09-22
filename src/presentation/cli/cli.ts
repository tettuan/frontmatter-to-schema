import {
  PipelineConfig,
  PipelineOrchestrator,
  ProcessingLoggerFactory,
  VerbosityConfig,
} from "../../application/services/pipeline-orchestrator.ts";
import { TemplateConfig } from "../../application/strategies/template-resolution-strategy.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { JMESPathFilterService } from "../../domain/schema/services/jmespath-filter-service.ts";
import { FrontmatterProcessor } from "../../domain/frontmatter/processors/frontmatter-processor.ts";
import { TemplateRenderer } from "../../domain/template/renderers/template-renderer.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";
import { TemplatePathResolver } from "../../domain/template/services/template-path-resolver.ts";
import { Aggregator } from "../../domain/aggregation/aggregators/aggregator.ts";
import { BasePropertyPopulator } from "../../domain/schema/services/base-property-populator.ts";
import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { EnhancedDebugLogger } from "../../domain/shared/services/debug-logger.ts";
import { DebugLoggerFactory } from "../../infrastructure/logging/debug-logger-factory.ts";
import { SchemaCacheFactory } from "../../infrastructure/caching/schema-cache.ts";
import { CLIArguments } from "./value-objects/cli-arguments.ts";
import { PathExpansionService } from "./services/path-expansion-service.ts";
import { CLIErrorMessageService } from "./services/cli-error-message-service.ts";
import { PromptGeneratorService } from "./services/prompt-generator-service.ts";
import { SupportedFormats } from "../../domain/configuration/value-objects/supported-formats.ts";
import { PerformanceSettings } from "../../domain/configuration/value-objects/performance-settings.ts";
import { FormatConfigLoaderFactory } from "../../domain/configuration/services/format-config-loader.ts";
import {
  DenoFileLister,
  DenoFileReader,
  DenoFileWriter,
  FileSystemSchemaRepository,
  JsonFrontmatterParser,
  YamlFrontmatterExtractor,
} from "../../infrastructure/index.ts";

export class CLI {
  private orchestrator: PipelineOrchestrator;
  private logger: EnhancedDebugLogger;
  private pathExpansionService: PathExpansionService;
  private errorMessageService: CLIErrorMessageService;
  private promptGeneratorService: PromptGeneratorService;
  private supportedFormats: SupportedFormats;

  private constructor(
    orchestrator: PipelineOrchestrator,
    logger: EnhancedDebugLogger,
    pathExpansionService: PathExpansionService,
    errorMessageService: CLIErrorMessageService,
    promptGeneratorService: PromptGeneratorService,
    supportedFormats: SupportedFormats,
  ) {
    this.orchestrator = orchestrator;
    this.logger = logger;
    this.pathExpansionService = pathExpansionService;
    this.errorMessageService = errorMessageService;
    this.promptGeneratorService = promptGeneratorService;
    this.supportedFormats = supportedFormats;
  }

  static async create(): Promise<Result<CLI, DomainError>> {
    // Create enhanced logger for CLI with default non-verbose mode
    const loggerResult = DebugLoggerFactory.createEnhancedForCLI(false);
    if (!loggerResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Failed to create logger",
      }));
    }

    // Load supported formats configuration
    const formatConfigLoader = FormatConfigLoaderFactory
      .createWithDenoAdapters();
    const supportedFormatsResult = await formatConfigLoader
      .loadConfigurationWithFallback();
    if (!supportedFormatsResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message:
          `Failed to load supported formats: ${supportedFormatsResult.error.message}`,
      }));
    }
    const supportedFormats = supportedFormatsResult.data;

    // Create CLI services
    const pathExpansionResult = PathExpansionService.create();
    if (!pathExpansionResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Failed to create path expansion service",
      }));
    }

    const errorMessageResult = CLIErrorMessageService.create(supportedFormats);
    if (!errorMessageResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Failed to create error message service",
      }));
    }

    const promptGeneratorResult = PromptGeneratorService.create();
    if (!promptGeneratorResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Failed to create prompt generator service",
      }));
    }

    const orchestratorResult = CLI.createOrchestrator(loggerResult.data);
    if (!orchestratorResult.ok) {
      return err(orchestratorResult.error);
    }

    return ok(
      new CLI(
        orchestratorResult.data,
        loggerResult.data,
        pathExpansionResult.data,
        errorMessageResult.data,
        promptGeneratorResult.data,
        supportedFormats,
      ),
    );
  }

  private static createOrchestrator(
    logger: EnhancedDebugLogger,
  ): Result<PipelineOrchestrator, DomainError> {
    const fileReader = new DenoFileReader();
    const fileWriter = new DenoFileWriter();
    const fileLister = new DenoFileLister();
    const schemaRepository = new FileSystemSchemaRepository(fileReader);

    const frontmatterExtractor = new YamlFrontmatterExtractor();
    const frontmatterParser = new JsonFrontmatterParser();
    const frontmatterProcessorResult = FrontmatterProcessor.create(
      frontmatterExtractor,
      frontmatterParser,
    );
    if (!frontmatterProcessorResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          `Failed to create FrontmatterProcessor: ${frontmatterProcessorResult.error.message}`,
      }));
    }
    const frontmatterProcessor = frontmatterProcessorResult.data;

    const aggregatorResult = Aggregator.createWithStandardCircuitBreaker();
    if (!aggregatorResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          `Failed to create aggregator: ${aggregatorResult.error.message}`,
      }));
    }
    const aggregator = aggregatorResult.data;
    const basePropertyPopulator = new BasePropertyPopulator();

    const performanceSettings = PerformanceSettings.createDefault();
    if (!performanceSettings.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Failed to create default performance settings",
      }));
    }

    const documentProcessor = FrontmatterTransformationService
      .createWithEnabledLogging(
        frontmatterProcessor,
        aggregator,
        basePropertyPopulator,
        fileReader,
        fileLister,
        logger,
        performanceSettings.data,
      );

    // Create JMESPath Filter Service
    const jmespathFilterServiceResult = JMESPathFilterService.create();
    if (!jmespathFilterServiceResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message: "Failed to create JMESPath Filter Service",
      }));
    }

    const schemaProcessorResult = SchemaProcessingService.create(
      schemaRepository,
      basePropertyPopulator,
      jmespathFilterServiceResult.data,
    );
    if (!schemaProcessorResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message:
          `Failed to create SchemaProcessingService: ${schemaProcessorResult.error.message}`,
      }));
    }
    const schemaProcessor = schemaProcessorResult.data;

    // Create TemplateRenderer
    const templateRendererResult = TemplateRenderer.create();
    if (!templateRendererResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Failed to create TemplateRenderer`,
      }));
    }
    const templateRenderer = templateRendererResult.data;

    // Create OutputRenderingService
    const outputRenderingServiceResult = OutputRenderingService.create(
      templateRenderer,
      fileReader,
      fileWriter,
    );
    if (!outputRenderingServiceResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Failed to create OutputRenderingService`,
      }));
    }
    const outputRenderingService = outputRenderingServiceResult.data;

    // Create TemplatePathResolver
    const templatePathResolver = new TemplatePathResolver();

    // Create SchemaCache with default configuration
    const schemaCache = SchemaCacheFactory.create();

    // Create file system adapter
    const fileSystem = {
      read: (path: string) => fileReader.read(path),
      write: (path: string, content: string) => fileWriter.write(path, content),
      list: (pattern: string) => fileLister.list(pattern),
    };

    // Create processing logger state for pipeline orchestrator
    const processingLoggerState = ProcessingLoggerFactory.createEnhancedEnabled(
      logger,
    );

    return PipelineOrchestrator.create(
      documentProcessor,
      schemaProcessor,
      outputRenderingService,
      templatePathResolver,
      fileSystem,
      schemaCache,
      processingLoggerState,
    );
  }

  async run(
    args: string[],
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Help display
    if (args.includes("--help") || args.includes("-h")) {
      this.showHelp();
      return Promise.resolve(ok(void 0));
    }

    // Version display
    if (args.includes("--version") || args.includes("-v")) {
      this.showVersion();
      return Promise.resolve(ok(void 0));
    }

    // Parse and validate CLI arguments using new CLIArguments value object
    const cliArgsResult = CLIArguments.create(args, this.supportedFormats);
    if (!cliArgsResult.ok) {
      const errorMessage = this.errorMessageService.generateErrorMessage(
        cliArgsResult.error,
      );
      const logResult = this.logger.errorOutput(errorMessage);
      if (!logResult.ok) {
        // Fallback to console.error if logger fails
        console.error(errorMessage);
      }
      return Promise.resolve(err(cliArgsResult.error));
    }

    const cliArgs = cliArgsResult.data;

    // Handle --generate-prompt option
    if (cliArgs.generatePrompt) {
      const expandedPatternResult = this.pathExpansionService
        .expandInputPattern(
          cliArgs.inputPattern,
        );
      if (!expandedPatternResult.ok) {
        const errorMessage = this.errorMessageService.generateErrorMessage(
          expandedPatternResult.error,
        );
        const logResult = this.logger.errorOutput(errorMessage);
        if (!logResult.ok) {
          console.error(errorMessage);
        }
        return Promise.resolve(err(expandedPatternResult.error));
      }

      const prompt = this.promptGeneratorService.generateSchemaTemplatePrompt(
        cliArgs.schemaPath,
        expandedPatternResult.data,
      );
      const outputResult = this.logger.output(prompt);
      if (!outputResult.ok) {
        console.log(prompt);
      }
      return Promise.resolve(ok(void 0));
    }

    // Expand input pattern (directory → glob pattern)
    const expandedPatternResult = this.pathExpansionService.expandInputPattern(
      cliArgs.inputPattern,
    );
    if (!expandedPatternResult.ok) {
      const errorMessage = this.errorMessageService.generateErrorMessage(
        expandedPatternResult.error,
      );
      const logResult = this.logger.errorOutput(errorMessage);
      if (!logResult.ok) {
        console.error(errorMessage);
      }
      return Promise.resolve(err(expandedPatternResult.error));
    }

    // Execute command with expanded pattern
    return await this.executeCommand(
      cliArgs.schemaPath,
      expandedPatternResult.data,
      cliArgs.outputPath,
      cliArgs.verbose,
      cliArgs.templatePath,
    );
  }

  private showHelp(): void {
    // Use output() for user-facing help text that should always be visible
    const helpText = `
frontmatter-to-schema - Generate JSON from Markdown frontmatter

USAGE:
  deno run --allow-read --allow-write cli.ts <schema> <input> <output>

ARGUMENTS:
  <schema>   Path to JSON schema file (e.g., schema.json)
  <input>    Input pattern: directory, glob pattern, or single file
             • Directory: "docs/", "examples/prompts/"
             • Glob: "**/*.md", "docs/**/*.md"
             • File: "readme.md", "docs/intro.md"
  <output>   Output file path (e.g., output.json, result.yaml)

OPTIONS:
  -h, --help           Show this help message
  -v, --version        Show version information
  --verbose            Enable verbose logging
  --generate-prompt    Generate prompt for creating schema and template files
  --template, -t       Path to custom template file (e.g., template.json)

REQUIRED PERMISSIONS:
  --allow-read   Read schema files and markdown documents
  --allow-write  Write output files

OPTIONAL PERMISSIONS:
  --allow-env    Enhanced debug logging (set DEBUG_LEVEL=0-3)

EXAMPLES:
  # Process all markdown files in a directory
  deno run --allow-read --allow-write cli.ts schema.json docs/ output.json

  # Use glob pattern for specific files
  deno run --allow-read --allow-write cli.ts schema.json "**/*.md" output.json

  # Process single file
  deno run --allow-read --allow-write cli.ts schema.json readme.md output.json

  # With verbose logging
  deno run --allow-read --allow-write cli.ts schema.json docs/ output.json --verbose

  # With custom template
  deno run --allow-read --allow-write cli.ts schema.json docs/ output.json --template template.json

  # Advanced debug logging (optional --allow-env)
  deno run --allow-read --allow-write --allow-env cli.ts schema.json docs/ output.json

DESCRIPTION:
  Extracts frontmatter from Markdown files, validates against schema,
  and generates aggregated JSON output with template variable resolution.

  Features:
  - Schema-based validation and default value population
  - Template variable resolution ({version}, {description}, etc.)
  - Derived field processing (x-derived-from schema extensions)
  - Directory and glob pattern support
  - Comprehensive error handling with detailed messages
  - YAML and JSON output formats

TROUBLESHOOTING:
  • Permission errors: Ensure all required permissions are granted
  • File not found: Check paths and use absolute paths if needed
  • Pattern issues: Use quotes around glob patterns: "**/*.md"
  • For more help: Run with --verbose for detailed logging
`;
    const logResult = this.logger.output(helpText);
    if (!logResult.ok) {
      // Fallback to console.log if logger fails
      console.log(helpText);
    }
  }

  private showVersion(): void {
    const versionText = "frontmatter-to-schema version 1.0.0";
    const logResult = this.logger.output(versionText);
    if (!logResult.ok) {
      // Fallback to console.log if logger fails
      console.log(versionText);
    }
  }

  private showUsage(): void {
    const usageText =
      "Usage: frontmatter-to-schema <schema> <pattern> <output>\nUse --help for detailed information";
    const logResult = this.logger.output(usageText);
    if (!logResult.ok) {
      // Fallback to console.log if logger fails
      console.log("Usage: frontmatter-to-schema <schema> <pattern> <output>");
      console.log("Use --help for detailed information");
    }
  }

  private async executeCommand(
    schemaPath: string,
    inputPattern: string,
    outputPath: string,
    verbose: boolean = false,
    templatePath?: string,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Recreate orchestrator and logger with proper verbose configuration if needed
    if (verbose) {
      const loggerResult = DebugLoggerFactory.createEnhancedForCLI(verbose);
      if (!loggerResult.ok) {
        return Promise.resolve(err(createError({
          kind: "ConfigurationError",
          message: "Failed to create verbose logger",
        })));
      }

      // Recreate services with verbose logger
      const pathExpansionResult = PathExpansionService.create();
      if (!pathExpansionResult.ok) {
        return Promise.resolve(err(createError({
          kind: "ConfigurationError",
          message: "Failed to create path expansion service",
        })));
      }

      const errorMessageResult = CLIErrorMessageService.create(
        this.supportedFormats,
      );
      if (!errorMessageResult.ok) {
        return Promise.resolve(err(createError({
          kind: "ConfigurationError",
          message: "Failed to create error message service",
        })));
      }

      const promptGeneratorResult = PromptGeneratorService.create();
      if (!promptGeneratorResult.ok) {
        return Promise.resolve(err(createError({
          kind: "ConfigurationError",
          message: "Failed to create prompt generator service",
        })));
      }

      const orchestratorResult = CLI.createOrchestrator(loggerResult.data);
      if (!orchestratorResult.ok) {
        return Promise.resolve(err(createError(orchestratorResult.error)));
      }

      this.orchestrator = orchestratorResult.data;
      this.logger = loggerResult.data;
      this.pathExpansionService = pathExpansionResult.data;
      this.errorMessageService = errorMessageResult.data;
      this.promptGeneratorService = promptGeneratorResult.data;
    }

    // Create discriminated union configurations following Totality principles
    const templateConfig: TemplateConfig = templatePath
      ? { kind: "explicit", templatePath: templatePath }
      : { kind: "schema-derived" };
    const verbosityConfig: VerbosityConfig = verbose
      ? { kind: "verbose", enabled: true }
      : { kind: "quiet", enabled: false };

    const config: PipelineConfig = {
      schemaPath,
      outputPath,
      inputPattern,
      templateConfig,
      verbosityConfig,
    };

    // Use proper logging instead of hardcoded verbose conditionals
    const _infoResult = this.logger.info(
      "Starting pipeline with configuration",
      {
        operation: "pipeline-start",
        timestamp: new Date().toISOString(),
        inputs: JSON.stringify({ schemaPath, outputPath, inputPattern }),
      },
    );
    // Note: info logs are filtered by output mode, no fallback needed

    const result = await this.orchestrator.execute(config);
    if (!result.ok) {
      const errorResult = this.logger.errorOutput(result.error.message);
      if (!errorResult.ok) {
        // Fallback to console.error if logger fails
        console.error(`Error: ${result.error.message}`);
      }
      return result;
    }

    const successMessage =
      `Processing completed successfully. Output written to: ${outputPath}`;
    const outputResult = this.logger.output(successMessage);
    if (!outputResult.ok) {
      // Fallback to console.log if logger fails
      console.log(successMessage);
    }
    return ok(void 0);
  }
}
