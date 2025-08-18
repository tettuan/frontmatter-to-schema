#!/usr/bin/env deno run --allow-read

/**
 * Example: Parse Frontmatter from Markdown Files
 * 
 * This example shows how to extract and process frontmatter
 * from markdown files to generate command schemas.
 * 
 * Usage:
 *   deno run --allow-read examples/02-parse-frontmatter.ts
 */

import { FrontMatterExtractor } from "../src/domain/frontmatter/Extractor.ts";
import type { FrontMatter } from "../src/domain/frontmatter/FrontMatter.ts";

console.log("🔍 Frontmatter Parsing Example");
console.log("=" .repeat(50));

// Sample markdown content with frontmatter
const sampleContent = `---
title: Domain Architecture Design
description: Design domain boundaries using DDD principles
domain: design
action: analyze
target: architecture
config:
  input_formats: ["MD", "JSON"]
  processing_modes: ["default", "detailed"]
  supports:
    file_input: true
    stdin_input: true
    output_destination: true
variables:
  - name: input_text
    description: The scope of analysis
  - name: destination_path
    description: Output file location
---

# Domain Architecture Design

This prompt helps you design domain boundaries following Domain-Driven Design principles.

## Usage

\`\`\`bash
climpt-design domain architecture --input=MD --adaptation=detailed
\`\`\`

## Template

Analyze the following domain model:
{input_text}

Output the analysis to: {destination_path}
`;

// Create extractor
const extractor = new FrontMatterExtractor();

console.log("\n📝 Sample Content:");
console.log("-".repeat(50));
console.log(sampleContent.substring(0, 200) + "...\n");

// Extract frontmatter
const frontMatter = extractor.extract(sampleContent);

if (frontMatter) {
  console.log("✅ Frontmatter extracted successfully!\n");
  
  // Display extracted data
  console.log("📊 Extracted Data:");
  console.log("-".repeat(50));
  
  console.log("\n🏷️  Basic Info:");
  console.log(`  Title: ${frontMatter.get("title")}`);
  console.log(`  Description: ${frontMatter.get("description")}`);
  
  console.log("\n🎯 Command Structure:");
  console.log(`  C1 (Domain): ${frontMatter.get("domain")}`);
  console.log(`  C2 (Action): ${frontMatter.get("action")}`);
  console.log(`  C3 (Target): ${frontMatter.get("target")}`);
  
  const config = frontMatter.get("config") as Record<string, unknown> | undefined;
  if (config) {
    console.log("\n⚙️  Configuration:");
    const inputFormats = Array.isArray(config.input_formats) ? config.input_formats.join(", ") : "none";
    const processingModes = Array.isArray(config.processing_modes) ? config.processing_modes.join(", ") : "none";
    console.log(`  Input Formats: ${inputFormats}`);
    console.log(`  Processing Modes: ${processingModes}`);
    
    if (config.supports && typeof config.supports === 'object' && config.supports !== null) {
      const supports = config.supports as Record<string, unknown>;
      console.log("\n📌 Supports:");
      console.log(`  File Input: ${supports.file_input ? "✓" : "✗"}`);
      console.log(`  STDIN Input: ${supports.stdin_input ? "✓" : "✗"}`);
      console.log(`  Output Destination: ${supports.output_destination ? "✓" : "✗"}`);
    }
  }
  
  const variables = frontMatter.get("variables") as Array<Record<string, unknown>> | undefined;
  if (variables && variables.length > 0) {
    console.log("\n🔧 Variables:");
    for (const variable of variables) {
      console.log(`  - ${variable.name}: ${variable.description}`);
    }
  }
  
  // Generate command suggestion
  console.log("\n💡 Suggested Command Structure:");
  console.log("-".repeat(50));
  const command = {
    c1: frontMatter.get("domain") || "unknown",
    c2: frontMatter.get("action") || "unknown", 
    c3: frontMatter.get("target") || "unknown",
    description: frontMatter.get("description") || "No description",
    options: {
      input: Array.isArray(config?.input_formats) ? config.input_formats : [],
      adaptation: Array.isArray(config?.processing_modes) ? config.processing_modes : ["default"],
      input_file: (config && typeof config.supports === 'object' && config.supports !== null && 
        (config.supports as Record<string, unknown>).file_input) ? [true] : [false],
      stdin: (config && typeof config.supports === 'object' && config.supports !== null && 
        (config.supports as Record<string, unknown>).stdin_input) ? [true] : [false],
      destination: (config && typeof config.supports === 'object' && config.supports !== null && 
        (config.supports as Record<string, unknown>).output_destination) ? [true] : [false],
    }
  };
  
  console.log(JSON.stringify(command, null, 2));
  
} else {
  console.log("❌ No frontmatter found in content");
}

console.log("\n✨ Example completed!");