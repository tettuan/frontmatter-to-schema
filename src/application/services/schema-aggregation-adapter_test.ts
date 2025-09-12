/**
 * Schema Aggregation Adapter Tests
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { SchemaAggregationAdapter } from "./schema-aggregation-adapter.ts";
import type { ExtendedSchema } from "../../domain/models/schema-extensions.ts";
import { SchemaExtensionRegistryFactory } from "../../domain/schema/factories/schema-extension-registry-factory.ts";
import { SchemaExtensions } from "../../domain/schema/value-objects/schema-extensions.ts";

// Test helper function
function createTestAdapter() {
  const registryResult = SchemaExtensionRegistryFactory.createDefault();
  if (!registryResult.ok) {
    throw new Error(
      `Failed to create registry: ${registryResult.error.message}`,
    );
  }
  return new SchemaAggregationAdapter(registryResult.data);
}

describe("SchemaAggregationAdapter", () => {
  describe("extractAggregationContext", () => {
    it("should extract derivation rules from schema", () => {
      const adapter = createTestAdapter();
      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          availableConfigs: {
            type: "array",
            [SchemaExtensions.DERIVED_FROM]: "commands[].c1",
            [SchemaExtensions.DERIVED_UNIQUE]: true,
            items: {
              type: "string",
            },
          },
          allCommands: {
            type: "array",
            [SchemaExtensions.DERIVED_FROM]: "commands",
            [SchemaExtensions.DERIVED_FLATTEN]: true,
            items: {
              type: "object",
            },
          },
        },
      };

      const result = adapter.extractAggregationContext(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const context = result.data;
        const rules = context.getRules();
        assertEquals(rules.length, 2);

        // Check first rule
        assertEquals(rules[0].getTargetField(), "availableConfigs");
        assertEquals(rules[0].getSourceExpression(), "commands[].c1");
        assertEquals(rules[0].isUnique(), true);
        assertEquals(rules[0].shouldFlatten(), false);

        // Check second rule
        assertEquals(rules[1].getTargetField(), "allCommands");
        assertEquals(rules[1].getSourceExpression(), "commands");
        assertEquals(rules[1].isUnique(), false);
        assertEquals(rules[1].shouldFlatten(), true);
      }
    });

    it("should handle top-level properties with derivation rules", () => {
      // Note: Nested properties like "config.tools" are not yet supported due to issue #568
      const adapter = createTestAdapter();
      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          tools: {
            type: "array",
            [SchemaExtensions.DERIVED_FROM]: "items[].name",
            [SchemaExtensions.DERIVED_UNIQUE]: true,
            items: {
              type: "string",
            },
          },
          categories: {
            type: "array",
            [SchemaExtensions.DERIVED_FROM]: "items[].category",
            [SchemaExtensions.DERIVED_UNIQUE]: true,
            items: {
              type: "string",
            },
          },
        },
      };

      const result = adapter.extractAggregationContext(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data.getRules();
        assertEquals(rules.length, 2);
        assertEquals(rules[0].getTargetField(), "tools");
        assertEquals(rules[0].getSourceExpression(), "items[].name");
        assertEquals(rules[1].getTargetField(), "categories");
        assertEquals(rules[1].getSourceExpression(), "items[].category");
      }
    });
  });

  describe("isFrontmatterPartSchema", () => {
    it("should identify schema marked with x-frontmatter-part", () => {
      const adapter = createTestAdapter();

      const markedSchema: ExtendedSchema = {
        type: "object",
        [SchemaExtensions.FRONTMATTER_PART]: true,
        properties: {},
      };

      const unmarkedSchema: ExtendedSchema = {
        type: "object",
        properties: {},
      };

      assertEquals(adapter.isFrontmatterPartSchema(markedSchema), true);
      assertEquals(adapter.isFrontmatterPartSchema(unmarkedSchema), false);
    });
  });

  describe("findFrontmatterParts", () => {
    it("should find all properties marked with x-frontmatter-part", () => {
      const adapter = createTestAdapter();
      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          commands: {
            type: "array",
            [SchemaExtensions.FRONTMATTER_PART]: true,
            items: {
              type: "object",
              properties: {
                c1: { type: "string" },
                c2: { type: "string" },
              },
            },
          },
          config: {
            type: "object",
            properties: {
              settings: {
                type: "array",
                [SchemaExtensions.FRONTMATTER_PART]: true,
                items: { type: "string" },
              },
            },
          },
          normal: {
            type: "string",
          },
        },
      };

      const parts = adapter.findFrontmatterParts(schema);

      assertEquals(parts.length, 2);
      assertEquals(parts.includes("commands"), true);
      assertEquals(parts.includes("config.settings"), true);
    });

    it("should handle root-level x-frontmatter-part", () => {
      const adapter = createTestAdapter();
      const schema: ExtendedSchema = {
        type: "object",
        [SchemaExtensions.FRONTMATTER_PART]: true,
        properties: {
          field1: { type: "string" },
        },
      };

      const parts = adapter.findFrontmatterParts(schema);

      assertEquals(parts.includes("$"), true);
    });
  });

  describe("processAggregation", () => {
    it("should aggregate data from multiple documents", () => {
      const adapter = createTestAdapter();
      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          availableConfigs: {
            type: "array",
            [SchemaExtensions.DERIVED_FROM]: "commands[].c1",
            [SchemaExtensions.DERIVED_UNIQUE]: true,
            items: { type: "string" },
          },
        },
      };

      const documents = [
        {
          commands: [
            { c1: "build", c2: "Build the project" },
            { c1: "test", c2: "Run tests" },
          ],
        },
        {
          commands: [
            { c1: "build", c2: "Build again" },
            { c1: "deploy", c2: "Deploy to production" },
          ],
        },
      ];

      const result = adapter.processAggregation(documents, schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data;
        assertExists(data.availableConfigs);
        const configs = data.availableConfigs as string[];
        assertEquals(configs.length, 3); // build, test, deploy (unique)
        assertEquals(configs.includes("build"), true);
        assertEquals(configs.includes("test"), true);
        assertEquals(configs.includes("deploy"), true);
      }
    });

    it("should handle flatten option", () => {
      const adapter = createTestAdapter();
      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          allItems: {
            type: "array",
            [SchemaExtensions.DERIVED_FROM]: "nested",
            [SchemaExtensions.DERIVED_FLATTEN]: true,
            items: { type: "string" },
          },
        },
      };

      const documents = [
        {
          nested: [["item1", "item2"], ["item3"]],
        },
        {
          nested: [["item4", "item5"]],
        },
      ];

      const result = adapter.processAggregation(documents, schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data;
        const items = data.allItems as string[];
        assertEquals(items.length, 5);
        assertEquals(items, ["item1", "item2", "item3", "item4", "item5"]);
      }
    });
  });

  describe("applyToTemplate", () => {
    it("should apply aggregated data to template", () => {
      const adapter = createTestAdapter();
      const template = {
        name: "Registry",
        configs: [],
      };

      const aggregatedData = {
        availableConfigs: ["build", "test", "deploy"],
      };

      const result = adapter.applyToTemplate(template, aggregatedData);

      assertExists(result.availableConfigs);
      assertEquals(result.availableConfigs, ["build", "test", "deploy"]);
      assertEquals(result.name, "Registry");
    });

    it("should handle nested paths in aggregated data", () => {
      const adapter = createTestAdapter();
      const template = {
        root: {
          nested: {},
        },
      };

      const aggregatedData = {
        "root.nested.field": "value",
      };

      const result = adapter.applyToTemplate(template, aggregatedData);

      const root = result.root as Record<string, unknown>;
      const nested = root.nested as Record<string, unknown>;
      assertEquals(nested.field, "value");
    });
  });
});
