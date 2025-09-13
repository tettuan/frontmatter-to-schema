#!/usr/bin/env -S deno run --allow-all
/**
 * Integration Test for Template-Only Processing
 *
 * Tests the spec-trace index generation with strict template-only output
 */

import { TemplateOnlyProcessor } from "./src/core/template-only-processor.ts";
import * as path from "jsr:@std/path@1.0.9";
import { parse as parseYaml } from "jsr:@std/yaml@1.0.7";

async function extractTracabilityIds(docsPath: string): Promise<string[]> {
  const ids: string[] = [];

  for await (const entry of Deno.readDir(docsPath)) {
    if (entry.isFile && entry.name.endsWith(".md")) {
      const filePath = path.join(docsPath, entry.name);
      const content = await Deno.readTextFile(filePath);

      // Extract frontmatter
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        try {
          const frontmatter = parseYaml(match[1]) as Record<string, unknown>;

          // Extract traceability IDs
          if (
            frontmatter.traceability && Array.isArray(frontmatter.traceability)
          ) {
            for (const trace of frontmatter.traceability) {
              const traceObj = trace as Record<string, unknown>;
              const id = traceObj.id as Record<string, unknown> | undefined;
              if (id?.full && typeof id.full === "string") {
                ids.push(id.full);
              }
            }
          }
        } catch (e) {
          console.error(`Error parsing ${entry.name}:`, e);
        }
      }
    }
  }

  return ids;
}

async function testSpecTraceProcessing(level: string) {
  console.log(`\n=== Testing ${level} level ===`);

  const basePath = ".agent/spec-trace";

  // Load template
  const templatePath = path.join(basePath, "index_level_template.json");
  const templateContent = await Deno.readTextFile(templatePath);
  console.log("Template:", templateContent);

  // Load schema for defaults
  const schemaPath = path.join(basePath, `index_${level}_schema.json`);
  const schemaContent = await Deno.readTextFile(schemaPath);
  const schema = JSON.parse(schemaContent);

  // Extract traceability IDs from documents
  const docsPath = path.join(basePath, "docs");
  const ids = await extractTracabilityIds(docsPath);

  // Filter IDs by level
  const levelIds = ids.filter((id) => id.startsWith(`${level}:`));
  console.log(`Found ${levelIds.length} ${level} IDs:`, levelIds);

  // Prepare data for template
  const data: Record<string, unknown> = {
    version: schema.properties?.version?.default || "1.0.0",
    description: schema.properties?.description?.default ||
      `${level} level traceability IDs`,
    level: level,
    [level]: levelIds, // Dynamic key based on level
  };

  console.log("Data for template:", data);

  // Process template
  const processor = new TemplateOnlyProcessor();
  const result = processor.processTemplate(templateContent, data);

  if (!result.ok) {
    console.error("Error:", result.error);
    return;
  }

  console.log("Output:", result.data);

  // Write output
  const outputPath = path.join(basePath, "index", `${level}_index_test.json`);
  await Deno.writeTextFile(outputPath, result.data);
  console.log(`Wrote output to ${outputPath}`);

  // Compare with expected output if it exists
  const expectedPath = path.join(
    basePath,
    "index",
    `success_${level}_index_correct.json`,
  );
  try {
    const expected = await Deno.readTextFile(expectedPath);
    const expectedObj = JSON.parse(expected);
    const actualObj = JSON.parse(result.data);

    console.log("\nExpected structure:", JSON.stringify(expectedObj, null, 2));
    console.log("\nActual structure:", JSON.stringify(actualObj, null, 2));

    // Check structure match
    const keysMatch = JSON.stringify(Object.keys(expectedObj).sort()) ===
      JSON.stringify(Object.keys(actualObj).sort());
    console.log(`Structure match: ${keysMatch ? "✅" : "❌"}`);
  } catch {
    console.log("No expected output file for comparison");
  }
}

// Main
if (import.meta.main) {
  const levels = ["req", "design", "impl", "spec", "test"];

  for (const level of levels) {
    try {
      await testSpecTraceProcessing(level);
    } catch (error) {
      console.error(`Error processing ${level}:`, error);
    }
  }

  console.log("\n=== Integration test complete ===");
}
