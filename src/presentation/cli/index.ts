import { ProcessingError } from "../../domain/shared/types/errors.ts";
import {
  PipelineConfig,
  PipelineOrchestrator,
} from "../../application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../infrastructure/adapters/deno-file-system-adapter.ts";
import { DIRECTIVE_NAMES } from "../../domain/schema/constants/directive-names.ts";
import denoConfig from "../../../deno.json" with { type: "json" };
import { dirname, isAbsolute, join } from "@std/path";
import { resolveInputToFiles } from "../../infrastructure/utils/input-resolver.ts";

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
    const fileSystem = DenoFileSystemAdapter.create();
    const orchestratorResult = PipelineOrchestrator.create(fileSystem);
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

      // Check for explicit commands first
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
      }

      // Check for direct invocation pattern (schema as first argument)
      // If first arg looks like a file path (ends with .json or .yaml),
      // assume direct invocation pattern
      if (this.looksLikeFilePath(command)) {
        return await this.processDirectInvocation(args);
      }

      // If we get here, it's an unknown command
      return {
        ok: false,
        error: new ProcessingError(
          `Unknown command: ${command}`,
          "UNKNOWN_COMMAND",
          { command, availableCommands: ["process", "help", "version"] },
        ),
      };
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

  private looksLikeFilePath(arg: string): boolean {
    return arg.endsWith(".json") || arg.endsWith(".yaml") ||
      arg.endsWith(".yml");
  }

  private async processDirectInvocation(args: string[]): Promise<CLIResponse> {
    // Direct invocation expects: <schema> <output> <input...> [--verbose]
    // This order allows shell glob expansion to work correctly
    if (args.length < 3) {
      return {
        ok: false,
        error: new ProcessingError(
          "Insufficient arguments. Usage: <schema> <output> <input...> [--verbose]",
          "INVALID_ARGUMENTS",
          { args },
        ),
      };
    }

    // Parse arguments from end to beginning to handle glob expansion
    const hasVerbose = args[args.length - 1] === "--verbose";
    const options = hasVerbose ? ["--verbose"] : [];
    const endIndex = hasVerbose ? args.length - 1 : args.length;

    const schemaPath = args[0];
    const outputPath = args[1];
    const inputPaths = args.slice(2, endIndex);

    // Try to extract template from schema's x-template directive
    const templatePath = await this.extractTemplateFromSchema(schemaPath);
    if (!templatePath) {
      return {
        ok: false,
        error: new ProcessingError(
          "Schema does not contain x-template directive. Use 'process' command to specify template explicitly.",
          "MISSING_TEMPLATE",
          { schemaPath },
        ),
      };
    }

    // Determine output format from output file extension or options
    let outputFormat: "json" | "yaml" | "xml" | "markdown" = "json";
    if (outputPath.endsWith(".yaml") || outputPath.endsWith(".yml")) {
      outputFormat = "yaml";
    } else if (outputPath.endsWith(".xml")) {
      outputFormat = "xml";
    } else if (outputPath.endsWith(".md") || outputPath.endsWith(".markdown")) {
      outputFormat = "markdown";
    }

    // Resolve all input paths to actual markdown files
    // This handles glob patterns, directories (recursive), and individual files
    const resolvedFiles = await resolveInputToFiles(inputPaths);

    if (resolvedFiles.length === 0) {
      return {
        ok: false,
        error: new ProcessingError(
          "No markdown files found matching the input patterns",
          "NO_FILES_FOUND",
          { inputPaths },
        ),
      };
    }

    const config: PipelineConfig = {
      schemaPath,
      templatePath,
      inputPath: resolvedFiles,
      outputPath,
      outputFormat,
    };

    const result = await this.orchestrator.execute(config);

    if (result.isError()) {
      return {
        ok: false,
        error: result.unwrapError(),
      };
    }

    const pipelineResult = result.unwrap();

    // Only log if --verbose flag is present
    if (options.includes("--verbose")) {
      console.log(
        `✅ Processed ${pipelineResult.processedDocuments} documents`,
      );
      console.log(`📄 Output written to: ${pipelineResult.outputPath}`);
      console.log(
        `⏱️  Execution time: ${pipelineResult.executionTime.toFixed(2)}ms`,
      );
    }

    return {
      ok: true,
      data: pipelineResult,
    };
  }

  private async extractTemplateFromSchema(
    schemaPath: string,
  ): Promise<string | null> {
    try {
      const schemaContent = await Deno.readTextFile(schemaPath);
      const schema = JSON.parse(schemaContent);

      if (schema[DIRECTIVE_NAMES.TEMPLATE]) {
        // If x-template is a relative path, resolve it relative to the schema directory
        const templatePath = schema[DIRECTIVE_NAMES.TEMPLATE];
        if (!isAbsolute(templatePath)) {
          // Relative path - resolve relative to schema directory using cross-platform path utilities
          const schemaDir = dirname(schemaPath);
          return join(schemaDir, templatePath);
        }
        return templatePath;
      }

      return null;
    } catch (_error) {
      // If we can't read or parse the schema, return null
      return null;
    }
  }

  private async processCommand(args: string[]): Promise<CLIResponse> {
    const config = this.parseProcessArgs(args);
    if (!config.ok) {
      return config;
    }

    let pipelineConfig = config.data as PipelineConfig;

    // Resolve input path to actual files if it's a single string
    // This handles directories and glob patterns
    if (typeof pipelineConfig.inputPath === "string") {
      const resolvedFiles = await resolveInputToFiles([
        pipelineConfig.inputPath,
      ]);

      if (resolvedFiles.length === 0) {
        return {
          ok: false,
          error: new ProcessingError(
            "No markdown files found matching the input pattern",
            "NO_FILES_FOUND",
            { inputPath: pipelineConfig.inputPath },
          ),
        };
      }

      pipelineConfig = {
        ...pipelineConfig,
        inputPath: resolvedFiles,
      };
    }

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
      outputFormat: (outputFormat as "json" | "yaml" | "xml" | "markdown") ||
        "json",
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
    frontmatter-to-schema <schema> <input> <output> [--verbose]

COMMANDS:
    process <schema> <template> <input> <output> [format]
        Process markdown files with explicit schema and template

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

DIRECT INVOCATION:
    When schema contains x-template directive:
        <schema> <output> <input...> [--verbose]

        Arguments:
            schema      Path to JSON schema with x-template
            output      Path for output file
            input...    Path(s) to markdown file(s) or directory or glob pattern
            --verbose   Show processing details

        Note: Input is specified AFTER output to allow shell glob expansion.
              The shell will expand patterns like *.md before passing to CLI.

EXAMPLES:
    # Process with explicit template
    frontmatter-to-schema process schema.json template.json article.md output.json

    # Direct invocation (schema has x-template) - single file
    frontmatter-to-schema schema.json output.json article.md --verbose

    # Direct invocation with glob pattern (shell expands *.md)
    frontmatter-to-schema schema.json output.json *.md --verbose

    # Direct invocation with directory
    frontmatter-to-schema schema.json output.json ./docs/ --verbose

    # Process directory with YAML output
    frontmatter-to-schema process schema.json template.json ./docs/ output.yaml yaml

    # Show help
    frontmatter-to-schema help
`;

    console.log(helpText);
    return { ok: true, data: helpText };
  }

  private showVersion(): CLIResponse {
    const version = denoConfig.version;
    const versionInfo = `frontmatter-to-schema ${version}`;

    console.log(versionInfo);
    return { ok: true, data: version };
  }
}
