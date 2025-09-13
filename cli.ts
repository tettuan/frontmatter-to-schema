#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

import { CLI } from "./mod.ts";

function main() {
  const cli = new CLI();
  const args = Deno.args;

  const result = cli.run(args);

  if (!result.ok) {
    console.error(`CLI Error: ${result.error.message}`);
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
