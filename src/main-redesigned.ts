#!/usr/bin/env deno run --allow-read --allow-write --allow-run

/**
 * Main entry point for the redesigned high-abstraction frontmatter analysis system
 * 
 * This demonstrates the new architecture with schema-driven, configurable analysis.
 */

import { ClimptPipelineFactory } from "./application/climpt/climpt-adapter.ts";

/**
 * Main CLI entry point using the new high-abstraction architecture
 */
async function main() {
  const args = Deno.args;

  if (args.length < 1) {
    console.error("Usage: deno run --allow-read --allow-write --allow-run main-redesigned.ts [prompts-dir] [output-path]");
    console.error("Example: deno run --allow-read --allow-write --allow-run main-redesigned.ts .agent/climpt/prompts .agent/climpt/registry.json");
    Deno.exit(1);
  }

  const promptsDir = args[0];
  const outputPath = args[1] || ".agent/climpt/registry.json";

  try {
    console.log("🚀 Starting redesigned frontmatter analysis system...");
    console.log(`📂 Source directory: ${promptsDir}`);
    console.log(`💾 Output path: ${outputPath}`);

    // Check if required directories exist
    await Deno.stat(promptsDir);

    // Create Climpt-specific pipeline using the factory
    console.log("🏗️  Initializing Climpt analysis pipeline...");
    const pipeline = await ClimptPipelineFactory.createDefault();

    // Process files and generate registry
    console.log("⚙️  Processing frontmatter files...");
    const registry = await pipeline.processAndSave(promptsDir, outputPath, {
      includeMetadata: true,
      validateResults: true
    });

    // Success message
    console.log("\n🎉 Analysis completed successfully!");
    console.log(`📄 Output: ${outputPath}`);
    console.log(`📦 Commands: ${registry.tools.commands.length}`);
    console.log(`⚙️  Available configs: ${registry.tools.availableConfigs.join(", ")}`);

  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Provide helpful troubleshooting information
    if (error instanceof Error) {
      if (error.message.includes('ENOENT') || error.message.includes('No such file')) {
        console.error("\n💡 Troubleshooting:");
        console.error("  - Check if the prompts directory exists");
        console.error("  - Verify that prompt files (*.md) are present in the directory");
        console.error("  - Ensure you have read permissions for the directory");
      } else if (error.message.includes('Claude CLI error')) {
        console.error("\n💡 Troubleshooting:");
        console.error("  - Ensure Claude CLI is installed and accessible");
        console.error("  - Check your Claude API credentials");
        console.error("  - Verify network connectivity");
      }
    }
    
    Deno.exit(1);
  }
}

/**
 * Advanced usage example with custom configuration
 */
async function advancedExample() {
  console.log("🔧 Advanced usage example with custom schema and templates...");
  
  try {
    // Create pipeline with custom configuration
    const pipeline = await ClimptPipelineFactory.create(
      "custom-schema.json",        // Custom schema file
      "custom-template.json",      // Custom template file
      "custom-extract.md",         // Custom extraction prompt
      "custom-map.md"              // Custom mapping prompt
    );

    // Process with custom options
    const registry = await pipeline.processAndSave(
      ".agent/climpt/prompts",
      ".agent/climpt/custom-registry.json",
      {
        includeMetadata: true,
        validateResults: true,
        customOption: "example"
      }
    );

    console.log("✅ Advanced example completed!");
    console.log(`Generated ${registry.tools.commands.length} commands`);

  } catch (error) {
    console.log("ℹ️  Advanced example failed (expected if custom files don't exist)");
    console.log(`   Error: ${error}`);
  }
}

// Run if called directly
if (import.meta.main) {
  await main();
  
  // Optionally run advanced example for demonstration
  if (Deno.args.includes("--demo-advanced")) {
    console.log("\n" + "=".repeat(60));
    await advancedExample();
  }
}