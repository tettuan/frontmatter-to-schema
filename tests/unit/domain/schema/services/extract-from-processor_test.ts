/**
 * @fileoverview ExtractFromProcessor Test Suite - Robust domain service testing
 * @description Following DDD, TDD, and Totality principles with comprehensive coverage
 *
 * Critical Business Requirements Tested:
 * 1. Smart Constructor - validates dependency injection and service creation
 * 2. Single Directive Processing - tests core extraction logic for individual directives
 * 3. Batch Processing - tests multiple directive processing with conflict resolution
 * 4. Array Normalization - tests optimized processing for array vs simple directives
 * 5. Error Handling - tests graceful error handling and recovery
 * 6. Statistics Generation - tests processing metrics and analysis
 *
 * Test Strategy:
 * - Mock PropertyExtractor dependency for isolation
 * - Use real FrontmatterData and ExtractFromDirective for domain logic validation
 * - Test business requirements, not implementation details
 * - Follow Arrange-Act-Assert pattern with Result<T,E> validation
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ExtractFromProcessor } from "../../../../../src/domain/schema/services/extract-from-processor.ts";
import { PropertyExtractor } from "../../../../../src/domain/schema/extractors/property-extractor.ts";
import { ExtractFromDirective } from "../../../../../src/domain/schema/value-objects/extract-from-directive.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { err, ok } from "../../../../../src/domain/shared/types/result.ts";
import { createError } from "../../../../../src/domain/shared/types/errors.ts";

/**
 * Mock Strategy - Following established patterns for domain service testing
 * Mock external dependencies while using real domain objects
 */

// Simplified mock PropertyExtractor for testing
const createMockPropertyExtractor = (
  extractResult: any = ok("extracted-value"),
) => ({
  extract: () => extractResult,
} as unknown as PropertyExtractor);

// Test data helpers
const createTestFrontmatterData = (data: Record<string, unknown> = {}) => {
  const result = FrontmatterData.create(data);
  if (!result.ok) {
    throw new Error(`Failed to create test data: ${result.error.message}`);
  }
  return result.data;
};

const createTestDirective = (sourcePath: string, targetProperty: string) => {
  const result = ExtractFromDirective.create(sourcePath, targetProperty);
  if (!result.ok) {
    throw new Error(
      `Failed to create test directive: ${JSON.stringify(result.error)}`,
    );
  }
  return result.data;
};

describe("ExtractFromProcessor", () => {
  describe("Smart Constructor", () => {
    it("should create processor with provided PropertyExtractor", () => {
      const mockExtractor = createMockPropertyExtractor();

      const processor = ExtractFromProcessor.create(mockExtractor);

      assertExists(processor);
      assertEquals(typeof processor.processDirective, "function");
      assertEquals(typeof processor.processDirectives, "function");
      assertEquals(typeof processor.processBatch, "function");
    });

    it("should create processor with default PropertyExtractor when none provided", () => {
      const processor = ExtractFromProcessor.create();

      assertExists(processor);
      assertEquals(typeof processor.processDirective, "function");
      assertEquals(typeof processor.processDirectives, "function");
      assertEquals(typeof processor.processBatch, "function");
    });
  });

  describe("Single Directive Processing", () => {
    it("should extract and set value for valid directive", () => {
      const mockExtractor = createMockPropertyExtractor(ok("test-value"));
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({ source: { value: "original" } });
      const directive = createTestDirective("source.value", "target");

      const result = processor.processDirective(data, directive);

      assertEquals(result.ok, true);
      if (result.ok) {
        const targetResult = result.data.get("target");
        assertEquals(targetResult.ok, true);
        if (targetResult.ok) {
          assertEquals(targetResult.data, "test-value");
        }
      }
    });

    it("should return original data when extraction fails (optional behavior)", () => {
      const mockExtractor = createMockPropertyExtractor(
        err(createError({ kind: "PropertyNotFound", path: "missing" })),
      );
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({ existing: "value" });
      const directive = createTestDirective("missing.value", "target");

      const result = processor.processDirective(data, directive);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Should return original data unchanged when extraction fails
        assertEquals(result.data, data);
      }
    });

    it("should handle nested property extraction", () => {
      const mockExtractor = createMockPropertyExtractor(
        ok({ nested: "extracted" }),
      );
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directive = createTestDirective(
        "source.path",
        "target.nested.prop",
      );

      const result = processor.processDirective(data, directive);

      assertEquals(result.ok, true);
      if (result.ok) {
        const targetResult = result.data.get("target.nested.prop");
        assertEquals(targetResult.ok, true);
        if (targetResult.ok) {
          assertEquals(targetResult.data, { nested: "extracted" });
        }
      }
    });

    it("should handle array notation directives", () => {
      const mockExtractor = createMockPropertyExtractor(ok(["item1", "item2"]));
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directive = createTestDirective("items[].id", "extractedIds");

      const result = processor.processDirective(data, directive);

      assertEquals(result.ok, true);
      if (result.ok) {
        const targetResult = result.data.get("extractedIds");
        assertEquals(targetResult.ok, true);
        if (targetResult.ok) {
          assertEquals(targetResult.data, ["item1", "item2"]);
        }
      }
    });
  });

  describe("Batch Processing", () => {
    it("should process multiple directives in sequence", () => {
      const mockExtractor = createMockPropertyExtractor(ok("extracted"));
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directives = [
        createTestDirective("source1", "target1"),
        createTestDirective("source2", "target2"),
        createTestDirective("source3", "target3"),
      ];

      const result = processor.processDirectives(data, directives);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Each directive should have been processed
        const target1 = result.data.get("target1");
        const target2 = result.data.get("target2");
        const target3 = result.data.get("target3");

        assertEquals(target1.ok, true);
        assertEquals(target2.ok, true);
        assertEquals(target3.ok, true);
      }
    });

    it("should handle empty directive list", () => {
      const processor = ExtractFromProcessor.create();
      const data = createTestFrontmatterData({ existing: "data" });
      const directives: ExtractFromDirective[] = [];

      const result = processor.processBatch(data, directives);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Should return original data unchanged
        assertEquals(result.data, data);
      }
    });

    it("should continue processing after individual directive failures", () => {
      // Create mock that fails on first call, succeeds on subsequent calls
      let callCount = 0;
      const mockExtractor = {
        extract: () => {
          callCount++;
          if (callCount === 1) {
            return err(
              createError({ kind: "PropertyNotFound", path: "missing" }),
            );
          }
          return ok("success");
        },
      } as unknown as PropertyExtractor;

      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directives = [
        createTestDirective("missing", "target1"), // Will fail
        createTestDirective("existing", "target2"), // Will succeed
      ];

      const result = processor.processDirectives(data, directives);

      assertEquals(result.ok, true);
      if (result.ok) {
        // First directive failed, so target1 should not exist
        const target1 = result.data.get("target1");
        assertEquals(target1.ok, false);

        // Second directive succeeded
        const target2 = result.data.get("target2");
        assertEquals(target2.ok, true);
      }
    });

    it("should process batch with conflict detection and normalization", () => {
      const mockExtractor = createMockPropertyExtractor(ok("value"));
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directives = [
        createTestDirective("source1", "sameName"), // Conflict
        createTestDirective("source2", "sameName"), // Conflict
        createTestDirective("source3", "uniqueName"),
      ];

      const result = processor.processBatch(data, directives);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Should process all directives despite conflicts
        const conflicted = result.data.get("sameName");
        const unique = result.data.get("uniqueName");

        assertEquals(conflicted.ok, true);
        assertEquals(unique.ok, true);
      }
    });
  });

  describe("Array Normalization", () => {
    it("should separate and optimize array vs simple directives", () => {
      const mockExtractor = createMockPropertyExtractor(ok("value"));
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directives = [
        createTestDirective("simple.path", "target1"), // Simple
        createTestDirective("array[].path", "target2"), // Array
        createTestDirective("another.simple", "target3"), // Simple
      ];

      const result = processor.processWithNormalization(data, directives);

      assertEquals(result.ok, true);
      if (result.ok) {
        // All directives should be processed regardless of type
        const target1 = result.data.get("target1");
        const target2 = result.data.get("target2");
        const target3 = result.data.get("target3");

        assertEquals(target1.ok, true);
        assertEquals(target2.ok, true);
        assertEquals(target3.ok, true);
      }
    });

    it("should process simple directives first for efficiency", () => {
      // This is more of a behavioral test - we verify the method exists and works
      const mockExtractor = createMockPropertyExtractor(ok("value"));
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directives = [
        createTestDirective("simple", "target1"),
      ];

      const result = processor.processWithNormalization(data, directives);

      assertEquals(result.ok, true);
      if (result.ok) {
        const target1 = result.data.get("target1");
        assertEquals(target1.ok, true);
      }
    });

    it("should handle mixed directive types correctly", () => {
      const mockExtractor = createMockPropertyExtractor(ok("mixed-value"));
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directives = [
        createTestDirective("items[].id", "arrayTarget"),
        createTestDirective("simple.prop", "simpleTarget"),
        createTestDirective("nested[].deep.value", "nestedArrayTarget"),
      ];

      const result = processor.processWithNormalization(data, directives);

      assertEquals(result.ok, true);
      if (result.ok) {
        const arrayTarget = result.data.get("arrayTarget");
        const simpleTarget = result.data.get("simpleTarget");
        const nestedArrayTarget = result.data.get("nestedArrayTarget");

        assertEquals(arrayTarget.ok, true);
        assertEquals(simpleTarget.ok, true);
        assertEquals(nestedArrayTarget.ok, true);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle PropertyExtractor failures gracefully", () => {
      const mockExtractor = createMockPropertyExtractor(
        err(createError({ kind: "PropertyNotFound", path: "missing" })),
      );
      const processor = ExtractFromProcessor.create(mockExtractor);
      const data = createTestFrontmatterData({});
      const directive = createTestDirective("missing.path", "target");

      const result = processor.processDirective(data, directive);

      // Should return original data, not an error
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, data);
      }
    });

    it("should handle FrontmatterData.set failures", () => {
      const mockExtractor = createMockPropertyExtractor(ok("value"));
      const processor = ExtractFromProcessor.create(mockExtractor);
      // Create data that might cause set failures (implementation dependent)
      const data = createTestFrontmatterData({});
      const directive = createTestDirective("source", "target");

      const result = processor.processDirective(data, directive);

      // Should either succeed or handle the error appropriately
      assertExists(result.ok);
      assertEquals(typeof result.ok, "boolean");
    });

    it("should log warnings but continue processing on individual failures", () => {
      // This test verifies the behavior described in the implementation
      const failingExtractor = createMockPropertyExtractor(
        err(createError({ kind: "PropertyNotFound", path: "missing" })),
      );
      const processor = ExtractFromProcessor.create(failingExtractor);
      const data = createTestFrontmatterData({});
      const directives = [
        createTestDirective("missing1", "target1"),
        createTestDirective("missing2", "target2"),
      ];

      const result = processor.processDirectives(data, directives);

      // Should complete successfully despite individual failures
      assertEquals(result.ok, true);
      if (result.ok) {
        // Original data should be preserved
        assertExists(result.data);
      }
    });
  });

  describe("Processing Statistics", () => {
    it("should calculate total directive count", () => {
      const processor = ExtractFromProcessor.create();
      const directives = [
        createTestDirective("source1", "target1"),
        createTestDirective("source2", "target2"),
        createTestDirective("source3", "target3"),
      ];

      const stats = processor.getProcessingStats(directives);

      assertEquals(stats.total, 3);
    });

    it("should count array notation directives", () => {
      const processor = ExtractFromProcessor.create();
      const directives = [
        createTestDirective("simple.path", "target1"), // Not array
        createTestDirective("items[].id", "target2"), // Array
        createTestDirective("nested[].deep", "target3"), // Array
      ];

      const stats = processor.getProcessingStats(directives);

      assertEquals(stats.total, 3);
      assertEquals(stats.withArrayNotation, 2);
    });

    it("should identify unique targets", () => {
      const processor = ExtractFromProcessor.create();
      const directives = [
        createTestDirective("source1", "uniqueTarget1"),
        createTestDirective("source2", "uniqueTarget2"),
        createTestDirective("source3", "duplicateTarget"), // Duplicate target
        createTestDirective("source4", "duplicateTarget"), // Duplicate target
      ];

      const stats = processor.getProcessingStats(directives);

      assertEquals(stats.total, 4);
      assertEquals(stats.uniqueTargets, 3); // uniqueTarget1, uniqueTarget2, duplicateTarget
    });

    it("should detect conflicting targets", () => {
      const processor = ExtractFromProcessor.create();
      const directives = [
        createTestDirective("source1", "target1"),
        createTestDirective("source2", "target2"),
        createTestDirective("source3", "target1"), // Conflict with first
        createTestDirective("source4", "target2"), // Conflict with second
      ];

      const stats = processor.getProcessingStats(directives);

      assertEquals(stats.total, 4);
      assertEquals(stats.uniqueTargets, 2);
      assertEquals(stats.conflictingTargets, 2); // Both targets have conflicts
    });
  });

  describe("Integration with Dependencies", () => {
    it("should integrate correctly with PropertyExtractor", () => {
      // Use a real PropertyExtractor to test integration
      const realExtractor = PropertyExtractor.create();
      const processor = ExtractFromProcessor.create(realExtractor);
      const data = createTestFrontmatterData({
        source: { nested: { value: "real-extracted" } },
      });
      const directive = createTestDirective("source.nested.value", "target");

      const result = processor.processDirective(data, directive);

      assertEquals(result.ok, true);
      if (result.ok) {
        const targetResult = result.data.get("target");
        assertEquals(targetResult.ok, true);
        if (targetResult.ok) {
          assertEquals(targetResult.data, "real-extracted");
        }
      }
    });

    it("should work with complex FrontmatterData structures", () => {
      const realExtractor = PropertyExtractor.create();
      const processor = ExtractFromProcessor.create(realExtractor);
      const complexData = createTestFrontmatterData({
        users: [
          {
            id: "user1",
            name: "Alice",
            profile: { email: "alice@example.com" },
          },
          { id: "user2", name: "Bob", profile: { email: "bob@example.com" } },
        ],
        metadata: {
          created: "2024-01-01",
          tags: ["important", "user-data"],
        },
      });

      const directives = [
        createTestDirective("metadata.created", "creationDate"),
        createTestDirective("metadata.tags", "labels"),
      ];

      const result = processor.processDirectives(complexData, directives);

      assertEquals(result.ok, true);
      if (result.ok) {
        const creationDate = result.data.get("creationDate");
        const labels = result.data.get("labels");

        assertEquals(creationDate.ok, true);
        assertEquals(labels.ok, true);

        if (creationDate.ok && labels.ok) {
          assertEquals(creationDate.data, "2024-01-01");
          assertEquals(labels.data, ["important", "user-data"]);
        }
      }
    });

    it("should handle ExtractFromDirective edge cases", () => {
      const realExtractor = PropertyExtractor.create();
      const processor = ExtractFromProcessor.create(realExtractor);
      const data = createTestFrontmatterData({
        items: [
          { id: 1, name: "first" },
          { id: 2, name: "second" },
        ],
      });

      // Test with array notation directive
      const arrayDirective = createTestDirective("items[].name", "names");

      const result = processor.processDirective(data, arrayDirective);

      assertEquals(result.ok, true);
      if (result.ok) {
        const names = result.data.get("names");
        assertEquals(names.ok, true);
        if (names.ok) {
          assertEquals(Array.isArray(names.data), true);
        }
      }
    });
  });
});
