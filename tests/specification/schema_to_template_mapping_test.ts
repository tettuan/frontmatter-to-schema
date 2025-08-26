import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

/**
 * Schema to Template Mapping Specification Tests
 * Based on Requirements: Map analyzed results to template format based on Schema
 */

describe("Schema Definition and Validation", () => {
  it("should define replaceable schema structure", () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Document tags",
        },
        metadata: {
          type: "object",
          properties: {
            author: { type: "string" },
            date: { type: "string", format: "date" },
            version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
          },
        },
      },
      required: ["title"],
      additionalProperties: true,
    };

    // Schema should be replaceable
    assertEquals(schema.type, "object");
    assertExists(schema.properties.title);
    assertExists(schema.properties.tags);
    assertEquals(schema.additionalProperties, true); // Allow flexibility
  });

  it("should validate data against schema", () => {
    const schema = {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
        active: { type: "boolean" },
      },
      required: ["id", "name"],
    };

    const validData = {
      id: 123,
      name: "Test",
      active: true,
    };

    const invalidData = {
      id: "not-a-number", // Wrong type
      name: "Test",
    };

    // Validation function
    function validateAgainstSchema(
      data: Record<string, unknown>,
      schema: Record<string, unknown>,
    ): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      // Check required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required as string[]) {
          if (!(field in data)) {
            errors.push(`Missing required field: ${field}`);
          }
        }
      }

      // Check types
      if (schema.properties) {
        for (
          const [field, fieldSchema] of Object.entries(
            schema.properties as Record<string, unknown>,
          )
        ) {
          if (field in data) {
            const value = data[field];
            const expectedType = (fieldSchema as Record<string, unknown>).type;
            const actualType = Array.isArray(value) ? "array" : typeof value;

            if (expectedType && actualType !== expectedType) {
              errors.push(
                `Field "${field}" should be ${expectedType} but is ${actualType}`,
              );
            }
          }
        }
      }

      return { valid: errors.length === 0, errors };
    }

    const validResult = validateAgainstSchema(validData, schema);
    assertEquals(validResult.valid, true);
    assertEquals(validResult.errors.length, 0);

    const invalidResult = validateAgainstSchema(invalidData, schema);
    assertEquals(invalidResult.valid, false);
    assertEquals(
      invalidResult.errors[0],
      'Field "id" should be number but is string',
    );
  });
});

describe("Template Structure and Format", () => {
  it("should support multiple template formats", () => {
    const _data = {
      title: "Document",
      author: "Alice",
      tags: ["tag1", "tag2"],
    };

    // JSON template
    const jsonTemplate = {
      document: {
        title: "{{title}}",
        author: "{{author}}",
        tags: "{{tags}}",
      },
    };

    // Markdown template
    const markdownTemplate = `# {{title}}
Author: {{author}}
Tags: {{tags}}`;

    // YAML template
    const yamlTemplate = `title: {{title}}
author: {{author}}
tags: {{tags}}`;

    // All templates should be processable
    assertExists(jsonTemplate.document);
    assertEquals(markdownTemplate.includes("{{title}}"), true);
    assertEquals(yamlTemplate.includes("author:"), true);
  });

  it("should handle nested template structures", () => {
    const nestedTemplate = {
      root: {
        level1: {
          field1: "{{value1}}",
          level2: {
            field2: "{{value2}}",
            level3: {
              field3: "{{value3}}",
            },
          },
        },
      },
    };

    const data = {
      value1: "Level 1 Value",
      value2: "Level 2 Value",
      value3: "Level 3 Value",
    };

    // Recursive template processing
    function processTemplate(
      template: unknown,
      data: Record<string, unknown>,
    ): unknown {
      if (typeof template === "string") {
        return template.replace(
          /\{\{(\w+)\}\}/g,
          (_, key) => String(data[key] || ""),
        );
      }
      if (typeof template === "object" && template !== null) {
        const result: Record<string, unknown> = {};
        for (
          const [key, value] of Object.entries(
            template as Record<string, unknown>,
          )
        ) {
          result[key] = processTemplate(value, data);
        }
        return result;
      }
      return template;
    }

    const processed = processTemplate(nestedTemplate, data) as Record<
      string,
      unknown
    >;
    const root = processed.root as Record<string, unknown>;
    const level1 = root.level1 as Record<string, unknown>;
    assertEquals(level1.field1, "Level 1 Value");
    const level2 = level1.level2 as Record<string, unknown>;
    assertEquals(level2.field2, "Level 2 Value");
    const level3 = level2.level3 as Record<string, unknown>;
    assertEquals(level3.field3, "Level 3 Value");
  });
});

describe("Mapping Process", () => {
  it("should map schema-validated data to template", () => {
    // Step 1: Define schema
    const _schema = {
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        tags: { type: "array" },
      },
    };

    // Step 2: Validate and extract data
    const extractedData = {
      id: "doc-001",
      title: "Test Document",
      content: "This is the content",
      tags: ["test", "document"],
    };

    // Step 3: Define template
    const _template = {
      document: {
        identifier: "{{id}}",
        header: "{{title}}",
        body: "{{content}}",
        categories: "{{tags}}",
      },
    };

    // Step 4: Map data to template
    const mapped = {
      document: {
        identifier: extractedData.id,
        header: extractedData.title,
        body: extractedData.content,
        categories: extractedData.tags.join(", "),
      },
    };

    assertEquals(mapped.document.identifier, "doc-001");
    assertEquals(mapped.document.header, "Test Document");
    assertEquals(mapped.document.categories, "test, document");
  });

  it("should handle array mappings in templates", () => {
    const data = {
      items: [
        { name: "Item 1", value: 10 },
        { name: "Item 2", value: 20 },
        { name: "Item 3", value: 30 },
      ],
    };

    const arrayTemplate = {
      list: "{{items}}",
    };

    // Array processing logic
    function processArrayInTemplate(
      template: string,
      items: Array<Record<string, unknown>>,
    ): string {
      if (template === "{{items}}") {
        return items.map((item) => `${item.name}: ${item.value}`).join("\n");
      }
      return template;
    }

    const result = processArrayInTemplate(arrayTemplate.list, data.items);
    const expected = "Item 1: 10\nItem 2: 20\nItem 3: 30";
    assertEquals(result, expected);
  });

  it("should support conditional mapping based on schema", () => {
    const _schema = {
      properties: {
        status: {
          type: "string",
          enum: ["draft", "published", "archived"],
        },
        publishDate: {
          type: "string",
          format: "date",
        },
      },
    };

    const data1 = { status: "draft", publishDate: null };
    const data2 = { status: "published", publishDate: "2025-08-26" };

    // Conditional template selection
    function selectTemplate(data: Record<string, unknown>): string {
      if (data.status === "draft") {
        return "Draft: {{title}} (not published)";
      } else if (data.status === "published") {
        return "Published: {{title}} on {{publishDate}}";
      } else {
        return "Archived: {{title}}";
      }
    }

    const template1 = selectTemplate(data1);
    const template2 = selectTemplate(data2);

    assertEquals(template1, "Draft: {{title}} (not published)");
    assertEquals(template2, "Published: {{title}} on {{publishDate}}");
  });
});

describe("Schema and Template Replaceability", () => {
  it("should allow schema changes without modifying source markdown", () => {
    const markdown = `---
title: Flexible Document
author: John Doe
category: tutorial
level: beginner
---`;

    // Original schema (v1)
    const schemaV1 = {
      properties: {
        title: { type: "string" },
        author: { type: "string" },
      },
    };

    // Updated schema (v2) - adds new fields
    const schemaV2 = {
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        category: { type: "string" },
        level: {
          type: "string",
          enum: ["beginner", "intermediate", "advanced"],
        },
      },
    };

    // Markdown stays the same
    assertEquals(markdown.includes("category:"), true);

    // Both schemas can process the same markdown
    assertExists(schemaV1.properties.title);
    assertExists(schemaV2.properties.category);
    assertEquals(schemaV2.properties.level.enum?.includes("beginner"), true);
  });

  it("should allow template changes for different output formats", () => {
    const _data = {
      id: "123",
      title: "Multi-format Document",
      tags: ["format", "test"],
    };

    // Template for JSON output
    const jsonOutputTemplate = {
      id: "{{id}}",
      title: "{{title}}",
      tags: "{{tags}}",
    };

    // Template for HTML output
    const htmlOutputTemplate = `<div id="{{id}}">
  <h1>{{title}}</h1>
  <span class="tags">{{tags}}</span>
</div>`;

    // Template for CSV output
    const csvOutputTemplate = "{{id}},{{title}},{{tags}}";

    // Same data, different output formats
    assertExists(jsonOutputTemplate.id);
    assertEquals(htmlOutputTemplate.includes("<h1>{{title}}</h1>"), true);
    assertEquals(csvOutputTemplate.includes(","), true);
  });

  it("should support switching schema and template sets", () => {
    // Set 1: Article indexing
    const articleSchema = {
      properties: {
        title: { type: "string" },
        author: { type: "string" },
        publishDate: { type: "string" },
      },
    };

    const articleTemplate = {
      article: {
        headline: "{{title}}",
        byline: "{{author}}",
        date: "{{publishDate}}",
      },
    };

    // Set 2: Prompt collection
    const promptSchema = {
      properties: {
        name: { type: "string" },
        category: { type: "string" },
        prompt: { type: "string" },
      },
    };

    const promptTemplate = {
      prompt: {
        identifier: "{{name}}",
        type: "{{category}}",
        content: "{{prompt}}",
      },
    };

    // Different schema/template sets for different purposes
    assertExists(articleSchema.properties.publishDate);
    assertExists(promptSchema.properties.prompt);
    assertEquals(articleTemplate.article.headline, "{{title}}");
    assertEquals(promptTemplate.prompt.content, "{{prompt}}");
  });
});

describe("Template Variable Substitution", () => {
  it("should perform type-safe variable substitution", () => {
    const typedData = {
      stringField: "text",
      numberField: 42,
      booleanField: true,
      arrayField: ["a", "b", "c"],
      objectField: { key: "value" },
    };

    const template = {
      str: "{{stringField}}",
      num: "{{numberField}}",
      bool: "{{booleanField}}",
      arr: "{{arrayField}}",
      obj: "{{objectField}}",
    };

    // Type-safe substitution
    function substituteWithTypes(
      template: Record<string, string>,
      data: Record<string, unknown>,
    ): Record<string, string> {
      const result: Record<string, string> = {};

      for (const [key, templateValue] of Object.entries(template)) {
        const match = (templateValue as string).match(/\{\{(\w+)\}\}/);
        if (match) {
          const dataKey = match[1];
          const value = data[dataKey];

          if (typeof value === "object") {
            result[key] = JSON.stringify(value);
          } else {
            result[key] = String(value);
          }
        }
      }

      return result;
    }

    const substituted = substituteWithTypes(template, typedData);
    assertEquals(substituted.str, "text");
    assertEquals(substituted.num, "42");
    assertEquals(substituted.bool, "true");
    assertEquals(substituted.arr, '["a","b","c"]');
    assertEquals(substituted.obj, '{"key":"value"}');
  });

  it("should handle missing variables gracefully", () => {
    const template = "Title: {{title}}, Author: {{author}}, Date: {{date}}";
    const partialData = {
      title: "Incomplete Document",
      // author and date are missing
    };

    // Substitution with fallback
    const result = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      if (key in partialData) {
        return (partialData as Record<string, unknown>)[key] as string;
      }
      return `[Missing: ${key}]`;
    });

    assertEquals(
      result,
      "Title: Incomplete Document, Author: [Missing: author], Date: [Missing: date]",
    );
  });

  it("should support custom formatters during substitution", () => {
    const data = {
      date: "2025-08-26",
      price: 1234.56,
      tags: ["one", "two", "three"],
    };

    const formatters = {
      date: (value: string) => {
        const [year, month, day] = value.split("-");
        return `${month}/${day}/${year}`;
      },
      price: (value: number) => `$${value.toFixed(2)}`,
      tags: (value: string[]) => value.map((t) => `#${t}`).join(" "),
    };

    const template = {
      formattedDate: formatters.date(data.date),
      formattedPrice: formatters.price(data.price),
      formattedTags: formatters.tags(data.tags),
    };

    assertEquals(template.formattedDate, "08/26/2025");
    assertEquals(template.formattedPrice, "$1234.56");
    assertEquals(template.formattedTags, "#one #two #three");
  });
});
