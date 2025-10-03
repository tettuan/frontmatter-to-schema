import { assertEquals, assertExists } from "@std/assert";
import {
  AggregationConfig,
  ConfigurationManager,
  DocumentAggregationService,
} from "../../../../../src/domain/aggregation/services/document-aggregation-service.ts";
import { ProcessingError } from "../../../../../src/domain/shared/types/errors.ts";
import { Result } from "../../../../../src/domain/shared/types/result.ts";
import {
  DocumentId,
  MarkdownDocument,
} from "../../../../../src/domain/frontmatter/entities/markdown-document.ts";
import { FilePath } from "../../../../../src/domain/shared/value-objects/file-path.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

// Mock ConfigurationManager for testing
class MockConfigurationManager implements ConfigurationManager {
  private settings: Map<string, any> = new Map();
  private shouldError = false;

  setBoolean(key: string, value: boolean): void {
    this.settings.set(key, value);
  }

  setObject(key: string, value: Record<string, unknown>): void {
    this.settings.set(key, value);
  }

  setShouldError(shouldError: boolean): void {
    this.shouldError = shouldError;
  }

  getBooleanDefault(key: string): Result<boolean, ProcessingError> {
    if (this.shouldError) {
      return Result.error(
        new ProcessingError(`Error getting ${key}`, "CONFIG_ERROR", {}),
      );
    }

    const value = this.settings.get(key);
    return Result.ok(value !== undefined ? value as boolean : true);
  }

  getObjectDefault(
    key: string,
  ): Result<Record<string, unknown>, ProcessingError> {
    if (this.shouldError) {
      return Result.error(
        new ProcessingError(`Error getting ${key}`, "CONFIG_ERROR", {}),
      );
    }

    const value = this.settings.get(key);
    return Result.ok(
      value !== undefined ? value as Record<string, unknown> : {},
    );
  }
}

// Helper function to create mock MarkdownDocument
function createMockDocument(
  path: string,
  frontmatterData?: Record<string, unknown>,
): MarkdownDocument {
  const filePath = FilePath.create(path).unwrap();
  const documentId = DocumentId.fromPath(filePath);
  const frontmatter = frontmatterData
    ? FrontmatterData.create(frontmatterData).unwrap()
    : undefined;
  return MarkdownDocument.create(
    documentId,
    filePath,
    "# Test Content",
    frontmatter,
  );
}

// Mock template with items expansion capability
class MockTemplateWithItems {
  hasItemsExpansion(): boolean {
    return true;
  }
}

// Helper function to create mock schema with x-frontmatter-part
function createMockSchema(
  propertyName: string = "documents",
): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      [propertyName]: {
        type: "array",
        "x-frontmatter-part": true,
      },
    },
  };
}

Deno.test("DocumentAggregationService - create without configuration manager", () => {
  const result = DocumentAggregationService.create();

  assertEquals(result.isOk(), true);
  assertExists(result.unwrap());
});

Deno.test("DocumentAggregationService - create with configuration manager", () => {
  const mockConfig = new MockConfigurationManager();
  const result = DocumentAggregationService.create(mockConfig);

  assertEquals(result.isOk(), true);
  assertExists(result.unwrap());
});

Deno.test("DocumentAggregationService - transformDocuments with single document", () => {
  const service = DocumentAggregationService.create().unwrap();
  const document = createMockDocument("/test/doc1.md", {
    title: "Test Document",
    author: "John Doe",
  });
  const documents = [document];

  const result = service.transformDocuments(documents, null, undefined);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(transformed.title, "Test Document");
  assertEquals(transformed.author, "John Doe");
});

Deno.test("DocumentAggregationService - transformDocuments with multiple documents", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1", category: "test" }),
    createMockDocument("/test/doc2.md", {
      title: "Doc 2",
      category: "example",
    }),
    createMockDocument("/test/doc3.md", { title: "Doc 3", category: "test" }),
  ];
  const schema = createMockSchema("documents");

  const result = service.transformDocuments(documents, null, schema);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.documents), true);
  assertEquals((transformed.documents as any[]).length, 3);
  // Note: totalDocuments is no longer hardcoded, it's part of metadata
  assertEquals(typeof transformed.processedAt, "string");
});

Deno.test("DocumentAggregationService - transformDocuments with items expansion template", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const template = new MockTemplateWithItems();
  const schema = createMockSchema("items");

  const result = service.transformDocuments(documents, template, schema);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.items), true);
  assertEquals((transformed.items as any[]).length, 2);
});

Deno.test("DocumentAggregationService - transformDocuments with template containing @items pattern", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const template = { pattern: "{@items}", other: "data" };
  const schema = createMockSchema("items");

  const result = service.transformDocuments(documents, template, schema);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.items), true);
  assertEquals((transformed.items as any[]).length, 2);
});

Deno.test("DocumentAggregationService - transformDocuments with template containing {{items}} pattern", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const template = { pattern: "{{items}}", other: "data" };
  const schema = createMockSchema("items");

  const result = service.transformDocuments(documents, template, schema);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.items), true);
});

Deno.test("DocumentAggregationService - transformDocuments without metadata", () => {
  const mockConfig = new MockConfigurationManager();
  mockConfig.setBoolean("includeMetadata", false);
  const service = DocumentAggregationService.create(mockConfig).unwrap();

  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const schema = createMockSchema("documents");

  const result = service.transformDocuments(documents, null, schema);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(transformed.processedAt, undefined);
  assertEquals(Array.isArray(transformed.documents), true);
});

Deno.test("DocumentAggregationService - transformDocuments with custom config", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const schema = createMockSchema("documents");

  const config: AggregationConfig = {
    includeMetadata: true,
    customMetadata: {
      source: "test",
      environment: "development",
    },
  };

  const result = service.transformDocuments(documents, null, schema, config);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(typeof transformed.processedAt, "string");
  assertEquals(transformed.source, "test");
  assertEquals(transformed.environment, "development");
});

Deno.test("DocumentAggregationService - transformDocuments with documents without frontmatter", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md"), // no frontmatter
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
    createMockDocument("/test/doc3.md"), // no frontmatter
  ];
  const schema = createMockSchema("documents");

  const result = service.transformDocuments(documents, null, schema);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.documents), true);
  assertEquals((transformed.documents as any[]).length, 1); // only one with frontmatter
});

Deno.test("DocumentAggregationService - transformDocuments with invalid input types", () => {
  const service = DocumentAggregationService.create().unwrap();

  // Test with non-array documents
  const nonArrayResult = service.transformDocuments(
    "invalid" as any,
    null,
    undefined,
  );
  assertEquals(nonArrayResult.isError(), true);
  const nonArrayError = nonArrayResult.unwrapError();
  assertEquals(nonArrayError instanceof ProcessingError, true);
  assertEquals(nonArrayError.code, "INVALID_DOCUMENTS_TYPE");

  // Test with empty array
  const emptyArrayResult = service.transformDocuments([], null, undefined);
  assertEquals(emptyArrayResult.isError(), true);
  const emptyArrayError = emptyArrayResult.unwrapError();
  assertEquals(emptyArrayError instanceof ProcessingError, true);
  assertEquals(emptyArrayError.code, "EMPTY_DOCUMENTS_ARRAY");
});

Deno.test("DocumentAggregationService - transformDocuments with config manager error", () => {
  const mockConfig = new MockConfigurationManager();
  mockConfig.setShouldError(true);
  const service = DocumentAggregationService.create(mockConfig).unwrap();

  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const schema = createMockSchema("documents");

  // Should still work, falling back to default behavior
  const result = service.transformDocuments(documents, null, schema);
  assertEquals(result.isOk(), true);
});

Deno.test("DocumentAggregationService - transformDocuments with template JSON serialization error", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const schema = createMockSchema("items");

  // Create object with circular reference that can't be JSON.stringify'd
  const circularTemplate: any = { data: "test" };
  circularTemplate.self = circularTemplate;

  const result = service.transformDocuments(
    documents,
    circularTemplate,
    schema,
  );

  // Should still work with schema
  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.items), true);
});

Deno.test("DocumentAggregationService - comprehensive error scenarios", () => {
  const service = DocumentAggregationService.create().unwrap();

  // Test various invalid inputs
  const tests = [
    { docs: null, desc: "null documents" },
    { docs: undefined, desc: "undefined documents" },
    { docs: "string", desc: "string documents" },
    { docs: 123, desc: "number documents" },
    { docs: {}, desc: "object documents" },
  ];

  for (const test of tests) {
    const result = service.transformDocuments(
      test.docs as any,
      null,
      undefined,
    );
    assertEquals(result.isError(), true, `Should fail for ${test.desc}`);
  }
});

Deno.test("DocumentAggregationService - edge cases", () => {
  const service = DocumentAggregationService.create().unwrap();

  // Single document with no frontmatter - requires schema now (schema-driven)
  const singleNoFrontmatter = [createMockDocument("/test/doc.md")];
  const singleResultNoSchema = service.transformDocuments(
    singleNoFrontmatter,
    null,
    undefined,
  );
  assertEquals(singleResultNoSchema.isError(), true); // Should fail without schema

  // Single document with no frontmatter WITH schema - should succeed
  const schema = createMockSchema("documents");
  const singleResultWithSchema = service.transformDocuments(
    singleNoFrontmatter,
    null,
    schema,
  );
  assertEquals(singleResultWithSchema.isOk(), true);

  // Multiple documents, all without frontmatter - requires schema
  const multipleNoFrontmatter = [
    createMockDocument("/test/doc1.md"),
    createMockDocument("/test/doc2.md"),
    createMockDocument("/test/doc3.md"),
  ];
  const multipleResult = service.transformDocuments(
    multipleNoFrontmatter,
    null,
    schema,
  );
  assertEquals(multipleResult.isOk(), true); // Should work, create aggregate structure
  const multipleTransformed = multipleResult.unwrap();
  assertEquals((multipleTransformed.documents as any[]).length, 0); // no frontmatter data
});

Deno.test("DocumentAggregationService - totality principle compliance", () => {
  const service = DocumentAggregationService.create().unwrap();
  const validDocuments = [
    createMockDocument("/test/doc.md", { title: "Test" }),
  ];

  // All methods should return Result types, never throw exceptions
  const tests = [
    () => service.transformDocuments(validDocuments, null, undefined),
    () =>
      service.transformDocuments(
        validDocuments,
        new MockTemplateWithItems(),
        undefined,
      ),
    () => service.transformDocuments([], null, undefined),
    () => service.transformDocuments("invalid" as any, null, undefined),
    () => service.transformDocuments(null as any, null, undefined),
    () =>
      service.transformDocuments(validDocuments, null, {
        includeMetadata: true,
      }),
  ];

  for (const test of tests) {
    try {
      const result = test();
      // Should always return a Result, never throw
      assertEquals(typeof result.isOk, "function");
      assertEquals(typeof result.isError, "function");
    } catch (error) {
      // Should never reach here in totality-compliant code
      throw new Error(`Method threw exception: ${error}`);
    }
  }
});

Deno.test("DocumentAggregationService - complex aggregation scenario", () => {
  const mockConfig = new MockConfigurationManager();
  mockConfig.setBoolean("includeMetadata", true);
  const service = DocumentAggregationService.create(mockConfig).unwrap();

  const documents = [
    createMockDocument("/src/components/Button.md", {
      title: "Button Component",
      category: "ui",
      version: "1.0.0",
      tags: ["react", "component"],
    }),
    createMockDocument("/src/components/Modal.md", {
      title: "Modal Component",
      category: "ui",
      version: "1.1.0",
      tags: ["react", "overlay"],
    }),
    createMockDocument("/docs/getting-started.md", {
      title: "Getting Started",
      category: "documentation",
      version: "1.0.0",
      audience: "developers",
    }),
    createMockDocument("/docs/api-reference.md", {
      title: "API Reference",
      category: "documentation",
      version: "1.2.0",
      audience: "developers",
    }),
  ];

  const template = {
    layout: "grid",
    sections: ["{{items}}", "metadata"],
    footer: "Generated docs",
  };

  const config: AggregationConfig = {
    includeMetadata: true,
    customMetadata: {
      generator: "doc-processor",
      buildId: "build-123",
    },
  };

  const schema = createMockSchema("documents");

  const result = service.transformDocuments(
    documents,
    template,
    schema,
    config,
  );

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();

  // Should have documents array from schema
  assertEquals(Array.isArray(transformed.documents), true);
  assertEquals((transformed.documents as any[]).length, 4);

  // Should have metadata
  assertEquals(typeof transformed.processedAt, "string");

  // Should have custom metadata
  assertEquals(transformed.generator, "doc-processor");
  assertEquals(transformed.buildId, "build-123");

  // Verify document data structure
  const docs = transformed.documents as any[];
  assertEquals(docs[0].title, "Button Component");
  assertEquals(docs[0].category, "ui");
  assertEquals(docs[2].audience, "developers");
});

Deno.test("DocumentAggregationService - property name mapping with schema x-frontmatter-part", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/docs/req1.md", {
      id: "REQ-001",
      title: "User Authentication",
      priority: "high",
    }),
    createMockDocument("/docs/req2.md", {
      id: "REQ-002",
      title: "Data Encryption",
      priority: "critical",
    }),
  ];

  // Schema with x-frontmatter-part directive specifying property name
  const schema = {
    type: "object",
    properties: {
      req: {
        type: "array",
        "x-frontmatter-part": true,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            priority: { type: "string" },
          },
        },
      },
    },
  };

  const result = service.transformDocuments(documents, null, schema);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();

  // Should use schema property name "req" instead of hardcoded "items" or "documents"
  assertEquals(Array.isArray(transformed.req), true);
  assertEquals((transformed.req as any[]).length, 2);
  assertEquals((transformed.req as any[])[0].id, "REQ-001");
  assertEquals((transformed.req as any[])[1].id, "REQ-002");

  // Should NOT have hardcoded "documents" property (schema-driven)
  assertEquals(transformed.documents, undefined);

  // Should NOT have hardcoded "totalDocuments" property (schema-driven)
  assertEquals(transformed.totalDocuments, undefined);
});

Deno.test("DocumentAggregationService - nested x-frontmatter-part in schema", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/docs/cmd1.md", {
      c1: "analyze",
      c2: "quality-metrics",
      description: "Analyze code quality",
    }),
    createMockDocument("/docs/cmd2.md", {
      c1: "review",
      c2: "security",
      description: "Security review",
    }),
  ];

  // Schema with nested x-frontmatter-part (tools.commands)
  const schema = {
    type: "object",
    properties: {
      version: {
        type: "string",
        default: "1.0.0",
      },
      tools: {
        type: "object",
        properties: {
          commands: {
            type: "array",
            "x-frontmatter-part": true,
            items: {
              type: "object",
              properties: {
                c1: { type: "string" },
                c2: { type: "string" },
                description: { type: "string" },
              },
            },
          },
        },
      },
    },
  };

  const result = service.transformDocuments(
    documents,
    null,
    schema,
    { includeMetadata: false },
  );

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();

  // Should create nested structure with tools.commands
  assertEquals(typeof transformed.tools, "object");
  assertEquals(Array.isArray((transformed.tools as any).commands), true);
  assertEquals(((transformed.tools as any).commands as any[]).length, 2);
  assertEquals(
    ((transformed.tools as any).commands as any[])[0].c1,
    "analyze",
  );
  assertEquals(
    ((transformed.tools as any).commands as any[])[1].c1,
    "review",
  );
});

Deno.test("DocumentAggregationService - deeply nested x-frontmatter-part", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/docs/item1.md", {
      id: "ITEM-001",
      name: "First Item",
    }),
  ];

  // Schema with deeply nested x-frontmatter-part (a.b.c.items)
  const schema = {
    type: "object",
    properties: {
      a: {
        type: "object",
        properties: {
          b: {
            type: "object",
            properties: {
              c: {
                type: "object",
                properties: {
                  items: {
                    type: "array",
                    "x-frontmatter-part": true,
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const result = service.transformDocuments(
    documents,
    null,
    schema,
    { includeMetadata: false },
  );

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();

  // Should create deeply nested structure
  assertEquals(typeof transformed.a, "object");
  assertEquals(typeof (transformed.a as any).b, "object");
  assertEquals(typeof ((transformed.a as any).b as any).c, "object");
  assertEquals(
    Array.isArray((((transformed.a as any).b as any).c as any).items),
    true,
  );
  assertEquals(
    ((((transformed.a as any).b as any).c as any).items as any[])[0].id,
    "ITEM-001",
  );
});
