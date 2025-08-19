#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { CLI } from "./application/cli.ts";

if (import.meta.main) {
  const cli = new CLI();
  await cli.run(Deno.args);
}