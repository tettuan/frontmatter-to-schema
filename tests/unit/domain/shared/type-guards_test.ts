/**
 * Tests for Type Guard Utilities
 *
 * Tests safe type checking functions following the Totality principle
 * with proper error handling using Result types.
 */

import { assertEquals } from "@std/assert";
import {
  asObjectRecord,
  getObjectProperty,
  getObjectPropertyAsObject,
  hasStringKeys,
  isObject,
  safeObjectTraversal,
  validateJsonParseResult,
  validateMappingResult,
  validateObjectArray,
} from "../../../../src/domain/shared/type-guards.ts";

Deno.test("isObject - correctly identifies objects", () => {
  // Valid objects
  assertEquals(isObject({}), true);
  assertEquals(isObject({ key: "value" }), true);
  assertEquals(isObject({ nested: { obj: true } }), true);
  assertEquals(isObject(Object.create(null)), true);

  // Invalid objects
  assertEquals(isObject(null), false);
  assertEquals(isObject(undefined), false);
  assertEquals(isObject([]), false);
  assertEquals(isObject([1, 2, 3]), false);
  assertEquals(isObject("string"), false);
  assertEquals(isObject(123), false);
  assertEquals(isObject(true), false);
  assertEquals(isObject(false), false);
  assertEquals(isObject(() => {}), false);
  assertEquals(isObject(Symbol("test")), false);
  assertEquals(isObject(new Date()), true); // Date is an object
  assertEquals(isObject(new Map()), true); // Map is an object
  assertEquals(isObject(new Set()), true); // Set is an object
});

Deno.test("asObjectRecord - converts unknown to Record with validation", () => {
  // Valid conversions
  const validObj = { key: "value", num: 42 };
  const result1 = asObjectRecord(validObj);
  assertEquals(result1.ok, true);
  if (result1.ok) {
    assertEquals(result1.data, validObj);
  }

  const emptyObj = {};
  const result2 = asObjectRecord(emptyObj);
  assertEquals(result2.ok, true);
  if (result2.ok) {
    assertEquals(result2.data, emptyObj);
  }

  // Invalid conversions
  const result3 = asObjectRecord(null);
  assertEquals(result3.ok, false);
  if (!result3.ok) {
    assertEquals(result3.error.kind, "InvalidFormat");
    // Cast to access message added by createDomainError
    const errorWithMessage = result3.error as
      & { message?: string }
      & typeof result3.error;
    assertEquals(
      errorWithMessage.message?.includes("Expected object but got"),
      true,
    );
  }

  const result4 = asObjectRecord("string", "test context");
  assertEquals(result4.ok, false);
  if (!result4.ok) {
    assertEquals(result4.error.kind, "InvalidFormat");
    const errorWithMessage = result4.error as
      & { message?: string }
      & typeof result4.error;
    assertEquals(errorWithMessage.message?.includes("test context"), true);
  }

  const result5 = asObjectRecord([1, 2, 3]);
  assertEquals(result5.ok, false);
  if (!result5.ok) {
    assertEquals(result5.error.kind, "InvalidFormat");
  }

  const result6 = asObjectRecord(undefined);
  assertEquals(result6.ok, false);
  if (!result6.ok) {
    assertEquals(result6.error.kind, "InvalidFormat");
  }
});

Deno.test("getObjectProperty - safely extracts properties", () => {
  const obj = {
    str: "value",
    num: 42,
    bool: true,
    nested: { key: "nested value" },
    nullValue: null,
    undefinedValue: undefined,
  };

  // Valid property access
  const result1 = getObjectProperty(obj, "str");
  assertEquals(result1.ok, true);
  if (result1.ok) {
    assertEquals(result1.data, "value");
  }

  const result2 = getObjectProperty(obj, "nested");
  assertEquals(result2.ok, true);
  if (result2.ok) {
    assertEquals(result2.data, { key: "nested value" });
  }

  const result3 = getObjectProperty(obj, "nullValue");
  assertEquals(result3.ok, true);
  if (result3.ok) {
    assertEquals(result3.data, null);
  }

  const result4 = getObjectProperty(obj, "undefinedValue");
  assertEquals(result4.ok, true);
  if (result4.ok) {
    assertEquals(result4.data, undefined);
  }

  // Invalid property access
  const result5 = getObjectProperty(obj, "nonExistent");
  assertEquals(result5.ok, false);
  if (!result5.ok) {
    assertEquals(result5.error.kind, "NotFound");
    const errorWithMessage = result5.error as
      & { message?: string }
      & typeof result5.error;
    assertEquals(
      errorWithMessage.message?.includes("Property 'nonExistent' not found"),
      true,
    );
  }

  const result6 = getObjectProperty(obj, "missing", "user object");
  assertEquals(result6.ok, false);
  if (!result6.ok) {
    assertEquals(result6.error.kind, "NotFound");
    const errorWithMessage = result6.error as
      & { message?: string }
      & typeof result6.error;
    assertEquals(errorWithMessage.message?.includes("user object"), true);
  }
});

Deno.test("getObjectPropertyAsObject - extracts and validates object properties", () => {
  const obj = {
    validObj: { key: "value", nested: { deep: true } },
    notAnObj: "string value",
    nullValue: null,
    arrayValue: [1, 2, 3],
  };

  // Valid object property
  const result1 = getObjectPropertyAsObject(obj, "validObj");
  assertEquals(result1.ok, true);
  if (result1.ok) {
    assertEquals(result1.data, { key: "value", nested: { deep: true } });
  }

  // Non-existent property
  const result2 = getObjectPropertyAsObject(obj, "missing");
  assertEquals(result2.ok, false);
  if (!result2.ok) {
    assertEquals(result2.error.kind, "NotFound");
  }

  // Property exists but not an object
  const result3 = getObjectPropertyAsObject(obj, "notAnObj");
  assertEquals(result3.ok, false);
  if (!result3.ok) {
    assertEquals(result3.error.kind, "InvalidFormat");
    const errorWithMessage = result3.error as
      & { message?: string }
      & typeof result3.error;
    assertEquals(errorWithMessage.message?.includes("object.notAnObj"), true);
  }

  const result4 = getObjectPropertyAsObject(obj, "nullValue");
  assertEquals(result4.ok, false);
  if (!result4.ok) {
    assertEquals(result4.error.kind, "InvalidFormat");
  }

  const result5 = getObjectPropertyAsObject(obj, "arrayValue");
  assertEquals(result5.ok, false);
  if (!result5.ok) {
    assertEquals(result5.error.kind, "InvalidFormat");
  }

  // With context
  const result6 = getObjectPropertyAsObject(obj, "notAnObj", "config");
  assertEquals(result6.ok, false);
  if (!result6.ok) {
    const errorWithMessage = result6.error as
      & { message?: string }
      & typeof result6.error;
    assertEquals(errorWithMessage.message?.includes("config.notAnObj"), true);
  }
});

Deno.test("validateMappingResult - validates template mapping results", () => {
  // Valid mapping results
  const result1 = validateMappingResult({ key: "value" });
  assertEquals(result1.ok, true);
  if (result1.ok) {
    assertEquals(result1.data, { key: "value" });
  }

  const result2 = validateMappingResult({});
  assertEquals(result2.ok, true);
  if (result2.ok) {
    assertEquals(result2.data, {});
  }

  const complexObj = {
    nested: { deep: { value: 42 } },
    array: [1, 2, 3],
    mixed: { arr: [{ obj: true }] },
  };
  const result3 = validateMappingResult(complexObj);
  assertEquals(result3.ok, true);
  if (result3.ok) {
    assertEquals(result3.data, complexObj);
  }

  // Invalid mapping results
  const result4 = validateMappingResult(null);
  assertEquals(result4.ok, false);
  if (!result4.ok) {
    assertEquals(result4.error.kind, "EmptyInput");
    const errorWithMessage = result4.error as
      & { message?: string }
      & typeof result4.error;
    assertEquals(
      errorWithMessage.message?.includes("cannot be null or undefined"),
      true,
    );
  }

  const result5 = validateMappingResult(undefined, "template");
  assertEquals(result5.ok, false);
  if (!result5.ok) {
    assertEquals(result5.error.kind, "EmptyInput");
    const error = result5.error as
      & { message?: string; field?: string }
      & typeof result5.error;
    assertEquals(error.field, "template");
    assertEquals(error.message?.includes("template"), true);
  }

  const result6 = validateMappingResult("string");
  assertEquals(result6.ok, false);
  if (!result6.ok) {
    assertEquals(result6.error.kind, "InvalidFormat");
  }

  const result7 = validateMappingResult([1, 2, 3]);
  assertEquals(result7.ok, false);
  if (!result7.ok) {
    assertEquals(result7.error.kind, "InvalidFormat");
  }
});

Deno.test("validateJsonParseResult - validates JSON parsing results", () => {
  // Valid JSON objects
  const result1 = validateJsonParseResult({ key: "value" });
  assertEquals(result1.ok, true);
  if (result1.ok) {
    assertEquals(result1.data, { key: "value" });
  }

  const result2 = validateJsonParseResult({});
  assertEquals(result2.ok, true);

  // Invalid - primitives
  const result3 = validateJsonParseResult("string");
  assertEquals(result3.ok, false);
  if (!result3.ok) {
    assertEquals(result3.error.kind, "InvalidFormat");
    const errorWithMessage = result3.error as
      & { message?: string }
      & typeof result3.error;
    assertEquals(
      errorWithMessage.message?.includes(
        "Expected JSON object but got primitive string",
      ),
      true,
    );
  }

  const result4 = validateJsonParseResult(123);
  assertEquals(result4.ok, false);
  if (!result4.ok) {
    assertEquals(result4.error.kind, "InvalidFormat");
    const errorWithMessage = result4.error as
      & { message?: string }
      & typeof result4.error;
    assertEquals(errorWithMessage.message?.includes("primitive number"), true);
  }

  const result5 = validateJsonParseResult(true, "config file");
  assertEquals(result5.ok, false);
  if (!result5.ok) {
    assertEquals(result5.error.kind, "InvalidFormat");
    const errorWithMessage = result5.error as
      & { message?: string }
      & typeof result5.error;
    assertEquals(errorWithMessage.message?.includes("config file"), true);
  }

  // Arrays are not valid JSON objects for this validator
  const result6 = validateJsonParseResult([1, 2, 3]);
  assertEquals(result6.ok, false);
  if (!result6.ok) {
    assertEquals(result6.error.kind, "InvalidFormat");
  }

  const result7 = validateJsonParseResult(null);
  assertEquals(result7.ok, false);
  if (!result7.ok) {
    assertEquals(result7.error.kind, "InvalidFormat");
  }
});

Deno.test("hasStringKeys - checks if value has string keys", () => {
  // Valid objects with string keys
  assertEquals(hasStringKeys({}), true);
  assertEquals(hasStringKeys({ a: 1, b: 2 }), true);
  assertEquals(hasStringKeys({ "string key": "value" }), true);
  assertEquals(hasStringKeys({ nested: { obj: true } }), true);
  assertEquals(hasStringKeys(Object.create(null)), true);

  // Invalid values
  assertEquals(hasStringKeys(null), false);
  assertEquals(hasStringKeys(undefined), false);
  assertEquals(hasStringKeys([]), false);
  assertEquals(hasStringKeys("string"), false);
  assertEquals(hasStringKeys(123), false);
  assertEquals(hasStringKeys(true), false);
  assertEquals(hasStringKeys(Symbol("test")), false);

  // Edge cases
  const obj = {};
  Object.defineProperty(obj, Symbol("sym"), {
    value: "test",
    enumerable: false,
  });
  assertEquals(hasStringKeys(obj), true); // Symbol keys don't show up in Object.keys
});

Deno.test("safeObjectTraversal - safely accesses nested properties", () => {
  const obj = {
    level1: {
      level2: {
        level3: {
          value: "deep value",
          number: 42,
        },
        array: [1, 2, 3],
      },
      empty: {},
    },
    top: "top level",
  };

  // Valid traversals
  const result1 = safeObjectTraversal(obj, [
    "level1",
    "level2",
    "level3",
    "value",
  ]);
  assertEquals(result1.ok, true);
  if (result1.ok) {
    assertEquals(result1.data, "deep value");
  }

  const result2 = safeObjectTraversal(obj, ["level1", "level2", "array"]);
  assertEquals(result2.ok, true);
  if (result2.ok) {
    assertEquals(result2.data, [1, 2, 3]);
  }

  const result3 = safeObjectTraversal(obj, ["top"]);
  assertEquals(result3.ok, true);
  if (result3.ok) {
    assertEquals(result3.data, "top level");
  }

  const result4 = safeObjectTraversal(obj, []);
  assertEquals(result4.ok, true);
  if (result4.ok) {
    assertEquals(result4.data, obj);
  }

  // Invalid traversals - non-existent path
  const result5 = safeObjectTraversal(obj, ["level1", "missing", "path"]);
  assertEquals(result5.ok, false);
  if (!result5.ok) {
    assertEquals(result5.error.kind, "InvalidFormat");
    const errorWithMessage = result5.error as
      & { message?: string }
      & typeof result5.error;
    assertEquals(
      errorWithMessage.message?.includes("Property 'missing' not found"),
      true,
    );
  }

  // Invalid traversal - trying to traverse through non-object
  const result6 = safeObjectTraversal(obj, ["top", "cantGoDeeper"]);
  assertEquals(result6.ok, false);
  if (!result6.ok) {
    assertEquals(result6.error.kind, "InvalidFormat");
    const errorWithMessage = result6.error as
      & { message?: string }
      & typeof result6.error;
    assertEquals(
      errorWithMessage.message?.includes("Expected object at path 'top'"),
      true,
    );
  }

  // Invalid traversal - starting with non-object
  const result7 = safeObjectTraversal("not an object", ["any", "path"]);
  assertEquals(result7.ok, false);
  if (!result7.ok) {
    assertEquals(result7.error.kind, "InvalidFormat");
  }

  // With context
  const result8 = safeObjectTraversal(obj, ["level1", "missing"], "config");
  assertEquals(result8.ok, false);
  if (!result8.ok) {
    const errorWithMessage = result8.error as
      & { message?: string }
      & typeof result8.error;
    assertEquals(errorWithMessage.message?.includes("config"), true);
  }

  // Edge case - null in path
  const objWithNull = { a: { b: null } };
  const result9 = safeObjectTraversal(objWithNull, ["a", "b", "c"]);
  assertEquals(result9.ok, false);
  if (!result9.ok) {
    assertEquals(result9.error.kind, "InvalidFormat");
    const errorWithMessage = result9.error as
      & { message?: string }
      & typeof result9.error;
    assertEquals(
      errorWithMessage.message?.includes("Expected object at path 'a.b'"),
      true,
    );
  }
});

Deno.test("validateObjectArray - validates arrays of objects", () => {
  // Valid arrays of objects
  const result1 = validateObjectArray([{ a: 1 }, { b: 2 }, { c: 3 }]);
  assertEquals(result1.ok, true);
  if (result1.ok) {
    assertEquals(result1.data.length, 3);
    assertEquals(result1.data[0], { a: 1 });
    assertEquals(result1.data[1], { b: 2 });
    assertEquals(result1.data[2], { c: 3 });
  }

  const result2 = validateObjectArray([]);
  assertEquals(result2.ok, true);
  if (result2.ok) {
    assertEquals(result2.data.length, 0);
  }

  const complexArray = [
    { nested: { value: 1 } },
    { array: [1, 2, 3] },
    {},
  ];
  const result3 = validateObjectArray(complexArray);
  assertEquals(result3.ok, true);
  if (result3.ok) {
    assertEquals(result3.data, complexArray);
  }

  // Invalid - not an array
  const result4 = validateObjectArray({ not: "array" });
  assertEquals(result4.ok, false);
  if (!result4.ok) {
    assertEquals(result4.error.kind, "InvalidFormat");
    const errorWithMessage = result4.error as
      & { message?: string }
      & typeof result4.error;
    assertEquals(
      errorWithMessage.message?.includes("Expected array but got object"),
      true,
    );
  }

  const result5 = validateObjectArray("string", "items");
  assertEquals(result5.ok, false);
  if (!result5.ok) {
    assertEquals(result5.error.kind, "InvalidFormat");
    const errorWithMessage = result5.error as
      & { message?: string }
      & typeof result5.error;
    assertEquals(errorWithMessage.message?.includes("items"), true);
  }

  // Invalid - array contains non-objects
  const result6 = validateObjectArray([{ valid: true }, "invalid", {
    valid: true,
  }]);
  assertEquals(result6.ok, false);
  if (!result6.ok) {
    assertEquals(result6.error.kind, "InvalidFormat");
    const errorWithMessage = result6.error as
      & { message?: string }
      & typeof result6.error;
    assertEquals(errorWithMessage.message?.includes("[1]"), true);
  }

  const result7 = validateObjectArray([{}, null, {}], "data");
  assertEquals(result7.ok, false);
  if (!result7.ok) {
    assertEquals(result7.error.kind, "InvalidFormat");
    const errorWithMessage = result7.error as
      & { message?: string }
      & typeof result7.error;
    assertEquals(errorWithMessage.message?.includes("data[1]"), true);
  }

  const result8 = validateObjectArray([{}, {}, [1, 2, 3]]);
  assertEquals(result8.ok, false);
  if (!result8.ok) {
    assertEquals(result8.error.kind, "InvalidFormat");
    const errorWithMessage = result8.error as
      & { message?: string }
      & typeof result8.error;
    assertEquals(errorWithMessage.message?.includes("[2]"), true);
  }

  // Invalid - primitives
  const result9 = validateObjectArray(null);
  assertEquals(result9.ok, false);
  if (!result9.ok) {
    assertEquals(result9.error.kind, "InvalidFormat");
  }

  const result10 = validateObjectArray(undefined);
  assertEquals(result10.ok, false);
  if (!result10.ok) {
    assertEquals(result10.error.kind, "InvalidFormat");
  }
});

Deno.test("edge cases - empty and special values", () => {
  // Empty object validation
  const emptyObj = {};
  assertEquals(isObject(emptyObj), true);
  assertEquals(hasStringKeys(emptyObj), true);

  const asObjResult = asObjectRecord(emptyObj);
  assertEquals(asObjResult.ok, true);

  // Object.create(null) - object without prototype
  const nullProto = Object.create(null);
  nullProto.key = "value";
  assertEquals(isObject(nullProto), true);
  assertEquals(hasStringKeys(nullProto), true);

  // Nested null/undefined values
  const withNulls = { a: null, b: undefined, c: { d: null } };
  const propNull = getObjectProperty(withNulls, "a");
  assertEquals(propNull.ok, true);
  if (propNull.ok) {
    assertEquals(propNull.data, null);
  }

  const propUndef = getObjectProperty(withNulls, "b");
  assertEquals(propUndef.ok, true);
  if (propUndef.ok) {
    assertEquals(propUndef.data, undefined);
  }

  // Deep nesting
  const deepObj = { a: { b: { c: { d: { e: { f: "deep" } } } } } };
  const deepResult = safeObjectTraversal(deepObj, [
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
  ]);
  assertEquals(deepResult.ok, true);
  if (deepResult.ok) {
    assertEquals(deepResult.data, "deep");
  }
});

Deno.test("error message formatting with context", () => {
  // asObjectRecord with context
  const result1 = asObjectRecord(null, "user.profile");
  assertEquals(result1.ok, false);
  if (!result1.ok) {
    const errorWithMessage = result1.error as
      & { message?: string }
      & typeof result1.error;
    assertEquals(errorWithMessage.message?.includes("user.profile"), true);
  }

  // getObjectProperty with context
  const result2 = getObjectProperty({}, "missing", "configuration");
  assertEquals(result2.ok, false);
  if (!result2.ok) {
    const errorWithMessage = result2.error as
      & { message?: string }
      & typeof result2.error;
    assertEquals(errorWithMessage.message?.includes("configuration"), true);
  }

  // getObjectPropertyAsObject with context
  const result3 = getObjectPropertyAsObject(
    { prop: "not object" },
    "prop",
    "settings",
  );
  assertEquals(result3.ok, false);
  if (!result3.ok) {
    const errorWithMessage = result3.error as
      & { message?: string }
      & typeof result3.error;
    assertEquals(errorWithMessage.message?.includes("settings.prop"), true);
  }

  // validateMappingResult with context
  const result4 = validateMappingResult(null, "response");
  assertEquals(result4.ok, false);
  if (!result4.ok) {
    const error = result4.error as
      & { message?: string; field?: string }
      & typeof result4.error;
    assertEquals(error.field, "response");
    assertEquals(error.message?.includes("response"), true);
  }

  // validateJsonParseResult with context
  const result5 = validateJsonParseResult("primitive", "API response");
  assertEquals(result5.ok, false);
  if (!result5.ok) {
    const errorWithMessage = result5.error as
      & { message?: string }
      & typeof result5.error;
    assertEquals(errorWithMessage.message?.includes("API response"), true);
  }

  // safeObjectTraversal with context
  const result6 = safeObjectTraversal(
    { a: "not object" },
    ["a", "b"],
    "data.structure",
  );
  assertEquals(result6.ok, false);
  if (!result6.ok) {
    const errorWithMessage = result6.error as
      & { message?: string }
      & typeof result6.error;
    assertEquals(errorWithMessage.message?.includes("data.structure"), true);
  }

  // validateObjectArray with context
  const result7 = validateObjectArray("not array", "items.list");
  assertEquals(result7.ok, false);
  if (!result7.ok) {
    const errorWithMessage = result7.error as
      & { message?: string }
      & typeof result7.error;
    assertEquals(errorWithMessage.message?.includes("items.list"), true);
  }
});
