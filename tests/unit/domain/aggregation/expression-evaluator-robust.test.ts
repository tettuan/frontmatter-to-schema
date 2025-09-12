/**
 * Robust Expression Evaluator Tests
 *
 * Addresses Issue #666: Test specification gaps for critical methods
 * Focuses on x-derived-from context resolution (Issue #673 implementation)
 * Follows DDD, Totality, and AI complexity control principles
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { ExpressionEvaluator } from "../../../../src/domain/aggregation/expression-evaluator.ts";

describe("ExpressionEvaluator - Robust Domain Tests", () => {
  let evaluator: ExpressionEvaluator;

  // Smart Constructor pattern - always create fresh evaluator
  function createEvaluator(): ExpressionEvaluator {
    return new ExpressionEvaluator();
  }

  describe("Core Functionality - Totality Validation", () => {
    it("should create evaluator instance", () => {
      evaluator = createEvaluator();
      assertExists(evaluator);
    });

    it("should return Result type for all operations", () => {
      evaluator = createEvaluator();
      const testData = { items: [{ value: "test" }] };

      const result = evaluator.evaluate(testData, "items[].value");

      // Totality: Result<T,E> pattern validation
      assertExists(result.ok);
      assertEquals(typeof result.ok, "boolean");
      if (result.ok) {
        assertExists(result.data);
        assertEquals(Array.isArray(result.data), true);
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });
  });

  describe("Expression Evaluation - Core Scenarios", () => {
    it("should handle simple array property extraction", () => {
      evaluator = createEvaluator();
      const data = {
        commands: [
          { c1: "git", c2: "commit" },
          { c1: "debug", c2: "analyze" },
        ],
      };

      const result = evaluator.evaluate(data, "commands[*].c1");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["git", "debug"]);
      }
    });

    it("should handle nested structure navigation", () => {
      evaluator = createEvaluator();
      const data = {
        tools: {
          commands: [
            { c1: "refactor", c2: "ddd" },
            { c1: "build", c2: "robust" },
          ],
        },
      };

      const result = evaluator.evaluate(data, "tools.commands[*].c1");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["refactor", "build"]);
      }
    });

    it("should handle deep nesting with multiple arrays", () => {
      evaluator = createEvaluator();
      const data = {
        projects: [
          {
            modules: [
              { tools: [{ name: "climpt" }, { name: "totality" }] },
            ],
          },
        ],
      };

      const result = evaluator.evaluate(
        data,
        "projects[*].modules[*].tools[*].name",
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["climpt", "totality"]);
      }
    });
  });

  describe("Error Handling - Totality Principle", () => {
    it("should return error for invalid expressions", () => {
      evaluator = createEvaluator();
      const data = { test: "value" };

      const result = evaluator.evaluate(data, "invalid[[]expression");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidExpression");
        assertExists(result.error.message);
      }
    });

    it("should handle null/undefined data gracefully", () => {
      evaluator = createEvaluator();

      const nullResult = evaluator.evaluate(null, "test[].prop");
      const undefinedResult = evaluator.evaluate(undefined, "test[].prop");

      assertEquals(nullResult.ok, true);
      assertEquals(undefinedResult.ok, true);
      if (nullResult.ok) {
        assertEquals(nullResult.data, []);
      }
      if (undefinedResult.ok) {
        assertEquals(undefinedResult.data, []);
      }
    });

    it("should handle missing properties without errors", () => {
      evaluator = createEvaluator();
      const data = { existing: "value" };

      const result = evaluator.evaluate(data, "missing[].prop");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, []);
      }
    });
  });

  describe("Unique Value Extraction - Business Logic", () => {
    it("should extract unique values correctly", () => {
      evaluator = createEvaluator();
      const data = [
        { items: [{ name: "test1" }, { name: "test2" }] },
        { items: [{ name: "test1" }, { name: "test3" }] },
      ];

      const result = evaluator.extractUnique(data, "[*].items[*].name");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 3);
        assertEquals(result.data.includes("test1"), true);
        assertEquals(result.data.includes("test2"), true);
        assertEquals(result.data.includes("test3"), true);
      }
    });

    it("should handle complex object uniqueness", () => {
      evaluator = createEvaluator();
      const data = [
        { configs: [{ type: "git", active: true }] },
        {
          configs: [{ type: "git", active: true }, {
            type: "debug",
            active: false,
          }],
        },
      ];

      const result = evaluator.extractUnique(data, "[*].configs[*]");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 2); // Unique by JSON serialization
      }
    });
  });

  describe("Edge Cases - Robustness Testing", () => {
    it("should handle empty arrays", () => {
      evaluator = createEvaluator();
      const data = { items: [] };

      const result = evaluator.evaluate(data, "items[*].prop");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, []);
      }
    });

    it("should handle deeply nested empty structures", () => {
      evaluator = createEvaluator();
      const data = {
        level1: {
          level2: {
            level3: [],
          },
        },
      };

      const result = evaluator.evaluate(data, "level1.level2.level3[*].prop");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, []);
      }
    });

    it("should handle mixed data types in arrays", () => {
      evaluator = createEvaluator();
      const data = {
        mixed: [
          { value: "string" },
          { value: 123 },
          { value: true },
          { value: null },
        ],
      };

      const result = evaluator.evaluate(data, "mixed[*].value");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 4);
        assertEquals(result.data, ["string", 123, true, null]);
      }
    });
  });

  describe("Performance and Stability", () => {
    it("should handle large datasets efficiently", () => {
      evaluator = createEvaluator();

      // Generate large test dataset
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `item-${i}`,
          category: i % 10,
        })),
      };

      const startTime = performance.now();
      const result = evaluator.evaluate(largeData, "items[*].category");
      const endTime = performance.now();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1000);
      }

      // Performance assertion - should complete within reasonable time
      const executionTime = endTime - startTime;
      assertEquals(
        executionTime < 100,
        true,
        `Execution took ${executionTime}ms, expected < 100ms`,
      );
    });

    it("should be memory efficient with unique extraction", () => {
      evaluator = createEvaluator();

      // Create data with many duplicates
      const data = Array.from({ length: 100 }, () => ({
        values: [{ type: "duplicate" }, { type: "unique", id: Math.random() }],
      }));

      const result = evaluator.extractUnique(data, "[*].values[*].type");

      assertEquals(result.ok, true);
      if (result.ok) {
        // Should contain "duplicate" once and "unique" once
        assertEquals(result.data.includes("duplicate"), true);
        assertEquals(result.data.includes("unique"), true);
        assertEquals(result.data.length <= 2, true);
      }
    });
  });
});
