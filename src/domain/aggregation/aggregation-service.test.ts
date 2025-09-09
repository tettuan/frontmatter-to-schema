/**
 * Unit tests for AggregationService
 *
 * Tests data aggregation, derivation rule application, and schema extraction
 * following DDD and Totality principles with robust test coverage.
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  AggregationService,
  createAggregationService,
} from "./aggregation-service.ts";
import {
  AggregatedResult,
  AggregationContext,
  DerivationRule,
} from "./value-objects.ts";
import { ExpressionEvaluator } from "./expression-evaluator.ts";

describe("AggregationService", () => {
  describe("aggregate()", () => {
    it("should aggregate simple fields from multiple items", () => {
      const service = createAggregationService();

      const items = [
        { name: "Item 1", value: 10 },
        { name: "Item 2", value: 20 },
        { name: "Item 3", value: 30 },
      ];

      const ruleResult = DerivationRule.create("names", "$.name");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.names, ["Item 1", "Item 2", "Item 3"]);

        const metadata = result.data.getMetadata();
        assertEquals(metadata.processedCount, 3);
        assertEquals(metadata.appliedRules, ["names"]);
      }
    });

    it("should handle nested field extraction", () => {
      const service = createAggregationService();

      const items = [
        { config: { tools: { name: "tool1" } } },
        { config: { tools: { name: "tool2" } } },
      ];

      const ruleResult = DerivationRule.create(
        "tools.availableConfigs",
        "$.config.tools.name",
      );
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data["tools.availableConfigs"], ["tool1", "tool2"]);
      }
    });

    it("should apply unique option correctly", () => {
      const service = createAggregationService();

      const items = [
        { tag: "alpha" },
        { tag: "beta" },
        { tag: "alpha" },
        { tag: "gamma" },
        { tag: "beta" },
      ];

      const ruleResult = DerivationRule.create("uniqueTags", "$.tag", {
        unique: true,
      });
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.uniqueTags, ["alpha", "beta", "gamma"]);

        const metadata = result.data.getMetadata();
        assertEquals(metadata.statistics?.uniqueValues.uniqueTags, 3);
      }
    });

    it("should flatten nested arrays when flatten option is true", () => {
      const service = createAggregationService();

      const items = [
        { groups: [["a", "b"], ["c"]] },
        { groups: [["d"], ["e", "f"]] },
      ];

      const ruleResult = DerivationRule.create("allItems", "$.groups", {
        flatten: true,
      });
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.allItems, ["a", "b", "c", "d", "e", "f"]);
      }
    });

    it("should filter null and undefined values based on options", () => {
      const service = createAggregationService();

      const items = [
        { value: "valid" },
        { value: null },
        { value: undefined },
        { value: "another" },
      ];

      const ruleResult = DerivationRule.create("values", "$.value");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      // Test with default options (skipNull: true, skipUndefined: true)
      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.values, ["valid", "another"]);
      }
    });

    it("should include nulls when skipNull is false", () => {
      const service = createAggregationService();

      const items = [
        { value: "valid" },
        { value: null },
        { value: "another" },
      ];

      const ruleResult = DerivationRule.create("values", "$.value");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data], {
        skipNull: false,
        skipUndefined: true,
        preserveOrder: false,
      });
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.values, ["valid", null, "another"]);
      }
    });

    it("should handle array field extraction", () => {
      const service = createAggregationService();

      const items = [
        { items: [{ id: 1 }, { id: 2 }] },
        { items: [{ id: 3 }] },
      ];

      const ruleResult = DerivationRule.create("allIds", "$.items[*].id");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.allIds, [1, 2, 3]);
      }
    });

    it("should collect statistics correctly", () => {
      const service = createAggregationService();

      const items = [
        { value: "a" },
        { value: null },
        { value: "b" },
        { value: undefined },
        { value: "a" },
      ];

      const ruleResult = DerivationRule.create("values", "$.value", {
        unique: true,
      });
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const metadata = result.data.getMetadata();
        assertEquals(metadata.processedCount, 5);
        assertEquals(metadata.statistics?.totalItems, 5);
        assertEquals(metadata.statistics?.nullCount.values, 2);
        assertEquals(metadata.statistics?.uniqueValues.values, 2);
      }
    });

    it("should handle multiple rules simultaneously", () => {
      const service = createAggregationService();

      const items = [
        { name: "A", value: 1, tag: "x" },
        { name: "B", value: 2, tag: "y" },
        { name: "C", value: 3, tag: "x" },
      ];

      const nameRule = DerivationRule.create("names", "$.name");
      const valueRule = DerivationRule.create("values", "$.value");
      const tagRule = DerivationRule.create("uniqueTags", "$.tag", {
        unique: true,
      });

      if (!nameRule.ok || !valueRule.ok || !tagRule.ok) {
        throw new Error("Failed to create rules");
      }

      const context = AggregationContext.create([
        nameRule.data,
        valueRule.data,
        tagRule.data,
      ]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.names, ["A", "B", "C"]);
        assertEquals(data.values, [1, 2, 3]);
        assertEquals(data.uniqueTags, ["x", "y"]);
      }
    });

    it("should handle missing properties gracefully", () => {
      const service = createAggregationService();

      const items = [
        { valid: { field: "value" } },
        { different: { property: "data" } },
        { valid: { field: "another" } },
      ];

      // This expression will only find values in items with "valid" property
      const ruleResult = DerivationRule.create("fields", "$.valid.field");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.fields, ["value", "another"]);

        const metadata = result.data.getMetadata();
        // No warnings are generated for missing properties - this is normal JSONPath behavior
        assertEquals(metadata.warnings, undefined);
      }
    });
  });

  describe("extractRulesFromSchema()", () => {
    it("should extract rules from simple schema properties", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          derivedField: {
            type: "array",
            "x-derived-from": "$.source",
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1);
        assertEquals(result.data[0].getTargetField(), "derivedField");
        assertEquals(result.data[0].getSourceExpression(), "$.source");
      }
    });

    it("should extract rules from nested schema properties", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          config: {
            type: "object",
            properties: {
              tools: {
                type: "array",
                "x-derived-from": "$.tools[*].name",
                "x-derived-unique": true,
              },
            },
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1);
        assertEquals(result.data[0].getTargetField(), "config.tools");
        assertEquals(result.data[0].isUnique(), true);
      }
    });

    it("should handle array item properties", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                derived: {
                  type: "string",
                  "x-derived-from": "$.data",
                },
              },
            },
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1);
        assertEquals(result.data[0].getTargetField(), "items[].derived");
      }
    });

    it("should skip properties without x-derived-from", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          normalField: {
            type: "string",
            description: "A regular field",
          },
          derivedField: {
            type: "array",
            "x-derived-from": "$.source",
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1);
        assertEquals(result.data[0].getTargetField(), "derivedField");
      }
    });

    it("should handle invalid schema gracefully", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          invalidField: {
            type: "array",
            "x-derived-from": "$..invalid", // Invalid expression with consecutive dots
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "SchemaExtractionError");
        assertEquals(
          result.error.message.includes("Failed to extract rules"),
          true,
        );
      }
    });
  });

  describe("applyAggregatedData()", () => {
    it("should apply aggregated data to a base object", () => {
      const service = createAggregationService();

      const base = {
        existingField: "value",
      };

      const aggregatedResult = AggregatedResult.create(
        {
          newField: ["item1", "item2"],
        },
        {
          processedCount: 2,
          aggregatedAt: new Date(),
          appliedRules: ["newField"],
        },
      );

      if (!aggregatedResult.ok) throw new Error("Failed to create result");

      const result = service.applyAggregatedData(base, aggregatedResult.data);

      assertEquals(result.existingField, "value");
      assertEquals(result.newField, ["item1", "item2"]);
    });

    it("should create nested structure for dotted field names", () => {
      const service = createAggregationService();

      const base = {};

      const aggregatedResult = AggregatedResult.create(
        {
          "config.tools.available": ["tool1", "tool2"],
        },
        {
          processedCount: 2,
          aggregatedAt: new Date(),
          appliedRules: ["config.tools.available"],
        },
      );

      if (!aggregatedResult.ok) throw new Error("Failed to create result");

      const result = service.applyAggregatedData(base, aggregatedResult.data);

      assertExists(result.config);
      const config = result.config as Record<string, unknown>;
      assertExists(config.tools);
      const tools = config.tools as Record<string, unknown>;
      assertEquals(tools.available, ["tool1", "tool2"]);
    });

    it("should merge with existing nested structure", () => {
      const service = createAggregationService();

      const base = {
        config: {
          existing: "value",
          tools: {
            other: "data",
          },
        },
      };

      const aggregatedResult = AggregatedResult.create(
        {
          "config.tools.available": ["tool1", "tool2"],
        },
        {
          processedCount: 2,
          aggregatedAt: new Date(),
          appliedRules: ["config.tools.available"],
        },
      );

      if (!aggregatedResult.ok) throw new Error("Failed to create result");

      const result = service.applyAggregatedData(base, aggregatedResult.data);

      const config = result.config as Record<string, unknown>;
      assertEquals(config.existing, "value");
      const tools = config.tools as Record<string, unknown>;
      assertEquals(tools.other, "data");
      assertEquals(tools.available, ["tool1", "tool2"]);
    });
  });

  describe("createAggregationService()", () => {
    it("should create service with default evaluator", () => {
      const service = createAggregationService();
      assertExists(service);
      assertEquals(service instanceof AggregationService, true);
    });

    it("should create service with custom evaluator", () => {
      const customEvaluator = new ExpressionEvaluator();
      const service = createAggregationService(customEvaluator);
      assertExists(service);
      assertEquals(service instanceof AggregationService, true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty items array", () => {
      const service = createAggregationService();

      const ruleResult = DerivationRule.create("field", "$.value");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate([], context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.field, []);

        const metadata = result.data.getMetadata();
        assertEquals(metadata.processedCount, 0);
      }
    });

    it("should handle empty rules", () => {
      const service = createAggregationService();

      const items = [{ value: 1 }, { value: 2 }];
      const context = AggregationContext.create([]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(Object.keys(data).length, 0);
      }
    });

    it("should handle deeply nested unique values", () => {
      const service = createAggregationService();

      const items = [
        { data: { nested: { value: { id: 1, name: "a" } } } },
        { data: { nested: { value: { id: 2, name: "b" } } } },
        { data: { nested: { value: { id: 1, name: "a" } } } },
      ];

      const ruleResult = DerivationRule.create(
        "uniqueValues",
        "$.data.nested.value",
        { unique: true },
      );
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.uniqueValues, [
          { id: 1, name: "a" },
          { id: 2, name: "b" },
        ]);
      }
    });
  });
});
