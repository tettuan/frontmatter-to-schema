/**
 * Basic Aggregation Service Tests
 *
 * Tests core aggregation functionality following AI complexity control (<200 lines)
 * Extracted from aggregation-service.test.ts for better organization
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createAggregationService } from "./aggregation-service.ts";
import { AggregationContext, DerivationRule } from "./value-objects.ts";
import { SchemaExtensionRegistryFactory } from "../schema/factories/schema-extension-registry-factory.ts";

// Test helper function
function createTestAggregationService() {
  const registryResult = SchemaExtensionRegistryFactory.createDefault();
  if (!registryResult.ok) {
    throw new Error(
      `Failed to create registry: ${registryResult.error.message}`,
    );
  }
  return createAggregationService(registryResult.data);
}

describe("AggregationService - Basic Functionality", () => {
  describe("aggregate()", () => {
    it("should aggregate simple fields from multiple items", () => {
      const service = createTestAggregationService();

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
      const service = createTestAggregationService();

      const items = [
        { user: { name: "Alice", age: 25 } },
        { user: { name: "Bob", age: 30 } },
        { user: { name: "Charlie", age: 35 } },
      ];

      const ruleResult = DerivationRule.create("userNames", "$.user.name");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.userNames, ["Alice", "Bob", "Charlie"]);
      }
    });

    it("should apply unique option correctly", () => {
      const service = createTestAggregationService();

      const items = [
        { category: "A" },
        { category: "B" },
        { category: "A" },
        { category: "C" },
        { category: "B" },
      ];

      const ruleResult = DerivationRule.create("categories", "$.category", {
        unique: true,
      });
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        const categories = data.categories as string[];
        assertEquals(categories.sort(), ["A", "B", "C"]);
      }
    });

    it("should flatten nested arrays when flatten option is true", () => {
      const service = createTestAggregationService();

      const items = [
        { tags: ["tag1", "tag2"] },
        { tags: ["tag3", "tag4"] },
        { tags: ["tag1", "tag5"] },
      ];

      const ruleResult = DerivationRule.create("allTags", "$.tags", {
        flatten: true,
        unique: true,
      });
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        const allTags = data.allTags as string[];
        assertEquals(allTags.sort(), ["tag1", "tag2", "tag3", "tag4", "tag5"]);
      }
    });

    it("should filter null and undefined values based on options", () => {
      const service = createTestAggregationService();

      const items = [
        { value: "A" },
        { value: null },
        { value: "B" },
        { value: undefined },
        { value: "C" },
        {},
      ];

      const ruleResult = DerivationRule.create("values", "$.value");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.values, ["A", "B", "C"]);
      }
    });

    it("should handle array field extraction", () => {
      const service = createTestAggregationService();

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
      const service = createTestAggregationService();

      const items = [
        { name: "Item 1" },
        { name: "Item 2" },
        { name: "Item 3" },
      ];

      const ruleResult = DerivationRule.create("names", "$.name");
      if (!ruleResult.ok) throw new Error("Failed to create rule");

      const context = AggregationContext.create([ruleResult.data]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const metadata = result.data.getMetadata();
        assertEquals(metadata.processedCount, 3);
        assertEquals(metadata.appliedRules, ["names"]);
        assertExists(metadata.aggregatedAt);
      }
    });

    it("should handle multiple rules simultaneously", () => {
      const service = createTestAggregationService();

      const items = [
        { name: "Item 1", value: 10, category: "A" },
        { name: "Item 2", value: 20, category: "B" },
        { name: "Item 3", value: 30, category: "A" },
      ];

      const nameRuleResult = DerivationRule.create("names", "$.name");
      const valueRuleResult = DerivationRule.create("values", "$.value");
      const categoryRuleResult = DerivationRule.create(
        "categories",
        "$.category",
        {
          unique: true,
        },
      );

      if (!nameRuleResult.ok || !valueRuleResult.ok || !categoryRuleResult.ok) {
        throw new Error("Failed to create rules");
      }

      const context = AggregationContext.create([
        nameRuleResult.data,
        valueRuleResult.data,
        categoryRuleResult.data,
      ]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.names, ["Item 1", "Item 2", "Item 3"]);
        assertEquals(data.values, [10, 20, 30]);
        const categories = data.categories as string[];
        assertEquals(categories.sort(), ["A", "B"]);
      }
    });

    it("should handle missing properties gracefully", () => {
      const service = createTestAggregationService();

      const items = [
        { name: "Item 1", value: 10 },
        { name: "Item 2" }, // missing value
        { value: 30 }, // missing name
        {}, // missing both
      ];

      const nameRuleResult = DerivationRule.create("names", "$.name", {});
      const valueRuleResult = DerivationRule.create("values", "$.value", {});

      if (!nameRuleResult.ok || !valueRuleResult.ok) {
        throw new Error("Failed to create rules");
      }

      const context = AggregationContext.create([
        nameRuleResult.data,
        valueRuleResult.data,
      ]);
      const result = service.aggregate(items, context);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(data.names, ["Item 1", "Item 2"]);
        assertEquals(data.values, [10, 30]);
      }
    });
  });
});
