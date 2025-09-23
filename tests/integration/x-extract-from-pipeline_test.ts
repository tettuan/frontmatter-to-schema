import { assertEquals } from "jsr:@std/assert";
import { Schema } from "../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../src/domain/schema/value-objects/schema-definition.ts";
import { FrontmatterData } from "../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ExtractFromProcessor } from "../../src/domain/schema/services/extract-from-processor.ts";

Deno.test("x-extract-from pipeline integration", async (t) => {
  await t.step("should extract nested array values with x-extract-from", () => {
    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "x-extract-from": "data.nested[].value",
          "items": {
            "type": "string",
          },
        },
      },
    };

    const frontmatterData = {
      data: {
        nested: [
          { value: "first", other: "data1" },
          { value: "second", other: "data2" },
          { value: "third", other: "data3" },
        ],
      },
    };

    // Create schema
    const pathResult = SchemaPath.create("test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    // Create frontmatter data
    const dataResult = FrontmatterData.create(frontmatterData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    // Test extraction
    const extractFromProcessorResult = ExtractFromProcessor.create();
    assertEquals(extractFromProcessorResult.ok, true);
    if (!extractFromProcessorResult.ok) return;
    const extractFromProcessor = extractFromProcessorResult.data;
    const hasDirectives = schemaResult.data.hasExtractFromDirectives();
    assertEquals(hasDirectives, true);

    const directivesResult = schemaResult.data.getExtractFromDirectives();
    assertEquals(directivesResult.ok, true);
    if (!directivesResult.ok) return;

    assertEquals(directivesResult.data.length, 1);
    assertEquals(directivesResult.data[0].getTargetPath(), "items");
    assertEquals(
      directivesResult.data[0].getSourcePath(),
      "data.nested[].value",
    );

    const extractResult = extractFromProcessor.processDirectivesSync(
      dataResult.data,
      directivesResult.data,
    );
    assertEquals(extractResult.ok, true);
    if (!extractResult.ok) return;

    const extractedData = extractResult.data.getData();
    assertEquals(Array.isArray(extractedData.items), true);
    assertEquals(extractedData.items, ["first", "second", "third"]);
  });

  await t.step("should handle x-merge-arrays with x-extract-from", () => {
    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "combined": {
          "type": "array",
          "x-extract-from": "sources[]",
          "x-merge-arrays": true,
          "items": {
            "type": "object",
          },
        },
      },
    };

    const frontmatterData = {
      sources: [
        { id: 1, name: "first" },
        { id: 2, name: "second" },
      ],
      other: "data",
    };

    // Create schema
    const pathResult = SchemaPath.create("test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    // Create frontmatter data
    const dataResult = FrontmatterData.create(frontmatterData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    // Test extraction with merge
    const extractFromProcessorResult = ExtractFromProcessor.create();
    assertEquals(extractFromProcessorResult.ok, true);
    if (!extractFromProcessorResult.ok) return;
    const extractFromProcessor = extractFromProcessorResult.data;
    const directivesResult = schemaResult.data.getExtractFromDirectives();
    assertEquals(directivesResult.ok, true);
    if (!directivesResult.ok) return;

    assertEquals(directivesResult.data[0].shouldMergeArrays(), true);

    const extractResult = extractFromProcessor.processDirectivesSync(
      dataResult.data,
      directivesResult.data,
    );
    assertEquals(extractResult.ok, true);
    if (!extractResult.ok) return;

    const extractedData = extractResult.data.getData();
    assertEquals(Array.isArray(extractedData.combined), true);
    assertEquals((extractedData.combined as any[]).length, 2);
    assertEquals((extractedData.combined as any[])[0].id, 1);
    assertEquals((extractedData.combined as any[])[1].id, 2);
  });

  await t.step("should handle multiple x-extract-from directives", () => {
    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "names": {
          "type": "array",
          "x-extract-from": "users[].name",
          "items": { "type": "string" },
        },
        "emails": {
          "type": "array",
          "x-extract-from": "users[].email",
          "items": { "type": "string" },
        },
      },
    };

    const frontmatterData = {
      users: [
        { name: "Alice", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
      ],
    };

    // Create schema
    const pathResult = SchemaPath.create("test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    // Create frontmatter data
    const dataResult = FrontmatterData.create(frontmatterData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    // Test multiple extractions
    const extractFromProcessorResult = ExtractFromProcessor.create();
    assertEquals(extractFromProcessorResult.ok, true);
    if (!extractFromProcessorResult.ok) return;
    const extractFromProcessor = extractFromProcessorResult.data;
    const directivesResult = schemaResult.data.getExtractFromDirectives();
    assertEquals(directivesResult.ok, true);
    if (!directivesResult.ok) return;

    assertEquals(directivesResult.data.length, 2);

    const extractResult = extractFromProcessor.processDirectivesSync(
      dataResult.data,
      directivesResult.data,
    );
    assertEquals(extractResult.ok, true);
    if (!extractResult.ok) return;

    const extractedData = extractResult.data.getData();
    assertEquals(extractedData.names as string[], ["Alice", "Bob"]);
    assertEquals(extractedData.emails as string[], [
      "alice@example.com",
      "bob@example.com",
    ]);
  });

  await t.step("should handle empty arrays in extraction", () => {
    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "x-extract-from": "empty[]",
          "items": { "type": "string" },
        },
      },
    };

    const frontmatterData = {
      empty: [],
      other: "data",
    };

    // Create schema
    const pathResult = SchemaPath.create("test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    // Create frontmatter data
    const dataResult = FrontmatterData.create(frontmatterData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    // Test empty array extraction
    const extractFromProcessorResult = ExtractFromProcessor.create();
    assertEquals(extractFromProcessorResult.ok, true);
    if (!extractFromProcessorResult.ok) return;
    const extractFromProcessor = extractFromProcessorResult.data;
    const directivesResult = schemaResult.data.getExtractFromDirectives();
    assertEquals(directivesResult.ok, true);
    if (!directivesResult.ok) return;

    const extractResult = extractFromProcessor.processDirectivesSync(
      dataResult.data,
      directivesResult.data,
    );
    assertEquals(extractResult.ok, true);
    if (!extractResult.ok) return;

    const extractedData = extractResult.data.getData();
    assertEquals(Array.isArray(extractedData.items), true);
    assertEquals((extractedData.items as any[]).length, 0);
  });

  await t.step("should handle missing source paths gracefully", () => {
    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "x-extract-from": "nonexistent.path[]",
          "items": { "type": "string" },
        },
      },
    };

    const frontmatterData = {
      other: "data",
    };

    // Create schema
    const pathResult = SchemaPath.create("test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    // Create frontmatter data
    const dataResult = FrontmatterData.create(frontmatterData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    // Test missing path extraction
    const extractFromProcessorResult = ExtractFromProcessor.create();
    assertEquals(extractFromProcessorResult.ok, true);
    if (!extractFromProcessorResult.ok) return;
    const extractFromProcessor = extractFromProcessorResult.data;
    const directivesResult = schemaResult.data.getExtractFromDirectives();
    assertEquals(directivesResult.ok, true);
    if (!directivesResult.ok) return;

    const extractResult = extractFromProcessor.processDirectivesSync(
      dataResult.data,
      directivesResult.data,
    );
    assertEquals(extractResult.ok, true);
    if (!extractResult.ok) return;

    const extractedData = extractResult.data.getData();
    assertEquals(Array.isArray(extractedData.items), true);
    assertEquals((extractedData.items as any[]).length, 0);
  });

  await t.step("should handle null and undefined values", () => {
    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "values": {
          "type": "array",
          "x-extract-from": "data[].value",
          "items": { "type": "string" },
        },
      },
    };

    const frontmatterData = {
      data: [
        { value: "first" },
        { value: null },
        { other: "no-value" },
        { value: undefined },
        { value: "last" },
      ],
    };

    // Create schema
    const pathResult = SchemaPath.create("test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    // Create frontmatter data
    const dataResult = FrontmatterData.create(frontmatterData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    // Test null/undefined handling
    const extractFromProcessorResult = ExtractFromProcessor.create();
    assertEquals(extractFromProcessorResult.ok, true);
    if (!extractFromProcessorResult.ok) return;
    const extractFromProcessor = extractFromProcessorResult.data;
    const directivesResult = schemaResult.data.getExtractFromDirectives();
    assertEquals(directivesResult.ok, true);
    if (!directivesResult.ok) return;

    const extractResult = extractFromProcessor.processDirectivesSync(
      dataResult.data,
      directivesResult.data,
    );
    assertEquals(extractResult.ok, true);
    if (!extractResult.ok) return;

    const extractedData = extractResult.data.getData();
    assertEquals(Array.isArray(extractedData.values), true);
    // Should only include non-null/undefined values
    const values = extractedData.values as any[];
    assertEquals(values.includes("first"), true);
    assertEquals(values.includes("last"), true);
    assertEquals(values.includes(null), true); // null is preserved
    assertEquals(values.includes(undefined), false); // undefined is filtered
  });

  await t.step("should handle complex nested structures", () => {
    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "ids": {
          "type": "array",
          "x-extract-from": "data.level1[].level2[].id",
          "items": { "type": "string" },
        },
      },
    };

    const frontmatterData = {
      data: {
        level1: [
          {
            level2: [
              { id: "1-1", name: "item-1-1" },
              { id: "1-2", name: "item-1-2" },
            ],
          },
          {
            level2: [
              { id: "2-1", name: "item-2-1" },
              { id: "2-2", name: "item-2-2" },
            ],
          },
        ],
      },
    };

    // Create schema
    const pathResult = SchemaPath.create("test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    // Create frontmatter data
    const dataResult = FrontmatterData.create(frontmatterData);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    // Test complex nested extraction
    const extractFromProcessorResult = ExtractFromProcessor.create();
    assertEquals(extractFromProcessorResult.ok, true);
    if (!extractFromProcessorResult.ok) return;
    const extractFromProcessor = extractFromProcessorResult.data;
    const directivesResult = schemaResult.data.getExtractFromDirectives();
    assertEquals(directivesResult.ok, true);
    if (!directivesResult.ok) return;

    const extractResult = extractFromProcessor.processDirectivesSync(
      dataResult.data,
      directivesResult.data,
    );
    assertEquals(extractResult.ok, true);
    if (!extractResult.ok) return;

    const extractedData = extractResult.data.getData();
    assertEquals(Array.isArray(extractedData.ids), true);
    // Now complex nested path data.level1[].level2[].id works correctly
    assertEquals(extractedData.ids, ["1-1", "1-2", "2-1", "2-2"]);
  });
});

Deno.test("x-extract-from performance", async (t) => {
  await t.step("should handle large datasets efficiently", () => {
    const largeDataset = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: `id-${i}`,
        name: `name-${i}`,
        value: i,
        nested: {
          data: `nested-${i}`,
        },
      })),
    };

    const schemaData = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "ids": {
          "type": "array",
          "x-extract-from": "items[].id",
          "items": { "type": "string" },
        },
        "values": {
          "type": "array",
          "x-extract-from": "items[].value",
          "items": { "type": "number" },
        },
      },
    };

    // Create schema
    const pathResult = SchemaPath.create("test.json");
    assertEquals(pathResult.ok, true);
    if (!pathResult.ok) return;

    const definitionResult = SchemaDefinition.create(schemaData);
    assertEquals(definitionResult.ok, true);
    if (!definitionResult.ok) return;

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    assertEquals(schemaResult.ok, true);
    if (!schemaResult.ok) return;

    // Create frontmatter data
    const dataResult = FrontmatterData.create(largeDataset);
    assertEquals(dataResult.ok, true);
    if (!dataResult.ok) return;

    // Measure performance
    const extractFromProcessorResult = ExtractFromProcessor.create();
    assertEquals(extractFromProcessorResult.ok, true);
    if (!extractFromProcessorResult.ok) return;
    const extractFromProcessor = extractFromProcessorResult.data;
    const directivesResult = schemaResult.data.getExtractFromDirectives();
    assertEquals(directivesResult.ok, true);
    if (!directivesResult.ok) return;

    const startTime = performance.now();
    const extractResult = extractFromProcessor.processDirectivesSync(
      dataResult.data,
      directivesResult.data,
    );
    const endTime = performance.now();

    assertEquals(extractResult.ok, true);
    if (!extractResult.ok) return;

    const extractedData = extractResult.data.getData();
    assertEquals((extractedData.ids as any[]).length, 1000);
    assertEquals((extractedData.values as any[]).length, 1000);

    // Performance assertion: should complete within reasonable time
    const processingTime = endTime - startTime;
    assertEquals(
      processingTime < 1000,
      true,
      `Processing took ${processingTime}ms`,
    );
  });
});
