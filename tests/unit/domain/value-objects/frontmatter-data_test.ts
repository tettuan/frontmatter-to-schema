/**
 * FrontmatterData Value Object Tests
 *
 * Tests for FrontmatterData Smart Constructor and validation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { FrontmatterData } from "../../../../src/domain/value-objects/frontmatter-data.ts";

Deno.test("FrontmatterData - should create valid YAML frontmatter", () => {
  const yamlContent = `
title: Test Document
author: John Doe
tags:
  - test
  - documentation
`;
  const result = FrontmatterData.create(yamlContent, "yaml");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getFormat(), "yaml");
    assertEquals(result.data.getRawContent(), yamlContent.trim());
    assertEquals(result.data.isEmpty(), false);
  }
});

Deno.test("FrontmatterData - should create valid JSON frontmatter", () => {
  const jsonContent = JSON.stringify({
    title: "Test Document",
    author: "John Doe",
    tags: ["test", "documentation"],
  });
  const result = FrontmatterData.create(jsonContent, "json");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getFormat(), "json");
    const data = result.data.getData();
    assertEquals(data.title, "Test Document");
    assertEquals(data.author, "John Doe");
  }
});

Deno.test("FrontmatterData - should create valid TOML frontmatter", () => {
  const tomlContent = `
title = "Test Document"
author = "John Doe"
[tags]
values = ["test", "documentation"]
`;
  const result = FrontmatterData.create(tomlContent, "toml");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getFormat(), "toml");
    assertEquals(result.data.isEmpty(), false);
  }
});

Deno.test("FrontmatterData - should reject empty content", () => {
  const result = FrontmatterData.create("", "yaml");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assertExists(result.error.message);
  }
});

Deno.test("FrontmatterData - should reject whitespace-only content", () => {
  const result = FrontmatterData.create("   ", "yaml");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("FrontmatterData - should reject invalid JSON", () => {
  const result = FrontmatterData.create("{invalid json}", "json");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ParseError");
    assertExists(result.error.message);
  }
});

Deno.test("FrontmatterData - should reject non-object JSON", () => {
  const result = FrontmatterData.create('"string value"', "json");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("FrontmatterData - should reject invalid YAML format", () => {
  const result = FrontmatterData.create("no yaml markers here", "yaml");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("FrontmatterData - should reject invalid TOML format", () => {
  const result = FrontmatterData.create("no toml markers here", "toml");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("FrontmatterData - should create from parsed data", () => {
  const data = {
    title: "Test",
    count: 42,
    enabled: true,
  };
  const result = FrontmatterData.createFromParsed(data);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getFieldCount(), 3);
    assertEquals(result.data.hasField("title"), true);
    assertEquals(result.data.hasField("count"), true);
  }
});

Deno.test("FrontmatterData - should allow empty parsed data for graceful handling", () => {
  const result = FrontmatterData.createFromParsed({});

  // Empty data is now allowed for documents without frontmatter
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getData(), {});
    assertEquals(result.data.isEmpty(), true);
  }
});

Deno.test("FrontmatterData - should get field values", () => {
  const data = {
    title: "Test",
    author: "John",
    year: 2024,
  };
  const result = FrontmatterData.createFromParsed(data);

  if (result.ok) {
    const titleResult = result.data.getField("title");
    assertEquals(titleResult.ok, true);
    if (titleResult.ok) {
      assertEquals(titleResult.data, "Test");
    }

    const nonExistentResult = result.data.getField("nonexistent");
    assertEquals(nonExistentResult.ok, false);
    if (!nonExistentResult.ok) {
      assertEquals(nonExistentResult.error.kind, "NotFound");
    }
  }
});

Deno.test("FrontmatterData - should get field with type checking", () => {
  const data = {
    title: "Test",
    count: 42,
    enabled: true,
  };
  const result = FrontmatterData.createFromParsed(data);

  if (result.ok) {
    const stringResult = result.data.getFieldAs(
      "title",
      (v): v is string => typeof v === "string",
    );
    assertEquals(stringResult.ok, true);
    if (stringResult.ok) {
      assertEquals(stringResult.data, "Test");
    }

    const wrongTypeResult = result.data.getFieldAs(
      "count",
      (v): v is string => typeof v === "string",
    );
    assertEquals(wrongTypeResult.ok, false);
    if (!wrongTypeResult.ok) {
      assertEquals(wrongTypeResult.error.kind, "InvalidFormat");
    }
  }
});

Deno.test("FrontmatterData - should get field names", () => {
  const data = {
    field1: "value1",
    field2: "value2",
    field3: "value3",
  };
  const result = FrontmatterData.createFromParsed(data);

  if (result.ok) {
    const fieldNames = result.data.getFieldNames();
    assertEquals(fieldNames.length, 3);
    assertEquals(fieldNames.includes("field1"), true);
    assertEquals(fieldNames.includes("field2"), true);
    assertEquals(fieldNames.includes("field3"), true);
  }
});

Deno.test("FrontmatterData - should merge frontmatter data", () => {
  const data1 = { title: "Original", author: "John" };
  const data2 = { title: "Updated", tags: ["test"] };

  const result1 = FrontmatterData.createFromParsed(data1);
  const result2 = FrontmatterData.createFromParsed(data2);

  if (result1.ok && result2.ok) {
    const mergeResult = result1.data.merge(result2.data);
    assertEquals(mergeResult.ok, true);
    if (mergeResult.ok) {
      const data = mergeResult.data.getData();
      assertEquals(data.title, "Updated"); // Second overwrites first
      assertEquals(data.author, "John");
      assertExists(data.tags);
    }
  }
});

Deno.test("FrontmatterData - should filter fields", () => {
  const data = {
    title: "Test",
    _internal: "hidden",
    author: "John",
    _id: 123,
  };
  const result = FrontmatterData.createFromParsed(data);

  if (result.ok) {
    const filterResult = result.data.filter(
      (key) => !key.startsWith("_"),
    );
    assertEquals(filterResult.ok, true);
    if (filterResult.ok) {
      assertEquals(filterResult.data.getFieldCount(), 2);
      assertEquals(filterResult.data.hasField("title"), true);
      assertEquals(filterResult.data.hasField("author"), true);
      assertEquals(filterResult.data.hasField("_internal"), false);
    }
  }
});

Deno.test("FrontmatterData - should reject filter with empty result", () => {
  const data = { field1: "value1" };
  const result = FrontmatterData.createFromParsed(data);

  if (result.ok) {
    const filterResult = result.data.filter(() => false);
    assertEquals(filterResult.ok, false);
    if (!filterResult.ok) {
      assertEquals(filterResult.error.kind, "EmptyInput");
    }
  }
});

Deno.test("FrontmatterData - should transform format", () => {
  const data = { title: "Test", count: 42 };
  const result = FrontmatterData.createFromParsed(data, "yaml");

  if (result.ok) {
    const jsonResult = result.data.transformTo("json");
    assertEquals(jsonResult.ok, true);
    if (jsonResult.ok) {
      assertEquals(jsonResult.data.getFormat(), "json");
      const transformedData = jsonResult.data.getData();
      assertEquals(transformedData.title, "Test");
      assertEquals(transformedData.count, 42);
    }
  }
});

Deno.test("FrontmatterData - should not transform if same format", () => {
  const data = { title: "Test" };
  const result = FrontmatterData.createFromParsed(data, "yaml");

  if (result.ok) {
    const sameResult = result.data.transformTo("yaml");
    assertEquals(sameResult.ok, true);
    if (sameResult.ok) {
      assertEquals(sameResult.data, result.data); // Should be same instance
    }
  }
});

Deno.test("FrontmatterData - should have string representation", () => {
  const data = { field1: "value1", field2: "value2" };
  const result = FrontmatterData.createFromParsed(data, "yaml");

  if (result.ok) {
    assertEquals(result.data.toString(), "FrontmatterData(yaml, 2 fields)");
  }
});
