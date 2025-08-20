#!/usr/bin/env deno run --allow-read --allow-write

/**
 * Example: Create MCP Registry
 *
 * This example demonstrates how to create a complete MCP registry
 * with multiple commands and configurations.
 *
 * Usage:
 *   deno run --allow-read --allow-write examples/03-create-registry.ts
 */

import { RegistryAggregator } from "../src/registry-aggregator.ts";
import type { MappedEntry } from "../src/types.ts";

console.log("🏗️  Creating MCP Registry Example");
console.log("=".repeat(50));

// Create builder instance
const aggregator = new RegistryAggregator();

// Define sample commands
const commands: MappedEntry[] = [
  {
    c1: "build",
    c2: "robust",
    c3: "api",
    description: "Build a robust API with best practices",
    usage:
      "Create production-ready API endpoints\nExample: climpt-build robust api -f spec.md",
    options: {
      input: ["MD", "YAML", "JSON"],
      adaptation: ["default", "minimal", "comprehensive"],
      input_file: [true],
      stdin: [true],
      destination: [true],
    },
  },
  {
    c1: "test",
    c2: "generate",
    c3: "unit",
    description: "Generate comprehensive unit tests",
    usage:
      "Auto-generate unit tests for your code\nExample: climpt-test generate unit -f src/",
    options: {
      input: ["TS", "JS"],
      adaptation: ["default", "strict"],
      input_file: [true],
      stdin: [false],
      destination: [true],
    },
  },
  {
    c1: "docs",
    c2: "create",
    c3: "api",
    description: "Generate API documentation",
    usage:
      "Create OpenAPI/Swagger documentation\nExample: climpt-docs create api -o docs/api.md",
    options: {
      input: ["default"],
      adaptation: ["default", "detailed"],
      input_file: [false],
      stdin: [true],
      destination: [true],
    },
  },
  {
    c1: "analyze",
    c2: "code",
    c3: "quality",
    description: "Analyze code quality and patterns",
    usage:
      "Perform static analysis and pattern detection\nExample: climpt-analyze code quality",
    options: {
      input: ["default"],
      adaptation: ["default"],
      input_file: [true],
      stdin: [false],
      destination: [false],
    },
  },
];

console.log("\n📝 Adding commands to registry...");

// Add all commands
for (const command of commands) {
  aggregator.addEntry(command);
  console.log(`  ✓ Added: ${command.c1}/${command.c2}/${command.c3}`);
}

// Validate registry
console.log("\n🔍 Validating registry...");
const validation = aggregator.validate();

if (validation.isValid) {
  console.log("✅ Registry validation passed!");
} else {
  console.log("❌ Validation errors:");
  for (const error of validation.errors) {
    console.log(`  - ${error}`);
  }
}

// Build the registry
const registry = aggregator.build();

// Display registry info
console.log("\n📊 Registry Summary:");
console.log("-".repeat(50));
console.log(`Version: ${registry.version}`);
console.log(`Commands: ${registry.tools.commands.length}`);
console.log(`Available Configs: ${registry.tools.availableConfigs.join(", ")}`);

console.log("\n🎯 Commands Overview:");
for (const cmd of registry.tools.commands) {
  console.log(`\n  ${cmd.c1}-${cmd.c2}-${cmd.c3}:`);
  console.log(`    Description: ${cmd.description}`);
  console.log(`    Usage: ${cmd.usage}`);
  if (cmd.options) {
    console.log(`    Input Types: ${cmd.options.input.join(", ")}`);
    console.log(`    Adaptations: ${cmd.options.adaptation.join(", ")}`);
  }
}

// Save to file
const outputPath = "examples/output/sample-registry.json";
await Deno.mkdir("examples/output", { recursive: true });
await aggregator.writeToFile(outputPath);

console.log(`\n💾 Registry saved to: ${outputPath}`);

// Show a sample of the output
console.log("\n📄 Registry Preview:");
console.log("-".repeat(50));
const preview = JSON.stringify(registry, null, 2);
console.log(preview.substring(0, 800) + "...");

console.log("\n✨ Registry creation completed!");
