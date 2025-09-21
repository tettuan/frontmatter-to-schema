/**
 * @fileoverview Integration tests for x-derived-unique and x-merge-arrays directives
 * @description Tests for Issue #898: Verifying x-merge-arrays works with x-derived-unique
 *
 * Following TDD principles:
 * - Verify compatibility between directives
 * - Test real-world scenarios with both directives
 * - Ensure no conflicts in behavior
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { Aggregator } from "../../../../../src/domain/aggregation/aggregators/aggregator.ts";
import { FrontmatterDataFactory } from "../../../../../src/domain/frontmatter/factories/frontmatter-data-factory.ts";
import { DerivationRule } from "../../../../../src/domain/aggregation/value-objects/derivation-rule.ts";

describe("Derived Unique and Merge Arrays Integration", () => {
  describe("x-derived-unique + x-merge-arrays compatibility", () => {
    it("should apply x-derived-unique during aggregation and x-merge-arrays during merging", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      // Create test data with duplicate values
      const data1Result = FrontmatterDataFactory.fromParsedData({
        tags: ["frontend", "javascript", "react"],
        title: "File 1",
      });
      assert(data1Result.ok);

      const data2Result = FrontmatterDataFactory.fromParsedData({
        tags: ["frontend", "vue"], // "frontend" is duplicate
        title: "File 2",
      });
      assert(data2Result.ok);

      const data3Result = FrontmatterDataFactory.fromParsedData({
        tags: ["javascript", "backend"], // "javascript" is duplicate
        title: "File 3",
      });
      assert(data3Result.ok);

      const sources = [data1Result.data, data2Result.data, data3Result.data];

      // Test x-derived-unique behavior: removes duplicates during derivation
      const uniqueRuleResult = DerivationRule.create(
        "tags[]",
        "uniqueTags",
        true,
      );
      assert(uniqueRuleResult.ok);
      const uniqueRule = uniqueRuleResult.data;

      const aggregationResult = aggregator.aggregate(sources, [uniqueRule]);
      assert(aggregationResult.ok);

      // Should have unique values: ["frontend", "javascript", "react", "vue", "backend"]
      const derivedUniqueValues = aggregationResult.data.derivedFields
        .uniqueTags as string[];
      assertEquals(derivedUniqueValues.length, 5);
      assertEquals(new Set(derivedUniqueValues).size, 5); // No duplicates

      // Test x-merge-arrays behavior: controls structure during merging
      const flattenResult = aggregator.mergeArraysFromSources(sources, "tags", {
        flatten: true,
      });
      assert(flattenResult.ok);
      // Should flatten: ["frontend", "javascript", "react", "frontend", "vue", "javascript", "backend"]
      // Note: x-merge-arrays doesn't remove duplicates, only controls structure
      assertEquals(flattenResult.data.length, 7); // All items, including duplicates

      const preserveResult = aggregator.mergeArraysFromSources(
        sources,
        "tags",
        {
          flatten: false,
        },
      );
      assert(preserveResult.ok);
      // Should preserve structure: [["frontend", "javascript", "react"], ["frontend", "vue"], ["javascript", "backend"]]
      assertEquals(preserveResult.data.length, 3); // Three arrays
      assertEquals((preserveResult.data as string[][])[0].length, 3);
      assertEquals((preserveResult.data as string[][])[1].length, 2);
      assertEquals((preserveResult.data as string[][])[2].length, 2);
    });

    it("should handle complex nested data with both directives", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const complexData1Result = FrontmatterDataFactory.fromParsedData({
        project: {
          technologies: ["typescript", "react", "deno"],
          contributors: ["alice", "bob"],
        },
      });
      assert(complexData1Result.ok);

      const complexData2Result = FrontmatterDataFactory.fromParsedData({
        project: {
          technologies: ["typescript", "vue"], // "typescript" is duplicate
          contributors: ["alice", "charlie"], // "alice" is duplicate
        },
      });
      assert(complexData2Result.ok);

      const sources = [complexData1Result.data, complexData2Result.data];

      // Test unique derivation for nested paths
      const uniqueTechRuleResult = DerivationRule.create(
        "project.technologies[]",
        "uniqueTechnologies",
        true,
      );
      assert(uniqueTechRuleResult.ok);

      const aggregationResult = aggregator.aggregate(sources, [
        uniqueTechRuleResult.data,
      ]);
      assert(aggregationResult.ok);

      const uniqueTechnologies = aggregationResult.data.derivedFields
        .uniqueTechnologies as string[];
      // Should have unique values without duplicates
      assertEquals(new Set(uniqueTechnologies).size, uniqueTechnologies.length);
      assert(uniqueTechnologies.includes("typescript"));
      assert(uniqueTechnologies.includes("react"));
      assert(uniqueTechnologies.includes("deno"));
      assert(uniqueTechnologies.includes("vue"));

      // Test array merging for the same nested path
      const mergeResult = aggregator.mergeArraysFromSources(
        sources,
        "project.technologies",
        { flatten: true },
      );
      assert(mergeResult.ok);
      // Should include duplicates since x-merge-arrays doesn't deduplicate
      assertEquals(mergeResult.data.length, 5); // ["typescript", "react", "deno", "typescript", "vue"]
    });

    it("should work with different merge strategies and unique derivation", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const file1Result = FrontmatterDataFactory.fromParsedData({
        commands: ["build", "test", "deploy"],
        categories: ["frontend", "tools"],
      });
      assert(file1Result.ok);

      const file2Result = FrontmatterDataFactory.fromParsedData({
        commands: ["test", "lint"], // "test" is duplicate
        categories: ["frontend", "quality"], // "frontend" is duplicate
      });
      assert(file2Result.ok);

      const sources = [file1Result.data, file2Result.data];

      // Create unique derivation rule for commands
      const uniqueCommandsRule = DerivationRule.create(
        "commands[]",
        "allCommands",
        true,
      );
      assert(uniqueCommandsRule.ok);

      const aggregationResult = aggregator.aggregate(sources, [
        uniqueCommandsRule.data,
      ]);
      assert(aggregationResult.ok);

      const uniqueCommands = aggregationResult.data.derivedFields
        .allCommands as string[];
      // Should remove duplicate "test"
      assertEquals(new Set(uniqueCommands).size, uniqueCommands.length);
      assertEquals(uniqueCommands.length, 4); // ["build", "test", "deploy", "lint"]

      // Test flatten merge (x-merge-arrays: true)
      const flattenMerge = aggregator.mergeArraysFromSources(
        sources,
        "commands",
        {
          flatten: true,
        },
      );
      assert(flattenMerge.ok);
      assertEquals(flattenMerge.data.length, 5); // Includes duplicate "test"

      // Test preserve merge (x-merge-arrays: false)
      const preserveMerge = aggregator.mergeArraysFromSources(
        sources,
        "commands",
        {
          flatten: false,
        },
      );
      assert(preserveMerge.ok);
      assertEquals(preserveMerge.data.length, 2); // Two arrays
      assertEquals((preserveMerge.data as string[][])[0], [
        "build",
        "test",
        "deploy",
      ]);
      assertEquals((preserveMerge.data as string[][])[1], ["test", "lint"]);
    });
  });

  describe("Directive separation of concerns", () => {
    it("should demonstrate that x-derived-unique and x-merge-arrays serve different purposes", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const testData = [
        { technologies: ["A", "B"] },
        { technologies: ["B", "C"] }, // "B" is duplicate
        { technologies: ["C", "D"] }, // "C" is duplicate
      ];

      const sources = testData.map((data) => {
        const result = FrontmatterDataFactory.fromParsedData(data);
        assert(result.ok);
        return result.data;
      });

      // x-derived-unique: Removes duplicates during field derivation
      const uniqueRule = DerivationRule.create(
        "technologies[]",
        "uniqueTech",
        true,
      );
      assert(uniqueRule.ok);

      const aggregationResult = aggregator.aggregate(sources, [
        uniqueRule.data,
      ]);
      assert(aggregationResult.ok);

      const uniqueTech = aggregationResult.data.derivedFields
        .uniqueTech as string[];
      assertEquals(uniqueTech.length, 4); // ["A", "B", "C", "D"] - no duplicates
      assertEquals(new Set(uniqueTech).size, 4);

      // x-merge-arrays: flatten=true - Flattens arrays but keeps duplicates
      const flattenResult = aggregator.mergeArraysFromSources(
        sources,
        "technologies",
        {
          flatten: true,
        },
      );
      assert(flattenResult.ok);
      assertEquals(flattenResult.data.length, 6); // ["A", "B", "B", "C", "C", "D"] - includes duplicates

      // x-merge-arrays: flatten=false - Preserves array structure
      const preserveResult = aggregator.mergeArraysFromSources(
        sources,
        "technologies",
        {
          flatten: false,
        },
      );
      assert(preserveResult.ok);
      assertEquals(preserveResult.data.length, 3); // Three separate arrays
      assertEquals((preserveResult.data as string[][])[0], ["A", "B"]);
      assertEquals((preserveResult.data as string[][])[1], ["B", "C"]);
      assertEquals((preserveResult.data as string[][])[2], ["C", "D"]);
    });
  });
});
