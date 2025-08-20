#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Example 3: Programmatic CLI Usage
 * 
 * This example demonstrates how to use the CLI programmatically
 * from TypeScript/JavaScript code using Deno's subprocess API.
 * 
 * Usage:
 *   deno run --allow-read --allow-write --allow-run examples/03-cli-programmatic.ts
 */

import { join } from "jsr:@std/path@1";

console.log("🔧 Frontmatter to Schema - Programmatic CLI Example");
console.log("=".repeat(50));
console.log("");

/**
 * Execute the CLI with given arguments
 */
async function runCLI(
  directory: string,
  schema: string,
  template: string,
  destination: string,
): Promise<boolean> {
  const cmd = new Deno.Command("./frontmatter-to-schema", {
    args: [
      directory,
      `--schema=${schema}`,
      `--template=${template}`,
      `--destination=${destination}`,
    ],
    stdout: "piped",
    stderr: "piped",
  });

  console.log(`📂 Processing: ${directory}`);
  console.log(`   Schema: ${schema}`);
  console.log(`   Template: ${template}`);
  console.log(`   Output: ${destination}`);

  const output = await cmd.output();
  
  if (output.success) {
    console.log("✅ Success!");
    const stdout = new TextDecoder().decode(output.stdout);
    if (stdout) {
      console.log("   Output:", stdout.trim());
    }
    return true;
  } else {
    console.log("❌ Failed!");
    const stderr = new TextDecoder().decode(output.stderr);
    if (stderr) {
      console.error("   Error:", stderr.trim());
    }
    return false;
  }
}

/**
 * Process multiple configurations
 */
async function processConfigurations() {
  const configurations = [
    {
      name: "Climpt Registry",
      directory: ".agent/climpt/prompts",
      schema: "examples/climpt-registry/schema.json",
      template: "examples/climpt-registry/template.json",
      destination: "examples/output/programmatic-climpt",
    },
    {
      name: "Sample Documents",
      directory: "examples/sample-docs",
      schema: "examples/articles-index/schema.json",
      template: "examples/articles-index/template.yaml",
      destination: "examples/output/programmatic-articles",
    },
  ];

  console.log("🚀 Processing multiple configurations...\n");

  const results = [];
  for (const config of configurations) {
    console.log(`\n📋 Configuration: ${config.name}`);
    console.log("-".repeat(40));
    
    const success = await runCLI(
      config.directory,
      config.schema,
      config.template,
      config.destination,
    );
    
    results.push({ name: config.name, success });
    console.log("");
  }

  // Summary
  console.log("\n📊 Summary");
  console.log("=".repeat(50));
  
  let successCount = 0;
  for (const result of results) {
    const icon = result.success ? "✅" : "❌";
    console.log(`${icon} ${result.name}: ${result.success ? "Success" : "Failed"}`);
    if (result.success) successCount++;
  }
  
  console.log(`\n🎯 Total: ${successCount}/${results.length} successful`);
}

/**
 * Demonstrate error handling
 */
async function demonstrateErrorHandling() {
  console.log("\n\n🔍 Error Handling Example");
  console.log("=".repeat(50));
  console.log("");

  // Test with non-existent directory
  console.log("Testing with non-existent directory:");
  await runCLI(
    "non-existent-directory",
    "examples/climpt-registry/schema.json",
    "examples/climpt-registry/template.json",
    "examples/output/error-test",
  );

  // Test with invalid schema
  console.log("\nTesting with invalid schema:");
  await runCLI(
    "examples/sample-docs",
    "non-existent-schema.json",
    "examples/climpt-registry/template.json",
    "examples/output/error-test",
  );
}

/**
 * Main execution
 */
async function main() {
  try {
    // Check if CLI exists
    try {
      await Deno.stat("./frontmatter-to-schema");
    } catch {
      console.error("❌ Error: CLI executable not found!");
      console.error("   Please ensure './frontmatter-to-schema' exists and is executable.");
      console.error("   Run: chmod +x frontmatter-to-schema");
      Deno.exit(1);
    }

    // Run examples
    await processConfigurations();
    await demonstrateErrorHandling();

    console.log("\n\n🎉 All examples completed!");
    console.log("📁 Check examples/output/ for generated files");
    
  } catch (error) {
    console.error("❌ Fatal error:", error);
    Deno.exit(1);
  }
}

// Execute if run directly
if (import.meta.main) {
  await main();
}