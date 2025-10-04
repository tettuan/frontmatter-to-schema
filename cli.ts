#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env --config=deno.json

import { CLI } from "./mod.ts";

async function main() {
  const cliResult = CLI.create();
  if (!cliResult.ok || !cliResult.data) {
    const errorMessage = cliResult.error?.message || "Failed to initialize CLI";
    console.error(`❌ ${errorMessage}`);
    Deno.exit(1);
  }

  const cli = cliResult.data;
  const args = Deno.args;

  const result = await cli.run(args);

  if (!result.ok) {
    const errorMessage = result.error?.message || "Unknown error";
    console.error(`❌ ${errorMessage}`);
    Deno.exit(1);
  }

  Deno.exit(0);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error("💥 Unexpected error:", error);
    Deno.exit(1);
  }
}
