import { assertEquals, assertExists } from "jsr:@std/assert";
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

  const result = service.transformDocuments(documents, null);

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

  const result = service.transformDocuments(documents, null);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.documents), true);
  assertEquals((transformed.documents as any[]).length, 3);
  assertEquals(transformed.totalDocuments, 3);
  assertEquals(typeof transformed.processedAt, "string");
});

Deno.test("DocumentAggregationService - transformDocuments with items expansion template", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const template = new MockTemplateWithItems();

  const result = service.transformDocuments(documents, template);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.items), true);
  assertEquals((transformed.items as any[]).length, 2);
  assertEquals(Array.isArray(transformed.documents), true);
});

Deno.test("DocumentAggregationService - transformDocuments with template containing @items pattern", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];
  const template = { pattern: "{@items}", other: "data" };

  const result = service.transformDocuments(documents, template);

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

  const result = service.transformDocuments(documents, template);

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

  const result = service.transformDocuments(documents, null);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(transformed.processedAt, undefined);
  assertEquals(transformed.totalDocuments, 2);
});

Deno.test("DocumentAggregationService - transformDocuments with custom config", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];

  const config: AggregationConfig = {
    includeMetadata: true,
    customMetadata: {
      source: "test",
      environment: "development",
    },
  };

  const result = service.transformDocuments(documents, null, config);

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

  const result = service.transformDocuments(documents, null);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(Array.isArray(transformed.documents), true);
  assertEquals((transformed.documents as any[]).length, 1); // only one with frontmatter
  assertEquals(transformed.totalDocuments, 3);
});

Deno.test("DocumentAggregationService - transformDocuments with invalid input types", () => {
  const service = DocumentAggregationService.create().unwrap();

  // Test with non-array documents
  const nonArrayResult = service.transformDocuments("invalid" as any, null);
  assertEquals(nonArrayResult.isError(), true);
  const nonArrayError = nonArrayResult.unwrapError();
  assertEquals(nonArrayError instanceof ProcessingError, true);
  assertEquals(nonArrayError.code, "INVALID_DOCUMENTS_TYPE");

  // Test with empty array
  const emptyArrayResult = service.transformDocuments([], null);
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

  // Should still work, falling back to default behavior
  const result = service.transformDocuments(documents, null);
  assertEquals(result.isOk(), true);
});

Deno.test("DocumentAggregationService - transformDocuments with template JSON serialization error", () => {
  const service = DocumentAggregationService.create().unwrap();
  const documents = [
    createMockDocument("/test/doc1.md", { title: "Doc 1" }),
    createMockDocument("/test/doc2.md", { title: "Doc 2" }),
  ];

  // Create object with circular reference that can't be JSON.stringify'd
  const circularTemplate: any = { data: "test" };
  circularTemplate.self = circularTemplate;

  const result = service.transformDocuments(documents, circularTemplate);

  // Should still work, just won't detect items expansion
  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();
  assertEquals(transformed.items, undefined);
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
    const result = service.transformDocuments(test.docs as any, null);
    assertEquals(result.isError(), true, `Should fail for ${test.desc}`);
  }
});

Deno.test("DocumentAggregationService - edge cases", () => {
  const service = DocumentAggregationService.create().unwrap();

  // Single document with no frontmatter
  const singleNoFrontmatter = [createMockDocument("/test/doc.md")];
  const singleResult = service.transformDocuments(singleNoFrontmatter, null);
  assertEquals(singleResult.isOk(), true); // Should work, fallback to aggregate structure

  // Multiple documents, all without frontmatter
  const multipleNoFrontmatter = [
    createMockDocument("/test/doc1.md"),
    createMockDocument("/test/doc2.md"),
    createMockDocument("/test/doc3.md"),
  ];
  const multipleResult = service.transformDocuments(
    multipleNoFrontmatter,
    null,
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
    () => service.transformDocuments(validDocuments, null),
    () =>
      service.transformDocuments(validDocuments, new MockTemplateWithItems()),
    () => service.transformDocuments([], null),
    () => service.transformDocuments("invalid" as any, null),
    () => service.transformDocuments(null as any, null),
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

  const result = service.transformDocuments(documents, template, config);

  assertEquals(result.isOk(), true);
  const transformed = result.unwrap();

  // Should have items array due to template pattern
  assertEquals(Array.isArray(transformed.items), true);
  assertEquals((transformed.items as any[]).length, 4);

  // Should have documents array
  assertEquals(Array.isArray(transformed.documents), true);
  assertEquals((transformed.documents as any[]).length, 4);

  // Should have metadata
  assertEquals(typeof transformed.processedAt, "string");
  assertEquals(transformed.totalDocuments, 4);

  // Should have custom metadata
  assertEquals(transformed.generator, "doc-processor");
  assertEquals(transformed.buildId, "build-123");

  // Verify document data structure
  const docs = transformed.documents as any[];
  assertEquals(docs[0].title, "Button Component");
  assertEquals(docs[0].category, "ui");
  assertEquals(docs[2].audience, "developers");
});
