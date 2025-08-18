#!/usr/bin/env deno run --allow-read --allow-write

/**
 * Example: Complete Flow
 *
 * This example demonstrates the complete flow from
 * discovering prompts to building a production registry.
 *
 * Usage:
 *   deno run --allow-read --allow-write examples/04-complete-flow.ts
 */

import { FrontMatterExtractor } from "../src/domain/frontmatter/Extractor.ts";
import { RegistryBuilder } from "../src/registry-builder.ts";
import type { MappedEntry } from "../src/types.ts";

console.log("🎯 Complete Registry Building Flow");
console.log("=".repeat(50));

const PROMPTS_DIR = ".agent/climpt/prompts";
const OUTPUT_PATH = "examples/output/complete-registry.json";

// Step 1: Discover prompt files
async function discoverPromptFiles(): Promise<string[]> {
  console.log("\n📂 Step 1: Discovering prompt files...");
  const files: string[] = [];

  async function scanDir(path: string) {
    for await (const entry of Deno.readDir(path)) {
      const fullPath = `${path}/${entry.name}`;
      if (entry.isDirectory) {
        await scanDir(fullPath);
      } else if (entry.name.startsWith("f_") && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await scanDir(PROMPTS_DIR);
  console.log(`  ✓ Found ${files.length} prompt files`);
  return files;
}

// Step 2: Extract frontmatter from files
async function extractFrontmatter(
  files: string[],
): Promise<Map<string, MappedEntry>> {
  console.log("\n🔍 Step 2: Extracting frontmatter...");
  const extractor = new FrontMatterExtractor();
  const commands = new Map<string, MappedEntry>();

  for (const file of files) {
    const content = await Deno.readTextFile(file);

    // Skip agent-only prompts
    if (content.includes("Notice: この指示書をAgentは選択はしない。")) {
      continue;
    }

    const frontMatter = extractor.extract(content);
    if (!frontMatter) continue;

    // Parse file path for command structure
    const pathParts = file.split("/");
    const promptsIndex = pathParts.indexOf("prompts");
    const command = pathParts[promptsIndex + 1];
    const directive = pathParts[promptsIndex + 2];
    const layer = pathParts[promptsIndex + 3];

    // Create command object with defaults
    const description = (frontMatter.get("description") as string) ||
      (frontMatter.get("title") as string) ||
      `${command} ${directive} ${layer} command`;

    const usage = (frontMatter.get("usage") as string) ||
      `Execute: climpt-${command} ${directive} ${layer}`;

    // Check for variables in content
    const hasInputFile = content.includes("{input_text_file}");
    const hasStdin = content.includes("{input_text}");
    const hasDestination = content.includes("{destination_path}");

    const cmd: MappedEntry = {
      c1: command,
      c2: directive,
      c3: layer,
      description: description,
      usage: usage,
      options: {
        input: ["default"],
        adaptation: ["default"],
        input_file: [hasInputFile],
        stdin: [hasStdin],
        destination: [hasDestination],
      },
    };

    const key = `${command}/${directive}/${layer}`;
    commands.set(key, cmd);
  }

  console.log(`  ✓ Extracted ${commands.size} valid commands`);
  return commands;
}

// Step 3: Build registry
function buildRegistry(commands: Map<string, MappedEntry>): RegistryBuilder {
  console.log("\n🏗️  Step 3: Building registry...");
  const builder = new RegistryBuilder();

  for (const [_, command] of commands) {
    builder.addEntry(command);
  }

  console.log(`  ✓ Added ${commands.size} commands to registry`);
  return builder;
}

// Step 4: Validate registry
function validateRegistry(builder: RegistryBuilder): boolean {
  console.log("\n✅ Step 4: Validating registry...");
  const validation = builder.validate();

  if (validation.isValid) {
    console.log("  ✓ Validation passed!");
    return true;
  } else {
    console.log("  ❌ Validation failed:");
    for (const error of validation.errors) {
      console.log(`    - ${error}`);
    }
    return false;
  }
}

// Step 5: Generate output
async function generateOutput(builder: RegistryBuilder) {
  console.log("\n💾 Step 5: Generating output...");

  // Ensure output directory exists
  await Deno.mkdir("examples/output", { recursive: true });

  // Save registry
  await builder.writeToFile(OUTPUT_PATH);
  console.log(`  ✓ Registry saved to: ${OUTPUT_PATH}`);

  // Generate summary
  const registry = builder.build();
  console.log("\n📊 Registry Summary:");
  console.log("-".repeat(50));
  console.log(`  Version: ${registry.version}`);
  console.log(`  Total Commands: ${registry.tools.commands.length}`);
  console.log(
    `  Available Configs: ${registry.tools.availableConfigs.join(", ")}`,
  );

  // Show command distribution
  const distribution = new Map<string, number>();
  for (const cmd of registry.tools.commands) {
    const config = cmd.c1;
    distribution.set(config, (distribution.get(config) || 0) + 1);
  }

  console.log("\n📈 Command Distribution:");
  for (const [config, count] of distribution) {
    const bar = "█".repeat(count);
    console.log(`  ${config.padEnd(10)} ${bar} ${count}`);
  }
}

// Main execution
async function main() {
  try {
    // Execute complete flow
    const files = await discoverPromptFiles();
    const commands = await extractFrontmatter(files);
    const builder = buildRegistry(commands);

    if (validateRegistry(builder)) {
      await generateOutput(builder);
      console.log("\n✨ Complete flow executed successfully!");
    } else {
      console.log("\n❌ Flow stopped due to validation errors");
      Deno.exit(1);
    }
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}

// Run the example
await main();
