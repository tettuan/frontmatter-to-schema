#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run

/**
 * CLI entry point for frontmatter-to-schema
 *
 * This file enables direct execution via:
 * - deno run jsr:@aidevtool/frontmatter-to-schema --help
 * - deno install -g jsr:@aidevtool/frontmatter-to-schema
 *
 * @module
 */

import { CLI } from "./presentation/cli/index.ts";

async function main(): Promise<void> {
  const cliResult = CLI.create();
  if (!cliResult.ok || !cliResult.data) {
    console.error(
      `Failed to initialize CLI: ${
        cliResult.error?.message ?? "Unknown error"
      }`,
    );
    Deno.exit(1);
  }

  const cli = cliResult.data;
  const result = await cli.run(Deno.args);

  if (!result.ok) {
    console.error(`Error: ${result.error?.message ?? "Unknown error"}`);
    Deno.exit(1);
  }

  Deno.exit(0);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(
      "Unexpected error:",
      error instanceof Error ? error.message : error,
    );
    Deno.exit(1);
  }
}
