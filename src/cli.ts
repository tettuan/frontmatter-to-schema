/**
 * CLI Entry Point - Forwards to the actual CLI implementation
 * The real implementation is in src/application/cli.ts
 */
import { CLI } from "./application/cli.ts";

// Main entry point
if (import.meta.main) {
  const cliResult = CLI.create();
  if (!cliResult.ok) {
    console.error("Failed to initialize CLI:", cliResult.error.message);
    Deno.exit(1);
  }

  const result = await cliResult.data.run(Deno.args);
  if (!result.ok) {
    console.error("Processing failed:", JSON.stringify(result.error, null, 2));
    Deno.exit(1);
  }
}
