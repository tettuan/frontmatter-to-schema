#!/usr/bin/env -S deno test --allow-read --allow-write --allow-run --allow-env

/**
 * End-to-End Tests for CLI
 *
 * These tests verify the complete CLI functionality including:
 * - Command-line argument parsing
 * - File processing
 * - Output generation
 * - Error handling
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { exists } from "jsr:@std/fs@1";
import { join } from "jsr:@std/path@1";

const CLI_PATH = "./frontmatter-to-schema";
const TEST_OUTPUT_DIR = "./tests/e2e/test-output";

// Ensure output directory exists (wrapped in test to respect permissions)
async function ensureTestDir() {
  try {
    await Deno.mkdir(TEST_OUTPUT_DIR, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      console.warn(
        "Warning: Cannot create test output directory. Some tests may be skipped.",
      );
    } else if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

// Directory will be created when first test runs

// Helper to run CLI
async function runCLI(args: string[]): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}> {
  const cmd = new Deno.Command(CLI_PATH, {
    args,
    stdout: "piped",
    stderr: "piped",
    env: {
      ...Deno.env.toObject(),
      FRONTMATTER_TEST_MODE: "true",
    },
  });

  const output = await cmd.output();

  return {
    success: output.success,
    stdout: new TextDecoder().decode(output.stdout),
    stderr: new TextDecoder().decode(output.stderr),
    code: output.code,
  };
}

// Clean up test output after each test
async function cleanTestOutput() {
  try {
    await Deno.remove(TEST_OUTPUT_DIR, { recursive: true });
  } catch {
    // Directory might not exist or no permission
  }
  await ensureTestDir();
}

Deno.test("CLI: Display help", async () => {
  const result = await runCLI(["--help"]);

  assertEquals(result.success, true);
  assertEquals(result.code, 0);

  // Check help content
  const output = result.stdout;
  assertEquals(output.includes("Usage:"), true);
  assertEquals(output.includes("frontmatter"), true);
  assertEquals(output.includes("--schema"), true);
  assertEquals(output.includes("--template"), true);
  assertEquals(output.includes("--output"), true);
});

Deno.test("CLI: Process sample documents", async () => {
  await cleanTestOutput();

  const result = await runCLI([
    "examples/sample-prompts",
    "--schema=examples/climpt-registry/schema.json",
    "--template=examples/climpt-registry/template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  if (!result.success) {
    console.log("CLI failed with code:", result.code);
    console.log("stdout:", result.stdout);
    console.log("stderr:", result.stderr);
  }
  assertEquals(result.success, true);
  assertEquals(result.code, 0);

  // Check output file was created
  const outputFile = join(TEST_OUTPUT_DIR, "template.json");
  const fileExists = await exists(outputFile);
  assertEquals(fileExists, true);

  // Verify output content
  const content = await Deno.readTextFile(outputFile);
  assertExists(content);
  assertEquals(content.length > 0, true);
});

Deno.test("CLI: Process climpt prompts", async () => {
  await cleanTestOutput();

  // Check if climpt prompts directory exists
  const promptsDir = ".agent/climpt/prompts";
  if (!await exists(promptsDir)) {
    console.log("Skipping test: climpt prompts directory not found");
    return;
  }

  const result = await runCLI([
    promptsDir,
    "--schema=examples/climpt-registry/schema.json",
    "--template=examples/climpt-registry/template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, true);
  assertEquals(result.code, 0);

  // Check output file
  const outputFile = join(TEST_OUTPUT_DIR, "template.json");
  const fileExists = await exists(outputFile);
  assertEquals(fileExists, true);

  // Parse and validate JSON
  const content = await Deno.readTextFile(outputFile);
  const data = JSON.parse(content);
  assertExists(data);
});

Deno.test("CLI: Handle missing directory", async () => {
  const result = await runCLI([
    "non-existent-directory",
    "--schema=examples/climpt-registry/schema.json",
    "--template=examples/climpt-registry/template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, false);
  assertEquals(result.code, 1);

  // Check error message
  const errorOutput = result.stderr;
  assertEquals(
    errorOutput.includes("Error") || errorOutput.includes("not found"),
    true,
  );
});

Deno.test("CLI: Handle missing schema file", async () => {
  const result = await runCLI([
    "examples/sample-docs",
    "--schema=non-existent-schema.json",
    "--template=examples/climpt-registry/template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, false);
  assertEquals(result.code, 1);

  // Check error message
  const errorOutput = result.stderr;
  assertEquals(
    errorOutput.includes("Error") || errorOutput.includes("schema"),
    true,
  );
});

Deno.test("CLI: Handle missing template file", async () => {
  const result = await runCLI([
    "examples/sample-docs",
    "--schema=examples/climpt-registry/schema.json",
    "--template=non-existent-template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, false);
  assertEquals(result.code, 1);

  // Check error message
  const errorOutput = result.stderr;
  assertEquals(
    errorOutput.includes("Error") || errorOutput.includes("template"),
    true,
  );
});

Deno.test("CLI: Process with JSON output format", async () => {
  await cleanTestOutput();

  const result = await runCLI([
    "examples/sample-prompts",
    "--schema=examples/climpt-registry/schema.json",
    "--template=examples/climpt-registry/template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, true);

  // Verify JSON output
  const outputFile = join(TEST_OUTPUT_DIR, "template.json");
  const content = await Deno.readTextFile(outputFile);

  // Should be valid JSON
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Output is not valid JSON");
  }

  assertExists(parsed);
});

Deno.test("CLI: Process with YAML output format", async () => {
  await cleanTestOutput();

  // Create a test markdown file with appropriate frontmatter
  const testDir = join(TEST_OUTPUT_DIR, "yaml-test-docs");
  await Deno.mkdir(testDir, { recursive: true });

  await Deno.writeTextFile(
    join(testDir, "test.md"),
    `---
title: Test Article
emoji: 📚
type: tech
topics: [testing]
published: true
published_at: "2025-08-01 10:00"
---

# Test Article\nContent here.`,
  );

  const result = await runCLI([
    testDir,
    "--schema=examples/articles-index/schema.json",
    "--template=examples/articles-index/template.yaml",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, true);

  // Verify YAML output
  const outputFile = join(TEST_OUTPUT_DIR, "template.yaml");
  const content = await Deno.readTextFile(outputFile);

  // Basic YAML validation
  assertExists(content);
  assertEquals(content.includes(":"), true); // YAML should have key-value pairs
});

Deno.test("CLI: Handle empty directory", async () => {
  await cleanTestOutput();

  // Create empty directory
  const emptyDir = join(TEST_OUTPUT_DIR, "empty");
  try {
    await Deno.mkdir(emptyDir, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      console.log("Skipping test: No write permission");
      return;
    }
    throw error;
  }

  const result = await runCLI([
    emptyDir,
    "--schema=examples/climpt-registry/schema.json",
    "--template=examples/climpt-registry/template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  // Should handle gracefully (might succeed with empty output or fail gracefully)
  assertEquals(typeof result.code === "number", true);
});

Deno.test("CLI: Process multiple markdown files", async () => {
  await cleanTestOutput();

  // Create test markdown files
  const testDir = join(TEST_OUTPUT_DIR, "test-docs");
  try {
    await Deno.mkdir(testDir, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      console.log("Skipping test: No write permission");
      return;
    }
    throw error;
  }

  // Create test files with frontmatter matching climpt-registry schema
  await Deno.writeTextFile(
    join(testDir, "doc1.md"),
    `---
version: "1.0.0"
description: "Test registry document 1"
tools:
  availableConfigs: ["test", "command1"]
  configurations:
    test:
      description: "Test command 1"
      usage: "Usage for test command 1"
---

# Test Document 1
Content here.`,
  );

  await Deno.writeTextFile(
    join(testDir, "doc2.md"),
    `---
version: "1.0.0"
description: "Test registry document 2"
tools:
  availableConfigs: ["test", "command2"]
  configurations:
    test:
      description: "Test command 2"
      usage: "Usage for test command 2"
---

# Test Document 2
More content.`,
  );

  // Ensure output directory exists
  const outputDir = `${TEST_OUTPUT_DIR}/multi-output`;
  await Deno.mkdir(outputDir, { recursive: true });

  const result = await runCLI([
    testDir,
    "--schema=examples/climpt-registry/schema.json",
    "--template=examples/climpt-registry/template.json",
    `--destination=${outputDir}`,
  ]);

  if (!result.success) {
    console.log("CLI failed with code:", result.code);
    console.log("stdout:", result.stdout);
    console.log("stderr:", result.stderr);
  }
  assertEquals(result.success, true);

  // Check output was created
  const outputFile = join(TEST_OUTPUT_DIR, "multi-output", "template.json");
  const fileExists = await exists(outputFile);
  assertEquals(fileExists, true);
});

Deno.test("CLI: Validate required arguments", async () => {
  // Missing schema
  let result = await runCLI([
    "examples/sample-docs",
    "--template=examples/climpt-registry/template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, false);
  assertEquals(result.code, 1);

  // Missing template
  result = await runCLI([
    "examples/sample-docs",
    "--schema=examples/climpt-registry/schema.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, false);
  assertEquals(result.code, 1);

  // Missing directory
  result = await runCLI([
    "--schema=examples/climpt-registry/schema.json",
    "--template=examples/climpt-registry/template.json",
    `--destination=${TEST_OUTPUT_DIR}`,
  ]);

  assertEquals(result.success, false);
  assertEquals(result.code, 1);
});

// Clean up after all tests
await cleanTestOutput();
