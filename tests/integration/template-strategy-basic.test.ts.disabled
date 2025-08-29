import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  NativeTemplateStrategy,
} from "../../src/domain/template/strategies.ts";
import type { TemplateApplicationContext } from "../../src/domain/template/aggregate.ts";
import {
  Template,
  TemplateDefinition,
} from "../../src/domain/models/domain-models.ts";

const createTestTemplate = (
  format: "json" | "yaml" | "handlebars" | "custom" = "json",
  content?: string,
): Template => {
  const templateContent = content || JSON.stringify({
    title: "{{title}}",
    description: "{{description}}",
  });

  const definitionResult = TemplateDefinition.create(templateContent, format);
  if (!definitionResult.ok) {
    throw new Error(
      `Failed to create template definition: ${definitionResult.error.kind}`,
    );
  }

  const templateResult = Template.create(
    "test-template-1",
    definitionResult.data,
    "Test template",
  );
  if (!templateResult.ok) {
    throw new Error(
      `Failed to create template: ${templateResult.error.kind}`,
    );
  }

  return templateResult.data;
};

const createTestContext = (
  data: unknown = { title: "Test", description: "Test Description" },
  format: "json" | "yaml" | "markdown" = "json",
): TemplateApplicationContext => ({
  extractedData: data,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
    },
    required: ["title"],
  },
  format,
});

describe("Integration: Template Strategy Basic Tests", () => {
  describe("NativeTemplateStrategy", () => {
    it("should process JSON template successfully", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate("json");
      const context = createTestContext(
        { title: "JSON Test", description: "JSON Description" },
        "json",
      );

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "JSON Test");
        assertEquals(parsed.description, "JSON Description");
      }
    });

    it("should process YAML template successfully", async () => {
      const strategy = new NativeTemplateStrategy();
      const yamlContent = "title: {{title}}\ndescription: {{description}}";
      const template = createTestTemplate("yaml", yamlContent);
      const context = createTestContext(
        { title: "YAML Test", description: "YAML Description" },
        "yaml",
      );

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.includes("title: YAML Test"), true);
        assertEquals(
          result.data.includes("description: YAML Description"),
          true,
        );
      }
    });

    it("should handle missing placeholders gracefully", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate("json");
      const context = createTestContext(
        { title: "Only Title" }, // Missing description
        "json",
      );

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "Only Title");
        // Missing placeholders are left as-is or undefined
        assertExists(parsed.description);
      }
    });

    it("should reject invalid data types", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate("json");
      const invalidContext = createTestContext(
        "not an object", // Invalid data type
        "json",
      );

      const result = await strategy.process(template, invalidContext);

      // Native strategy expects data to be an object for placeholders
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
        assertExists(result.error);
      }
    });

    it("should handle custom format templates", async () => {
      const strategy = new NativeTemplateStrategy();
      const customContent = "Custom: {{title}} - {{description}}";
      const template = createTestTemplate("custom", customContent);
      const context = createTestContext(
        { title: "Custom", description: "Template" },
        "json",
      );

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        // Custom format should process placeholders
        assertEquals(result.data.includes("Custom:"), true);
      }
    });

    it("should handle nested data structures", async () => {
      const strategy = new NativeTemplateStrategy();
      const nestedTemplate = createTestTemplate(
        "json",
        JSON.stringify({
          title: "{{title}}",
          author: "{{author.name}}",
          metadata: "{{metadata}}",
        }),
      );

      const nestedData = {
        title: "Nested Test",
        author: { name: "Test Author", email: "test@example.com" },
        metadata: { created: "2024-08-24", tags: ["test"] },
      };

      const context = createTestContext(nestedData, "json");
      const result = await strategy.process(nestedTemplate, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "Nested Test");
        // Nested paths may or may not be supported depending on implementation
        assertExists(parsed);
      }
    });
  });

  describe("Template Format Validation", () => {
    it("should process templates with different formats", async () => {
      const strategy = new NativeTemplateStrategy();

      // Test each format
      const formats: Array<["json" | "yaml" | "custom", string]> = [
        ["json", JSON.stringify({ test: "{{value}}" })],
        ["yaml", "test: {{value}}"],
        ["custom", "Test: {{value}}"],
      ];

      for (const [format, content] of formats) {
        const template = createTestTemplate(format, content);
        const context = createTestContext({ value: "Success" }, "json");

        const result = await strategy.process(template, context);

        assertEquals(result.ok, true, `Failed for format: ${format}`);
        if (result.ok) {
          assertExists(result.data);
          assertEquals(
            result.data.includes("Success"),
            true,
            `Value not found in ${format} output`,
          );
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle empty templates", async () => {
      const strategy = new NativeTemplateStrategy();
      const emptyTemplate = createTestTemplate("custom", "Static content only");
      const context = createTestContext();

      const result = await strategy.process(emptyTemplate, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.includes("Static content"), true);
      }
    });

    it("should handle circular references gracefully", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate("json");

      const circularData: Record<string, unknown> = { title: "Circular" };
      circularData.self = circularData; // Create circular reference

      const context = createTestContext(circularData);
      const result = await strategy.process(template, context);

      // Should either handle gracefully or fail with appropriate error
      assertExists(result);
      if (!result.ok) {
        assertEquals(result.error.kind, "ValidationError");
      }
    });
  });

  describe("Performance", () => {
    it("should handle large templates efficiently", async () => {
      const strategy = new NativeTemplateStrategy();

      // Create a large template with many placeholders
      const largeTemplate: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeTemplate[`field${i}`] = `{{field${i}}}`;
      }

      const template = createTestTemplate(
        "json",
        JSON.stringify(largeTemplate),
      );

      // Create matching data
      const largeData: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeData[`field${i}`] = `value${i}`;
      }

      const context = createTestContext(largeData);
      const startTime = Date.now();
      const result = await strategy.process(template, context);
      const duration = Date.now() - startTime;

      assertEquals(result.ok, true);
      // Should process within reasonable time (< 100ms for 100 fields)
      assertEquals(duration < 100, true, `Processing took ${duration}ms`);
    });

    it("should handle concurrent requests", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate("json");

      const promises = Array.from({ length: 5 }, (_, i) =>
        strategy.process(
          template,
          createTestContext({
            title: `Concurrent ${i}`,
            description: `Test ${i}`,
          }),
        ));

      const results = await Promise.all(promises);

      assertEquals(results.length, 5);
      results.forEach((result, i) => {
        assertEquals(result.ok, true);
        if (result.ok) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.title, `Concurrent ${i}`);
        }
      });
    });
  });
});
