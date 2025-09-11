/**
 * Tests for Aggregation Value Objects
 */

import { assertEquals } from "@std/assert";
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
  describe("create", () => {
    it("should accept simple field names", () => {
      const result = DerivationRule.create("fieldName", "data");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getTargetField(), "fieldName");
        assertEquals(result.data.getSourceExpression(), "data");
      }
    });

    it("should accept field names with underscores and numbers", () => {
      const result = DerivationRule.create("field_name_123", "data");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getTargetField(), "field_name_123");
      }
    });

    it("should accept nested field paths with dot notation", () => {
      const result = DerivationRule.create(
        "tools.availableConfigs",
        "commands[].c1",
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getTargetField(), "tools.availableConfigs");
        assertEquals(result.data.getSourceExpression(), "commands[].c1");
      }
    });

    it("should accept deeply nested field paths", () => {
      const result = DerivationRule.create(
        "config.tools.availableConfigs",
        "commands[].c1",
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(
          result.data.getTargetField(),
          "config.tools.availableConfigs",
        );
      }
    });

    it("should reject empty field names", () => {
      const result = DerivationRule.create("", "$.data");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTargetField");
        assertEquals(result.error.message, "Target field cannot be empty");
      }
    });

    it("should reject field names starting with numbers", () => {
      const result = DerivationRule.create("123field", "data");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTargetField");
        assertEquals(
          result.error.message,
          "Invalid target field name: 123field",
        );
      }
    });

    it("should reject field names with invalid characters", () => {
      const result = DerivationRule.create("field-name", "data");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTargetField");
        assertEquals(
          result.error.message,
          "Invalid target field name: field-name",
        );
      }
    });

    it("should reject field paths with empty segments", () => {
      const result = DerivationRule.create("field..name", "data");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTargetField");
        assertEquals(
          result.error.message,
          "Invalid target field name: field..name",
        );
      }
    });

    it("should reject field paths starting with dot", () => {
      const result = DerivationRule.create(".fieldName", "data");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTargetField");
        assertEquals(
          result.error.message,
          "Invalid target field name: .fieldName",
        );
      }
    });

    it("should reject field paths ending with dot", () => {
      const result = DerivationRule.create("fieldName.", "data");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidTargetField");
        assertEquals(
          result.error.message,
          "Invalid target field name: fieldName.",
        );
      }
    });

    it("should trim whitespace from field names", () => {
      const result = DerivationRule.create("  fieldName  ", "data");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getTargetField(), "fieldName");
      }
    });

    it("should handle options correctly", () => {
      const result = DerivationRule.create("fieldName", "data", {
        unique: true,
        flatten: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.isUnique(), true);
        assertEquals(result.data.shouldFlatten(), true);
      }
    });

    it("should reject invalid source expressions", () => {
      const result = DerivationRule.create("fieldName", "");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSourceExpression");
      }
    });
  });

  describe("fromSchemaProperty", () => {
    it("should create rule from schema property with x-derived-from", () => {
      const schemaProperty = {
        "x-derived-from": "commands[].c1",
        "x-derived-unique": true,
        "x-derived-flatten": false,
      };

      const registry = createTestRegistry();
      const result = DerivationRule.fromSchemaProperty(
        "tools.availableConfigs",
        schemaProperty,
        registry,
      );

      assertEquals(result.ok, true);
      if (result.ok && result.data) {
        assertEquals(result.data.getTargetField(), "tools.availableConfigs");
        assertEquals(result.data.getSourceExpression(), "commands[].c1");
        assertEquals(result.data.isUnique(), true);
        assertEquals(result.data.shouldFlatten(), false);
      }
    });

    it("should return null when x-derived-from is not present", () => {
      const schemaProperty = {
        type: "array",
        items: { type: "string" },
      };

      const registry = createTestRegistry();
      const result = DerivationRule.fromSchemaProperty(
        "fieldName",
        schemaProperty,
        registry,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, null);
      }
    });

    it("should handle nested field paths from schema", () => {
      const schemaProperty = {
        "x-derived-from": "items[].metadata.tags",
        "x-derived-unique": true,
      };

      const registry = createTestRegistry();
      const result = DerivationRule.fromSchemaProperty(
        "config.settings.tags",
        schemaProperty,
        registry,
      );

      assertEquals(result.ok, true);
      if (result.ok && result.data) {
        assertEquals(result.data.getTargetField(), "config.settings.tags");
        assertEquals(
          result.data.getSourceExpression(),
          "items[].metadata.tags",
        );
        assertEquals(result.data.isUnique(), true);
        assertEquals(result.data.shouldFlatten(), false);
      }
    });
  });
});
