import { assertEquals } from "jsr:@std/assert";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";

Deno.test("SchemaPath - create with valid JSON schema path", () => {
  const result = SchemaPath.create("registry_schema.json");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().toString(), "registry_schema.json");
});

Deno.test("SchemaPath - create with absolute path", () => {
  const result = SchemaPath.create("/absolute/path/schema.json");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().toString(), "/absolute/path/schema.json");
});

Deno.test("SchemaPath - reject non-JSON extension", () => {
  const result = SchemaPath.create("schema.yaml");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_EXTENSION");
});

Deno.test("SchemaPath - reject empty path", () => {
  const result = SchemaPath.create("");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_PATH");
});

Deno.test("SchemaPath - reject path without extension", () => {
  const result = SchemaPath.create("schema");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_EXTENSION");
});

Deno.test("SchemaPath - getBasename returns filename", () => {
  const schemaPath = SchemaPath.create("path/to/registry_schema.json").unwrap();

  assertEquals(schemaPath.getBasename(), "registry_schema.json");
});

Deno.test("SchemaPath - getSchemaName returns name without extension", () => {
  const schemaPath = SchemaPath.create("registry_schema.json").unwrap();

  assertEquals(schemaPath.getSchemaName(), "registry_schema");
});

Deno.test("SchemaPath - equals compares paths correctly", () => {
  const path1 = SchemaPath.create("same_schema.json").unwrap();
  const path2 = SchemaPath.create("same_schema.json").unwrap();
  const path3 = SchemaPath.create("different_schema.json").unwrap();

  assertEquals(path1.equals(path2), true);
  assertEquals(path1.equals(path3), false);
});

Deno.test("SchemaPath - isReference detects $ref patterns", () => {
  const refPath = SchemaPath.create("registry_command_schema.json").unwrap();
  const mainPath = SchemaPath.create("registry_schema.json").unwrap();

  assertEquals(refPath.isReference(), true);
  assertEquals(mainPath.isReference(), false);
});
