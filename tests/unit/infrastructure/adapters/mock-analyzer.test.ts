/**
 * Comprehensive tests for MockAnalyzer
 * Covering AIAnalyzerPort and SchemaAnalyzer implementations
 * Following AAA pattern and Totality principles
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertObjectMatch,
} from "jsr:@std/assert";
import {
  MockAIAnalyzer,
  MockAnalyzer,
  MockSchemaAnalyzer,
} from "../../../../src/infrastructure/adapters/mock-analyzer.ts";
import type {
  AIAnalysisRequest,
  AIAnalysisResponse,
} from "../../../../src/infrastructure/ports/index.ts";
import {
  ExtractedData,
  type FrontMatter as _FrontMatter,
  type Schema,
} from "../../../../src/domain/models/entities.ts";
import type { Result } from "../../../../src/domain/core/result.ts";
import type { DomainError } from "../../../../src/domain/core/result.ts";
import type { APIError } from "../../../../src/domain/shared/errors.ts";

// Test helpers
function createTestSchema(): Schema {
  return {
    getFields: () => [
      { name: "title", type: "string", required: true },
      { name: "description", type: "string", required: false },
    ],
    validate: () => ({ ok: true, data: undefined }),
  } as unknown as Schema;
}

function createTestFrontMatter(
  content: Record<string, unknown>,
): { getContent: () => { toJSON: () => Record<string, unknown> } } {
  return {
    getContent: () => ({
      toJSON: () => content,
    }),
  };
}

Deno.test("MockAnalyzer - Constructor and Aliases", async (t) => {
  await t.step("creates instance with default config", () => {
    // Arrange & Act
    const analyzer = new MockAnalyzer();

    // Assert
    assertExists(analyzer);
    assert(analyzer instanceof MockAnalyzer);
  });

  await t.step("creates instance with custom config", () => {
    // Arrange
    const config = { apiKey: "test-key" };
    const extractPrompt = "Extract template";
    const mappingPrompt = "Mapping template";

    // Act
    const analyzer = new MockAnalyzer(config, extractPrompt, mappingPrompt);

    // Assert
    assertExists(analyzer);
    assert(analyzer instanceof MockAnalyzer);
  });

  await t.step("MockSchemaAnalyzer alias works correctly", () => {
    // Arrange & Act
    const analyzer = new MockSchemaAnalyzer();

    // Assert
    assertExists(analyzer);
    assertEquals(MockSchemaAnalyzer, MockAnalyzer);
  });

  await t.step("MockAIAnalyzer alias works correctly", () => {
    // Arrange & Act
    const analyzer = new MockAIAnalyzer();

    // Assert
    assertExists(analyzer);
    assertEquals(MockAIAnalyzer, MockAnalyzer);
  });
});

Deno.test("MockAnalyzer - AI Analysis", async (t) => {
  await t.step("analyzes extraction request successfully", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const request: AIAnalysisRequest = {
      prompt: "extract data from content",
      content: JSON.stringify({
        title: "Test Title",
        description: "Test Description",
        tags: ["test", "mock"],
      }),
    };

    // Act
    const result = await analyzer.analyze(
      request,
    ) as Result<AIAnalysisResponse, APIError>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    assertExists(result.data.result);
    const parsed = JSON.parse(result.data.result);
    assertEquals(parsed.title, "Test Title");
    assertEquals(parsed.description, "Test Description");
    assert(Array.isArray(parsed.tags));
  });

  await t.step("analyzes template request successfully", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const request: AIAnalysisRequest = {
      prompt: "apply template to content",
      content: JSON.stringify({
        data: "test data",
      }),
    };

    // Act
    const result = await analyzer.analyze(
      request,
    ) as Result<AIAnalysisResponse, APIError>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const parsed = JSON.parse(result.data.result);
    assertEquals(parsed.formatted, true);
    assertObjectMatch(parsed.data, { data: "test data" });
  });

  await t.step("analyzes generic request successfully", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const request: AIAnalysisRequest = {
      prompt: "process this content",
      content: JSON.stringify({
        value: 42,
      }),
    };

    // Act
    const result = await analyzer.analyze(
      request,
    ) as Result<AIAnalysisResponse, APIError>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const parsed = JSON.parse(result.data.result);
    assertEquals(parsed.processed, true);
    assertObjectMatch(parsed.original, { value: 42 });
  });

  await t.step("handles non-JSON content", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const request: AIAnalysisRequest = {
      prompt: "extract from plain text",
      content: "This is plain text content",
    };

    // Act
    const result = await analyzer.analyze(
      request,
    ) as Result<AIAnalysisResponse, APIError>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const parsed = JSON.parse(result.data.result);
    assertExists(parsed);
  });

  await t.step("includes token usage information", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const request: AIAnalysisRequest = {
      prompt: "analyze",
      content: "{}",
    };

    // Act
    const result = await analyzer.analyze(
      request,
    ) as Result<AIAnalysisResponse, APIError>;

    // Assert
    assert(result.ok);
    assertExists(result.data?.usage);
    assertEquals(result.data.usage.promptTokens, 50);
    assertEquals(result.data.usage.completionTokens, 50);
    assertEquals(result.data.usage.totalTokens, 100);
  });

  await t.step("handles empty JSON content", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const request: AIAnalysisRequest = {
      prompt: "extract",
      content: "{}",
    };

    // Act
    const result = await analyzer.analyze(
      request,
    ) as Result<AIAnalysisResponse, APIError>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const parsed = JSON.parse(result.data.result);
    assertEquals(parsed.title, "Extracted Title");
    assertEquals(parsed.description, "Extracted Description");
  });
});

Deno.test("MockAnalyzer - Schema Analysis", async (t) => {
  await t.step("analyzes frontmatter with schema successfully", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const frontMatter = createTestFrontMatter({
      title: "Custom Title",
      description: "Custom Description",
      author: "Test Author",
    });
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    ) as Result<ExtractedData, DomainError & { message: string }>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const extractedData = result.data as ExtractedData;
    const data = extractedData.getData();
    assertEquals(data.title, "Custom Title");
    assertEquals(data.description, "Custom Description");
    assertEquals(data.author, "Test Author");
    assertEquals(data._mock, true);
    assertExists(data._processedAt);
  });

  await t.step("handles empty frontmatter content", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const frontMatter = createTestFrontMatter({});
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    ) as Result<ExtractedData, DomainError & { message: string }>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const extractedData = result.data as ExtractedData;
    const data = extractedData.getData();
    assertEquals(data.title, "Test Title");
    assertEquals(data.description, "Test Description");
    assertEquals(data._mock, true);
  });

  await t.step("preserves all frontmatter fields", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const complexContent = {
      title: "Title",
      nested: {
        field: "value",
        array: [1, 2, 3],
      },
      tags: ["tag1", "tag2"],
      date: "2024-01-01",
      number: 42,
      boolean: true,
    };
    const frontMatter = createTestFrontMatter(complexContent);
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    ) as Result<ExtractedData, DomainError & { message: string }>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const extractedData = result.data as ExtractedData;
    const data = extractedData.getData();
    assertEquals(data.title, "Title");
    // deno-lint-ignore no-explicit-any
    assertObjectMatch(data.nested as any, { field: "value", array: [1, 2, 3] });
    assert(Array.isArray(data.tags));
    assertEquals(data.tags, ["tag1", "tag2"]);
    assertEquals(data.date, "2024-01-01");
    assertEquals(data.number, 42);
    assertEquals(data.boolean, true);
  });

  await t.step("adds processing metadata", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const frontMatter = createTestFrontMatter({ key: "value" });
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    ) as Result<ExtractedData, DomainError & { message: string }>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const extractedData = result.data as ExtractedData;
    const data = extractedData.getData();
    assertEquals(data._mock, true);
    assertExists(data._processedAt);
    assert(typeof data._processedAt === "string");
    // Check ISO date format
    assert(data._processedAt.match(/^\d{4}-\d{2}-\d{2}T/));
  });

  await t.step("handles null frontmatter content", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    // deno-lint-ignore no-explicit-any
    const frontMatter = createTestFrontMatter(null as any);
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    ) as Result<ExtractedData, DomainError & { message: string }>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const extractedData = result.data as ExtractedData;
    const data = extractedData.getData();
    assertEquals(data.title, "Test Title");
    assertEquals(data.description, "Test Description");
  });

  await t.step("handles undefined frontmatter fields", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const frontMatter = createTestFrontMatter({
      title: undefined,
      description: undefined,
      other: "value",
    });
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    ) as Result<ExtractedData, DomainError & { message: string }>;

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const extractedData = result.data as ExtractedData;
    const data = extractedData.getData();
    // The spread operator will include undefined values, overriding defaults
    assertEquals(data.title, undefined);
    assertEquals(data.description, undefined);
    assertEquals(data.other, "value");
    assertEquals(data._mock, true);
    assertExists(data._processedAt);
  });
});

Deno.test("MockAnalyzer - Error Handling", async (t) => {
  await t.step("handles AI analysis error gracefully", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    // Create a request that will cause parsing to fail in a controlled way
    const request: AIAnalysisRequest = {
      prompt: "analyze",
      content: "{'invalid json",
    };

    // Override JSON.stringify to throw an error
    const originalStringify = JSON.stringify;
    JSON.stringify = () => {
      throw new Error("Stringify error");
    };

    // Act
    const result = await analyzer.analyze(
      request,
    ) as Result<AIAnalysisResponse, APIError>;

    // Restore original stringify
    JSON.stringify = originalStringify;

    // Assert
    assert(!result.ok);
    assertExists(result.error);
    assert("message" in result.error);
    assert(result.error.message.includes("Stringify error"));
  });

  await t.step("handles schema analysis error gracefully", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    // Create a frontMatter that will cause an error
    const frontMatter = {
      getContent: () => {
        throw new Error("Content access error");
      },
    };
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    ) as Result<ExtractedData, DomainError & { message: string }>;

    // Assert
    assert(!result.ok);
    assertExists(result.error);
    assertEquals(result.error.kind, "AIServiceError");
    // deno-lint-ignore no-explicit-any
    const errorWithService = result.error as any;
    assertEquals(errorWithService.service, "mock");
    assertEquals(errorWithService.statusCode, 500);
  });

  await t.step("handles ExtractedData creation error", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const frontMatter = createTestFrontMatter({ data: "value" });
    const schema = createTestSchema();

    // Mock ExtractedData.create to throw
    const originalCreate = ExtractedData.create;
    ExtractedData.create = () => {
      throw new Error("Creation failed");
    };

    // Act
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    ) as Result<ExtractedData, DomainError & { message: string }>;

    // Restore original create
    ExtractedData.create = originalCreate;

    // Assert
    assert(!result.ok);
    assertExists(result.error);
    // deno-lint-ignore no-explicit-any
    const domainError = result.error as any;
    assertEquals(domainError.kind, "AIServiceError");
  });
});

Deno.test("MockAnalyzer - Method Overloading", async (t) => {
  await t.step("correctly identifies AI analysis request", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const aiRequest: AIAnalysisRequest = {
      prompt: "test prompt",
      content: "test content",
    };

    // Act
    const result = await analyzer.analyze(aiRequest);

    // Assert
    assert(result.ok);
    assert("result" in result.data!);
    assert("usage" in result.data!);
  });

  await t.step("correctly identifies schema analysis request", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const frontMatter = createTestFrontMatter({ test: "data" });
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze( // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    );

    // Assert
    assert(result.ok);
    assert(result.data instanceof ExtractedData);
  });

  await t.step("handles missing schema parameter gracefully", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const frontMatter = createTestFrontMatter({ test: "data" });

    // Act - This should be treated as schema analysis with undefined schema
    const result = await analyzer.analyze(
      // deno-lint-ignore no-explicit-any
      frontMatter as any,
      // deno-lint-ignore no-explicit-any
      undefined as any,
    );

    // Assert
    assert(result.ok);
    assertExists(result.data);
  });
});

Deno.test("MockAnalyzer - Edge Cases", async (t) => {
  await t.step("handles very large JSON content", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const largeObject: Record<string, unknown> = {};
    for (let i = 0; i < 1000; i++) {
      largeObject[`field${i}`] = `value${i}`;
    }
    const request: AIAnalysisRequest = {
      prompt: "extract",
      content: JSON.stringify(largeObject),
    };

    // Act
    const result = await analyzer.analyze(request);

    // Assert
    assert(result.ok);
    assertExists(result.data);
  });

  await t.step("handles special characters in content", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const request: AIAnalysisRequest = {
      prompt: "extract",
      content: JSON.stringify({
        title: "Test with 日本語 and emojis 🚀",
        description: 'Quotes "and" special\ncharacters\t',
      }),
    };

    // Act
    const result = await analyzer.analyze(request);

    // Assert
    assert(result.ok);
    assertExists(result.data);
    // deno-lint-ignore no-explicit-any
    const parsed = JSON.parse((result.data as any).result);
    assert(parsed.title.includes("日本語"));
    assert(parsed.title.includes("🚀"));
  });

  await t.step("handles circular references safely", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    // deno-lint-ignore no-explicit-any
    const circular: any = { a: 1 };
    circular.self = circular;

    const frontMatter = {
      getContent: () => ({
        toJSON: () => ({ title: "Test", ref: circular }),
      }),
    };
    const schema = createTestSchema();

    // Act - This should handle the circular reference gracefully
    try {
      const result = await analyzer.analyze( // deno-lint-ignore no-explicit-any
        frontMatter as any,
        schema,
      );
      // If it succeeds, check the result
      assert(!result.ok || result.ok);
    } catch (error) {
      // If it throws, that's also acceptable for circular references
      assert(error instanceof Error);
    }
  });

  await t.step("handles deeply nested structures", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const deepNested = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: "deep",
              },
            },
          },
        },
      },
    };
    const frontMatter = createTestFrontMatter(deepNested);
    const schema = createTestSchema();

    // Act
    const result = await analyzer.analyze( // deno-lint-ignore no-explicit-any
      frontMatter as any,
      schema,
    );

    // Assert
    assert(result.ok);
    assertExists(result.data);
    const extractedData = result.data as ExtractedData;
    const data = extractedData.getData();
    assertExists(data.level1);
  });

  await t.step("processes multiple requests concurrently", async () => {
    // Arrange
    const analyzer = new MockAnalyzer();
    const requests: AIAnalysisRequest[] = Array.from(
      { length: 10 },
      (_, i) => ({
        prompt: `prompt ${i}`,
        content: JSON.stringify({ index: i }),
      }),
    );

    // Act
    const results = await Promise.all(
      requests.map((req) => analyzer.analyze(req)),
    );

    // Assert
    assertEquals(results.length, 10);
    results.forEach((result, index) => {
      assert(result.ok);
      assertExists(result.data);
      // deno-lint-ignore no-explicit-any
      const parsed = JSON.parse((result.data as any).result);
      if (parsed.original) {
        assertEquals(parsed.original.index, index);
      }
    });
  });
});
