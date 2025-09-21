/**
 * @fileoverview Integration tests for ArrayMerger with Aggregator
 * @description Tests for Issue #898: x-merge-arrays directive integration with existing aggregation
 *
 * Following TDD principles:
 * - Integration testing with existing patterns
 * - FrontmatterData integration
 * - Real-world usage scenarios
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { Aggregator } from "../../../../../src/domain/aggregation/aggregators/aggregator.ts";
import { FrontmatterDataFactory } from "../../../../../src/domain/frontmatter/factories/frontmatter-data-factory.ts";

describe("Aggregator Array Merging Integration", () => {
  describe("mergeArrays method", () => {
    it("should merge arrays with flattening enabled", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const sourceArrays = [
        ["cmd1", "cmd2"],
        ["cmd3"],
        ["cmd4", "cmd5"],
      ];

      const result = aggregator.mergeArrays(sourceArrays, {
        flatten: true,
        preserveOrder: true,
        filterEmpty: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["cmd1", "cmd2", "cmd3", "cmd4", "cmd5"]);
      }
    });

    it("should merge arrays with preservation enabled", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const sourceArrays = [
        ["cmd1", "cmd2"],
        ["cmd3"],
      ];

      const result = aggregator.mergeArrays(sourceArrays, {
        flatten: false,
        preserveOrder: true,
        filterEmpty: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, [["cmd1", "cmd2"], ["cmd3"]]);
      }
    });

    it("should handle empty arrays correctly", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const sourceArrays = [
        ["cmd1"],
        [],
        ["cmd2"],
      ];

      const result = aggregator.mergeArrays(sourceArrays, {
        flatten: true,
        filterEmpty: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["cmd1", "cmd2"]);
      }
    });
  });

  describe("mergeArraysFromSources method", () => {
    it("should merge arrays from FrontmatterData sources", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      // Create test data sources
      const data1Result = FrontmatterDataFactory.fromParsedData({
        commands: ["build", "test"],
        title: "File 1",
      });
      assert(data1Result.ok);

      const data2Result = FrontmatterDataFactory.fromParsedData({
        commands: ["deploy"],
        title: "File 2",
      });
      assert(data2Result.ok);

      const data3Result = FrontmatterDataFactory.fromParsedData({
        commands: ["lint", "format"],
        title: "File 3",
      });
      assert(data3Result.ok);

      const sources = [data1Result.data, data2Result.data, data3Result.data];

      const result = aggregator.mergeArraysFromSources(sources, "commands", {
        flatten: true,
        preserveOrder: true,
        filterEmpty: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, [
          "build",
          "test",
          "deploy",
          "lint",
          "format",
        ]);
      }
    });

    it("should handle missing properties in FrontmatterData sources", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const data1Result = FrontmatterDataFactory.fromParsedData({
        commands: ["build"],
        title: "File 1",
      });
      assert(data1Result.ok);

      const data2Result = FrontmatterDataFactory.fromParsedData({
        title: "File 2", // No commands property
      });
      assert(data2Result.ok);

      const data3Result = FrontmatterDataFactory.fromParsedData({
        commands: ["test"],
        title: "File 3",
      });
      assert(data3Result.ok);

      const sources = [data1Result.data, data2Result.data, data3Result.data];

      const result = aggregator.mergeArraysFromSources(sources, "commands", {
        flatten: true,
        preserveOrder: true,
        filterEmpty: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["build", "test"]);
      }
    });

    it("should handle nested property paths", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const data1Result = FrontmatterDataFactory.fromParsedData({
        tools: {
          availableConfigs: ["config1", "config2"],
        },
        title: "File 1",
      });
      assert(data1Result.ok);

      const data2Result = FrontmatterDataFactory.fromParsedData({
        tools: {
          availableConfigs: ["config3"],
        },
        title: "File 2",
      });
      assert(data2Result.ok);

      const sources = [data1Result.data, data2Result.data];

      const result = aggregator.mergeArraysFromSources(
        sources,
        "tools.availableConfigs",
        {
          flatten: true,
          preserveOrder: true,
          filterEmpty: true,
        },
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, ["config1", "config2", "config3"]);
      }
    });

    it("should preserve array structure when flatten is false", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const data1Result = FrontmatterDataFactory.fromParsedData({
        tags: ["frontend", "javascript"],
      });
      assert(data1Result.ok);

      const data2Result = FrontmatterDataFactory.fromParsedData({
        tags: ["backend"],
      });
      assert(data2Result.ok);

      const sources = [data1Result.data, data2Result.data];

      const result = aggregator.mergeArraysFromSources(sources, "tags", {
        flatten: false,
        preserveOrder: true,
        filterEmpty: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, [["frontend", "javascript"], ["backend"]]);
      }
    });

    it("should handle non-array values by wrapping them", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const data1Result = FrontmatterDataFactory.fromParsedData({
        category: ["tech", "programming"],
      });
      assert(data1Result.ok);

      const data2Result = FrontmatterDataFactory.fromParsedData({
        category: "single-category", // Non-array value
      });
      assert(data2Result.ok);

      const data3Result = FrontmatterDataFactory.fromParsedData({
        category: ["design"],
      });
      assert(data3Result.ok);

      const sources = [data1Result.data, data2Result.data, data3Result.data];

      const result = aggregator.mergeArraysFromSources(sources, "category", {
        flatten: true,
        preserveOrder: true,
        filterEmpty: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, [
          "tech",
          "programming",
          "single-category",
          "design",
        ]);
      }
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle the exact use case described in Issue #898", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      // Simulate multiple markdown files with frontmatter
      const file1Result = FrontmatterDataFactory.fromParsedData({
        commands: ["build", "test"],
        title: "Project Setup",
      });
      assert(file1Result.ok);

      const file2Result = FrontmatterDataFactory.fromParsedData({
        commands: ["deploy"],
        title: "Deployment Guide",
      });
      assert(file2Result.ok);

      const sources = [file1Result.data, file2Result.data];

      // Test x-merge-arrays: true behavior
      const flattenResult = aggregator.mergeArraysFromSources(
        sources,
        "commands",
        {
          flatten: true,
        },
      );
      assertEquals(flattenResult.ok, true);
      if (flattenResult.ok) {
        assertEquals(flattenResult.data, ["build", "test", "deploy"]);
      }

      // Test x-merge-arrays: false behavior
      const preserveResult = aggregator.mergeArraysFromSources(
        sources,
        "commands",
        {
          flatten: false,
        },
      );
      assertEquals(preserveResult.ok, true);
      if (preserveResult.ok) {
        assertEquals(preserveResult.data, [["build", "test"], ["deploy"]]);
      }
    });

    it("should work with complex nested data structures", () => {
      const aggregatorResult = Aggregator.createWithDisabledCircuitBreaker();
      assert(aggregatorResult.ok);
      const aggregator = aggregatorResult.data;

      const complexData1Result = FrontmatterDataFactory.fromParsedData({
        metadata: {
          tools: {
            development: ["vscode", "git"],
            testing: ["jest", "playwright"],
          },
        },
      });
      assert(complexData1Result.ok);

      const complexData2Result = FrontmatterDataFactory.fromParsedData({
        metadata: {
          tools: {
            development: ["webstorm"],
            testing: ["cypress"],
          },
        },
      });
      assert(complexData2Result.ok);

      const sources = [complexData1Result.data, complexData2Result.data];

      // Test merging development tools
      const devResult = aggregator.mergeArraysFromSources(
        sources,
        "metadata.tools.development",
        { flatten: true },
      );
      assertEquals(devResult.ok, true);
      if (devResult.ok) {
        assertEquals(devResult.data, ["vscode", "git", "webstorm"]);
      }

      // Test merging testing tools
      const testResult = aggregator.mergeArraysFromSources(
        sources,
        "metadata.tools.testing",
        { flatten: true },
      );
      assertEquals(testResult.ok, true);
      if (testResult.ok) {
        assertEquals(testResult.data, ["jest", "playwright", "cypress"]);
      }
    });
  });
});
