import { assertEquals } from "jsr:@std/assert";
import { DirectiveProcessor } from "../../../../../src/domain/schema/services/directive-processor.ts";
import { SchemaData } from "../../../../../src/domain/schema/entities/schema.ts";

const validSchemaWithDerivedUnique: SchemaData = {
  type: "object",
  properties: {
    categories: {
      type: "array",
      items: { type: "string" },
      "x-derived-from": "tags",
      "x-derived-unique": true,
    },
  },
};

const invalidSchemaWithDerivedUnique: SchemaData = {
  type: "object",
  properties: {
    categories: {
      type: "array",
      items: { type: "string" },
      "x-derived-unique": "invalid-value", // Should be boolean
    },
  },
};

Deno.test("x-derived-unique - validate accepts boolean true", () => {
  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(validSchemaWithDerivedUnique);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, true);

  const uniqueDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-derived-unique",
  );
  assertEquals(uniqueDirective !== undefined, true);
  assertEquals(uniqueDirective?.value, true);
});

Deno.test("x-derived-unique - validate accepts boolean false", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        "x-derived-unique": false,
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();

  const uniqueDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-derived-unique",
  );
  assertEquals(uniqueDirective?.value, false);
});

Deno.test("x-derived-unique - validate rejects string value", () => {
  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(invalidSchemaWithDerivedUnique);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.message.includes("x-derived-unique"), true);
  assertEquals(error.message.includes("boolean"), true);
});

Deno.test("x-derived-unique - validate rejects number value", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        "x-derived-unique": 1 as any, // Invalid number
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.message.includes("x-derived-unique"), true);
  assertEquals(error.message.includes("boolean"), true);
});

Deno.test("x-derived-unique - validate rejects null value", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        "x-derived-unique": null as any, // Invalid null
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.message.includes("x-derived-unique"), true);
  assertEquals(error.message.includes("boolean"), true);
});

Deno.test("x-derived-unique - directive processed and extracted", () => {
  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(validSchemaWithDerivedUnique);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();

  // Check that directive is extracted but removed from processed schema
  const uniqueDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-derived-unique",
  );
  assertEquals(uniqueDirective?.value, true);

  // Check that directive is removed from processed schema after processing
  const categoriesProperty = processingResult.processedSchema.properties
    ?.categories as any;
  assertEquals(categoriesProperty["x-derived-unique"], undefined);
});

Deno.test("x-derived-unique - works with multiple directives", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { type: "string" },
        "x-frontmatter-part": true,
        "x-derived-from": "source",
        "x-derived-unique": true,
        "x-flatten-arrays": "items",
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.extractedDirectives.length, 4);

  const directiveTypes = processingResult.extractedDirectives.map((d) =>
    d.type
  );
  assertEquals(directiveTypes.includes("x-derived-unique"), true);
  assertEquals(directiveTypes.includes("x-derived-from"), true);
  assertEquals(directiveTypes.includes("x-frontmatter-part"), true);
  assertEquals(directiveTypes.includes("x-flatten-arrays"), true);
});
