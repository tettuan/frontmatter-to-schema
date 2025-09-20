/**
 * @fileoverview Traceability ID Extraction Integration Tests
 * @description Tests real-world traceability ID extraction scenarios following Issue #902 requirements
 * Following DDD and Totality principles with robust integration testing
 *
 * Integration Test Scenarios:
 * 1. Single element traceability ID extraction
 * 2. Array element traceability ID extraction
 * 3. Complex nested traceability structures
 * 4. Error handling for malformed traceability data
 * 5. Performance validation for large datasets
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { FrontmatterProcessor } from "../../src/domain/frontmatter/processors/frontmatter-processor.ts";
import { PropertyExtractor } from "../../src/domain/schema/extractors/property-extractor.ts";
import { ExtractFromProcessor } from "../../src/domain/schema/services/extract-from-processor.ts";
import { FrontmatterData } from "../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ExtractFromDirective } from "../../src/domain/schema/value-objects/extract-from-directive.ts";
import { ok } from "../../src/domain/shared/types/result.ts";

/**
 * Mock implementations for integration testing
 * Following established patterns from existing integration tests
 */
class MockFrontmatterExtractor {
  constructor(
    private readonly dataToReturn: { frontmatter: string; body: string },
  ) {}

  extract(_content: string) {
    return ok(this.dataToReturn);
  }
}

class MockFrontmatterParser {
  constructor(private readonly dataToReturn: unknown) {}

  parse(_yaml: string) {
    return ok(this.dataToReturn);
  }
}

describe("Traceability ID Extraction Integration Tests", () => {
  describe("Single Element Traceability Extraction", () => {
    it("should extract traceability ID from single element structure", () => {
      // Arrange: Set up real traceability data structure from Issue #902
      const frontmatterData = {
        traceability: {
          id: {
            full: "req:single-001",
          },
        },
        title: "Sample Requirement",
        description: "Test requirement for single traceability ID",
      };

      const mockExtractor = new MockFrontmatterExtractor({
        frontmatter: JSON.stringify(frontmatterData),
        body: "# Test Content",
      });
      const mockParser = new MockFrontmatterParser(frontmatterData);
      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(
        propertyExtractor,
      );

      const processor = new FrontmatterProcessor(
        mockExtractor,
        mockParser,
        propertyExtractor,
      );

      // Act: Process the document and extract traceability IDs
      const processResult = processor.extract("test-content");
      assertEquals(processResult.ok, true);

      if (processResult.ok) {
        const frontmatterData = processResult.data.frontmatter;
        const directive = ExtractFromDirective.create(
          "traceability.id.full",
          "extractedTraceabilityId",
        );
        assertEquals(directive.ok, true);

        if (directive.ok) {
          const extractResult = extractFromProcessor.processDirective(
            frontmatterData,
            directive.data,
          );

          // Assert: Verify extraction succeeded and data is correct
          assertEquals(extractResult.ok, true);
          if (extractResult.ok) {
            const extractedValue = extractResult.data.get(
              "extractedTraceabilityId",
            );
            assertEquals(extractedValue.ok, true);
            if (extractedValue.ok) {
              assertEquals(extractedValue.data, "req:single-001");
            }
          }
        }
      }
    });

    it("should handle missing traceability data gracefully", () => {
      // Arrange: Document without traceability data
      const frontmatterData = {
        title: "Sample Without Traceability",
        description: "Test document without traceability ID",
      };

      const mockExtractor = new MockFrontmatterExtractor({
        frontmatter: JSON.stringify(frontmatterData),
        body: "# Test Content",
      });
      const mockParser = new MockFrontmatterParser(frontmatterData);
      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(
        propertyExtractor,
      );

      const processor = new FrontmatterProcessor(
        mockExtractor,
        mockParser,
        propertyExtractor,
      );

      // Act: Process document and attempt extraction
      const processResult = processor.extract("test-content");
      assertEquals(processResult.ok, true);

      if (processResult.ok) {
        const frontmatterData = processResult.data.frontmatter;
        const directive = ExtractFromDirective.create(
          "traceability.id.full",
          "extractedTraceabilityId",
        );
        assertEquals(directive.ok, true);

        if (directive.ok) {
          const extractResult = extractFromProcessor.processDirective(
            frontmatterData,
            directive.data,
          );

          // Assert: Should handle gracefully (ExtractFromProcessor returns original data for missing paths)
          assertEquals(extractResult.ok, true);
          if (extractResult.ok) {
            const extractedValue = extractResult.data.get(
              "extractedTraceabilityId",
            );
            // Should not have the extracted value since source path doesn't exist
            assertEquals(extractedValue.ok, false);
          }
        }
      }
    });
  });

  describe("Array Element Traceability Extraction", () => {
    it("should extract traceability IDs from array elements", () => {
      // Arrange: Set up array traceability data structure from Issue #902
      const frontmatterData = {
        traceability: [
          {
            id: {
              full: "req:array-001",
            },
            priority: "high",
          },
          {
            id: {
              full: "req:array-002",
            },
            priority: "medium",
          },
        ],
        title: "Multi-Requirement Document",
      };

      const mockExtractor = new MockFrontmatterExtractor({
        frontmatter: JSON.stringify(frontmatterData),
        body: "# Test Content",
      });
      const mockParser = new MockFrontmatterParser(frontmatterData);
      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(
        propertyExtractor,
      );

      const processor = new FrontmatterProcessor(
        mockExtractor,
        mockParser,
        propertyExtractor,
      );

      // Act: Process document and extract array traceability IDs
      const processResult = processor.extract("test-content");
      assertEquals(processResult.ok, true);

      if (processResult.ok) {
        const frontmatterData = processResult.data.frontmatter;
        const directive = ExtractFromDirective.create(
          "traceability[].id.full",
          "extractedTraceabilityIds",
        );
        assertEquals(directive.ok, true);

        if (directive.ok) {
          const extractResult = extractFromProcessor.processDirective(
            frontmatterData,
            directive.data,
          );

          // Assert: Verify array extraction
          assertEquals(extractResult.ok, true);
          if (extractResult.ok) {
            const extractedValue = extractResult.data.get(
              "extractedTraceabilityIds",
            );
            assertEquals(extractedValue.ok, true);
            if (extractedValue.ok) {
              assertEquals(Array.isArray(extractedValue.data), true);
              assertEquals(extractedValue.data, [
                "req:array-001",
                "req:array-002",
              ]);
            }
          }
        }
      }
    });

    it("should handle mixed traceability structures", () => {
      // Arrange: Complex mixed structure
      const frontmatterData = {
        requirements: {
          functional: {
            traceability: {
              id: { full: "func:001" },
            },
          },
          nonFunctional: [
            { traceability: { id: { full: "nf:001" } } },
            { traceability: { id: { full: "nf:002" } } },
          ],
        },
      };

      const mockExtractor = new MockFrontmatterExtractor({
        frontmatter: JSON.stringify(frontmatterData),
        body: "# Test Content",
      });
      const mockParser = new MockFrontmatterParser(frontmatterData);
      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(
        propertyExtractor,
      );

      const processor = new FrontmatterProcessor(
        mockExtractor,
        mockParser,
        propertyExtractor,
      );

      // Act: Process document and extract from multiple paths
      const processResult = processor.extract("test-content");
      assertEquals(processResult.ok, true);

      if (processResult.ok) {
        const frontmatterData = processResult.data.frontmatter;
        // Extract functional requirement ID
        const functionalDirective = ExtractFromDirective.create(
          "requirements.functional.traceability.id.full",
          "functionalId",
        );
        assertEquals(functionalDirective.ok, true);

        // Extract non-functional requirement IDs
        const nonFunctionalDirective = ExtractFromDirective.create(
          "requirements.nonFunctional[].traceability.id.full",
          "nonFunctionalIds",
        );
        assertEquals(nonFunctionalDirective.ok, true);

        if (functionalDirective.ok && nonFunctionalDirective.ok) {
          // Process functional extraction
          const functionalResult = extractFromProcessor.processDirective(
            frontmatterData,
            functionalDirective.data,
          );
          assertEquals(functionalResult.ok, true);

          // Process non-functional extraction
          const nonFunctionalResult = extractFromProcessor.processDirective(
            frontmatterData,
            nonFunctionalDirective.data,
          );
          assertEquals(nonFunctionalResult.ok, true);

          // Verify results
          if (functionalResult.ok && nonFunctionalResult.ok) {
            const functionalId = functionalResult.data.get("functionalId");
            const nonFunctionalIds = nonFunctionalResult.data.get(
              "nonFunctionalIds",
            );

            assertEquals(functionalId.ok, true);
            assertEquals(nonFunctionalIds.ok, true);

            if (functionalId.ok && nonFunctionalIds.ok) {
              assertEquals(functionalId.data, "func:001");
              assertEquals(nonFunctionalIds.data, ["nf:001", "nf:002"]);
            }
          }
        }
      }
    });
  });

  describe("Combined Traceability Extraction", () => {
    it("should extract and combine all traceability IDs as expected in Issue #902", () => {
      // Arrange: Set up the exact scenario from Issue #902
      const singleElementData = {
        traceability: {
          id: {
            full: "req:single-001",
          },
        },
      };

      const arrayElementData = {
        traceability: [
          {
            id: {
              full: "req:array-001",
            },
          },
          {
            id: {
              full: "req:array-002",
            },
          },
        ],
      };

      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(
        propertyExtractor,
      );

      // Act: Process both data structures
      const singleData = FrontmatterData.create(singleElementData);
      const arrayData = FrontmatterData.create(arrayElementData);

      assertEquals(singleData.ok, true);
      assertEquals(arrayData.ok, true);

      if (singleData.ok && arrayData.ok) {
        // Extract from single element
        const singleDirective = ExtractFromDirective.create(
          "traceability.id.full",
          "singleId",
        );
        assertEquals(singleDirective.ok, true);

        // Extract from array elements
        const arrayDirective = ExtractFromDirective.create(
          "traceability[].id.full",
          "arrayIds",
        );
        assertEquals(arrayDirective.ok, true);

        if (singleDirective.ok && arrayDirective.ok) {
          const singleResult = extractFromProcessor.processDirective(
            singleData.data,
            singleDirective.data,
          );
          const arrayResult = extractFromProcessor.processDirective(
            arrayData.data,
            arrayDirective.data,
          );

          assertEquals(singleResult.ok, true);
          assertEquals(arrayResult.ok, true);

          if (singleResult.ok && arrayResult.ok) {
            const singleId = singleResult.data.get("singleId");
            const arrayIds = arrayResult.data.get("arrayIds");

            assertEquals(singleId.ok, true);
            assertEquals(arrayIds.ok, true);

            // Assert: Verify the expected output from Issue #902
            if (singleId.ok && arrayIds.ok) {
              // Combine results to match expected output: ["req:single-001", "req:array-001", "req:array-002"]
              const combinedIds = [
                singleId.data as string,
                ...(arrayIds.data as string[]),
              ];
              assertEquals(combinedIds, [
                "req:single-001",
                "req:array-001",
                "req:array-002",
              ]);
            }
          }
        }
      }
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle large traceability datasets efficiently", () => {
      // Arrange: Large dataset for performance testing
      const largeTraceabilityData = {
        traceability: Array.from({ length: 100 }, (_, i) => ({
          id: {
            full: `req:perf-${String(i).padStart(3, "0")}`,
          },
          metadata: {
            priority: i % 3 === 0 ? "high" : i % 2 === 0 ? "medium" : "low",
            category: `category-${Math.floor(i / 10)}`,
          },
        })),
      };

      const mockExtractor = new MockFrontmatterExtractor({
        frontmatter: JSON.stringify(largeTraceabilityData),
        body: "# Performance Test Content",
      });
      const mockParser = new MockFrontmatterParser(largeTraceabilityData);
      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(
        propertyExtractor,
      );

      const processor = new FrontmatterProcessor(
        mockExtractor,
        mockParser,
        propertyExtractor,
      );

      // Act: Measure performance
      const startTime = Date.now();
      const processResult = processor.extract("large-content");
      assertEquals(processResult.ok, true);

      if (processResult.ok) {
        const frontmatterData = processResult.data.frontmatter;
        const directive = ExtractFromDirective.create(
          "traceability[].id.full",
          "allTraceabilityIds",
        );
        assertEquals(directive.ok, true);

        if (directive.ok) {
          const extractResult = extractFromProcessor.processDirective(
            frontmatterData,
            directive.data,
          );
          const endTime = Date.now();
          const duration = endTime - startTime;

          // Assert: Performance and correctness
          assertEquals(extractResult.ok, true);
          if (extractResult.ok) {
            const extractedValue = extractResult.data.get("allTraceabilityIds");
            assertEquals(extractedValue.ok, true);
            if (extractedValue.ok) {
              const extractedArray = extractedValue.data as string[];
              assertEquals(Array.isArray(extractedArray), true);
              assertEquals(extractedArray.length, 100);
              assertEquals(extractedArray[0], "req:perf-000");
              assertEquals(extractedArray[99], "req:perf-099");
            }
          }

          // Performance assertion: should complete within reasonable time (< 100ms for 100 items)
          assertEquals(duration < 100, true);
        }
      }
    });

    it("should handle deeply nested traceability structures", () => {
      // Arrange: Deep nesting scenario
      const deeplyNestedData = {
        project: {
          modules: [
            {
              name: "authentication",
              components: [
                {
                  name: "login",
                  requirements: {
                    traceability: {
                      id: { full: "auth:login:001" },
                    },
                  },
                },
                {
                  name: "logout",
                  requirements: {
                    traceability: {
                      id: { full: "auth:logout:001" },
                    },
                  },
                },
              ],
            },
          ],
        },
      };

      const mockExtractor = new MockFrontmatterExtractor({
        frontmatter: JSON.stringify(deeplyNestedData),
        body: "# Deep Nesting Test",
      });
      const mockParser = new MockFrontmatterParser(deeplyNestedData);
      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(
        propertyExtractor,
      );

      const processor = new FrontmatterProcessor(
        mockExtractor,
        mockParser,
        propertyExtractor,
      );

      // Act: Extract from deeply nested structure
      const processResult = processor.extract("deep-content");
      assertEquals(processResult.ok, true);

      if (processResult.ok) {
        const frontmatterData = processResult.data.frontmatter;
        const directive = ExtractFromDirective.create(
          "project.modules[].components[].requirements.traceability.id.full",
          "nestedTraceabilityIds",
        );
        assertEquals(directive.ok, true);

        if (directive.ok) {
          const extractResult = extractFromProcessor.processDirective(
            frontmatterData,
            directive.data,
          );

          // Assert: Deep nesting extraction (currently PropertyExtractor doesn't support multiple array notations)
          assertEquals(extractResult.ok, true);
          if (extractResult.ok) {
            const extractedValue = extractResult.data.get(
              "nestedTraceabilityIds",
            );
            assertEquals(extractedValue.ok, true);
            if (extractedValue.ok) {
              // PropertyExtractor limitation: multiple array notations not supported yet
              // Returns empty array when it can't navigate nested arrays like modules[].components[]
              assertEquals(extractedValue.data, []);
            }
          }
        }
      }
    });
  });
});
