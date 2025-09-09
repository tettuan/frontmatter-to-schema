/**
 * SchemaPath Value Object Tests
 * 
 * Tests for SchemaPath Smart Constructor and validation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { SchemaPath } from "../../../../src/domain/value-objects/schema-path.ts";

Deno.test("SchemaPath - should create valid schema path with .json extension", () => {
  const result = SchemaPath.create("schemas/test.json");
  
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "schemas/test.json");
    assertEquals(result.data.getExtension(), ".json");
    assertEquals(result.data.getFilename(), "test.json");
  }
});

Deno.test("SchemaPath - should create valid schema path with .yaml extension", () => {
  const result = SchemaPath.create("schemas/test.yaml");
  
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "schemas/test.yaml");
    assertEquals(result.data.getExtension(), ".yaml");
  }
});

Deno.test("SchemaPath - should create valid schema path with .yml extension", () => {
  const result = SchemaPath.create("schemas/test.yml");
  
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "schemas/test.yml");
    assertEquals(result.data.getExtension(), ".yml");
  }
});

Deno.test("SchemaPath - should reject empty string", () => {
  const result = SchemaPath.create("");
  
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assertExists(result.error.message);
  }
});

Deno.test("SchemaPath - should reject whitespace-only string", () => {
  const result = SchemaPath.create("   ");
  
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("SchemaPath - should reject path with invalid extension", () => {
  const result = SchemaPath.create("schemas/test.txt");
  
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
    assertExists(result.error.message);
  }
});

Deno.test("SchemaPath - should reject path with null byte", () => {
  const result = SchemaPath.create("schemas/test\0.json");
  
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("SchemaPath - should reject path with directory traversal", () => {
  const result = SchemaPath.create("../../../etc/passwd.json");
  
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("SchemaPath - should reject excessively long path", () => {
  const longPath = "a".repeat(1020) + ".json";
  const result = SchemaPath.create(longPath);
  
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "TooLong");
  }
});

Deno.test("SchemaPath - should trim whitespace from valid path", () => {
  const result = SchemaPath.create("  schemas/test.json  ");
  
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "schemas/test.json");
  }
});

Deno.test("SchemaPath - should identify absolute paths", () => {
  const absoluteUnix = SchemaPath.create("/absolute/path/schema.json");
  if (absoluteUnix.ok) {
    assertEquals(absoluteUnix.data.isAbsolute(), true);
  }

  const relative = SchemaPath.create("relative/path/schema.json");
  if (relative.ok) {
    assertEquals(relative.data.isAbsolute(), false);
  }
});

Deno.test("SchemaPath - should create relative path from base", () => {
  const result = SchemaPath.create("/project/schemas/test.json");
  
  if (result.ok) {
    const relativeResult = result.data.makeRelative("/project/");
    assertEquals(relativeResult.ok, true);
    if (relativeResult.ok) {
      assertEquals(relativeResult.data.getValue(), "schemas/test.json");
    }
  }
});

Deno.test("SchemaPath - should fail to create relative path from non-matching base", () => {
  const result = SchemaPath.create("/project/schemas/test.json");
  
  if (result.ok) {
    const relativeResult = result.data.makeRelative("/other/");
    assertEquals(relativeResult.ok, false);
    if (!relativeResult.ok) {
      assertEquals(relativeResult.error.kind, "InvalidFormat");
    }
  }
});