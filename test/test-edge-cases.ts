import { FrontMatterExtractor } from "../src/domain/frontmatter/Extractor.ts";
import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";

Deno.test("Edge Cases - frontmatter in middle of document", () => {
  const extractor = new FrontMatterExtractor();
  const content = `# Title

Some content here

---
title: Should not extract
---

More content`;

  const result = extractor.extract(content);
  assertEquals(
    result,
    null,
    "Should not extract frontmatter from middle of document",
  );
});

Deno.test("Edge Cases - invalid YAML syntax", () => {
  const extractor = new FrontMatterExtractor();
  const content = `---
title: Missing quote
invalid: [unclosed array
---`;

  const result = extractor.extract(content);
  assertEquals(result, null, "Should return null for invalid YAML");
});

Deno.test("Edge Cases - empty frontmatter", () => {
  const extractor = new FrontMatterExtractor();
  const content = `---
---

# Content`;

  const result = extractor.extract(content);
  assertEquals(result !== null, true, "Should return a FrontMatter object");
  assertEquals(
    Object.keys(result?.data || {}).length,
    0,
    "Should have empty data object",
  );
});

Deno.test("Edge Cases - code blocks with triple dashes", () => {
  const extractor = new FrontMatterExtractor();
  const content = `---
title: Real frontmatter
---

\`\`\`yaml
---
fake: frontmatter
---
\`\`\``;

  const result = extractor.extract(content);
  assertEquals(result?.get("title"), "Real frontmatter");
  assertEquals(
    result?.get("fake"),
    undefined,
    "Should not extract from code blocks",
  );
});

Deno.test("Edge Cases - multiple frontmatters", () => {
  const extractor = new FrontMatterExtractor();
  const content = `---
first: true
---

---
second: true
---`;

  const result = extractor.extract(content);
  assertEquals(
    result?.get("first"),
    true,
    "Should only extract first frontmatter",
  );
  assertEquals(
    result?.get("second"),
    undefined,
    "Should ignore second frontmatter",
  );
});
