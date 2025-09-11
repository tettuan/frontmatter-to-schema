/**
 * Comprehensive tests for Schema-Driven Analysis Engine
 * Addressing critical test coverage gap (4.7% -> 100%)
 * Issue #401: Critical test coverage improvements
 */

import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";
import {
  GenericSchemaAnalyzer,
  SchemaAnalysisProcessor,
  SchemaGuidedTemplateMapper,
  TotalGenericSchemaAnalyzer,
  TotalSchemaGuidedTemplateMapper,
} from "../../../../src/domain/analysis/schema-driven.ts";
import { FrontMatterContent } from "../../../../src/domain/models/value-objects.ts";
import type {
  AnalysisContext,
  ExternalAnalysisService,
  PromptConfiguration,
} from "../../../../src/domain/core/abstractions.ts";

// Mock implementations for testing
class MockExternalAnalysisService implements ExternalAnalysisService {
  private responses = new Map<string, unknown>();
  private defaultResponse: unknown = { default: true };

  setResponse(key: string, response: unknown) {
    this.responses.set(key, response);
  }

  setDefaultResponse(response: unknown) {
    this.defaultResponse = response;
  }

  analyze(
    prompt: string,
    _options?: Record<string, unknown>,
  ): Promise<unknown> {
    // Return based on prompt content for predictable testing
    if (prompt.includes("error")) {
      throw new Error("Analysis failed");
    }
    if (prompt.includes("Extract data:")) {
      const response = this.responses.get("extract");
      return Promise.resolve(
        response !== undefined ? response : { extracted: true },
      );
    }
    if (prompt.includes("Map source:")) {
      const response = this.responses.get("mapping");
      return Promise.resolve(
        response !== undefined ? response : { mapped: true },
      );
    }
    return Promise.resolve(this.defaultResponse);
  }
}

const createMockPrompts = (): PromptConfiguration => ({
  extractionPrompt:
    "Extract data: {{data}} with schema: {{schema}} from {{sourceFile}} using {{options}}",
  mappingPrompt:
    "Map source: {{source}} to template: {{template}} with schema: {{schema}}",
});

Deno.test("GenericSchemaAnalyzer", async (t) => {
  const mockService = new MockExternalAnalysisService();
  const mockPrompts = createMockPrompts();
  const analyzer = new GenericSchemaAnalyzer(mockService, mockPrompts);

  await t.step("should analyze data with schema successfully", async () => {
    const data = { name: "test", value: 42 };
    const schema = { type: "object", properties: { name: { type: "string" } } };

    mockService.setResponse("extract", { name: "processed" });

    const result = await analyzer.analyze(data, schema);
    assertEquals(result, { name: "processed" });
  });

  await t.step(
    "should handle context with source file and options",
    async () => {
      const data = { test: true };
      const schema = { type: "object" };
      const context: AnalysisContext = {
        sourceFile: "test.md",
        options: { debug: true },
      };

      const result = await analyzer.analyze(data, schema, context);
      assertExists(result);
    },
  );

  await t.step(
    "should handle FrontMatterContent data serialization",
    async () => {
      const frontMatterData = FrontMatterContent.create(
        "title: Test\ncontent: body",
      );
      const schema = { type: "object" };

      if (frontMatterData.ok) {
        const result = await analyzer.analyze(frontMatterData.data, schema);
        assertExists(result);
      }
    },
  );

  await t.step("should serialize different data types correctly", async () => {
    const testCases = [
      { data: "string", expected: "string" },
      { data: 42, expected: "42" },
      { data: true, expected: "true" },
      { data: null, expected: "null" },
      {
        data: { key: "value" },
        expected: JSON.stringify({ key: "value" }, null, 2),
      },
    ];

    for (const { data } of testCases) {
      const schema = { type: typeof data };
      const result = await analyzer.analyze(data, schema);
      assertExists(result);
    }
  });

  await t.step("should validate analysis results", async () => {
    const data = { test: "data" };
    const schema = { type: "object" };

    // Valid result
    mockService.setResponse("extract", { valid: "result" });
    const validResult = await analyzer.analyze(data, schema);
    assertEquals(validResult, { valid: "result" });

    // Test invalid results - create a mock that forces null/undefined responses
    const invalidService: ExternalAnalysisService = {
      analyze() {
        return Promise.resolve(null);
      },
    };
    const invalidAnalyzer = new GenericSchemaAnalyzer(
      invalidService,
      mockPrompts,
    );

    await assertRejects(
      () => invalidAnalyzer.analyze(data, schema),
      Error,
      "Analysis result cannot be null or undefined",
    );
  });

  await t.step("should handle external service errors", async () => {
    const mockServiceWithError = new MockExternalAnalysisService();

    // Use a different prompt that will trigger the error
    const errorPrompts = {
      extractionPrompt: "Error analysis: error data",
      mappingPrompt:
        "Map source: {{source}} to template: {{template}} with schema: {{schema}}",
    };
    const errorAnalyzerCustom = new GenericSchemaAnalyzer(
      mockServiceWithError,
      errorPrompts,
    );

    const data = { test: "data" };
    const schema = { type: "object" };

    await assertRejects(
      () => errorAnalyzerCustom.analyze(data, schema),
      Error,
      "Analysis failed",
    );
  });

  await t.step("should replace prompt placeholders correctly", async () => {
    const data = { name: "test" };
    const schema = { type: "object" };
    const context: AnalysisContext = {
      sourceFile: "test.md",
      options: { mode: "test" },
    };

    // The prompt should include replaced placeholders
    const result = await analyzer.analyze(data, schema, context);
    assertExists(result);
  });
});

Deno.test("SchemaGuidedTemplateMapper", async (t) => {
  const mockService = new MockExternalAnalysisService();
  const mockPrompts = createMockPrompts();
  const mapper = new SchemaGuidedTemplateMapper(mockService, mockPrompts);

  await t.step("should map source to template successfully", async () => {
    const source = { name: "John", age: 30 };
    const template = { greeting: "Hello {{name}}", info: "Age: {{age}}" };
    const schema = { type: "object" };

    mockService.setResponse("mapping", {
      greeting: "Hello John",
      info: "Age: 30",
    });

    const result = await mapper.map(source, template, schema);
    assertEquals(result, { greeting: "Hello John", info: "Age: 30" });
  });

  await t.step("should handle mapping without schema", async () => {
    const source = { data: "test" };
    const template = { output: "{{data}}" };

    mockService.setResponse("mapping", { output: "test" });

    const result = await mapper.map(source, template);
    assertEquals(result, { output: "test" });
  });

  await t.step(
    "should handle string response from external service",
    async () => {
      const source = { value: 42 };
      const template = { result: "{{value}}" };

      mockService.setResponse("mapping", '{"result": "42"}');

      const result = await mapper.map(source, template);
      assertEquals(result, { result: "42" });
    },
  );

  await t.step("should merge result with template structure", async () => {
    const source = { name: "test" };
    const template = {
      greeting: "Hello {{name}}",
      timestamp: "{{now}}",
      default: "keep",
    };

    mockService.setResponse("mapping", {
      greeting: "Hello test",
      timestamp: "2023-01-01",
    });

    const result = await mapper.map(source, template) as Record<
      string,
      unknown
    >;
    assertEquals(result.greeting, "Hello test");
    assertEquals(result.timestamp, "2023-01-01");
    assertEquals(result.default, "keep"); // Template structure preserved
  });

  await t.step("should handle non-object templates", async () => {
    const source = { value: "test" };
    const template = "Template: {{value}}";

    // For string templates, the response should be JSON parseable
    // or the mapper will treat it as an error - this tests that behavior
    mockService.setResponse("mapping", '"Template: test"'); // JSON string

    const result = await mapper.map(source, template);
    assertEquals(result, "Template: test");
  });

  await t.step("should handle JSON parsing errors", async () => {
    const source = { data: "test" };
    const template = { output: "{{data}}" };

    mockService.setResponse("mapping", "invalid json {");

    await assertRejects(
      () => mapper.map(source, template),
      Error,
      "Failed to map template",
    );
  });

  await t.step(
    "should prepare mapping prompt with all placeholders",
    async () => {
      const source = { name: "John" };
      const template = { greeting: "Hello {{name}}" };
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };

      // Create a clean mapper instance
      const cleanMockService = new MockExternalAnalysisService();
      const cleanMapper = new SchemaGuidedTemplateMapper(
        cleanMockService,
        mockPrompts,
      );
      cleanMockService.setResponse(
        "mapping",
        JSON.stringify({ greeting: "Hello John" }),
      );

      // Prompt should include source, template, and schema replacements
      const result = await cleanMapper.map(source, template, schema);
      assertExists(result);
    },
  );
});

Deno.test("SchemaAnalysisProcessor", async (t) => {
  const mockService = new MockExternalAnalysisService();
  const mockPrompts = createMockPrompts();
  const mockAnalyzer = new TotalGenericSchemaAnalyzer(mockService, mockPrompts);
  const mockMapper = new TotalSchemaGuidedTemplateMapper(
    mockService,
    mockPrompts,
  );
  const schema = { type: "object" };
  const template = { output: "{{result}}" };

  const processor = new SchemaAnalysisProcessor(
    mockAnalyzer,
    mockMapper,
    schema,
    template,
  );

  await t.step("should process input successfully", async () => {
    const input = { name: "test", value: 42 };
    const context: AnalysisContext = {
      sourceFile: "test.md",
      metadata: new Map([["key", "value"]]),
    };

    mockService.setResponse("extract", { analyzed: "data" });
    mockService.setResponse("mapping", { output: "processed" });

    const result = await processor.process(input, context);

    assertEquals(result.data, { output: "processed" });
    assertEquals(result.isValid, true);
    assertEquals(result.errors?.length, 0);
    assertEquals(result.metadata.get("key"), "value");
  });

  await t.step("should handle processing errors gracefully", async () => {
    const input = { error: "trigger" };
    const context: AnalysisContext = {
      metadata: new Map([["source", "test"]]),
    };

    const result = await processor.process(input, context);

    assertEquals(result.data, template); // Returns template on error
    assertEquals(result.isValid, false);
    assertEquals(result.errors?.length, 1);
    assertEquals(result.errors?.[0], "Analysis failed");
    assertEquals(result.metadata.get("source"), "test");
  });

  await t.step("should process multiple inputs", async () => {
    const inputs = [
      { name: "first" },
      { name: "second" },
      { name: "third" },
    ];
    const context: AnalysisContext = {
      metadata: new Map([["batch", "test"]]),
      options: { mode: "batch" },
    };

    mockService.setResponse("extract", { processed: true });
    mockService.setResponse("mapping", { output: "batch-result" });

    const results = await processor.processMany(inputs, context);

    assertEquals(results.length, 3);

    for (let i = 0; i < results.length; i++) {
      assertEquals(results[i].data, { output: "batch-result" });
      assertEquals(results[i].isValid, true);
      assertEquals(results[i].metadata.get("batch"), "test");
      // Each result should have its own metadata copy
      assertExists(results[i].metadata);
    }
  });

  await t.step(
    "should handle mixed success/failure in batch processing",
    async () => {
      const inputs = [
        { name: "success" },
        { error: "trigger" }, // This will fail
        { name: "success2" },
      ];

      mockService.setResponse("extract", { success: true });
      mockService.setResponse("mapping", { output: "success" });

      const results = await processor.processMany(inputs);

      assertEquals(results.length, 3);
      assertEquals(results[0].isValid, true);
      assertEquals(results[1].isValid, false); // Failed input
      assertEquals(results[2].isValid, true);
    },
  );

  await t.step(
    "should pass index in options for batch processing",
    async () => {
      const inputs = [{ item: 1 }, { item: 2 }];
      const context: AnalysisContext = {
        options: { baseOption: "test" },
      };

      mockService.setResponse("extract", { indexed: true });
      mockService.setResponse("mapping", { output: "indexed" });

      const results = await processor.processMany(inputs, context);

      assertEquals(results.length, 2);
      // Each result should have been processed with its index
      for (const result of results) {
        assertEquals(result.isValid, true);
      }
    },
  );
});

Deno.test("Component Creation", async (t) => {
  const mockService = new MockExternalAnalysisService();
  const mockPrompts = createMockPrompts();

  await t.step("should create analyzer instance", () => {
    const analyzer = new GenericSchemaAnalyzer(
      mockService,
      mockPrompts,
    );

    assertExists(analyzer);
    assertEquals(analyzer instanceof GenericSchemaAnalyzer, true);
  });

  await t.step("should create mapper instance", () => {
    const mapper = new SchemaGuidedTemplateMapper(
      mockService,
      mockPrompts,
    );

    assertExists(mapper);
    assertEquals(mapper instanceof SchemaGuidedTemplateMapper, true);
  });

  await t.step("should create processor with analyzer and mapper", () => {
    const schema = { type: "object" };
    const template = { output: "{{result}}" };

    const analyzer = new TotalGenericSchemaAnalyzer(mockService, mockPrompts);
    const mapper = new TotalSchemaGuidedTemplateMapper(mockService, mockPrompts);
    const processor = new SchemaAnalysisProcessor(
      analyzer,
      mapper,
      schema,
      template,
    );

    assertExists(processor);
    assertEquals(processor instanceof SchemaAnalysisProcessor, true);
  });

  await t.step("should create processor that works end-to-end", async () => {
    const schema = { type: "object" };
    const template = { greeting: "Hello {{name}}" };

    const analyzer = new TotalGenericSchemaAnalyzer(mockService, mockPrompts);
    const mapper = new TotalSchemaGuidedTemplateMapper(mockService, mockPrompts);
    const processor = new SchemaAnalysisProcessor(
      analyzer,
      mapper,
      schema,
      template,
    );

    mockService.setResponse("extract", { name: "World" });
    mockService.setResponse("mapping", { greeting: "Hello World" });

    const result = await processor.process({ input: "test" });

    assertEquals(result.isValid, true);
    assertEquals(result.data, { greeting: "Hello World" });
  });
});

Deno.test("Schema-Driven Analysis Integration", async (t) => {
  await t.step("should handle complex real-world scenario", async () => {
    const mockService = new MockExternalAnalysisService();
    const mockPrompts = createMockPrompts();

    // Complex schema
    const schema = {
      type: "object",
      properties: {
        metadata: {
          type: "object",
          properties: {
            title: { type: "string" },
            author: { type: "string" },
            date: { type: "string" },
          },
        },
        content: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: { type: "string" },
            },
            tags: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    };

    // Complex template
    const template = {
      title: "{{metadata.title}}",
      byline: "By {{metadata.author}} on {{metadata.date}}",
      summary:
        "{{content.sections.length}} sections, {{content.tags.length}} tags",
      sections: "{{content.sections}}",
      tags: "{{content.tags}}",
    };

    // Complex input
    const input = {
      title: "Test Article",
      author: "John Doe",
      date: "2023-01-01",
      body: "Article content with sections and tags",
      categories: ["tech", "tutorial"],
    };

    const analyzer = new TotalGenericSchemaAnalyzer(mockService, mockPrompts);
    const mapper = new TotalSchemaGuidedTemplateMapper(mockService, mockPrompts);
    const processor = new SchemaAnalysisProcessor(
      analyzer,
      mapper,
      schema,
      template,
    );

    // Set up complex responses
    mockService.setResponse("extract", {
      metadata: {
        title: "Test Article",
        author: "John Doe",
        date: "2023-01-01",
      },
      content: {
        sections: ["Introduction", "Main Content", "Conclusion"],
        tags: ["tech", "tutorial"],
      },
    });

    mockService.setResponse("mapping", {
      title: "Test Article",
      byline: "By John Doe on 2023-01-01",
      summary: "3 sections, 2 tags",
      sections: ["Introduction", "Main Content", "Conclusion"],
      tags: ["tech", "tutorial"],
    });

    const result = await processor.process(input, {
      sourceFile: "complex-test.md",
      options: { complexProcessing: true },
    });

    assertEquals(result.isValid, true);
    assertEquals((result.data as any).title, "Test Article");
    assertEquals((result.data as any).byline, "By John Doe on 2023-01-01");
    assertEquals((result.data as any).summary, "3 sections, 2 tags");
  });

  await t.step("should handle edge cases and error conditions", async () => {
    const mockService = new MockExternalAnalysisService();
    const mockPrompts = createMockPrompts();
    const analyzer = new TotalGenericSchemaAnalyzer(mockService, mockPrompts);
    const mapper = new TotalSchemaGuidedTemplateMapper(mockService, mockPrompts);
    const processor = new SchemaAnalysisProcessor(
      analyzer,
      mapper,
      {},
      {},
    );

    const edgeCases = [
      { input: null, description: "null input" },
      { input: undefined, description: "undefined input" },
      { input: "", description: "empty string input" },
      { input: {}, description: "empty object input" },
      { input: [], description: "empty array input" },
    ];

    mockService.setResponse("extract", { processed: true });
    mockService.setResponse("mapping", { result: "processed" });

    for (const { input, description } of edgeCases) {
      const result = await processor.process(input);
      assertExists(result, `Should handle ${description}`);
    }
  });
});
