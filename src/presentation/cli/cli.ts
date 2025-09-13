import { ProcessDocumentsUseCase } from "../../application/index.ts";
import { ProcessCoordinator } from "../../application/coordinators/process-coordinator.ts";
import { FrontmatterProcessor } from "../../domain/frontmatter/processors/frontmatter-processor.ts";
import { TemplateRenderer } from "../../domain/template/renderers/template-renderer.ts";
import { Aggregator } from "../../domain/aggregation/aggregators/aggregator.ts";
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

  run(args: string[]): number {
    if (args.length < 3) {
      console.error("Usage: frontmatter-to-schema <schema> <output> <pattern>");
      return 1;
    }

    const [schemaPath, outputPath, inputPattern] = args;

    const result = this.useCase.execute({
      schemaPath,
      outputPath,
      inputPattern,
    });

    if (!result.ok) {
      console.error(`Error: ${result.error.message}`);
      return 1;
    }

    console.log(
      `Processing completed successfully. Output written to: ${result.data.outputPath}`,
    );
    return 0;
  }
}
