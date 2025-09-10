/**
 * VariableMap Value Object Tests
 *
 * Tests for VariableMap Smart Constructor and validation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  VariableMap,
  type VariableValue,
} from "../../../../src/domain/value-objects/variable-map.ts";

Deno.test("VariableMap - should create valid variable map from object", () => {
  const variables = {
    title: "Hello World",
    count: 42,
    enabled: true,
    items: ["a", "b", "c"],
    config: { debug: true, timeout: 5000 },
  };

  const result = VariableMap.create(variables);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.count(), 5);
    assertEquals(result.data.hasVariable("title"), true);
    assertEquals(result.data.hasVariable("count"), true);
    assertEquals(result.data.hasVariable("enabled"), true);
    assertEquals(result.data.hasVariable("items"), true);
    assertEquals(result.data.hasVariable("config"), true);
  }
});

Deno.test("VariableMap - should create valid variable map from Map", () => {
  const variables = new Map<string, VariableValue>([
    ["name", "John"],
    ["age", 30],
    ["active", true],
  ]);

  const result = VariableMap.create(variables);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.count(), 3);

    const nameResult = result.data.getValue("name");
    assertEquals(nameResult.ok, true);
    if (nameResult.ok) {
      assertEquals(nameResult.data, "John");
    }
  }
});

Deno.test("VariableMap - should create from variable info", () => {
  const variables = {
    title: {
      value: "Test Title",
      type: "string",
      required: true,
      description: "The page title",
    },
    count: {
      value: 10,
      type: "number",
      required: false,
      defaultValue: 0,
    },
  };

  const result = VariableMap.createFromInfo(variables);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.count(), 2);

    const titleInfo = result.data.getVariableInfo("title");
    assertEquals(titleInfo.ok, true);
    if (titleInfo.ok) {
      assertEquals(titleInfo.data.value, "Test Title");
      assertEquals(titleInfo.data.type, "string");
      assertEquals(titleInfo.data.required, true);
      assertEquals(titleInfo.data.description, "The page title");
    }
  }
});

Deno.test("VariableMap - should reject invalid variable names", () => {
  const invalidNames = [
    "",
    "   ",
    "123invalid",
    "invalid-name",
    "invalid.name",
    "invalid name",
    "a".repeat(101), // too long
  ];

  for (const name of invalidNames) {
    const result = VariableMap.create({ [name]: "value" });
    assertEquals(result.ok, false, `Should reject variable name: ${name}`);
  }
});

Deno.test("VariableMap - should accept valid variable names", () => {
  const validNames = [
    "validName",
    "valid_name",
    "_validName",
    "validName123",
    "a",
    "A",
    "_",
    "camelCase",
    "snake_case",
    "PascalCase",
  ];

  for (const name of validNames) {
    const result = VariableMap.create({ [name]: "value" });
    assertEquals(result.ok, true, `Should accept variable name: ${name}`);
  }
});

Deno.test("VariableMap - should reject circular references", () => {
  const circular: Record<string, unknown> = { name: "test" };
  circular.self = circular;

  const result = VariableMap.create(
    { circular } as Record<string, VariableValue>,
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "SerializationError");
  }
});

Deno.test("VariableMap - should handle null values", () => {
  const _variables = {
    nullValue: null,
    undefinedValue: undefined,
  };

  // Note: undefined is not a valid VariableValue, but null is
  const result = VariableMap.create({
    nullValue: null,
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    const nullResult = result.data.getValue("nullValue");
    assertEquals(nullResult.ok, true);
    if (nullResult.ok) {
      assertEquals(nullResult.data, null);
    }
  }
});

Deno.test("VariableMap - should get variable names", () => {
  const variables = {
    z_last: "last",
    a_first: "first",
    m_middle: "middle",
  };

  const result = VariableMap.create(variables);

  if (result.ok) {
    const names = result.data.getVariableNames();
    assertEquals(names, ["a_first", "m_middle", "z_last"]); // Should be sorted
  }
});

Deno.test("VariableMap - should handle missing variables", () => {
  const result = VariableMap.create({ existing: "value" });

  if (result.ok) {
    const valueResult = result.data.getValue("missing");
    assertEquals(valueResult.ok, false);
    if (!valueResult.ok) {
      assertEquals(valueResult.error.kind, "NotFound");
    }

    const infoResult = result.data.getVariableInfo("missing");
    assertEquals(infoResult.ok, false);
    if (!infoResult.ok) {
      assertEquals(infoResult.error.kind, "NotFound");
    }
  }
});

Deno.test("VariableMap - should filter by type", () => {
  const variables = {
    title: "string value",
    count: 42,
    active: true,
    tags: ["a", "b"],
    config: { key: "value" },
  };

  const result = VariableMap.create(variables);

  if (result.ok) {
    const stringVars = result.data.getVariablesByType("string");
    assertEquals(stringVars.length, 1);
    assertEquals(stringVars[0][0], "title");

    const numberVars = result.data.getVariablesByType("number");
    assertEquals(numberVars.length, 1);
    assertEquals(numberVars[0][0], "count");

    const arrayVars = result.data.getVariablesByType("array");
    assertEquals(arrayVars.length, 1);
    assertEquals(arrayVars[0][0], "tags");
  }
});

Deno.test("VariableMap - should filter required variables", () => {
  const variables = {
    required1: {
      value: "test1",
      type: "string",
      required: true,
    },
    optional1: {
      value: "test2",
      type: "string",
      required: false,
    },
    required2: {
      value: 42,
      type: "number",
      required: true,
    },
    defaultOptional: {
      value: "test3",
      type: "string",
      // required defaults to undefined (falsy)
    },
  };

  const result = VariableMap.createFromInfo(variables);

  if (result.ok) {
    const requiredVars = result.data.getRequiredVariables();
    assertEquals(requiredVars.length, 2);
    assertEquals(requiredVars[0][0], "required1");
    assertEquals(requiredVars[1][0], "required2");
  }
});

Deno.test("VariableMap - should convert to objects", () => {
  const variables = {
    title: "Test",
    count: 5,
  };

  const result = VariableMap.create(variables);

  if (result.ok) {
    const obj = result.data.toObject();
    assertEquals(obj, variables);

    const infoObj = result.data.toInfoObject();
    assertExists(infoObj.title);
    assertEquals(infoObj.title.value, "Test");
    assertEquals(infoObj.title.type, "string");
  }
});

Deno.test("VariableMap - should merge variable maps", () => {
  const vars1 = { a: "value1", b: "value2" };
  const vars2 = { c: "value3", d: "value4" };

  const result1 = VariableMap.create(vars1);
  const result2 = VariableMap.create(vars2);

  if (result1.ok && result2.ok) {
    const mergeResult = result1.data.merge(result2.data);
    assertEquals(mergeResult.ok, true);
    if (mergeResult.ok) {
      assertEquals(mergeResult.data.count(), 4);
      assertEquals(mergeResult.data.hasVariable("a"), true);
      assertEquals(mergeResult.data.hasVariable("c"), true);
    }
  }
});

Deno.test("VariableMap - should handle merge conflicts", () => {
  const vars1 = { a: "value1", b: "value2" };
  const vars2 = { a: "different", c: "value3" };

  const result1 = VariableMap.create(vars1);
  const result2 = VariableMap.create(vars2);

  if (result1.ok && result2.ok) {
    // Without overwrite, should fail
    const mergeResult = result1.data.merge(result2.data, false);
    assertEquals(mergeResult.ok, false);
    if (!mergeResult.ok) {
      assertEquals(mergeResult.error.kind, "InvalidFormat");
    }

    // With overwrite, should succeed
    const overwriteResult = result1.data.merge(result2.data, true);
    assertEquals(overwriteResult.ok, true);
    if (overwriteResult.ok) {
      const aValue = overwriteResult.data.getValue("a");
      if (aValue.ok) {
        assertEquals(aValue.data, "different");
      }
    }
  }
});

Deno.test("VariableMap - should filter variables", () => {
  const variables = {
    temp_var: "temporary",
    permanent_var: "permanent",
    another_temp: "temp",
    config: "setting",
  };

  const result = VariableMap.create(variables);

  if (result.ok) {
    const filteredResult = result.data.filter((name) => name.includes("temp"));
    assertEquals(filteredResult.ok, true);
    if (filteredResult.ok) {
      assertEquals(filteredResult.data.count(), 2);
      assertEquals(filteredResult.data.hasVariable("temp_var"), true);
      assertEquals(filteredResult.data.hasVariable("another_temp"), true);
      assertEquals(filteredResult.data.hasVariable("permanent_var"), false);
    }
  }
});

Deno.test("VariableMap - should transform variables", () => {
  const variables = {
    title: "hello",
    message: "world",
    count: 42,
  };

  const result = VariableMap.create(variables);

  if (result.ok) {
    const transformResult = result.data.transform((_name, value) => {
      if (typeof value === "string") {
        return value.toUpperCase();
      }
      return value;
    });

    assertEquals(transformResult.ok, true);
    if (transformResult.ok) {
      const titleValue = transformResult.data.getValue("title");
      if (titleValue.ok) {
        assertEquals(titleValue.data, "HELLO");
      }

      const countValue = transformResult.data.getValue("count");
      if (countValue.ok) {
        assertEquals(countValue.data, 42); // Unchanged
      }
    }
  }
});

Deno.test("VariableMap - should create empty map", () => {
  const empty = VariableMap.createEmpty();
  assertEquals(empty.isEmpty(), true);
  assertEquals(empty.count(), 0);
  assertEquals(empty.getVariableNames().length, 0);
});

Deno.test("VariableMap - should have string representation", () => {
  const variables = { a: 1, b: 2, c: 3 };
  const result = VariableMap.create(variables);

  if (result.ok) {
    assertEquals(result.data.toString(), "VariableMap(3 variables)");
  }

  const empty = VariableMap.createEmpty();
  assertEquals(empty.toString(), "VariableMap(0 variables)");
});
