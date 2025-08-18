#!/usr/bin/env deno run --allow-read --allow-write

import { discoverPromptFiles } from "./src/file-discovery.ts";

console.log("Testing file discovery...");

try {
  const promptFiles = await discoverPromptFiles(".agent/climpt/prompts");
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
