import {
  PipelineConfig,
  PipelineOrchestrator,
  TemplateConfig,
  VerbosityConfig,
} from "../../application/services/pipeline-orchestrator.ts";
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
import { DebugLogger } from "../../domain/shared/services/debug-logger.ts";
import { DebugLoggerFactory } from "../../infrastructure/logging/debug-logger-factory.ts";
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
  private logger: DebugLogger;

  private constructor(orchestrator: PipelineOrchestrator, logger: DebugLogger) {
    this.orchestrator = orchestrator;
    this.logger = logger;
  }

  static create(): Result<CLI, DomainError> {
    // Create default null logger for non-verbose mode
    const loggerResult = DebugLoggerFactory.createFromEnvironment(false);
    if (!loggerResult.ok) {
      return err(createError({
        kind: "ConfigurationError",
        message: "Failed to create logger",
      }));
    }

    const orchestratorResult = CLI.createOrchestrator(loggerResult.data);
    if (!orchestratorResult.ok) {
      return err(orchestratorResult.error);
    }
    return ok(new CLI(orchestratorResult.data, loggerResult.data));
  }

  private static createOrchestrator(
    logger: DebugLogger,
  ): Result<PipelineOrchestrator, DomainError> {
    const fileReader = new DenoFileReader();
    const fileWriter = new DenoFileWriter();
    const fileLister = new DenoFileLister();
    const schemaRepository = new FileSystemSchemaRepository();

    const frontmatterExtractor = new YamlFrontmatterExtractor();
    const frontmatterParser = new JsonFrontmatterParser();
    const frontmatterProcessor = new FrontmatterProcessor(
      frontmatterExtractor,
      frontmatterParser,
    );

    const aggregator = new Aggregator();
    const basePropertyPopulator = new BasePropertyPopulator();

    const documentProcessor = new FrontmatterTransformationService(
      frontmatterProcessor,
      aggregator,
      basePropertyPopulator,
      fileReader,
      fileLister,
    );

    // Create JMESPath Filter Service
    const jmespathFilterServiceResult = JMESPathFilterService.create();
    if (!jmespathFilterServiceResult.ok) {
      return err(createError({
        kind: "RenderFailed",
        message: "Failed to create JMESPath Filter Service",
      }));
    }

    const schemaProcessor = new SchemaProcessingService(
      schemaRepository,
      basePropertyPopulator,
      jmespathFilterServiceResult.data,
    );

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

    // Create file system adapter
    const fileSystem = {
      read: (path: string) => fileReader.read(path),
      write: (path: string, content: string) => fileWriter.write(path, content),
      list: (pattern: string) => fileLister.list(pattern),
    };

    return ok(
      new PipelineOrchestrator(
        documentProcessor,
        schemaProcessor,
        outputRenderingService,
        templatePathResolver,
        fileSystem,
        logger,
      ),
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

    // Extract verbose flag
    const verbose = args.includes("--verbose");
    const filteredArgs = args.filter((arg) => arg !== "--verbose");

    // Argument validation
    if (filteredArgs.length < 3) {
      console.error("Error: Missing required arguments");
      this.showUsage();
      return Promise.resolve(err(createError({
        kind: "MissingRequired",
        field: "arguments",
      })));
    }

    const [schemaPath, inputPattern, outputPath] = filteredArgs;

    // Execute command - this is async and contains await
    return await this.executeCommand(
      schemaPath,
      inputPattern,
      outputPath,
      verbose,
    );
  }

  private showHelp(): void {
    console.log(`
frontmatter-to-schema - Generate JSON from Markdown frontmatter

USAGE:
  frontmatter-to-schema <schema> <pattern> <output>

ARGUMENTS:
  <schema>   Path to JSON schema file (e.g., schema.json)
  <pattern>  Glob pattern for input Markdown files (e.g., "**/*.md")
  <output>   Output file path for generated JSON (e.g., output.json)

OPTIONS:
  -h, --help     Show this help message
  -v, --version  Show version information
  --verbose      Enable verbose logging

EXAMPLES:
  frontmatter-to-schema schema.json output.json "docs/**/*.md"
  frontmatter-to-schema ./config/schema.json ./dist/data.json "*.md"

DESCRIPTION:
  Extracts frontmatter from Markdown files, validates against schema,
  and generates aggregated JSON output with template variable resolution.

  Features:
  - Schema-based validation and default value population
  - Template variable resolution ({version}, {description}, etc.)
  - Derived field processing (x-derived-from schema extensions)
  - Comprehensive error handling with detailed messages
`);
  }

  private showVersion(): void {
    console.log("frontmatter-to-schema version 1.0.0");
  }

  private showUsage(): void {
    console.log("Usage: frontmatter-to-schema <schema> <pattern> <output>");
    console.log("Use --help for detailed information");
  }

  private async executeCommand(
    schemaPath: string,
    inputPattern: string,
    outputPath: string,
    verbose: boolean = false,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Recreate orchestrator and logger with proper verbose configuration if needed
    if (verbose) {
      const loggerResult = DebugLoggerFactory.createFromEnvironment(verbose);
      if (!loggerResult.ok) {
        return Promise.resolve(err(createError({
          kind: "ConfigurationError",
          message: "Failed to create verbose logger",
        })));
      }

      const orchestratorResult = CLI.createOrchestrator(loggerResult.data);
      if (!orchestratorResult.ok) {
        return Promise.resolve(err(createError(orchestratorResult.error)));
      }
      this.orchestrator = orchestratorResult.data;
      this.logger = loggerResult.data;
    }

    // Create discriminated union configurations following Totality principles
    const templateConfig: TemplateConfig = { kind: "schema-derived" };
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
    this.logger.info("Starting pipeline with configuration", {
      operation: "pipeline-start",
      timestamp: new Date().toISOString(),
      inputs: JSON.stringify({ schemaPath, outputPath, inputPattern }),
    });

    const result = await this.orchestrator.execute(config);
    if (!result.ok) {
      console.error(`Error: ${result.error.message}`);
      return result;
    }

    console.log(
      `Processing completed successfully. Output written to: ${outputPath}`,
    );
    return ok(void 0);
  }
}
