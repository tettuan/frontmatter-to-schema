/**
 * Robust Aggregation Domain Tests
 *
 * Demonstrates robust testing patterns using domain-focused helpers.
 * Follows DDD, Totality, and AI complexity control principles.
 */

import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import {
  DomainAssertions,
  DomainDataFactory,
  MockFactory,
  ResultTestHelpers,
  TestEnvironment,
} from "../../../helpers/domain-test-helpers.ts";
import {
  AggregationContext,
  DerivationRule,
} from "../../../../src/domain/aggregation/value-objects.ts";
import { createAggregationService } from "../../../../src/domain/aggregation/aggregation-service.ts";
import { SchemaExtensionRegistryFactory } from "../../../../src/domain/schema/factories/schema-extension-registry-factory.ts";

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

describe("Robust Aggregation Domain Tests", () => {
  describe("DerivationRule - Value Object Integrity", () => {
    it("should maintain immutability and validation rules", () => {
      const testRules = DomainDataFactory.createTestAggregationRules();

      // Test successful creation with robust assertion
      const result = DerivationRule.create(
        testRules.simple.targetField,
        testRules.simple.sourceExpression,
        testRules.simple.options,
      );

      const rule = ResultTestHelpers.assertSuccess(result);

      // Domain-specific assertions
      DomainAssertions.assertValidValueObject(
        rule,
        (r) =>
          r.getTargetField().length > 0 &&
          r.getSourceExpression().startsWith("$"),
        "DerivationRule should follow domain validation rules",
      );

      // Verify immutability
      assertEquals(rule.getTargetField(), testRules.simple.targetField);
      assertEquals(
        rule.getSourceExpression(),
        testRules.simple.sourceExpression,
      );
      assertEquals(rule.isUnique(), testRules.simple.options.unique);
      assertEquals(rule.shouldFlatten(), testRules.simple.options.flatten);
    });

    it("should properly validate business rules for field names", () => {
      const invalidCases = [
        {
          field: "",
          expression: "$.valid",
          expectedError: "InvalidTargetField",
        },
        {
          field: "valid",
          expression: "",
          expectedError: "InvalidSourceExpression",
        },
        {
          field: "123invalid",
          expression: "$.valid",
          expectedError: "InvalidTargetField",
        },
        {
          field: "valid",
          expression: "$invalid",
          expectedError: "InvalidSourceExpression",
        },
      ];

      for (const testCase of invalidCases) {
        const result = DerivationRule.create(
          testCase.field,
          testCase.expression,
        );
        ResultTestHelpers.assertError(
          result,
          testCase.expectedError,
          `Should reject invalid input: ${testCase.field} -> ${testCase.expression}`,
        );
      }
    });
  });

  describe("AggregationService - Business Logic Robustness", () => {
    it("should handle complex aggregation scenarios with predictable results", async () => {
      await TestEnvironment.withCleanup(
        () => {
          const service = createTestAggregationService();

          // Use consistent test data
          const testDocuments = [
            DomainDataFactory.createTestFrontmatter({
              title: "Doc 1",
              tags: ["test", "example"],
              priority: 1,
            }),
            DomainDataFactory.createTestFrontmatter({
              title: "Doc 2",
              tags: ["test", "demo"],
              priority: 2,
            }),
            DomainDataFactory.createTestFrontmatter({
              title: "Doc 3",
              tags: ["example", "demo"],
              priority: 1,
            }),
          ];

          // Create aggregation rules with domain factory
          const rules = DomainDataFactory.createTestAggregationRules();

          const titleRule = ResultTestHelpers.assertSuccess(
            DerivationRule.create(
              rules.simple.targetField,
              rules.simple.sourceExpression,
            ),
          );

          const tagRule = ResultTestHelpers.assertSuccess(
            DerivationRule.create(
              rules.unique.targetField,
              rules.unique.sourceExpression,
              rules.unique.options,
            ),
          );

          const context = AggregationContext.create([titleRule, tagRule]);

          // Test aggregation business logic
          const result = service.aggregate(testDocuments, context);
          const aggregated = ResultTestHelpers.assertSuccess(result);

          // Domain-specific assertions for business rules
          const data = aggregated.getData();
          DomainAssertions.assertAggregationResult(
            data,
            [rules.simple.targetField, rules.unique.targetField],
            "Aggregation should produce expected field structure",
          );

          // Verify business logic correctness
          assertEquals(
            (data[rules.simple.targetField] as string[]).length,
            3,
            "Should aggregate all titles",
          );
          assertEquals(
            new Set(data[rules.unique.targetField] as string[]).size,
            3,
            "Should have unique tags: test, example, demo",
          );
        },
        () => {
          // Cleanup is handled by TestEnvironment
          TestEnvironment.cleanup();
        },
      )();
    });

    it("should maintain data integrity under edge conditions", () => {
      const service = createTestAggregationService();

      // Test null safety and error handling
      const edgeCases = [
        { data: [], description: "empty input" },
        { data: [{}], description: "empty objects" },
        { data: [null, undefined], description: "null values" },
        {
          data: [{ nested: { deep: null } }],
          description: "nested null values",
        },
      ];

      const rule = ResultTestHelpers.assertSuccess(
        DerivationRule.create("testField", "$.nonexistent"),
      );
      const context = AggregationContext.create([rule]);

      for (const testCase of edgeCases) {
        const result = service.aggregate(testCase.data as unknown[], context);
        const aggregated = ResultTestHelpers.assertSuccess(
          result,
          `Should handle ${testCase.description} gracefully`,
        );

        const data = aggregated.getData();
        assertEquals(
          Array.isArray(data.testField),
          true,
          `Should produce array result for ${testCase.description}`,
        );
      }
    });
  });

  describe("Schema Extraction - Domain Boundary Testing", () => {
    it("should properly parse schema with domain validation", () => {
      const service = createTestAggregationService();

      // Use domain factory for consistent schema structure
      const baseSchema = DomainDataFactory.createTestSchema();
      const baseProperties = baseSchema.properties as Record<string, unknown>;
      const testSchema = DomainDataFactory.createTestSchema({
        properties: {
          ...baseProperties,
          aggregatedTitles: {
            type: "array",
            "x-derived-from": "$.title",
            "x-template-aggregation-options": {
              unique: true,
              flatten: false,
            },
          },
        },
      });

      const result = service.extractRulesFromSchema(testSchema);
      const rules = ResultTestHelpers.assertSuccess(result);

      // Domain boundary validation
      assertEquals(
        rules.length,
        1,
        "Should extract exactly one aggregation rule",
      );

      const rule = rules[0];
      assertEquals(rule.getTargetField(), "aggregatedTitles");
      assertEquals(rule.getSourceExpression(), "$.title");
      assertEquals(rule.isUnique(), true);

      // Verify domain consistency
      DomainAssertions.assertValidValueObject(
        rule,
        (r) =>
          r.getTargetField().length > 0 &&
          r.getSourceExpression().startsWith("$"),
        "Extracted rule should follow domain patterns",
      );
    });

    it("should handle malformed schemas with proper error boundaries", () => {
      const service = createTestAggregationService();

      const malformedSchemas = [
        { schema: null, description: "null schema" },
        { schema: undefined, description: "undefined schema" },
        { schema: "not an object", description: "string input" },
        { schema: [], description: "array input" },
        { schema: { properties: null }, description: "null properties" },
      ];

      for (const testCase of malformedSchemas) {
        const result = service.extractRulesFromSchema(
          testCase.schema as unknown as Record<string, unknown>,
        );

        // Should gracefully handle all malformed inputs
        const rules = ResultTestHelpers.assertSuccess(
          result,
          `Should handle ${testCase.description} gracefully`,
        );

        assertEquals(
          rules.length,
          0,
          `Should return empty rules for ${testCase.description}`,
        );
      }
    });
  });

  describe("Integration - End-to-End Domain Scenarios", () => {
    it("should process complete aggregation workflow with domain integrity", async () => {
      await TestEnvironment.withCleanup(
        () => {
          const mockLogger = MockFactory.createMockLogger();
          const service = createTestAggregationService();

          // Create realistic domain scenario
          const documents = [
            DomainDataFactory.createTestFrontmatter({
              title: "Architecture Guide",
              category: "documentation",
              tags: ["architecture", "guide"],
              author: "System Architect",
            }),
            DomainDataFactory.createTestFrontmatter({
              title: "API Reference",
              category: "documentation",
              tags: ["api", "reference", "guide"],
              author: "API Developer",
            }),
            DomainDataFactory.createTestFrontmatter({
              title: "Testing Strategy",
              category: "testing",
              tags: ["testing", "strategy"],
              author: "QA Engineer",
            }),
          ];

          // Create schema with business rules
          const schema = DomainDataFactory.createTestSchema({
            properties: {
              allTitles: {
                type: "array",
                "x-derived-from": "$.title",
              },
              uniqueCategories: {
                type: "array",
                "x-derived-from": "$.category",
                "x-template-aggregation-options": { unique: true },
              },
              allAuthors: {
                type: "array",
                "x-derived-from": "$.author",
                "x-template-aggregation-options": { unique: true },
              },
            },
          });

          // Extract rules and aggregate
          const rulesResult = service.extractRulesFromSchema(schema);
          const rules = ResultTestHelpers.assertSuccess(rulesResult);

          const context = AggregationContext.create(rules);
          const aggregationResult = service.aggregate(documents, context);
          const aggregated = ResultTestHelpers.assertSuccess(aggregationResult);

          // Verify complete workflow integrity
          const data = aggregated.getData();
          DomainAssertions.assertAggregationResult(
            data,
            ["allTitles", "uniqueCategories", "allAuthors"],
            "Complete workflow should produce all expected fields",
          );

          // Verify business logic
          assertEquals(
            (data.allTitles as string[]).length,
            3,
            "Should capture all titles",
          );
          assertEquals(
            (data.uniqueCategories as string[]).length,
            2,
            "Should have 2 unique categories",
          );
          assertEquals(
            (data.allAuthors as string[]).length,
            3,
            "Should have 3 unique authors",
          );

          // Verify no side effects
          assertEquals(
            mockLogger.getMessages().length,
            0,
            "Should not produce unexpected log messages",
          );
        },
        () => {
          TestEnvironment.cleanup();
        },
      )();
    });
  });
});
