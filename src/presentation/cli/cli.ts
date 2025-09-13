import { ProcessDocumentsUseCase } from "../../application/index.ts";
import { ProcessCoordinator } from "../../application/coordinators/process-coordinator.ts";
import { FrontmatterProcessor } from "../../domain/frontmatter/processors/frontmatter-processor.ts";
import { TemplateRenderer } from "../../domain/template/renderers/template-renderer.ts";
import { Aggregator } from "../../domain/aggregation/aggregators/aggregator.ts";
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
  private readonly useCase: ProcessDocumentsUseCase;

  constructor() {
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

    const templateRenderer = new TemplateRenderer();
    const aggregator = new Aggregator();

    const coordinator = new ProcessCoordinator(
      schemaRepository,
      frontmatterProcessor,
      templateRenderer,
      aggregator,
      fileReader,
      fileWriter,
      fileLister,
    );

    this.useCase = new ProcessDocumentsUseCase(coordinator);
  }

  run(args: string[]): Result<void, DomainError & { message: string }> {
    // Help display
    if (args.includes("--help") || args.includes("-h")) {
      this.showHelp();
      return ok(void 0);
    }

    // Version display
    if (args.includes("--version") || args.includes("-v")) {
      this.showVersion();
      return ok(void 0);
    }

    // Argument validation
    if (args.length < 3) {
      console.error("Error: Missing required arguments");
      this.showUsage();
      return err(createError({
        kind: "MissingRequired",
        field: "arguments",
      }));
    }

    const [schemaPath, outputPath, inputPattern] = args;

    // Execute command
    return this.executeCommand(schemaPath, outputPath, inputPattern);
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

  private executeCommand(
    schemaPath: string,
    outputPath: string,
    inputPattern: string,
  ): Result<void, DomainError & { message: string }> {
    const result = this.useCase.execute({
      schemaPath,
      outputPath,
      inputPattern,
    });

    if (!result.ok) {
      console.error(`Error: ${result.error.message}`);
      return result;
    }

    console.log(
      `Processing completed successfully. Output written to: ${result.data.outputPath}`,
    );
    return ok(void 0);
  }
}
