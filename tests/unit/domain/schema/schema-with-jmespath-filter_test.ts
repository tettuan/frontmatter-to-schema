import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { SchemaDefinition } from "../../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPropertyUtils } from "../../../../src/domain/schema/value-objects/schema-property-types.ts";
import { TEST_EXTENSIONS } from "../../../helpers/test-extensions.ts";

describe("Schema with x-jmespath-filter extension", () => {
  describe("Schema property JMESPath filter detection", () => {
    it("should detect x-jmespath-filter in schema properties", () => {
      const schemaData = {
        type: "object",
        properties: {
          commands: {
            type: "array",
            [TEST_EXTENSIONS.JMESPATH_FILTER]: "commands[?c1 == 'git']",
            items: {
              type: "object",
              properties: {
                c1: { type: "string" },
                c2: { type: "string" },
                c3: { type: "string" },
              },
            },
          },
        },
      };

      const schemaDefinitionResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefinitionResult.ok);
      if (!schemaDefinitionResult.ok) return;

      const schemaDefinition = schemaDefinitionResult.data;

      // Find the commands property
      const commandsPropertyResult = schemaDefinition.findProperty("commands");
      assertExists(commandsPropertyResult.ok);
      if (!commandsPropertyResult.ok) return;

      const commandsProperty = commandsPropertyResult.data;

      // Check if it has JMESPath filter
      const hasJMESPathFilter = SchemaPropertyUtils.hasJMESPathFilter(
        commandsProperty,
      );
      assertEquals(hasJMESPathFilter, true);

      // Get the JMESPath filter expression
      const filterExpressionResult = SchemaPropertyUtils.getJMESPathFilter(
        commandsProperty,
      );
      assertExists(filterExpressionResult.ok);
      if (filterExpressionResult.ok) {
        assertEquals(filterExpressionResult.data, "commands[?c1 == 'git']");
      }
    });

    it("should handle schema properties without x-jmespath-filter", () => {
      const schemaData = {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Document title",
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
      };

      const schemaDefinitionResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefinitionResult.ok);
      if (!schemaDefinitionResult.ok) return;

      const schemaDefinition = schemaDefinitionResult.data;

      // Find the title property
      const titlePropertyResult = schemaDefinition.findProperty("title");
      assertExists(titlePropertyResult.ok);
      if (!titlePropertyResult.ok) return;

      const titleProperty = titlePropertyResult.data;

      // Check if it has JMESPath filter (should be false)
      const hasJMESPathFilter = SchemaPropertyUtils.hasJMESPathFilter(
        titleProperty,
      );
      assertEquals(hasJMESPathFilter, false);

      // Attempting to get filter should return error
      const filterExpressionResult = SchemaPropertyUtils.getJMESPathFilter(
        titleProperty,
      );
      assertEquals(filterExpressionResult.ok, false);
      if (!filterExpressionResult.ok) {
        assertEquals(
          filterExpressionResult.error.kind,
          "JMESPathFilterNotDefined",
        );
      }
    });

    it("should handle nested schema properties with JMESPath filters", () => {
      const schemaData = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            properties: {
              dependencies: {
                type: "array",
                [TEST_EXTENSIONS.JMESPATH_FILTER]:
                  "project.dependencies[?type == 'prod']",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    version: { type: "string" },
                    type: { type: "string" },
                  },
                },
              },
            },
          },
        },
      };

      const schemaDefinitionResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefinitionResult.ok);
      if (!schemaDefinitionResult.ok) return;

      const schemaDefinition = schemaDefinitionResult.data;

      // Find the nested dependencies property
      const depsPropertyResult = schemaDefinition.findProperty(
        "metadata.dependencies",
      );
      assertExists(depsPropertyResult.ok);
      if (!depsPropertyResult.ok) return;

      const depsProperty = depsPropertyResult.data;

      // Check if it has JMESPath filter
      const hasJMESPathFilter = SchemaPropertyUtils.hasJMESPathFilter(
        depsProperty,
      );
      assertEquals(hasJMESPathFilter, true);

      // Get the JMESPath filter expression
      const filterExpressionResult = SchemaPropertyUtils.getJMESPathFilter(
        depsProperty,
      );
      assertExists(filterExpressionResult.ok);
      if (filterExpressionResult.ok) {
        assertEquals(
          filterExpressionResult.data,
          "project.dependencies[?type == 'prod']",
        );
      }
    });

    it("should validate JMESPath filter expressions in schema", () => {
      const testCases = [
        {
          name: "simple property access",
          expression: "name",
          shouldBeValid: true,
        },
        {
          name: "array filtering",
          expression: "commands[?c1 == 'git']",
          shouldBeValid: true,
        },
        {
          name: "nested property with filtering",
          expression: "users[?profile.active == true].name",
          shouldBeValid: true,
        },
        {
          name: "object transformation",
          expression: "metadata | {title: title, author: author.name}",
          shouldBeValid: true,
        },
        {
          name: "complex filtering with functions",
          expression: "tags[?starts_with(@, 'important')]",
          shouldBeValid: true,
        },
      ];

      for (const testCase of testCases) {
        const schemaData = {
          type: "object",
          properties: {
            testProperty: {
              type: "array",
              [TEST_EXTENSIONS.JMESPATH_FILTER]: testCase.expression,
              items: { type: "string" },
            },
          },
        };

        const schemaDefinitionResult = SchemaDefinition.create(schemaData);
        assertExists(
          schemaDefinitionResult.ok,
          `Failed to create schema for case: ${testCase.name}`,
        );
        if (!schemaDefinitionResult.ok) continue;

        const schemaDefinition = schemaDefinitionResult.data;
        const propertyResult = schemaDefinition.findProperty("testProperty");
        assertExists(
          propertyResult.ok,
          `Failed to find property for case: ${testCase.name}`,
        );
        if (!propertyResult.ok) continue;

        const property = propertyResult.data;
        const hasFilter = SchemaPropertyUtils.hasJMESPathFilter(property);
        assertEquals(
          hasFilter,
          true,
          `JMESPath filter not detected for case: ${testCase.name}`,
        );

        const expressionResult = SchemaPropertyUtils.getJMESPathFilter(
          property,
        );
        assertExists(
          expressionResult.ok,
          `Failed to get expression for case: ${testCase.name}`,
        );
        if (expressionResult.ok) {
          assertEquals(
            expressionResult.data,
            testCase.expression,
            `Expression mismatch for case: ${testCase.name}`,
          );
        }
      }
    });
  });

  describe("Schema definition with JMESPath filter at root level", () => {
    it("should detect JMESPath filter at schema root level", () => {
      const schemaData = {
        type: "object",
        [TEST_EXTENSIONS.JMESPATH_FILTER]: "commands[?active == true]",
        properties: {
          commands: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                active: { type: "boolean" },
              },
            },
          },
        },
      };

      const schemaDefinitionResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefinitionResult.ok);
      if (!schemaDefinitionResult.ok) return;

      const schemaDefinition = schemaDefinitionResult.data;

      // Check if the schema definition itself has JMESPath filter
      const hasJMESPathFilter = schemaDefinition.hasJMESPathFilter();
      assertEquals(hasJMESPathFilter, true);

      // Get the JMESPath filter expression
      const filterExpressionResult = schemaDefinition.getJMESPathFilter();
      assertExists(filterExpressionResult.ok);
      if (filterExpressionResult.ok) {
        assertEquals(filterExpressionResult.data, "commands[?active == true]");
      }
    });

    it("should handle schema definition without root-level JMESPath filter", () => {
      const schemaData = {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
      };

      const schemaDefinitionResult = SchemaDefinition.create(schemaData);
      assertExists(schemaDefinitionResult.ok);
      if (!schemaDefinitionResult.ok) return;

      const schemaDefinition = schemaDefinitionResult.data;

      // Check if the schema definition has JMESPath filter (should be false)
      const hasJMESPathFilter = schemaDefinition.hasJMESPathFilter();
      assertEquals(hasJMESPathFilter, false);

      // Attempting to get filter should return error
      const filterExpressionResult = schemaDefinition.getJMESPathFilter();
      assertEquals(filterExpressionResult.ok, false);
      if (!filterExpressionResult.ok) {
        assertEquals(
          filterExpressionResult.error.kind,
          "JMESPathFilterNotDefined",
        );
      }
    });
  });
});
