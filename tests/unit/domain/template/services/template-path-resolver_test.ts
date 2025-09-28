import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { TemplatePathResolver } from "../../../../../src/domain/template/services/template-path-resolver.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { TEST_EXTENSIONS } from "../../../../helpers/test-extensions.ts";

/**
 * CRITICAL SPECIFICATION TEST: Template Path Resolution
 *
 * This test validates the core functionality of extracting and resolving
 * template paths (x-template and x-template-items) from schema files.
 *
 * Key Requirements Validated:
 * 1. Extract x-template from schema
 * 2. Extract x-template-items from schema (optional)
 * 3. Resolve relative paths correctly
 * 4. Handle missing template paths appropriately
 * 5. Prefer explicit configuration over schema values
 *
 * This ensures reliable template path resolution across the application.
 */
describe("TemplatePathResolver", () => {
  const resolver = new TemplatePathResolver();

  /**
   * Helper function to create a test schema
   */
  function createTestSchema(schemaData: Record<string, unknown>): Schema {
    const schemaPathResult = SchemaPath.create("/test/schema.json");
    const schemaDefResult = SchemaDefinition.create(schemaData);

    if (!schemaPathResult.ok || !schemaDefResult.ok) {
      throw new Error("Failed to create test schema");
    }

    const schemaResult = Schema.create(
      schemaPathResult.data,
      schemaDefResult.data,
    );
    if (!schemaResult.ok) {
      throw new Error("Failed to create test schema");
    }

    return schemaResult.data;
  }

  describe("resolveMainTemplatePath", () => {
    it("should resolve x-template from schema", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "template.json",
        "properties": {},
      });

      const config = {
        schemaPath: "/project/schema.json",
      };

      const result = resolver.resolveMainTemplatePath(schema, config);

      assertExists(result.ok, "Template path resolution should succeed");
      if (result.ok) {
        assertEquals(
          result.data,
          "/project/template.json",
          "Should resolve template relative to schema directory",
        );
      }
    });

    it("should resolve relative x-template paths", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "./templates/main.json",
        "properties": {},
      });

      const config = {
        schemaPath: "/project/schemas/schema.json",
      };

      const result = resolver.resolveMainTemplatePath(schema, config);

      assertExists(result.ok, "Relative path resolution should succeed");
      if (result.ok) {
        assertEquals(
          result.data,
          "/project/schemas/templates/main.json",
          "Should resolve relative path correctly",
        );
      }
    });

    it("should prefer explicit template path over schema", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "schema-template.json",
        "properties": {},
      });

      const config = {
        schemaPath: "/project/schema.json",
        explicitTemplatePath: "explicit-template.json",
      };

      const result = resolver.resolveMainTemplatePath(schema, config);

      assertExists(result.ok, "Explicit template should be used");
      if (result.ok) {
        assertEquals(
          result.data,
          "explicit-template.json",
          "Should prefer explicit over schema template",
        );
      }
    });

    it("should return error when no template is specified", () => {
      const schema = createTestSchema({
        "type": "object",
        "properties": {},
        // No x-template
      });

      const config = {
        schemaPath: "/project/schema.json",
        // No explicitTemplatePath
      };

      const result = resolver.resolveMainTemplatePath(schema, config);

      assertExists(!result.ok, "Should fail when no template specified");
      if (!result.ok) {
        assertEquals(result.error.kind, "TemplateNotDefined");
      }
    });

    it("should handle schema with no path separator", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "./template.json",
        "properties": {},
      });

      const config = {
        schemaPath: "schema.json", // No directory path
      };

      const result = resolver.resolveMainTemplatePath(schema, config);

      assertExists(result.ok, "Should handle schema without directory");
      if (result.ok) {
        assertEquals(
          result.data,
          "template.json",
          "Should resolve to filename only",
        );
      }
    });
  });

  describe("resolveItemsTemplatePath", () => {
    it("should resolve x-template-items from schema", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "main.json",
        [TEST_EXTENSIONS.TEMPLATE_ITEMS]: "items.json",
        "properties": {},
      });

      const config = {
        schemaPath: "/project/schema.json",
      };

      const result = resolver.resolveItemsTemplatePath(schema, config);

      assertExists(result.ok, "Items template resolution should succeed");
      if (result.ok) {
        assertEquals(
          result.data.kind,
          "defined",
          "Items template should be defined",
        );
        if (result.data.kind === "defined") {
          assertEquals(
            result.data.path,
            "/project/items.json",
            "Should resolve items template relative to schema directory",
          );
        }
      }
    });

    it("should resolve relative x-template-items paths", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "main.json",
        [TEST_EXTENSIONS.TEMPLATE_ITEMS]: "./templates/item.json",
        "properties": {},
      });

      const config = {
        schemaPath: "/project/schemas/schema.json",
      };

      const result = resolver.resolveItemsTemplatePath(schema, config);

      assertExists(
        result.ok,
        "Relative items template resolution should succeed",
      );
      if (result.ok) {
        assertEquals(
          result.data.kind,
          "defined",
          "Items template should be defined",
        );
        if (result.data.kind === "defined") {
          assertEquals(
            result.data.path,
            "/project/schemas/templates/item.json",
            "Should resolve relative items template path",
          );
        }
      }
    });

    it("should return undefined when x-template-items is not specified", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "main.json",
        "properties": {},
        // No x-template-items
      });

      const config = {
        schemaPath: "/project/schema.json",
      };

      const result = resolver.resolveItemsTemplatePath(schema, config);

      assertExists(result.ok, "Should succeed even without items template");
      if (result.ok) {
        assertEquals(
          result.data.kind,
          "not-defined",
          "Should return not-defined when not specified",
        );
      }
    });
  });

  describe("resolveTemplatePaths (combined)", () => {
    it("should resolve both template and items template paths", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "./templates/main.json",
        [TEST_EXTENSIONS.TEMPLATE_ITEMS]: "./templates/item.json",
        "properties": {},
      });

      const config = {
        schemaPath: "/project/schemas/schema.json",
      };

      const result = resolver.resolveTemplatePaths(schema, config);

      assertExists(result.ok, "Combined resolution should succeed");
      if (result.ok) {
        assertEquals(
          result.data.templatePath,
          "/project/schemas/templates/main.json",
          "Main template should be resolved",
        );
        assertEquals(
          result.data.itemsTemplatePath,
          "/project/schemas/templates/item.json",
          "Items template should be resolved",
        );
      }
    });

    it("should resolve only main template when items template is not specified", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "main.json",
        "properties": {},
      });

      const config = {
        schemaPath: "/project/schema.json",
      };

      const result = resolver.resolveTemplatePaths(schema, config);

      assertExists(result.ok, "Should succeed with only main template");
      if (result.ok) {
        assertEquals(
          result.data.templatePath,
          "/project/main.json",
          "Main template should be resolved relative to schema directory",
        );
        assertEquals(
          result.data.itemsTemplatePath,
          undefined,
          "Items template should be undefined",
        );
      }
    });

    it("should propagate main template resolution errors", () => {
      const schema = createTestSchema({
        "type": "object",
        "properties": {},
        // No templates
      });

      const config = {
        schemaPath: "/project/schema.json",
      };

      const result = resolver.resolveTemplatePaths(schema, config);

      assertExists(!result.ok, "Should fail when main template missing");
      if (!result.ok) {
        assertEquals(result.error.kind, "TemplateNotDefined");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle absolute template paths", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "/absolute/path/template.json",
        [TEST_EXTENSIONS.TEMPLATE_ITEMS]: "/absolute/path/items.json",
        "properties": {},
      });

      const config = {
        schemaPath: "/project/schema.json",
      };

      const result = resolver.resolveTemplatePaths(schema, config);

      assertExists(result.ok, "Should handle absolute paths");
      if (result.ok) {
        assertEquals(
          result.data.templatePath,
          "/absolute/path/template.json",
          "Absolute main template should be unchanged",
        );
        assertEquals(
          result.data.itemsTemplatePath,
          "/absolute/path/items.json",
          "Absolute items template should be unchanged",
        );
      }
    });

    it("should handle empty schema directory", () => {
      const schema = createTestSchema({
        "type": "object",
        [TEST_EXTENSIONS.TEMPLATE]: "./template.json",
        "properties": {},
      });

      const config = {
        schemaPath: "",
      };

      const result = resolver.resolveMainTemplatePath(schema, config);

      assertExists(result.ok, "Should handle empty schema path");
      if (result.ok) {
        assertEquals(
          result.data,
          "template.json",
          "Should resolve to filename",
        );
      }
    });
  });
});
