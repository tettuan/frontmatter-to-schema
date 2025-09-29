import { assertEquals } from "@std/assert";
import { DirectiveProcessor } from "../../../../../src/domain/schema/services/directive-processor.ts";
import { SchemaData } from "../../../../../src/domain/schema/entities/schema.ts";

const validSchemaWithJMESPathFilter: SchemaData = {
  type: "object",
  properties: {
    filteredItems: {
      type: "array",
      items: { type: "object" },
      "x-derived-from": "items",
      "x-jmespath-filter": "[?status == 'active']",
    },
  },
};

const invalidSchemaWithJMESPathFilter: SchemaData = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: { type: "object" },
      "x-jmespath-filter": 123 as any, // Should be string
    },
  },
};

Deno.test("x-jmespath-filter - validate accepts valid JMESPath string", () => {
  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(validSchemaWithJMESPathFilter);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.hasDirectives, true);

  const jmespathDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-jmespath-filter",
  );
  assertEquals(jmespathDirective !== undefined, true);
  assertEquals(jmespathDirective?.value, "[?status == 'active']");
});

Deno.test("x-jmespath-filter - validate accepts simple property filter", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      activeUsers: {
        type: "array",
        items: { type: "object" },
        "x-jmespath-filter": "length(@) > `0`",
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();

  const jmespathDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-jmespath-filter",
  );
  assertEquals(jmespathDirective?.value, "length(@) > `0`");
});

Deno.test("x-jmespath-filter - validate accepts complex nested filter", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      complexFilter: {
        type: "array",
        items: { type: "object" },
        "x-jmespath-filter":
          "[?user.permissions.admin == `true` && status != 'disabled']",
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();

  const jmespathDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-jmespath-filter",
  );
  assertEquals(
    jmespathDirective?.value,
    "[?user.permissions.admin == `true` && status != 'disabled']",
  );
});

Deno.test("x-jmespath-filter - validate rejects number value", () => {
  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(invalidSchemaWithJMESPathFilter);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.message.includes("x-jmespath-filter"), true);
  assertEquals(error.message.includes("string"), true);
});

Deno.test("x-jmespath-filter - validate rejects empty string", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { type: "object" },
        "x-jmespath-filter": "", // Empty string
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.message.includes("x-jmespath-filter"), true);
  assertEquals(error.message.includes("non-empty string"), true);
});

Deno.test("x-jmespath-filter - validate rejects whitespace-only string", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { type: "object" },
        "x-jmespath-filter": "   ", // Whitespace only
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.message.includes("x-jmespath-filter"), true);
  assertEquals(error.message.includes("non-empty string"), true);
});

Deno.test("x-jmespath-filter - validate rejects boolean value", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { type: "object" },
        "x-jmespath-filter": true as any, // Invalid boolean
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.message.includes("x-jmespath-filter"), true);
  assertEquals(error.message.includes("string"), true);
});

Deno.test("x-jmespath-filter - directive processed and extracted", () => {
  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(validSchemaWithJMESPathFilter);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();

  // Check that directive is extracted but removed from processed schema
  const jmespathDirective = processingResult.extractedDirectives.find(
    (d) => d.type === "x-jmespath-filter",
  );
  assertEquals(jmespathDirective?.value, "[?status == 'active']");

  // Check that directive is removed from processed schema after processing
  const filteredItemsProperty = processingResult.processedSchema.properties
    ?.filteredItems as any;
  assertEquals(filteredItemsProperty["x-jmespath-filter"], undefined);
});

Deno.test("x-jmespath-filter - works with other directives", () => {
  const schema: SchemaData = {
    type: "object",
    properties: {
      processedItems: {
        type: "array",
        items: { type: "object" },
        "x-derived-from": "rawItems",
        "x-jmespath-filter": "[?enabled == `true`]",
        "x-derived-unique": true,
      },
    },
  };

  const processor = DirectiveProcessor.create();
  const result = processor.processDirectives(schema);

  assertEquals(result.isOk(), true);
  const processingResult = result.unwrap();
  assertEquals(processingResult.extractedDirectives.length, 3);

  const directiveTypes = processingResult.extractedDirectives.map((d) =>
    d.type
  );
  assertEquals(directiveTypes.includes("x-jmespath-filter"), true);
  assertEquals(directiveTypes.includes("x-derived-from"), true);
  assertEquals(directiveTypes.includes("x-derived-unique"), true);
});
