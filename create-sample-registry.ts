#!/usr/bin/env deno run --allow-read --allow-write

import { RegistryAggregator } from "./src/registry-aggregator.ts";
import type { MappedEntry } from "./src/types.ts";

console.log("Creating sample registry...");

const aggregator = new RegistryAggregator();

// Add sample entries based on discovered files
const sampleEntries: MappedEntry[] = [
  {
    c1: "design",
    c2: "domain",
    c3: "boundary",
    description: "Design domain boundaries using DDD principles",
    usage:
      "Analyze system architecture and identify domain boundaries\nExample: climpt-design domain boundary -f requirements.md",
    options: {
      input: ["MD"],
      adaptation: ["default", "code"],
      input_file: [true],
      stdin: [true],
      destination: [true],
    },
  },
  {
    c1: "git",
    c2: "decide-branch",
    c3: "working-branch",
    description: "Decide which working branch to use for development",
    usage:
      "Select appropriate branch for current work\nExample: climpt-git decide-branch working-branch",
    options: {
      input: ["default"],
      adaptation: ["default"],
      input_file: [false],
      stdin: [false],
      destination: [false],
    },
  },
  {
    c1: "meta",
    c2: "build-list",
    c3: "command-registry",
    description:
      "Generate available commands list using Claude Code with shell automation",
    usage:
      "Build comprehensive command registry\nExample: climpt-meta build-list command-registry -i claude",
    options: {
      input: ["claude", "default"],
      adaptation: ["default", "registry"],
      input_file: [false],
      stdin: [true],
      destination: [true],
    },
  },
];

// Add all sample entries
for (const entry of sampleEntries) {
  aggregator.addEntry(entry);
}

// Validate
const validation = aggregator.validate();
if (!validation.isValid) {
  console.error("❌ Validation failed:");
  validation.errors.forEach((error) => console.error(`  - ${error}`));
  Deno.exit(1);
}

console.log("✅ Validation passed");

// Write to file
await aggregator.writeToFile(".agent/climpt/registry.json");

console.log("🎉 Sample registry created!");
console.log(`📦 Commands: ${aggregator.getEntryCount()}`);

// Display the registry
const registry = aggregator.build();
console.log("\n📄 Registry structure:");
console.log(`Version: ${registry.version}`);
console.log(`Available configs: ${registry.tools.availableConfigs.join(", ")}`);
console.log(`Commands: ${registry.tools.commands.length}`);
