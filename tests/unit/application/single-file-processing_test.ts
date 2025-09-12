/**
 * Tests for single file processing (Issue #694)
 * 
 * Validates that the CLI correctly processes single markdown files
 * instead of treating them as directories
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { ProcessCoordinator } from "../../../src/application/process-coordinator.ts";
import type { ProcessingConfiguration } from "../../../src/application/process-coordinator.ts";

Deno.test("ProcessCoordinator - Single File Processing", async (t) => {
  const processCoordinator = new ProcessCoordinator();

  // Create test fixtures
  async function setupFixtures() {
    await Deno.mkdir("tests/fixtures/single-file", { recursive: true });
    
    // Create a single test file
    await Deno.writeTextFile(
      "tests/fixtures/single-file/test.md",
      `---
title: Test Document
author: Test Author
---

# Test Content

This is a test document for single file processing.`
    );

    // Create test schema
    await Deno.writeTextFile(
      "tests/fixtures/single-file/schema.json",
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "author": { "type": "string" }
        }
      }, null, 2)
    );

    // Create test template
    await Deno.writeTextFile(
      "tests/fixtures/single-file/template.json",
      JSON.stringify({
        "title": "{title}",
        "author": "{author}"
      }, null, 2)
    );
  }

  async function cleanupFixtures() {
    try {
      await Deno.remove("tests/fixtures/single-file", { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  await setupFixtures();

  await t.step("should process single markdown file without treating it as directory", async () => {
    const config: ProcessingConfiguration = {
      kind: "basic",
      schema: {
        path: "tests/fixtures/single-file/schema.json",
        format: "json" as const,
      },
      input: {
        pattern: "*.md",
        baseDirectory: "tests/fixtures/single-file/test.md", // Single file as base
      },
      template: {
        kind: "inline" as const,
        definition: '{"title": "{title}", "author": "{author}"}',
        format: "json" as const,
      },
      output: {
        path: "/tmp/single-file-test.json",
        format: "json" as const,
      },
    };

    const result = await processCoordinator.processDocuments(config);

    // Should successfully process the single file
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.processedFiles, 1);
      assertExists(result.data.renderedContent);
      
      // Check that the content was properly rendered
      const content = JSON.parse(result.data.renderedContent.content);
      assertEquals(content.title, "Test Document");
      assertEquals(content.author, "Test Author");
    }
  });

  await t.step("should handle single file with .markdown extension", async () => {
    // Create a .markdown file
    await Deno.writeTextFile(
      "tests/fixtures/single-file/test.markdown",
      `---
title: Markdown Test
---

# Content`
    );

    const config: ProcessingConfiguration = {
      kind: "basic",
      schema: {
        path: "tests/fixtures/single-file/schema.json",
        format: "json" as const,
      },
      input: {
        pattern: "*.markdown",
        baseDirectory: "tests/fixtures/single-file/test.markdown",
      },
      template: {
        kind: "inline" as const,
        definition: '{"title": "{title}"}',
        format: "json" as const,
      },
      output: {
        path: "/tmp/single-file-markdown.json",
        format: "json" as const,
      },
    };

    const result = await processCoordinator.processDocuments(config);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.processedFiles, 1);
    }
  });

  await t.step("should return error for non-markdown single file", async () => {
    // Create a non-markdown file
    await Deno.writeTextFile(
      "tests/fixtures/single-file/test.txt",
      "This is not a markdown file"
    );

    const config: ProcessingConfiguration = {
      kind: "basic",
      schema: {
        path: "tests/fixtures/single-file/schema.json",
        format: "json" as const,
      },
      input: {
        pattern: "*.txt",
        baseDirectory: "tests/fixtures/single-file/test.txt",
      },
      template: {
        kind: "inline" as const,
        definition: '{}',
        format: "json" as const,
      },
      output: {
        path: "/tmp/single-file-txt.json",
        format: "json" as const,
      },
    };

    const result = await processCoordinator.processDocuments(config);

    // Should fail or return no files since it's not markdown
    if (result.ok) {
      assertEquals(result.data.processedFiles, 0);
    }
  });

  await t.step("should handle directory processing as before", async () => {
    // Create multiple files in directory
    await Deno.writeTextFile(
      "tests/fixtures/single-file/doc1.md",
      `---
title: Doc 1
---
Content 1`
    );

    await Deno.writeTextFile(
      "tests/fixtures/single-file/doc2.md",
      `---
title: Doc 2
---
Content 2`
    );

    const config: ProcessingConfiguration = {
      kind: "basic",
      schema: {
        path: "tests/fixtures/single-file/schema.json",
        format: "json" as const,
      },
      input: {
        pattern: "*.md",
        baseDirectory: "tests/fixtures/single-file", // Directory, not file
      },
      template: {
        kind: "inline" as const,
        definition: '{"documents": "{documents}"}',
        format: "json" as const,
      },
      output: {
        path: "/tmp/directory-test.json",
        format: "json" as const,
      },
    };

    const result = await processCoordinator.processDocuments(config);

    assertEquals(result.ok, true);
    if (result.ok) {
      // Should process multiple files from directory
      assertExists(result.data.processedFiles);
      assertEquals(result.data.processedFiles >= 2, true);
    }
  });

  await cleanupFixtures();
});

Deno.test("FileDiscoveryService - Single File Handling", async (t) => {
  const { FileDiscoveryService } = await import("../../../src/infrastructure/file-system/file-discovery.service.ts");
  const { DocumentPath } = await import("../../../src/domain/models/value-objects.ts");
  
  const service = new FileDiscoveryService();

  await t.step("should handle single markdown file in findMarkdownFiles", async () => {
    // Create a test file
    await Deno.mkdir("tests/fixtures/file-discovery", { recursive: true });
    await Deno.writeTextFile(
      "tests/fixtures/file-discovery/single.md",
      "# Test"
    );

    const pathResult = DocumentPath.create("tests/fixtures/file-discovery/single.md");
    assertEquals(pathResult.ok, true);
    
    if (pathResult.ok) {
      const result = await service.findMarkdownFiles(pathResult.data);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1);
        assertEquals(result.data[0], "tests/fixtures/file-discovery/single.md");
      }
    }

    // Cleanup
    await Deno.remove("tests/fixtures/file-discovery", { recursive: true });
  });
});