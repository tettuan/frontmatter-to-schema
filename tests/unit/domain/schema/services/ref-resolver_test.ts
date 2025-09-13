import { assert, assertEquals } from "@std/assert";
import {
  RefResolver,
  SchemaLoader,
} from "../../../../../src/domain/schema/services/ref-resolver.ts";
import {
  SchemaDefinition,
  SchemaProperty,
} from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import {
  err,
  ok,
  Result,
} from "../../../../../src/domain/shared/types/result.ts";
import { SchemaError } from "../../../../../src/domain/shared/types/errors.ts";

// Mock SchemaLoader for testing
class MockSchemaLoader implements SchemaLoader {
  private schemas = new Map<string, SchemaProperty>();
  private errors = new Map<string, SchemaError & { message: string }>();

  addSchema(ref: string, schema: SchemaProperty): void {
    this.schemas.set(ref, schema);
  }

  addError(ref: string, error: SchemaError & { message: string }): void {
    this.errors.set(ref, error);
  }

  load(ref: string): Result<SchemaProperty, SchemaError & { message: string }> {
    if (this.errors.has(ref)) {
      return err(this.errors.get(ref)!);
    }

    const schema = this.schemas.get(ref);
    if (!schema) {
      return err({
        kind: "SchemaNotFound",
        path: ref,
        message: `Schema not found for ref: ${ref}`,
      });
    }

    return ok(schema);
  }
}

Deno.test("RefResolver - should resolve simple schema without references", () => {
  const loader = new MockSchemaLoader();
  const resolver = new RefResolver(loader);

  const simpleSchema: SchemaProperty = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  };

  const definition = SchemaDefinition.create(simpleSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data.definition.getRawSchema(), simpleSchema);
    assertEquals(result.data.referencedSchemas.size, 0);
  }
});

Deno.test("RefResolver - should resolve schema with single $ref", () => {
  const loader = new MockSchemaLoader();

  // Referenced schema
  const personSchema: SchemaProperty = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  };

  loader.addSchema("#/definitions/Person", personSchema);

  const resolver = new RefResolver(loader);

  const mainSchema: SchemaProperty = {
    type: "object",
    properties: {
      person: { $ref: "#/definitions/Person" },
      count: { type: "number" },
    },
  };

  const definition = SchemaDefinition.create(mainSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(result.ok);

  if (result.ok) {
    const resolved = result.data.definition.getRawSchema();
    assertEquals(resolved.properties?.person, personSchema);
    assertEquals(result.data.referencedSchemas.size, 1);
    assert(result.data.referencedSchemas.has("#/definitions/Person"));
  }
});

Deno.test("RefResolver - should resolve schema with nested $ref in properties", () => {
  const loader = new MockSchemaLoader();

  // Referenced schemas
  const addressSchema: SchemaProperty = {
    type: "object",
    properties: {
      street: { type: "string" },
      city: { type: "string" },
    },
  };

  const personSchema: SchemaProperty = {
    type: "object",
    properties: {
      name: { type: "string" },
      address: { $ref: "#/definitions/Address" },
    },
  };

  loader.addSchema("#/definitions/Address", addressSchema);
  loader.addSchema("#/definitions/Person", personSchema);

  const resolver = new RefResolver(loader);

  const mainSchema: SchemaProperty = {
    type: "object",
    properties: {
      person: { $ref: "#/definitions/Person" },
    },
  };

  const definition = SchemaDefinition.create(mainSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(result.ok);

  if (result.ok) {
    const resolved = result.data.definition.getRawSchema();
    const resolvedPerson = resolved.properties?.person as SchemaProperty;
    assertEquals(resolvedPerson.properties?.address, addressSchema);
    assertEquals(result.data.referencedSchemas.size, 2);
    assert(result.data.referencedSchemas.has("#/definitions/Address"));
    assert(result.data.referencedSchemas.has("#/definitions/Person"));
  }
});

Deno.test("RefResolver - should resolve schema with $ref in array items", () => {
  const loader = new MockSchemaLoader();

  const itemSchema: SchemaProperty = {
    type: "object",
    properties: {
      id: { type: "string" },
      value: { type: "number" },
    },
  };

  loader.addSchema("#/definitions/Item", itemSchema);

  const resolver = new RefResolver(loader);

  const mainSchema: SchemaProperty = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { $ref: "#/definitions/Item" },
      },
    },
  };

  const definition = SchemaDefinition.create(mainSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(result.ok);

  if (result.ok) {
    const resolved = result.data.definition.getRawSchema();
    const itemsProperty = resolved.properties?.items as SchemaProperty;
    assertEquals(itemsProperty.items, itemSchema);
    assertEquals(result.data.referencedSchemas.size, 1);
    assert(result.data.referencedSchemas.has("#/definitions/Item"));
  }
});

Deno.test("RefResolver - should detect circular references", () => {
  const loader = new MockSchemaLoader();

  // Create circular reference: A -> B -> A
  const schemaA: SchemaProperty = {
    type: "object",
    properties: {
      name: { type: "string" },
      ref_b: { $ref: "#/definitions/B" },
    },
  };

  const schemaB: SchemaProperty = {
    type: "object",
    properties: {
      value: { type: "number" },
      ref_a: { $ref: "#/definitions/A" },
    },
  };

  loader.addSchema("#/definitions/A", schemaA);
  loader.addSchema("#/definitions/B", schemaB);

  const resolver = new RefResolver(loader);

  const mainSchema: SchemaProperty = {
    $ref: "#/definitions/A",
  };

  const definition = SchemaDefinition.create(mainSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "CircularReference");
    assert("refs" in result.error);
  }
});

Deno.test("RefResolver - should handle missing reference", () => {
  const loader = new MockSchemaLoader();
  const resolver = new RefResolver(loader);

  const mainSchema: SchemaProperty = {
    type: "object",
    properties: {
      person: { $ref: "#/definitions/NonExistent" },
    },
  };

  const definition = SchemaDefinition.create(mainSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "RefResolutionFailed");
    assert(result.error.message.includes("NonExistent"));
  }
});

Deno.test("RefResolver - should handle loader errors", () => {
  const loader = new MockSchemaLoader();
  const error: SchemaError & { message: string } = {
    kind: "SchemaNotFound",
    path: "#/definitions/Missing",
    message: "Schema file not found",
  };
  loader.addError("#/definitions/Missing", error);

  const resolver = new RefResolver(loader);

  const mainSchema: SchemaProperty = {
    type: "object",
    properties: {
      ref: { $ref: "#/definitions/Missing" },
    },
  };

  const definition = SchemaDefinition.create(mainSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "RefResolutionFailed");
    assert(result.error.message.includes("Schema file not found"));
  }
});

Deno.test("RefResolver - should handle invalid referenced schema", () => {
  const loader = new MockSchemaLoader();

  // Add invalid schema (SchemaDefinition.create will fail)
  const invalidSchema = { type: 123 } as unknown as SchemaProperty; // Invalid type field
  loader.addSchema("#/definitions/Invalid", invalidSchema);

  const resolver = new RefResolver(loader);

  const mainSchema: SchemaProperty = {
    type: "object",
    properties: {
      ref: { $ref: "#/definitions/Invalid" },
    },
  };

  const definition = SchemaDefinition.create(mainSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "RefResolutionFailed");
    assert(result.error.message.includes("Invalid referenced schema"));
  }
});

Deno.test("RefResolver - should handle complex nested array items with objects", () => {
  const loader = new MockSchemaLoader();

  const nestedSchema: SchemaProperty = {
    type: "object",
    properties: {
      nested_array: {
        type: "array",
        items: {
          type: "object",
          properties: {
            deep_ref: { $ref: "#/definitions/Deep" },
          },
        },
      },
    },
  };

  const deepSchema: SchemaProperty = {
    type: "string",
  };

  loader.addSchema("#/definitions/Nested", nestedSchema);
  loader.addSchema("#/definitions/Deep", deepSchema);

  const resolver = new RefResolver(loader);

  const mainSchema: SchemaProperty = {
    type: "object",
    properties: {
      complex: { $ref: "#/definitions/Nested" },
    },
  };

  const definition = SchemaDefinition.create(mainSchema);
  assert(definition.ok);

  const result = resolver.resolve(definition.data);
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data.referencedSchemas.size, 2);
    assert(result.data.referencedSchemas.has("#/definitions/Nested"));
    assert(result.data.referencedSchemas.has("#/definitions/Deep"));
  }
});

Deno.test("RefResolver - should clear visited refs between resolve calls", () => {
  const loader = new MockSchemaLoader();

  const simpleSchema: SchemaProperty = {
    type: "object",
    properties: {
      name: { type: "string" },
    },
  };

  loader.addSchema("#/definitions/Simple", simpleSchema);

  const resolver = new RefResolver(loader);

  const schema1: SchemaProperty = {
    $ref: "#/definitions/Simple",
  };

  const schema2: SchemaProperty = {
    $ref: "#/definitions/Simple",
  };

  // First resolution
  const def1 = SchemaDefinition.create(schema1);
  assert(def1.ok);
  const result1 = resolver.resolve(def1.data);
  assert(result1.ok);

  // Second resolution should work (visited refs should be cleared)
  const def2 = SchemaDefinition.create(schema2);
  assert(def2.ok);
  const result2 = resolver.resolve(def2.data);
  assert(result2.ok);
});
