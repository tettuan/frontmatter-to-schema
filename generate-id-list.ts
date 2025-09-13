#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { GenerateIdListUseCase } from "./src/application/use-cases/generate-id-list.ts";
import { FrontmatterProcessor } from "./src/domain/frontmatter/processors/frontmatter-processor.ts";
import { IdListGenerator } from "./src/domain/command/index.ts";
import {
  DenoFileLister,
  DenoFileReader,
  DenoFileWriter,
  JsonFrontmatterParser,
  YamlFrontmatterExtractor,
} from "./src/infrastructure/index.ts";

interface CliOptions {
  sourceDirectory: string;
  outputPath?: string;
  format?: "json" | "text";
  help?: boolean;
  version?: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    sourceDirectory: "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-v") {
      options.version = true;
    } else if (arg === "--output" || arg === "-o") {
      options.outputPath = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      const format = args[++i];
      if (format === "json" || format === "text") {
        options.format = format;
      } else {
        throw new Error(`Invalid format: ${format}. Use 'json' or 'text'.`);
      }
    } else if (!arg.startsWith("-")) {
      if (!options.sourceDirectory) {
        options.sourceDirectory = arg;
      }
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
generate-id-list - Generate command ID lists from frontmatter

USAGE:
  generate-id-list <source-directory> [options]

ARGUMENTS:
  <source-directory>  Path to directory containing markdown files

OPTIONS:
  -o, --output <path>    Output file path (default: <source-dir>/id-list.[format])
  -f, --format <format>  Output format: json or text (default: json)
  -h, --help             Show this help message
  -v, --version          Show version information

EXAMPLES:
  generate-id-list .agent/test-climpt/prompts
  generate-id-list .agent/test-climpt/prompts --output id-list.json
  generate-id-list .agent/test-climpt/prompts --format text --output ids.txt

DESCRIPTION:
  Extracts c1, c2, c3 values from frontmatter in markdown files and generates
  a sorted list of unique command IDs in the format: c1:c2:c3

  Features:
  - Processes all .md files in the specified directory
  - Generates unique, sorted command ID lists
  - Supports both JSON and text output formats
  - Provides statistics about command categories
  - Comprehensive error handling for invalid files
`);
}

function showVersion(): void {
  console.log("generate-id-list version 1.0.0");
}

function main() {
  try {
    const args = Deno.args;
    const options = parseArgs(args);

    if (options.help) {
      showHelp();
      return;
    }

    if (options.version) {
      showVersion();
      return;
    }

    if (!options.sourceDirectory) {
      console.error("Error: Source directory is required");
      console.error("Use --help for usage information");
      Deno.exit(1);
    }

    // Initialize dependencies
    const fileReader = new DenoFileReader();
    const fileWriter = new DenoFileWriter();
    const fileLister = new DenoFileLister();

    const frontmatterExtractor = new YamlFrontmatterExtractor();
    const frontmatterParser = new JsonFrontmatterParser();
    const frontmatterProcessor = new FrontmatterProcessor(
      frontmatterExtractor,
      frontmatterParser,
    );

    const idListGenerator = new IdListGenerator();

    const useCase = new GenerateIdListUseCase(
      frontmatterProcessor,
      idListGenerator,
      fileReader,
      fileWriter,
      fileLister,
    );

    // Execute use case
    const result = useCase.execute({
      sourceDirectory: options.sourceDirectory,
      outputPath: options.outputPath,
      outputFormat: options.format || "json",
    });

    if (!result.ok) {
      console.error(`Error: ${result.error.message}`);
      Deno.exit(1);
    }

    const { result: idListResult, outputPath, format } = result.data;

    console.log(`
ID list generation completed successfully!

📊 Results:
  Total files processed: ${idListResult.total_files}
  Unique command IDs: ${idListResult.statistics.unique_ids}
  Output format: ${format}
  Output written to: ${outputPath}

📈 Statistics:
  C1 categories (${idListResult.statistics.c1_categories.length}): ${
      idListResult.statistics.c1_categories.join(", ")
    }
  C2 actions (${idListResult.statistics.c2_actions.length}): ${
      idListResult.statistics.c2_actions.join(", ")
    }
  C3 targets (${idListResult.statistics.c3_targets.length}): ${
      idListResult.statistics.c3_targets.join(", ")
    }
`);
  } catch (error) {
    console.error(
      "Unexpected error:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
