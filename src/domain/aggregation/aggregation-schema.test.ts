/**
 * Schema Extraction Aggregation Tests
 *
 * Tests schema rule extraction functionality following AI complexity control (<200 lines)
 * Extracted from aggregation-service.test.ts for better organization
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createAggregationService } from "./aggregation-service.ts";

describe("AggregationService - Schema Extraction", () => {
  describe("extractRulesFromSchema()", () => {
    it("should extract rules from simple schema properties", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          allNames: {
            type: "array",
            "x-derived-from": "$.name",
          },
          allValues: {
            type: "array",
            "x-derived-from": "$.value",
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data;
        assertEquals(rules.length, 2);
        assertEquals(rules[0].getTargetField(), "allNames");
        assertEquals(rules[0].getSourceExpression(), "$.name");
        assertEquals(rules[1].getTargetField(), "allValues");
        assertEquals(rules[1].getSourceExpression(), "$.value");
      }
    });

    it("should extract rules from nested schema properties", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          summary: {
            type: "object",
            properties: {
              userNames: {
                type: "array",
                "x-derived-from": "$.user.name",
              },
              totalCount: {
                type: "number",
                "x-derived-from": "$.items.length",
              },
            },
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data;
        assertEquals(rules.length, 2);
        assertEquals(rules[0].getTargetField(), "summary.userNames");
        assertEquals(rules[0].getSourceExpression(), "$.user.name");
        assertEquals(rules[1].getTargetField(), "summary.totalCount");
        assertEquals(rules[1].getSourceExpression(), "$.items.length");
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
                processedNames: {
                  type: "array",
                  "x-derived-from": "$.name",
                  "x-aggregation-options": {
                    unique: true,
                    skipNull: true,
                  },
                },
              },
            },
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data;
        assertEquals(rules.length, 1);
        assertEquals(rules[0].getTargetField(), "items[].processedNames");
        assertEquals(rules[0].getSourceExpression(), "$.name");

        assertEquals(rules[0].isUnique(), true);
      }
    });

    it("should skip properties without x-derived-from", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          allNames: {
            type: "array",
            "x-derived-from": "$.name",
          },
          regularProperty: {
            type: "string",
          },
          anotherProperty: {
            type: "number",
            description: "Just a regular property",
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data;
        assertEquals(rules.length, 1);
        assertEquals(rules[0].getTargetField(), "allNames");
        assertEquals(rules[0].getSourceExpression(), "$.name");
      }
    });

    it("should handle invalid schema gracefully", () => {
      const service = createAggregationService();

      // Test various invalid schema formats - use type assertions for intentionally invalid inputs
      const invalidSchemas = [
        null as unknown as Record<string, unknown>,
        undefined as unknown as Record<string, unknown>,
        "not an object" as unknown as Record<string, unknown>,
        {},
        { properties: null },
        { properties: "not an object" },
      ];

      for (const schema of invalidSchemas) {
        const result = service.extractRulesFromSchema(schema);
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.length, 0);
        }
      }
    });

    it("should handle complex nested structures", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          metadata: {
            type: "object",
            properties: {
              counts: {
                type: "object",
                properties: {
                  totalItems: {
                    type: "number",
                    "x-derived-from": "$.items.length",
                  },
                  categories: {
                    type: "array",
                    "x-derived-from": "$.category",
                    "x-aggregation-options": {
                      unique: true,
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data;
        assertEquals(rules.length, 2);
        assertEquals(rules[0].getTargetField(), "metadata.counts.totalItems");
        assertEquals(rules[1].getTargetField(), "metadata.counts.categories");
      }
    });

    it("should preserve aggregation options from schema", () => {
      const service = createAggregationService();

      const schema = {
        properties: {
          processedData: {
            type: "array",
            "x-derived-from": "$.data",
            "x-aggregation-options": {
              unique: true,
              flatten: true,
              skipNull: true,
            },
          },
        },
      };

      const result = service.extractRulesFromSchema(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data;
        assertEquals(rules.length, 1);

        assertEquals(rules[0].isUnique(), true);
        assertEquals(rules[0].shouldFlatten(), true);
      }
    });
  });
});
