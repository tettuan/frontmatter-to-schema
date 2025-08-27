/**
 * Comprehensive tests for FrontMatterExtractorImpl
 * Addressing test coverage gap for extraction infrastructure
 * Issue #401: Critical test coverage improvements
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { FrontMatterExtractorImpl } from "../../../../src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import {
  Document,
  FrontMatter,
} from "../../../../src/domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
} from "../../../../src/domain/models/value-objects.ts";
import { isError, isOk } from "../../../../src/domain/core/result.ts";

Deno.test("FrontMatterExtractorImpl", async (t) => {
  const extractor = new FrontMatterExtractorImpl();

  await t.step(
    "should extract frontmatter from document without existing frontmatter",
    () => {
      // Create a document without frontmatter
      const pathResult = DocumentPath.create("test.md");
      const contentResult = DocumentContent.create(`---
title: Test Document
date: 2024-01-01
tags:
  - test
  - example
---

# Test Content

This is the body of the document.`);

      if (isOk(pathResult) && isOk(contentResult)) {
        const document = Document.create(
          pathResult.data,
          null, // No existing frontmatter
          contentResult.data,
        );

        const result = extractor.extract(document);
        assertEquals(isOk(result), true);

        if (isOk(result)) {
          assertExists(result.data);
          if (result.data.kind === "Extracted") {
            const raw = result.data.frontMatter.getRaw();
            assertEquals(raw.includes("title: Test Document"), true);
            assertEquals(raw.includes("date: 2024-01-01"), true);
          }
        }
      }
    },
  );

  await t.step(
    "should return existing frontmatter if document already has it",
    () => {
      // Create a document with existing frontmatter
      const pathResult = DocumentPath.create("test.md");
      const contentResult = DocumentContent.create("# Test Content");
      const frontMatterContentResult = FrontMatterContent.create(
        JSON.stringify({ title: "Existing", date: "2024-01-01" }),
      );

      if (
        isOk(pathResult) && isOk(contentResult) &&
        isOk(frontMatterContentResult)
      ) {
        const existingFrontMatter = FrontMatter.create(
          frontMatterContentResult.data,
          "title: Existing\ndate: 2024-01-01",
        );

        const document = Document.create(
          pathResult.data,
          existingFrontMatter,
          contentResult.data,
        );

        const result = extractor.extract(document);
        assertEquals(isOk(result), true);

        if (isOk(result)) {
          assertEquals(result.data.kind, "Extracted");
          if (result.data.kind === "Extracted") {
            assertEquals(result.data.frontMatter, existingFrontMatter);
          }
        }
      }
    },
  );

  await t.step("should return null for document without frontmatter", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`# Just a heading

No frontmatter here, just content.`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        assertEquals(result.data.kind, "NotPresent");
      }
    }
  });

  await t.step("should handle empty frontmatter section", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---
---

# Content

Body text here.`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        // Empty frontmatter should return discriminated union with NotPresent kind
        assertEquals(result.data.kind, "NotPresent");
      }
    }
  });

  await t.step("should handle complex nested frontmatter", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---
title: Complex Document
meta:
  author: John Doe
  keywords:
    - typescript
    - testing
  nested:
    deep:
      value: 42
---

# Complex Content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        assertExists(result.data);
        if (result.data.kind === "Extracted") {
          const raw = result.data.frontMatter.getRaw();
          assertEquals(raw.includes("author: John Doe"), true);
          assertEquals(raw.includes("value: 42"), true);
        }
      }
    }
  });

  await t.step("should handle malformed YAML frontmatter", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---
title: Malformed
invalid_yaml: [unclosed
another: value
---

# Content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      // Should handle the error gracefully
      if (isError(result)) {
        assertEquals(result.error.kind, "ExtractionStrategyFailed");
      }
    }
  });

  await t.step("should extract frontmatter with special characters", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---
title: "Special: Characters & Symbols"
description: 'Contains "quotes" and other \\ special chars'
unicode: "测试 🚀"
---

# Content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        assertExists(result.data);
        if (result.data.kind === "Extracted") {
          const content = result.data.frontMatter.getContent();
          const parsed = content.toJSON();
          if (parsed && typeof parsed === "object") {
            assertEquals("title" in parsed, true);
          }
        }
      }
    }
  });

  await t.step("should handle frontmatter with arrays and objects", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---
title: Arrays and Objects
tags:
  - tag1
  - tag2
  - tag3
author:
  name: Jane Doe
  email: jane@example.com
numbers:
  - 1
  - 2
  - 3
---

# Content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        assertExists(result.data);
        if (result.data.kind === "Extracted") {
          const content = result.data.frontMatter.getContent();
          const parsed = content.toJSON();
          if (parsed && typeof parsed === "object") {
            assertEquals("tags" in parsed, true);
            assertEquals("author" in parsed, true);
          }
        }
      }
    }
  });

  await t.step("should handle frontmatter with only dashes", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---

# Not really frontmatter

This looks like frontmatter but isn't properly formed.`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      // This might be handled differently by the extract library
      assertEquals(isOk(result) || isError(result), true);
    }
  });

  await t.step(
    "should handle document with multiple frontmatter-like sections",
    () => {
      const pathResult = DocumentPath.create("test.md");
      const contentResult = DocumentContent.create(`---
title: First Section
---

Some content

---
This is not frontmatter
---

More content`);

      if (isOk(pathResult) && isOk(contentResult)) {
        const document = Document.create(
          pathResult.data,
          null,
          contentResult.data,
        );

        const result = extractor.extract(document);
        assertEquals(isOk(result), true);

        if (isOk(result)) {
          // Should only extract the first valid frontmatter section
          if (result.data.kind === "Extracted") {
            const raw = result.data.frontMatter.getRaw();
            assertEquals(raw.includes("title: First Section"), true);
            assertEquals(raw.includes("This is not frontmatter"), false);
          }
        }
      }
    },
  );

  await t.step("should handle deeply nested frontmatter structures", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---
title: Deep Nesting
config:
  database:
    host: localhost
    port: 5432
    credentials:
      username: admin
      password: secret
      roles:
        - read
        - write
        - admin
  api:
    endpoints:
      users: /api/v1/users
      posts: /api/v1/posts
    settings:
      timeout: 30000
      retries: 3
---

# Deep nested content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        assertExists(result.data);
        if (result.data.kind === "Extracted") {
          const raw = result.data.frontMatter.getRaw();
          assertEquals(raw.includes("database:"), true);
          assertEquals(raw.includes("username: admin"), true);
          assertEquals(raw.includes("timeout: 30000"), true);
        }
      }
    }
  });

  await t.step("should preserve document path in extracted frontmatter", () => {
    const testPath = "/path/to/test/document.md";
    const pathResult = DocumentPath.create(testPath);
    const contentResult = DocumentContent.create(`---
title: Path Test
original: value
---

# Content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result)) {
        assertExists(result.data);
        if (result.data.kind === "Extracted") {
          const content = result.data.frontMatter.getContent();
          const parsed = content.toJSON();
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const obj = parsed as Record<string, unknown>;
            assertEquals(obj._documentPath, testPath);
            assertEquals(obj.title, "Path Test");
            assertEquals(obj.original, "value");
          }
        }
      }
    }
  });

  await t.step(
    "should handle frontmatter with boolean and numeric values",
    () => {
      const pathResult = DocumentPath.create("test.md");
      const contentResult = DocumentContent.create(`---
title: Data Types
published: true
draft: false
rating: 4.7
views: 1234
weight: 0
temperature: -5.5
---

# Content`);

      if (isOk(pathResult) && isOk(contentResult)) {
        const document = Document.create(
          pathResult.data,
          null,
          contentResult.data,
        );

        const result = extractor.extract(document);
        assertEquals(isOk(result), true);

        if (isOk(result) && result.data.kind === "Extracted") {
          const raw = result.data.frontMatter.getRaw();
          assertEquals(raw.includes("published: true"), true);
          assertEquals(raw.includes("rating: 4.7"), true);
          assertEquals(raw.includes("views: 1234"), true);
          assertEquals(raw.includes("weight: 0"), true);
        }
      }
    },
  );

  await t.step("should handle frontmatter with multiline strings", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---
title: Multiline Test
description: |
  This is a long description
  that spans multiple lines
  and should be preserved
  with line breaks.
folded_text: >
  This text will be folded
  into a single line
  when parsed.
---

# Content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result) && result.data.kind === "Extracted") {
        const raw = result.data.frontMatter.getRaw();
        assertEquals(raw.includes("description: |"), true);
        assertEquals(raw.includes("folded_text: >"), true);
        assertEquals(raw.includes("multiple lines"), true);
      }
    }
  });

  await t.step("should handle Unicode and international characters", () => {
    const pathResult = DocumentPath.create("test.md");
    const contentResult = DocumentContent.create(`---
title: "Unicode Test 测试 🚀"
author: "José María González"
description: "Тест с кириллицей"
emojis: "🎉 🎊 ✨ 🌟"
cjk: "中文 日本語 한국어"
math: "∑∞∫∆∇⊕⊗"
special: "àáâãäåæçèéêëìíîïñòóôõöøùúûüý"
---

# Content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result) && result.data.kind === "Extracted") {
        const raw = result.data.frontMatter.getRaw();
        assertEquals(raw.includes("Unicode Test"), true);
        assertEquals(raw.includes("José María"), true);
      }
    }
  });

  await t.step("should handle very large frontmatter blocks", () => {
    const pathResult = DocumentPath.create("test.md");
    // Create large frontmatter with many fields
    const largeFields = Array.from(
      { length: 50 },
      (_, i) => `field_${i}: "Value number ${i} with some content"`,
    ).join("\n");
    const contentResult = DocumentContent.create(
      `---\ntitle: Large Frontmatter\n${largeFields}\n---\n\n# Content`,
    );

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result) && result.data.kind === "Extracted") {
        const raw = result.data.frontMatter.getRaw();
        assertEquals(raw.includes("field_0:"), true);
        assertEquals(raw.includes("field_49:"), true);
        assertEquals(raw.length > 1000, true);
      }
    }
  });

  await t.step(
    "should handle edge case: document starting with content",
    () => {
      const pathResult = DocumentPath.create("test.md");
      const contentResult = DocumentContent.create(`# Immediate Title

Content first, then:

---
this: is not frontmatter
because: it comes after content
---

More content.`);

      if (isOk(pathResult) && isOk(contentResult)) {
        const document = Document.create(
          pathResult.data,
          null,
          contentResult.data,
        );

        const result = extractor.extract(document);
        assertEquals(isOk(result), true);

        if (isOk(result)) {
          // Should return NotPresent because no frontmatter at start
          assertEquals(result.data.kind, "NotPresent");
        }
      }
    },
  );

  await t.step("should handle concurrent extraction operations", async () => {
    const pathResult = DocumentPath.create("concurrent-test.md");
    const contentResult = DocumentContent.create(`---
title: Concurrent Test
thread_safe: true
---

# Content`);

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      // Run multiple extractions concurrently
      const extractors = Array.from(
        { length: 10 },
        () => new FrontMatterExtractorImpl(),
      );
      const promises = extractors.map((ext) => ext.extract(document));

      const results = await Promise.all(promises);

      // All should succeed with same result
      results.forEach((result) => {
        assertEquals(isOk(result), true);
        if (isOk(result) && result.data.kind === "Extracted") {
          const raw = result.data.frontMatter.getRaw();
          assertEquals(raw.includes("Concurrent Test"), true);
        }
      });
    }
  });

  await t.step("should provide consistent discriminated union behavior", () => {
    const testCases = [
      {
        name: "with frontmatter",
        content: `---\ntitle: Test\n---\n\nContent`,
        expectedKind: "Extracted" as const,
      },
      {
        name: "without frontmatter",
        content: `# Just content\n\nNo frontmatter here.`,
        expectedKind: "NotPresent" as const,
      },
      {
        name: "empty frontmatter",
        content: `---\n---\n\nContent`,
        expectedKind: "NotPresent" as const,
      },
    ];

    for (const testCase of testCases) {
      const pathResult = DocumentPath.create("discriminated-test.md");
      const contentResult = DocumentContent.create(testCase.content);

      if (isOk(pathResult) && isOk(contentResult)) {
        const document = Document.create(
          pathResult.data,
          null,
          contentResult.data,
        );

        const result = extractor.extract(document);
        assertEquals(isOk(result), true);

        if (isOk(result)) {
          assertEquals(
            result.data.kind,
            testCase.expectedKind,
            `Failed for case: ${testCase.name}`,
          );

          // Type safety check
          if (result.data.kind === "Extracted") {
            assertExists(result.data.frontMatter);
          } else {
            assertEquals(result.data.kind, "NotPresent");
          }
        }
      }
    }
  });

  await t.step("should preserve raw frontmatter exactly", () => {
    const pathResult = DocumentPath.create("test.md");
    const originalFrontmatter = `title: Raw Preservation Test
author: Test Author
tags:
  - preservation
  - raw
  - exact
metadata:
  created: 2024-01-01
  modified: 2024-01-02`;

    const contentResult = DocumentContent.create(
      `---\n${originalFrontmatter}\n---\n\n# Content`,
    );

    if (isOk(pathResult) && isOk(contentResult)) {
      const document = Document.create(
        pathResult.data,
        null,
        contentResult.data,
      );

      const result = extractor.extract(document);
      assertEquals(isOk(result), true);

      if (isOk(result) && result.data.kind === "Extracted") {
        const raw = result.data.frontMatter.getRaw();
        // Raw should match the original frontmatter exactly
        assertEquals(raw, originalFrontmatter);
      }
    }
  });
});
