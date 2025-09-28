import { assertEquals } from "jsr:@std/assert";
import {
  ArrayAggregationStrategy,
  MergeAggregationStrategy,
  SingleSourceStrategy,
} from "../../../../../src/domain/aggregation/services/aggregation-strategy.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

// Helper function to create test frontmatter data
function createTestFrontmatterData(
  data: Record<string, unknown>,
): FrontmatterData {
  const result = FrontmatterData.create(data);
  if (result.isError()) {
    throw new Error("Failed to create test frontmatter data");
  }
  return result.unwrap();
}

// SingleSourceStrategy Tests
Deno.test("SingleSourceStrategy - create instance", () => {
  const strategy = SingleSourceStrategy.create();

  assertEquals(strategy.getType(), "single");
  assertEquals(typeof strategy.combine, "function");
  assertEquals(typeof strategy.isCompatible, "function");
});

Deno.test("SingleSourceStrategy - combine single source successfully", () => {
  const strategy = SingleSourceStrategy.create();
  const testData = { title: "Test", author: "John" };
  const source = createTestFrontmatterData(testData);

  const result = strategy.combine([source]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(data.title, "Test");
  assertEquals(data.author, "John");
});

Deno.test("SingleSourceStrategy - reject multiple sources", () => {
  const strategy = SingleSourceStrategy.create();
  const source1 = createTestFrontmatterData({ title: "Test1" });
  const source2 = createTestFrontmatterData({ title: "Test2" });

  const result = strategy.combine([source1, source2]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_SOURCE_COUNT");
  assertEquals(error.message.includes("exactly 1 source"), true);
});

Deno.test("SingleSourceStrategy - reject empty sources", () => {
  const strategy = SingleSourceStrategy.create();

  const result = strategy.combine([]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_SOURCE_COUNT");
});

Deno.test("SingleSourceStrategy - isCompatible checks source count", () => {
  const strategy = SingleSourceStrategy.create();
  const source = createTestFrontmatterData({ title: "Test" });

  assertEquals(strategy.isCompatible([source]), true);
  assertEquals(strategy.isCompatible([source, source]), false);
  assertEquals(strategy.isCompatible([]), false);
});

Deno.test("SingleSourceStrategy - getConfiguration returns proper config", () => {
  const strategy = SingleSourceStrategy.create();
  const config = strategy.getConfiguration();

  assertEquals(config.name, "Single Source");
  assertEquals(config.minimumSources, 1);
  assertEquals(config.maximumSources, 1);
  assertEquals(config.requiresSchema, false);
});

// ArrayAggregationStrategy Tests
Deno.test("ArrayAggregationStrategy - create with default config", () => {
  const strategy = ArrayAggregationStrategy.create();

  assertEquals(strategy.getType(), "array");
});

Deno.test("ArrayAggregationStrategy - create with custom config", () => {
  const strategy = ArrayAggregationStrategy.create({
    preserveOrder: false,
    includeMetadata: false,
    arrayKey: "items",
  });

  assertEquals(strategy.getType(), "array");
});

Deno.test("ArrayAggregationStrategy - combine multiple sources", () => {
  const strategy = ArrayAggregationStrategy.create();
  const source1 = createTestFrontmatterData({ title: "Doc1", id: 1 });
  const source2 = createTestFrontmatterData({ title: "Doc2", id: 2 });

  const result = strategy.combine([source1, source2]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(Array.isArray(data.documents), true);
  assertEquals((data.documents as any[]).length, 2);
  assertEquals((data.documents as any[])[0].title, "Doc1");
  assertEquals((data.documents as any[])[1].title, "Doc2");
  assertEquals(data.totalDocuments, 2);
});

Deno.test("ArrayAggregationStrategy - combine single source", () => {
  const strategy = ArrayAggregationStrategy.create();
  const source = createTestFrontmatterData({ title: "Single Doc" });

  const result = strategy.combine([source]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(Array.isArray(data.documents), true);
  assertEquals((data.documents as any[]).length, 1);
  assertEquals((data.documents as any[])[0].title, "Single Doc");
});

Deno.test("ArrayAggregationStrategy - custom array key", () => {
  const strategy = ArrayAggregationStrategy.create({ arrayKey: "items" });
  const source = createTestFrontmatterData({ title: "Test" });

  const result = strategy.combine([source]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(Array.isArray(data.items), true);
  assertEquals(data.documents, undefined);
});

Deno.test("ArrayAggregationStrategy - include metadata", () => {
  const strategy = ArrayAggregationStrategy.create({ includeMetadata: true });
  const source = createTestFrontmatterData({ title: "Test" });

  const result = strategy.combine([source]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(typeof data.aggregationMetadata, "object");
  assertEquals((data.aggregationMetadata as any).strategy, "array");
  assertEquals((data.aggregationMetadata as any).sourceCount, 1);
});

Deno.test("ArrayAggregationStrategy - exclude metadata", () => {
  const strategy = ArrayAggregationStrategy.create({ includeMetadata: false });
  const source = createTestFrontmatterData({ title: "Test" });

  const result = strategy.combine([source]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(data.aggregationMetadata, undefined);
});

Deno.test("ArrayAggregationStrategy - reject empty sources", () => {
  const strategy = ArrayAggregationStrategy.create();

  const result = strategy.combine([]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "EMPTY_SOURCES");
});

Deno.test("ArrayAggregationStrategy - isCompatible accepts any non-empty array", () => {
  const strategy = ArrayAggregationStrategy.create();
  const source = createTestFrontmatterData({ title: "Test" });

  assertEquals(strategy.isCompatible([source]), true);
  assertEquals(strategy.isCompatible([source, source]), true);
  assertEquals(strategy.isCompatible([]), false);
});

// MergeAggregationStrategy Tests
Deno.test("MergeAggregationStrategy - create with default config", () => {
  const strategy = MergeAggregationStrategy.create();

  assertEquals(strategy.getType(), "merge");
});

Deno.test("MergeAggregationStrategy - create with custom config", () => {
  const strategy = MergeAggregationStrategy.create({
    conflictResolution: "first-wins",
    preserveArrays: false,
    deepMerge: false,
  });

  assertEquals(strategy.getType(), "merge");
});

Deno.test("MergeAggregationStrategy - merge single source", () => {
  const strategy = MergeAggregationStrategy.create();
  const source = createTestFrontmatterData({ title: "Test", author: "John" });

  const result = strategy.combine([source]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(data.title, "Test");
  assertEquals(data.author, "John");
});

Deno.test("MergeAggregationStrategy - merge multiple sources with last-wins", () => {
  const strategy = MergeAggregationStrategy.create({
    conflictResolution: "last-wins",
  });
  const source1 = createTestFrontmatterData({
    title: "First",
    author: "John",
    version: 1,
  });
  const source2 = createTestFrontmatterData({
    title: "Second",
    category: "test",
  });

  const result = strategy.combine([source1, source2]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(data.title, "Second"); // Last wins
  assertEquals(data.author, "John"); // From first source
  assertEquals(data.category, "test"); // From second source
  assertEquals(data.version, 1); // From first source
});

Deno.test("MergeAggregationStrategy - merge with first-wins", () => {
  const strategy = MergeAggregationStrategy.create({
    conflictResolution: "first-wins",
  });
  const source1 = createTestFrontmatterData({ title: "First", author: "John" });
  const source2 = createTestFrontmatterData({
    title: "Second",
    category: "test",
  });

  const result = strategy.combine([source1, source2]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(data.title, "First"); // First wins
  assertEquals(data.author, "John");
  assertEquals(data.category, "test");
});

Deno.test("MergeAggregationStrategy - merge with array-combine", () => {
  const strategy = MergeAggregationStrategy.create({
    conflictResolution: "array-combine",
  });
  const source1 = createTestFrontmatterData({ title: "First", author: "John" });
  const source2 = createTestFrontmatterData({
    title: "Second",
    category: "test",
  });

  const result = strategy.combine([source1, source2]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(Array.isArray(data.title), true);
  assertEquals((data.title as any[]).includes("First"), true);
  assertEquals((data.title as any[]).includes("Second"), true);
  assertEquals(data.author, "John");
  assertEquals(data.category, "test");
});

Deno.test("MergeAggregationStrategy - deep merge objects", () => {
  const strategy = MergeAggregationStrategy.create({ deepMerge: true });
  const source1 = createTestFrontmatterData({
    metadata: { title: "Test", version: 1 },
    author: "John",
  });
  const source2 = createTestFrontmatterData({
    metadata: { category: "docs", version: 2 },
    tags: ["test"],
  });

  const result = strategy.combine([source1, source2]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  const metadata = data.metadata as Record<string, unknown>;
  assertEquals(metadata.title, "Test");
  assertEquals(metadata.category, "docs");
  assertEquals(metadata.version, 2); // Last wins for conflicts
  assertEquals(data.author, "John");
  assertEquals(Array.isArray(data.tags), true);
});

Deno.test("MergeAggregationStrategy - preserve arrays", () => {
  const strategy = MergeAggregationStrategy.create({ preserveArrays: true });
  const source1 = createTestFrontmatterData({ tags: ["tag1", "tag2"] });
  const source2 = createTestFrontmatterData({ tags: ["tag3", "tag4"] });

  const result = strategy.combine([source1, source2]);

  assertEquals(result.isOk(), true);
  const data = result.unwrap();
  assertEquals(Array.isArray(data.tags), true);
  assertEquals((data.tags as any[]).length, 4);
  assertEquals((data.tags as any[]).includes("tag1"), true);
  assertEquals((data.tags as any[]).includes("tag4"), true);
});

Deno.test("MergeAggregationStrategy - reject empty sources", () => {
  const strategy = MergeAggregationStrategy.create();

  const result = strategy.combine([]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "EMPTY_SOURCES");
});

Deno.test("MergeAggregationStrategy - isCompatible accepts any non-empty array", () => {
  const strategy = MergeAggregationStrategy.create();
  const source = createTestFrontmatterData({ title: "Test" });

  assertEquals(strategy.isCompatible([source]), true);
  assertEquals(strategy.isCompatible([source, source]), true);
  assertEquals(strategy.isCompatible([]), false);
});

Deno.test("MergeAggregationStrategy - getConfiguration returns proper config", () => {
  const strategy = MergeAggregationStrategy.create();
  const config = strategy.getConfiguration();

  assertEquals(config.name, "Merge Aggregation");
  assertEquals(config.minimumSources, 1);
  assertEquals(config.requiresSchema, false);
  assertEquals(Array.isArray(config.supportedSourceTypes), true);
});
