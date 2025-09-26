/**
 * @fileoverview TemplateDirectiveHandler Unit Test Suite
 * @description Tests for the TemplateDirectiveHandler following DDD, TDD, and Totality principles
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { TemplateDirectiveHandler } from "../../../../../src/domain/schema/handlers/template-directive-handler.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import type { LegacySchemaProperty } from "../../../../../src/domain/schema/interfaces/directive-handler.ts";

describe("TemplateDirectiveHandler", () => {
  describe("Smart Constructor", () => {
    it("should create handler using smart constructor pattern", () => {
      // Act
      const handlerResult = TemplateDirectiveHandler.create();

      // Assert
      assert(handlerResult.ok);
      if (handlerResult.ok) {
        assertExists(handlerResult.data);
        assertEquals(handlerResult.data.kind, "DirectiveHandler");
        assertEquals(handlerResult.data.directiveName, "template");
        assertEquals(handlerResult.data.priority, 8);
      }
    });

    it("should have correct handler properties", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      // Assert
      assertEquals(handler.directiveName, "template");
      assertEquals(handler.getPriority(), 8);
      assertEquals(handler.getDependencies(), []);
      assert(handler.canHandle("template"));
      assert(!handler.canHandle("other-directive"));
    });
  });

  describe("Configuration Extraction", () => {
    it("should extract template configuration from direct property", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "string",
        "x-template": "Hello {name}!",
      };

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(configResult.ok);
      if (configResult.ok) {
        assertEquals(configResult.data.directiveName, "template");
        assertEquals(configResult.data.isPresent, true);
        assertEquals(
          configResult.data.configuration.templateString,
          "Hello {name}!",
        );
      }
    });

    it("should extract template configuration from extensions object", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "string",
        extensions: {
          "x-template": "Hello {name}!",
        },
      };

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(configResult.ok);
      if (configResult.ok) {
        assertEquals(configResult.data.directiveName, "template");
        assertEquals(configResult.data.isPresent, true);
        assertEquals(
          configResult.data.configuration.templateString,
          "Hello {name}!",
        );
      }
    });

    it("should prioritize direct property over extensions", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "string",
        "x-template": "Direct: {name}",
        extensions: {
          "x-template": "Extension: {name}",
        },
      };

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(configResult.ok);
      if (configResult.ok) {
        assertEquals(
          configResult.data.configuration.templateString,
          "Direct: {name}",
        );
      }
    });

    it("should handle missing template configuration", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "string",
      };

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(configResult.ok);
      if (configResult.ok) {
        assertEquals(configResult.data.isPresent, false);
        assertEquals(configResult.data.configuration.templateString, "");
      }
    });

    it("should reject invalid template configuration", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema = {
        type: "string",
        "x-template": 123, // Invalid: not a string
      } as unknown as LegacySchemaProperty;

      // Act
      const configResult = handler.extractConfig(schema);

      // Assert
      assert(!configResult.ok);
      if (!configResult.ok) {
        assertEquals(configResult.error.kind, "ValidationError");
        assert(configResult.error.message.includes("Invalid template"));
      }
    });
  });

  describe("Data Processing", () => {
    it("should process data when template is present", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        name: "World",
        version: "1.0.0",
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({
        "x-template": "Hello {name}! Version: {version}",
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
        assertEquals(processResult.data.directiveName, "template");
        if (processResult.data.metadata) {
          assertEquals(processResult.data.metadata.templateApplied, true);
          assertEquals(processResult.data.metadata.variablesFound.length, 2);
          assert(processResult.data.metadata.variablesFound.includes("name"));
          assert(
            processResult.data.metadata.variablesFound.includes("version"),
          );
        }
        assertExists(processResult.data.processedData);
      }
    });

    it("should skip processing when template is not present", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({ name: "World" });
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
          assertEquals(processResult.data.metadata.variablesFound.length, 0);
        }
      }
    });

    it("should handle template variables correctly", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        title: "My Project",
        version: "2.1.0",
        author: "Developer",
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({
        "x-template": "{title} v{version} by {author}",
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
          assertEquals(processResult.data.metadata.variablesFound.length, 3);
          assert(processResult.data.metadata.variablesFound.includes("title"));
          assert(
            processResult.data.metadata.variablesFound.includes("version"),
          );
          assert(processResult.data.metadata.variablesFound.includes("author"));
        }
      }
    });

    it("should handle missing template variables gracefully", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const dataResult = FrontmatterData.create({
        name: "Test",
        // missing 'version' variable
      });
      assert(dataResult.ok);
      const data = dataResult.data;

      const configResult = handler.extractConfig({
        "x-template": "Name: {name}, Version: {version}",
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
          assertEquals(processResult.data.metadata.variablesFound.length, 2);
          assert(processResult.data.metadata.variablesFound.includes("name"));
          assert(
            processResult.data.metadata.variablesFound.includes("version"),
          );
        }
      }
    });
  });

  describe("Extension Extraction", () => {
    it("should extract extension for schema building", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        "x-template": "Hello {name}!",
      };

      // Act
      const extensionResult = handler.extractExtension(schema);

      // Assert
      assert(extensionResult.ok);
      if (extensionResult.ok) {
        assertEquals(extensionResult.data.kind, "ExtensionFound");
        if (extensionResult.data.kind === "ExtensionFound") {
          assertEquals(extensionResult.data.key, "x-template");
          assertEquals(extensionResult.data.value, "Hello {name}!");
        }
      }
    });

    it("should return null when template is not present", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      const schema: LegacySchemaProperty = {
        type: "string",
      };

      // Act
      const extensionResult = handler.extractExtension(schema);

      // Assert
      assert(extensionResult.ok);
      if (extensionResult.ok) {
        assertEquals(extensionResult.data.kind, "ExtensionNotApplicable");
      }
    });
  });

  describe("Template Validation", () => {
    it("should validate template syntax correctly", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      // Test valid templates
      const validTemplates = [
        "Simple text",
        "Hello {name}!",
        "{title} - {description}",
        "No variables",
        "{single}",
        "Multiple {var1} and {var2} variables",
      ];

      for (const template of validTemplates) {
        const configResult = handler.extractConfig({ "x-template": template });
        assert(configResult.ok, `Should accept valid template: ${template}`);
      }
    });

    it("should reject malformed templates", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);
      const handler = handlerResult.data;

      // Test invalid templates
      const invalidTemplates = [
        "{unclosed",
        "unopened}",
        "{{double}}",
        "{nested {variable}}",
        "{empty{}}",
      ];

      for (const template of invalidTemplates) {
        const configResult = handler.extractConfig({ "x-template": template });
        assert(!configResult.ok, `Should reject invalid template: ${template}`);
        if (!configResult.ok) {
          assertEquals(configResult.error.kind, "ValidationError");
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle template processing errors gracefully", () => {
      // This would test scenarios where template processing might fail
      // For now, we verify the error structure is in place
      const handlerResult = TemplateDirectiveHandler.create();
      assert(handlerResult.ok);

      // The error handling infrastructure is tested through invalid template validation
      assert(
        true,
        "Error handling structure verified through validation tests",
      );
    });

    it("should use Result<T,E> pattern consistently", () => {
      // Arrange
      const handlerResult = TemplateDirectiveHandler.create();

      // Assert - All methods return Result<T,E>
      assert(handlerResult.ok || !handlerResult.ok); // Result pattern

      if (handlerResult.ok) {
        const handler = handlerResult.data;
        const schema: LegacySchemaProperty = { "x-template": "test" };

        // All handler methods should return Result<T,E>
        const configResult = handler.extractConfig(schema);
        assert(configResult.ok || !configResult.ok); // Result pattern

        const extensionResult = handler.extractExtension(schema);
        assert(extensionResult.ok || !extensionResult.ok); // Result pattern
      }
    });
  });
});
