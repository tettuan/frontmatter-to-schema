import { assertEquals } from "jsr:@std/assert";
import { FrontMatterExtractor } from "../../../../src/domain/services/frontmatter-extractor.ts";
import { isOk } from "../../../../src/domain/core/result.ts";

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
    assertEquals(isOk(result), true);

    if (isOk(result)) {
      const { frontMatter, body } = result.data;

      // Check frontmatter exists
      assertEquals(frontMatter !== null, true);
      if (frontMatter) {
        const parsed = frontMatter.getParsed();
        assertEquals(parsed.title, "Test Article");
        assertEquals(parsed.author, "John Doe");
        assertEquals(parsed.published, true);
        assertEquals(Array.isArray(parsed.tags), true);
      }

      // Check body
      assertEquals(body.getContent().startsWith("# Main Content"), true);
    }
  });

  await t.step("should handle document without frontmatter", () => {
    const content = `# Document Without Frontmatter

Just regular markdown content.`;

    const result = extractor.extract(content);
    assertEquals(isOk(result), true);

    if (isOk(result)) {
      const { frontMatter, body } = result.data;
      assertEquals(frontMatter, null);
      assertEquals(body.getContent(), content);
    }
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
    assertEquals(isOk(result), true);

    if (isOk(result)) {
      const { frontMatter } = result.data;
      if (frontMatter) {
        const parsed = frontMatter.getParsed();
        assertEquals(parsed.string, "hello world");
        assertEquals(parsed.number, 42);
        assertEquals(parsed.float, 3.14);
        assertEquals(parsed.boolean_true, true);
        assertEquals(parsed.boolean_false, false);
        assertEquals(Array.isArray(parsed.array), true);
        assertEquals(parsed.quoted, "quoted value");
      }
    }
  });

  await t.step("should handle empty frontmatter", () => {
    const content = `---
---

Body content`;

    const result = extractor.extract(content);
    assertEquals(isOk(result), true);

    if (isOk(result)) {
      const { frontMatter, body } = result.data;
      assertEquals(frontMatter !== null, true);
      assertEquals(body.getContent().trim(), "Body content");
    }
  });
});
