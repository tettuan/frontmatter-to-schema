#!/usr/bin/env deno run --allow-read --allow-write --allow-run

import {
  discoverPromptFiles,
  extractFrontmatter,
  findTemplateVariables,
} from "./file-discovery.ts";
import { ClaudeClient } from "./claude-client.ts";
import { RegistryBuilder } from "./registry-builder.ts";
import type { AnalysisResult, MappedEntry } from "./types.ts";

/**
 * Main analysis pipeline
 */
export class AnalysisPipeline {
  private claudeClient: ClaudeClient;
  private registryBuilder: RegistryBuilder;

  constructor() {
    this.claudeClient = new ClaudeClient();
    this.registryBuilder = new RegistryBuilder();
  }

  /**
   * Runs the complete analysis pipeline
   */
  async run(
    promptsDir: string,
    extractPromptPath: string,
    mapPromptPath: string,
    outputPath: string,
  ): Promise<void> {
    console.log("🔍 Discovering prompt files...");
    const promptFiles = await discoverPromptFiles(promptsDir);
    console.log(`Found ${promptFiles.length} prompt files`);

    let processedCount = 0;
    let errorCount = 0;

    for (const promptFile of promptFiles) {
      try {
        console.log(`📝 Processing: ${promptFile.path}`);

        // Extract frontmatter and template variables for future use
        const { frontmatter: _frontmatter, body: _body } = extractFrontmatter(
          promptFile.content,
        );
        const _templateVariables = findTemplateVariables(promptFile.content);

        console.log(`  🤖 Analyzing with Claude...`);

        // Step 1: Analyze frontmatter with Claude
        const analysisResult: AnalysisResult = await this.claudeClient
          .analyzeFrontmatter(
            promptFile.path,
            promptFile.content,
            extractPromptPath,
          );

        console.log(`  🗺️  Mapping to schema...`);

        // Step 2: Map to schema with Claude
        const mappedEntry: MappedEntry = await this.claudeClient.mapToSchema(
          analysisResult,
          mapPromptPath,
        );

        // Step 3: Add to registry
        this.registryBuilder.addEntry(mappedEntry);

        processedCount++;
        console.log(`  ✅ Completed (${processedCount}/${promptFiles.length})`);
      } catch (error) {
        errorCount++;
        console.error(
          `  ❌ Error processing ${promptFile.path}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        // Continue processing other files even if one fails
        continue;
      }
    }

    console.log(`\n📊 Processing Summary:`);
    console.log(`  Total files: ${promptFiles.length}`);
    console.log(`  Processed: ${processedCount}`);
    console.log(`  Errors: ${errorCount}`);

    // Validate registry
    console.log(`\n🔍 Validating registry...`);
    const validation = this.registryBuilder.validate();

    if (!validation.isValid) {
      console.error(`❌ Registry validation failed:`);
      validation.errors.forEach((error) => console.error(`  - ${error}`));
      throw new Error("Registry validation failed");
    }

    console.log(`✅ Registry validation passed`);

    // Write registry to file
    console.log(`\n💾 Writing registry to ${outputPath}...`);
    await this.registryBuilder.writeToFile(outputPath);

    console.log(`🎉 Registry generation completed!`);
    console.log(`  📄 Output: ${outputPath}`);
    console.log(`  📦 Commands: ${this.registryBuilder.getEntryCount()}`);
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = Deno.args;

  if (args.length < 1) {
    console.error(
      "Usage: deno run --allow-read --allow-write --allow-run main.ts [prompts-dir]",
    );
    console.error(
      "Example: deno run --allow-read --allow-write --allow-run main.ts .agent/climpt/prompts",
    );
    Deno.exit(1);
  }

  const promptsDir = args[0];
  const extractPromptPath = "scripts/prompts/extract_frontmatter.md";
  const mapPromptPath = "scripts/prompts/map_to_schema.md";
  const outputPath = ".agent/climpt/registry.json";

  try {
    // Check if required files exist
    await Deno.stat(promptsDir);
    await Deno.stat(extractPromptPath);
    await Deno.stat(mapPromptPath);

    const pipeline = new AnalysisPipeline();
    await pipeline.run(
      promptsDir,
      extractPromptPath,
      mapPromptPath,
      outputPath,
    );
  } catch (error) {
    console.error(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  await main();
}
