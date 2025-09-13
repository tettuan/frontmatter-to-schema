/**
 * Count Where Expression Evaluator Tests
 *
 * Addresses Issue #723: Comprehensive test coverage for count_where functionality
 * Follows DDD, TDD, and Totality principles with Result<T,E> pattern validation
 * Tests the enhanced conditional counting operations for aggregation
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { ExpressionEvaluator } from "../../../../src/domain/aggregation/expression-evaluator.ts";

describe("ExpressionEvaluator - CountWhere Functionality", () => {
  let evaluator: ExpressionEvaluator;

  // Smart Constructor pattern - always create fresh evaluator
  function createEvaluator(): ExpressionEvaluator {
    return new ExpressionEvaluator();
  }

  describe("Basic CountWhere Operations - Totality Validation", () => {
    it("should create evaluator and return proper Result type", () => {
      evaluator = createEvaluator();
      assertExists(evaluator);
      
      const testData = [
        { status: "active", priority: 1 },
        { status: "inactive", priority: 2 }
      ];

      const result = evaluator.countWhere(testData, "$", "status === 'active'");

      // Totality: Result<T,E> pattern validation
      assertExists(result.ok);
      assertEquals(typeof result.ok, "boolean");
      if (result.ok) {
        assertExists(result.data);
        assertEquals(typeof result.data, "number");
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });

    it("should count items matching string equality condition", () => {
      evaluator = createEvaluator();
      const testData = [
        { status: "active", name: "task1" },
        { status: "inactive", name: "task2" },
        { status: "active", name: "task3" },
        { status: "completed", name: "task4" }
      ];

      const result = evaluator.countWhere(testData, "$", "status === 'active'");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });

    it("should count items matching string inequality condition", () => {
      evaluator = createEvaluator();
      const testData = [
        { type: "bug", severity: "high" },
        { type: "feature", severity: "medium" },
        { type: "bug", severity: "low" },
        { type: "task", severity: "high" }
      ];

      const result = evaluator.countWhere(testData, "$", "type !== 'bug'");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });
  });

  describe("Numeric Condition Operations", () => {
    it("should count items with numeric greater than condition", () => {
      evaluator = createEvaluator();
      const testData = [
        { priority: 1, title: "Low priority" },
        { priority: 3, title: "Medium priority" },
        { priority: 5, title: "High priority" },
        { priority: 2, title: "Low-medium priority" }
      ];

      const result = evaluator.countWhere(testData, "$", "priority > 2");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });

    it("should count items with numeric less than or equal condition", () => {
      evaluator = createEvaluator();
      const testData = [
        { score: 85, grade: "B" },
        { score: 92, grade: "A" },
        { score: 78, grade: "C" },
        { score: 88, grade: "B" }
      ];

      const result = evaluator.countWhere(testData, "$", "score <= 85");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });

    it("should count items with numeric greater than or equal condition", () => {
      evaluator = createEvaluator();
      const testData = [
        { temperature: 20.5, location: "room1" },
        { temperature: 18.2, location: "room2" },
        { temperature: 22.1, location: "room3" },
        { temperature: 19.8, location: "room4" }
      ];

      const result = evaluator.countWhere(testData, "$", "temperature >= 20");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });

    it("should count items with numeric less than condition", () => {
      evaluator = createEvaluator();
      const testData = [
        { age: 25, department: "engineering" },
        { age: 30, department: "design" },
        { age: 22, department: "marketing" },
        { age: 35, department: "sales" }
      ];

      const result = evaluator.countWhere(testData, "$", "age < 30");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });
  });

  describe("Boolean Condition Operations", () => {
    it("should count items with boolean true condition", () => {
      evaluator = createEvaluator();
      const testData = [
        { isActive: true, name: "service1" },
        { isActive: false, name: "service2" },
        { isActive: true, name: "service3" },
        { isActive: false, name: "service4" }
      ];

      const result = evaluator.countWhere(testData, "$", "isActive === true");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });

    it("should count items with boolean false condition", () => {
      evaluator = createEvaluator();
      const testData = [
        { isCompleted: true, task: "design" },
        { isCompleted: false, task: "implement" },
        { isCompleted: false, task: "test" },
        { isCompleted: true, task: "deploy" }
      ];

      const result = evaluator.countWhere(testData, "$", "isCompleted === false");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty data array", () => {
      evaluator = createEvaluator();
      const testData: unknown[] = [];

      const result = evaluator.countWhere(testData, "$", "status === 'active'");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 0);
      }
    });

    it("should handle null and undefined values gracefully", () => {
      evaluator = createEvaluator();
      const testData = [
        { status: "active", name: "task1" },
        null,
        { status: null, name: "task2" },
        undefined,
        { status: "active", name: "task3" }
      ];

      const result = evaluator.countWhere(testData, "$", "status === 'active'");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });

    it("should handle missing properties in data objects", () => {
      evaluator = createEvaluator();
      const testData = [
        { status: "active", name: "task1" },
        { name: "task2" }, // Missing status property
        { status: "active", name: "task3" },
        { description: "task4" } // Different properties
      ];

      const result = evaluator.countWhere(testData, "$", "status === 'active'");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });

    it("should handle invalid condition syntax", () => {
      evaluator = createEvaluator();
      const testData = [
        { status: "active", name: "task1" }
      ];

      const result = evaluator.countWhere(testData, "$", "invalid condition");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 0); // No matches for invalid conditions
      }
    });

    it("should handle quoted string values with single quotes", () => {
      evaluator = createEvaluator();
      const testData = [
        { category: "frontend", type: "component" },
        { category: "backend", type: "service" },
        { category: "frontend", type: "hook" }
      ];

      const result = evaluator.countWhere(testData, "$", "category === 'frontend'");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });

    it("should handle quoted string values with double quotes", () => {
      evaluator = createEvaluator();
      const testData = [
        { environment: "production", status: "running" },
        { environment: "development", status: "stopped" },
        { environment: "production", status: "pending" }
      ];

      const result = evaluator.countWhere(testData, "$", 'environment === "production"');

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 2);
      }
    });
  });

  describe("Complex Scenario Testing", () => {
    it("should handle real-world CLI command data", () => {
      evaluator = createEvaluator();
      const testData = [
        { c1: "climpt", c2: "debug", c3: "analyze", priority: 1 },
        { c1: "climpt", c2: "build", c3: "test", priority: 2 },
        { c1: "deno", c2: "test", c3: "coverage", priority: 1 },
        { c1: "climpt", c2: "meta", c3: "resolve", priority: 3 }
      ];

      const climptResult = evaluator.countWhere(testData, "$", "c1 === 'climpt'");
      assertEquals(climptResult.ok, true);
      if (climptResult.ok) {
        assertEquals(climptResult.data, 3);
      }

      const highPriorityResult = evaluator.countWhere(testData, "$", "priority === 1");
      assertEquals(highPriorityResult.ok, true);
      if (highPriorityResult.ok) {
        assertEquals(highPriorityResult.data, 2);
      }
    });

    it("should handle project issue tracking data", () => {
      evaluator = createEvaluator();
      const testData = [
        { id: "Issue-723", status: "open", priority: "high", type: "test" },
        { id: "Issue-726", status: "open", priority: "medium", type: "feature" },
        { id: "Issue-720", status: "closed", priority: "low", type: "bug" },
        { id: "Issue-725", status: "closed", priority: "high", type: "feature" }
      ];

      const openIssuesResult = evaluator.countWhere(testData, "$", "status === 'open'");
      assertEquals(openIssuesResult.ok, true);
      if (openIssuesResult.ok) {
        assertEquals(openIssuesResult.data, 2);
      }

      const highPriorityResult = evaluator.countWhere(testData, "$", "priority === 'high'");
      assertEquals(highPriorityResult.ok, true);
      if (highPriorityResult.ok) {
        assertEquals(highPriorityResult.data, 2);
      }
    });

    it("should handle nested data structures with array access", () => {
      evaluator = createEvaluator();
      const testData = [
        { project: "frontmatter-to-schema", metrics: { coverage: 80.1, tests: 646 } },
        { project: "ddd-architecture", metrics: { coverage: 75.5, tests: 423 } },
        { project: "totality-framework", metrics: { coverage: 85.2, tests: 789 } }
      ];

      // Note: This tests the ability to handle complex data even though 
      // the condition operates on top-level properties
      const result = evaluator.countWhere(testData, "$", "project !== 'unknown'");
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, 3);
      }
    });
  });

  describe("Integration with Aggregation Service Context", () => {
    it("should work with typical aggregation scenarios", () => {
      evaluator = createEvaluator();
      
      // Simulate data structure from aggregation service
      const wrappedData = [{
        commands: [
          { c1: "climpt", c2: "debug", status: "active" },
          { c1: "climpt", c2: "build", status: "inactive" },
          { c1: "deno", c2: "test", status: "active" },
          { c1: "climpt", c2: "meta", status: "active" }
        ]
      }];

      // Test direct array access pattern used in aggregation service
      if (wrappedData.length === 1 && 
          typeof wrappedData[0] === 'object' && 
          wrappedData[0] !== null &&
          'commands' in wrappedData[0]) {
        const targetArray = (wrappedData[0] as { commands: unknown[] }).commands;
        
        const result = evaluator.countWhere(targetArray, "$", "status === 'active'");
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, 3);
        }
      }
    });
  });
});