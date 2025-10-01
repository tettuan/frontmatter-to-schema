import { assert, assertEquals } from "@std/assert";
import {
  Schema,
  SchemaId,
} from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";

Deno.test("Schema - create with unloaded state", () => {
  const id = SchemaId.create("registry_schema").unwrap();
  const path = SchemaPath.create("registry_schema.json").unwrap();

  const schema = Schema.create(id, path);

  assertEquals(schema.getId(), id);
  assertEquals(schema.getState().kind, "Unloaded");
  assertEquals(schema.getState().path, path);
});

Deno.test("Schema - isLoaded returns false for unloaded schema", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schema = Schema.create(id, path);

  assertEquals(schema.isLoaded(), false);
});

Deno.test("Schema - markAsLoading updates state", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schema = Schema.create(id, path);

  const updatedSchema = schema.markAsLoading();

  assertEquals(updatedSchema.getState().kind, "Loading");
  assertEquals(updatedSchema.getState().path, path);
});

Deno.test("Schema - markAsResolved updates state with schema data", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schema = Schema.create(id, path);
  const schemaData = { type: "object", properties: {} };

  const resolvedSchema = schema.markAsResolved(schemaData);
  const resolvedState = resolvedSchema.getState();

  assertEquals(resolvedState.kind, "Resolved");
  if (resolvedState.kind === "Resolved") {
    assertEquals(resolvedState.schema, schemaData);
  }
  assertEquals(resolvedSchema.isLoaded(), true);
});

Deno.test("Schema - markAsFailed updates state with error", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schema = Schema.create(id, path);
  const error = new Error("Failed to load schema");

  const failedSchema = schema.markAsFailed(error);
  const failedState = failedSchema.getState();

  assertEquals(failedState.kind, "Failed");
  if (failedState.kind === "Failed") {
    assertEquals(failedState.error, error);
  }
});

Deno.test("Schema - hasExtractFromDirectives checks for x-frontmatter-part", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: {
      commands: {
        type: "array",
        "x-frontmatter-part": true,
      },
    },
  };

  const schema = Schema.create(id, path).markAsResolved(schemaData);

  assertEquals(schema.hasExtractFromDirectives(), true);
});

Deno.test("Schema - hasExtractFromDirectives returns false without directives", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: {
      commands: {
        type: "array",
      },
    },
  };

  const schema = Schema.create(id, path).markAsResolved(schemaData);

  assertEquals(schema.hasExtractFromDirectives(), false);
});

Deno.test("SchemaId - create generates unique identifier", () => {
  const id1 = SchemaId.create("test_schema").unwrap();
  const id2 = SchemaId.create("test_schema").unwrap();

  assertEquals(id1.getValue(), "test_schema");
  assertEquals(id2.getValue(), "test_schema");
  assertEquals(id1.equals(id2), true);
});

Deno.test("SchemaId - different names create different ids", () => {
  const id1 = SchemaId.create("schema1").unwrap();
  const id2 = SchemaId.create("schema2").unwrap();

  assertEquals(id1.equals(id2), false);
});

Deno.test("SchemaId - validation rejects null input", () => {
  const result = SchemaId.create(null as any);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_SCHEMA_ID");
});

Deno.test("SchemaId - validation rejects empty string", () => {
  const result = SchemaId.create("");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_SCHEMA_ID");
});

Deno.test("SchemaId - validation rejects whitespace-only string", () => {
  const result = SchemaId.create("   ");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_SCHEMA_ID");
});

Deno.test("SchemaId - validation rejects short string", () => {
  const result = SchemaId.create("ab");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_SCHEMA_ID");
});

Deno.test("SchemaId - validation trims whitespace", () => {
  const result = SchemaId.create("  test_schema  ");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getValue(), "test_schema");
});

Deno.test("SchemaId - toString returns string value", () => {
  const id = SchemaId.create("test_schema").unwrap();

  assertEquals(id.toString(), "test_schema");
});

Deno.test("Schema - getPath returns schema path", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schema = Schema.create(id, path);

  assertEquals(schema.getPath(), path);
});

Deno.test("Schema - getData returns schema data for resolved schema", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: { name: { type: "string" } },
  };
  const schema = Schema.create(id, path).markAsResolved(schemaData);

  const result = schema.getData();
  assert(result.isOk());
  assertEquals(result.unwrap(), schemaData);
});

Deno.test("Schema - getData returns error for unresolved schema", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schema = Schema.create(id, path);

  const result = schema.getData();
  assert(result.isError());
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_STATE");
  assert(error.message.includes("not resolved"));
});

Deno.test("Schema - hasExtractFromDirectives returns false for unresolved schema", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schema = Schema.create(id, path);

  assertEquals(schema.hasExtractFromDirectives(), false);
});

Deno.test("Schema - hasExtractFromDirectives handles schema without properties", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schemaData = { type: "string" };
  const schema = Schema.create(id, path).markAsResolved(schemaData);

  assertEquals(schema.hasExtractFromDirectives(), false);
});

Deno.test("Schema - hasExtractFromDirectives handles nested properties with x-frontmatter-part", () => {
  const id = SchemaId.create("test_schema").unwrap();
  const path = SchemaPath.create("test_schema.json").unwrap();
  const schemaData = {
    type: "object",
    properties: {
      metadata: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            "x-frontmatter-part": true,
          },
        },
      },
    },
  };
  const schema = Schema.create(id, path).markAsResolved(schemaData);

  assertEquals(schema.hasExtractFromDirectives(), true);
});
