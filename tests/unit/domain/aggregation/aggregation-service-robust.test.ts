/**
 * Robust Aggregation Service Tests
 * 
 * Addresses Issue #666: Critical test gaps for aggregation methods
 * Tests Issue #673 implementation: x-derived-from context resolution
 * Validates DDD principles and Totality patterns
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { createAggregationService } from "../../../../src/domain/aggregation/aggregation-service.ts";
import { SchemaExtensionRegistryFactory } from "../../../../src/domain/schema/factories/schema-extension-registry-factory.ts";
import { AggregationContext, DerivationRule } from "../../../../src/domain/aggregation/value-objects.ts";
import type { Result } from "../../../../src/domain/core/result.ts";

describe("AggregationService - Robust Domain Tests", () => {
  
  // Smart Constructor for test service creation
  function createTestService() {
    const registryResult = SchemaExtensionRegistryFactory.createDefault();
    if (!registryResult.ok) {
      throw new Error(`Failed to create registry: ${registryResult.error.message}`);
    }
    return createAggregationService(registryResult.data);
  }

  describe("Service Creation - Constructor Validation", () => {
    it("should create service with valid registry", () => {
      const service = createTestService();
      assertExists(service);
    });

    it("should maintain registry dependency", () => {
      const registryResult = SchemaExtensionRegistryFactory.createDefault();
      assertEquals(registryResult.ok, true);
      
      if (registryResult.ok) {
        const service = createAggregationService(registryResult.data);
        assertExists(service);
      }
    });
  });

  describe("Core Aggregation - Business Logic Validation", () => {
    it("should aggregate simple derivation rules", async () => {
      const service = createTestService();
      
      const ruleResult = DerivationRule.create(
        "availableConfigs",
        "commands[].c1",
        { unique: true, flatten: false }
      );
      
      assertEquals(ruleResult.ok, true);
      if (!ruleResult.ok) return;

      const context = AggregationContext.create([ruleResult.data], {
        skipNull: true,
        skipUndefined: true
      });

      const testData = [
        { commands: [{ c1: "git" }, { c1: "debug" }] },
        { commands: [{ c1: "refactor" }] }
      ];

      const result = service.aggregate(testData, context);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertExists(data.availableConfigs);
        assertEquals(Array.isArray(data.availableConfigs), true);
        // Should contain unique values: git, debug, refactor
        assertEquals((data.availableConfigs as unknown[]).length, 3);
      }
    });

    it("should handle nested structure context resolution", async () => {
      const service = createTestService();
      
      // Test the Issue #673 fix: context resolution for nested structures
      const ruleResult = DerivationRule.create(
        "tools.availableConfigs", 
        "commands[].c1",  // This should resolve to "tools.commands[].c1"
        { unique: true, flatten: false }
      );
      
      assertEquals(ruleResult.ok, true);
      if (!ruleResult.ok) return;

      const context = AggregationContext.create([ruleResult.data], {
        skipNull: true,
        skipUndefined: true
      });

      const testData = [
        {
          tools: {
            commands: [{ c1: "git", c2: "merge-up" }, { c1: "debug", c2: "analyze" }]
          }
        }
      ];

      const result = service.aggregate(testData, context);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertExists(data["tools.availableConfigs"]);
        const configs = data["tools.availableConfigs"] as string[];
        assertEquals(Array.isArray(configs), true);
        assertEquals(configs.includes("git"), true);
        assertEquals(configs.includes("debug"), true);
      }
    });

    it("should apply uniqueness filtering correctly", async () => {
      const service = createTestService();
      
      const ruleResult = DerivationRule.create(
        "uniqueTypes",
        "items[].type",
        { unique: true, flatten: false }
      );
      
      assertEquals(ruleResult.ok, true);
      if (!ruleResult.ok) return;

      const context = AggregationContext.create([ruleResult.data], {
        skipNull: true,
        skipUndefined: true
      });

      const testData = [
        { items: [{ type: "A" }, { type: "B" }, { type: "A" }] },
        { items: [{ type: "B" }, { type: "C" }] }
      ];

      const result = service.aggregate(testData, context);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        const uniqueTypes = data.uniqueTypes as string[];
        assertEquals(uniqueTypes.length, 3); // A, B, C (unique)
        assertEquals(uniqueTypes.includes("A"), true);
        assertEquals(uniqueTypes.includes("B"), true);
        assertEquals(uniqueTypes.includes("C"), true);
      }
    });
  });

  describe("Schema Rule Extraction - DDD Boundary Testing", () => {
    it("should extract rules from valid schema", () => {
      const service = createTestService();
      
      const schema = {
        type: "object",
        properties: {
          derivedField: {
            type: "array",
            "x-derived-from": "source[].prop",
            "x-derived-unique": true,
            items: { type: "string" }
          }
        }
      };

      const result = service.extractRulesFromSchema(schema);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 1);
        const rule = result.data[0];
        assertEquals(rule.getTargetField(), "derivedField");
        assertEquals(rule.getSourceExpression(), "source[].prop");
        assertEquals(rule.isUnique(), true);
      }
    });

    it("should handle schema without derivation rules", () => {
      const service = createTestService();
      
      const schema = {
        type: "object",
        properties: {
          normalField: {
            type: "string"
          }
        }
      };

      const result = service.extractRulesFromSchema(schema);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 0);
      }
    });

    it("should handle malformed schema gracefully", () => {
      const service = createTestService();
      
      const result = service.extractRulesFromSchema({});
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.length, 0);
      }
    });
  });

  describe("Error Handling - Totality Validation", () => {
    it("should handle invalid aggregation context", async () => {
      const service = createTestService();
      
      // Create invalid rule to test error handling
      const invalidRuleResult = DerivationRule.create(
        "", // Invalid empty field name
        "valid[].expression",
        { unique: false, flatten: false }
      );

      // Should fail to create invalid rule
      assertEquals(invalidRuleResult.ok, false);
    });

    it("should handle empty data arrays", async () => {
      const service = createTestService();
      
      const ruleResult = DerivationRule.create(
        "field",
        "items[].prop",
        { unique: false, flatten: false }
      );
      
      assertEquals(ruleResult.ok, true);
      if (!ruleResult.ok) return;

      const context = AggregationContext.create([ruleResult.data], {
        skipNull: true,
        skipUndefined: true
      });

      const result = service.aggregate([], context);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(Array.isArray(data.field), true);
        assertEquals((data.field as unknown[]).length, 0);
      }
    });

    it("should handle data with missing properties", async () => {
      const service = createTestService();
      
      const ruleResult = DerivationRule.create(
        "derived",
        "missing[].prop",
        { unique: false, flatten: false }
      );
      
      assertEquals(ruleResult.ok, true);
      if (!ruleResult.ok) return;

      const context = AggregationContext.create([ruleResult.data], {
        skipNull: true,
        skipUndefined: true
      });

      const testData = [
        { existing: "value" },
        { other: "data" }
      ];

      const result = service.aggregate(testData, context);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data.getData();
        assertEquals(Array.isArray(data.derived), true);
        assertEquals((data.derived as unknown[]).length, 0);
      }
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large datasets efficiently", async () => {
      const service = createTestService();
      
      const ruleResult = DerivationRule.create(
        "categories",
        "items[].category",
        { unique: true, flatten: false }
      );
      
      assertEquals(ruleResult.ok, true);
      if (!ruleResult.ok) return;

      const context = AggregationContext.create([ruleResult.data], {
        skipNull: true,
        skipUndefined: true
      });

      // Generate large test dataset
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        items: [
          { category: `cat-${i % 10}` }, // 10 unique categories
          { category: `cat-${(i + 1) % 10}` }
        ]
      }));

      const startTime = performance.now();
      const result = service.aggregate(largeData, context);
      const endTime = performance.now();
      
      assertEquals(result.ok, true);
      if (result.ok) {
        const categories = result.data.getData().categories as string[];
        assertEquals(categories.length, 10); // Should have 10 unique categories
      }
      
      // Performance validation
      const executionTime = endTime - startTime;
      assertEquals(executionTime < 500, true, `Execution took ${executionTime}ms, expected < 500ms`);
    });
  });

  describe("Applied Aggregated Data - Template Integration", () => {
    it("should apply aggregated data to base template correctly", () => {
      const service = createTestService();
      
      const baseTemplate = {
        version: "1.0.0",
        placeholder: "to-be-replaced"
      };

      const aggregatedData = {
        tools: {
          configs: ["git", "debug"]
        }
      };

      // Create valid AggregatedResult through aggregation
      const ruleResult = DerivationRule.create(
        "tools.configs",
        "[].value", // dummy expression
        { unique: false, flatten: false }
      );
      
      if (!ruleResult.ok) return;

      const context = AggregationContext.create([ruleResult.data], {
        skipNull: true,
        skipUndefined: true
      });

      const mockResult = service.aggregate([{ value: "test" }], context);
      
      if (!mockResult.ok) return;

      const result = service.applyAggregatedData(baseTemplate, mockResult.data);
      
      assertExists(result);
      assertEquals(result.version, "1.0.0");
      // Should preserve original structure while applying aggregation
    });
  });
});