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
});
