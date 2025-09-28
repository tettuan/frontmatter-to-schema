/**
 * @fileoverview Template Format Directive Handler Test Suite
 * @description Comprehensive tests for TemplateFormatDirectiveHandler
 * Following DDD, TDD, and Totality principles for robust directive testing
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  TemplateFormat,
  TemplateFormatDirectiveHandler,
} from "../../../../../src/domain/schema/handlers/template-format-directive-handler.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import type { LegacySchemaProperty } from "../../../../../src/domain/schema/interfaces/directive-handler.ts";

// Test fixtures
const createTestSchema = () => {
  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      title: { type: "string" },
      content: { type: "string" },
    },
  });
  const path = SchemaPath.create("test-schema.json");

  if (!definition.ok) throw new Error("Failed to create schema definition");
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

const createTestFrontmatterData = () => {
  return FrontmatterData.create({
    title: "Test Article",
    content: "Test content",
    author: "Test Author",
  });
};

describe("TemplateFormatDirectiveHandler", () => {
  describe("Constructor and Basic Properties", () => {
    it("should create handler with correct directive name and priority", () => {
      const handler = new TemplateFormatDirectiveHandler();

      assertEquals(handler.directiveName, "x-template-format");
      assertEquals(handler.getPriority(), 50);
    });

    it("should have correct dependencies", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const dependencies = handler.getDependencies();

      assertEquals(dependencies.includes("x-template"), true);
      assertEquals(dependencies.includes("x-template-items"), true);
    });
  });

  describe("Configuration Extraction", () => {
    it("should extract valid JSON format configuration", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": "json",
      };

      const result = handler.extractConfig(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.directiveName, "x-template-format");
        assertEquals(result.data.configuration.format, "json");
        assertEquals(result.data.isPresent, true);
      }
    });

    it("should extract valid YAML format configuration", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": "yaml",
      };

      const result = handler.extractConfig(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.configuration.format, "yaml");
        assertEquals(result.data.isPresent, true);
      }
    });

    it("should extract valid Markdown format configuration", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": "markdown",
      };

      const result = handler.extractConfig(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.configuration.format, "markdown");
        assertEquals(result.data.isPresent, true);
      }
    });

    it("should extract valid XML format configuration", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": "xml",
      };

      const result = handler.extractConfig(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.configuration.format, "xml");
        assertEquals(result.data.isPresent, true);
      }
    });

    it("should default to JSON when directive is not present", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {};

      const result = handler.extractConfig(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.configuration.format, "json");
        assertEquals(result.data.isPresent, false);
      }
    });

    it("should reject invalid format values", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": "invalid-format" as TemplateFormat,
      };

      const result = handler.extractConfig(schema);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ValidationError");
        assertEquals(result.error.directiveName, "x-template-format");
        assertEquals(
          result.error.message.includes("must be one of"),
          true,
        );
        if (result.error.kind === "ValidationError") {
          assertEquals(result.error.invalidValue, "invalid-format");
        }
      }
    });

    it("should reject non-string format values", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": 123 as unknown as TemplateFormat,
      };

      const result = handler.extractConfig(schema);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ValidationError");
        assertEquals(result.error.message.includes("must be one of"), true);
      }
    });

    it("should default to JSON for null format values", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": null as unknown as TemplateFormat,
      };

      const result = handler.extractConfig(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.configuration.format, "json");
        assertEquals(result.data.isPresent, false);
      }
    });
  });

  describe("Data Processing", () => {
    it("should process data with JSON format metadata", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const frontmatterDataResult = createTestFrontmatterData();
      const schemaResult = createTestSchema();

      assertEquals(frontmatterDataResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (frontmatterDataResult.ok && schemaResult.ok) {
        const configResult = handler.extractConfig({
          "x-template-format": "json",
        });
        assertEquals(configResult.ok, true);

        if (configResult.ok) {
          const processResult = handler.processData(
            frontmatterDataResult.data,
            configResult.data,
            schemaResult.data,
          );

          assertEquals(processResult.ok, true);
          if (processResult.ok) {
            assertEquals(processResult.data.directiveName, "x-template-format");
            assertEquals(processResult.data.metadata!.format, "json");
            assertEquals(processResult.data.metadata!.formatApplied, true);

            // Check that format metadata was added to data
            const processedData = processResult.data.processedData.getData();
            assertEquals(processedData["__template_format__"], "json");
          }
        }
      }
    });

    it("should process data with YAML format metadata", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const frontmatterDataResult = createTestFrontmatterData();
      const schemaResult = createTestSchema();

      assertEquals(frontmatterDataResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (frontmatterDataResult.ok && schemaResult.ok) {
        const configResult = handler.extractConfig({
          "x-template-format": "yaml",
        });

        if (configResult.ok) {
          const processResult = handler.processData(
            frontmatterDataResult.data,
            configResult.data,
            schemaResult.data,
          );

          assertEquals(processResult.ok, true);
          if (processResult.ok) {
            assertEquals(processResult.data.metadata!.format, "yaml");
            const processedData = processResult.data.processedData.getData();
            assertEquals(processedData["__template_format__"], "yaml");
          }
        }
      }
    });

    it("should preserve original data while adding format metadata", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const frontmatterDataResult = createTestFrontmatterData();
      const schemaResult = createTestSchema();

      assertEquals(frontmatterDataResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (frontmatterDataResult.ok && schemaResult.ok) {
        const configResult = handler.extractConfig({
          "x-template-format": "markdown",
        });

        if (configResult.ok) {
          const processResult = handler.processData(
            frontmatterDataResult.data,
            configResult.data,
            schemaResult.data,
          );

          assertEquals(processResult.ok, true);
          if (processResult.ok) {
            const processedData = processResult.data.processedData.getData();

            // Original data should be preserved
            assertEquals(processedData["title"], "Test Article");
            assertEquals(processedData["content"], "Test content");
            assertEquals(processedData["author"], "Test Author");

            // Format metadata should be added
            assertEquals(processedData["__template_format__"], "markdown");
          }
        }
      }
    });

    it("should handle processing without format directive", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const frontmatterDataResult = createTestFrontmatterData();
      const schemaResult = createTestSchema();

      assertEquals(frontmatterDataResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (frontmatterDataResult.ok && schemaResult.ok) {
        const configResult = handler.extractConfig({});

        if (configResult.ok) {
          const processResult = handler.processData(
            frontmatterDataResult.data,
            configResult.data,
            schemaResult.data,
          );

          assertEquals(processResult.ok, true);
          if (processResult.ok) {
            assertEquals(processResult.data.metadata!.format, "json");
            assertEquals(processResult.data.metadata!.formatApplied, false);

            // No format metadata should be added when not present
            const processedData = processResult.data.processedData.getData();
            assertEquals(processedData["__template_format__"], undefined);
          }
        }
      }
    });
  });

  describe("Extension Extraction", () => {
    it("should extract extension when directive is present", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": "yaml",
      };

      const result = handler.extractExtension(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data!.key, "x-template-format");
        assertEquals(result.data!.value, "yaml");
      }
    });

    it("should return null when directive is not present", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {};

      const result = handler.extractExtension(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, null);
      }
    });

    it("should extract extension with complex format", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schema: LegacySchemaProperty = {
        "x-template-format": "xml",
        "other-property": "value",
      };

      const result = handler.extractExtension(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data!.key, "x-template-format");
        assertEquals(result.data!.value, "xml");
      }
    });
  });

  describe("Static Methods", () => {
    it("should return correct formatter for JSON", () => {
      const formatter = TemplateFormatDirectiveHandler.getFormatterForFormat(
        "json",
      );
      assertEquals(formatter, "JsonFormatter");
    });

    it("should return correct formatter for YAML", () => {
      const formatter = TemplateFormatDirectiveHandler.getFormatterForFormat(
        "yaml",
      );
      assertEquals(formatter, "YamlFormatter");
    });

    it("should return correct formatter for Markdown", () => {
      const formatter = TemplateFormatDirectiveHandler.getFormatterForFormat(
        "markdown",
      );
      assertEquals(formatter, "MarkdownFormatter");
    });

    it("should return correct formatter for XML", () => {
      const formatter = TemplateFormatDirectiveHandler.getFormatterForFormat(
        "xml",
      );
      assertEquals(formatter, "XmlFormatter");
    });

    it("should return default formatter for invalid format", () => {
      const formatter = TemplateFormatDirectiveHandler.getFormatterForFormat(
        "invalid" as TemplateFormat,
      );
      assertEquals(formatter, "JsonFormatter");
    });
  });

  describe("Error Handling", () => {
    it("should handle FrontmatterData creation errors gracefully", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const schemaResult = createTestSchema();

      assertEquals(schemaResult.ok, true);

      if (schemaResult.ok) {
        // Create valid frontmatter data for testing
        const validFrontmatterData = FrontmatterData.create({
          title: "Valid Test Data",
        });

        if (validFrontmatterData.ok) {
          const configResult = handler.extractConfig({
            "x-template-format": "json",
          });

          if (configResult.ok) {
            const processResult = handler.processData(
              validFrontmatterData.data,
              configResult.data,
              schemaResult.data,
            );

            assertEquals(processResult.ok, true);
          }
        }
      }
    });
  });

  describe("Integration Scenarios", () => {
    it("should work correctly with complex schema structures", () => {
      const handler = new TemplateFormatDirectiveHandler();

      const complexSchema: LegacySchemaProperty = {
        "x-template": "# {{title}}\\n{{content}}",
        "x-template-format": "markdown",
        "x-template-items": "articles",
        "other-directives": "ignored",
      };

      const configResult = handler.extractConfig(complexSchema);
      assertEquals(configResult.ok, true);

      if (configResult.ok) {
        assertEquals(configResult.data.configuration.format, "markdown");
      }

      const extensionResult = handler.extractExtension(complexSchema);
      assertEquals(extensionResult.ok, true);

      if (extensionResult.ok) {
        assertExists(extensionResult.data);
        assertEquals(extensionResult.data!.value, "markdown");
      }
    });

    it("should handle all supported formats in sequence", () => {
      const handler = new TemplateFormatDirectiveHandler();
      const formats: TemplateFormat[] = ["json", "yaml", "markdown", "xml"];

      formats.forEach((format) => {
        const schema: LegacySchemaProperty = {
          "x-template-format": format,
        };

        const configResult = handler.extractConfig(schema);
        assertEquals(configResult.ok, true, `Failed for format: ${format}`);

        if (configResult.ok) {
          assertEquals(configResult.data.configuration.format, format);
          assertEquals(configResult.data.isPresent, true);
        }
      });
    });
  });

  describe("Type Safety and Validation", () => {
    it("should maintain type safety for TemplateFormat", () => {
      // Test that the type system prevents invalid assignments
      const validFormats: TemplateFormat[] = [
        "json",
        "yaml",
        "markdown",
        "xml",
      ];

      validFormats.forEach((format) => {
        const formatter = TemplateFormatDirectiveHandler.getFormatterForFormat(
          format,
        );
        assertExists(formatter);
        assertEquals(typeof formatter, "string");
      });
    });

    it("should validate configuration objects properly", () => {
      const handler = new TemplateFormatDirectiveHandler();

      // Test various edge cases for validation
      const testCases = [
        { input: undefined, expectValid: true }, // undefined defaults to JSON
        { input: "", expectValid: true }, // empty string defaults to JSON
        { input: "JSON", expectValid: false }, // Case sensitive
        { input: "json", expectValid: true },
        { input: "application/json", expectValid: false },
        { input: ["json"], expectValid: false }, // Array not allowed
        { input: { format: "json" }, expectValid: false }, // Object not allowed
      ];

      testCases.forEach(({ input, expectValid }) => {
        const schema: LegacySchemaProperty = {
          "x-template-format": input as TemplateFormat,
        };

        const result = handler.extractConfig(schema);
        assertEquals(
          result.ok,
          expectValid,
          `Expected ${expectValid} for input: ${JSON.stringify(input)}`,
        );
      });
    });
  });
});
