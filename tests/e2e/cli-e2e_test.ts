import { assertEquals, assertStringIncludes } from "@std/assert";
import { ensureDir } from "jsr:@std/fs";
import { join } from "@std/path";
import { CLI } from "../../src/presentation/cli/index.ts";

/**
 * End-to-End tests for CLI functionality
 * Tests complete user workflows with real file system operations
 * Validates CLI commands, argument parsing, and user experience
 */

const TEST_DIR = "./tmp/test-e2e";
const TEST_FIXTURES_DIR = "./tmp/test-e2e/fixtures";

async function setupE2EEnvironment() {
  await ensureDir(TEST_DIR);
  await ensureDir(TEST_FIXTURES_DIR);

  // Create test schema
  const testSchema = {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      published: { type: "boolean" },
    },
    required: ["title", "author"],
  };
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "schema.json"),
    JSON.stringify(testSchema, null, 2),
  );

  // Create test template
  const testTemplate = {
    output: {
      title: "${title}",
      author: "${author}",
      metadata: {
        tags: "${tags}",
        published: "${published}",
      },
    },
  };
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "template.json"),
    JSON.stringify(testTemplate, null, 2),
  );

  // Create test markdown documents
  const testMarkdown = `---
title: E2E Test Document
author: E2E Test Author
tags: ["e2e", "test", "cli"]
published: true
---

# E2E Test Document

This document tests the complete CLI workflow.

## Features

- Complete pipeline processing
- Real file system operations
- CLI argument parsing
- Output generation
`;
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "document.md"),
    testMarkdown,
  );

  // Create directory with multiple documents
  const docsDir = join(TEST_FIXTURES_DIR, "docs");
  await ensureDir(docsDir);

  const doc1 = `---
title: Multi Doc 1
author: Author 1
tags: ["multi", "doc1"]
published: true
---

# Document 1
Content for document 1.
`;
  await Deno.writeTextFile(join(docsDir, "doc1.md"), doc1);

  const doc2 = `---
title: Multi Doc 2
author: Author 2
tags: ["multi", "doc2"]
published: false
---

# Document 2
Content for document 2.
`;
  await Deno.writeTextFile(join(docsDir, "doc2.md"), doc2);
}

async function cleanupE2EEnvironment() {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

Deno.test("CLI E2E - help command variations", async () => {
  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  // Test different help command variations
  const helpVariations = ["help", "--help", "-h"];

  for (const helpCmd of helpVariations) {
    const result = await cliInstance.run([helpCmd]);

    assertEquals(result.ok, true);
    assertStringIncludes(
      result.data as string,
      "Frontmatter to Schema Processor",
    );
    assertStringIncludes(result.data as string, "USAGE:");
    assertStringIncludes(result.data as string, "COMMANDS:");
    assertStringIncludes(result.data as string, "process");
  }
});

Deno.test("CLI E2E - version command variations", async () => {
  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  // Test different version command variations
  const versionVariations = ["version", "--version", "-v"];

  for (const versionCmd of versionVariations) {
    const result = await cliInstance.run([versionCmd]);

    assertEquals(result.ok, true);
    // Version returns just the version number
    assertEquals(typeof result.data, "string");
  }
});

Deno.test("CLI E2E - no arguments shows help", async () => {
  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const result = await cliInstance.run([]);

  assertEquals(result.ok, true);
  assertStringIncludes(
    result.data as string,
    "Frontmatter to Schema Processor",
  );
});

Deno.test("CLI E2E - unknown command error", async () => {
  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const result = await cliInstance.run(["unknown-command"]);

  assertEquals(result.ok, false);
  assertEquals(result.error?.code, "UNKNOWN_COMMAND");
  assertStringIncludes(
    result.error?.message || "",
    "Unknown command: unknown-command",
  );
});

Deno.test("CLI E2E - insufficient arguments for process command", async () => {
  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const result = await cliInstance.run(["process", "schema.json"]);

  assertEquals(result.ok, false);
  assertEquals(result.error?.code, "INVALID_ARGUMENTS");
  assertStringIncludes(result.error?.message || "", "Insufficient arguments");
});

Deno.test("CLI E2E - successful single file processing", async () => {
  await setupE2EEnvironment();

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const outputPath = join(TEST_DIR, "single-output.json");
  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    join(TEST_FIXTURES_DIR, "document.md"),
    outputPath,
  ]);

  assertEquals(result.ok, true);

  // Verify output file was created
  const outputExists = await Deno.stat(outputPath).then(() => true).catch(() =>
    false
  );
  assertEquals(outputExists, true);

  // Verify output content
  const outputContent = await Deno.readTextFile(outputPath);
  const outputJson = JSON.parse(outputContent);
  assertEquals(outputJson.output.title, "E2E Test Document");
  assertEquals(outputJson.output.author, "E2E Test Author");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - successful directory processing", async () => {
  await setupE2EEnvironment();

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const outputPath = join(TEST_DIR, "directory-output.json");
  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    join(TEST_FIXTURES_DIR, "docs"),
    outputPath,
  ]);

  assertEquals(result.ok, true);

  // Verify output file was created
  const outputExists = await Deno.stat(outputPath).then(() => true).catch(() =>
    false
  );
  assertEquals(outputExists, true);

  // Verify output content
  const outputContent = await Deno.readTextFile(outputPath);
  const outputJson = JSON.parse(outputContent);
  // For now, just verify the output structure exists
  assertEquals(typeof outputJson.output, "object");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - YAML output format", async () => {
  await setupE2EEnvironment();

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const outputPath = join(TEST_DIR, "yaml-output.yaml");
  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    join(TEST_FIXTURES_DIR, "document.md"),
    outputPath,
    "yaml",
  ]);

  assertEquals(result.ok, true);

  // Verify YAML output file was created
  const outputExists = await Deno.stat(outputPath).then(() => true).catch(() =>
    false
  );
  assertEquals(outputExists, true);

  // Verify YAML format
  const outputContent = await Deno.readTextFile(outputPath);
  assertStringIncludes(outputContent, "title:");
  assertStringIncludes(outputContent, "author:");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - error handling with missing schema file", async () => {
  await setupE2EEnvironment();

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "missing-schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    join(TEST_FIXTURES_DIR, "document.md"),
    join(TEST_DIR, "output.json"),
  ]);

  assertEquals(result.ok, false);
  assertEquals(result.error?.code, "SCHEMA_READ_ERROR");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - error handling with missing template file", async () => {
  await setupE2EEnvironment();

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "schema.json"),
    join(TEST_FIXTURES_DIR, "missing-template.json"),
    join(TEST_FIXTURES_DIR, "document.md"),
    join(TEST_DIR, "output.json"),
  ]);

  assertEquals(result.ok, false);
  assertEquals(result.error?.code, "TEMPLATE_LOAD_ERROR");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - error handling with missing input file", async () => {
  await setupE2EEnvironment();

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    join(TEST_FIXTURES_DIR, "missing-document.md"),
    join(TEST_DIR, "output.json"),
  ]);

  assertEquals(result.ok, false);
  assertEquals(result.error?.code, "INPUT_ACCESS_ERROR");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - error handling with invalid schema content", async () => {
  await setupE2EEnvironment();

  // Create invalid schema file
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "invalid-schema.json"),
    "{ invalid json content",
  );

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "invalid-schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    join(TEST_FIXTURES_DIR, "document.md"),
    join(TEST_DIR, "output.json"),
  ]);

  assertEquals(result.ok, false);
  assertEquals(result.error?.code, "SCHEMA_PARSE_ERROR");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - error handling with empty directory", async () => {
  await setupE2EEnvironment();

  // Create empty directory
  const emptyDir = join(TEST_FIXTURES_DIR, "empty");
  await ensureDir(emptyDir);

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    emptyDir,
    join(TEST_DIR, "output.json"),
  ]);

  assertEquals(result.ok, false);
  assertEquals(result.error?.code, "NO_DOCUMENTS_FOUND");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - complex frontmatter processing", async () => {
  await setupE2EEnvironment();

  // Create document with complex frontmatter
  const complexMarkdown = `---
title: "Complex Document"
author: 'Jane Doe'
tags: ["complex", "frontmatter", "e2e"]
published: true
metadata:
  category: technical
  priority: high
nested:
  level1:
    level2: "deep value"
---

# Complex Document

This document has complex frontmatter structure for E2E testing.

## Features

- Quoted strings
- Array values
- Nested objects
- Boolean values
`;
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "complex-document.md"),
    complexMarkdown,
  );

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const outputPath = join(TEST_DIR, "complex-output.json");
  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    join(TEST_FIXTURES_DIR, "complex-document.md"),
    outputPath,
  ]);

  assertEquals(result.ok, true);

  // Verify complex frontmatter was processed correctly
  const outputContent = await Deno.readTextFile(outputPath);
  const outputJson = JSON.parse(outputContent);
  assertEquals(outputJson.output.title, "Complex Document");
  assertEquals(outputJson.output.author, "Jane Doe");

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - document without frontmatter", async () => {
  await setupE2EEnvironment();

  // Create document without frontmatter
  const noFrontmatterMarkdown = `# Document Without Frontmatter

This document has no frontmatter block and should still be processed.

## Content

The CLI should handle documents without frontmatter gracefully.
`;
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "no-frontmatter.md"),
    noFrontmatterMarkdown,
  );

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const outputPath = join(TEST_DIR, "no-frontmatter-output.json");
  const result = await cliInstance.run([
    "process",
    join(TEST_FIXTURES_DIR, "schema.json"),
    join(TEST_FIXTURES_DIR, "template.json"),
    join(TEST_FIXTURES_DIR, "no-frontmatter.md"),
    outputPath,
  ]);

  assertEquals(result.ok, true);

  // Should still create output file
  const outputExists = await Deno.stat(outputPath).then(() => true).catch(() =>
    false
  );
  assertEquals(outputExists, true);

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - concurrent CLI instances", async () => {
  await setupE2EEnvironment();

  // Test multiple CLI instances running concurrently
  const concurrentOperations = Array.from({ length: 3 }, async (_, i) => {
    const cli = CLI.create();
    assertEquals(cli.ok, true);
    const cliInstance = cli.data!;

    const outputPath = join(TEST_DIR, `concurrent-output-${i}.json`);
    return await cliInstance.run([
      "process",
      join(TEST_FIXTURES_DIR, "schema.json"),
      join(TEST_FIXTURES_DIR, "template.json"),
      join(TEST_FIXTURES_DIR, "document.md"),
      outputPath,
    ]);
  });

  const results = await Promise.all(concurrentOperations);

  // All operations should succeed
  for (const result of results) {
    assertEquals(result.ok, true);
  }

  // Verify all output files were created
  for (let i = 0; i < 3; i++) {
    const outputPath = join(TEST_DIR, `concurrent-output-${i}.json`);
    const outputExists = await Deno.stat(outputPath).then(() => true).catch(
      () => false,
    );
    assertEquals(outputExists, true);
  }

  await cleanupE2EEnvironment();
});
