import { assertEquals } from "jsr:@std/assert";
import {
  FrontMatter,
  FrontMatterExtractor,
} from "../../../../src/domain/frontmatter/frontmatter-models.ts";

Deno.test("FrontMatter - Constructor and Basic Methods", async (t) => {
  await t.step("should create FrontMatter instance with valid data", () => {
    const raw =
      "title: Test Document\nauthor: John Doe\ntags:\n  - javascript\n  - deno";
    const data = {
      title: "Test Document",
      author: "John Doe",
      tags: ["javascript", "deno"],
    };

    const frontMatter = new FrontMatter(raw, data);

    assertEquals(frontMatter.raw, raw);
    assertEquals(frontMatter.data, data);
  });

  await t.step("should create FrontMatter instance with empty data", () => {
    const raw = "";
    const data = {};

    const frontMatter = new FrontMatter(raw, data);

    assertEquals(frontMatter.raw, raw);
    assertEquals(frontMatter.data, data);
  });

  await t.step("should get value by key", () => {
    const data = {
      title: "Test Document",
      author: "John Doe",
      published: true,
      version: 1.2,
    };
    const frontMatter = new FrontMatter("raw content", data);

    assertEquals(frontMatter.get("title"), "Test Document");
    assertEquals(frontMatter.get("author"), "John Doe");
    assertEquals(frontMatter.get("published"), true);
    assertEquals(frontMatter.get("version"), 1.2);
    assertEquals(frontMatter.get("nonexistent"), undefined);
  });

  await t.step("should check if key exists", () => {
    const data = {
      title: "Test Document",
      author: "John Doe",
      published: false,
      tags: null,
    };
    const frontMatter = new FrontMatter("raw content", data);

    assertEquals(frontMatter.has("title"), true);
    assertEquals(frontMatter.has("author"), true);
    assertEquals(frontMatter.has("published"), true);
    assertEquals(frontMatter.has("tags"), true); // null values are still present
    assertEquals(frontMatter.has("nonexistent"), false);
  });

  await t.step("should convert to JSON string", () => {
    const data = {
      title: "Test Document",
      author: "John Doe",
      tags: ["javascript", "deno"],
    };
    const frontMatter = new FrontMatter("raw content", data);

    const json = frontMatter.toJson();
    const parsed = JSON.parse(json);

    assertEquals(parsed.title, "Test Document");
    assertEquals(parsed.author, "John Doe");
    assertEquals(Array.isArray(parsed.tags), true);
    assertEquals(parsed.tags.length, 2);
    assertEquals(parsed.tags[0], "javascript");
    assertEquals(parsed.tags[1], "deno");
  });

  await t.step("should handle complex nested data structures", () => {
    const data = {
      metadata: {
        created: "2023-01-01",
        updated: "2023-12-31",
        stats: {
          words: 1500,
          readTime: 7,
        },
      },
      categories: ["tech", "tutorial"],
      featured: true,
    };
    const frontMatter = new FrontMatter("complex raw", data);

    const metadata = frontMatter.get("metadata") as Record<string, unknown>;
    assertEquals(metadata.created, "2023-01-01");
    assertEquals(metadata.updated, "2023-12-31");

    const stats = metadata.stats as Record<string, unknown>;
    assertEquals(stats.words, 1500);
    assertEquals(stats.readTime, 7);

    const categories = frontMatter.get("categories") as string[];
    assertEquals(categories.length, 2);
    assertEquals(categories[0], "tech");
    assertEquals(categories[1], "tutorial");
  });
});

Deno.test("FrontMatterExtractor - Valid YAML Extraction", async (t) => {
  const extractor = new FrontMatterExtractor();

  await t.step("should extract simple frontmatter", () => {
    const content = `---
title: Test Document
author: John Doe
published: true
---

This is the document content.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("title"), "Test Document");
      assertEquals(result.get("author"), "John Doe");
      assertEquals(result.get("published"), true);
      assertEquals(result.raw.includes("title: Test Document"), true);
    }
  });

  await t.step("should extract frontmatter with arrays", () => {
    const content = `---
title: Array Test
tags:
  - javascript
  - deno
  - typescript
categories:
  - programming
  - tutorial
---

Content with arrays in frontmatter.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("title"), "Array Test");

      const tags = result.get("tags") as string[];
      assertEquals(Array.isArray(tags), true);
      assertEquals(tags.length, 3);
      assertEquals(tags.includes("javascript"), true);
      assertEquals(tags.includes("deno"), true);
      assertEquals(tags.includes("typescript"), true);

      const categories = result.get("categories") as string[];
      assertEquals(Array.isArray(categories), true);
      assertEquals(categories.length, 2);
      assertEquals(categories.includes("programming"), true);
      assertEquals(categories.includes("tutorial"), true);
    }
  });

  await t.step("should extract frontmatter with nested objects", () => {
    const content = `---
title: Nested Object Test
metadata:
  created: 2023-01-01
  updated: 2023-12-31
  author:
    name: John Doe
    email: john@example.com
---

Content with nested objects.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("title"), "Nested Object Test");

      const metadata = result.get("metadata") as Record<string, unknown>;
      assertEquals(typeof metadata, "object");
      assertEquals(
        metadata.created instanceof Date
          ? metadata.created.toISOString().split("T")[0]
          : metadata.created,
        "2023-01-01",
      );
      assertEquals(
        metadata.updated instanceof Date
          ? metadata.updated.toISOString().split("T")[0]
          : metadata.updated,
        "2023-12-31",
      );

      const author = metadata.author as Record<string, unknown>;
      assertEquals(typeof author, "object");
      assertEquals(author.name, "John Doe");
      assertEquals(author.email, "john@example.com");
    }
  });

  await t.step("should extract frontmatter with various data types", () => {
    const content = `---
title: Data Types Test
string_value: "quoted string"
unquoted_string: unquoted value
number_int: 42
number_float: 3.14
boolean_true: true
boolean_false: false
null_value: null
date_value: 2023-01-01T00:00:00Z
---

Content with various data types.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("title"), "Data Types Test");
      assertEquals(result.get("string_value"), "quoted string");
      assertEquals(result.get("unquoted_string"), "unquoted value");
      assertEquals(result.get("number_int"), 42);
      assertEquals(result.get("number_float"), 3.14);
      assertEquals(result.get("boolean_true"), true);
      assertEquals(result.get("boolean_false"), false);
      assertEquals(result.get("null_value"), null);
      assertEquals(
        result.get("date_value") instanceof Date
          ? (result.get("date_value") as Date).toISOString()
          : result.get("date_value"),
        "2023-01-01T00:00:00.000Z",
      );
    }
  });

  await t.step("should extract empty frontmatter", () => {
    const content = `---
---

Content after empty frontmatter.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(Object.keys(result.data).length, 0);
      assertEquals(result.raw.trim(), "");
    }
  });

  await t.step("should extract frontmatter with only whitespace", () => {
    const content = `---


---

Content after whitespace-only frontmatter.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(Object.keys(result.data).length, 0);
    }
  });

  await t.step("should handle frontmatter with trailing content", () => {
    const content = `---
title: Document with Content
author: Test Author
---

# Main Document

This is the main content of the document.
It contains multiple paragraphs and sections.

## Section 1

More content here.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("title"), "Document with Content");
      assertEquals(result.get("author"), "Test Author");
    }
  });
});

Deno.test("FrontMatterExtractor - Invalid YAML Handling", async (t) => {
  const extractor = new FrontMatterExtractor();

  await t.step("should return null for invalid YAML syntax", () => {
    const content = `---
title: Invalid YAML
invalid: yaml: syntax: error
  bad_indentation
---

Content after invalid YAML.`;

    const result = extractor.extract(content);

    assertEquals(result, null);
  });

  await t.step("should return null for malformed frontmatter block", () => {
    const content = `---
title: Malformed Block
author: Test
--

Missing closing delimiter.`;

    const result = extractor.extract(content);

    assertEquals(result, null);
  });

  await t.step("should return null for content without frontmatter", () => {
    const content = `# Regular Markdown Document

This document has no frontmatter.
It's just regular markdown content.`;

    const result = extractor.extract(content);

    assertEquals(result, null);
  });

  await t.step(
    "should return null for frontmatter that doesn't start at beginning",
    () => {
      const content = `Some content before

---
title: Not At Start
author: Test
---

More content.`;

      const result = extractor.extract(content);

      assertEquals(result, null);
    },
  );

  await t.step("should handle tab characters in YAML gracefully", () => {
    const content = `---
title: Tab Test
description:	"This has a tab"
---

Content with tabs in YAML.`;

    // This should either extract successfully or return null,
    // depending on YAML parser's tab handling
    const result = extractor.extract(content);

    // Test that it doesn't crash - result can be null or valid FrontMatter
    assertEquals(result === null || result instanceof FrontMatter, true);
  });
});

Deno.test("FrontMatterExtractor - Edge Cases", async (t) => {
  const extractor = new FrontMatterExtractor();

  await t.step("should handle empty string input", () => {
    const result = extractor.extract("");
    assertEquals(result, null);
  });

  await t.step("should handle string with only delimiters", () => {
    const content = "---\n---";
    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(Object.keys(result.data).length, 0);
    }
  });

  await t.step("should handle single line frontmatter", () => {
    const content = `---
title: Single Line
---
Content`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("title"), "Single Line");
    }
  });

  await t.step("should handle unicode characters in frontmatter", () => {
    const content = `---
title: "Unicode Test: 你好世界 🌍"
author: "José María"
tags:
  - "français"
  - "español"
  - "中文"
---

Unicode content.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("title"), "Unicode Test: 你好世界 🌍");
      assertEquals(result.get("author"), "José María");

      const tags = result.get("tags") as string[];
      assertEquals(tags.includes("français"), true);
      assertEquals(tags.includes("español"), true);
      assertEquals(tags.includes("中文"), true);
    }
  });

  await t.step("should handle very long frontmatter values", () => {
    const longValue = "A".repeat(1000);
    const content = `---
title: Long Value Test
description: ${longValue}
---

Content after long description.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("title"), "Long Value Test");
      assertEquals(result.get("description"), longValue);
    }
  });

  await t.step("should handle special characters in keys and values", () => {
    const content = `---
"key with spaces": "value with spaces"
"key-with-dashes": "value-with-dashes"
"key_with_underscores": "value_with_underscores"
"key.with.dots": "value.with.dots"
"key@with@symbols": "value@with@symbols"
---

Special characters test.`;

    const result = extractor.extract(content);

    assertEquals(result !== null, true);
    if (result) {
      assertEquals(result.get("key with spaces"), "value with spaces");
      assertEquals(result.get("key-with-dashes"), "value-with-dashes");
      assertEquals(
        result.get("key_with_underscores"),
        "value_with_underscores",
      );
      assertEquals(result.get("key.with.dots"), "value.with.dots");
      assertEquals(result.get("key@with@symbols"), "value@with@symbols");
    }
  });
});

Deno.test("FrontMatterExtractor - Detection Methods", async (t) => {
  const extractor = new FrontMatterExtractor();

  await t.step("should detect presence of frontmatter", () => {
    const contentWithFrontmatter = `---
title: Test
---
Content`;

    assertEquals(extractor.hasFrontMatter(contentWithFrontmatter), true);
  });

  await t.step("should detect absence of frontmatter", () => {
    const contentWithoutFrontmatter = `# Regular Document

No frontmatter here.`;

    assertEquals(extractor.hasFrontMatter(contentWithoutFrontmatter), false);
  });

  await t.step("should detect frontmatter even with invalid YAML", () => {
    const contentWithInvalidYAML = `---
invalid: yaml: syntax
---
Content`;

    // hasFrontMatter only checks for the presence of delimiters
    assertEquals(extractor.hasFrontMatter(contentWithInvalidYAML), true);
  });

  await t.step("should not detect incomplete frontmatter", () => {
    const incompleteContent = `---
title: Incomplete
Content without closing delimiter`;

    assertEquals(extractor.hasFrontMatter(incompleteContent), false);
  });

  await t.step("should not detect frontmatter not at beginning", () => {
    const middleContent = `Some content

---
title: In Middle
---

More content`;

    assertEquals(extractor.hasFrontMatter(middleContent), false);
  });

  await t.step("should handle empty string for detection", () => {
    assertEquals(extractor.hasFrontMatter(""), false);
  });

  await t.step("should handle string with only newlines for detection", () => {
    assertEquals(extractor.hasFrontMatter("\n\n\n"), false);
  });

  await t.step("should detect minimal valid frontmatter", () => {
    const minimalContent = "---\n---";
    assertEquals(extractor.hasFrontMatter(minimalContent), true);
  });
});

Deno.test("FrontMatter and FrontMatterExtractor - Integration Tests", async (t) => {
  const extractor = new FrontMatterExtractor();

  await t.step(
    "should maintain consistency between extraction and detection",
    () => {
      const testCases = [
        {
          content: "---\ntitle: Test\n---\nContent",
          shouldHave: true,
          shouldExtract: true,
        },
        {
          content: "# No frontmatter",
          shouldHave: false,
          shouldExtract: false,
        },
        {
          content: "---\ninvalid: yaml: syntax\n---\nContent",
          shouldHave: true,
          shouldExtract: false,
        },
        { content: "", shouldHave: false, shouldExtract: false },
        { content: "---\n---\nEmpty", shouldHave: true, shouldExtract: true },
      ];

      for (const testCase of testCases) {
        const hasDetection = extractor.hasFrontMatter(testCase.content);
        const extractResult = extractor.extract(testCase.content);

        assertEquals(
          hasDetection,
          testCase.shouldHave,
          `Detection mismatch for: ${testCase.content.substring(0, 20)}...`,
        );

        if (testCase.shouldExtract) {
          assertEquals(
            extractResult !== null,
            true,
            `Extraction should succeed for: ${
              testCase.content.substring(0, 20)
            }...`,
          );
        } else {
          assertEquals(
            extractResult === null,
            true,
            `Extraction should fail for: ${
              testCase.content.substring(0, 20)
            }...`,
          );
        }
      }
    },
  );

  await t.step(
    "should handle round-trip extraction and JSON conversion",
    () => {
      const originalData = {
        title: "Round Trip Test",
        author: "Test Author",
        tags: ["test", "roundtrip"],
        metadata: {
          version: 1.0,
          published: true,
        },
      };

      // Create content with this data
      const yamlContent = `title: Round Trip Test
author: Test Author
tags:
  - test
  - roundtrip
metadata:
  version: 1.0
  published: true`;

      const content = `---\n${yamlContent}\n---\n\nDocument content.`;

      const extracted = extractor.extract(content);

      assertEquals(extracted !== null, true);
      if (extracted) {
        // Check that extracted data matches original structure
        assertEquals(extracted.get("title"), originalData.title);
        assertEquals(extracted.get("author"), originalData.author);

        const tags = extracted.get("tags") as string[];
        assertEquals(tags.length, originalData.tags.length);

        const metadata = extracted.get("metadata") as Record<string, unknown>;
        assertEquals(metadata.version, originalData.metadata.version);
        assertEquals(metadata.published, originalData.metadata.published);

        // Test JSON conversion
        const jsonString = extracted.toJson();
        const parsedJson = JSON.parse(jsonString);

        assertEquals(parsedJson.title, originalData.title);
        assertEquals(parsedJson.author, originalData.author);
        assertEquals(Array.isArray(parsedJson.tags), true);
        assertEquals(typeof parsedJson.metadata, "object");
      }
    },
  );
});
