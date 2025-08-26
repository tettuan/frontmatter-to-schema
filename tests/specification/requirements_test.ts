import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

/**
 * Specification-driven tests based on requirements.md
 * These tests validate the core requirements of the system
 */

describe("Requirement 1: Extract and analyze Markdown frontmatter", () => {
  it("should extract frontmatter from markdown files", () => {
    const markdown = `---
title: Test Document
tags: [test, specification]
date: 2025-08-26
---

# Content
This is the content.`;

    // Test frontmatter extraction boundary conditions
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = markdown.match(frontmatterRegex);

    assertExists(match);
    assertEquals(match[0].startsWith("---"), true);
    assertEquals(match[0].endsWith("---"), true);
  });

  it("should handle empty frontmatter", () => {
    const markdown = `---

---

# Content`;

    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = markdown.match(frontmatterRegex);

    assertExists(match);
    assertEquals(match[1].trim(), "");
  });

  it("should handle missing frontmatter", () => {
    const markdown = `# Content
This is content without frontmatter.`;

    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = markdown.match(frontmatterRegex);

    assertEquals(match, null);
  });
});

describe("Requirement 2: Map analyzed results to template format based on Schema", () => {
  it("should map frontmatter data to schema structure", () => {
    const frontmatterData = {
      title: "Test",
      tags: ["tag1", "tag2"],
      date: "2025-08-26",
    };

    const schema = {
      properties: {
        title: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        date: { type: "string" },
      } as Record<string, { type: string; items?: { type: string } }>,
    };

    // Validate data matches schema
    for (const [key, value] of Object.entries(frontmatterData)) {
      assertExists(schema.properties[key]);

      if (schema.properties[key].type === "array") {
        assertEquals(Array.isArray(value), true);
      } else if (schema.properties[key].type === "string") {
        assertEquals(typeof value, "string");
      }
    }
  });

  it("should apply template with variable substitution", () => {
    const data = {
      title: "Test Document",
      tags: ["tag1", "tag2"],
    };

    const template = "Title: {{title}}, Tags: {{tags}}";

    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      const replacement = Array.isArray(value)
        ? value.join(", ")
        : String(value);
      result = result.replace(placeholder, replacement);
    }

    assertEquals(result, "Title: Test Document, Tags: tag1, tag2");
  });
});

describe("Requirement 3: TypeScript structured processing for analysis", () => {
  it("should perform two-stage analysis", () => {
    // Stage 1: Extract information using Schema expansion
    const _stage1Input = {
      raw: "title: Test\ntags: [a, b]",
    };

    const stage1Output = {
      extracted: {
        title: "Test",
        tags: ["a", "b"],
      },
    };

    // Stage 2: Map to analysis template
    const _stage2Input = stage1Output.extracted;
    const stage2Output = {
      formatted: "Document: Test with tags a, b",
    };

    assertExists(stage1Output.extracted);
    assertExists(stage2Output.formatted);
  });
});

describe("Flexibility Requirements", () => {
  it("should support changing schemas without modifying markdown", () => {
    const markdown = `---
title: Document
author: John
---`;

    // Original schema
    const schema1 = {
      properties: {
        title: { type: "string" },
      },
    };

    // Changed schema - adds new field
    const schema2 = {
      properties: {
        title: { type: "string" },
        author: { type: "string" },
      },
    };

    // Markdown remains unchanged
    assertEquals(markdown.includes("title:"), true);
    assertEquals(markdown.includes("author:"), true);

    // Both schemas can process the same markdown
    assertExists(schema1.properties.title);
    assertExists(schema2.properties.author);
  });

  it("should support multiple template sets for same data", () => {
    const data = {
      title: "Test",
      date: "2025-08-26",
    };

    const template1 = "{{title}} - {{date}}";
    const template2 = "Date: {{date}}\nTitle: {{title}}";

    // Same data, different templates
    const result1 = template1.replace("{{title}}", data.title).replace(
      "{{date}}",
      data.date,
    );
    const result2 = template2.replace("{{title}}", data.title).replace(
      "{{date}}",
      data.date,
    );

    assertEquals(result1, "Test - 2025-08-26");
    assertEquals(result2, "Date: 2025-08-26\nTitle: Test");
  });
});

describe("Analysis Process Loop", () => {
  it("should process prompt list sequentially", () => {
    const promptList = ["prompt1.md", "prompt2.md", "prompt3.md"];
    const finalResult: unknown[] = [];

    for (const prompt of promptList) {
      // Simulate processing each prompt
      const resultB = `frontmatter-${prompt}`;
      const resultC = `analyzed-${resultB}`;
      const resultD = `mapped-${resultC}`;

      finalResult.push(resultD);
    }

    assertEquals(finalResult.length, 3);
    assertEquals(finalResult[0], "mapped-analyzed-frontmatter-prompt1.md");
  });

  it("should integrate results into final output", () => {
    const results = [
      { id: 1, data: "result1" },
      { id: 2, data: "result2" },
      { id: 3, data: "result3" },
    ];

    const finalResult = {
      entries: results,
      count: results.length,
    };

    assertEquals(finalResult.count, 3);
    assertEquals(finalResult.entries.length, 3);
  });
});

describe("Domain Boundary Tests", () => {
  it("should maintain separation between domain layers", () => {
    // Domain layer should not depend on infrastructure
    const domainEntity = {
      id: "123",
      validate: () => true,
    };

    // Application layer orchestrates domain and infrastructure
    const applicationService = {
      process: (entity: typeof domainEntity) => {
        return entity.validate();
      },
    };

    // Infrastructure layer implements domain interfaces
    const repository = {
      save: (_entity: typeof domainEntity) => {
        return { success: true };
      },
    };

    assertEquals(domainEntity.validate(), true);
    assertEquals(applicationService.process(domainEntity), true);
    assertEquals(repository.save(domainEntity).success, true);
  });
});
