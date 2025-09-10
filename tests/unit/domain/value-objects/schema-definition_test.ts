/**
 * SchemaDefinition Value Object Tests
 *
 * Tests for SchemaDefinition Smart Constructor and validation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { SchemaDefinition } from "../../../../src/domain/value-objects/schema-definition.ts";

Deno.test("SchemaDefinition - should create valid JSON schema", () => {
  const jsonSchema = JSON.stringify({
    type: "object",
    properties: { name: { type: "string" } },
  });
  const result = SchemaDefinition.create(jsonSchema, "json");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getRawDefinition(), jsonSchema);
    assertEquals(result.data.getFormat(), "json");

    const parsed = result.data.getParsedSchema();
    assertEquals(parsed.ok, true);
    if (parsed.ok) {
      assertEquals(parsed.data.type, "object");
    }
  }
});

Deno.test("SchemaDefinition - should create valid YAML schema", () => {
  const yamlSchema = `
type: object
properties:
  name:
    type: string
`;
  const result = SchemaDefinition.create(yamlSchema, "yaml");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getFormat(), "yaml");
    assertEquals(result.data.getRawDefinition().includes("type: object"), true);
  }
});

Deno.test("SchemaDefinition - should create valid custom schema", () => {
  const customSchema = "CUSTOM SCHEMA FORMAT";
  const result = SchemaDefinition.create(customSchema, "custom");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getRawDefinition(), customSchema);
    assertEquals(result.data.getFormat(), "custom");
  }
});

Deno.test("SchemaDefinition - should reject empty string", () => {
  const result = SchemaDefinition.create("", "json");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assertExists(result.error.message);
  }
});

Deno.test("SchemaDefinition - should reject whitespace-only string", () => {
  const result = SchemaDefinition.create("   ", "json");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("SchemaDefinition - should reject invalid JSON", () => {
  const result = SchemaDefinition.create("{invalid json}", "json");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ParseError");
    assertExists(result.error.message);
  }
});

Deno.test("SchemaDefinition - should reject non-object JSON", () => {
  const result = SchemaDefinition.create('"string value"', "json");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
    assertExists(result.error.message);
  }
});

Deno.test("SchemaDefinition - should reject invalid YAML format", () => {
  const result = SchemaDefinition.create("no yaml markers here", "yaml");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("SchemaDefinition - should create from object", () => {
  const schemaObject = { type: "object", title: "Test Schema" };
  const result = SchemaDefinition.createFromObject(schemaObject);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getFormat(), "json");
    assertEquals(result.data.getTitle(), "Test Schema");
  }
});

Deno.test("SchemaDefinition - should check for properties", () => {
  const schema = {
    type: "object",
    properties: {
      name: { type: "string" },
      nested: {
        type: "object",
        properties: {
          value: { type: "number" },
        },
      },
    },
  };
  const result = SchemaDefinition.createFromObject(schema);

  if (result.ok) {
    assertEquals(result.data.hasProperty("type"), true);
    assertEquals(result.data.hasProperty("properties.name"), true);
    assertEquals(
      result.data.hasProperty("properties.nested.properties.value"),
      true,
    );
    assertEquals(result.data.hasProperty("nonexistent"), false);
  }
});

Deno.test("SchemaDefinition - should get properties", () => {
  const schema = {
    type: "object",
    title: "Test",
    description: "Test schema",
  };
  const result = SchemaDefinition.createFromObject(schema);

  if (result.ok) {
    const typeResult = result.data.getProperty("type");
    assertEquals(typeResult.ok, true);
    if (typeResult.ok) {
      assertEquals(typeResult.data, "object");
    }

    const nonExistentResult = result.data.getProperty("nonexistent");
    assertEquals(nonExistentResult.ok, false);
    if (!nonExistentResult.ok) {
      assertEquals(nonExistentResult.error.kind, "NotFound");
    }
  }
});

Deno.test("SchemaDefinition - should identify JSON Schema", () => {
  const jsonSchemaWithMeta = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    type: "object",
  };
  const result1 = SchemaDefinition.createFromObject(jsonSchemaWithMeta);
  if (result1.ok) {
    assertEquals(result1.data.isJsonSchema(), true);
  }

  const plainSchema = { type: "object" };
  const result2 = SchemaDefinition.createFromObject(plainSchema);
  if (result2.ok) {
    assertEquals(result2.data.isJsonSchema(), false);
  }
});

Deno.test("SchemaDefinition - should get title and description", () => {
  const schema = {
    title: "My Schema",
    description: "This is a test schema",
    type: "object",
  };
  const result = SchemaDefinition.createFromObject(schema);

  if (result.ok) {
    assertEquals(result.data.getTitle(), "My Schema");
    assertEquals(result.data.getDescription(), "This is a test schema");
  }
});

Deno.test("SchemaDefinition - should return null for missing title/description", () => {
  const schema = { type: "object" };
  const result = SchemaDefinition.createFromObject(schema);

  if (result.ok) {
    assertEquals(result.data.getTitle(), null);
    assertEquals(result.data.getDescription(), null);
  }
});

Deno.test("SchemaDefinition - should have string representation", () => {
  const schema = { type: "object", title: "Test" };
  const result = SchemaDefinition.createFromObject(schema);

  if (result.ok) {
    assertEquals(
      result.data.toString(),
      'SchemaDefinition(json, title: "Test")',
    );
  }

  const noTitleResult = SchemaDefinition.create('{"type":"object"}', "json");
  if (noTitleResult.ok) {
    assertEquals(noTitleResult.data.toString(), "SchemaDefinition(json)");
  }
});
