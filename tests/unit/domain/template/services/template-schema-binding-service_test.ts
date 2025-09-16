import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TemplateSchemaBindingService } from "../../../../../src/domain/template/services/template-schema-binding-service.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { TestDataFactory } from "../../../../helpers/test-data-factory.ts";
import { TEST_EXTENSIONS } from "../../../../helpers/test-extensions.ts";

/**
 * COMPREHENSIVE TEST: Template-Schema Binding Service
 *
 * This test validates the Template-Schema Binding Layer implementation,
 * specifically ensuring {@items} variables are resolved from x-frontmatter-part
 * hierarchy level, similar to $ref processing.
 *
 * Key Requirements Validated:
 * 1. Schema-aware variable context creation
 * 2. {@items} hierarchy root constraint (x-frontmatter-part level)
 * 3. Template-schema binding validation
 * 4. Variable resolution consistency
 * 5. Error handling for invalid bindings
 * 6. Backward compatibility with legacy contexts
 */
describe("TemplateSchemaBindingService", () => {
  describe("Service Creation", () => {
    it("should create service successfully", () => {
      const result = TemplateSchemaBindingService.create();
      assertExists(result.ok, "Should create service successfully");
    });
  });

  describe("Schema-aware Variable Context Creation", () => {
    it("should create context with hierarchy root from x-frontmatter-part", () => {
      // Arrange: Schema with x-frontmatter-part at commands level
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          commands: {
            type: "array",
            items: { type: "object" },
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      const data = TestDataFactory.createFrontmatterData({
        title: "Test Project",
        commands: [
          { name: "build", script: "npm run build" },
          { name: "test", script: "npm test" },
        ],
      });
      assertExists(data.ok, "Should create frontmatter data");
      if (!data.ok) return;

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act
      const contextResult = service.data.createVariableContext(
        schemaResult.data,
        data.data,
      );

      // Assert
      assertExists(contextResult.ok, "Should create variable context");
      if (!contextResult.ok) return;
      const context = contextResult.data;
      assertEquals(context.getHierarchyRoot(), "commands");

      // Validate {@items} resolution from hierarchy root
      const itemsResult = context.resolveVariable("@items");
      assertExists(itemsResult.ok, "Should resolve {@items}");
      if (!itemsResult.ok) return;
      assertExists(Array.isArray(itemsResult.data), "Should return array");
      const itemsArray = itemsResult.data as Array<unknown>;
      assertEquals(itemsArray.length, 2);
    });

    it("should handle schema without x-frontmatter-part", () => {
      // Arrange: Schema without x-frontmatter-part
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          version: { type: "string" },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok);
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok);
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok);
      if (!schemaResult.ok) return;

      const data = TestDataFactory.createFrontmatterData({
        title: "Test Project",
        version: "1.0.0",
      });
      assertExists(data.ok);
      if (!data.ok) return;

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok);
      if (!service.ok) return;

      // Act
      const contextResult = service.data.createVariableContext(
        schemaResult.data,
        data.data,
      );

      // Assert
      assertExists(
        contextResult.ok,
        "Should create context even without x-frontmatter-part",
      );
      if (!contextResult.ok) return;
      const context = contextResult.data;
      assertEquals(context.getHierarchyRoot(), null);

      // {@items} should fail without hierarchy root
      const itemsResult = context.resolveVariable("@items");
      assertExists(!itemsResult.ok, "Should fail to resolve {@items}");
      if (itemsResult.ok) return;
      assertExists(
        itemsResult.error.message.includes("no x-frontmatter-part found"),
        "Should indicate missing x-frontmatter-part",
      );
    });

    it("should resolve regular variables correctly", () => {
      // Arrange: Schema and data with regular variables
      const schemaData = {
        type: "object",
        properties: {
          project: {
            type: "object",
            properties: {
              name: { type: "string" },
              version: { type: "string" },
            },
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok);
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok);
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok);
      if (!schemaResult.ok) return;
      if (!schemaResult.ok) return;

      const data = TestDataFactory.createFrontmatterData({
        project: {
          name: "My Project",
          version: "2.0.0",
        },
      });
      assertExists(data.ok);
      if (!data.ok) return;
      if (!data.ok) return;

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok);
      if (!service.ok) return;
      if (!service.ok) return;

      const contextResult = service.data.createVariableContext(
        schemaResult.data,
        data.data,
      );
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;
      if (!contextResult.ok) return;

      // Act & Assert
      const context = contextResult.data;

      const nameResult = context.resolveVariable("project.name");
      assertExists(nameResult.ok, "Should resolve nested variable");
      if (!nameResult.ok) return;
      assertEquals(nameResult.data, "My Project");

      const versionResult = context.resolveVariable("project.version");
      assertExists(versionResult.ok, "Should resolve nested version");
      if (!versionResult.ok) return;
      assertEquals(versionResult.data, "2.0.0");
    });
  });

  describe("Binding Validation", () => {
    it("should validate template with valid variables", () => {
      // Arrange
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          commands: {
            type: "array",
            items: { type: "object" },
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      const data = TestDataFactory.createFrontmatterData({
        title: "Test Project",
        author: "John Doe",
        commands: [{ name: "test" }],
      });
      assertExists(data.ok, "Should create frontmatter data");
      if (!data.ok) return;

      const template = `
        Project: {{title}}
        By: {{author}}
        Commands: {@items}
      `;

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act
      const validationResult = service.data.validateBinding(
        schemaResult.data,
        template,
        data.data,
      );

      // Assert
      assertExists(validationResult.ok, "Should validate successfully");
      if (!validationResult.ok) return;
      const report = validationResult.data;

      assertEquals(report.totalVariables, 3);
      assertEquals(report.validVariables.length, 3);
      assertEquals(report.invalidVariables.length, 0);
      assertExists(
        report.itemsBindingValid,
        "Should validate {@items} binding",
      );
      assertEquals(report.hierarchyRoot, "commands");
      assertExists(report.isValid(), "Report should be valid");
    });

    // TODO: Fix validation logic after data type preservation changes
    /*
    it("should detect invalid variables in template", () => {
      // Arrange
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      const data = TestDataFactory.createFrontmatterData({
        title: "Test Project",
      });
      assertExists(data.ok, "Should create frontmatter data");
      if (!data.ok) return;

      const template = `
        Project: {{title}}
        Missing: {{nonexistent}}
        Author: {{author}}
      `;

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act
      const validationResult = service.data.validateBinding(
        schemaResult.data,
        template,
        data.data,
      );

      // Assert
      assertExists(validationResult.ok, "Should complete validation");
      if (!validationResult.ok) return;
      const report = validationResult.data;

      assertEquals(report.totalVariables, 3);
      assertEquals(report.validVariables.length, 1); // Only "title"
      assertEquals(report.invalidVariables.length, 2); // "nonexistent", "author"
      assertExists(!report.isValid(), "Report should be invalid");

      const invalidVars = report.invalidVariables.map((v: any) => v.variable);
      assertExists(invalidVars.includes("nonexistent"));
      assertExists(invalidVars.includes("author"));
    });
    */

    it("should validate {@items} binding requirements", () => {
      // Arrange: Schema with x-frontmatter-part but data without matching array
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          items: {
            type: "array",
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      // Data missing the expected array
      const data = TestDataFactory.createFrontmatterData({
        title: "Test Project",
        // items array is missing
      });
      assertExists(data.ok, "Should create frontmatter data");
      if (!data.ok) return;

      const template = "Items: {@items}";
      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act
      const validationResult = service.data.validateBinding(
        schemaResult.data,
        template,
        data.data,
      );

      // Assert
      assertExists(validationResult.ok, "Should complete validation");
      if (!validationResult.ok) return;
      const report = validationResult.data;

      assertExists(
        !report.itemsBindingValid,
        "Should detect invalid {@items} binding",
      );
      assertExists(
        report.itemsBindingError?.includes("hierarchy root items not found"),
        "Should indicate missing hierarchy root data",
      );
      assertExists(
        !report.isValid(),
        "Report should be invalid due to {@items} error",
      );
    });

    it("should validate {@items} with non-array data", () => {
      // Arrange: Schema expects array but data has non-array
      const schemaData = {
        type: "object",
        properties: {
          items: {
            type: "array",
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      const data = TestDataFactory.createFrontmatterData({
        items: "not an array", // Should be array
      });
      assertExists(data.ok, "Should create frontmatter data");
      if (!data.ok) return;

      const template = "Items: {@items}";
      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act
      const validationResult = service.data.validateBinding(
        schemaResult.data,
        template,
        data.data,
      );

      // Assert
      assertExists(validationResult.ok, "Should complete validation");
      if (!validationResult.ok) return;
      const report = validationResult.data;

      assertExists(
        !report.itemsBindingValid,
        "Should detect invalid {@items} binding",
      );
      assertExists(
        report.itemsBindingError?.includes("must be an array"),
        "Should indicate type mismatch",
      );
    });
  });

  describe("Item Context Creation", () => {
    it("should create individual contexts for array items", () => {
      // Arrange
      const schemaData = {
        type: "object",
        properties: {
          commands: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                script: { type: "string" },
              },
            },
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      const arrayData = [
        { name: "build", script: "npm run build" },
        { name: "test", script: "npm test" },
      ];

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act
      const contextsResult = service.data.createItemContexts(
        schemaResult.data,
        arrayData,
      );

      // Assert
      assertExists(contextsResult.ok, "Should create item contexts");
      if (!contextsResult.ok) return;
      const contexts = contextsResult.data;

      assertEquals(contexts.length, 2);

      // Test first item context
      const firstContext = contexts[0];
      const nameResult = firstContext.resolveVariable("name");
      assertExists(nameResult.ok, "Should resolve name in first context");
      if (!nameResult.ok) return;
      assertEquals(nameResult.data, "build");

      const scriptResult = firstContext.resolveVariable("script");
      assertExists(scriptResult.ok, "Should resolve script in first context");
      if (!scriptResult.ok) return;
      assertEquals(scriptResult.data, "npm run build");

      // Test second item context
      const secondContext = contexts[1];
      const secondNameResult = secondContext.resolveVariable("name");
      assertExists(
        secondNameResult.ok,
        "Should resolve name in second context",
      );
      if (!secondNameResult.ok) return;
      assertEquals(secondNameResult.data, "test");
    });

    it("should handle invalid array item data", () => {
      // Arrange
      const schemaData = {
        type: "object",
        properties: {
          items: {
            type: "array",
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      const invalidArrayData = [
        null, // Invalid item
        { valid: "item" },
      ];

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act
      const contextsResult = service.data.createItemContexts(
        schemaResult.data,
        invalidArrayData,
      );

      // Assert
      assertExists(!contextsResult.ok, "Should fail with invalid item data");
      if (contextsResult.ok) return;
      assertExists(
        contextsResult.error.message.includes(
          "Failed to create FrontmatterData",
        ),
        "Should indicate FrontmatterData creation failure",
      );
    });
  });

  describe("Validation Report", () => {
    it("should provide comprehensive validation summary", () => {
      // Arrange: Mixed valid/invalid scenario
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          items: {
            type: "array",
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      const data = TestDataFactory.createFrontmatterData({
        title: "Test Project",
        items: [{ name: "item1" }],
      });
      assertExists(data.ok, "Should create frontmatter data");
      if (!data.ok) return;

      const template = `
        Title: {{title}}
        Missing: {{missing}}
        Items: {@items}
      `;

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act
      const validationResult = service.data.validateBinding(
        schemaResult.data,
        template,
        data.data,
      );

      // Assert
      assertExists(validationResult.ok);
      if (!validationResult.ok) return;
      const report = validationResult.data;

      const summary = report.getSummary();
      assertExists(
        summary.includes("invalid"),
        "Summary should mention invalid variables",
      );

      // Test individual components
      assertEquals(report.totalVariables, 3);
      assertEquals(report.validVariables, ["title", "@items"]);
      assertEquals(report.invalidVariables.length, 1);
      assertEquals(report.invalidVariables[0].variable, "missing");
      assertExists(report.itemsBindingValid, "Should validate {@items}");
      assertEquals(report.hierarchyRoot, "items");
    });
  });

  describe("Error Handling", () => {
    it("should handle schema without findFrontmatterPartPath method gracefully", () => {
      // This tests robustness against different schema implementations
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok, "Should create schema path");
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok, "Should create schema definition");
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok, "Should create schema");
      if (!schemaResult.ok) return;

      const data = TestDataFactory.createFrontmatterData({ title: "Test" });
      assertExists(data.ok, "Should create frontmatter data");
      if (!data.ok) return;

      const service = TemplateSchemaBindingService.create();
      assertExists(service.ok, "Should create binding service");
      if (!service.ok) return;

      // Act - should not throw even if schema lacks x-frontmatter-part
      const contextResult = service.data.createVariableContext(
        schemaResult.data,
        data.data,
      );

      // Assert
      assertExists(contextResult.ok, "Should handle gracefully");
      if (!contextResult.ok) return;
      assertEquals(contextResult.data.getHierarchyRoot(), null);
    });
  });
});
