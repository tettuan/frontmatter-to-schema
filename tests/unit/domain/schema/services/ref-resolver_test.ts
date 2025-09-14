import { assert, assertEquals } from "@std/assert";
import {
  RefResolver,
  SchemaLoader,
} from "../../../../../src/domain/schema/services/ref-resolver.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaProperty } from "../../../../../src/domain/schema/value-objects/schema-property-types.ts";
import {
  err,
  ok,
  Result,
} from "../../../../../src/domain/shared/types/result.ts";
import { SchemaError } from "../../../../../src/domain/shared/types/errors.ts";

// Mock SchemaLoader for testing
class MockSchemaLoader implements SchemaLoader {
  private schemas = new Map<string, unknown>();
  private errors = new Map<string, SchemaError & { message: string }>();

  addSchema(ref: string, schema: unknown): void {
    this.schemas.set(ref, schema);
  }

  addError(ref: string, error: SchemaError & { message: string }): void {
    this.errors.set(ref, error);
  }

  load(ref: string): Result<SchemaProperty, SchemaError & { message: string }> {
    if (this.errors.has(ref)) {
      return err(this.errors.get(ref)!);
    }

    const rawSchema = this.schemas.get(ref);
    if (!rawSchema) {
      return err({
        kind: "SchemaNotFound",
        path: ref,
        message: `Schema not found for ref: ${ref}`,
      });
    }

    // Migrate legacy schema to new discriminated union format
    const migrationResult = SchemaDefinition.create(rawSchema);
    if (!migrationResult.ok) {
      return err(migrationResult.error);
    }

    return ok(migrationResult.data.getRawSchema());
  }
}

Deno.test("RefResolver - should resolve simple schema without references", () => {
  const loader = new MockSchemaLoader();
  const resolver = new RefResolver(loader);

  const simpleSchema = {
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
    const resolved = result.data.definition.getRawSchema();
    assert(resolved.kind === "object");
    assertEquals(result.data.referencedSchemas.size, 0);
  }
});

Deno.test("RefResolver - should resolve schema with single $ref", () => {
  const loader = new MockSchemaLoader();

  // Referenced schema
  const personSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  };

  loader.addSchema("#/definitions/Person", personSchema);

  const resolver = new RefResolver(loader);

  const mainSchema = {
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
    if (resolved.kind === "object") {
      assert("person" in resolved.properties);
    }
    assertEquals(result.data.referencedSchemas.size, 1);
    assert(result.data.referencedSchemas.has("#/definitions/Person"));
  }
});

Deno.test("RefResolver - should resolve schema with nested $ref in properties", () => {
  const loader = new MockSchemaLoader();

  // Referenced schemas
  const addressSchema = {
    type: "object",
    properties: {
      street: { type: "string" },
      city: { type: "string" },
    },
  };

  const personSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      address: { $ref: "#/definitions/Address" },
    },
  };

  loader.addSchema("#/definitions/Address", addressSchema);
  loader.addSchema("#/definitions/Person", personSchema);

  const resolver = new RefResolver(loader);

  const mainSchema = {
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
    if (resolved.kind === "object") {
      const resolvedPerson = resolved.properties.person;
      if (resolvedPerson.kind === "object") {
        assert("address" in resolvedPerson.properties);
      }
    }
    assertEquals(result.data.referencedSchemas.size, 2);
    assert(result.data.referencedSchemas.has("#/definitions/Address"));
    assert(result.data.referencedSchemas.has("#/definitions/Person"));
  }
});

Deno.test("RefResolver - should resolve schema with $ref in array items", () => {
  const loader = new MockSchemaLoader();

  const itemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      value: { type: "number" },
    },
  };

  loader.addSchema("#/definitions/Item", itemSchema);

  const resolver = new RefResolver(loader);

  const mainSchema = {
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
    if (resolved.kind === "object") {
      const itemsProperty = resolved.properties.items;
      if (itemsProperty.kind === "array") {
        // Items should be resolved, not a $ref at this point
        assert(!("$ref" in itemsProperty.items));
        assert(itemsProperty.items.kind === "object");
      }
    }
    assertEquals(result.data.referencedSchemas.size, 1);
    assert(result.data.referencedSchemas.has("#/definitions/Item"));
  }
});

Deno.test("RefResolver - should detect circular references", () => {
  const loader = new MockSchemaLoader();

  // Create circular reference: A -> B -> A
  const schemaA = {
    type: "object",
    properties: {
      name: { type: "string" },
      ref_b: { $ref: "#/definitions/B" },
    },
  };

  const schemaB = {
    type: "object",
    properties: {
      value: { type: "number" },
      ref_a: { $ref: "#/definitions/A" },
    },
  };

  loader.addSchema("#/definitions/A", schemaA);
  loader.addSchema("#/definitions/B", schemaB);

  const resolver = new RefResolver(loader);

  const mainSchema = {
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

  const mainSchema = {
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

  const mainSchema = {
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
  const invalidSchema = { type: 123 }; // Invalid type field
  loader.addSchema("#/definitions/Invalid", invalidSchema);

  const resolver = new RefResolver(loader);

  const mainSchema = {
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
    // Error could be from migration process for invalid schemas
    assert(
      result.error.message.includes("Invalid schema") ||
        result.error.message.includes("Unknown schema type"),
    );
  }
});

Deno.test("RefResolver - should handle complex nested array items with objects", () => {
  const loader = new MockSchemaLoader();

  const nestedSchema = {
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

  const deepSchema = {
    type: "string",
  };

  loader.addSchema("#/definitions/Nested", nestedSchema);
  loader.addSchema("#/definitions/Deep", deepSchema);

  const resolver = new RefResolver(loader);

  const mainSchema = {
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

  const simpleSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
    },
  };

  loader.addSchema("#/definitions/Simple", simpleSchema);

  const resolver = new RefResolver(loader);

  const schema1 = {
    $ref: "#/definitions/Simple",
  };

  const schema2 = {
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
