/**
 * Unit tests for DerivationRule value object
 *
 * Tests validation, creation, and behavior of DerivationRule
 * following DDD and Totality principles.
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { DerivationRule } from "./value-objects.ts";
import { SchemaExtensionRegistryFactory } from "../schema/factories/schema-extension-registry-factory.ts";

// Test helper function
function createTestRegistry() {
  const registryResult = SchemaExtensionRegistryFactory.createDefault();
  if (!registryResult.ok) {
    throw new Error(
      `Failed to create registry: ${registryResult.error.message}`,
    );
  }
  return registryResult.data;
}

describe("DerivationRule", () => {
  describe("create()", () => {
    describe("valid inputs", () => {
      it("should create rule with simple field name", () => {
        const result = DerivationRule.create("fieldName", "$.path");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.getTargetField(), "fieldName");
          assertEquals(result.data.getSourceExpression(), "$.path");
          assertEquals(result.data.isUnique(), false);
          assertEquals(result.data.shouldFlatten(), false);
        }
      });

      it("should create rule with nested field names using dot notation", () => {
        const testCases = [
          "config.tools",
          "tools.availableConfigs",
          "deeply.nested.field",
          "level1.level2.level3.level4",
        ];

        for (const fieldName of testCases) {
          const result = DerivationRule.create(fieldName, "$.data.path");
          assertEquals(
            result.ok,
            true,
            `Should accept field name: ${fieldName}`,
          );
          if (result.ok) {
            assertEquals(result.data.getTargetField(), fieldName);
          }
        }
      });

      it("should create rule with array notation in field names", () => {
        const testCases = [
          "items[]",
          "items[].field",
          "items[].nested.field",
          "parent.items[]",
          "parent.items[].child",
          "items[].nested[].deep",
        ];

        for (const fieldName of testCases) {
          const result = DerivationRule.create(fieldName, "$.data");
          assertEquals(
            result.ok,
            true,
            `Should accept field name with array notation: ${fieldName}`,
          );
          if (result.ok) {
            assertEquals(result.data.getTargetField(), fieldName);
          }
        }
      });

      it("should accept valid JSONPath expressions", () => {
        const validExpressions = [
          "$",
          "$.field",
          "$.nested.field",
          "$[0]",
          "$.array[0]",
          "$.array[*]",
          "$.items[].name",
          "$.data.items[*].value",
        ];

        for (const expr of validExpressions) {
          const result = DerivationRule.create("target", expr);
          assertEquals(result.ok, true, `Should accept JSONPath: ${expr}`);
          if (result.ok) {
            assertEquals(result.data.getSourceExpression(), expr);
          }
        }
      });

      it("should handle options correctly", () => {
        const result = DerivationRule.create("field", "$.path", {
          unique: true,
          flatten: true,
        });
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.isUnique(), true);
          assertEquals(result.data.shouldFlatten(), true);
        }
      });

      it("should trim whitespace from target field", () => {
        const result = DerivationRule.create("  fieldName  ", "$.path");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.getTargetField(), "fieldName");
        }
      });
    });

    describe("invalid inputs", () => {
      it("should reject empty target field", () => {
        const result = DerivationRule.create("", "$.path");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidTargetField");
          assertEquals(result.error.message, "Target field cannot be empty");
        }
      });

      it("should reject whitespace-only target field", () => {
        const result = DerivationRule.create("   ", "$.path");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidTargetField");
        }
      });

      it("should reject invalid field names", () => {
        const invalidNames = [
          "123invalid", // starts with number
          "invalid-name", // contains hyphen
          "invalid name", // contains space
          ".startWithDot", // starts with dot
          "endWithDot.", // ends with dot
          "double..dot", // consecutive dots
          "invalid.123.name", // segment starts with number
          "field.invalid-segment", // segment contains hyphen
          "field[", // incomplete array notation
          "field]", // incomplete array notation
          "field[0]", // indexed array notation not allowed
          "field[].", // ends with dot after array
          "[].field", // starts with array notation
        ];

        for (const fieldName of invalidNames) {
          const result = DerivationRule.create(fieldName, "$.path");
          assertEquals(
            result.ok,
            false,
            `Should reject field name: ${fieldName}`,
          );
          if (!result.ok) {
            assertEquals(result.error.kind, "InvalidTargetField");
          }
        }
      });

      it("should reject empty source expression", () => {
        const result = DerivationRule.create("field", "");
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidSourceExpression");
        }
      });

      it("should reject invalid JSONPath expressions", () => {
        const invalidExpressions = [
          // Note: "path" without $ is actually accepted as a property
          // Note: "$[]" is valid as an array iterator
          "$..double", // consecutive dots
          "$[abc]", // invalid array index
          "$.field!", // invalid character
          "$.field@value", // invalid character
          "$[ ]", // empty brackets with space
        ];

        for (const expr of invalidExpressions) {
          const result = DerivationRule.create("target", expr);
          assertEquals(result.ok, false, `Should reject JSONPath: ${expr}`);
          if (!result.ok) {
            assertEquals(result.error.kind, "InvalidSourceExpression");
          }
        }
      });
    });
  });

  describe("fromSchemaProperty()", () => {
    it("should return null when x-derived-from is not present", () => {
      const registry = createTestRegistry();
      const result = DerivationRule.fromSchemaProperty("field", {
        type: "string",
        description: "A regular field",
      }, registry);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, null);
      }
    });

    it("should create rule from schema property with x-derived-from", () => {
      const registry = createTestRegistry();
      const result = DerivationRule.fromSchemaProperty(
        "tools.availableConfigs",
        {
          type: "array",
          "x-derived-from": "$.configs[*].name",
          "x-derived-unique": true,
          "x-derived-flatten": false,
        },
        registry,
      );
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        if (result.data) {
          assertEquals(result.data.getTargetField(), "tools.availableConfigs");
          assertEquals(result.data.getSourceExpression(), "$.configs[*].name");
          assertEquals(result.data.isUnique(), true);
          assertEquals(result.data.shouldFlatten(), false);
        }
      }
    });

    it("should handle boolean options correctly", () => {
      const registry = createTestRegistry();
      const result = DerivationRule.fromSchemaProperty("field", {
        "x-derived-from": "$.source",
        "x-derived-unique": false,
        "x-derived-from-flatten": true,
      }, registry);
      assertEquals(result.ok, true);
      if (result.ok && result.data) {
        assertEquals(result.data.isUnique(), false);
        assertEquals(result.data.shouldFlatten(), true);
      }
    });

    it("should default to false for missing options", () => {
      const registry = createTestRegistry();
      const result = DerivationRule.fromSchemaProperty("field", {
        "x-derived-from": "$.source",
      }, registry);
      assertEquals(result.ok, true);
      if (result.ok && result.data) {
        assertEquals(result.data.isUnique(), false);
        assertEquals(result.data.shouldFlatten(), false);
      }
    });

    it("should handle non-string x-derived-from values", () => {
      const registry = createTestRegistry();
      const result = DerivationRule.fromSchemaProperty("field", {
        "x-derived-from": 123, // invalid type
      }, registry);
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, null);
      }
    });
  });

  describe("getSourceExpressionObject()", () => {
    it("should return JSONPathExpression object", () => {
      const result = DerivationRule.create("field", "$.path.to.data");
      assertEquals(result.ok, true);
      if (result.ok) {
        const exprObj = result.data.getSourceExpressionObject();
        assertExists(exprObj);
        assertEquals(exprObj.getExpression(), "$.path.to.data");
      }
    });
  });
});
