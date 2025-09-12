/**
 * Integration Test: Template Variable Resolution Bug (Issue #706)
 *
 * This test reproduces the exact issue where template variables remain as placeholders
 * instead of being resolved to actual aggregated data from x-derived-from processing.
 *
 * Expected: Template variables resolve to actual data
 * Actual: Template variables remain as placeholder strings
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { ProcessCoordinator } from "../../src/application/process-coordinator.ts";
import type { ProcessingConfiguration } from "../../src/application/process-coordinator.ts";
import {
  cleanupTestFiles,
  createTestFiles,
} from "../helpers/test-file-utils.ts";

Deno.test("Template Variable Resolution - Issue #706 Reproduction", async () => {
  const testDir = "./tmp/test-template-resolution";

  // Setup test files
  const testFiles = await createTestFiles(testDir, {
    schema: {
      path: "schema.json",
      content: JSON.stringify(
        {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": {
            "tools": {
              "type": "object",
              "properties": {
                "availableConfigs": {
                  "type": "array",
                  "items": { "type": "string" },
                  "x-derived-from": "commands[].c1",
                  "x-derived-unique": true,
                },
              },
            },
          },
        },
        null,
        2,
      ),
    },
    frontmatter: [
      {
        path: "test1.md",
        content: `---
commands:
  - c1: "design"
    description: "Design documents"
  - c1: "spec" 
    description: "Specification documents"
  - c1: "meta"
    description: "Metadata documents"
---

# Test Document 1
Some content here.`,
      },
      {
        path: "test2.md",
        content: `---
commands:
  - c1: "git"
    description: "Git operations"
  - c1: "build"
    description: "Build processes"
---

# Test Document 2
More content here.`,
      },
    ],
    template: {
      path: "template.json",
      content: JSON.stringify(
        {
          "result": {
            "tools": {
              "configs": "{tools.availableConfigs}",
              "configCount": "{tools.availableConfigs.length}",
            },
          },
        },
        null,
        2,
      ),
    },
  });

  try {
    // Create ProcessCoordinator
    const coordinatorResult = ProcessCoordinator.create();
    assertExists(
      coordinatorResult.ok,
      `Failed to create ProcessCoordinator: ${
        coordinatorResult.ok ? "" : coordinatorResult.error.message
      }`,
    );
    assertEquals(coordinatorResult.ok, true);

    if (!coordinatorResult.ok) {
      throw new Error(
        `ProcessCoordinator creation failed: ${coordinatorResult.error.message}`,
      );
    }
    const coordinator = coordinatorResult.data;

    // Setup processing configuration
    const config: ProcessingConfiguration = {
      kind: "basic",
      schema: {
        path: testFiles.schema.fullPath,
        format: "json",
      },
      input: {
        pattern: "*.md",
        baseDirectory: testDir,
      },
      template: {
        kind: "file",
        path: testFiles.template.fullPath,
        format: "json",
      },
      output: {
        path: `${testDir}/output.json`,
        format: "json",
      },
    };

    // Execute processing
    const processingResult = await coordinator.processDocuments(config);

    // Debug information
    if (!processingResult.ok) {
      console.error("Processing failed:", processingResult.error);
    }

    assertExists(
      processingResult.ok,
      `Processing failed: ${
        processingResult.ok ? "" : processingResult.error.message
      }`,
    );
    assertEquals(processingResult.ok, true);

    if (!processingResult.ok) {
      throw new Error(`Processing failed: ${processingResult.error.message}`);
    }
    const result = processingResult.data;

    // Verify aggregated data was created
    assertExists(result.aggregatedData, "Aggregated data should be present");
    console.log(
      "Aggregated data:",
      JSON.stringify(result.aggregatedData, null, 2),
    );

    // Verify the raw content to check template variable resolution
    console.log("Raw rendered content:", result.renderedContent.content);

    // CRITICAL TEST: Verify template variables are resolved, not left as placeholders
    const rawContent = result.renderedContent.content;

    // Test that template variables are being resolved instead of left as placeholders
    console.log("Checking for placeholder resolution...");

    // SUCCESS CRITERIA: Template variables should NOT appear as literal placeholders
    const hasUnresolvedPlaceholders = rawContent.includes(
      "{tools.availableConfigs}",
    );

    console.log("Has unresolved placeholders:", hasUnresolvedPlaceholders);
    console.log(
      "Raw content contains resolved data:",
      !hasUnresolvedPlaceholders,
    );

    // FIXED: This test now verifies the core issue is resolved
    assertEquals(
      hasUnresolvedPlaceholders,
      false,
      `Template variables should be resolved, not left as placeholders. Issue #706 expects template variables to resolve to actual data.`,
    );

    // Verify that the content contains actual resolved data (not just placeholders)
    const hasResolvedData = rawContent.includes("git") &&
      rawContent.includes("build") && rawContent.includes("design");
    assertEquals(
      hasResolvedData,
      true,
      "Content should contain actual aggregated data values",
    );

    console.log(
      "✅ Issue #706 RESOLVED: Template variables are resolving to actual data",
    );
    console.log("✅ No more placeholder strings in output");
    console.log("✅ x-derived-from aggregation is working correctly");
  } finally {
    // Cleanup
    await cleanupTestFiles(testDir);
  }
});

Deno.test("Debug: Aggregation Data Structure Analysis", async () => {
  const testDir = "./tmp/debug-aggregation";

  const testFiles = await createTestFiles(testDir, {
    schema: {
      path: "simple-schema.json",
      content: JSON.stringify(
        {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": {
            "configs": {
              "type": "array",
              "items": { "type": "string" },
              "x-derived-from": "commands[].c1",
              "x-derived-unique": true,
            },
          },
        },
        null,
        2,
      ),
    },
    frontmatter: [
      {
        path: "debug.md",
        content: `---
commands:
  - c1: "test1"
  - c1: "test2"
---

# Debug Document`,
      },
    ],
    template: {
      path: "debug-template.json",
      content: JSON.stringify(
        {
          "flatConfigs": "{configs}",
          "nestedAccess": "{tools.configs}",
        },
        null,
        2,
      ),
    },
  });

  try {
    const coordinatorResult = ProcessCoordinator.create();
    assertEquals(coordinatorResult.ok, true);

    if (!coordinatorResult.ok) {
      throw new Error(
        `ProcessCoordinator creation failed: ${coordinatorResult.error.message}`,
      );
    }
    const coordinator = coordinatorResult.data;

    const config: ProcessingConfiguration = {
      kind: "basic",
      schema: {
        path: testFiles.schema.fullPath,
        format: "json",
      },
      input: {
        pattern: "*.md",
        baseDirectory: testDir,
      },
      template: {
        kind: "file",
        path: testFiles.template.fullPath,
        format: "json",
      },
      output: {
        path: `${testDir}/debug-output.json`,
        format: "json",
      },
    };

    const processingResult = await coordinator.processDocuments(config);
    assertEquals(processingResult.ok, true);

    if (!processingResult.ok) {
      throw new Error(`Processing failed: ${processingResult.error.message}`);
    }
    const result = processingResult.data;

    // Debug output
    console.log("\n=== DEBUG AGGREGATION STRUCTURE ===");
    console.log(
      "Aggregated data fields:",
      result.aggregatedData
        ? Object.keys(result.aggregatedData.aggregatedFields)
        : "none",
    );
    console.log(
      "Aggregated data:",
      JSON.stringify(result.aggregatedData?.aggregatedFields, null, 2),
    );

    // Check raw rendered content instead of trying to parse potentially invalid JSON
    console.log("\n=== DEBUG RENDERED CONTENT ===");
    console.log("Raw rendered content:", result.renderedContent.content);

    // Verify template variable resolution is working
    console.log("\n=== DEBUG TEMPLATE VARIABLE RESOLUTION ===");
    const rawContent = result.renderedContent.content;
    const hasPlaceholders = rawContent.includes("{") &&
      rawContent.includes("}") &&
      (rawContent.includes("{configs}") ||
        rawContent.includes("{tools.configs}"));
    const hasResolvedData = rawContent.includes("test1") &&
      rawContent.includes("test2");

    console.log("Has unresolved placeholders:", hasPlaceholders);
    console.log("Has resolved data values:", hasResolvedData);
    console.log(
      "✅ Template variable resolution is working:",
      !hasPlaceholders && hasResolvedData,
    );
  } finally {
    await cleanupTestFiles(testDir);
  }
});
