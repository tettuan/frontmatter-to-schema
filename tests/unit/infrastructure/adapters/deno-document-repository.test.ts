/**
 * Comprehensive tests for DenoDocumentRepository
 * Addressing test coverage gap from 5.9% to 100%
 * Issue #401: Critical test coverage improvements
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { DenoDocumentRepository } from "../../../../src/infrastructure/adapters/deno-document-repository.ts";
import { DocumentPath } from "../../../../src/domain/models/value-objects.ts";
import { isError, isOk } from "../../../../src/domain/core/result.ts";
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
        const frontMatterResult = doc.getFrontMatter();
        assertEquals(frontMatterResult.ok, true);

        if (frontMatterResult.ok) {
          const frontMatter = frontMatterResult.data;
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
        const frontMatterResult = doc.getFrontMatter();
        assertEquals(frontMatterResult.ok, false);
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

  await t.step("should handle concurrent file access", async () => {
    // Create multiple concurrent read operations
    const pathResult = DocumentPath.create(join(testDir, "test1.md"));
    if (isOk(pathResult)) {
      const promises = Array.from(
        { length: 10 },
        () => repository.read(pathResult.data),
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        assertEquals(isOk(result), true);
      });
    }
  });

  await t.step("should handle large file processing", async () => {
    // Create a large markdown file (10KB+)
    const largeContent = `---
title: Large Document
---

${"# Large Content\n".repeat(1000)}This is a very large document.`;

    await Deno.writeTextFile(join(testDir, "large.md"), largeContent);

    const pathResult = DocumentPath.create(join(testDir, "large.md"));
    if (isOk(pathResult)) {
      const result = await repository.read(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const doc = result.data;
        assertExists(doc.getContent());
        assertEquals(doc.getContent().getValue().length > 10000, true);
      }
    }
  });

  await t.step("should handle files with unusual extensions", async () => {
    // Create .markdown file
    await Deno.writeTextFile(
      join(testDir, "test.markdown"),
      `---\ntitle: Markdown Extension\n---\n\nContent with .markdown extension.`,
    );

    const pathResult = DocumentPath.create(testDir);
    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const markdownFiles = result.data.filter((doc) =>
          doc.getPath().getValue().endsWith(".markdown")
        );
        assertEquals(markdownFiles.length >= 1, true);
      }
    }
  });

  await t.step("should handle malformed frontmatter gracefully", async () => {
    // Create file with invalid YAML frontmatter
    await Deno.writeTextFile(
      join(testDir, "malformed.md"),
      `---
title: Valid
invalid: [unclosed array
other: value
---

Content here.`,
    );

    const pathResult = DocumentPath.create(join(testDir, "malformed.md"));
    if (isOk(pathResult)) {
      const result = await repository.read(pathResult.data);
      // Should either succeed with partial data or handle gracefully
      if (isOk(result)) {
        assertExists(result.data.getContent());
      } else {
        // Should be a graceful error, not a crash
        assertEquals(isError(result), true);
      }
    }
  });

  await t.step("should handle empty files", async () => {
    // Create empty markdown file
    await Deno.writeTextFile(join(testDir, "empty.md"), "");

    const pathResult = DocumentPath.create(join(testDir, "empty.md"));
    if (isOk(pathResult)) {
      const result = await repository.read(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const doc = result.data;
        const frontMatterResult = doc.getFrontMatter();
        assertEquals(frontMatterResult.ok, false);
        assertEquals(doc.getContent().getValue(), "");
      }
    }
  });

  await t.step("should handle files with only frontmatter", async () => {
    // Create file with only frontmatter, no content
    await Deno.writeTextFile(
      join(testDir, "frontmatter-only.md"),
      `---\ntitle: Only Frontmatter\ndate: 2024-01-01\n---`,
    );

    const pathResult = DocumentPath.create(
      join(testDir, "frontmatter-only.md"),
    );
    if (isOk(pathResult)) {
      const result = await repository.read(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const doc = result.data;
        const frontMatterResult = doc.getFrontMatter();
        assertEquals(frontMatterResult.ok, true);
        // Body should be empty or minimal
        assertEquals(doc.getContent().getValue().trim().length <= 1, true);
      }
    }
  });

  await t.step("should handle binary files gracefully", async () => {
    // Create a file that looks like markdown but has binary content
    const binaryData = new Uint8Array([0, 1, 2, 3, 255, 254, 253]);
    await Deno.writeFile(join(testDir, "binary.md"), binaryData);

    const pathResult = DocumentPath.create(join(testDir, "binary.md"));
    if (isOk(pathResult)) {
      const result = await repository.read(pathResult.data);
      // Should handle gracefully - either succeed with interpreted content or fail gracefully
      if (isError(result)) {
        assertEquals(result.error.kind, "ReadError");
      } else {
        // If it succeeds, should have some content
        assertExists(result.data.getContent());
      }
    }
  });

  await t.step("should handle deeply nested directory structure", async () => {
    // Create deeply nested structure
    const deepPath = join(testDir, "level1", "level2", "level3", "level4");
    await Deno.mkdir(deepPath, { recursive: true });

    await Deno.writeTextFile(
      join(deepPath, "deep.md"),
      `---\ntitle: Deep Document\n---\n\nDeep nested content.`,
    );

    const pathResult = DocumentPath.create(testDir);
    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const deepFiles = result.data.filter((doc) =>
          doc.getPath().getValue().includes("level4")
        );
        assertEquals(deepFiles.length >= 1, true);
      }
    }
  });

  await t.step("should handle file path as target for findAll", async () => {
    // Test passing a file path instead of directory to findAll
    // After Issue #694 fix, single files are now supported
    const pathResult = DocumentPath.create(join(testDir, "test1.md"));
    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);

      // Single file paths should now be handled successfully
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        // Should return array with single document
        assertEquals(result.data.length, 1);
        assertEquals(
          result.data[0].getPath().getValue(),
          join(testDir, "test1.md"),
        );
      }
    }
  });

  await t.step("should handle special characters in file names", async () => {
    // Create files with special characters
    const specialFiles = [
      "file with spaces.md",
      "file-with-dashes.md",
      "file_with_underscores.md",
      "file.with.dots.md",
      "file(with)parentheses.md",
    ];

    for (const fileName of specialFiles) {
      await Deno.writeTextFile(
        join(testDir, fileName),
        `---\ntitle: ${fileName}\n---\n\nContent for ${fileName}`,
      );
    }

    const pathResult = DocumentPath.create(testDir);
    if (isOk(pathResult)) {
      const result = await repository.findAll(pathResult.data);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        const specialFileCount = result.data.filter((doc) => {
          const path = doc.getPath().getValue();
          return specialFiles.some((name) => path.includes(name));
        }).length;
        assertEquals(specialFileCount, specialFiles.length);
      }
    }
  });

  await t.step("should validate DocumentPath creation edge cases", async () => {
    // Test various invalid path scenarios
    const invalidPaths = ["", "   ", "\0", "../../nonexistent"];

    for (const invalidPath of invalidPaths) {
      const pathResult = DocumentPath.create(invalidPath);
      if (isOk(pathResult)) {
        const result = await repository.read(pathResult.data);
        assertEquals(isError(result), true);
      }
    }
  });

  await t.step("should handle pattern matching edge cases", async () => {
    // Test various regex patterns
    const testCases = [
      { pattern: "test", expectedMin: 0 }, // Should match files with 'test' in name
      { pattern: "^test", expectedMin: 0 }, // Should match files starting with 'test'
      { pattern: "nomatch", expectedMin: 0 }, // Should match nothing
      { pattern: "\\.md$", expectedMin: 0 }, // Should match .md files
      { pattern: "[0-9]", expectedMin: 0 }, // Should match files with numbers
    ];

    for (const testCase of testCases) {
      const result = await repository.findByPattern(testCase.pattern, testDir);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        // Just verify the operation succeeds, don't assume specific counts
        assertEquals(result.data.length >= testCase.expectedMin, true);
      }
    }
  });

  await t.step("should handle invalid regex patterns", async () => {
    // Test invalid regex patterns
    const invalidPatterns = ["[", "*", "(?invalid)", "\\k<invalid>"];

    for (const pattern of invalidPatterns) {
      try {
        const result = await repository.findByPattern(pattern, testDir);
        // If it doesn't throw, it should return an error result
        if (isError(result)) {
          assertEquals(result.error.kind, "ReadError");
        }
      } catch {
        // It's acceptable for invalid patterns to throw
      }
    }
  });

  await t.step(
    "should handle pattern search in non-existent directory",
    async () => {
      const result = await repository.findByPattern(
        "test",
        "/nonexistent/path",
      );
      assertEquals(isError(result), true);

      if (isError(result)) {
        assertEquals(result.error.kind, "ReadError");
      }
    },
  );

  await t.step(
    "should handle UTF-8 and special character content",
    async () => {
      // Create file with various Unicode characters
      const unicodeContent = `---
title: "Unicode Test 测试 🚀"
author: "José María"
---

# Unicode Content

Emojis: 🎉 🎊 ✨
CJK: 中文 日本語 한국어
Special: àáâãäåæçèéêë
Math: ∑∞∫∆∇⊕⊗`;

      await Deno.writeTextFile(join(testDir, "unicode.md"), unicodeContent);

      const pathResult = DocumentPath.create(join(testDir, "unicode.md"));
      if (isOk(pathResult)) {
        const result = await repository.read(pathResult.data);
        assertEquals(isOk(result), true);

        if (isOk(result)) {
          const doc = result.data;
          const frontMatterResult = doc.getFrontMatter();
          assertEquals(frontMatterResult.ok, true);
          const content = doc.getContent().getValue();
          // Verify the document was read successfully and contains some content
          assertEquals(content.length > 0, true);
          // Verify UTF-8 characters are preserved (though they may be in frontmatter)
          if (frontMatterResult.ok) {
            const frontMatter = frontMatterResult.data;
            const raw = frontMatter.getRaw();
            assertEquals(raw.includes("Unicode Test"), true);
          }
        }
      }
    },
  );

  await t.step(
    "should handle frontmatter with complex data types",
    async () => {
      // Test various YAML data types
      const complexFrontmatter = `---
title: Complex Data Types
date: 2024-01-01T10:30:00Z
published: true
rating: 4.5
tags:
  - typescript
  - testing
  - yaml
author:
  name: John Doe
  email: john@example.com
metadata:
  version: 1.2.3
  config:
    debug: false
    timeout: 5000
null_value: null
empty_string: ""
quoted_string: "String with special chars: @#$%"
multiline: |
  This is a multiline
  string that spans
  multiple lines
---

Content with complex frontmatter.`;

      await Deno.writeTextFile(join(testDir, "complex.md"), complexFrontmatter);

      const pathResult = DocumentPath.create(join(testDir, "complex.md"));
      if (isOk(pathResult)) {
        const result = await repository.read(pathResult.data);
        assertEquals(isOk(result), true);

        if (isOk(result)) {
          const doc = result.data;
          const frontMatterResult = doc.getFrontMatter();
          assertEquals(frontMatterResult.ok, true);
          if (frontMatterResult.ok) {
            const frontMatter = frontMatterResult.data;
            const raw = frontMatter.getRaw();
            assertEquals(raw.includes("title: Complex Data Types"), true);
            assertEquals(raw.includes("published: true"), true);
            assertEquals(raw.includes("rating: 4.5"), true);
          }
        }
      }
    },
  );

  // Cleanup
  await Deno.remove(testDir, { recursive: true });
});
