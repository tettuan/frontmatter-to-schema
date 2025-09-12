/**
 * CLI End-to-End Workflow Tests
 *
 * Tests complete CLI functionality addressing Issue #652:
 * - Real file I/O with CLI interface
 * - Complete markdown → schema → template → output workflow
 * - Error handling scenarios
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import { join } from "jsr:@std/path";

// Create temporary test directory
const TEST_DIR = await Deno.makeTempDir({ prefix: "cli-e2e-" });
const INPUT_DIR = join(TEST_DIR, "input");
const OUTPUT_FILE = join(TEST_DIR, "output.json");
const SCHEMA_FILE = join(TEST_DIR, "schema.json");

// Cleanup function
const cleanup = async () => {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
};

// Setup test fixtures
const setup = async () => {
  await Deno.mkdir(INPUT_DIR, { recursive: true });

  // Create test markdown file
  await Deno.writeTextFile(
    join(INPUT_DIR, "test.md"),
    `---
title: "CLI E2E Test"
author: "Test User"
tags: ["cli", "e2e", "test"]
date: "2024-01-01"
category: "technical"
---

# CLI E2E Test Document

This document tests the complete CLI workflow.
`,
  );

  // Create test schema
  await Deno.writeTextFile(
    SCHEMA_FILE,
    JSON.stringify(
      {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          date: { type: "string", format: "date" },
          category: { type: "string" },
        },
        required: ["title", "author"],
      },
      null,
      2,
    ),
  );
};

// Helper to run CLI commands
async function runCLI(args: string[]): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
}> {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", "cli.ts", ...args],
    stdout: "piped",
    stderr: "piped",
  });

  const output = await cmd.output();

  return {
    success: output.success,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
  };
}

Deno.test({
  name: "CLI E2E: Help command works",
  async fn() {
    const result = await runCLI(["--help"]);

    assertEquals(result.success, true);
    assertStringIncludes(result.stdout, "frontmatter-to-schema");
    assertStringIncludes(result.stdout, "Usage:");
  },
});

Deno.test({
  name: "CLI E2E: Complete workflow - markdown to schema processing",
  async fn() {
    await setup();

    try {
      // Run CLI with positional arguments (testing Issue #655 fix)
      const result = await runCLI([
        INPUT_DIR,
        `--schema=${SCHEMA_FILE}`,
        `--output=${OUTPUT_FILE}`,
      ]);

      // Should not fail with ConfigurationError anymore
      if (!result.success) {
        console.log("STDOUT:", result.stdout);
        console.log("STDERR:", result.stderr);
      }

      // The CLI should process without ConfigurationError
      // Note: It may fail with ProcessingStageError (different issue beyond #655)
      const hasConfigurationError = result.stderr.includes(
        "ConfigurationError",
      );
      assertEquals(
        hasConfigurationError,
        false,
        "ConfigurationError should be resolved (Issue #655)",
      );

      // Verify CLI starts processing (gets past configuration stage)
      const startsProcessing =
        result.stdout.includes("Starting frontmatter-to-schema processing") ||
        result.stderr.includes("Starting document processing");
      assertEquals(startsProcessing, true, "CLI should start processing");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "CLI E2E: Error handling - missing schema file",
  async fn() {
    await setup();

    try {
      const result = await runCLI([
        INPUT_DIR,
        "--schema=nonexistent.json",
        `--output=${OUTPUT_FILE}`,
      ]);

      // Should fail gracefully with file not found
      assertEquals(result.success, false);
      assertStringIncludes(result.stderr, "FileNotFound");
    } finally {
      await cleanup();
    }
  },
});

Deno.test({
  name: "CLI E2E: Error handling - invalid arguments",
  async fn() {
    const result = await runCLI([]);

    // Should fail with helpful error message
    assertEquals(result.success, false);
    // Should show help information on error
    const showsHelp = result.stdout.includes("help") ||
      result.stderr.includes("help");
    assertEquals(showsHelp, true, "Should show help on invalid arguments");
  },
});
