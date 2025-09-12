/**
 * Test suite for x-derived-count and x-derived-average aggregation features
 *
 * Tests the new count and average operations for schema extensions
 * following DDD principles and Totality patterns.
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ExpressionEvaluator } from "../../../../src/domain/aggregation/expression-evaluator.ts";
import { SchemaAggregationAdapter } from "../../../../src/application/services/schema-aggregation-adapter.ts";
import { SchemaTemplateInfo } from "../../../../src/domain/models/schema-extensions.ts";
import { SchemaExtensionRegistryFactory } from "../../../../src/domain/schema/factories/schema-extension-registry-factory.ts";
import type { ExtendedSchema } from "../../../../src/domain/models/schema-extensions.ts";

describe("x-derived-count and x-derived-average Features", () => {
  // Test data - sample documents with numeric values
  const testDocuments = [
    {
      name: "Document 1",
      score: 85,
      tags: ["frontend", "react", "typescript"],
      items: [
        { value: 10, category: "A" },
        { value: 20, category: "B" },
        { value: 30, category: "A" },
      ],
    },
    {
      name: "Document 2",
      score: 92,
      tags: ["backend", "node", "javascript"],
      items: [
        { value: 15, category: "B" },
        { value: 25, category: "C" },
      ],
    },
    {
      name: "Document 3",
      score: 78,
      tags: ["fullstack", "react", "node"],
      items: [
        { value: 12, category: "A" },
        { value: 18, category: "B" },
        { value: 22, category: "C" },
        { value: 28, category: "A" },
      ],
    },
  ];

  describe("ExpressionEvaluator Count Operations", () => {
    it("should count total documents", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.count(testDocuments, "$.name");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 3);
      }
    });

    it("should count array elements across all documents", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.count(testDocuments, "$.tags[]");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 9); // Total tags across all documents (3+3+3=9)
      }
    });

    it("should count nested array elements", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.count(testDocuments, "$.items[]");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 9); // Total items across all documents
      }
    });

    it("should return 0 for non-existent fields", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.count(testDocuments, "$.nonexistent");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 0);
      }
    });
  });

  describe("ExpressionEvaluator Average Operations", () => {
    it("should calculate average of numeric field", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.average(testDocuments, "$.score");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, (85 + 92 + 78) / 3); // 85
      }
    });

    it("should calculate average of nested numeric values", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.average(testDocuments, "$.items[].value");

      assertEquals(result.ok, true);
      if (result.ok) {
        // Values: 10, 20, 30, 15, 25, 12, 18, 22, 28
        const expectedAverage = (10 + 20 + 30 + 15 + 25 + 12 + 18 + 22 + 28) /
          9;
        assertEquals(result.data, expectedAverage); // 20
      }
    });

    it("should handle string numbers", () => {
      const evaluator = new ExpressionEvaluator();
      const docsWithStringNumbers = [
        { value: "10" },
        { value: "20.5" },
        { value: "30" },
      ];

      const result = evaluator.average(docsWithStringNumbers, "$.value");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, (10 + 20.5 + 30) / 3);
      }
    });

    it("should return error for non-numeric values", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.average(testDocuments, "$.name");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "NoNumericValues");
      }
    });

    it("should return error for non-existent fields", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.average(testDocuments, "$.nonexistent");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "NoNumericValues");
      }
    });
  });

  describe("Schema Template Info with Count/Average", () => {
    it("should extract x-derived-count rules", () => {
      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          totalDocuments: {
            type: "number",
            "x-derived-count": "$.name",
          },
          totalTags: {
            type: "number",
            "x-derived-count": "$.tags[]",
          },
        },
      };

      const result = SchemaTemplateInfo.extract(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data.getDerivationRules();
        assertEquals(rules.size, 2);

        const totalDocsRule = rules.get("totalDocuments");
        assertExists(totalDocsRule);
        assertEquals(totalDocsRule.operation, "count");
        assertEquals(totalDocsRule.operationSource, "$.name");
        assertEquals(totalDocsRule.sourceExpression, "count($.name)");

        const totalTagsRule = rules.get("totalTags");
        assertExists(totalTagsRule);
        assertEquals(totalTagsRule.operation, "count");
        assertEquals(totalTagsRule.operationSource, "$.tags[]");
        assertEquals(totalTagsRule.sourceExpression, "count($.tags[])");
      }
    });

    it("should extract x-derived-average rules", () => {
      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          averageScore: {
            type: "number",
            "x-derived-average": "$.score",
          },
          averageItemValue: {
            type: "number",
            "x-derived-average": "$.items[].value",
          },
        },
      };

      const result = SchemaTemplateInfo.extract(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data.getDerivationRules();
        assertEquals(rules.size, 2);

        const avgScoreRule = rules.get("averageScore");
        assertExists(avgScoreRule);
        assertEquals(avgScoreRule.operation, "average");
        assertEquals(avgScoreRule.operationSource, "$.score");
        assertEquals(avgScoreRule.sourceExpression, "average($.score)");

        const avgItemRule = rules.get("averageItemValue");
        assertExists(avgItemRule);
        assertEquals(avgItemRule.operation, "average");
        assertEquals(avgItemRule.operationSource, "$.items[].value");
        assertEquals(avgItemRule.sourceExpression, "average($.items[].value)");
      }
    });

    it("should handle mixed derivation types", () => {
      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          allNames: {
            type: "array",
            "x-derived-from": "$.name",
          },
          totalCount: {
            type: "number",
            "x-derived-count": "$.name",
          },
          avgScore: {
            type: "number",
            "x-derived-average": "$.score",
          },
        },
      };

      const result = SchemaTemplateInfo.extract(schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const rules = result.data.getDerivationRules();
        assertEquals(rules.size, 3);

        const namesRule = rules.get("allNames");
        assertExists(namesRule);
        assertEquals(namesRule.operation, "from");
        assertEquals(namesRule.sourceExpression, "$.name");

        const countRule = rules.get("totalCount");
        assertExists(countRule);
        assertEquals(countRule.operation, "count");
        assertEquals(countRule.sourceExpression, "count($.name)");

        const avgRule = rules.get("avgScore");
        assertExists(avgRule);
        assertEquals(avgRule.operation, "average");
        assertEquals(avgRule.sourceExpression, "average($.score)");
      }
    });
  });

  describe("Schema Aggregation Adapter Integration", () => {
    it("should process count and average operations end-to-end", () => {
      const registryResult = SchemaExtensionRegistryFactory.createDefault();
      assertEquals(registryResult.ok, true);

      if (!registryResult.ok) return;

      const adapter = new SchemaAggregationAdapter(registryResult.data);

      const schema: ExtendedSchema = {
        type: "object",
        properties: {
          totalDocuments: {
            type: "number",
            "x-derived-count": "$.name",
          },
          averageScore: {
            type: "number",
            "x-derived-average": "$.score",
          },
          totalTags: {
            type: "number",
            "x-derived-count": "$.tags[]",
          },
          allNames: {
            type: "array",
            "x-derived-from": "$.name",
          },
        },
      };

      const result = adapter.processAggregation(testDocuments, schema);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data;

        // Count operations
        assertEquals(data.totalDocuments, 3);
        assertEquals(data.totalTags, 9); // 3+3+3=9 total tags

        // Average operation
        assertEquals(data.averageScore, (85 + 92 + 78) / 3);

        // Traditional from operation
        assertEquals(Array.isArray(data.allNames), true);
        const names = data.allNames as string[];
        assertEquals(names.length, 3);
        assertEquals(names.includes("Document 1"), true);
        assertEquals(names.includes("Document 2"), true);
        assertEquals(names.includes("Document 3"), true);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid count expressions gracefully", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.count(testDocuments, "invalid expression");

      assertEquals(result.ok, true); // Count operation handles invalid expressions by returning 0
      if (result.ok) {
        assertEquals(result.data, 0);
      }
    });

    it("should handle invalid average expressions gracefully", () => {
      const evaluator = new ExpressionEvaluator();

      const result = evaluator.average(testDocuments, "invalid expression");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "NoNumericValues"); // Invalid expressions result in no numeric values
      }
    });

    it("should handle mixed numeric and non-numeric values in average", () => {
      const evaluator = new ExpressionEvaluator();
      const mixedData = [
        { value: 10 },
        { value: "not a number" },
        { value: 20 },
      ];

      const result = evaluator.average(mixedData, "$.value");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 15); // Only counts numeric values: (10 + 20) / 2
      }
    });
  });
});
