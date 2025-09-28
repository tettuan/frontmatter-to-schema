import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { FrontmatterAnalysisDomainService } from "../../../src/domain/frontmatter/services/frontmatter-analysis-domain-service.ts";
import { DataProcessingInstructionDomainService } from "../../../src/domain/data-processing/services/data-processing-instruction-domain-service.ts";
import { TemplateManagementDomainService } from "../../../src/domain/template/services/template-management-domain-service.ts";
import { Schema } from "../../../src/domain/schema/entities/schema.ts";
import { SchemaDefinition } from "../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPath } from "../../../src/domain/schema/value-objects/schema-path.ts";
import { err, ok } from "../../../src/domain/shared/types/result.ts";
import { createError } from "../../../src/domain/shared/types/errors.ts";

// Test helpers for integration testing
class MockFileReader {
  constructor(private mockFiles: Map<string, string> = new Map()) {}

  read(path: string) {
    const content = this.mockFiles.get(path);
    if (content === undefined) {
      return err(createError({
        kind: "FileNotFound",
        path,
      }));
    }
    return ok(content);
  }

  setMockFile(path: string, content: string) {
    this.mockFiles.set(path, content);
  }
}

class MockFileLister {
  constructor(private mockFileList: string[] = []) {}

  list(_pattern: string) {
    return ok(this.mockFileList);
  }

  setMockFiles(files: string[]) {
    this.mockFileList = files;
  }
}

// Integration test fixtures
const createIntegrationSchema = () => {
  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      title: { type: "string", "x-frontmatter-part": true },
      date: { type: "string" },
      author: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      content: { type: "string" },
    },
    "x-template": `# {{title}}

**Author**: {{author}}
**Date**: {{date}}

{{content}}

**Tags**: {{tags}}
`,
    "x-template-items": "articles",
    "x-jmespath-filter": "[?contains(tags, 'featured')]",
  });
  const path = SchemaPath.create("integration-test-schema.json");

  if (!definition.ok) throw new Error("Failed to create schema definition");
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

const createIntegrationSchemaNoFilter = () => {
  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      title: { type: "string", "x-frontmatter-part": true },
      date: { type: "string" },
      author: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      content: { type: "string" },
    },
    "x-template": `# {{title}}

**Author**: {{author}}
**Date**: {{date}}

{{content}}

**Tags**: {{tags}}
`,
    "x-template-items": "articles",
  });
  const path = SchemaPath.create("integration-test-schema-no-filter.json");

  if (!definition.ok) throw new Error("Failed to create schema definition");
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

const createSampleMarkdownFiles = () => ({
  "article1.md": `---
title: Introduction to TypeScript
date: 2023-01-01
author: John Doe
tags: [programming, typescript, featured]
---

# Introduction to TypeScript

TypeScript is a strongly typed programming language that builds on JavaScript.
`,
  "article2.md": `---
title: Getting Started with Deno
date: 2023-01-02
author: Jane Smith
tags: [programming, deno, runtime]
---

# Getting Started with Deno

Deno is a modern runtime for JavaScript and TypeScript.
`,
  "article3.md": `---
title: Domain-Driven Design Principles
date: 2023-01-03
author: Bob Wilson
tags: [architecture, ddd, featured]
---

# Domain-Driven Design Principles

DDD is an approach to software development that centers on the domain model.
`,
});

describe("Three Domain Integration Tests", () => {
  describe("Complete Data Flow Integration", () => {
    it("should integrate all three domains for complete processing flow", async () => {
      // Setup mock infrastructure
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();
      const sampleFiles = createSampleMarkdownFiles();

      // Setup mock files
      Object.entries(sampleFiles).forEach(([path, content]) => {
        fileReader.setMockFile(path, content);
      });
      fileLister.setMockFiles(Object.keys(sampleFiles));

      // Create domain services
      const frontmatterService = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const dataProcessingService = DataProcessingInstructionDomainService
        .create();
      const templateService = TemplateManagementDomainService.create(
        fileReader,
      );

      assertEquals(frontmatterService.ok, true);
      assertEquals(dataProcessingService.ok, true);
      assertEquals(templateService.ok, true);

      if (
        frontmatterService.ok && dataProcessingService.ok && templateService.ok
      ) {
        const schema = createIntegrationSchema();
        assertEquals(schema.ok, true);

        if (schema.ok) {
          // Step 1: Extract frontmatter data (Frontmatter Domain)
          const extractResult = frontmatterService.data.extractFrontmatterData(
            "*.md",
            schema.data,
          );
          assertEquals(extractResult.ok, true);
          assertEquals(frontmatterService.data.getExtractedCount(), 3);

          // Step 2: Get extracted data for processing
          const extractedDataResult = frontmatterService.data
            .getExtractedDataForProcessing();
          assertEquals(extractedDataResult.ok, true);

          if (extractedDataResult.ok) {
            // Step 3: Initialize data in processing domain (Data Processing Domain)
            const initResult = dataProcessingService.data
              .initializeWithFrontmatterData(
                extractedDataResult.data,
                schema.data,
              );
            assertEquals(initResult.ok, true);

            // Step 4: Process data with filtering (Data Processing Domain)
            const processedDataResult = dataProcessingService.data
              .getProcessedData(
                "",
              );
            assertEquals(processedDataResult.ok, true);

            if (processedDataResult.ok) {
              // Should filter to only featured articles (article1 and article3)
              const data = processedDataResult.data as any[];
              // Data is already filtered by x-jmespath-filter directive
              assertEquals(data.length, 2);

              // Step 5: Extract template configuration from schema (Template Domain)
              const templateConfigResult = templateService.data
                .extractTemplateConfiguration(schema.data);
              assertEquals(templateConfigResult.ok, true);

              // Step 5.5: Resolve template files
              const resolveResult = await templateService.data
                .resolveTemplateFiles();
              assertEquals(resolveResult.ok, true);

              // Step 6: Get main template (Template Domain)
              const templateResult = templateService.data.getMainTemplate();
              assertEquals(templateResult.ok, true);

              if (templateResult.ok) {
                const templateContent = templateResult.data;

                // Verify the complete integration result
                assertExists(templateContent);
                assertEquals(typeof templateContent, "string");
                assertEquals(templateContent.length > 0, true);

                // Verify that template contains expected variables
                assertEquals(templateContent.includes("{{title}}"), true);
              }
            }
          }
        }
      }
    });
  });

  describe("Domain Boundary Validation", () => {
    it("should maintain data integrity across domain boundaries", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();
      const sampleFiles = createSampleMarkdownFiles();

      Object.entries(sampleFiles).forEach(([path, content]) => {
        fileReader.setMockFile(path, content);
      });
      fileLister.setMockFiles(Object.keys(sampleFiles));

      const frontmatterService = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const dataProcessingService = DataProcessingInstructionDomainService
        .create();

      assertEquals(frontmatterService.ok, true);
      assertEquals(dataProcessingService.ok, true);

      if (frontmatterService.ok && dataProcessingService.ok) {
        const schema = createIntegrationSchemaNoFilter();
        assertEquals(schema.ok, true);

        if (schema.ok) {
          // Extract data in frontmatter domain
          const extractResult = frontmatterService.data.extractFrontmatterData(
            "*.md",
            schema.data,
          );
          assertEquals(extractResult.ok, true);

          const extractedDataResult = frontmatterService.data
            .getExtractedDataForProcessing();
          assertEquals(extractedDataResult.ok, true);

          if (extractedDataResult.ok) {
            const originalData = extractedDataResult.data;

            // Load into processing domain
            const loadResult = dataProcessingService.data
              .initializeWithFrontmatterData(originalData, schema.data);
            assertEquals(loadResult.ok, true);

            // Verify data integrity across boundary
            const processedDataResult = dataProcessingService.data
              .getProcessedData("");
            assertEquals(processedDataResult.ok, true);

            if (processedDataResult.ok) {
              const processedData = processedDataResult.data as any[];

              // Data count should be preserved
              assertEquals(processedData.length, originalData.length);

              // Data structure should be preserved
              originalData.forEach((originalItem, index) => {
                const processedItem = processedData[index];
                assertEquals(processedItem.title, originalItem.title);
                assertEquals(processedItem.author, originalItem.author);
                assertEquals(processedItem.date, originalItem.date);
              });
            }
          }
        }
      }
    });

    it("should handle cross-domain error propagation correctly", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      // Setup invalid scenario - no files
      fileLister.setMockFiles(["nonexistent.md"]);

      const frontmatterService = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const dataProcessingService = DataProcessingInstructionDomainService
        .create();

      assertEquals(frontmatterService.ok, true);
      assertEquals(dataProcessingService.ok, true);

      if (frontmatterService.ok && dataProcessingService.ok) {
        const schema = createIntegrationSchemaNoFilter();
        assertEquals(schema.ok, true);

        if (schema.ok) {
          // Should succeed but extract no data due to missing file
          const extractResult = frontmatterService.data.extractFrontmatterData(
            "*.md",
            schema.data,
          );
          assertEquals(extractResult.ok, true);
          assertEquals(frontmatterService.data.getExtractedCount(), 0);

          // Processing domain should handle empty data gracefully
          const loadResult = dataProcessingService.data
            .initializeWithFrontmatterData([], schema.data);
          assertEquals(loadResult.ok, false); // Empty data initialization should fail as expected
          // Service should handle empty data correctly
          const testDataAccess = dataProcessingService.data.getProcessedData(
            "test",
          );
          assertEquals(testDataAccess.ok, false);
        }
      }
    });
  });

  describe("Schema-Driven Integration", () => {
    it("should coordinate all domains based on schema directives", async () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();
      const sampleFiles = createSampleMarkdownFiles();

      Object.entries(sampleFiles).forEach(([path, content]) => {
        fileReader.setMockFile(path, content);
      });
      fileLister.setMockFiles(Object.keys(sampleFiles));

      // Create schema with specific x-directives
      const definition = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string", "x-frontmatter-part": true },
          "x-template": {
            type: "string",
            default: "## {{title}}\n\nAuthor: {{author}}\n\n{{content}}\n",
          },
          "x-jmespath-filter": {
            type: "string",
            default: "[?contains(tags, 'programming')]",
          },
        },
      });

      assertEquals(definition.ok, true);

      if (definition.ok) {
        const path = SchemaPath.create("unit-test-schema.json");
        if (!path.ok) throw new Error("Failed to create schema path");

        const schema = Schema.create(path.data, definition.data);

        assertEquals(schema.ok, true);

        if (schema.ok) {
          const frontmatterService = FrontmatterAnalysisDomainService.create(
            fileReader,
            fileLister,
          );
          const dataProcessingService = DataProcessingInstructionDomainService
            .create();
          const templateService = TemplateManagementDomainService.create(
            fileReader,
          );

          assertEquals(frontmatterService.ok, true);
          assertEquals(dataProcessingService.ok, true);
          assertEquals(templateService.ok, true);

          if (
            frontmatterService.ok && dataProcessingService.ok &&
            templateService.ok
          ) {
            // Process with schema directives
            const extractResult = frontmatterService.data
              .extractFrontmatterData("*.md", schema.data);
            assertEquals(extractResult.ok, true);

            const extractedDataResult = frontmatterService.data
              .getExtractedDataForProcessing();
            assertEquals(extractedDataResult.ok, true);

            if (extractedDataResult.ok) {
              const loadResult = dataProcessingService.data
                .initializeWithFrontmatterData(
                  extractedDataResult.data,
                  schema.data,
                );
              assertEquals(loadResult.ok, true);

              // Filter based on x-jmespath-filter directive
              const processedDataResult = dataProcessingService.data
                .getProcessedData(
                  "",
                );
              assertEquals(processedDataResult.ok, true);

              if (processedDataResult.ok) {
                // Should filter to featured articles (schema has x-jmespath-filter)
                const data = processedDataResult.data as any[];
                // Data is already filtered by x-jmespath-filter directive for 'featured'
                assertEquals(data.length, 2); // article1 and article3

                // Use template from x-template directive
                const templateLoadResult = templateService.data
                  .extractTemplateConfiguration(schema.data);
                assertEquals(templateLoadResult.ok, true);

                const resolveResult = await templateService.data
                  .resolveTemplateFiles();
                assertEquals(resolveResult.ok, true);

                const renderResult = templateService.data.getMainTemplate();
                assertEquals(renderResult.ok, true);

                if (renderResult.ok) {
                  const rendered = renderResult.data;
                  // Verify template contains expected variables
                  assertEquals(rendered.includes("{{title}}"), true);
                  assertEquals(rendered.includes("{{author}}"), true);
                }
              }
            }
          }
        }
      }
    });
  });

  describe("Performance and Consistency Integration", () => {
    it("should maintain performance across domain operations", async () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();
      const sampleFiles = createSampleMarkdownFiles();

      Object.entries(sampleFiles).forEach(([path, content]) => {
        fileReader.setMockFile(path, content);
      });
      fileLister.setMockFiles(Object.keys(sampleFiles));

      const frontmatterService = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const dataProcessingService = DataProcessingInstructionDomainService
        .create();
      const templateService = TemplateManagementDomainService.create(
        fileReader,
      );

      assertEquals(frontmatterService.ok, true);
      assertEquals(dataProcessingService.ok, true);
      assertEquals(templateService.ok, true);

      if (
        frontmatterService.ok && dataProcessingService.ok && templateService.ok
      ) {
        const schema = createIntegrationSchemaNoFilter();
        assertEquals(schema.ok, true);

        if (schema.ok) {
          // Measure performance of complete flow
          const startTime = performance.now();

          const extractResult = frontmatterService.data.extractFrontmatterData(
            "*.md",
            schema.data,
          );
          assertEquals(extractResult.ok, true);

          const extractedDataResult = frontmatterService.data
            .getExtractedDataForProcessing();
          assertEquals(extractedDataResult.ok, true);

          if (extractedDataResult.ok) {
            const loadResult = dataProcessingService.data
              .initializeWithFrontmatterData(
                extractedDataResult.data,
                schema.data,
              );
            assertEquals(loadResult.ok, true);

            const processedDataResult = dataProcessingService.data
              .getProcessedData("");
            assertEquals(processedDataResult.ok, true);

            if (processedDataResult.ok) {
              const templateLoadResult = templateService.data
                .extractTemplateConfiguration(schema.data);
              assertEquals(templateLoadResult.ok, true);

              const resolveResult = await templateService.data
                .resolveTemplateFiles();
              assertEquals(resolveResult.ok, true);

              const renderResult = templateService.data.getMainTemplate();
              assertEquals(renderResult.ok, true);
            }
          }

          const endTime = performance.now();
          const duration = endTime - startTime;

          // Performance assertion: complete flow should be fast
          assertEquals(
            duration < 100,
            true,
            `Integration flow took ${duration}ms, expected < 100ms`,
          );
        }
      }
    });
  });
});
