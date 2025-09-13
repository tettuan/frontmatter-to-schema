import { assertEquals } from "@std/assert";
import { SchemaPath } from "../../../../src/domain/schema/value-objects/schema-path.ts";
import { isErr, isOk } from "../../../../src/domain/shared/types/result.ts";

Deno.test("SchemaPath - creates valid path", () => {
  const result = SchemaPath.create("test.json");
  assertEquals(isOk(result), true);

  if (isOk(result)) {
    assertEquals(result.data.getValue(), "test.json");
  }
});

Deno.test("SchemaPath - rejects empty path", () => {
  const result = SchemaPath.create("");
  assertEquals(isErr(result), true);
});

Deno.test("SchemaPath - rejects non-json extension", () => {
  const result = SchemaPath.create("test.txt");
  assertEquals(isErr(result), true);
});

Deno.test("SchemaPath - identifies absolute paths", () => {
  const result = SchemaPath.create("/absolute/test.json");

  if (isOk(result)) {
    assertEquals(result.data.isAbsolute(), true);
    assertEquals(result.data.isRelative(), false);
  }
});

Deno.test("SchemaPath - identifies relative paths", () => {
  const result = SchemaPath.create("relative/test.json");

  if (isOk(result)) {
    assertEquals(result.data.isAbsolute(), false);
    assertEquals(result.data.isRelative(), true);
  }
});

Deno.test("SchemaPath - extracts filename", () => {
  const result = SchemaPath.create("path/to/schema.json");

  if (isOk(result)) {
    assertEquals(result.data.getFileName(), "schema.json");
  }
});

Deno.test("SchemaPath - extracts directory", () => {
  const result = SchemaPath.create("path/to/schema.json");

  if (isOk(result)) {
    assertEquals(result.data.getDirectory(), "path/to");
  }
});
