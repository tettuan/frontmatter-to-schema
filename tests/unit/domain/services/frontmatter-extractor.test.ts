import { assertEquals } from "jsr:@std/assert";
import { FrontMatterExtractor } from "../../../../src/domain/frontmatter/frontmatter-models.ts";

Deno.test("FrontMatterExtractor", async (t) => {
  const extractor = new FrontMatterExtractor();

  await t.step("should extract frontmatter and body", () => {
    const content = `---
title: Test Article
author: John Doe
published: true
tags: [deno, typescript]
---

# Main Content

This is the body of the document.`;

    const result = extractor.extract(content);

    // Check frontmatter exists
    assertEquals(result !== null, true);
    if (result) {
      const parsed = result.data;
      assertEquals(parsed.title, "Test Article");
      assertEquals(parsed.author, "John Doe");
      assertEquals(parsed.published, true);
      assertEquals(Array.isArray(parsed.tags), true);
    }
  });

  await t.step("should handle document without frontmatter", () => {
    const content = `# Document Without Frontmatter

Just regular markdown content.`;

    const result = extractor.extract(content);
    assertEquals(result, null);
  });

  await t.step("should parse different value types", () => {
    const content = `---
string: hello world
number: 42
float: 3.14
boolean_true: true
boolean_false: false
array: [one, two, three]
quoted: "quoted value"
---

Body content`;

    const result = extractor.extract(content);
    assertEquals(result !== null, true);

    if (result) {
      const parsed = result.data;
      assertEquals(parsed.string, "hello world");
      assertEquals(parsed.number, 42);
      assertEquals(parsed.float, 3.14);
      assertEquals(parsed.boolean_true, true);
      assertEquals(parsed.boolean_false, false);
      assertEquals(Array.isArray(parsed.array), true);
      assertEquals(parsed.quoted, "quoted value");
    }
  });

  await t.step("should handle empty frontmatter", () => {
    const content = `---
---

Body content`;

    const result = extractor.extract(content);
    assertEquals(result !== null, true);

    if (result) {
      const parsed = result.data;
      assertEquals(Object.keys(parsed).length, 0);
    }
  });
});
