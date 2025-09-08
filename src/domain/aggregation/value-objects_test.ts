import { assertEquals } from "@std/assert";
import { DerivationRule } from "./value-objects.ts";

Deno.test("DerivationRule - should accept simple field names", () => {
  const result = DerivationRule.create("fieldName", "$.path");
  if (!result.ok) {
    console.error("Failed to create DerivationRule:", result.error);
  }
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getTargetField(), "fieldName");
  }
});

Deno.test("DerivationRule - should accept nested field names with dot notation", () => {
  const testCases = [
    "config.tools",
    "deeply.nested.field",
    "level1.level2.level3.level4",
  ];

  for (const fieldName of testCases) {
    const result = DerivationRule.create(fieldName, "$.path");
    assertEquals(result.ok, true, `Should accept field name: ${fieldName}`);
    if (result.ok) {
      assertEquals(result.data.getTargetField(), fieldName);
    }
  }
});

Deno.test("DerivationRule - should reject invalid field names", () => {
  const invalidNames = [
    "",
    " ",
    "123invalid",
    "invalid-name",
    "invalid name",
    ".startWithDot",
    "endWithDot.",
    "double..dot",
    "invalid.123.name",
  ];

  for (const fieldName of invalidNames) {
    const result = DerivationRule.create(fieldName, "$.path");
    assertEquals(result.ok, false, `Should reject field name: ${fieldName}`);
  }
});

Deno.test("DerivationRule - should handle unique and flatten options", () => {
  const result = DerivationRule.create("config.tools", "$.tools[*].name", {
    unique: true,
    flatten: true,
  });

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getTargetField(), "config.tools");
    assertEquals(result.data.isUnique(), true);
    assertEquals(result.data.shouldFlatten(), true);
  }
});
