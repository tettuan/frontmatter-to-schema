#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run

/**
 * CLI Entry Point for frontmatter-to-schema
 *
 * Usage:
 * frontmatter-to-schema <markdownfile_root_dir> --schema=<schema_json_file> --template=<template_file> [--destination=<saving_to_this_dir>]
 *
 * Options:
 * - markdownfile_root_dir: Path to markdown files directory
 * - --schema: Path to schema file (JSON or YAML)
 * - --template: Path to template file (any format)
 * - --destination: Output directory (optional, defaults to markdownfile_root_dir)
 */

import { type Logger, LoggerFactory } from "./src/domain/shared/logger.ts";
import { CLI } from "./src/application/cli.ts";

// Configure logger for CLI usage (not production mode)
LoggerFactory.configure({
  environment: "development",
  logLevel: "info",
});

// Create global CLI logger
const cliLogger: Logger = LoggerFactory.createLogger("CLI");

export function printUsage() {
  cliLogger.info(`
frontmatter-to-schema - Extract and transform markdown frontmatter using AI

Usage:
  frontmatter-to-schema <input-dir> --schema=<schema-file> --output=<output-file> [options]
  frontmatter-to-schema <schema-file> <output-file> <input-pattern> [options]  (deprecated)

Options:
  --schema <path>      Path to schema definition file (JSON/YAML)
  --output <path>      Output file path
  --template <path>    Path to template file (default: ./templates/default.json)
  --destination <dir>  Output directory (default: current directory)
  --verbose            Enable verbose logging
  --help, -h           Show this help message
  --version, -V        Show version

Examples:
  # New format (recommended)
  frontmatter-to-schema ./docs --schema=./schema.json --output=./output.json

  # Legacy format (deprecated)
  frontmatter-to-schema ./schema.json ./output.json "./docs/*.md"

  # With template
  frontmatter-to-schema ./docs --schema=./schema.json --output=./output.yaml --template=./template.yaml

  # Verbose mode
  frontmatter-to-schema ./docs --schema=./schema.json --output=./output.json --verbose

For more information, visit: https://github.com/your-repo/frontmatter-to-schema
`);
}

function _getVersionInfo() {
  return {
    projectVersion: "1.0.0",
    projectName: "frontmatter-to-schema",
  };
}

export async function main() {
  try {
    // Check for verbose mode early to configure logging
    const hasVerbose = Deno.args.includes("--verbose") ||
      Deno.args.includes("-v");
    if (hasVerbose) {
      LoggerFactory.configure({
        environment: "development",
        logLevel: "debug",
      });
      cliLogger.debug("Verbose mode enabled");
    }

    // Show help if requested
    if (Deno.args.includes("--help") || Deno.args.includes("-h")) {
      printUsage();
      Deno.exit(0);
    }

    // Log startup
    cliLogger.info("Starting frontmatter-to-schema processing...");

    // FIXED: Route through the new CLI implementation that uses DocumentProcessor
    // This ensures template processing is properly executed (fixes issue #613)
    const cli = new CLI();
    const result = await cli.run(Deno.args);

    if (!result.ok) {
      cliLogger.error(`🚨 Processing failed: ${result.error.kind}`);

      // Provide more detailed error information
      if ("message" in result.error && result.error.message) {
        cliLogger.error(`   Details: ${result.error.message}`);
      }
      if ("input" in result.error) {
        cliLogger.error(`   Input: ${String(result.error.input)}`);
      }
      if ("expectedFormat" in result.error) {
        cliLogger.error(`   Expected: ${String(result.error.expectedFormat)}`);
      }

      cliLogger.info("\nFor help, run: frontmatter-to-schema --help");
      Deno.exit(1);
    }

    // Success - log completion
    cliLogger.info("✅ Processing completed successfully");
    Deno.exit(0);
  } catch (error) {
    cliLogger.error(
      `🚨 Unexpected error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
