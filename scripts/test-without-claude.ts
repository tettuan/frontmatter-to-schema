#!/usr/bin/env -S deno run --allow-read --allow-write

import {
  FileReader,
  FileWriter,
} from "../src/infrastructure/filesystem/file-system.ts";
import { FrontMatterExtractor } from "../src/domain/frontmatter/frontmatter-models.ts";
import { RegistryAggregator } from "../src/application/services/RegistryAggregator.ts";
import { AnalysisResult } from "../src/domain/analysis/AnalysisResult.ts";
import type { Command } from "../src/domain/core/registry-types.ts";

async function testWithoutClaude() {
  const PROMPTS_PATH = ".agent/climpt/prompts";
  const OUTPUT_PATH = ".agent/climpt/test-registry.json";

  console.log("Testing without Claude API (using mock data)...\n");

  const fileReader = new FileReader();
  const fileWriter = new FileWriter();
  const extractor = new FrontMatterExtractor();

  const promptList = await fileReader.readDirectory(PROMPTS_PATH);
  console.log(`Found ${promptList.count} prompt files`);

  const aggregator = new RegistryAggregator();

  for (const promptFile of promptList.getAll()) {
    console.log(`Processing: ${promptFile.filename}`);

    const frontMatter = extractor.extract(promptFile.content);
    if (!frontMatter) {
      console.log(`  No frontmatter found, skipping`);
      continue;
    }

    const mockCommand: Command = {
      c1: (frontMatter.get("domain") as string) || "unknown",
      c2: (frontMatter.get("action") as string) || "unknown",
      c3: (frontMatter.get("target") as string) || "unknown",
      description: (frontMatter.get("description") as string) ||
        "No description",
      usage: (frontMatter.get("usage") as string) || undefined,
    };

    const config = frontMatter.get("config") as
      | Record<string, unknown>
      | undefined;
    if (config) {
      const supports = config.supports as Record<string, boolean> | undefined;
      mockCommand.options = {
        input: (config.input_formats as string[]) || [],
        adaptation: (config.processing_modes as string[]) || [],
        input_file: supports?.file_input ? [true] : [false],
        stdin: supports?.stdin_input ? [true] : [false],
        destination: supports?.output_destination ? [true] : [false],
      };
    }

    const result = new AnalysisResult(promptFile.path, [mockCommand]);
    aggregator.addAnalysisResult(result);
    console.log(
      `  Extracted command: ${mockCommand.c1}/${mockCommand.c2}/${mockCommand.c3}`,
    );
  }

  const registry = aggregator.build();
  await fileWriter.writeJson(OUTPUT_PATH, registry);

  console.log("\n✅ Test registry build completed!");
  console.log(`📊 Summary:`);
  console.log(`   - Total commands: ${registry.tools.commands.length}`);
  console.log(
    `   - Available configs: ${registry.tools.availableConfigs.join(", ")}`,
  );
  console.log(`   - Output: ${OUTPUT_PATH}`);
}

if (import.meta.main) {
  await testWithoutClaude();
}
