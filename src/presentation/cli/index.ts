import { ProcessingError } from "../../domain/shared/types/errors.ts";
import {
  PipelineConfig,
  PipelineOrchestrator,
} from "../../application/services/pipeline-orchestrator.ts";

export interface CLIResponse {
  ok: boolean;
  data?: unknown;
  error?: ProcessingError;
}

/**
 * Command-line interface for the frontmatter-to-schema tool.
 * Provides a simple interface to process markdown files with schemas and templates.
 */
export class CLI {
  private constructor(private readonly orchestrator: PipelineOrchestrator) {}

  static create(): { ok: boolean; data?: CLI; error?: ProcessingError } {
    const orchestratorResult = PipelineOrchestrator.create();
    if (orchestratorResult.isError()) {
      return {
        ok: false,
        error: new ProcessingError(
          `Failed to initialize pipeline: ${orchestratorResult.unwrapError().message}`,
          "INITIALIZATION_ERROR",
          { error: orchestratorResult.unwrapError() },
        ),
      };
    }

    return { ok: true, data: new CLI(orchestratorResult.unwrap()) };
  }

  async run(args: string[]): Promise<CLIResponse> {
    try {
      if (args.length === 0) {
        return this.showHelp();
      }

      const command = args[0];

      switch (command) {
        case "process":
          return await this.processCommand(args.slice(1));
        case "help":
        case "--help":
        case "-h":
          return this.showHelp();
        case "version":
        case "--version":
        case "-v":
          return this.showVersion();
        default:
          return {
            ok: false,
            error: new ProcessingError(
              `Unknown command: ${command}`,
              "UNKNOWN_COMMAND",
              { command, availableCommands: ["process", "help", "version"] },
            ),
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return {
        ok: false,
        error: new ProcessingError(
          `CLI execution failed: ${errorMessage}`,
          "CLI_ERROR",
          { args, error },
        ),
      };
    }
  }

  private async processCommand(args: string[]): Promise<CLIResponse> {
    const config = this.parseProcessArgs(args);
    if (!config.ok) {
      return config;
    }

    const pipelineConfig = config.data as PipelineConfig;
    const result = await this.orchestrator.execute(pipelineConfig);

    if (result.isError()) {
      return {
        ok: false,
        error: result.unwrapError(),
      };
    }

    const pipelineResult = result.unwrap();
    console.log(`✅ Processed ${pipelineResult.processedDocuments} documents`);
    console.log(`📄 Output written to: ${pipelineResult.outputPath}`);
    console.log(
      `⏱️  Execution time: ${pipelineResult.executionTime.toFixed(2)}ms`,
    );

    return {
      ok: true,
      data: pipelineResult,
    };
  }

  private parseProcessArgs(args: string[]): CLIResponse {
    if (args.length < 4) {
      return {
        ok: false,
        error: new ProcessingError(
          "Insufficient arguments. Usage: process <schema> <template> <input> <output> [format]",
          "INVALID_ARGUMENTS",
          { args },
        ),
      };
    }

    const [schemaPath, templatePath, inputPath, outputPath, outputFormat] =
      args;

    const config: PipelineConfig = {
      schemaPath,
      templatePath,
      inputPath,
      outputPath,
      outputFormat: (outputFormat as "json" | "yaml") || "json",
    };

    return {
      ok: true,
      data: config,
    };
  }

  private showHelp(): CLIResponse {
    const helpText = `
Frontmatter to Schema Processor

USAGE:
    frontmatter-to-schema <COMMAND> [OPTIONS]

COMMANDS:
    process <schema> <template> <input> <output> [format]
        Process markdown files with schema and template

        Arguments:
            schema      Path to JSON schema file
            template    Path to template file (JSON or YAML)
            input       Path to markdown file or directory
            output      Path for output file
            format      Output format: json or yaml (default: json)

    help, --help, -h
        Show this help message

    version, --version, -v
        Show version information

EXAMPLES:
    # Process single file
    frontmatter-to-schema process schema.json template.json article.md output.json

    # Process directory with YAML output
    frontmatter-to-schema process schema.json template.json ./docs/ output.yaml yaml

    # Show help
    frontmatter-to-schema help
`;

    console.log(helpText);
    return { ok: true, data: helpText };
  }

  private showVersion(): CLIResponse {
    const version = "1.0.0"; // In production, read from deno.json
    const versionInfo = `frontmatter-to-schema ${version}`;

    console.log(versionInfo);
    return { ok: true, data: version };
  }
}
