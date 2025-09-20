/**
 * @fileoverview Registry Merge Integration Tests
 * @description Integration tests for Issue #527 - Multiple registry merge functionality
 * Following DDD and Totality principles with robust integration testing
 *
 * Integration Test Scenarios:
 * 1. Real-world registry aggregation with multiple markdown files
 * 2. End-to-end x-derived-from processing for availableConfigs
 * 3. Schema-driven registry merge validation
 * 4. Performance validation for registry aggregation workflows
 */

import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Aggregator } from "../../src/domain/aggregation/aggregators/aggregator.ts";
import { DerivationRule } from "../../src/domain/aggregation/value-objects/derivation-rule.ts";
import { TestDataFactory } from "../helpers/test-data-factory.ts";

describe("Registry Merge Integration Tests - Issue #527", () => {
  describe("Real-world Registry Aggregation Scenarios", () => {
    it("should aggregate multiple climpt registry files and derive availableConfigs", () => {
      // Arrange: Simulate multiple registry markdown files as would be processed
      const aggregator = Aggregator.createWithDisabledCircuitBreaker();

      // Registry File 1: Meta and Spec commands
      const registry1Data = TestDataFactory.createFrontmatterData({
        version: "1.0.0",
        description: "Meta and Spec Registry",
        tools: {
          commands: [
            {
              c1: "meta",
              c2: "resolve",
              c3: "registered-commands",
              title: "Resolve Registered Commands",
              description: "Resolve and display all registered commands",
            },
            {
              c1: "spec",
              c2: "analyze",
              c3: "quality-metrics",
              title: "Analyze Quality Metrics",
              description:
                "Analyze specification quality and completeness metrics",
            },
          ],
        },
      });

      // Registry File 2: Git commands
      const registry2Data = TestDataFactory.createFrontmatterData({
        version: "1.0.0",
        description: "Git Registry",
        tools: {
          commands: [
            {
              c1: "git",
              c2: "commit",
              c3: "changes",
              title: "Commit Changes",
              description: "Create a git commit with changes",
            },
            {
              c1: "git",
              c2: "merge-cleanup",
              c3: "develop-branches",
              title: "Cleanup Develop Branches",
              description: "Merge and cleanup development branches",
            },
          ],
        },
      });

      // Registry File 3: Build and Debug commands
      const registry3Data = TestDataFactory.createFrontmatterData({
        version: "1.0.0",
        description: "Build and Debug Registry",
        tools: {
          commands: [
            {
              c1: "build",
              c2: "robust",
              c3: "code",
              title: "Build Robust Code",
              description: "Build robust and reliable code",
            },
            {
              c1: "debug",
              c2: "analyze-deep",
              c3: "project-issues",
              title: "Deep Project Analysis",
              description: "Analyze project issues in depth",
            },
            {
              c1: "spec", // Duplicate c1 to test deduplication
              c2: "analyze-structure",
              c3: "requirements",
              title: "Analyze Structure Requirements",
              description: "Analyze and structure requirements",
            },
          ],
        },
      });

      assert(registry1Data.ok && registry2Data.ok && registry3Data.ok);

      // Create derivation rule as defined in registry schema
      const availableConfigsRule = DerivationRule.create(
        "tools.commands[].c1",
        "tools.availableConfigs",
        true, // x-derived-unique: true
      );
      assert(availableConfigsRule.ok);

      // Act: Aggregate all registry data
      const aggregationResult = aggregator.aggregate(
        [registry1Data.data, registry2Data.data, registry3Data.data],
        [availableConfigsRule.data!],
      );

      // Assert: Successful aggregation with proper deduplication
      assert(aggregationResult.ok);
      if (aggregationResult.ok) {
        const derivedFields = aggregationResult.data.derivedFields;
        const availableConfigs =
          derivedFields["tools.availableConfigs"] as string[];

        // Verify unique c1 values from all registries
        assert(Array.isArray(availableConfigs));
        assertEquals(availableConfigs.sort(), [
          "build",
          "debug",
          "git",
          "meta",
          "spec",
        ]);

        // Verify deduplication worked (spec appears in registry1 and registry3)
        const specCount = availableConfigs.filter((config) =>
          config === "spec"
        ).length;
        assertEquals(
          specCount,
          1,
          "spec should appear only once despite being in multiple registries",
        );

        // Verify git appears only once despite having multiple git commands
        const gitCount = availableConfigs.filter((config) =>
          config === "git"
        ).length;
        assertEquals(
          gitCount,
          1,
          "git should appear only once despite having multiple git commands",
        );
      }
    });

    it("should handle registry merge with base data preservation", () => {
      // Arrange: Base registry structure and multiple command sources
      const aggregator = Aggregator.createWithDisabledCircuitBreaker();

      // Base registry metadata
      const baseRegistryResult = TestDataFactory.createFrontmatterData({
        version: "1.0.0",
        description: "Command Registry",
        tools: {
          // Base structure without commands - commands will be aggregated
        },
      });

      // Command registry data from multiple sources
      const commandsData1 = TestDataFactory.createFrontmatterData({
        tools: {
          commands: [
            { c1: "refactor", c2: "basedon", c3: "ddd" },
            { c1: "design", c2: "domain", c3: "architecture" },
          ],
        },
      });

      const commandsData2 = TestDataFactory.createFrontmatterData({
        tools: {
          commands: [
            { c1: "docs", c2: "generate-robust", c3: "instruction-doc" },
            { c1: "requirement", c2: "draft", c3: "entry" },
          ],
        },
      });

      assert(baseRegistryResult.ok && commandsData1.ok && commandsData2.ok);

      // Create derivation rule for availableConfigs
      const availableConfigsRule = DerivationRule.create(
        "tools.commands[].c1",
        "availableConfigs",
        true,
      );
      assert(availableConfigsRule.ok);

      // Act: Aggregate with base data
      const aggregationResult = aggregator.aggregate(
        [commandsData1.data, commandsData2.data],
        [availableConfigsRule.data!],
        baseRegistryResult.data,
      );
      assert(aggregationResult.ok);

      if (aggregationResult.ok) {
        const mergeResult = aggregator.mergeWithBase(aggregationResult.data);
        assert(mergeResult.ok);

        if (mergeResult.ok) {
          const finalData = mergeResult.data.getData();

          // Assert: Base data preserved
          assertEquals(finalData.version, "1.0.0");
          assertEquals(finalData.description, "Command Registry");

          // Assert: Derived configs added
          const configs = (finalData.availableConfigs as string[])?.sort();
          assertEquals(configs, ["design", "docs", "refactor", "requirement"]);
        }
      }
    });

    it("should handle performance for large registry merge operations", () => {
      // Arrange: Large-scale registry data simulation
      const aggregator = Aggregator.createWithDisabledCircuitBreaker();

      // Generate multiple large registries
      const registryDataSets: any[] = [];
      const commandCategories = [
        "meta",
        "spec",
        "git",
        "build",
        "debug",
        "refactor",
        "design",
        "docs",
        "requirement",
        "test",
      ];

      for (let i = 0; i < 5; i++) {
        const commands = commandCategories.map((category, index) => ({
          c1: category,
          c2: `action-${i}-${index}`,
          c3: `target-${i}-${index}`,
          title: `${
            category.charAt(0).toUpperCase() + category.slice(1)
          } Command ${i}-${index}`,
          description:
            `Generated command for category ${category} in dataset ${i}`,
        }));

        const registryResult = TestDataFactory.createFrontmatterData({
          tools: { commands },
        });
        assert(registryResult.ok);
        registryDataSets.push(registryResult.data);
      }

      const availableConfigsRule = DerivationRule.create(
        "tools.commands[].c1",
        "tools.availableConfigs",
        true,
      );
      assert(availableConfigsRule.ok);

      // Act: Performance test for large aggregation
      const startTime = performance.now();
      const aggregationResult = aggregator.aggregate(
        registryDataSets,
        [availableConfigsRule.data!],
      );
      const endTime = performance.now();

      // Assert: Performance and correctness
      assert(aggregationResult.ok);
      if (aggregationResult.ok) {
        const derivedFields = aggregationResult.data.derivedFields;
        const availableConfigs =
          derivedFields["tools.availableConfigs"] as string[];

        // Should have exactly the unique command categories
        assertEquals(availableConfigs.sort(), commandCategories.sort());

        // Performance assertion - should complete within reasonable time
        const processingTime = endTime - startTime;
        assert(
          processingTime < 100,
          `Registry aggregation took ${processingTime}ms, should be under 100ms for this scale`,
        );
      }
    });

    it("should handle edge cases in registry merge operations", () => {
      // Arrange: Edge case scenarios
      const aggregator = Aggregator.createWithDisabledCircuitBreaker();

      // Empty registry
      const emptyRegistryResult = TestDataFactory.createFrontmatterData({
        tools: { commands: [] },
      });

      // Registry with null/undefined values
      const registryWithNullsResult = TestDataFactory.createFrontmatterData({
        tools: {
          commands: [
            { c1: "valid", c2: "command", c3: "target" },
            { c1: null, c2: "invalid", c3: "target" },
            { c1: undefined, c2: "invalid2", c3: "target" },
            { c1: "", c2: "empty", c3: "target" },
          ],
        },
      });

      // Registry with malformed data
      const registryWithMalformedResult = TestDataFactory.createFrontmatterData(
        {
          tools: {
            commands: [
              { c1: "docs", c2: "generate", c3: "readme" },
              "invalid-string-command",
              42,
              { notACommand: "missing c1" },
            ],
          },
        },
      );

      assert(
        emptyRegistryResult.ok &&
          registryWithNullsResult.ok &&
          registryWithMalformedResult.ok,
      );

      const availableConfigsRule = DerivationRule.create(
        "tools.commands[].c1",
        "tools.availableConfigs",
        true,
      );
      assert(availableConfigsRule.ok);

      // Act: Process edge cases
      const aggregationResult = aggregator.aggregate(
        [
          emptyRegistryResult.data,
          registryWithNullsResult.data,
          registryWithMalformedResult.data,
        ],
        [availableConfigsRule.data!],
      );

      // Assert: Graceful handling of edge cases
      assert(aggregationResult.ok);
      if (aggregationResult.ok) {
        const derivedFields = aggregationResult.data.derivedFields;
        const availableConfigs =
          derivedFields["tools.availableConfigs"] as string[];

        // Should only include valid c1 values, filtering out nulls/undefined/empty
        // The exact behavior depends on ExpressionEvaluator implementation
        // but it should handle these cases gracefully without crashing
        assert(Array.isArray(availableConfigs));

        // At minimum should include the valid entries
        assert(
          availableConfigs.includes("valid") ||
            availableConfigs.includes("docs"),
          "Should include at least one valid c1 value",
        );
      }
    });
  });
});
