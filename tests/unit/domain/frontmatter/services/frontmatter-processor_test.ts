/**
 * FrontmatterProcessor Domain Service Tests
 *
 * Tests for FrontmatterProcessor following DDD and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { FrontmatterProcessor } from "../../../../../src/domain/frontmatter/services/frontmatter-processor.ts";

Deno.test("FrontmatterProcessor - should create valid processor", () => {
  const result = FrontmatterProcessor.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("FrontmatterProcessor - should extract YAML frontmatter", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown = `---
title: Test Document
author: John Doe
published: true
---

# Main Content
This is the main body content.`;

  const result = processor.data.extractFrontmatter(markdown);

  assertEquals(result.ok, true);
  if (result.ok && result.data) {
    assertEquals(result.data.getFormat(), "yaml");
    // YAML is stored as raw content for now
    assertEquals(result.data.hasField("_raw"), true);
    const rawResult = result.data.getField("_raw");
    assertEquals(rawResult.ok, true);
    if (rawResult.ok) {
      const rawContent = rawResult.data as string;
      assertEquals(rawContent.includes("title: Test Document"), true);
      assertEquals(rawContent.includes("author: John Doe"), true);
      assertEquals(rawContent.includes("published: true"), true);
    }
  }
});

Deno.test("FrontmatterProcessor - should extract JSON frontmatter", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown =
    `{"title": "Test Document", "author": "Jane Doe", "tags": ["test", "example"]}

# Main Content
This is the main body content.`;

  const result = processor.data.extractFrontmatter(markdown);

  assertEquals(result.ok, true);
  if (result.ok && result.data) {
    assertEquals(result.data.getFormat(), "json");

    const titleResult = result.data.getField("title");
    assertEquals(titleResult.ok, true);
    if (titleResult.ok) {
      assertEquals(titleResult.data, "Test Document");
    }

    const authorResult = result.data.getField("author");
    assertEquals(authorResult.ok, true);
    if (authorResult.ok) {
      assertEquals(authorResult.data, "Jane Doe");
    }
  }
});

Deno.test("FrontmatterProcessor - should extract TOML frontmatter", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown = `+++
title = "Test Document"
author = "Bob Smith"
draft = false
+++

# Main Content
This is the main body content.`;

  const result = processor.data.extractFrontmatter(markdown);

  assertEquals(result.ok, true);
  if (result.ok && result.data) {
    assertEquals(result.data.getFormat(), "toml");
    // TOML parsing stores raw content for now
    const rawResult = result.data.getField("_raw");
    assertEquals(rawResult.ok, true);
  }
});

Deno.test("FrontmatterProcessor - should return null for content without frontmatter", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown = `# Main Content
This is just a regular markdown document without frontmatter.`;

  const result = processor.data.extractFrontmatter(markdown);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data, null);
  }
});

Deno.test("FrontmatterProcessor - should detect YAML format correctly", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const yamlContent = `---
title: Test
---`;

  const format = processor.data.detectFormat(yamlContent);
  assertEquals(format, "yaml");
});

Deno.test("FrontmatterProcessor - should detect JSON format correctly", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const jsonContent = `{"title": "Test"}`;

  const format = processor.data.detectFormat(jsonContent);
  assertEquals(format, "json");
});

Deno.test("FrontmatterProcessor - should detect TOML format correctly", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const tomlContent = `+++
title = "Test"
+++`;

  const format = processor.data.detectFormat(tomlContent);
  assertEquals(format, "toml");
});

Deno.test("FrontmatterProcessor - should return null for unrecognized format", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const unknownContent = `# Just a regular heading
No frontmatter here.`;

  const format = processor.data.detectFormat(unknownContent);
  assertEquals(format, null);
});

Deno.test("FrontmatterProcessor - should extract frontmatter with body separation", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown = `---
title: Test Document
---

# Main Content
This is the body content.
It has multiple lines.`;

  const result = processor.data.extractWithBody(markdown);

  assertEquals(result.ok, true);
  if (result.ok && result.data) {
    assertEquals(result.data.format, "yaml");
    assertEquals(result.data.content.includes("title: Test Document"), true);
    assertEquals(result.data.bodyContent.includes("# Main Content"), true);
    assertEquals(result.data.bodyContent.includes("multiple lines."), true);
  }
});

Deno.test("FrontmatterProcessor - should handle malformed YAML frontmatter", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown = `---
title: Test Document
author: John Doe
# Missing closing delimiter`;

  const result = processor.data.extractFrontmatter(markdown);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("FrontmatterProcessor - should handle malformed JSON frontmatter", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown = `{"title": "Test Document", "author": "John Doe"
# Missing closing brace`;

  const result = processor.data.extractFrontmatter(markdown);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("FrontmatterProcessor - should handle empty frontmatter", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown = `---
---

# Main Content`;

  const result = processor.data.extractFrontmatter(markdown);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("FrontmatterProcessor - should handle empty input", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const result = processor.data.extractFrontmatter("");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("FrontmatterProcessor - should parse JSON content correctly", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const jsonContent = `{"title": "Test", "count": 42, "active": true}`;

  const result = processor.data.parseContent(jsonContent, "json");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.title, "Test");
    assertEquals(result.data.count, 42);
    assertEquals(result.data.active, true);
  }
});

Deno.test("FrontmatterProcessor - should handle invalid JSON parsing", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const invalidJson = `{"title": "Test", "invalid": }`;

  const result = processor.data.parseContent(invalidJson, "json");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ParseError");
  }
});

Deno.test("FrontmatterProcessor - should handle YAML/TOML parsing placeholder", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const yamlContent = `title: Test Document
author: John Doe`;

  const result = processor.data.parseContent(yamlContent, "yaml");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data._format, "yaml");
    assertEquals(result.data._raw, yamlContent);
  }
});

Deno.test("FrontmatterProcessor - should extract complex JSON frontmatter", () => {
  const processor = FrontmatterProcessor.create();
  if (!processor.ok) throw new Error("Failed to create processor");

  const markdown = `{
  "title": "Complex Document",
  "metadata": {
    "author": "Jane Doe",
    "created": "2023-01-01"
  },
  "tags": ["test", "complex", "json"],
  "config": {
    "published": true,
    "version": 1.2
  }
}

# Complex Content
This document has complex nested JSON frontmatter.`;

  const result = processor.data.extractFrontmatter(markdown);

  assertEquals(result.ok, true);
  if (result.ok && result.data) {
    assertEquals(result.data.getFormat(), "json");

    const titleResult = result.data.getField("title");
    assertEquals(titleResult.ok, true);
    if (titleResult.ok) {
      assertEquals(titleResult.data, "Complex Document");
    }

    const metadataResult = result.data.getField("metadata");
    assertEquals(metadataResult.ok, true);

    const tagsResult = result.data.getField("tags");
    assertEquals(tagsResult.ok, true);
    if (tagsResult.ok) {
      assertEquals(Array.isArray(tagsResult.data), true);
    }
  }
});
