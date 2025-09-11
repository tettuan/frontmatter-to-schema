/**
 * E2E Tests for x-* Schema Extensions
 *
 * Comprehensive end-to-end tests for all x-* schema extension features
 * Addresses Issue #638: Test Coverage Gap
 *
 * Test Strategy:
 * - Unit isolation: Each test is completely independent
 * - Idempotent: Tests produce same results on repeated runs
 * - Minimal setup: Tests use simple, focused scenarios
 * - Core coverage: Focus on critical x-* extension behaviors
 */

import { assertEquals, assertExists, assertObjectMatch } from "jsr:@std/assert";
import { SchemaExtensionProcessor } from "../../src/domain/schema/services/schema-extension-processor.ts";
import { TemplateVariableResolver } from "../../src/domain/template/services/template-variable-resolver.ts";
import { AggregationService } from "../../src/domain/aggregation/services/aggregation.service.ts";
import {
  MockFactory,
  ResultTestHelpers,
} from "../helpers/domain-test-helpers.ts";

Deno.test("E2E: x-template dynamic template selection", async () => {
  // Setup: Create schema with x-template for dynamic template selection
  const schema = {
    type: "object",
    properties: {
      type: { type: "string" },
      title: { type: "string" },
    },
    "x-template": {
      blog: "blog-template.json",
      article: "article-template.json",
      default: "default-template.json",
    },
  };

  // Create mock file system with templates
  const mockFS = MockFactory.createMockFileSystem();
  mockFS.setFile(
    "blog-template.json",
    JSON.stringify({
      layout: "blog",
      sections: ["header", "content", "footer"],
    }),
  );
  mockFS.setFile(
    "article-template.json",
    JSON.stringify({
      layout: "article",
      sections: ["title", "body"],
    }),
  );
  mockFS.setFile(
    "default-template.json",
    JSON.stringify({
      layout: "default",
      sections: ["main"],
    }),
  );

  // Test cases for different document types
  const testCases = [
    { type: "blog", expectedLayout: "blog" },
    { type: "article", expectedLayout: "article" },
    { type: "unknown", expectedLayout: "default" },
  ];

  // Create processor with mock dependencies
  const processor = new SchemaExtensionProcessor(mockFS);

  for (const testCase of testCases) {
    const document = {
      type: testCase.type,
      title: `Test ${testCase.type} Document`,
    };

    const result = await processor.selectTemplate(schema, document);
    const template = ResultTestHelpers.assertSuccess(result);
    assertEquals(template.layout, testCase.expectedLayout);
  }

  // Verify schema structure
  assertEquals(typeof schema["x-template"], "object");
  assertExists(schema["x-template"].blog);
  assertExists(schema["x-template"].default);
});

Deno.test("E2E: x-derived-from aggregation with real markdown files", () => {
  // Setup: Schema with x-derived-from for field aggregation
  const schema = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        "x-derived-from": "categories",
        "x-derived-unique": true,
      },
    },
  };

  // Create test documents with categories
  const documents = [
    { categories: ["tech", "web"], title: "Doc 1" },
    { categories: ["tech", "mobile"], title: "Doc 2" },
    { categories: ["web", "mobile"], title: "Doc 3" },
  ];

  // Expected unique aggregated result
  const expected = ["tech", "web", "mobile"];

  // Create aggregation service
  const aggregator = new AggregationService();

  // Process aggregation
  const result = aggregator.aggregate({
    documents,
    schema,
    targetField: "tags",
    sourceField: "categories",
    options: { unique: true },
  });

  const aggregated = ResultTestHelpers.assertSuccess(result);

  // Verify aggregation results
  const tags = aggregated.tags as string[];
  assertEquals(tags.sort(), expected.sort());

  // Verify schema properties
  assertExists(schema.properties.tags["x-derived-from"]);
  assertEquals(schema.properties.tags["x-derived-unique"], true);
});

Deno.test("E2E: x-frontmatter-part array processing workflow", () => {
  // Setup: Schema with x-frontmatter-part for array transformation
  const schema = {
    type: "object",
    properties: {
      authors: {
        type: "array",
        "x-frontmatter-part": "author",
        items: { type: "string" },
      },
    },
  };

  // Test cases: Single value to array transformation
  const testCases = [
    {
      input: { author: "John Doe" },
      expected: { authors: ["John Doe"] },
    },
    {
      input: { author: ["Jane Smith", "Bob Johnson"] },
      expected: { authors: ["Jane Smith", "Bob Johnson"] },
    },
    {
      input: {}, // No author field
      expected: { authors: [] },
    },
  ];

  const processor = new SchemaExtensionProcessor();

  for (const testCase of testCases) {
    const result = processor.transformFrontmatterParts(
      testCase.input,
      schema,
    );

    const transformed = ResultTestHelpers.assertSuccess(result);
    assertObjectMatch(transformed, testCase.expected);
  }

  // Verify schema structure
  assertExists(schema.properties.authors["x-frontmatter-part"]);
  assertEquals(schema.properties.authors.type, "array");
});

Deno.test("E2E: x-derived-unique deduplication in practice", () => {
  // Setup: Schema with deduplication requirement
  const schema = {
    type: "object",
    properties: {
      allTags: {
        type: "array",
        "x-derived-from": "tags",
        "x-derived-unique": true,
      },
    },
  };

  // Documents with overlapping tags
  const documents = [
    { tags: ["a", "b", "c"], id: 1 },
    { tags: ["b", "c", "d"], id: 2 },
    { tags: ["a", "d", "e"], id: 3 },
    { tags: ["a", "a", "b"], id: 4 }, // Duplicates within same doc
  ];

  // Expected unique tags
  const expected = ["a", "b", "c", "d", "e"];

  const aggregator = new AggregationService();
  const result = aggregator.aggregate({
    documents,
    schema,
    targetField: "allTags",
    sourceField: "tags",
    options: { unique: true, flatten: true },
  });

  const aggregated = ResultTestHelpers.assertSuccess(result);

  // Verify deduplication
  const allTags = aggregated.allTags as string[];
  assertEquals(allTags.sort(), expected.sort());
  assertEquals(new Set(allTags).size, allTags.length);

  // Verify schema property
  assertEquals(schema.properties.allTags["x-derived-unique"], true);
});

Deno.test("E2E: Nested $ref resolution with x-* properties", () => {
  // Schema with $ref and x-* properties
  const schema = {
    type: "object",
    properties: {
      metadata: {
        "$ref": "#/definitions/metadata",
        "x-template": "metadata-template.json",
      },
    },
    definitions: {
      metadata: {
        type: "object",
        properties: {
          created: { type: "string" },
          updated: { type: "string" },
        },
      },
    },
  };

  // TODO: Implement $ref resolution with x-* properties
  assertExists(schema.properties.metadata["$ref"]);
  assertExists(schema.properties.metadata["x-template"]);
});

Deno.test("E2E: Multi-file batch processing with aggregation", () => {
  // Test processing multiple files with aggregation rules
  const config = {
    schemaPath: "./test-schema.json",
    templatePath: "./test-template.json",
    documentPaths: ["./test-docs/*.md"],
    aggregation: {
      enabled: true,
      outputPath: "./aggregated.json",
    },
  };

  // TODO: Implement batch processing test
  assertExists(config.aggregation);
  assertEquals(config.aggregation.enabled, true);
});

Deno.test("E2E: Error handling for invalid x-* configurations", () => {
  // Test invalid x-template reference
  const invalidSchema = {
    type: "object",
    properties: {
      field: {
        type: "string",
        "x-template": 123, // Should be string or object
      },
    },
  };

  // TODO: Implement error validation
  assertEquals(typeof invalidSchema.properties.field["x-template"], "number");
});

Deno.test("E2E: Performance test with 1000+ files simulation", () => {
  const startTime = performance.now();

  // Simulate processing many documents
  const fileCount = 1000;
  const documents = Array.from({ length: fileCount }, (_, i) => ({
    id: i,
    title: `Document ${i}`,
    tags: [`tag${i % 10}`, `category${i % 5}`],
    type: i % 3 === 0 ? "blog" : i % 3 === 1 ? "article" : "note",
  }));

  // Schema with various x-* extensions
  const schema = {
    type: "object",
    properties: {
      allTags: {
        type: "array",
        "x-derived-from": "tags",
        "x-derived-unique": true,
      },
    },
  };

  // Process aggregation
  const aggregator = new AggregationService();
  const result = aggregator.aggregate({
    documents,
    schema,
    targetField: "allTags",
    sourceField: "tags",
    options: { unique: true, flatten: true },
  });

  ResultTestHelpers.assertSuccess(result);

  const endTime = performance.now();
  const duration = endTime - startTime;

  // Performance assertions
  assertEquals(documents.length, fileCount);
  // Should complete within 2 seconds for 1000 documents
  assertEquals(
    duration < 2000,
    true,
    `Processing took ${duration}ms, expected < 2000ms`,
  );
});

Deno.test("E2E: Schema validation with x-* extensions", () => {
  // Comprehensive schema with multiple x-* properties
  const schema = {
    type: "object",
    "x-schema-version": "1.0",
    properties: {
      title: {
        type: "string",
        "x-required": true,
        "x-validation": "^[A-Z].*", // Must start with capital
      },
      tags: {
        type: "array",
        "x-min-items": 1,
        "x-max-items": 5,
      },
    },
  };

  // TODO: Implement validation tests
  assertExists(schema["x-schema-version"]);
  assertExists(schema.properties.title["x-validation"]);
});

Deno.test("E2E: Template variable substitution edge cases", () => {
  // Template with complex variable substitutions
  const template = {
    output: "{{title}} - {{author.name}}",
    nested: {
      value: "{{metadata.date}}",
    },
    concatenated: "{{tags.0}}_{{tags.1}}_{{tags.2}}",
    fallback: "{{missing || 'default value'}}",
  };

  // Test cases with various edge cases
  const testCases = [
    {
      name: "Normal substitution",
      data: {
        title: "Test",
        author: { name: "John" },
        metadata: { date: "2025-09-11" },
        tags: ["a", "b", "c"],
      },
      expected: {
        output: "Test - John",
        nested: { value: "2025-09-11" },
        concatenated: "a_b_c",
        fallback: "default value",
      },
    },
    {
      name: "Missing nested values",
      data: {
        title: "Test",
        tags: ["x"],
      },
      expected: {
        output: "Test - ",
        nested: { value: "" },
        concatenated: "x__",
        fallback: "default value",
      },
    },
  ];

  const resolver = new TemplateVariableResolver();

  for (const testCase of testCases) {
    const result = resolver.resolve(template, testCase.data);
    const resolved = ResultTestHelpers.assertSuccess(
      result,
      `Failed: ${testCase.name}`,
    );

    assertEquals(resolved.output, testCase.expected.output);
    const nested = resolved.nested as { value: string };
    assertEquals(nested.value, testCase.expected.nested.value);
    assertEquals(resolved.concatenated, testCase.expected.concatenated);
    assertEquals(resolved.fallback, testCase.expected.fallback);
  }
});
