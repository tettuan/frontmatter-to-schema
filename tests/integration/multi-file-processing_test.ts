/**
 * @fileoverview Multi-File Processing Integration Tests
 * @description Tests multi-file processing scenarios with x-extract-from directives
 * Following DDD and Totality principles with robust integration testing
 *
 * Integration Test Scenarios:
 * 1. Simulated multi-file extraction patterns
 * 2. Batch processing with consistent directive patterns
 * 3. File processing reliability and error handling
 * 4. Performance validation for multiple file scenarios
 */

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { FrontmatterProcessor } from "../../src/domain/frontmatter/processors/frontmatter-processor.ts";
import { PropertyExtractor } from "../../src/domain/schema/extractors/property-extractor.ts";
import { ExtractFromProcessor } from "../../src/domain/schema/services/extract-from-processor.ts";
import { ExtractFromDirective } from "../../src/domain/schema/value-objects/extract-from-directive.ts";
import { ok } from "../../src/domain/shared/types/result.ts";

/**
 * Mock implementations for multi-file simulation
 * Following established patterns from existing integration tests
 */
class MockFileExtractor {
  constructor(
    private readonly dataToReturn: { frontmatter: string; body: string },
  ) {}

  extract(_content: string) {
    return ok(this.dataToReturn);
  }
}

class MockFileParser {
  constructor(private readonly dataToReturn: unknown) {}

  parse(_yaml: string) {
    return ok(this.dataToReturn);
  }
}

describe("Multi-File Processing Integration Tests", () => {
  describe("Simulated Multi-File Extraction Patterns", () => {
    it("should process multiple file configurations with consistent patterns", () => {
      // Arrange: Simulate different file configurations
      const fileConfigurations = [
        {
          name: "requirements1.md",
          data: {
            traceability: { id: { full: "req:file1-001" } },
            priority: "high",
            category: "functional",
          },
        },
        {
          name: "requirements2.md",
          data: {
            traceability: { id: { full: "req:file2-001" } },
            priority: "medium",
            category: "non-functional",
          },
        },
        {
          name: "requirements3.md",
          data: {
            traceability: { id: { full: "req:file3-001" } },
            priority: "low",
            category: "technical",
          },
        },
      ];

      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(propertyExtractor);

      // Act: Process each file configuration
      const aggregatedResults: Array<{ file: string; id: string; priority: string; category: string }> = [];

      for (const config of fileConfigurations) {
        const mockExtractor = new MockFileExtractor({
          frontmatter: JSON.stringify(config.data),
          body: `# ${config.name} Content`,
        });
        const mockParser = new MockFileParser(config.data);

        const processor = new FrontmatterProcessor(
          mockExtractor,
          mockParser,
          propertyExtractor,
        );

        const processResult = processor.extract(`content for ${config.name}`);
        assertEquals(processResult.ok, true);

        if (processResult.ok) {
          const frontmatterData = processResult.data.frontmatter;

          // Extract all properties using multiple directives
          const idDirective = ExtractFromDirective.create("traceability.id.full", "id");
          const priorityDirective = ExtractFromDirective.create("priority", "priority");
          const categoryDirective = ExtractFromDirective.create("category", "category");

          assertEquals(idDirective.ok, true);
          assertEquals(priorityDirective.ok, true);
          assertEquals(categoryDirective.ok, true);

          if (idDirective.ok && priorityDirective.ok && categoryDirective.ok) {
            let workingData = frontmatterData;

            // Process ID extraction
            const idResult = extractFromProcessor.processDirective(workingData, idDirective.data);
            assertEquals(idResult.ok, true);
            if (idResult.ok) workingData = idResult.data;

            // Process priority extraction
            const priorityResult = extractFromProcessor.processDirective(workingData, priorityDirective.data);
            assertEquals(priorityResult.ok, true);
            if (priorityResult.ok) workingData = priorityResult.data;

            // Process category extraction
            const categoryResult = extractFromProcessor.processDirective(workingData, categoryDirective.data);
            assertEquals(categoryResult.ok, true);
            if (categoryResult.ok) workingData = categoryResult.data;

            // Collect results
            const id = workingData.get("id");
            const priority = workingData.get("priority");
            const category = workingData.get("category");

            assertEquals(id.ok, true);
            assertEquals(priority.ok, true);
            assertEquals(category.ok, true);

            if (id.ok && priority.ok && category.ok) {
              aggregatedResults.push({
                file: config.name,
                id: id.data as string,
                priority: priority.data as string,
                category: category.data as string,
              });
            }
          }
        }
      }

      // Assert: Verify all files processed correctly
      assertEquals(aggregatedResults.length, 3);
      assertEquals(aggregatedResults[0].id, "req:file1-001");
      assertEquals(aggregatedResults[0].priority, "high");
      assertEquals(aggregatedResults[0].category, "functional");
      assertEquals(aggregatedResults[1].id, "req:file2-001");
      assertEquals(aggregatedResults[1].priority, "medium");
      assertEquals(aggregatedResults[1].category, "non-functional");
      assertEquals(aggregatedResults[2].id, "req:file3-001");
      assertEquals(aggregatedResults[2].priority, "low");
      assertEquals(aggregatedResults[2].category, "technical");
    });

    it("should handle array-based file configurations", () => {
      // Arrange: Files with array structures
      const arrayFileConfigurations = [
        {
          name: "components1.md",
          data: {
            components: [
              { traceability: { id: { full: "comp:auth:001" } }, type: "authentication" },
              { traceability: { id: { full: "comp:authz:001" } }, type: "authorization" },
            ],
          },
        },
        {
          name: "components2.md",
          data: {
            components: [
              { traceability: { id: { full: "comp:log:001" } }, type: "logging" },
              { traceability: { id: { full: "comp:cache:001" } }, type: "caching" },
              { traceability: { id: { full: "comp:db:001" } }, type: "database" },
            ],
          },
        },
      ];

      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(propertyExtractor);

      // Act: Process array-based files
      const allComponentIds: string[] = [];

      for (const config of arrayFileConfigurations) {
        const mockExtractor = new MockFileExtractor({
          frontmatter: JSON.stringify(config.data),
          body: `# ${config.name} Content`,
        });
        const mockParser = new MockFileParser(config.data);

        const processor = new FrontmatterProcessor(
          mockExtractor,
          mockParser,
          propertyExtractor,
        );

        const processResult = processor.extract(`content for ${config.name}`);
        assertEquals(processResult.ok, true);

        if (processResult.ok) {
          const frontmatterData = processResult.data.frontmatter;
          const directive = ExtractFromDirective.create("components[].traceability.id.full", "componentIds");
          assertEquals(directive.ok, true);

          if (directive.ok) {
            const extractResult = extractFromProcessor.processDirective(frontmatterData, directive.data);
            assertEquals(extractResult.ok, true);

            if (extractResult.ok) {
              const extractedValue = extractResult.data.get("componentIds");
              assertEquals(extractedValue.ok, true);

              if (extractedValue.ok) {
                const ids = extractedValue.data as string[];
                allComponentIds.push(...ids);
              }
            }
          }
        }
      }

      // Assert: Verify aggregated array results
      assertEquals(allComponentIds.length, 5);
      assertEquals(allComponentIds, [
        "comp:auth:001",
        "comp:authz:001",
        "comp:log:001",
        "comp:cache:001",
        "comp:db:001",
      ]);
    });
  });

  describe("Batch Processing Performance", () => {
    it("should handle large batch processing efficiently", () => {
      // Arrange: Large number of file simulations
      const batchSize = 25;
      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(propertyExtractor);

      // Act: Process batch
      const startTime = Date.now();
      const batchResults: string[] = [];

      for (let i = 0; i < batchSize; i++) {
        const fileData = {
          traceability: {
            id: { full: `batch:${String(i).padStart(3, "0")}` },
            index: i,
          },
        };

        const mockExtractor = new MockFileExtractor({
          frontmatter: JSON.stringify(fileData),
          body: `# Batch File ${i}`,
        });
        const mockParser = new MockFileParser(fileData);

        const processor = new FrontmatterProcessor(
          mockExtractor,
          mockParser,
          propertyExtractor,
        );

        const processResult = processor.extract(`batch-file-${i}.md`);
        assertEquals(processResult.ok, true);

        if (processResult.ok) {
          const frontmatterData = processResult.data.frontmatter;
          const directive = ExtractFromDirective.create("traceability.id.full", "batchId");
          assertEquals(directive.ok, true);

          if (directive.ok) {
            const extractResult = extractFromProcessor.processDirective(frontmatterData, directive.data);
            assertEquals(extractResult.ok, true);

            if (extractResult.ok) {
              const extractedValue = extractResult.data.get("batchId");
              assertEquals(extractedValue.ok, true);

              if (extractedValue.ok) {
                batchResults.push(extractedValue.data as string);
              }
            }
          }
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert: Performance and correctness
      assertEquals(batchResults.length, batchSize);
      assertEquals(batchResults[0], "batch:000");
      assertEquals(batchResults[batchSize - 1], `batch:${String(batchSize - 1).padStart(3, "0")}`);

      // Performance assertion: should complete within reasonable time (< 200ms for 25 files)
      assertEquals(duration < 200, true);
    });
  });

  describe("Error Handling in Multi-File Context", () => {
    it("should handle mixed success and failure scenarios", () => {
      // Arrange: Mix of valid and invalid configurations
      const mixedConfigurations = [
        {
          name: "valid1.md",
          data: { traceability: { id: { full: "valid:001" } } },
          expectSuccess: true,
        },
        {
          name: "invalid1.md",
          data: { title: "Missing traceability" },
          expectSuccess: false,
        },
        {
          name: "valid2.md",
          data: { traceability: { id: { full: "valid:002" } } },
          expectSuccess: true,
        },
      ];

      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(propertyExtractor);

      // Act: Process mixed configurations
      const results: Array<{ file: string; success: boolean; id?: string }> = [];

      for (const config of mixedConfigurations) {
        const mockExtractor = new MockFileExtractor({
          frontmatter: JSON.stringify(config.data),
          body: `# ${config.name} Content`,
        });
        const mockParser = new MockFileParser(config.data);

        const processor = new FrontmatterProcessor(
          mockExtractor,
          mockParser,
          propertyExtractor,
        );

        const processResult = processor.extract(`content for ${config.name}`);
        assertEquals(processResult.ok, true);

        if (processResult.ok) {
          const frontmatterData = processResult.data.frontmatter;
          const directive = ExtractFromDirective.create("traceability.id.full", "fileId");
          assertEquals(directive.ok, true);

          if (directive.ok) {
            const extractResult = extractFromProcessor.processDirective(frontmatterData, directive.data);
            assertEquals(extractResult.ok, true);

            if (extractResult.ok) {
              const extractedValue = extractResult.data.get("fileId");

              if (extractedValue.ok) {
                results.push({
                  file: config.name,
                  success: true,
                  id: extractedValue.data as string,
                });
              } else {
                results.push({
                  file: config.name,
                  success: false,
                });
              }
            }
          }
        }
      }

      // Assert: Verify mixed results handled correctly
      assertEquals(results.length, 3);
      assertEquals(results[0].success, true);
      assertEquals(results[0].id, "valid:001");
      assertEquals(results[1].success, false);
      assertEquals(results[2].success, true);
      assertEquals(results[2].id, "valid:002");
    });
  });

  describe("Complex Multi-File Patterns", () => {
    it("should handle heterogeneous file structures in batch", () => {
      // Arrange: Different file structure types
      const heterogeneousConfigurations = [
        {
          name: "single-element.md",
          data: {
            metadata: { traceability: { id: { full: "single:001" } } },
          },
          extractPath: "metadata.traceability.id.full",
        },
        {
          name: "array-elements.md",
          data: {
            items: [
              { traceability: { id: { full: "array:001" } } },
              { traceability: { id: { full: "array:002" } } },
            ],
          },
          extractPath: "items[].traceability.id.full",
        },
        {
          name: "nested-structure.md",
          data: {
            project: {
              modules: {
                core: { traceability: { id: { full: "nested:001" } } },
              },
            },
          },
          extractPath: "project.modules.core.traceability.id.full",
        },
      ];

      const propertyExtractor = PropertyExtractor.create();
      const extractFromProcessor = ExtractFromProcessor.create(propertyExtractor);

      // Act: Process heterogeneous structures
      const structureResults: Array<{ file: string; extractedIds: string[] }> = [];

      for (const config of heterogeneousConfigurations) {
        const mockExtractor = new MockFileExtractor({
          frontmatter: JSON.stringify(config.data),
          body: `# ${config.name} Content`,
        });
        const mockParser = new MockFileParser(config.data);

        const processor = new FrontmatterProcessor(
          mockExtractor,
          mockParser,
          propertyExtractor,
        );

        const processResult = processor.extract(`content for ${config.name}`);
        assertEquals(processResult.ok, true);

        if (processResult.ok) {
          const frontmatterData = processResult.data.frontmatter;
          const directive = ExtractFromDirective.create(config.extractPath, "extractedIds");
          assertEquals(directive.ok, true);

          if (directive.ok) {
            const extractResult = extractFromProcessor.processDirective(frontmatterData, directive.data);
            assertEquals(extractResult.ok, true);

            if (extractResult.ok) {
              const extractedValue = extractResult.data.get("extractedIds");
              assertEquals(extractedValue.ok, true);

              if (extractedValue.ok) {
                // Normalize to array for consistent handling
                const ids = Array.isArray(extractedValue.data)
                  ? extractedValue.data as string[]
                  : [extractedValue.data as string];

                structureResults.push({
                  file: config.name,
                  extractedIds: ids,
                });
              }
            }
          }
        }
      }

      // Assert: Verify heterogeneous processing
      assertEquals(structureResults.length, 3);
      assertEquals(structureResults[0].extractedIds, ["single:001"]);
      assertEquals(structureResults[1].extractedIds, ["array:001", "array:002"]);
      assertEquals(structureResults[2].extractedIds, ["nested:001"]);
    });
  });
});