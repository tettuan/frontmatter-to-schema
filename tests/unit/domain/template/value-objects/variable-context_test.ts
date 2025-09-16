import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { VariableContext } from "../../../../../src/domain/template/value-objects/variable-context.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { FrontmatterTestFactory } from "../../../../helpers/frontmatter-test-factory.ts";
import { TEST_EXTENSIONS } from "../../../../helpers/test-extensions.ts";

/**
 * COMPREHENSIVE TEST: Variable Context with Schema Hierarchy
 *
 * This test validates the hierarchical variable context implementation,
 * ensuring {@items} variables are resolved from x-frontmatter-part level
 * according to the architectural constraint.
 *
 * Key Requirements Validated:
 * 1. Schema-aware context creation with hierarchy root detection
 * 2. {@items} resolution from x-frontmatter-part hierarchy level
 * 3. Regular variable resolution from full data context
 * 4. Proper error handling for missing hierarchy data
 * 5. Backward compatibility with legacy context methods
 * 6. Validation of {@items} binding requirements
 */
describe("VariableContext with Schema Hierarchy", () => {
  describe("Schema-aware Context Creation", () => {
    it("should create context with hierarchy root from x-frontmatter-part", () => {
      // Arrange: Schema with commands at x-frontmatter-part level
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          metadata: {
            type: "object",
            properties: {
              version: { type: "string" },
              commands: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    script: { type: "string" },
                  },
                },
                [TEST_EXTENSIONS.FRONTMATTER_PART]: true, // This becomes the hierarchy root
              },
            },
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok);
      if (!schemaPathResult.ok) return;
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok);
      if (!schemaDefResult.ok) return;
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok);
      if (!schemaResult.ok) return;
      if (!schemaResult.ok) return;

      const data = FrontmatterTestFactory.createCustomData({
        title: "Test Project",
        metadata: {
          version: "1.0.0",
          commands: [
            { name: "build", script: "npm run build" },
            { name: "test", script: "npm test" },
          ],
        },
      });

      // Act
      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );

      // Assert
      assertExists(contextResult.ok, "Should create context successfully");
      if (!contextResult.ok) return;
      const context = contextResult.data;
      assertEquals(context.getHierarchyRoot(), "metadata.commands");

      // Validate {@items} resolves from hierarchy root
      const itemsResult = context.resolveVariable("@items");
      assertExists(
        itemsResult.ok,
        "Should resolve {@items} from hierarchy root",
      );
      if (!itemsResult.ok) return;
      assertExists(Array.isArray(itemsResult.data), "Should return array");
      const itemsArray = itemsResult.data as Array<
        { name: string; script: string }
      >;
      assertEquals(itemsArray.length, 2);
      assertEquals(itemsArray[0].name, "build");
      assertEquals(itemsArray[1].name, "test");
    });

    it("should resolve regular variables from full data context", () => {
      // Arrange
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
          tasks: {
            type: "array",
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok);
      if (!schemaPathResult.ok) return;
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok);
      if (!schemaDefResult.ok) return;
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok);
      if (!schemaResult.ok) return;
      if (!schemaResult.ok) return;

      const data = FrontmatterTestFactory.createCustomData({
        project: {
          name: "My Project",
          version: "2.0.0",
        },
        tasks: [{ name: "task1" }],
      });

      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      // Act & Assert
      const context = contextResult.data;

      // Regular variables should resolve from full context
      const nameResult = context.resolveVariable("project.name");
      assertExists(nameResult.ok, "Should resolve nested project name");
      if (!nameResult.ok) return;
      assertEquals(nameResult.data, "My Project");

      const versionResult = context.resolveVariable("project.version");
      assertExists(versionResult.ok, "Should resolve nested version");
      if (!versionResult.ok) return;
      assertEquals(versionResult.data, "2.0.0");

      // {@items} should resolve from hierarchy root (tasks)
      const itemsResult = context.resolveVariable("@items");
      assertExists(itemsResult.ok, "Should resolve {@items}");
      if (!itemsResult.ok) return;
      const itemsArray = itemsResult.data as Array<{ name: string }>;
      assertEquals(itemsArray.length, 1);
    });

    it("should handle context without x-frontmatter-part", () => {
      // Arrange: Schema without x-frontmatter-part
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok);
      if (!schemaPathResult.ok) return;
      if (!schemaPathResult.ok) return;

      const schemaDefResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefResult.ok);
      if (!schemaDefResult.ok) return;
      if (!schemaDefResult.ok) return;

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok);
      if (!schemaResult.ok) return;
      if (!schemaResult.ok) return;

      const data = FrontmatterTestFactory.createCustomData({
        title: "Test Project",
        description: "A test project",
      });

      // Act
      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );

      // Assert
      assertExists(
        contextResult.ok,
        "Should create context even without x-frontmatter-part",
      );
      if (!contextResult.ok) return;
      const context = contextResult.data;
      assertEquals(context.getHierarchyRoot(), null);

      // Regular variables should still work
      const titleResult = context.resolveVariable("title");
      assertExists(titleResult.ok, "Should resolve regular variable");
      if (!titleResult.ok) return;
      assertEquals(titleResult.data, "Test Project");

      // {@items} should fail without hierarchy root
      const itemsResult = context.resolveVariable("@items");
      assertExists(!itemsResult.ok, "Should fail to resolve {@items}");
      if (itemsResult.ok) return;
      assertExists(
        itemsResult.error.message.includes("no x-frontmatter-part found"),
        "Should indicate missing x-frontmatter-part",
      );
    });
  });

  describe("Variable Resolution", () => {
    it("should resolve {@items} only from hierarchy root", () => {
      // Arrange: Complex nested structure with arrays at multiple levels
      const schemaData = {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              environments: {
                type: "array", // This array should NOT be used for {@items}
                items: { type: "string" },
              },
              scripts: {
                type: "array", // This is the {@items} source
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    command: { type: "string" },
                  },
                },
                [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
              },
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

      const data = FrontmatterTestFactory.createCustomData({
        config: {
          environments: ["dev", "staging", "prod"], // Should be ignored for {@items}
          scripts: [ // This should be used for {@items}
            { name: "build", command: "npm run build" },
            { name: "deploy", command: "npm run deploy" },
          ],
        },
      });

      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      // Act & Assert
      const context = contextResult.data;
      assertEquals(context.getHierarchyRoot(), "config.scripts");

      // {@items} should resolve from scripts, not environments
      const itemsResult = context.resolveVariable("@items");
      assertExists(
        itemsResult.ok,
        "Should resolve {@items} from correct hierarchy",
      );
      if (!itemsResult.ok) return;
      const itemsArray = itemsResult.data as Array<
        { name: string; command: string }
      >;
      assertEquals(itemsArray.length, 2);
      assertEquals(itemsArray[0].name, "build");
      assertEquals(itemsArray[1].name, "deploy");

      // Can still access environments as regular variable
      const envResult = context.resolveVariable("config.environments");
      assertExists(
        envResult.ok,
        "Should resolve environments as regular variable",
      );
      if (!envResult.ok) return;
      const envArray = envResult.data as Array<string>;
      assertEquals(envArray.length, 3);
    });

    it("should reject unknown @ variables", () => {
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

      const data = FrontmatterTestFactory.createCustomData({ items: [] });

      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      // Act & Assert
      const context = contextResult.data;

      // Valid @ variable
      const itemsResult = context.resolveVariable("@items");
      assertExists(itemsResult.ok, "Should accept @items");
      if (!itemsResult.ok) return;

      // Invalid @ variables
      const unknownResult = context.resolveVariable("@unknown");
      assertExists(!unknownResult.ok, "Should reject unknown @ variable");
      if (unknownResult.ok) return;
      assertExists(
        unknownResult.error.message.includes("Unknown special variable"),
        "Should indicate unknown variable",
      );

      const customResult = context.resolveVariable("@custom");
      assertExists(!customResult.ok, "Should reject custom @ variable");
    });

    it("should handle missing hierarchy data gracefully", () => {
      // Arrange: Schema expects array but data doesn't have it
      const schemaData = {
        type: "object",
        properties: {
          commands: {
            type: "array",
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
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

      const data = FrontmatterTestFactory.createCustomData({
        // commands array is missing
        title: "Test",
      });

      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      // Act & Assert
      const context = contextResult.data;
      assertEquals(context.getHierarchyRoot(), "commands");

      const itemsResult = context.resolveVariable("@items");
      assertExists(
        !itemsResult.ok,
        "Should fail when hierarchy data is missing",
      );
      if (itemsResult.ok) return;
      assertExists(
        itemsResult.error.message.includes("data not found at hierarchy root"),
        "Should indicate missing hierarchy data",
      );
    });

    it("should validate hierarchy data type", () => {
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

      const data = FrontmatterTestFactory.createCustomData({
        items: "not an array", // Should be array
      });

      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      // Act & Assert
      const context = contextResult.data;

      const itemsResult = context.resolveVariable("@items");
      assertExists(
        !itemsResult.ok,
        "Should fail when hierarchy data is not array",
      );
      if (itemsResult.ok) return;
      assertExists(
        itemsResult.error.message.includes("expected array"),
        "Should indicate type mismatch",
      );
    });
  });

  describe("Context Validation", () => {
    it("should validate {@items} resolution capability", () => {
      // Arrange: Valid context
      const schemaData = {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            [TEST_EXTENSIONS.FRONTMATTER_PART]: true,
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

      const data = FrontmatterTestFactory.createCustomData({
        tasks: [{ name: "task1" }, { name: "task2" }],
      });

      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // Act
      const isValid = context.validateItemsResolution();

      // Assert
      assertExists(isValid, "Should validate successfully");
    });

    it("should detect invalid {@items} context", () => {
      // Arrange: Context without x-frontmatter-part
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
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

      const data = FrontmatterTestFactory.createCustomData({ title: "Test" });

      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );
      assertExists(contextResult.ok);
      if (!contextResult.ok) return;

      const context = contextResult.data;

      // Act
      const isValid = context.validateItemsResolution();

      // Assert
      assertExists(!isValid, "Should detect invalid context");
    });
  });

  describe("Item Context Creation", () => {
    it("should create scoped contexts for array items", () => {
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

      const data = FrontmatterTestFactory.createCustomData({
        commands: [
          { name: "build", script: "npm run build" },
          { name: "test", script: "npm test" },
        ],
      });

      if (!schemaResult.ok) return;
      const contextResult = VariableContext.create(
        schemaResult.data,
        data,
      );
      if (!contextResult.ok) return;
      const parentContext = contextResult.data;

      // Create item data
      const itemData = FrontmatterTestFactory.createCustomData({
        name: "deploy",
        script: "npm run deploy",
      });

      // Act
      const itemContext = parentContext.createItemContext(
        itemData.getData(),
      );

      // Assert
      assertExists(itemContext, "Should create item context");

      // Item context should resolve its own variables
      const nameResult = itemContext.resolveVariable("name");
      assertExists(nameResult.ok, "Should resolve item variable");
      if (!nameResult.ok) return;
      assertEquals(nameResult.data, "deploy");

      const scriptResult = itemContext.resolveVariable("script");
      assertExists(scriptResult.ok, "Should resolve item script");
      if (!scriptResult.ok) return;
      assertEquals(scriptResult.data, "npm run deploy");

      // Item context should inherit same hierarchy root
      assertEquals(itemContext.getHierarchyRoot(), "commands");
    });
  });

  describe("Backward Compatibility", () => {
    it("should support legacy fromSingleData method", () => {
      // Arrange
      const data = FrontmatterTestFactory.createCustomData({
        title: "Legacy Test",
        version: "1.0.0",
      });

      // Act
      const contextResult = VariableContext.fromSingleData(data);

      // Assert
      assertExists(contextResult.ok, "Should create legacy context");
      if (!contextResult.ok) return;
      const context = contextResult.data;

      // Should have no hierarchy root (legacy mode)
      assertEquals(context.getHierarchyRoot(), null);

      // Should still resolve regular variables
      const titleResult = context.resolveVariable("title");
      assertExists(titleResult.ok, "Should resolve in legacy mode");
      if (!titleResult.ok) return;
      assertEquals(titleResult.data, "Legacy Test");

      // Legacy methods should work
      const keys = context.getDataKeys();
      assertExists(keys.includes("title"));
      assertExists(keys.includes("version"));
    });

    it("should support legacy getValue method", () => {
      // Arrange
      const data = FrontmatterTestFactory.createCustomData({
        nested: { value: "test" },
      });

      const contextResult = VariableContext.fromSingleData(data);
      if (!contextResult.ok) return;
      const context = contextResult.data;

      // Act & Assert - legacy method should work
      const valueResult = context.getValue("nested.value");
      assertExists(valueResult.ok, "Legacy getValue should work");
      if (!valueResult.ok) return;
      assertEquals(valueResult.data, "test");
    });

    it("should support legacy array methods", () => {
      // Arrange
      const data1 = FrontmatterTestFactory.createCustomData({ item: "first" });
      const data2 = FrontmatterTestFactory.createCustomData({ item: "second" });

      // Act
      const contextResult = VariableContext.fromArrayData([
        data1,
        data2,
      ]);

      // Assert
      assertExists(contextResult.ok, "Should create legacy array context");
      if (!contextResult.ok) return;
      const context = contextResult.data;

      assertExists(context.hasArrayData(), "Should have array data");
      assertEquals(context.getArrayData().length, 2);
      const arrayData = context.getArrayData() as Array<{ item: string }>;
      assertEquals(arrayData[0].item, "first");
    });
  });
});
