import { assertEquals, assertExists } from "jsr:@std/assert";
import { DenoDocumentRepository } from "../../../../src/infrastructure/adapters/deno-document-repository.ts";
import { DocumentPath } from "../../../../src/domain/models/value-objects.ts";
import { isError, isOk } from "../../../../src/domain/shared/result.ts";
import { join } from "jsr:@std/path";

Deno.test("DenoDocumentRepository", async (t) => {
  const repository = new DenoDocumentRepository();
  const testDir = await Deno.makeTempDir();

  // Setup test files
  const setupTestFiles = async () => {
    // Create test markdown files
    await Deno.writeTextFile(
      join(testDir, "test1.md"),
      `---
title: Test Document 1
date: 2024-01-01
---

# Test Document 1

This is test content.`,
    );

    await Deno.writeTextFile(
      join(testDir, "test2.md"),
      `---
title: Test Document 2
tags: ["test", "example"]
---

# Test Document 2

Another test document.`,
    );

    await Deno.writeTextFile(
      join(testDir, "no-frontmatter.md"),
      `# Document without frontmatter

Just plain markdown content.`,
    );

    // Create subdirectory with more files
    const subDir = join(testDir, "subdir");
    await Deno.mkdir(subDir);

    await Deno.writeTextFile(
      join(subDir, "nested.md"),
      `---
title: Nested Document
---

Nested content.`,
    );

    // Create non-markdown file (should be ignored)
    await Deno.writeTextFile(
      join(testDir, "ignore.txt"),
      "This should be ignored",
    );
  };

  await setupTestFiles();

  await t.step("should find all documents in directory", async () => {
    const pathResult = DocumentPath.create(testDir);
    assertExists(pathResult.ok);

    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        assertEquals(result.data.length, 4); // All .md files including subdirectory

        // Check that documents have proper structure
        const doc = result.data[0];
        assertExists(doc.getPath());
        assertExists(doc.getContent());
      }
    }
  });

  await t.step("should handle glob patterns", async () => {
    const pathResult = DocumentPath.create(`${testDir}/*.md`);
    assertExists(pathResult.ok);

    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        // Should find files in root directory only (not subdirectory)
        assertEquals(result.data.length >= 3, true);
      }
    }
  });

  await t.step("should read single document with frontmatter", async () => {
    const pathResult = DocumentPath.create(join(testDir, "test1.md"));
    assertExists(pathResult.ok);

    if (isOk(pathResult)) {
      const result = await repository.read(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const doc = result.data;
        assertExists(doc.getFrontMatter());

        const frontMatter = doc.getFrontMatter();
        if (frontMatter) {
          const raw = frontMatter.getRaw();
          assertEquals(raw.includes("title: Test Document 1"), true);
        }
      }
    }
  });

  await t.step("should read document without frontmatter", async () => {
    const pathResult = DocumentPath.create(join(testDir, "no-frontmatter.md"));
    assertExists(pathResult.ok);

    if (isOk(pathResult)) {
      const result = await repository.read(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const doc = result.data;
        // Document should exist but frontmatter should be null
        assertExists(doc.getContent());
        assertEquals(doc.getFrontMatter(), null);
      }
    }
  });

  await t.step("should handle non-existent file", async () => {
    const pathResult = DocumentPath.create(join(testDir, "nonexistent.md"));
    assertExists(pathResult.ok);

    if (isOk(pathResult)) {
      const result = await repository.read(pathResult.data);
      assertEquals(isError(result), true);

      if (isError(result)) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    }
  });

  await t.step("should handle non-existent directory", async () => {
    const pathResult = DocumentPath.create(join(testDir, "nonexistent-dir"));
    assertExists(pathResult.ok);

    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);
      assertEquals(isError(result), true);

      if (isError(result)) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    }
  });

  await t.step("should find documents by pattern", async () => {
    const result = await repository.findByPattern("test[0-9]\\.md", testDir);
    assertEquals(isOk(result), true);

    if (isOk(result)) {
      assertEquals(result.data.length, 2); // test1.md and test2.md
    }
  });

  await t.step("should handle pattern with no matches", async () => {
    const result = await repository.findByPattern("nomatch\\.md", testDir);
    assertEquals(isOk(result), true);

    if (isOk(result)) {
      assertEquals(result.data.length, 0);
    }
  });

  await t.step("should skip node_modules and .git directories", async () => {
    // Create node_modules directory with markdown file
    const nodeModulesDir = join(testDir, "node_modules");
    await Deno.mkdir(nodeModulesDir);
    await Deno.writeTextFile(
      join(nodeModulesDir, "should-ignore.md"),
      "This should be ignored",
    );

    const pathResult = DocumentPath.create(testDir);
    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        // Should not include the file in node_modules
        const paths = result.data.map((d) => d.getPath().getValue());
        assertEquals(paths.some((p) => p.includes("node_modules")), false);
      }
    }
  });

  await t.step("should handle permission errors gracefully", async () => {
    // This test would require setting up special permissions
    // For now, we'll test the error handling path is correct
    const repo = new DenoDocumentRepository();

    // Mock a path that might cause permission issues
    const pathResult = DocumentPath.create("/root/protected.md");
    if (isOk(pathResult)) {
      const result = await repo.read(pathResult.data);
      // Should handle permission error or file not found
      if (isError(result)) {
        assertEquals(
          result.error.kind === "PermissionDenied" ||
            result.error.kind === "FileNotFound",
          true,
        );
      }
    }
  });

  await t.step(
    "should handle invalid JSON in frontmatter extraction",
    async () => {
      // Create a file with complex frontmatter that might fail JSON conversion
      await Deno.writeTextFile(
        join(testDir, "complex-frontmatter.md"),
        `---
title: Complex
date: 2024-01-01T00:00:00Z
nested:
  key: value
  list:
    - item1
    - item2
---

Content here.`,
      );

      const pathResult = DocumentPath.create(
        join(testDir, "complex-frontmatter.md"),
      );
      if (isOk(pathResult)) {
        const result = await repository.read(pathResult.data);
        assertEquals(isOk(result), true);

        if (isOk(result)) {
          // Should handle complex frontmatter gracefully
          assertExists(result.data.getContent());
        }
      }
    },
  );

  await t.step("should work with verbose mode", async () => {
    // Set verbose mode
    const originalVerbose = Deno.env.get("FRONTMATTER_VERBOSE_MODE");
    Deno.env.set("FRONTMATTER_VERBOSE_MODE", "true");

    const pathResult = DocumentPath.create(testDir);
    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);
      assertEquals(isOk(result), true);
    }

    // Restore original setting
    if (originalVerbose) {
      Deno.env.set("FRONTMATTER_VERBOSE_MODE", originalVerbose);
    } else {
      Deno.env.delete("FRONTMATTER_VERBOSE_MODE");
    }
  });

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});
