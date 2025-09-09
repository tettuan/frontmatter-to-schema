#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

/**
 * CLI Entry Point for frontmatter-to-schema
 *
 * Main executable for the frontmatter-to-schema command.
 * Implements the CLI specification from schema_process_architecture.ja.md.
 */

import { CLIArgumentParser } from "./presentation/cli-arguments.ts";
import { ProcessDocumentsOrchestrator } from "./application/orchestrators/process-documents.orchestrator.ts";
import { DenoFileSystemRepository } from "./infrastructure/adapters/deno-file-system-repository.ts";
import { ConsoleLogger } from "./domain/shared/logger.ts";
import { VERSION_CONFIG } from "./config/version.ts";

/**
 * Main CLI class
 */
export class CLI {
  /**
   * Run the CLI with given arguments
   */
  async run(args: string[]): Promise<void> {
    // Parse arguments
    const parseResult = CLIArgumentParser.parse(args);
    if (!parseResult.ok) {
      console.error(`Error: ${parseResult.error.message}`);
      console.error("\n" + CLIArgumentParser.getUsage());
      Deno.exit(1);
    }

    const cliArgs = parseResult.data;

    // Handle help
    if (cliArgs.options.help) {
      console.log(CLIArgumentParser.getHelp());
      return;
    }

    // Handle version
    if (cliArgs.options.version) {
      console.log(`frontmatter-to-schema v${VERSION_CONFIG.APP_VERSION}`);
      return;
    }

    // Set up logging based on options
    const _logLevel = cliArgs.options.quiet
      ? "error"
      : cliArgs.options.verbose
      ? "debug"
      : "info";

    if (!cliArgs.options.quiet) {
      console.log(`Processing files with schema: ${cliArgs.schemaPath}`);
      console.log(`Input pattern: ${cliArgs.inputPattern.toGlob()}`);
      console.log(
        `Output: ${cliArgs.outputPath} (${cliArgs.outputPath.getFormat()})`,
      );
      if (cliArgs.options.dryRun) {
        console.log("🔍 Dry-run mode - no files will be written");
      }
    }

    try {
      // Create file system repository and logger
      const fileSystemRepo = new DenoFileSystemRepository();
      const logger = new ConsoleLogger(
        "cli",
        cliArgs.options.quiet ? "error" : "info",
      );

      // Create and execute the orchestrator
      const orchestrator = new ProcessDocumentsOrchestrator(
        fileSystemRepo,
        logger,
      );

      const result = await orchestrator.execute({
        schemaPath: cliArgs.schemaPath.toString(),
        sourcePath: cliArgs.inputPattern.toGlob(),
        outputPath: cliArgs.outputPath.toString(),
        format: cliArgs.outputPath.getFormat() as "json" | "yaml" | "toml",
        dryRun: cliArgs.options.dryRun,
        verbose: cliArgs.options.verbose,
      });

      if (!result.ok) {
        console.error(`Processing failed: ${result.error.message}`);
        if (cliArgs.options.verbose && "details" in result.error) {
          console.error("Details:", result.error.details);
        }
        Deno.exit(1);
      }

      if (!cliArgs.options.quiet) {
        console.log(
          `✅ Successfully processed ${result.data.filesProcessed} files`,
        );
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      if (cliArgs.options.verbose && error instanceof Error) {
        console.error("Stack trace:", error.stack);
      }
      Deno.exit(1);
    }
  }
}

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  const cli = new CLI();
  try {
    await cli.run(Deno.args);
  } catch (error) {
    console.error("Fatal error:", error);
    Deno.exit(1);
  }
}

// Run if this is the main module
if (import.meta.main) {
  await main();
}
