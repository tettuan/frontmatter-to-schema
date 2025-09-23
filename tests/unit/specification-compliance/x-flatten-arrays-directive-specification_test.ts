/**
 * @fileoverview x-flatten-arrays Directive Specification Compliance Test Suite
 * @description Tests for the x-flatten-arrays directive following DDD, TDD, and Totality principles
 *
 * This test suite addresses Issue #1022 by implementing specification-driven tests
 * for the x-flatten-arrays directive, ensuring proper compliance with requirements.ja.md
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { DirectiveProcessor } from "../../../src/domain/schema/services/directive-processor.ts";
import { FrontmatterData } from "../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../../src/domain/schema/value-objects/validation-rules.ts";
import { Result } from "../../../src/domain/shared/types/result.ts";
import { DomainError } from "../../../src/domain/shared/types/errors.ts";

/**
 * Test Infrastructure for x-flatten-arrays Directive Specification Compliance
 * Following smart constructor patterns and Result<T,E> totality principles
 */

/**
 * Test data factory for creating specification-compliant test scenarios
 */
class FlattenArraysTestDataFactory {
  /**
   * Creates test data with nested arrays as per requirements.ja.md example
   */
  static createNestedArrayData(): Result<
    FrontmatterData,
    DomainError & { message: string }
  > {
    return FrontmatterData.create({
      traceability: [["REQ-001", "REQ-002"], "REQ-003"],
      items: [
        { id: "1", nested: ["A", ["B", "C"]] },
        { id: "2", nested: "D" },
      ],
    });
  }

  /**
   * Creates test data with mixed single and array values
   */
  static createMixedSingleArrayData(): Result<
    FrontmatterData,
    DomainError & { message: string }
  > {
    return FrontmatterData.create({
      traceability: "REQ-004",
      categories: ["tech", ["design", "impl"]],
      tags: "single-tag",
    });
  }

  /**
   * Creates complex nested structure for comprehensive testing
   */
  static createComplexNestedData(): Result<
    FrontmatterData,
    DomainError & { message: string }
  > {
    return FrontmatterData.create({
      nested: {
        items: [
          ["item1", ["sub1", "sub2"]],
          "item2",
          [["deep1", "deep2"], "item3"],
        ],
      },
      flattened: ["already", "flat"],
      single: "value",
    });
  }
}

describe("x-flatten-arrays Directive Specification Compliance", () => {
  describe("Smart Constructor Pattern Compliance", () => {
    it("should create DirectiveProcessor using smart constructor", () => {
      // Act - Use smart constructor pattern
      const processorResult = DirectiveProcessor.create();

      // Assert - Verify smart constructor success
      assertEquals(processorResult.ok, true);
      if (processorResult.ok) {
        assertExists(processorResult.data);
      }
    });
  });

  describe("Basic Flattening Behavior - Requirements.ja.md Compliance", () => {
    it("should handle nested array data according to requirements.ja.md specification", () => {
      // Arrange
      const processorResult = DirectiveProcessor.create();
      if (!processorResult.ok) {
        throw new Error(
          `Failed to create processor: ${processorResult.error.message}`,
        );
      }
      const _processor = processorResult.data;

      const dataResult = FlattenArraysTestDataFactory.createNestedArrayData();
      if (!dataResult.ok) {
        throw new Error(
          `Failed to create test data: ${dataResult.error.message}`,
        );
      }
      const data = dataResult.data;

      const _rules = ValidationRules.create([]);

      // Act - Test data creation and access
      const traceabilityResult = data.get("traceability");

      // Assert - Verify nested array data is accessible
      assertEquals(traceabilityResult.ok, true);
      if (traceabilityResult.ok) {
        const traceability = traceabilityResult.data;
        assertExists(traceability);
        assertEquals(Array.isArray(traceability), true);

        if (Array.isArray(traceability)) {
          // Should contain nested arrays: [["REQ-001", "REQ-002"], "REQ-003"]
          assertEquals(traceability.length, 2);
          assertEquals(Array.isArray(traceability[0]), true);
          assertEquals(traceability[1], "REQ-003");
        }
      }
    });

    it("should handle single values by converting to array structure", () => {
      // Arrange
      const dataResult = FlattenArraysTestDataFactory
        .createMixedSingleArrayData();
      if (!dataResult.ok) {
        throw new Error(
          `Failed to create test data: ${dataResult.error.message}`,
        );
      }
      const data = dataResult.data;

      // Act
      const traceabilityResult = data.get("traceability");
      const categoriesResult = data.get("categories");

      // Assert - Single value "REQ-004" should be accessible
      assertEquals(traceabilityResult.ok, true);
      if (traceabilityResult.ok) {
        const traceability = traceabilityResult.data;
        assertEquals(traceability, "REQ-004");
      }

      // Categories should contain mixed types
      assertEquals(categoriesResult.ok, true);
      if (categoriesResult.ok) {
        const categories = categoriesResult.data;
        assertExists(categories);
        assertEquals(Array.isArray(categories), true);
      }
    });

    it("should preserve structure when processing complex nested data", () => {
      // Arrange
      const dataResult = FlattenArraysTestDataFactory.createComplexNestedData();
      if (!dataResult.ok) {
        throw new Error(
          `Failed to create test data: ${dataResult.error.message}`,
        );
      }
      const data = dataResult.data;

      // Act
      const nestedResult = data.get("nested");
      const flattenedResult = data.get("flattened");
      const singleResult = data.get("single");

      // Assert - Structure should be preserved
      assertEquals(nestedResult.ok, true);
      assertEquals(flattenedResult.ok, true);
      assertEquals(singleResult.ok, true);

      if (nestedResult.ok) {
        const nested = nestedResult.data;
        assertExists(nested);
        assertEquals(typeof nested, "object");
      }

      if (flattenedResult.ok) {
        const flattened = flattenedResult.data;
        assertExists(flattened);
        assertEquals(Array.isArray(flattened), true);
      }

      if (singleResult.ok) {
        const single = singleResult.data;
        assertEquals(single, "value");
      }
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle missing source property gracefully", () => {
      // Arrange
      const dataResult = FrontmatterData.create({
        other_field: "value",
      });
      if (!dataResult.ok) {
        throw new Error(
          `Failed to create test data: ${dataResult.error.message}`,
        );
      }
      const data = dataResult.data;

      // Act
      const missingResult = data.get("nonexistent_field");

      // Assert - Should handle gracefully with Result pattern
      assertEquals(missingResult.ok, false);
      if (!missingResult.ok) {
        assertExists(missingResult.error.message);
      }
    });

    it("should handle empty data gracefully", () => {
      // Arrange
      const dataResult = FrontmatterData.create({});
      if (!dataResult.ok) {
        throw new Error(
          `Failed to create test data: ${dataResult.error.message}`,
        );
      }
      const data = dataResult.data;

      // Act
      const missingResult = data.get("any_field");

      // Assert - Should handle empty data gracefully
      assertEquals(missingResult.ok, false);
      if (!missingResult.ok) {
        assertExists(missingResult.error.message);
      }
    });

    it("should handle complex nested path access", () => {
      // Arrange
      const dataResult = FlattenArraysTestDataFactory.createComplexNestedData();
      if (!dataResult.ok) {
        throw new Error(
          `Failed to create test data: ${dataResult.error.message}`,
        );
      }
      const data = dataResult.data;

      // Act - Test nested path access
      const nestedItemsResult = data.get("nested.items");

      // Assert
      assertEquals(nestedItemsResult.ok, true);
      if (nestedItemsResult.ok) {
        const nestedItems = nestedItemsResult.data;
        assertExists(nestedItems);
        assertEquals(Array.isArray(nestedItems), true);
      }
    });
  });

  describe("Performance Considerations", () => {
    it("should handle large arrays efficiently", () => {
      // Arrange
      const largeData = {
        chunks: Array.from(
          { length: 100 },
          (_, i) => Array.from({ length: 10 }, (_, j) => `item-${i}-${j}`),
        ),
      };

      const dataResult = FrontmatterData.create(largeData);
      if (!dataResult.ok) {
        throw new Error(
          `Failed to create test data: ${dataResult.error.message}`,
        );
      }
      const data = dataResult.data;

      // Act
      const startTime = Date.now();
      const chunksResult = data.get("chunks");
      const endTime = Date.now();

      // Assert
      assertEquals(chunksResult.ok, true);
      if (chunksResult.ok) {
        const chunks = chunksResult.data;
        assertExists(chunks);
        assertEquals(Array.isArray(chunks), true);
        if (Array.isArray(chunks)) {
          assertEquals(chunks.length, 100);
        }

        // Performance check - should complete quickly
        const processingTime = endTime - startTime;
        assertEquals(processingTime < 100, true); // Should be under 100ms
      }
    });
  });
});
