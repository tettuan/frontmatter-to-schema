import {
  PipelineConfig,
  PipelineOrchestrator,
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

  private constructor(orchestrator: PipelineOrchestrator) {
    this.orchestrator = orchestrator;
  }

  static create(): Result<CLI, DomainError> {
    const orchestratorResult = CLI.createOrchestrator(false);
    if (!orchestratorResult.ok) {
      return err(orchestratorResult.error);
    }
    return ok(new CLI(orchestratorResult.data));
  }

  private static createOrchestrator(
    verbose: boolean,
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

    // Create TemplateRenderer with verbose flag
    const templateRendererResult = TemplateRenderer.create(undefined, verbose);
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

    const [schemaPath, outputPath, inputPattern] = filteredArgs;

    // Execute command - this is async and contains await
    return await this.executeCommand(
      schemaPath,
      outputPath,
      inputPattern,
      verbose,
    );
  }

  private showHelp(): void {
    console.log(`
frontmatter-to-schema - Generate JSON from Markdown frontmatter

USAGE:
  frontmatter-to-schema <schema> <output> <pattern>

ARGUMENTS:
  <schema>   Path to JSON schema file (e.g., schema.json)
  <output>   Output file path for generated JSON (e.g., output.json)
  <pattern>  Glob pattern for input Markdown files (e.g., "**/*.md")

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
    console.log("Usage: frontmatter-to-schema <schema> <output> <pattern>");
    console.log("Use --help for detailed information");
  }

  private async executeCommand(
    schemaPath: string,
    outputPath: string,
    inputPattern: string,
    verbose: boolean = false,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Recreate orchestrator with verbose flag if needed
    if (verbose) {
      const orchestratorResult = CLI.createOrchestrator(verbose);
      if (!orchestratorResult.ok) {
        return Promise.resolve(err(createError(orchestratorResult.error)));
      }
      this.orchestrator = orchestratorResult.data;
    }

    const config: PipelineConfig = {
      schemaPath,
      outputPath,
      inputPattern,
      verbose,
    };

    if (verbose) {
      console.log("[VERBOSE] Starting pipeline with configuration:");
      console.log("[VERBOSE]   Schema: " + schemaPath);
      console.log("[VERBOSE]   Output: " + outputPath);
      console.log("[VERBOSE]   Pattern: " + inputPattern);
    }

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
