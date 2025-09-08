#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

/**
 * CLI Entry Point for frontmatter-to-schema
 *
 * Main executable for the frontmatter-to-schema command.
 * Implements the CLI specification from schema_process_architecture.ja.md.
 */

import { CLIArgumentParser } from "./presentation/cli-arguments.ts";
import { ProcessDocumentsUseCase } from "./application/process-documents-usecase.ts";
import { DenoFileSystemRepository } from "./infrastructure/adapters/deno-file-system-repository.ts";
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
      // Create file system repository
      const fileSystemRepo = new DenoFileSystemRepository();

      // Create and execute the use case
      const useCase = new ProcessDocumentsUseCase(
        fileSystemRepo,
        {
          verbose: cliArgs.options.verbose,
          dryRun: cliArgs.options.dryRun,
          parallel: cliArgs.options.parallel,
          maxWorkers: cliArgs.options.maxWorkers,
        },
      );

      const result = await useCase.execute({
        schemaPath: cliArgs.schemaPath.toString(),
        outputPath: cliArgs.outputPath.toString(),
        inputPattern: cliArgs.inputPattern.toGlob(),
        outputFormat: cliArgs.outputPath.getFormat(),
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
          `✅ Successfully processed ${result.data.processedCount} files`,
        );
        if (result.data.warnings && result.data.warnings.length > 0) {
          console.warn(`⚠️  ${result.data.warnings.length} warnings:}`);
          if (cliArgs.options.verbose) {
            for (const warning of result.data.warnings) {
              console.warn(`  - ${warning}`);
            }
          }
        }
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
