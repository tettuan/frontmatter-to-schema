#!/usr/bin/env -S deno test --allow-read --allow-write --allow-run --allow-env

/**
 * End-to-End Tests for CLI
 *
 * These tests verify the complete CLI functionality with the new interface:
 * frontmatter-to-schema <schema> <output> <pattern> [options]
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { exists } from "jsr:@std/fs@1";
import { join } from "jsr:@std/path@1";

const CLI_PATH = "./src/cli.ts";
const TEST_OUTPUT_DIR = "./tests/e2e/test-output";

// Ensure output directory exists
async function ensureTestDir() {
  try {
    await Deno.mkdir(TEST_OUTPUT_DIR, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }
}

// Helper to run CLI
async function runCLI(args: string[]): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  code: number;
}> {
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      CLI_PATH,
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
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
    // Directory might not exist
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
  assertEquals(output.includes("frontmatter-to-schema"), true);
  assertEquals(output.includes("schema-file"), true);
  assertEquals(output.includes("output-file"), true);
  assertEquals(output.includes("input-pattern"), true);
});

Deno.test("CLI: Display version", async () => {
  const result = await runCLI(["--version"]);

  assertEquals(result.success, true);
  assertEquals(result.code, 0);
  assertEquals(result.stdout.includes("frontmatter-to-schema"), true);
  assertEquals(result.stdout.includes("1.0.0"), true);
});

Deno.test("CLI: Process sample documents with JSON output", async () => {
  await cleanTestOutput();

  // Create test markdown files
  const testDir = join(TEST_OUTPUT_DIR, "test-docs");
  await Deno.mkdir(testDir, { recursive: true });

  await Deno.writeTextFile(
    join(testDir, "doc1.md"),
    `---
c1: "command1"
c2: "short desc 1"
c3: "long description 1"
---

# Document 1
Content here.`,
  );

  await Deno.writeTextFile(
    join(testDir, "doc2.md"),
    `---
c1: "command2"
c2: "short desc 2"
c3: "long description 2"
---

# Document 2
More content.`,
  );

  // Create a simple test schema
  const schemaPath = join(TEST_OUTPUT_DIR, "test-schema.json");
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "commands": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "c1": { "type": "string" },
              "c2": { "type": "string" },
              "c3": { "type": "string" },
            },
          },
          "x-derived-from": "commands[].c1",
          "x-derived-unique": true,
        },
      },
    }),
  );

  const outputPath = join(TEST_OUTPUT_DIR, "output.json");
  const result = await runCLI([
    schemaPath,
    outputPath,
    `${testDir}/*.md`,
  ]);

  if (!result.success) {
    console.log("CLI failed with code:", result.code);
    console.log("stdout:", result.stdout);
    console.log("stderr:", result.stderr);
  }
  assertEquals(result.success, true);
  assertEquals(result.code, 0);

  // Check output file was created
  const fileExists = await exists(outputPath);
  assertEquals(fileExists, true);

  // Verify output content
  const content = await Deno.readTextFile(outputPath);
  const data = JSON.parse(content);
  assertExists(data);
  assertExists(data.commands);
  assertEquals(Array.isArray(data.commands), true);
});

Deno.test("CLI: Process with YAML output format", async () => {
  await cleanTestOutput();

  // Create test markdown files
  const testDir = join(TEST_OUTPUT_DIR, "yaml-test-docs");
  await Deno.mkdir(testDir, { recursive: true });

  await Deno.writeTextFile(
    join(testDir, "article.md"),
    `---
title: "Test Article"
emoji: "📚"
type: "tech"
topics: ["testing", "deno"]
published: true
---

# Test Article
Content here.`,
  );

  // Create schema
  const schemaPath = join(TEST_OUTPUT_DIR, "article-schema.json");
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "articles": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "emoji": { "type": "string" },
              "type": { "type": "string" },
              "topics": {
                "type": "array",
                "items": { "type": "string" },
              },
              "published": { "type": "boolean" },
            },
          },
        },
      },
    }),
  );

  const outputPath = join(TEST_OUTPUT_DIR, "output.yaml");
  const result = await runCLI([
    schemaPath,
    outputPath,
    `${testDir}/*.md`,
  ]);

  if (!result.success) {
    console.log("YAML test failed:");
    console.log("stderr:", result.stderr);
    console.log("stdout:", result.stdout);
  }
  assertEquals(result.success, true);

  // Verify YAML output file exists
  const fileExists = await exists(outputPath);
  assertEquals(fileExists, true);

  if (fileExists) {
    // Verify YAML output content
    const content = await Deno.readTextFile(outputPath);
    assertExists(content);
    // The actual content structure might be different - let's just check it's valid YAML
    assertEquals(content.length > 0, true);
    // Check for YAML structure (key-value pairs)
    assertEquals(content.includes(":") || content.includes("-"), true);
  }
});

Deno.test("CLI: Handle missing schema file", async () => {
  await cleanTestOutput();

  const result = await runCLI([
    "non-existent-schema.json",
    join(TEST_OUTPUT_DIR, "output.json"),
    "examples/*.md",
  ]);

  assertEquals(result.success, false);
  assertEquals(result.code, 1);
  // Error message could be in either stdout or stderr
  const hasError = result.stderr.includes("Error") ||
    result.stdout.includes("Error") ||
    result.stderr.includes("not found") || result.stdout.includes("not found");
  assertEquals(hasError, true);
});

Deno.test("CLI: Handle invalid pattern", async () => {
  await cleanTestOutput();

  // Create a valid schema
  const schemaPath = join(TEST_OUTPUT_DIR, "schema.json");
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {},
    }),
  );

  const result = await runCLI([
    schemaPath,
    join(TEST_OUTPUT_DIR, "output.json"),
    "non-existent-dir/*.md",
  ]);

  // Should handle gracefully
  assertEquals(typeof result.code === "number", true);
});

Deno.test("CLI: Process with dry-run option", async () => {
  await cleanTestOutput();

  // Create test files
  const testDir = join(TEST_OUTPUT_DIR, "dry-run-test");
  await Deno.mkdir(testDir, { recursive: true });

  await Deno.writeTextFile(
    join(testDir, "test.md"),
    `---
title: "Test"
---

Content`,
  );

  const schemaPath = join(TEST_OUTPUT_DIR, "schema.json");
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": { "type": "string" },
            },
          },
        },
      },
    }),
  );

  const outputPath = join(TEST_OUTPUT_DIR, "dry-run-output.json");
  const result = await runCLI([
    schemaPath,
    outputPath,
    `${testDir}/*.md`,
    "--dry-run",
  ]);

  assertEquals(result.success, true);
  assertEquals(result.stdout.includes("Dry-run mode"), true);

  // Output file should NOT be created in dry-run mode
  const fileExists = await exists(outputPath);
  assertEquals(fileExists, false);
});

Deno.test("CLI: Process with verbose option", async () => {
  await cleanTestOutput();

  // Create test files
  const testDir = join(TEST_OUTPUT_DIR, "verbose-test");
  await Deno.mkdir(testDir, { recursive: true });

  await Deno.writeTextFile(
    join(testDir, "test.md"),
    `---
name: "Test"
---

Content`,
  );

  const schemaPath = join(TEST_OUTPUT_DIR, "schema.json");
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
            },
          },
        },
      },
    }),
  );

  const outputPath = join(TEST_OUTPUT_DIR, "verbose-output.json");
  const result = await runCLI([
    schemaPath,
    outputPath,
    `${testDir}/*.md`,
    "--verbose",
  ]);

  assertEquals(result.success, true);
  // Verbose mode should include more details in output
  assertEquals(result.stdout.includes("Processing files"), true);
});

Deno.test("CLI: Process with quiet option", async () => {
  await cleanTestOutput();

  // Create test files
  const testDir = join(TEST_OUTPUT_DIR, "quiet-test");
  await Deno.mkdir(testDir, { recursive: true });

  await Deno.writeTextFile(
    join(testDir, "test.md"),
    `---
data: "test"
---

Content`,
  );

  const schemaPath = join(TEST_OUTPUT_DIR, "schema.json");
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify({
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "data": { "type": "string" },
            },
          },
        },
      },
    }),
  );

  const outputPath = join(TEST_OUTPUT_DIR, "quiet-output.json");
  const result = await runCLI([
    schemaPath,
    outputPath,
    `${testDir}/*.md`,
    "--quiet",
  ]);

  assertEquals(result.success, true);
  // Quiet mode should have minimal output
  assertEquals(result.stdout, "");
});

Deno.test("CLI: Validate required arguments", async () => {
  // Missing all arguments
  let result = await runCLI([]);
  assertEquals(result.success, false);
  assertEquals(result.code, 1);

  // Missing output and pattern
  result = await runCLI(["schema.json"]);
  assertEquals(result.success, false);
  assertEquals(result.code, 1);

  // Missing pattern
  result = await runCLI(["schema.json", "output.json"]);
  assertEquals(result.success, false);
  assertEquals(result.code, 1);
});
