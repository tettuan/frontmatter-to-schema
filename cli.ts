#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { CLI } from "./mod.ts";

function main() {
  const cliResult = CLI.create();
  if (!cliResult.ok || !cliResult.data) {
    console.error(`Failed to initialize CLI`);
    Deno.exit(1);
  }

  const cli = cliResult.data;
  const args = Deno.args;

  const result = cli.run(args);

  if (!result.ok) {
    const errorMessage = result.error && typeof result.error === "object" &&
      ("message" in result.error && typeof result.error.message === "string"
        ? result.error.message
        : "kind" in result.error && typeof result.error.kind === "string"
        ? result.error.kind
        : "Unknown error");
    console.error(`CLI Error: ${errorMessage || "Unknown error"}`);
    Deno.exit(1);
  }

  Deno.exit(0);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error("Unexpected error:", error);
    Deno.exit(1);
  }
}
