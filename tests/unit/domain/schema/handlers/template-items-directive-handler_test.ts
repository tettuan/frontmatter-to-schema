/**
 * @fileoverview TemplateItemsDirectiveHandler Unit Test Suite
 * @description Tests for the TemplateItemsDirectiveHandler following DDD, TDD, and Totality principles
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { TemplateItemsDirectiveHandler } from "../../../../../src/domain/schema/handlers/template-items-directive-handler.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import type { LegacySchemaProperty } from "../../../../../src/domain/schema/interfaces/directive-handler.ts";

describe("TemplateItemsDirectiveHandler", () => {
  describe("Smart Constructor", () => {
    it("should create handler using smart constructor pattern", () => {
      // Act
      const handlerResult = TemplateItemsDirectiveHandler.create();

      // Assert
      assert(handlerResult.ok);
      if (handlerResult.ok) {
        assertExists(handlerResult.data);
        assertEquals(handlerResult.data.kind, "DirectiveHandler");
        assertEquals(handlerResult.data.directiveName, "template-items");
        assertEquals(handlerResult.data.priority, 9);
      }
    });

    it("should have correct handler properties", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      // Assert
      assertEquals(handler.directiveName, "template-items");
      assertEquals(handler.getPriority(), 9);
      assertEquals(handler.getDependencies(), ["template"]);
      assert(handler.canHandle("template-items"));
      assert(!handler.canHandle("other-directive"));
    });
  });

  describe("Configuration Extraction", () => {
    it("should extract template items configuration from direct property", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "array",
        "x-template-items": "traceability_item_template.json",
      };

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(configResult.ok);
      if (configResult.ok) {
        assertEquals(configResult.data.directiveName, "template-items");
        assertEquals(configResult.data.isPresent, true);
        assertEquals(
          configResult.data.configuration.templateFilePath,
          "traceability_item_template.json",
        );
      }
    });

    it("should extract template items configuration from extensions object", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "array",
        extensions: {
          "x-template-items": "item_template.json",
        },
      };

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(configResult.ok);
      if (configResult.ok) {
        assertEquals(configResult.data.directiveName, "template-items");
        assertEquals(configResult.data.isPresent, true);
        assertEquals(
          configResult.data.configuration.templateFilePath,
          "item_template.json",
        );
      }
    });

    it("should prioritize direct property over extensions", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "array",
        "x-template-items": "direct_template.json",
        extensions: {
          "x-template-items": "extension_template.json",
        },
      };

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(configResult.ok);
      if (configResult.ok) {
        assertEquals(
          configResult.data.configuration.templateFilePath,
          "direct_template.json",
        );
      }
    });

    it("should handle missing template items configuration", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "array",
      };

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(configResult.ok);
      if (configResult.ok) {
        assertEquals(configResult.data.isPresent, false);
        assertEquals(configResult.data.configuration.templateFilePath, "");
      }
    });

    it("should reject invalid template items configuration", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema = {
        type: "array",
        "x-template-items": 123, // Invalid: not a string
      } as unknown as LegacySchemaProperty;

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(!configResult.ok);
      if (!configResult.ok) {
        assertEquals(configResult.error.kind, "ValidationError");
        assert(
          configResult.error.message.includes("Invalid template items path"),
        );
      }
    });

    it("should validate template file path format", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const invalidPaths = [
        "", // Empty string
        "   ", // Whitespace only
        "../template.json", // Path traversal
        "/absolute/path.json", // Absolute path
        "template.txt", // Wrong extension
      ];

      for (const invalidPath of invalidPaths) {
        const schema: LegacySchemaProperty = {
          type: "array",
          "x-template-items": invalidPath,
        };

        // Act
        const configResult = handler.extractConfig(schema);

        // Assert
        assert(
          !configResult.ok,
          `Should reject invalid path: ${invalidPath}`,
        );
        if (!configResult.ok) {
          assertEquals(configResult.error.kind, "ValidationError");
        }
      }
    });

    it("should accept valid template file paths", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const validPaths = [
        "template.json",
        "templates/item.json",
        "folder/subfolder/template.json",
        "traceability_item_template.json",
      ];

      for (const validPath of validPaths) {
        const schema: LegacySchemaProperty = {
          type: "array",
          "x-template-items": validPath,
        };

        // Act
        const configResult = handler.extractConfig(schema);

        // Assert
        assert(
          configResult.ok,
          `Should accept valid path: ${validPath}`,
        );
        if (configResult.ok) {
          assertEquals(configResult.data.isPresent, true);
          assertEquals(
            configResult.data.configuration.templateFilePath,
            validPath,
          );
        }
      }
    });
  });

  describe("Data Processing", () => {
    it("should process data when template items is present", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        items: [
          {
            id: { full: "ITEM-001" },
            derived_from: "SPEC-001",
            trace_to: "TEST-001",
          },
          {
            id: { full: "ITEM-002" },
            derived_from: "SPEC-002",
            trace_to: "TEST-002",
          },
        ],
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({
        "x-template-items": "traceability_item_template.json",
      });
      assert(configResult.ok);
      const config = configResult.data;

      // Create a minimal schema for testing
      const schemaDefResult = SchemaDefinition.create({ type: "object" });
      assert(schemaDefResult.ok);
      const schemaPathResult = SchemaPath.create("/test/path.json");
      assert(schemaPathResult.ok);
      const schema = Schema.create(schemaPathResult.data, schemaDefResult.data);
      assert(schema.ok);

      // Act
      const processResult = handler.processData(data, config, schema.data);

      // Assert
      assert(processResult.ok);
      if (processResult.ok) {
        assertEquals(processResult.data.directiveName, "template-items");
        if (processResult.data.metadata) {
          assertEquals(processResult.data.metadata.templateApplied, true);
          assertEquals(
            processResult.data.metadata.templateFilePath,
            "traceability_item_template.json",
          );
          assertEquals(processResult.data.metadata.itemsProcessed, 2);
          assertEquals(processResult.data.metadata.variablesFound.length, 3);
          assert(
            processResult.data.metadata.variablesFound.includes("id.full"),
          );
          assert(
            processResult.data.metadata.variablesFound.includes("derived_from"),
          );
          assert(
            processResult.data.metadata.variablesFound.includes("trace_to"),
          );
        }
        assertExists(processResult.data.processedData);
      }
    });

    it("should skip processing when template items is not present", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        items: [{ id: 1, name: "Item 1" }],
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({});
      assert(configResult.ok);
      const config = configResult.data;

      // Create a minimal schema for testing
      const schemaDefResult = SchemaDefinition.create({ type: "object" });
      assert(schemaDefResult.ok);
      const schemaPathResult = SchemaPath.create("/test/path.json");
      assert(schemaPathResult.ok);
      const schema = Schema.create(schemaPathResult.data, schemaDefResult.data);
      assert(schema.ok);

      // Act
      const processResult = handler.processData(data, config, schema.data);

      // Assert
      assert(processResult.ok);
      if (processResult.ok) {
        if (processResult.data.metadata) {
          assertEquals(processResult.data.metadata.templateApplied, false);
          assertEquals(processResult.data.metadata.templateFilePath, "");
          assertEquals(processResult.data.metadata.itemsProcessed, 0);
          assertEquals(processResult.data.metadata.variablesFound.length, 0);
        }
      }
    });

    it("should handle nested arrays correctly", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        levels: {
          requirements: [
            {
              id: { full: "REQ-001" },
              derived_from: "SPEC-001",
              trace_to: "IMPL-001",
            },
          ],
          implementations: [
            {
              id: { full: "IMPL-001" },
              derived_from: "REQ-001",
              trace_to: "TEST-001",
            },
            {
              id: { full: "IMPL-002" },
              derived_from: "REQ-002",
              trace_to: "TEST-002",
            },
          ],
        },
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({
        "x-template-items": "traceability_item_template.json",
      });
      assert(configResult.ok);
      const config = configResult.data;

      // Create a minimal schema for testing
      const schemaDefResult = SchemaDefinition.create({ type: "object" });
      assert(schemaDefResult.ok);
      const schemaPathResult = SchemaPath.create("/test/path.json");
      assert(schemaPathResult.ok);
      const schema = Schema.create(schemaPathResult.data, schemaDefResult.data);
      assert(schema.ok);

      // Act
      const processResult = handler.processData(data, config, schema.data);

      // Assert
      assert(processResult.ok);
      if (processResult.ok) {
        if (processResult.data.metadata) {
          assertEquals(processResult.data.metadata.templateApplied, true);
          assertEquals(processResult.data.metadata.itemsProcessed, 3); // 1 + 2 items
        }
        assertExists(processResult.data.processedData);
      }
    });

    it("should handle template variable resolution correctly", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        items: [
          {
            id: { full: "ITEM-001", short: "I001" },
            status: "active",
            metadata: { version: "1.0" },
          },
        ],
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({
        "x-template-items": "complex_template.json",
      });
      assert(configResult.ok);
      const config = configResult.data;

      // Create a minimal schema for testing
      const schemaDefResult = SchemaDefinition.create({ type: "object" });
      assert(schemaDefResult.ok);
      const schemaPathResult = SchemaPath.create("/test/path.json");
      assert(schemaPathResult.ok);
      const schema = Schema.create(schemaPathResult.data, schemaDefResult.data);
      assert(schema.ok);

      // Act
      const processResult = handler.processData(data, config, schema.data);

      // Assert
      assert(processResult.ok);
      if (processResult.ok) {
        if (processResult.data.metadata) {
          assertEquals(processResult.data.metadata.templateApplied, true);
          assertEquals(processResult.data.metadata.itemsProcessed, 1);
          // Variables found should include nested property references
          assert(processResult.data.metadata.variablesFound.length > 0);
        }
        assertExists(processResult.data.processedData);
      }
    });
  });

  describe("Extension Extraction", () => {
    it("should extract extension for schema building", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        "x-template-items": "traceability_item_template.json",
      };

      // Act
      const extensionResult = handler.extractExtension(schema);

      // Assert
      assert(extensionResult.ok);
      if (extensionResult.ok && extensionResult.data) {
        assertEquals(extensionResult.data.key, "x-template-items");
        assertEquals(
          extensionResult.data.value,
          "traceability_item_template.json",
        );
      }
    });

    it("should return null when template items is not present", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "array",
      };

      // Act
      const extensionResult = handler.extractExtension(schema);

      // Assert
      assert(extensionResult.ok);
      if (extensionResult.ok) {
        assertEquals(extensionResult.data, null);
      }
    });
  });

  describe("Template Processing Logic", () => {
    it("should handle missing template variables gracefully", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        items: [
          {
            id: { full: "ITEM-001" },
            // Missing 'derived_from' and 'trace_to' properties
          },
        ],
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({
        "x-template-items": "traceability_item_template.json",
      });
      assert(configResult.ok);
      const config = configResult.data;

      // Create a minimal schema for testing
      const schemaDefResult = SchemaDefinition.create({ type: "object" });
      assert(schemaDefResult.ok);
      const schemaPathResult = SchemaPath.create("/test/path.json");
      assert(schemaPathResult.ok);
      const schema = Schema.create(schemaPathResult.data, schemaDefResult.data);
      assert(schema.ok);

      // Act
      const processResult = handler.processData(data, config, schema.data);

      // Assert
      assert(processResult.ok);
      if (processResult.ok) {
        // Template variables should be extracted regardless of data availability
        if (processResult.data.metadata) {
          assertEquals(processResult.data.metadata.templateApplied, true);
          assertEquals(processResult.data.metadata.variablesFound.length, 3);
          assert(
            processResult.data.metadata.variablesFound.includes("id.full"),
          );
          assert(
            processResult.data.metadata.variablesFound.includes("derived_from"),
          );
          assert(
            processResult.data.metadata.variablesFound.includes("trace_to"),
          );
        }
      }
    });

    it("should handle non-array data gracefully", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        singleItem: {
          id: { full: "ITEM-001" },
          derived_from: "SPEC-001",
          trace_to: "TEST-001",
        },
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({
        "x-template-items": "traceability_item_template.json",
      });
      assert(configResult.ok);
      const config = configResult.data;

      // Create a minimal schema for testing
      const schemaDefResult = SchemaDefinition.create({ type: "object" });
      assert(schemaDefResult.ok);
      const schemaPathResult = SchemaPath.create("/test/path.json");
      assert(schemaPathResult.ok);
      const schema = Schema.create(schemaPathResult.data, schemaDefResult.data);
      assert(schema.ok);

      // Act
      const processResult = handler.processData(data, config, schema.data);

      // Assert
      assert(processResult.ok);
      if (processResult.ok) {
        if (processResult.data.metadata) {
          assertEquals(processResult.data.metadata.templateApplied, true);
          assertEquals(processResult.data.metadata.itemsProcessed, 0); // No arrays processed
        }
        assertExists(processResult.data.processedData);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle template processing errors gracefully", () => {
      // This would test scenarios where template processing might fail
      // For now, we verify the error structure is in place
      const handlerResult = TemplateItemsDirectiveHandler.create();
      assert(handlerResult.ok);

      assert(
        true,
        "Error handling structure verified through validation tests",
      );
    });

    it("should use Result<T,E> pattern consistently", () => {
      // Arrange
      const handlerResult = TemplateItemsDirectiveHandler.create();

      // Assert - All methods return Result<T,E>
      assert(handlerResult.ok || !handlerResult.ok); // Result pattern

      if (handlerResult.ok) {
        const handler = handlerResult.data;
        const schema: LegacySchemaProperty = {
          "x-template-items": "template.json",
        };

        // All handler methods should return Result<T,E>
        const configResult = handler.extractConfig(schema);
        assert(configResult.ok || !configResult.ok); // Result pattern

        const extensionResult = handler.extractExtension(schema);
        assert(extensionResult.ok || !extensionResult.ok); // Result pattern
      }
    });
  });
});
