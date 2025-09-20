/**
 * @fileoverview Unit tests for ArrayMerger domain service
 * @description Tests for Issue #898: x-merge-arrays directive implementation
 *
 * Following TDD and Totality principles:
 * - Comprehensive test coverage for all scenarios
 * - Result<T,E> pattern testing
 * - Edge case validation
 * - Integration with existing patterns
 */

import { assert, assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
  ArrayMergeConfig,
  ArrayMerger,
  ArrayMergeResult,
} from "../../../../../src/domain/aggregation/services/array-merger.ts";

describe("ArrayMergeConfig", () => {
  describe("Smart Constructor patterns", () => {
    it("should create flattening config with defaults", () => {
      const config = ArrayMergeConfig.createFlattening();

      assertEquals(config.getStrategy().kind, "flatten");
      assertEquals(config.shouldPreserveOrder(), true);
      assertEquals(config.shouldFilterEmpty(), true);
    });

    it("should create flattening config with custom options", () => {
      const config = ArrayMergeConfig.createFlattening({
        preserveOrder: false,
        filterEmpty: false,
      });

      assertEquals(config.getStrategy().kind, "flatten");
      assertEquals(config.shouldPreserveOrder(), false);
      assertEquals(config.shouldFilterEmpty(), false);
    });

    it("should create preserving config with defaults", () => {
      const config = ArrayMergeConfig.createPreserving();

      assertEquals(config.getStrategy().kind, "preserve");
      assertEquals(config.shouldPreserveOrder(), true);
      assertEquals(config.shouldFilterEmpty(), true);
    });

    it("should create preserving config with custom options", () => {
      const config = ArrayMergeConfig.createPreserving({
        preserveOrder: false,
        filterEmpty: false,
      });

      assertEquals(config.getStrategy().kind, "preserve");
      assertEquals(config.shouldPreserveOrder(), false);
      assertEquals(config.shouldFilterEmpty(), false);
    });
  });

  describe("toString method", () => {
    it("should provide readable string representation", () => {
      const config = ArrayMergeConfig.createFlattening();
      const str = config.toString();

      assert(str.includes("flatten"));
      assert(str.includes("order=true"));
      assert(str.includes("filter=true"));
    });
  });
});

describe("ArrayMergeResult", () => {
  describe("Value object behavior", () => {
    it("should create result with correct properties", () => {
      const strategy = { kind: "flatten" as const };
      const result = ArrayMergeResult.create(
        ["A", "B", "C"],
        2,
        3,
        strategy,
      );

      assertEquals(result.getData(), ["A", "B", "C"]);
      assertEquals(result.getSourceCount(), 2);
      assertEquals(result.getItemCount(), 3);
      assertEquals(result.getStrategy().kind, "flatten");
    });

    it("should return immutable copy of data", () => {
      const originalData = ["A", "B"];
      const strategy = { kind: "flatten" as const };
      const result = ArrayMergeResult.create(originalData, 1, 2, strategy);

      const data1 = result.getData();
      const data2 = result.getData();

      // Should be different instances
      assert(data1 !== data2);
      // Should have same content
      assertEquals(data1, data2);
      assertEquals(data1, originalData);
    });

    it("should provide readable string representation", () => {
      const strategy = { kind: "preserve" as const };
      const result = ArrayMergeResult.create(["A", "B"], 1, 2, strategy);
      const str = result.toString();

      assert(str.includes("2 items"));
      assert(str.includes("1 sources"));
      assert(str.includes("preserve"));
    });
  });
});

describe("ArrayMerger", () => {
  describe("Smart Constructor", () => {
    it("should create ArrayMerger successfully", () => {
      const result = ArrayMerger.create();

      assertEquals(result.ok, true);
      if (result.ok) {
        assert(result.data instanceof ArrayMerger);
      }
    });
  });

  describe("Array merging with flatten strategy", () => {
    it("should flatten arrays correctly (x-merge-arrays: true)", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const sourceArrays = [
        ["A", "B"],
        ["C"],
        ["D", "E", "F"],
      ];

      const result = merger.merge(sourceArrays, config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), ["A", "B", "C", "D", "E", "F"]);
        assertEquals(result.data.getSourceCount(), 3);
        assertEquals(result.data.getItemCount(), 6);
        assertEquals(result.data.getStrategy().kind, "flatten");
      }
    });

    it("should handle empty arrays in flatten mode", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const sourceArrays = [
        ["A", "B"],
        [],
        ["C"],
      ];

      const result = merger.merge(sourceArrays, config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), ["A", "B", "C"]);
        assertEquals(result.data.getSourceCount(), 3);
        assertEquals(result.data.getItemCount(), 3);
      }
    });

    it("should filter empty arrays when configured", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening({ filterEmpty: true });
      const sourceArrays = [
        ["A"],
        [],
        ["B"],
      ];

      const result = merger.merge(sourceArrays, config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), ["A", "B"]);
      }
    });

    it("should preserve empty arrays when not filtering", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening({ filterEmpty: false });
      const sourceArrays = [
        ["A"],
        [],
        ["B"],
      ];

      const result = merger.merge(sourceArrays, config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), ["A", "B"]);
      }
    });
  });

  describe("Array merging with preserve strategy", () => {
    it("should preserve array structure correctly (x-merge-arrays: false)", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createPreserving();
      const sourceArrays = [
        ["A", "B"],
        ["C"],
      ];

      const result = merger.merge(sourceArrays, config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), [["A", "B"], ["C"]]);
        assertEquals(result.data.getSourceCount(), 2);
        assertEquals(result.data.getItemCount(), 3); // Total items across arrays
        assertEquals(result.data.getStrategy().kind, "preserve");
      }
    });

    it("should handle empty source arrays in preserve mode", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createPreserving();
      const sourceArrays: unknown[][] = [];

      const result = merger.merge(sourceArrays, config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), []);
        assertEquals(result.data.getSourceCount(), 0);
        assertEquals(result.data.getItemCount(), 0);
      }
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle non-array input gracefully", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const invalidInput = "not an array" as any;

      const result = merger.merge(invalidInput, config);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assert(result.error.message.includes("must be an array"));
      }
    });

    it("should handle mixed valid and invalid arrays", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const sourceArrays = [
        ["A", "B"],
        "not an array" as any,
        ["C"],
      ];

      const result = merger.merge(sourceArrays, config);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Should skip non-arrays and continue with valid ones
        assertEquals(result.data.getData(), ["A", "B", "C"]);
      }
    });

    it("should handle single array input", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const sourceArrays = [["A", "B", "C"]];

      const result = merger.merge(sourceArrays, config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), ["A", "B", "C"]);
        assertEquals(result.data.getSourceCount(), 1);
      }
    });
  });

  describe("Source-based merging", () => {
    it("should merge arrays from data sources", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const sources = [
        { data: { commands: ["cmd1", "cmd2"] }, path: "file1" },
        { data: { commands: ["cmd3"] }, path: "file2" },
        { data: { commands: ["cmd4", "cmd5"] }, path: "file3" },
      ];

      const result = merger.mergeFromSources(sources, "commands", config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), [
          "cmd1",
          "cmd2",
          "cmd3",
          "cmd4",
          "cmd5",
        ]);
      }
    });

    it("should handle missing properties in sources", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const sources = [
        { data: { commands: ["cmd1"] }, path: "file1" },
        { data: { otherField: "value" }, path: "file2" }, // Missing commands
        { data: { commands: ["cmd2"] }, path: "file3" },
      ];

      const result = merger.mergeFromSources(sources, "commands", config);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), ["cmd1", "cmd2"]);
      }
    });

    it("should handle non-array values in sources", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const sources = [
        { data: { commands: ["cmd1"] }, path: "file1" },
        { data: { commands: "single-value" }, path: "file2" }, // Non-array
        { data: { commands: ["cmd2"] }, path: "file3" },
      ];

      const result = merger.mergeFromSources(sources, "commands", config);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Should wrap non-array values in array
        assertEquals(result.data.getData(), ["cmd1", "single-value", "cmd2"]);
      }
    });

    it("should handle nested property paths", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      const config = ArrayMergeConfig.createFlattening();
      const sources = [
        {
          data: { tools: { availableConfigs: ["config1", "config2"] } },
          path: "file1",
        },
        { data: { tools: { availableConfigs: ["config3"] } }, path: "file2" },
      ];

      const result = merger.mergeFromSources(
        sources,
        "tools.availableConfigs",
        config,
      );

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getData(), ["config1", "config2", "config3"]);
      }
    });
  });

  describe("Integration scenarios", () => {
    it("should support the exact use case from Issue #898", () => {
      const mergerResult = ArrayMerger.create();
      assert(mergerResult.ok);
      const merger = mergerResult.data;

      // Test case: x-merge-arrays: true
      const flattenConfig = ArrayMergeConfig.createFlattening();
      const file1 = ["A", "B"];
      const file2 = ["C"];
      const sourceArrays = [file1, file2];

      const flattenResult = merger.merge(sourceArrays, flattenConfig);
      assertEquals(flattenResult.ok, true);
      if (flattenResult.ok) {
        assertEquals(flattenResult.data.getData(), ["A", "B", "C"]);
      }

      // Test case: x-merge-arrays: false
      const preserveConfig = ArrayMergeConfig.createPreserving();
      const preserveResult = merger.merge(sourceArrays, preserveConfig);
      assertEquals(preserveResult.ok, true);
      if (preserveResult.ok) {
        assertEquals(preserveResult.data.getData(), [["A", "B"], ["C"]]);
      }
    });
  });
});
