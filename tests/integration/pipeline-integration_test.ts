import { assertEquals } from "@std/assert";
import { ensureDir } from "@std/fs";
import { join } from "@std/path";
import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../src/infrastructure/adapters/deno-file-system-adapter.ts";

/**
 * Integration tests for PipelineOrchestrator with real file system operations
 * Tests complete pipeline flows with actual file I/O using totality principles
 */

const TEST_DIR = "./tmp/test-integration";
const TEST_FIXTURES_DIR = "./tests/fixtures";

async function setupTestEnvironment() {
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
    join(TEST_FIXTURES_DIR, "test-schema.json"),
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
    join(TEST_FIXTURES_DIR, "test-template.json"),
    JSON.stringify(testTemplate, null, 2),
  );

  // Create test markdown document
  const testMarkdown = `---
title: Integration Test Document
author: Test Author
tags: ["test", "integration"]
published: true
---

# Test Document

This is a test document for integration testing.

## Content

This document tests the complete pipeline flow.
`;
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "test-document.md"),
    testMarkdown,
  );

  // Create multiple test documents for directory processing
  const testMarkdown1 = `---
title: Document One
author: Author One
tags: ["doc1", "test"]
published: true
---

# Document One Content
`;
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "doc1.md"),
    testMarkdown1,
  );

  const testMarkdown2 = `---
title: Document Two
author: Author Two
tags: ["doc2", "test"]
published: false
---

# Document Two Content
`;
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "doc2.md"),
    testMarkdown2,
  );
}

async function cleanupTestEnvironment() {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
    await Deno.remove(TEST_FIXTURES_DIR, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

Deno.test("Pipeline Integration - single document processing", async () => {
  await setupTestEnvironment();

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestratorResult = PipelineOrchestrator.create(fileSystem);
  assertEquals(orchestratorResult.isOk(), true);

  const orchestrator = orchestratorResult.unwrap();
  const outputPath = join(TEST_DIR, "single-output.json");

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
    inputPath: join(TEST_FIXTURES_DIR, "test-document.md"),
    outputPath,
    outputFormat: "json",
  });

  assertEquals(result.isOk(), true);

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 1);
  assertEquals(pipelineResult.outputPath, outputPath);
  assertEquals(pipelineResult.metadata.outputFormat, "json");
  assertEquals(typeof pipelineResult.executionTime, "number");
  assertEquals(pipelineResult.executionTime >= 0, true);

  // Verify output file was created and contains expected content
  const outputContent = await Deno.readTextFile(outputPath);
  const outputJson = JSON.parse(outputContent);

  assertEquals(outputJson.output.title, "Integration Test Document");
  assertEquals(outputJson.output.author, "Test Author");
  assertEquals(outputJson.output.metadata.published, "true");

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - directory processing", async () => {
  await setupTestEnvironment();

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();
  const outputPath = join(TEST_DIR, "directory-output.json");

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
    inputPath: TEST_FIXTURES_DIR,
    outputPath,
    outputFormat: "json",
  });

  assertEquals(result.isOk(), true);

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 3); // test-document.md, doc1.md, doc2.md
  assertEquals(pipelineResult.outputPath, outputPath);

  // Verify output file contains aggregated data
  const outputContent = await Deno.readTextFile(outputPath);
  const outputJson = JSON.parse(outputContent);

  // For now, just verify the output structure exists
  assertEquals(typeof outputJson.output, "object");

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - YAML output format", async () => {
  await setupTestEnvironment();

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();
  const outputPath = join(TEST_DIR, "yaml-output.yaml");

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
    inputPath: join(TEST_FIXTURES_DIR, "test-document.md"),
    outputPath,
    outputFormat: "yaml",
  });

  assertEquals(result.isOk(), true);

  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.metadata.outputFormat, "yaml");

  // Verify YAML file was created and contains expected format
  const outputContent = await Deno.readTextFile(outputPath);
  assertEquals(outputContent.includes("title:"), true);
  assertEquals(outputContent.includes("author:"), true);

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - error handling with invalid schema", async () => {
  await setupTestEnvironment();

  // Create invalid schema
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "invalid-schema.json"),
    "{ invalid json",
  );

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "invalid-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
    inputPath: join(TEST_FIXTURES_DIR, "test-document.md"),
    outputPath: join(TEST_DIR, "error-output.json"),
  });

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "SCHEMA_PARSE_ERROR");

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - error handling with missing template", async () => {
  await setupTestEnvironment();

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "non-existent-template.json"),
    inputPath: join(TEST_FIXTURES_DIR, "test-document.md"),
    outputPath: join(TEST_DIR, "error-output.json"),
  });

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "TEMPLATE_LOAD_ERROR");

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - error handling with missing input", async () => {
  await setupTestEnvironment();

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
    inputPath: join(TEST_FIXTURES_DIR, "non-existent.md"),
    outputPath: join(TEST_DIR, "error-output.json"),
  });

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "NO_FILES_FOUND");

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - complex frontmatter processing", async () => {
  await setupTestEnvironment();

  // Create document with complex frontmatter
  const complexMarkdown = `---
title: "Complex Document"
author: 'John Doe'
tags: ["complex", "frontmatter", "test"]
published: true
metadata:
  category: technical
  priority: high
nested:
  level1:
    level2: "deep value"
---

# Complex Document

This document has complex frontmatter structure.
`;
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "complex-document.md"),
    complexMarkdown,
  );

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();
  const outputPath = join(TEST_DIR, "complex-output.json");

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
    inputPath: join(TEST_FIXTURES_DIR, "complex-document.md"),
    outputPath,
  });

  assertEquals(result.isOk(), true);

  // Verify the complex frontmatter was processed
  const outputContent = await Deno.readTextFile(outputPath);
  const outputJson = JSON.parse(outputContent);

  assertEquals(outputJson.output.title, "Complex Document");
  assertEquals(outputJson.output.author, "John Doe");

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - document without frontmatter", async () => {
  await setupTestEnvironment();

  // Create document without frontmatter
  const noFrontmatterMarkdown = `# Document Without Frontmatter

This document has no frontmatter block.

## Content

Just plain markdown content.
`;
  await Deno.writeTextFile(
    join(TEST_FIXTURES_DIR, "no-frontmatter.md"),
    noFrontmatterMarkdown,
  );

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();
  const outputPath = join(TEST_DIR, "no-frontmatter-output.json");

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
    inputPath: join(TEST_FIXTURES_DIR, "no-frontmatter.md"),
    outputPath,
  });

  assertEquals(result.isOk(), true);

  // Should still process successfully, even without frontmatter
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 1);

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - empty directory handling", async () => {
  await setupTestEnvironment();

  // Create empty directory
  const emptyDir = join(TEST_FIXTURES_DIR, "empty-dir");
  await ensureDir(emptyDir);

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const result = await orchestrator.execute({
    schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
    templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
    inputPath: emptyDir,
    outputPath: join(TEST_DIR, "empty-output.json"),
  });

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "NO_DOCUMENTS_FOUND");

  await cleanupTestEnvironment();
});

Deno.test("Pipeline Integration - concurrent pipeline executions", async () => {
  await setupTestEnvironment();

  const fileSystem = DenoFileSystemAdapter.create();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  // Run multiple pipeline executions concurrently
  const concurrentExecutions = Array.from({ length: 3 }, async (_, i) => {
    const outputPath = join(TEST_DIR, `concurrent-output-${i}.json`);

    return await orchestrator.execute({
      schemaPath: join(TEST_FIXTURES_DIR, "test-schema.json"),
      templatePath: join(TEST_FIXTURES_DIR, "test-template.json"),
      inputPath: join(TEST_FIXTURES_DIR, "test-document.md"),
      outputPath,
    });
  });

  const results = await Promise.all(concurrentExecutions);

  // All executions should succeed
  for (const result of results) {
    assertEquals(result.isOk(), true);
    assertEquals(result.unwrap().processedDocuments, 1);
  }

  // Verify all output files were created
  for (let i = 0; i < 3; i++) {
    const outputPath = join(TEST_DIR, `concurrent-output-${i}.json`);
    const outputContent = await Deno.readTextFile(outputPath);
    const outputJson = JSON.parse(outputContent);
    assertEquals(outputJson.output.title, "Integration Test Document");
  }

  await cleanupTestEnvironment();
});
