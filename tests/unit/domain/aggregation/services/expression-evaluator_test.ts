import { assert, assertEquals } from "@std/assert";
import { ExpressionEvaluator } from "../../../../../src/domain/aggregation/services/expression-evaluator.ts";
import { TestDataFactory } from "../../../../helpers/test-data-factory.ts";

Deno.test("ExpressionEvaluator - should evaluate simple array expression", () => {
  const evaluator = new ExpressionEvaluator();

  const data1 = TestDataFactory.createFrontmatterData({
    commands: ["build", "test", "deploy"],
  });

  const data2 = TestDataFactory.createFrontmatterData({
    commands: ["lint", "format"],
  });

  assert(data1.ok && data2.ok);

  const result = evaluator.evaluate([data1.data, data2.data], "commands[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, ["build", "test", "deploy", "lint", "format"]);
  }
});

Deno.test("ExpressionEvaluator - should evaluate array with property access", () => {
  const evaluator = new ExpressionEvaluator();

  const data1 = TestDataFactory.createFrontmatterData({
    commands: [
      { name: "build", type: "script" },
      { name: "test", type: "script" },
    ],
  });

  const data2 = TestDataFactory.createFrontmatterData({
    commands: [
      { name: "lint", type: "check" },
    ],
  });

  assert(data1.ok && data2.ok);

  const result = evaluator.evaluate(
    [data1.data, data2.data],
    "commands[].name",
  );
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, ["build", "test", "lint"]);
  }
});

Deno.test("ExpressionEvaluator - should handle missing array path", () => {
  const evaluator = new ExpressionEvaluator();

  const data = TestDataFactory.createFrontmatterData({
    other: "value",
  });

  assert(data.ok);

  const result = evaluator.evaluate([data.data], "commands[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, []); // Should return empty array when path doesn't exist
  }
});

Deno.test("ExpressionEvaluator - should handle non-array values", () => {
  const evaluator = new ExpressionEvaluator();

  const data = TestDataFactory.createFrontmatterData({
    commands: "not-an-array",
  });

  assert(data.ok);

  const result = evaluator.evaluate([data.data], "commands[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, []); // Should skip non-array values
  }
});

Deno.test("ExpressionEvaluator - should reject expression without array notation", () => {
  const evaluator = new ExpressionEvaluator();

  const data = TestDataFactory.createFrontmatterData({
    name: "test",
  });

  assert(data.ok);

  const result = evaluator.evaluate([data.data], "name");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidExpression");
    assert(result.error.message.includes("array notation []"));
  }
});

Deno.test("ExpressionEvaluator - should reject expression with multiple array notations", () => {
  const evaluator = new ExpressionEvaluator();

  const data = TestDataFactory.createFrontmatterData({
    nested: [[1, 2], [3, 4]],
  });

  assert(data.ok);

  const result = evaluator.evaluate([data.data], "nested[][].value");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidExpression");
    assert(result.error.message.includes("exactly one array notation"));
  }
});

Deno.test("ExpressionEvaluator - should handle complex nested objects", () => {
  const evaluator = new ExpressionEvaluator();

  const data = TestDataFactory.createFrontmatterData({
    items: [
      { metadata: { category: "script", priority: 1 } },
      { metadata: { category: "test", priority: 2 } },
    ],
  });

  assert(data.ok);

  const result = evaluator.evaluate([data.data], "items[].metadata");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, [
      { category: "script", priority: 1 },
      { category: "test", priority: 2 },
    ]);
  }
});

Deno.test("ExpressionEvaluator - should handle empty arrays", () => {
  const evaluator = new ExpressionEvaluator();

  const data1 = TestDataFactory.createFrontmatterData({
    commands: [],
  });

  const data2 = TestDataFactory.createFrontmatterData({
    commands: ["build"],
  });

  assert(data1.ok && data2.ok);

  const result = evaluator.evaluate([data1.data, data2.data], "commands[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, ["build"]);
  }
});

Deno.test("ExpressionEvaluator - evaluateUnique should remove duplicates", () => {
  const evaluator = new ExpressionEvaluator();

  const data1 = TestDataFactory.createFrontmatterData({
    tags: ["javascript", "deno", "javascript"],
  });

  const data2 = TestDataFactory.createFrontmatterData({
    tags: ["deno", "typescript"],
  });

  assert(data1.ok && data2.ok);

  const result = evaluator.evaluateUnique([data1.data, data2.data], "tags[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data.sort(), ["deno", "javascript", "typescript"]);
  }
});

Deno.test("ExpressionEvaluator - evaluateUnique should handle object duplicates", () => {
  const evaluator = new ExpressionEvaluator();

  const data1 = TestDataFactory.createFrontmatterData({
    items: [
      { name: "build", type: "script" },
      { name: "test", type: "script" },
    ],
  });

  const data2 = TestDataFactory.createFrontmatterData({
    items: [
      { name: "build", type: "script" }, // Duplicate
      { name: "lint", type: "check" },
    ],
  });

  assert(data1.ok && data2.ok);

  const result = evaluator.evaluateUnique([data1.data, data2.data], "items[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data.length, 3); // Should have 3 unique items
    // Should contain build, test, lint (build appears only once)
    const names = result.data.map((item: any) => item.name).sort();
    assertEquals(names, ["build", "lint", "test"]);
  }
});

Deno.test("ExpressionEvaluator - evaluatePath should resolve simple path", () => {
  const evaluator = new ExpressionEvaluator();

  const data = {
    user: {
      name: "John",
      age: 30,
    },
  };

  const result = evaluator.evaluatePath(data, "user.name");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, "John");
  }
});

Deno.test("ExpressionEvaluator - evaluatePath should handle array notation", () => {
  const evaluator = new ExpressionEvaluator();

  const data = {
    items: [1, 2, 3],
  };

  const result = evaluator.evaluatePath(data, "items.[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, [1, 2, 3]);
  }
});

Deno.test("ExpressionEvaluator - evaluatePath should return error for non-existent path", () => {
  const evaluator = new ExpressionEvaluator();

  const data = {
    user: { name: "John" },
  };

  const result = evaluator.evaluatePath(data, "user.age.invalid");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "PathNotFound");
  }
});

Deno.test("ExpressionEvaluator - evaluatePath should handle null/undefined values", () => {
  const evaluator = new ExpressionEvaluator();

  const data = {
    user: null,
  };

  const result = evaluator.evaluatePath(data, "user.name");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "PathNotFound");
  }
});

Deno.test("ExpressionEvaluator - evaluatePath should handle primitive values in path", () => {
  const evaluator = new ExpressionEvaluator();

  const data = {
    count: 42,
  };

  const result = evaluator.evaluatePath(data, "count.invalid");
  assert(!result.ok);

  if (!result.ok) {
    assertEquals(result.error.kind, "PathNotFound");
  }
});

Deno.test("ExpressionEvaluator - should handle root-level array from object", () => {
  const evaluator = new ExpressionEvaluator();

  // FrontmatterData requires an object, so we need to wrap the array
  const data = TestDataFactory.createFrontmatterData({
    rootItems: ["item1", "item2", "item3"],
  });

  assert(data.ok);

  const result = evaluator.evaluate([data.data], "rootItems[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, ["item1", "item2", "item3"]);
  }
});

Deno.test("ExpressionEvaluator - should handle nested property access with undefined values", () => {
  const evaluator = new ExpressionEvaluator();

  const data = TestDataFactory.createFrontmatterData({
    items: [
      { name: "valid", metadata: { type: "script" } },
      { name: "incomplete" }, // Missing metadata
      { metadata: { type: "test" } }, // Missing name
    ],
  });

  assert(data.ok);

  const result = evaluator.evaluate([data.data], "items[].metadata");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, [
      { type: "script" },
      { type: "test" },
    ]); // Should skip items without metadata
  }
});

Deno.test("ExpressionEvaluator - should handle mixed data types in arrays", () => {
  const evaluator = new ExpressionEvaluator();

  const data = TestDataFactory.createFrontmatterData({
    mixed: [
      "string",
      42,
      { name: "object" },
      null,
      true,
    ],
  });

  assert(data.ok);

  const result = evaluator.evaluate([data.data], "mixed[]");
  assert(result.ok);

  if (result.ok) {
    assertEquals(result.data, ["string", 42, { name: "object" }, null, true]);
  }
});
