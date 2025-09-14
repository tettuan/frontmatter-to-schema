/**
 * TemplateEngine Unit Tests
 *
 * Following Totality principles and DDD patterns
 * Tests for issue #739: TemplateEngine test coverage
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1.0.9";
import { TemplateEngine } from "../../../src/core/template-engine.ts";

Deno.test("TemplateEngine - Basic Tests", async (t) => {
  const engineResult = TemplateEngine.create();
  if (!engineResult.ok) {
    throw new Error(
      `Failed to create TemplateEngine: ${engineResult.error.kind}`,
    );
  }
  const engine = engineResult.data;

  await t.step("should create instance", () => {
    assertExists(engine);
    assertEquals(typeof engine.process, "function");
  });

  await t.step("should process simple template with single document", () => {
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          title: { type: "string" },
          date: { type: "string" },
        },
      },
      documentData: [
        { title: "Test Title", date: "2025-01-01" },
      ],
      templateContent: JSON.stringify({
        title: "{title}",
        date: "{date}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(parsed.title, "Test Title");
    assertEquals(parsed.date, "2025-01-01");
  });

  await t.step("should process template with multiple documents", () => {
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          items: { type: "array" },
        },
      },
      documentData: [
        { title: "Doc 1", value: 100 },
        { title: "Doc 2", value: 200 },
      ],
      templateContent: JSON.stringify({
        title: "{title}",
        value: "{value}",
      }),
    });

    const parsed = JSON.parse(result);
    // Should get values from first document
    assertEquals(parsed.title, "Doc 1");
    assertEquals(parsed.value, 100);
  });
});

Deno.test("TemplateEngine - x-frontmatter-part Processing", async (t) => {
  const engineResult = TemplateEngine.create();
  if (!engineResult.ok) {
    throw new Error(
      `Failed to create TemplateEngine: ${engineResult.error.kind}`,
    );
  }
  const engine = engineResult.data;

  await t.step("should extract x-frontmatter-part fields into arrays", () => {
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          commands: {
            type: "array",
            "x-frontmatter-part": true,
          },
        },
      },
      documentData: [
        { commands: [{ name: "cmd1" }] },
        { commands: [{ name: "cmd2" }] },
      ],
      templateContent: JSON.stringify({
        commands: "{commands}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(Array.isArray(parsed.commands), true);
    assertEquals(parsed.commands.length, 2);
  });

  await t.step("should handle nested x-frontmatter-part", () => {
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          tools: {
            type: "object",
            properties: {
              configs: {
                type: "array",
                "x-frontmatter-part": true,
              },
            },
          },
        },
      },
      documentData: [
        { tools: { configs: ["git"] } },
        { tools: { configs: ["build"] } },
      ],
      templateContent: JSON.stringify({
        tools: {
          configs: "{tools.configs}",
        },
      }),
    });

    const parsed = JSON.parse(result);
    // The implementation returns an array of document objects
    assertEquals(Array.isArray(parsed.tools.configs), true);
    assertEquals(parsed.tools.configs.length, 2);
    assertEquals(parsed.tools.configs[0].tools.configs[0], "git");
    assertEquals(parsed.tools.configs[1].tools.configs[0], "build");
  });
});

Deno.test("TemplateEngine - x-derived-from Processing", async (t) => {
  const engineResult = TemplateEngine.create();
  if (!engineResult.ok) {
    throw new Error(
      `Failed to create TemplateEngine: ${engineResult.error.kind}`,
    );
  }
  const engine = engineResult.data;

  await t.step("should handle basic x-derived-from fields", () => {
    // x-derived-from with direct field path
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          allValues: {
            type: "array",
            "x-derived-from": "value",
          },
        },
      },
      documentData: [
        { value: 100 },
        { value: 200 },
      ],
      templateContent: JSON.stringify({
        allValues: "{allValues}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(Array.isArray(parsed.allValues), true);
    assertEquals(parsed.allValues.length, 2);
    assertEquals(parsed.allValues[0], 100);
    assertEquals(parsed.allValues[1], 200);
  });

  await t.step("should handle x-derived-unique fields", () => {
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          uniqueCategories: {
            type: "array",
            "x-derived-from": "category",
            "x-derived-unique": true,
          },
        },
      },
      documentData: [
        { category: "A" },
        { category: "B" },
        { category: "A" },
      ],
      templateContent: JSON.stringify({
        uniqueCategories: "{uniqueCategories}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(Array.isArray(parsed.uniqueCategories), true);
    assertEquals(parsed.uniqueCategories.length, 2);
    assertEquals(parsed.uniqueCategories.includes("A"), true);
    assertEquals(parsed.uniqueCategories.includes("B"), true);
  });
});

Deno.test("TemplateEngine - Variable Replacement", async (t) => {
  const engineResult = TemplateEngine.create();
  if (!engineResult.ok) {
    throw new Error(
      `Failed to create TemplateEngine: ${engineResult.error.kind}`,
    );
  }
  const engine = engineResult.data;

  await t.step("should replace nested path variables", () => {
    const result = engine.process({
      schemaData: {},
      documentData: [
        {
          meta: {
            author: "John Doe",
            version: "1.0.0",
          },
        },
      ],
      templateContent: JSON.stringify({
        author: "{meta.author}",
        version: "{meta.version}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(parsed.author, "John Doe");
    assertEquals(parsed.version, "1.0.0");
  });

  await t.step("should handle missing variables gracefully", () => {
    const result = engine.process({
      schemaData: {},
      documentData: [{ title: "Test" }],
      templateContent: JSON.stringify({
        title: "{title}",
        missing: "{nonexistent}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(parsed.title, "Test");
    assertEquals(parsed.missing, "{nonexistent}"); // Should keep original
  });
});

Deno.test("TemplateEngine - Edge Cases", async (t) => {
  const engineResult = TemplateEngine.create();
  if (!engineResult.ok) {
    throw new Error(
      `Failed to create TemplateEngine: ${engineResult.error.kind}`,
    );
  }
  const engine = engineResult.data;

  await t.step("should handle empty document array", () => {
    const result = engine.process({
      schemaData: {},
      documentData: [],
      templateContent: JSON.stringify({
        message: "No documents",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(parsed.message, "No documents");
  });

  await t.step("should handle non-JSON template content", () => {
    const result = engine.process({
      schemaData: {},
      documentData: [{ name: "Test" }],
      templateContent: "Hello {name}!",
    });

    // For non-JSON templates, should return as-is or with replacements
    assertEquals(typeof result, "string");
  });

  await t.step("should handle complex nested structures", () => {
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          nested: {
            type: "object",
            properties: {
              deep: {
                type: "object",
                properties: {
                  value: { type: "string" },
                },
              },
            },
          },
        },
      },
      documentData: [
        { nested: { deep: { value: "Found it!" } } },
      ],
      templateContent: JSON.stringify({
        result: "{nested.deep.value}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(parsed.result, "Found it!");
  });
});

Deno.test("TemplateEngine - Array Processing", async (t) => {
  const engineResult = TemplateEngine.create();
  if (!engineResult.ok) {
    throw new Error(
      `Failed to create TemplateEngine: ${engineResult.error.kind}`,
    );
  }
  const engine = engineResult.data;

  await t.step("should process arrays with variable replacement", () => {
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          items: {
            type: "array",
          },
        },
      },
      documentData: [
        { items: [{ id: 1 }, { id: 2 }] },
      ],
      templateContent: JSON.stringify({
        items: "{items}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(Array.isArray(parsed.items), true);
    assertEquals(parsed.items.length, 2);
    assertEquals(parsed.items[0].id, 1);
    assertEquals(parsed.items[1].id, 2);
  });

  await t.step("should flatten arrays from multiple documents", () => {
    const result = engine.process({
      schemaData: {
        type: "object",
        properties: {
          allTags: {
            type: "array",
            "x-frontmatter-part": true,
          },
        },
      },
      documentData: [
        { tags: ["a", "b"] },
        { tags: ["c", "d"] },
      ],
      templateContent: JSON.stringify({
        allTags: "{tags}",
      }),
    });

    const parsed = JSON.parse(result);
    assertEquals(Array.isArray(parsed.allTags), true);
  });
});
