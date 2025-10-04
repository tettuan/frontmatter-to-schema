import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { ensureDir } from "@std/fs";
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

  // Create test schema with x-frontmatter-part for multiple document support
  const testSchema = {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      published: { type: "boolean" },
      documents: {
        type: "array",
        "x-frontmatter-part": true,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            author: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            published: { type: "boolean" },
          },
        },
      },
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

Deno.test("CLI E2E - glob pattern expansion with quoted patterns", async () => {
  await setupE2EEnvironment();

  // Create multiple test documents
  const doc1Content = `---
title: "Glob Test Doc 1"
author: "Test Author 1"
tags: ["test", "glob"]
published: true
---
# Glob Test Document 1`;

  const doc2Content = `---
title: "Glob Test Doc 2"
author: "Test Author 2"
tags: ["test", "glob", "pattern"]
published: true
---
# Glob Test Document 2`;

  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "glob-test-1.md"),
    doc1Content,
  );
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "glob-test-2.md"),
    doc2Content,
  );

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  // Create schema with x-template directive (use relative filename only)
  const schemaWithTemplate = {
    type: "object",
    properties: {
      title: { type: "string" },
      author: { type: "string" },
    },
    "x-template": "template.json",
  };
  const schemaPath = join(TEST_FIXTURES_DIR, "schema-with-template.json");
  await Deno.writeTextFile(
    schemaPath,
    JSON.stringify(schemaWithTemplate, null, 2),
  );

  const outputPath = join(TEST_DIR, "glob-output.json");

  // Test glob pattern (simulates quoted pattern from command line)
  // New argument order: <schema> <output> <input...> [--verbose]
  const globPattern = join(TEST_FIXTURES_DIR, "glob-test-*.md");
  const result = await cliInstance.run([
    schemaPath,
    outputPath,
    globPattern,
    "--verbose",
  ]);

  assertEquals(result.ok, true, "Glob pattern should be expanded successfully");

  // Verify output file was created
  const outputExists = await Deno.stat(outputPath).then(() => true).catch(() =>
    false
  );
  assertEquals(outputExists, true);

  // Verify output was generated (glob expansion succeeded)
  // Note: The template uses ${} syntax which gets processed by the template engine
  const outputContent = await Deno.readTextFile(outputPath);
  const outputJson = JSON.parse(outputContent);
  assertExists(outputJson.output, "Output should contain processed data");

  await cleanupE2EEnvironment();
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
  assertEquals(result.error?.code, "NO_FILES_FOUND");

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
  assertEquals(result.error?.code, "NO_FILES_FOUND");

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

Deno.test("CLI E2E - multi-directory glob pattern (Issue #1285)", async () => {
  await setupE2EEnvironment();

  // Clean up docs directory to remove doc1.md and doc2.md created by setup
  const docsDir = join(TEST_FIXTURES_DIR, "docs");
  await Deno.remove(docsDir, { recursive: true }).catch(() => {});

  // Create multi-directory structure
  const frontendDir = join(TEST_FIXTURES_DIR, "docs/frontend");
  const backendDir = join(TEST_FIXTURES_DIR, "docs/backend");
  const apiDir = join(TEST_FIXTURES_DIR, "docs/api");

  await ensureDir(frontendDir);
  await ensureDir(backendDir);
  await ensureDir(apiDir);

  // Create documents in different subdirectories
  const doc1 = `---
title: "Frontend Component"
category: "frontend"
tags: ["react", "component"]
published: true
---
# Frontend Component`;

  const doc2 = `---
title: "Backend Database"
category: "backend"
tags: ["database", "postgresql"]
published: true
---
# Backend Database`;

  const doc3 = `---
title: "REST API"
category: "api"
tags: ["rest", "api"]
published: false
---
# REST API`;

  await Deno.writeTextFile(join(frontendDir, "component.md"), doc1);
  await Deno.writeTextFile(join(backendDir, "database.md"), doc2);
  await Deno.writeTextFile(join(apiDir, "rest-api.md"), doc3);

  // Create schema with x-template
  const schema = {
    type: "object",
    properties: {
      documents: {
        type: "array",
        "x-frontmatter-part": true,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            published: { type: "boolean" },
          },
        },
      },
      categories: {
        type: "array",
        "x-derived-from": "documents[].category",
        "x-derived-unique": true,
        items: { type: "string" },
      },
    },
    "x-template": "template.json",
  };

  const schemaPath = join(TEST_FIXTURES_DIR, "multi-dir-schema.json");
  await Deno.writeTextFile(schemaPath, JSON.stringify(schema, null, 2));

  // Create template
  const template = {
    documents: "{@items}",
    categories: "{categories}",
  };
  const templatePath = join(TEST_FIXTURES_DIR, "template.json");
  await Deno.writeTextFile(templatePath, JSON.stringify(template, null, 2));

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const outputPath = join(TEST_DIR, "multi-dir-output.json");

  // Test 1: Glob pattern across multiple directories (SHOULD WORK but currently fails)
  // Pattern: docs/**/*.md expands to files in frontend/, backend/, api/
  const globPattern = join(TEST_FIXTURES_DIR, "docs/**/*.md");
  const result = await cliInstance.run([
    schemaPath,
    outputPath,
    globPattern,
    "--verbose",
  ]);

  // This currently fails with "No valid documents found in directory"
  // because CLI finds common parent "docs/" which has no .md files directly
  assertEquals(
    result.ok,
    true,
    "Multi-directory glob pattern should process all files (Issue #1285)",
  );

  if (result.ok) {
    const outputContent = await Deno.readTextFile(outputPath);
    const outputJson = JSON.parse(outputContent);
    assertEquals(
      outputJson.documents.length,
      3,
      "Should process all 3 documents",
    );
    assertEquals(
      outputJson.categories.length,
      3,
      "Should derive 3 unique categories",
    );
  }

  await cleanupE2EEnvironment();
});

Deno.test("CLI E2E - recursive directory processing (Issue #1285)", async () => {
  await setupE2EEnvironment();

  // Clean up docs directory to remove doc1.md and doc2.md created by setup
  const docsPath = join(TEST_FIXTURES_DIR, "docs");
  await Deno.remove(docsPath, { recursive: true }).catch(() => {});

  // Reuse the same multi-directory structure
  const frontendDir = join(TEST_FIXTURES_DIR, "docs/frontend");
  const backendDir = join(TEST_FIXTURES_DIR, "docs/backend");

  await ensureDir(frontendDir);
  await ensureDir(backendDir);

  const doc1 = `---
title: "Doc 1"
category: "frontend"
---
# Doc 1`;

  const doc2 = `---
title: "Doc 2"
category: "backend"
---
# Doc 2`;

  await Deno.writeTextFile(join(frontendDir, "doc1.md"), doc1);
  await Deno.writeTextFile(join(backendDir, "doc2.md"), doc2);

  const schema = {
    type: "object",
    properties: {
      documents: {
        type: "array",
        "x-frontmatter-part": true,
        items: { type: "object" },
      },
    },
    "x-template": "template.json",
  };

  const schemaPath = join(TEST_FIXTURES_DIR, "recursive-schema.json");
  await Deno.writeTextFile(schemaPath, JSON.stringify(schema, null, 2));

  const template = { documents: "{@items}" };
  const templatePath = join(TEST_FIXTURES_DIR, "template.json");
  await Deno.writeTextFile(templatePath, JSON.stringify(template, null, 2));

  const cli = CLI.create();
  assertEquals(cli.ok, true);
  const cliInstance = cli.data!;

  const outputPath = join(TEST_DIR, "recursive-output.json");

  // Test 2: Directory path (should recursively search subdirectories)
  const docsDir = join(TEST_FIXTURES_DIR, "docs");
  const result = await cliInstance.run([
    schemaPath,
    outputPath,
    docsDir,
    "--verbose",
  ]);

  // This currently fails because DirectoryStrategy only reads immediate children
  assertEquals(
    result.ok,
    true,
    "Directory processing should be recursive (Issue #1285)",
  );

  if (result.ok) {
    const outputContent = await Deno.readTextFile(outputPath);
    const outputJson = JSON.parse(outputContent);
    assertEquals(
      outputJson.documents.length,
      2,
      "Should find documents in subdirectories",
    );
  }

  await cleanupE2EEnvironment();
});
