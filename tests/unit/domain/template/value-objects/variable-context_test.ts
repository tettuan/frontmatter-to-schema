import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { VariableContext } from "../../../../../src/domain/template/value-objects/variable-context.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

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
    it("should create context with hierarchy root from x-frontmatter-part", async () => {
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
                "x-frontmatter-part": true, // This becomes the hierarchy root
              },
            },
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      assertExists(schemaPathResult.ok);

      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      assertExists(schemaDefResult.ok);

      const schemaResult = Schema.create(
        schemaPathResult.data,
        schemaDefResult.data,
      );
      assertExists(schemaResult.ok);

      const data = FrontmatterData.create({
        title: "Test Project",
        metadata: {
          version: "1.0.0",
          commands: [
            { name: "build", script: "npm run build" },
            { name: "test", script: "npm test" },
          ],
        },
      });
      assertExists(data.ok);

      // Act
      const contextResult = VariableContext.create(schemaResult.data, data.data);

      // Assert
      assertExists(contextResult.ok, "Should create context successfully");
      const context = contextResult.data;
      assertEquals(context.getHierarchyRoot(), "metadata.commands");

      // Validate {@items} resolves from hierarchy root
      const itemsResult = context.resolveVariable("@items");
      assertExists(itemsResult.ok, "Should resolve {@items} from hierarchy root");
      assertExists(Array.isArray(itemsResult.data), "Should return array");
      assertEquals(itemsResult.data.length, 2);
      assertEquals(itemsResult.data[0].name, "build");
      assertEquals(itemsResult.data[1].name, "test");
    });

    it("should resolve regular variables from full data context", async () => {
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
            "x-frontmatter-part": true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({
        project: {
          name: "My Project",
          version: "2.0.0",
        },
        tasks: [{ name: "task1" }],
      });

      const contextResult = VariableContext.create(schemaResult.data!, data.data!);

      // Act & Assert
      const context = contextResult.data!;

      // Regular variables should resolve from full context
      const nameResult = context.resolveVariable("project.name");
      assertExists(nameResult.ok, "Should resolve nested project name");
      assertEquals(nameResult.data, "My Project");

      const versionResult = context.resolveVariable("project.version");
      assertExists(versionResult.ok, "Should resolve nested version");
      assertEquals(versionResult.data, "2.0.0");

      // {@items} should resolve from hierarchy root (tasks)
      const itemsResult = context.resolveVariable("@items");
      assertExists(itemsResult.ok, "Should resolve {@items}");
      assertEquals(itemsResult.data.length, 1);
    });

    it("should handle context without x-frontmatter-part", async () => {
      // Arrange: Schema without x-frontmatter-part
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({
        title: "Test Project",
        description: "A test project",
      });

      // Act
      const contextResult = VariableContext.create(schemaResult.data!, data.data!);

      // Assert
      assertExists(contextResult.ok, "Should create context even without x-frontmatter-part");
      const context = contextResult.data;
      assertEquals(context.getHierarchyRoot(), null);

      // Regular variables should still work
      const titleResult = context.resolveVariable("title");
      assertExists(titleResult.ok, "Should resolve regular variable");
      assertEquals(titleResult.data, "Test Project");

      // {@items} should fail without hierarchy root
      const itemsResult = context.resolveVariable("@items");
      assertExists(!itemsResult.ok, "Should fail to resolve {@items}");
      assertExists(
        itemsResult.error.message.includes("no x-frontmatter-part found"),
        "Should indicate missing x-frontmatter-part",
      );
    });
  });

  describe("Variable Resolution", () => {
    it("should resolve {@items} only from hierarchy root", async () => {
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
                "x-frontmatter-part": true,
              },
            },
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({
        config: {
          environments: ["dev", "staging", "prod"], // Should be ignored for {@items}
          scripts: [ // This should be used for {@items}
            { name: "build", command: "npm run build" },
            { name: "deploy", command: "npm run deploy" },
          ],
        },
      });

      const contextResult = VariableContext.create(schemaResult.data!, data.data!);

      // Act & Assert
      const context = contextResult.data!;
      assertEquals(context.getHierarchyRoot(), "config.scripts");

      // {@items} should resolve from scripts, not environments
      const itemsResult = context.resolveVariable("@items");
      assertExists(itemsResult.ok, "Should resolve {@items} from correct hierarchy");
      assertEquals(itemsResult.data.length, 2);
      assertEquals(itemsResult.data[0].name, "build");
      assertEquals(itemsResult.data[1].name, "deploy");

      // Can still access environments as regular variable
      const envResult = context.resolveVariable("config.environments");
      assertExists(envResult.ok, "Should resolve environments as regular variable");
      assertEquals(envResult.data.length, 3);
    });

    it("should reject unknown @ variables", async () => {
      // Arrange
      const schemaData = {
        type: "object",
        properties: {
          items: {
            type: "array",
            "x-frontmatter-part": true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({ items: [] });
      const contextResult = VariableContext.create(schemaResult.data!, data.data!);

      // Act & Assert
      const context = contextResult.data!;

      // Valid @ variable
      const itemsResult = context.resolveVariable("@items");
      assertExists(itemsResult.ok, "Should accept @items");

      // Invalid @ variables
      const unknownResult = context.resolveVariable("@unknown");
      assertExists(!unknownResult.ok, "Should reject unknown @ variable");
      assertExists(
        unknownResult.error.message.includes("Unknown special variable"),
        "Should indicate unknown variable",
      );

      const customResult = context.resolveVariable("@custom");
      assertExists(!customResult.ok, "Should reject custom @ variable");
    });

    it("should handle missing hierarchy data gracefully", async () => {
      // Arrange: Schema expects array but data doesn't have it
      const schemaData = {
        type: "object",
        properties: {
          commands: {
            type: "array",
            "x-frontmatter-part": true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({
        // commands array is missing
        title: "Test",
      });

      const contextResult = VariableContext.create(schemaResult.data!, data.data!);

      // Act & Assert
      const context = contextResult.data!;
      assertEquals(context.getHierarchyRoot(), "commands");

      const itemsResult = context.resolveVariable("@items");
      assertExists(!itemsResult.ok, "Should fail when hierarchy data is missing");
      assertExists(
        itemsResult.error.message.includes("data not found at hierarchy root"),
        "Should indicate missing hierarchy data",
      );
    });

    it("should validate hierarchy data type", async () => {
      // Arrange: Schema expects array but data has non-array
      const schemaData = {
        type: "object",
        properties: {
          items: {
            type: "array",
            "x-frontmatter-part": true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({
        items: "not an array", // Should be array
      });

      const contextResult = VariableContext.create(schemaResult.data!, data.data!);

      // Act & Assert
      const context = contextResult.data!;

      const itemsResult = context.resolveVariable("@items");
      assertExists(!itemsResult.ok, "Should fail when hierarchy data is not array");
      assertExists(
        itemsResult.error.message.includes("expected array"),
        "Should indicate type mismatch",
      );
    });
  });

  describe("Context Validation", () => {
    it("should validate {@items} resolution capability", async () => {
      // Arrange: Valid context
      const schemaData = {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            "x-frontmatter-part": true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({
        tasks: [{ name: "task1" }, { name: "task2" }],
      });

      const contextResult = VariableContext.create(schemaResult.data!, data.data!);
      const context = contextResult.data!;

      // Act
      const validationResult = context.validateItemsResolution();

      // Assert
      assertExists(validationResult.ok, "Should validate successfully");
    });

    it("should detect invalid {@items} context", async () => {
      // Arrange: Context without x-frontmatter-part
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({ title: "Test" });
      const contextResult = VariableContext.create(schemaResult.data!, data.data!);
      const context = contextResult.data!;

      // Act
      const validationResult = context.validateItemsResolution();

      // Assert
      assertExists(!validationResult.ok, "Should detect invalid context");
      assertExists(
        validationResult.error.message.includes("no x-frontmatter-part found"),
        "Should indicate missing x-frontmatter-part",
      );
    });
  });

  describe("Item Context Creation", () => {
    it("should create scoped contexts for array items", async () => {
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
            "x-frontmatter-part": true,
          },
        },
      };

      const schemaPathResult = SchemaPath.create("test-schema.json");
      const schemaDefResult = SchemaDefinition.fromRawSchema(schemaData);
      const schemaResult = Schema.create(
        schemaPathResult.data!,
        schemaDefResult.data!,
      );

      const data = FrontmatterData.create({
        commands: [
          { name: "build", script: "npm run build" },
          { name: "test", script: "npm test" },
        ],
      });

      const contextResult = VariableContext.create(schemaResult.data!, data.data!);
      const parentContext = contextResult.data!;

      // Create item data
      const itemData = FrontmatterData.create({
        name: "deploy",
        script: "npm run deploy",
      });

      // Act
      const itemContextResult = parentContext.createItemContext(itemData.data!);

      // Assert
      assertExists(itemContextResult.ok, "Should create item context");
      const itemContext = itemContextResult.data;

      // Item context should resolve its own variables
      const nameResult = itemContext.resolveVariable("name");
      assertExists(nameResult.ok, "Should resolve item variable");
      assertEquals(nameResult.data, "deploy");

      const scriptResult = itemContext.resolveVariable("script");
      assertExists(scriptResult.ok, "Should resolve item script");
      assertEquals(scriptResult.data, "npm run deploy");

      // Item context should inherit same hierarchy root
      assertEquals(itemContext.getHierarchyRoot(), "commands");
    });
  });

  describe("Backward Compatibility", () => {
    it("should support legacy fromSingleData method", async () => {
      // Arrange
      const data = FrontmatterData.create({
        title: "Legacy Test",
        version: "1.0.0",
      });

      // Act
      const contextResult = VariableContext.fromSingleData(data.data!);

      // Assert
      assertExists(contextResult.ok, "Should create legacy context");
      const context = contextResult.data;

      // Should have no hierarchy root (legacy mode)
      assertEquals(context.getHierarchyRoot(), null);

      // Should still resolve regular variables
      const titleResult = context.resolveVariable("title");
      assertExists(titleResult.ok, "Should resolve in legacy mode");
      assertEquals(titleResult.data, "Legacy Test");

      // Legacy methods should work
      const keys = context.getDataKeys();
      assertExists(keys.includes("title"));
      assertExists(keys.includes("version"));
    });

    it("should support legacy getValue method", async () => {
      // Arrange
      const data = FrontmatterData.create({
        nested: { value: "test" },
      });

      const contextResult = VariableContext.fromSingleData(data.data!);
      const context = contextResult.data!;

      // Act & Assert - legacy method should work
      const valueResult = context.getValue("nested.value");
      assertExists(valueResult.ok, "Legacy getValue should work");
      assertEquals(valueResult.data, "test");
    });

    it("should support legacy array methods", async () => {
      // Arrange
      const data1 = FrontmatterData.create({ item: "first" });
      const data2 = FrontmatterData.create({ item: "second" });

      // Act
      const contextResult = VariableContext.fromArrayData([data1.data!, data2.data!]);

      // Assert
      assertExists(contextResult.ok, "Should create legacy array context");
      const context = contextResult.data;

      assertExists(context.hasArrayData(), "Should have array data");
      assertEquals(context.getArrayData().length, 2);
      assertEquals(context.getArrayData()[0].item, "first");
    });
  });
});