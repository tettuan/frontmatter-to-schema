#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

/**
 * Test Integration - Direct test of ProcessCoordinator with TemplateOutputService
 */

import { ProcessCoordinator } from "./src/application/process-coordinator.ts";

async function testIntegration() {
  console.log("Testing ProcessCoordinator with TemplateOutputService...");

  // Create ProcessCoordinator
  const coordinatorResult = ProcessCoordinator.create();
  if (!coordinatorResult.ok) {
    console.error(
      "Failed to create ProcessCoordinator:",
      coordinatorResult.error,
    );
    return;
  }

  const coordinator = coordinatorResult.data;

  // Define processing configuration
  const configuration = {
    kind: "basic" as const,
    schema: {
      path: ".agent/climpt/frontmatter-to-json/registry_schema.json",
      format: "json" as const,
    },
    input: {
      pattern: ".agent/climpt/prompts/**/*.md",
    },
    template: {
      kind: "file" as const,
      path: ".agent/climpt/frontmatter-to-json/registry_template.json",
      format: "json" as const,
    },
    output: {
      path: "output/test-processcoordinator.json",
      format: "json" as const,
    },
  };

  // Process documents
  console.log("Processing documents...");
  const result = await coordinator.processDocuments(configuration);

  if (!result.ok) {
    console.error("Processing failed:", result.error);
    return;
  }

  console.log("✅ Processing successful!");
  console.log(`Processed ${result.data.processedFiles} files`);
  console.log(`Processing time: ${result.data.processingTime}ms`);
  console.log("Output written to:", configuration.output.path);

  // Check if file was created
  try {
    const content = await Deno.readTextFile(configuration.output.path);
    console.log("Output content preview:");
    console.log(content.substring(0, 200) + "...");
  } catch (error) {
    console.error("Failed to read output file:", error);
  }
}

if (import.meta.main) {
  await testIntegration();
}
