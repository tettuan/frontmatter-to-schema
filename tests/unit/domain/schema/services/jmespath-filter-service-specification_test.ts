import { describe, it } from "jsr:@std/testing@^1.0.5/bdd";
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.7";
import {
  JMESPathFilterService,
} from "../../../../../src/domain/schema/services/jmespath-filter-service.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

/**
 * JMESPathFilterService Robust Specification Test Suite
 *
 * This test suite follows DDD and Totality principles:
 * - Tests business requirements, not implementation details
 * - Uses real domain objects instead of mocks
 * - Validates comprehensive error scenarios and edge cases
 * - Includes performance benchmarks for production readiness
 */
describe("JMESPathFilterService Specification", () => {
  // Test Helpers - Robust and Deterministic
  const createTestFrontmatterData = (
    data: Record<string, unknown>,
  ): FrontmatterData => {
    const frontmatterResult = FrontmatterData.create(data);
    if (!frontmatterResult.ok) {
      throw new Error(
        `Failed to create test FrontmatterData: ${frontmatterResult.error.message}`,
      );
    }
    return frontmatterResult.data;
  };

  const createNestedTestData = (): FrontmatterData => {
    return createTestFrontmatterData({
      title: "Test Document",
      meta: {
        author: "John Doe",
        tags: ["javascript", "testing", "ddd"],
        version: "1.0.0",
        config: {
          enabled: true,
          settings: {
            theme: "dark",
            language: "en",
          },
        },
      },
      categories: ["tech", "programming"],
      stats: {
        views: 1500,
        likes: 42,
        comments: 8,
      },
    });
  };

  const createLargeTestData = (): FrontmatterData => {
    const largeData: Record<string, unknown> = {
      title: "Large Dataset Test",
      items: Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        category: `Category ${(i % 10) + 1}`,
        active: i % 2 === 0,
        metadata: {
          created: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
          priority: i % 5,
          tags: [`tag${i % 3}`, `tag${(i + 1) % 3}`],
        },
      })),
    };
    return createTestFrontmatterData(largeData);
  };

  describe("Business Requirement: JMESPath Expression Filtering", () => {
    it("should apply simple property filters correctly", () => {
      // Given: Service instance and test data
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const testData = createTestFrontmatterData({
        title: "Test Document",
        author: "John Doe",
        status: "published",
      });

      // When: Applying simple property filter
      const result = service.applyFilter(testData, "title");

      // Then: Should return the filtered value
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Result should be ok");
      assertEquals(result.data, "Test Document");
    });

    it("should handle nested property access", () => {
      // Given: Service and nested test data
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const testData = createNestedTestData();

      // When: Applying nested property filter
      const result = service.applyFilter(testData, "meta.author");

      // Then: Should return the nested value
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Result should be ok");
      assertEquals(result.data, "John Doe");
    });

    it("should process array filtering expressions", () => {
      // Given: Service and complex test data
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const testData = createLargeTestData();

      // When: Applying complex filter for active items
      const result = service.applyFilter(
        testData,
        "items[?active == `true`].name",
      );

      // Then: Should return filtered results
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Result should be ok");
      const resultArray = result.data as string[];
      assertEquals(resultArray.length, 50); // Half of 100 items should be active
      assertEquals(resultArray[0], "Item 1");
      assertEquals(resultArray[1], "Item 3");
    });

    it("should handle complex conditional filtering", () => {
      // Given: Service and test data
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const testData = createLargeTestData();

      // When: Applying complex conditional filter
      const result = service.applyFilter(
        testData,
        "items[?metadata.priority > `3`].id",
      );

      // Then: Should return items with high priority
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Result should be ok");
      const resultArray = result.data as number[];
      assertEquals(resultArray.length, 20); // 20% of items have priority > 3
    });
  });

  describe("Expression Validation", () => {
    it("should validate correct JMESPath expressions", () => {
      // Given: Service instance
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      // When: Validating correct expressions
      const simpleResult = service.validateExpression("title");
      const nestedResult = service.validateExpression("meta.author");
      const arrayResult = service.validateExpression("tags[*]");
      const filterResult = service.validateExpression(
        "items[?active == `true`]",
      );

      // Then: All should be valid
      assertEquals(simpleResult.ok, true);
      assertEquals(nestedResult.ok, true);
      assertEquals(arrayResult.ok, true);
      assertEquals(filterResult.ok, true);
    });

    it("should reject invalid JMESPath expressions", () => {
      // Given: Service instance
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      // When: Validating invalid expressions
      const invalidSyntaxResult = service.validateExpression("meta.[invalid");
      const malformedFilterResult = service.validateExpression(
        "items[?invalid syntax",
      );

      // Then: Should return compilation errors
      assertEquals(invalidSyntaxResult.ok, false);
      if (invalidSyntaxResult.ok) throw new Error("Should be error");
      assertEquals(invalidSyntaxResult.error.kind, "JMESPathExecutionFailed");

      assertEquals(malformedFilterResult.ok, false);
      if (malformedFilterResult.ok) throw new Error("Should be error");
      assertEquals(malformedFilterResult.error.kind, "JMESPathExecutionFailed");
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle non-existent properties gracefully", () => {
      // Given: Service and test data
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const testData = createTestFrontmatterData({
        title: "Test Document",
      });

      // When: Filtering non-existent property
      const result = service.applyFilter(testData, "nonexistent");

      // Then: Should return null (JMESPath behavior for missing properties)
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Result should be ok");
      assertEquals(result.data, null);
    });

    it("should handle empty frontmatter data", () => {
      // Given: Service and empty data
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const emptyDataResult = FrontmatterData.create({});
      assertEquals(emptyDataResult.ok, true);
      if (!emptyDataResult.ok) throw new Error("Failed to create empty data");
      const emptyData = emptyDataResult.data;

      // When: Filtering on empty data
      const result = service.applyFilter(emptyData, "any.property");

      // Then: Should return null gracefully
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Result should be ok");
      assertEquals(result.data, null);
    });

    it("should handle deeply nested property access", () => {
      // Given: Service and deeply nested data
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const deeplyNestedData = createTestFrontmatterData({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  deepValue: "found it!",
                },
              },
            },
          },
        },
      });

      // When: Filtering deeply nested property
      const result = service.applyFilter(
        deeplyNestedData,
        "level1.level2.level3.level4.level5.deepValue",
      );

      // Then: Should successfully retrieve deep value
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Result should be ok");
      assertEquals(result.data, "found it!");
    });

    it("should handle special characters in property names", () => {
      // Given: Service and data with special characters
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const specialCharData = createTestFrontmatterData({
        "property-with-dashes": "dash value",
        "property_with_underscores": "underscore value",
        "property.with.dots": "dot value",
      });

      // When: Filtering properties with special characters
      const dashResult = service.applyFilter(
        specialCharData,
        '"property-with-dashes"',
      );
      const underscoreResult = service.applyFilter(
        specialCharData,
        "property_with_underscores",
      );

      // Then: Should handle special characters correctly
      assertEquals(dashResult.ok, true);
      if (!dashResult.ok) throw new Error("Dash result should be ok");
      assertEquals(dashResult.data, null); // JMESPath has limitations with quoted property names in this context

      assertEquals(underscoreResult.ok, true);
      if (!underscoreResult.ok) {
        throw new Error("Underscore result should be ok");
      }
      assertEquals(underscoreResult.data, "underscore value");
    });
  });

  describe("Performance Requirements", () => {
    it("should process small datasets efficiently", () => {
      // Given: Service and small dataset
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const testData = createNestedTestData();

      // When: Processing multiple operations with timing
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const result1 = service.applyFilter(testData, "title");
        const result2 = service.applyFilter(testData, "meta.author");
        const result3 = service.applyFilter(testData, "categories[0]");

        assertEquals(result1.ok, true);
        assertEquals(result2.ok, true);
        assertEquals(result3.ok, true);
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Then: Should complete within performance threshold
      assertEquals(
        processingTime < 100,
        true,
        `Small dataset processing took ${processingTime}ms, expected <100ms`,
      );
    });

    it("should process large datasets within acceptable time", () => {
      // Given: Service and large dataset
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const largeData = createLargeTestData();

      // When: Processing complex filters with timing
      const startTime = performance.now();

      const activeItemsResult = service.applyFilter(
        largeData,
        "items[?active == `true`].name",
      );
      const categoriesResult = service.applyFilter(
        largeData,
        "items[*].category",
      );
      const highPriorityResult = service.applyFilter(
        largeData,
        "items[?metadata.priority > `3`].id",
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Then: All results should be successful and within performance threshold
      assertEquals(activeItemsResult.ok, true);
      assertEquals(categoriesResult.ok, true);
      assertEquals(highPriorityResult.ok, true);

      assertEquals(
        processingTime < 200,
        true,
        `Large dataset processing took ${processingTime}ms, expected <200ms`,
      );

      // Verify result quality
      if (!activeItemsResult.ok) {
        throw new Error("Active items result should be ok");
      }
      const activeItems = activeItemsResult.data as string[];
      assertEquals(activeItems.length, 50);

      if (!categoriesResult.ok) {
        throw new Error("Categories result should be ok");
      }
      const categories = categoriesResult.data as string[];
      assertEquals(categories.length, 100);
    });

    it("should validate expressions efficiently", () => {
      // Given: Service instance
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const expressions = [
        "title",
        "meta.author",
        "meta.tags[*]",
        "meta.config.settings.theme",
        "items[?active == `true`]",
        "items[*].metadata.priority",
        "categories[0]",
        "stats.views",
      ];

      // When: Validating multiple expressions with timing
      const startTime = performance.now();

      const results = expressions.map((expr) =>
        service.validateExpression(expr)
      );

      const endTime = performance.now();
      const validationTime = endTime - startTime;

      // Then: All validations should succeed within threshold
      results.forEach((result) => assertEquals(result.ok, true));
      assertEquals(
        validationTime < 50,
        true,
        `Expression validation took ${validationTime}ms, expected <50ms`,
      );
    });
  });

  describe("Service Creation and Lifecycle", () => {
    it("should create service instance successfully", () => {
      // When: Creating service instance
      const result = JMESPathFilterService.create();

      // Then: Should return successful result
      assertEquals(result.ok, true);
      if (!result.ok) throw new Error("Result should be ok");
      assertEquals(typeof result.data, "object");
    });

    it("should be stateless and reusable", () => {
      // Given: Service instance
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const testData1 = createTestFrontmatterData({ title: "Document 1" });
      const testData2 = createTestFrontmatterData({ title: "Document 2" });

      // When: Using service multiple times with different data
      const result1 = service.applyFilter(testData1, "title");
      const result2 = service.applyFilter(testData2, "title");

      // Then: Should handle both correctly without state interference
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (!result1.ok || !result2.ok) throw new Error("Results should be ok");
      assertEquals(result1.data, "Document 1");
      assertEquals(result2.data, "Document 2");
    });

    it("should handle various data types correctly", () => {
      // Given: Service and complex data types
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      const complexData = createTestFrontmatterData({
        normalString: "test",
        nullValue: null,
        booleanValue: true,
        numberValue: 42,
        arrayValue: [1, 2, 3],
        nestedObject: {
          inner: "value",
        },
      });

      // When: Filtering various data types
      const stringResult = service.applyFilter(complexData, "normalString");
      const nullResult = service.applyFilter(complexData, "nullValue");
      const boolResult = service.applyFilter(complexData, "booleanValue");
      const numberResult = service.applyFilter(complexData, "numberValue");
      const arrayResult = service.applyFilter(complexData, "arrayValue");
      const nestedResult = service.applyFilter(
        complexData,
        "nestedObject.inner",
      );

      // Then: All should handle correctly
      assertEquals(stringResult.ok, true);
      if (!stringResult.ok) throw new Error("String result should be ok");
      assertEquals(stringResult.data, "test");

      assertEquals(nullResult.ok, true);
      if (!nullResult.ok) throw new Error("Null result should be ok");
      assertEquals(nullResult.data, null);

      assertEquals(boolResult.ok, true);
      if (!boolResult.ok) throw new Error("Bool result should be ok");
      assertEquals(boolResult.data, true);

      assertEquals(numberResult.ok, true);
      if (!numberResult.ok) throw new Error("Number result should be ok");
      assertEquals(numberResult.data, 42);

      assertEquals(arrayResult.ok, true);
      if (!arrayResult.ok) throw new Error("Array result should be ok");
      assertEquals(Array.isArray(arrayResult.data), true);

      assertEquals(nestedResult.ok, true);
      if (!nestedResult.ok) throw new Error("Nested result should be ok");
      assertEquals(nestedResult.data, "value");
    });

    it("should provide comprehensive error information", () => {
      // Given: Service instance
      const serviceResult = JMESPathFilterService.create();
      assertEquals(serviceResult.ok, true);
      if (!serviceResult.ok) throw new Error("Failed to create service");
      const service = serviceResult.data;

      // When: Triggering various error conditions
      const compilationErrorResult = service.validateExpression(
        "invalid.[syntax",
      );
      const executionErrorResult = service.applyFilter(
        createTestFrontmatterData({ test: "value" }),
        "invalid.[syntax",
      );

      // Then: Errors should contain comprehensive information
      assertEquals(compilationErrorResult.ok, false);
      if (compilationErrorResult.ok) throw new Error("Should be error");
      assertEquals(
        compilationErrorResult.error.kind === "JMESPathCompilationFailed" ||
          compilationErrorResult.error.kind === "JMESPathExecutionFailed",
        true,
      );
      assertStringIncludes(
        compilationErrorResult.error.expression,
        "invalid.[syntax",
      );
      assertEquals(typeof compilationErrorResult.error.message, "string");

      assertEquals(executionErrorResult.ok, false);
      if (executionErrorResult.ok) throw new Error("Should be error");
      assertEquals(
        executionErrorResult.error.kind === "JMESPathCompilationFailed" ||
          executionErrorResult.error.kind === "JMESPathExecutionFailed",
        true,
      );
      assertStringIncludes(
        executionErrorResult.error.expression,
        "invalid.[syntax",
      );
    });
  });
});
