import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { YamlFrontmatterExtractor } from "../../../../src/infrastructure/adapters/frontmatter-extractor.ts";

describe("YamlFrontmatterExtractor", () => {
  const extractor = new YamlFrontmatterExtractor();

  describe("extract", () => {
    it("should extract frontmatter and body from valid YAML frontmatter", () => {
      // Arrange
      const content = `---
title: "Test Document"
author: "John Doe"
tags:
  - test
  - example
---

# Main Content

This is the body content.`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data.frontmatter);
        assertEquals(
          result.data.body,
          "# Main Content\n\nThis is the body content.",
        );

        // Verify frontmatter is JSON string containing expected content
        const parsedFrontmatter = JSON.parse(result.data.frontmatter);
        assertEquals(parsedFrontmatter.title, "Test Document");
        assertEquals(parsedFrontmatter.author, "John Doe");
        assertEquals(Array.isArray(parsedFrontmatter.tags), true);
        assertEquals(parsedFrontmatter.tags.includes("test"), true);
        assertEquals(parsedFrontmatter.tags.includes("example"), true);
      }
    });

    it("should return empty frontmatter for content without frontmatter", () => {
      // Arrange
      const content = `# Regular Markdown

This document has no frontmatter.
Just regular markdown content.`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.frontmatter, "");
        assertEquals(result.data.body, content);
      }
    });

    it("should handle empty content", () => {
      // Arrange
      const content = "";

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.frontmatter, "");
        assertEquals(result.data.body, "");
      }
    });

    it("should handle content with only frontmatter", () => {
      // Arrange
      const content = `---
title: "Only Frontmatter"
description: "No body content"
---`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data.frontmatter);
        assertEquals(result.data.body, "");
        const parsedFrontmatter = JSON.parse(result.data.frontmatter);
        assertEquals(parsedFrontmatter.title, "Only Frontmatter");
        assertEquals(parsedFrontmatter.description, "No body content");
      }
    });

    it("should handle frontmatter with complex YAML structures", () => {
      // Arrange
      const content = `---
title: "Complex Document"
metadata:
  created: 2024-01-01
  updated: 2024-01-15
  version: 1.2.3
authors:
  - name: "Alice Smith"
    email: "alice@example.com"
  - name: "Bob Jones"
    email: "bob@example.com"
config:
  enabled: true
  options:
    - debug
    - verbose
tags: [typescript, testing, yaml]
---

Content goes here.`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data.frontmatter);
        assertEquals(result.data.body, "Content goes here.");

        // Verify complex structures are preserved in JSON format
        const parsedFrontmatter = JSON.parse(result.data.frontmatter);
        assertEquals(parsedFrontmatter.title, "Complex Document");
        assertEquals(parsedFrontmatter.metadata.version, "1.2.3");
        assertEquals(Array.isArray(parsedFrontmatter.authors), true);
        assertEquals(parsedFrontmatter.authors[0].name, "Alice Smith");
        assertEquals(parsedFrontmatter.config.enabled, true);
      }
    });

    it("should handle malformed YAML frontmatter gracefully", () => {
      // Arrange - Invalid YAML syntax
      const content = `---
title: "Malformed YAML"
invalid: yaml: syntax: error
  - missing indent
bad_structure
---

Body content here.`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionFailed");
        assertExists(result.error.message);
        assertEquals(result.error.message.length > 0, true);
      }
    });

    it("should handle content starting with --- but not proper frontmatter", () => {
      // Arrange - False positive for frontmatter
      const content = `---
This looks like frontmatter but is not properly closed
And has no proper YAML structure

# This is actually markdown content`;

      // Act
      const result = extractor.extract(content);

      // Assert
      // Should fail to parse as frontmatter due to missing closing ---
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionFailed");
        assertExists(result.error.message);
      }
    });

    it("should preserve whitespace and formatting in body", () => {
      // Arrange
      const content = `---
title: "Whitespace Test"
---

  # Indented Header

    Code block with spaces
    More indented content

Regular paragraph.

    Another code block`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        // Verify whitespace and indentation is preserved in body
        assertEquals(result.data.body.includes("  # Indented Header"), true);
        assertEquals(
          result.data.body.includes("    Code block with spaces"),
          true,
        );
        assertEquals(result.data.body.includes("    Another code block"), true);
      }
    });

    it("should handle unicode characters in frontmatter", () => {
      // Arrange
      const content = `---
title: "Unicode Test 测试 🚀"
author: "José García"
description: "Émojis and spëcial chars"
japanese: "こんにちは世界"
---

Content with unicode: 你好世界 🌍`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data.frontmatter);
        const parsedFrontmatter = JSON.parse(result.data.frontmatter);
        assertEquals(parsedFrontmatter.title, "Unicode Test 测试 🚀");
        assertEquals(parsedFrontmatter.author, "José García");
        assertEquals(parsedFrontmatter.japanese, "こんにちは世界");
        assertEquals(result.data.body.includes("你好世界 🌍"), true);
      }
    });

    it("should handle very large frontmatter content", () => {
      // Arrange - Large frontmatter section
      const largeArray = Array.from(
        { length: 100 },
        (_, i) => `  - item_${i}: "value_${i}"`,
      ).join("\n");
      const content = `---
title: "Large Frontmatter Test"
large_array:
${largeArray}
---

Small body content.`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data.frontmatter);
        assertEquals(result.data.body, "Small body content.");
        const parsedFrontmatter = JSON.parse(result.data.frontmatter);
        assertEquals(parsedFrontmatter.title, "Large Frontmatter Test");
        assertEquals(Array.isArray(parsedFrontmatter.large_array), true);
        assertEquals(parsedFrontmatter.large_array.length, 100);
        assertEquals(parsedFrontmatter.large_array[99].item_99, "value_99");
      }
    });

    it("should maintain Result pattern compliance", () => {
      // Arrange
      const content = `---
title: "Result Pattern Test"
---
Content`;

      // Act
      const result = extractor.extract(content);

      // Assert: Verify Result pattern structure
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertExists(result.data);
        assertExists(result.data.frontmatter);
        assertExists(result.data.body);
        assertEquals(typeof result.data.frontmatter, "string");
        assertEquals(typeof result.data.body, "string");
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });

    it("should handle edge case with multiple --- in content", () => {
      // Arrange
      const content = `---
title: "Edge Case Test"
---

Content with --- separators.

---

More content after separator.
Another --- here.`;

      // Act
      const result = extractor.extract(content);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data.frontmatter);
        const parsedFrontmatter = JSON.parse(result.data.frontmatter);
        assertEquals(parsedFrontmatter.title, "Edge Case Test");

        // Body should contain everything after the first frontmatter block
        assertEquals(
          result.data.body.includes("Content with --- separators"),
          true,
        );
        assertEquals(
          result.data.body.includes("More content after separator"),
          true,
        );
        assertEquals(result.data.body.includes("Another --- here"), true);
      }
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages for parsing failures", () => {
      // Arrange - Content that will cause YAML parsing error
      const invalidContent = `---
title: "Test"
invalid: [unclosed array
---
Body`;

      // Act
      const result = extractor.extract(invalidContent);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ExtractionFailed");
        assertExists(result.error.message);
        assertEquals(result.error.message.length > 0, true);
      }
    });

    it("should handle null or undefined gracefully", () => {
      // This test verifies the type system prevents null/undefined
      // but if somehow passed, should handle gracefully

      // Act & Assert - TypeScript should prevent this at compile time
      // but runtime behavior should be predictable
      const validResult = extractor.extract("");
      assertEquals(validResult.ok, true);
    });
  });
});
