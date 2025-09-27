#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { CLI } from "./mod.ts";

async function main() {
  const cliResult = await CLI.create();
  if (!cliResult.ok) {
    console.error(`Failed to initialize CLI`);
    Deno.exit(1);
  }

  const cli = cliResult.data;
  const args = Deno.args;

  const cliArgs = {
    schema: args[0] || "",
    input: args[1] || "",
    output: args[2],
  };

  const result = await cli.processCommand(cliArgs);

  if (!result.ok) {
    const errorMessage =
      "message" in result.error && typeof result.error.message === "string"
        ? result.error.message
        : "kind" in result.error && typeof result.error.kind === "string"
        ? result.error.kind
        : "Unknown error";
    console.error(`CLI Error: ${errorMessage}`);
    Deno.exit(1);
  }

  Deno.exit(0);
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error("Unexpected error:", error);
    Deno.exit(1);
  }
}
