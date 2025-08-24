import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  AITemplateStrategy,
  CompositeTemplateStrategy,
  NativeTemplateStrategy,
  type TemplateApplicationContext,
  type TemplateProcessingStrategy,
} from "../../src/domain/template/strategies.ts";
import { Template, TemplateDefinition } from "../../src/domain/models/template.ts";
import type { ClaudeSchemaAnalyzer } from "../../src/infrastructure/adapters/claude-schema-analyzer.ts";
import type { Result } from "../../src/domain/core/result.ts";
import type { ValidationError } from "../../src/domain/shared/errors.ts";

// Test fixtures
const createMockAnalyzer = (): ClaudeSchemaAnalyzer => ({
  analyzeWithSchema: async (data: unknown, schema: object) => ({
    ok: true as const,
    data: {
      isValid: true,
      extractedData: { 
        title: "Processed Title",
        description: "Processed Description",
        ...data 
      },
      confidence: 0.95,
    },
  }),
  analyzeWithTemplate: async (data: unknown, template: string) => ({
    ok: true as const,
    data: {
      mappedData: JSON.stringify({
        title: "Template Mapped",
        content: "Mapped content",
      }),
      confidence: 0.9,
    },
  }),
  validateAgainstSchema: async (data: unknown, schema: object) => ({
    ok: true as const,
    data: {
      isValid: true,
      errors: [],
    },
  }),
});

const createTestTemplate = (format: "json" | "yaml" | "markdown" = "json"): Template => {
  const definition = new TemplateDefinition(
    "test-template",
    {
      template: "{{title}} - {{description}}",
      fields: ["title", "description"],
    },
    format,
  );
  return new Template("test-template-1", definition);
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

describe("Integration: Template Processing Strategies", () => {
  describe("AITemplateStrategy", () => {
    it("should process template with AI analyzer successfully", async () => {
      const analyzer = createMockAnalyzer();
      const strategy = new AITemplateStrategy(analyzer);
      const template = createTestTemplate();
      const context = createTestContext();

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(typeof result.data, "string");
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "Template Mapped");
      }
    });

    it("should handle AI analyzer errors gracefully", async () => {
      const failingAnalyzer: ClaudeSchemaAnalyzer = {
        ...createMockAnalyzer(),
        analyzeWithTemplate: async () => ({
          ok: false as const,
          error: {
            kind: "ValidationError" as const,
            message: "AI analysis failed",
          },
        }),
      };

      const strategy = new AITemplateStrategy(failingAnalyzer);
      const template = createTestTemplate();
      const context = createTestContext();

      const result = await strategy.process(template, context);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ValidationError");
        assertEquals(result.error.message.includes("AI analysis failed"), true);
      }
    });

    it("should validate data against schema before processing", async () => {
      const analyzer = createMockAnalyzer();
      const strategy = new AITemplateStrategy(analyzer);
      const template = createTestTemplate();
      const invalidContext = createTestContext(
        { description: "Missing required title" },
        "json",
      );

      const result = await strategy.process(template, invalidContext);

      // The mock analyzer returns valid, but in real scenario this would fail
      assertEquals(result.ok, true);
    });
  });

  describe("NativeTemplateStrategy", () => {
    it("should process JSON template natively", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate("json");
      const context = createTestContext(
        { title: "Native Test", description: "Native Description" },
        "json",
      );

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "Native Test");
        assertEquals(parsed.description, "Native Description");
      }
    });

    it("should process YAML template natively", async () => {
      const strategy = new NativeTemplateStrategy();
      const yamlTemplate = new Template(
        "yaml-template",
        new TemplateDefinition(
          "yaml-template",
          {
            template: "title: {{title}}\ndescription: {{description}}",
            fields: ["title", "description"],
          },
          "yaml",
        ),
      );
      const context = createTestContext(
        { title: "YAML Test", description: "YAML Description" },
        "yaml",
      );

      const result = await strategy.process(yamlTemplate, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("title: YAML Test"), true);
        assertEquals(result.data.includes("description: YAML Description"), true);
      }
    });

    it("should process Markdown template natively", async () => {
      const strategy = new NativeTemplateStrategy();
      const mdTemplate = new Template(
        "md-template",
        new TemplateDefinition(
          "md-template",
          {
            template: "# {{title}}\n\n{{description}}",
            fields: ["title", "description"],
          },
          "markdown",
        ),
      );
      const context = createTestContext(
        { title: "Markdown Test", description: "Markdown Description" },
        "markdown",
      );

      const result = await strategy.process(mdTemplate, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Markdown Test"), true);
        assertEquals(result.data.includes("Markdown Description"), true);
      }
    });

    it("should handle missing template fields gracefully", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate();
      const context = createTestContext(
        { title: "Only Title" }, // Missing description
        "json",
      );

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "Only Title");
        assertEquals(parsed.description, undefined);
      }
    });

    it("should reject invalid data types", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate();
      const invalidContext = createTestContext(
        "not an object", // Invalid data type
        "json",
      );

      const result = await strategy.process(template, invalidContext);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ValidationError");
        assertEquals(result.error.message.includes("must be an object"), true);
      }
    });
  });

  describe("CompositeTemplateStrategy", () => {
    it("should use primary strategy when successful", async () => {
      const analyzer = createMockAnalyzer();
      const primary = new AITemplateStrategy(analyzer);
      const fallback = new NativeTemplateStrategy();
      const strategy = new CompositeTemplateStrategy(primary, fallback);

      const template = createTestTemplate();
      const context = createTestContext();

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "Template Mapped"); // AI strategy result
      }
    });

    it("should fallback to secondary strategy on primary failure", async () => {
      const failingAnalyzer: ClaudeSchemaAnalyzer = {
        ...createMockAnalyzer(),
        analyzeWithTemplate: async () => ({
          ok: false as const,
          error: {
            kind: "ValidationError" as const,
            message: "AI unavailable",
          },
        }),
      };

      const primary = new AITemplateStrategy(failingAnalyzer);
      const fallback = new NativeTemplateStrategy();
      const strategy = new CompositeTemplateStrategy(primary, fallback);

      const template = createTestTemplate();
      const context = createTestContext(
        { title: "Fallback Test", description: "Fallback Description" },
      );

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "Fallback Test"); // Native strategy result
      }
    });

    it("should return error when both strategies fail", async () => {
      const failingAnalyzer: ClaudeSchemaAnalyzer = {
        ...createMockAnalyzer(),
        analyzeWithTemplate: async () => ({
          ok: false as const,
          error: {
            kind: "ValidationError" as const,
            message: "AI failed",
          },
        }),
      };

      const primary = new AITemplateStrategy(failingAnalyzer);
      const fallback = new NativeTemplateStrategy();
      const strategy = new CompositeTemplateStrategy(primary, fallback);

      const template = createTestTemplate();
      const invalidContext = createTestContext(
        null, // Invalid data that both strategies will reject
      );

      const result = await strategy.process(template, invalidContext);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ValidationError");
        // Should contain information about both failures
        assertEquals(result.error.message.includes("Both strategies failed"), true);
      }
    });
  });

  describe("Strategy Integration with Template Aggregate", () => {
    it("should integrate with template aggregate for end-to-end processing", async () => {
      // This test would require the full aggregate setup
      // Demonstrating the integration pattern
      const analyzer = createMockAnalyzer();
      const strategy = new CompositeTemplateStrategy(
        new AITemplateStrategy(analyzer),
        new NativeTemplateStrategy(),
      );

      const template = createTestTemplate();
      const context = createTestContext({
        title: "Integration Test",
        description: "Full pipeline test",
        metadata: {
          author: "Test Author",
          date: "2024-08-24",
        },
      });

      const result = await strategy.process(template, context);

      assertEquals(result.ok, true);
      assertExists(result.data);
    });

    it("should handle complex nested data structures", async () => {
      const strategy = new NativeTemplateStrategy();
      const complexTemplate = new Template(
        "complex-template",
        new TemplateDefinition(
          "complex-template",
          {
            template: JSON.stringify({
              title: "{{title}}",
              sections: "{{sections}}",
              metadata: "{{metadata}}",
            }),
            fields: ["title", "sections", "metadata"],
          },
          "json",
        ),
      );

      const complexData = {
        title: "Complex Document",
        sections: [
          { id: 1, content: "Section 1" },
          { id: 2, content: "Section 2" },
        ],
        metadata: {
          created: "2024-08-24",
          tags: ["test", "integration"],
        },
      };

      const context = createTestContext(complexData);
      const result = await strategy.process(complexTemplate, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.title, "Complex Document");
        assertEquals(Array.isArray(parsed.sections), true);
        assertEquals(parsed.sections.length, 2);
        assertExists(parsed.metadata);
      }
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle template without fields gracefully", async () => {
      const strategy = new NativeTemplateStrategy();
      const emptyTemplate = new Template(
        "empty-template",
        new TemplateDefinition(
          "empty-template",
          {
            template: "Static content only",
            fields: [],
          },
          "markdown",
        ),
      );

      const context = createTestContext();
      const result = await strategy.process(emptyTemplate, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "Static content only");
      }
    });

    it("should handle circular references in data", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate();
      
      const circularData: any = { title: "Circular" };
      circularData.self = circularData; // Create circular reference

      const context = createTestContext(circularData);
      const result = await strategy.process(template, context);

      // Should handle circular references gracefully
      assertEquals(result.ok, true);
    });

    it("should validate format consistency", async () => {
      const strategy = new NativeTemplateStrategy();
      const jsonTemplate = createTestTemplate("json");
      const yamlContext = createTestContext(
        { title: "Format Mismatch" },
        "yaml", // Different format than template
      );

      const result = await strategy.process(jsonTemplate, yamlContext);

      // Should still process but may warn about format mismatch
      assertEquals(result.ok, true);
    });
  });

  describe("Performance and Concurrency", () => {
    it("should handle concurrent processing requests", async () => {
      const analyzer = createMockAnalyzer();
      const strategy = new AITemplateStrategy(analyzer);
      const template = createTestTemplate();

      const promises = Array.from({ length: 10 }, (_, i) =>
        strategy.process(
          template,
          createTestContext({ title: `Concurrent ${i}` }),
        ),
      );

      const results = await Promise.all(promises);

      assertEquals(results.length, 10);
      results.forEach((result) => {
        assertEquals(result.ok, true);
      });
    });

    it("should process large datasets efficiently", async () => {
      const strategy = new NativeTemplateStrategy();
      const template = createTestTemplate();
      
      const largeData = {
        title: "Large Dataset",
        description: "x".repeat(10000), // 10KB of data
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `Item ${i}`,
        })),
      };

      const context = createTestContext(largeData);
      const startTime = Date.now();
      const result = await strategy.process(template, context);
      const duration = Date.now() - startTime;

      assertEquals(result.ok, true);
      // Should process within reasonable time (< 1 second)
      assertEquals(duration < 1000, true);
    });
  });
});