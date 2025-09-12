#!/usr/bin/env deno run --allow-read --allow-write

import { discoverPromptFiles } from "../../src/file-discovery.ts";

console.log("Testing file discovery...");

try {
  const result = await discoverPromptFiles(".agent/climpt/prompts");

  if (!result.ok) {
    console.error(`❌ Failed to discover files: ${result.error.kind}`);
    Deno.exit(1);
  }

  const promptFiles = result.data;
  console.log(`✅ Found ${promptFiles.length} prompt files`);

  for (const file of promptFiles.slice(0, 3)) {
    console.log(`📄 ${file.path}`);
    console.log(
      `   Command: ${file.commandStructure.c1}/${file.commandStructure.c2}/${file.commandStructure.c3}`,
    );
    console.log(
      `   Input: ${file.commandStructure.input}, Adaptation: ${
        file.commandStructure.adaptation || "none"
      }`,
    );
  }
} catch (error) {
  console.error(
    `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
  );
  Deno.exit(1);
}
