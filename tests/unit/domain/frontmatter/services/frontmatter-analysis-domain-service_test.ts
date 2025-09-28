import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { FrontmatterAnalysisDomainService } from "../../../../../src/domain/frontmatter/services/frontmatter-analysis-domain-service.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { err, ok } from "../../../../../src/domain/shared/types/result.ts";
import { createError } from "../../../../../src/domain/shared/types/errors.ts";

// Test helpers for reproducibility
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

// Test fixtures
const createTestSchema = () => {
  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      // Add x-frontmatter-part directive as boolean marker to the title property
      title: { type: "string", "x-frontmatter-part": true },
      date: { type: "string" },
      "x-template": {
        type: "string",
        default: "# {{title}}\n\nDate: {{date}}",
      },
    },
  });
  const path = SchemaPath.create("frontmatter-test-schema.json");

  if (!definition.ok) throw new Error("Failed to create schema definition");
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

const createSampleMarkdownWithFrontmatter = () =>
  `---
title: Test Article
date: 2023-01-01
author: Test Author
---

# Test Content

This is test content.
`;

const createSampleMarkdownWithoutFrontmatter = () =>
  `# Test Content

This is test content without frontmatter.
`;

describe("FrontmatterAnalysisDomainService", () => {
  describe("Domain Service Creation", () => {
    it("should create service successfully with valid dependencies", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      const result = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );

      assertEquals(result.ok, true);
      assertExists(result.ok && result.data);
    });
  });

  describe("Frontmatter Extraction", () => {
    it("should extract frontmatter data from markdown files", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      // Setup test data
      fileReader.setMockFile("test.md", createSampleMarkdownWithFrontmatter());
      fileLister.setMockFiles(["test.md"]);

      const serviceResult = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;

        const extractResult = service.extractFrontmatterData("*.md", schema);

        assertEquals(extractResult.ok, true);
        assertEquals(service.hasExtractedData(), true);
        assertEquals(service.getExtractedCount(), 1);
      }
    });

    it("should handle files without frontmatter gracefully", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      // Setup test data without frontmatter
      fileReader.setMockFile(
        "test.md",
        createSampleMarkdownWithoutFrontmatter(),
      );
      fileLister.setMockFiles(["test.md"]);

      const serviceResult = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;

        const extractResult = service.extractFrontmatterData("*.md", schema);

        assertEquals(extractResult.ok, true);
        assertEquals(service.getExtractedCount(), 0);
      }
    });

    it("should handle file read errors properly", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      // Setup file list but no actual files in reader
      fileLister.setMockFiles(["nonexistent.md"]);

      const serviceResult = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;

        const extractResult = service.extractFrontmatterData("*.md", schema);

        assertEquals(extractResult.ok, true);
        assertEquals(service.getExtractedCount(), 0);
      }
    });
  });

  describe("Data Access for Processing", () => {
    it("should provide extracted data for processing domain", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      // Setup test data
      fileReader.setMockFile("test.md", createSampleMarkdownWithFrontmatter());
      fileLister.setMockFiles(["test.md"]);

      const serviceResult = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;

        // Extract data first
        const extractResult = service.extractFrontmatterData("*.md", schema);
        assertEquals(extractResult.ok, true);

        // Get data for processing
        const dataResult = service.getExtractedDataForProcessing();
        assertEquals(dataResult.ok, true);

        if (dataResult.ok) {
          assertEquals(Array.isArray(dataResult.data), true);
          assertEquals(dataResult.data.length, 1);
          assertEquals(dataResult.data[0].title, "Test Article");
          // YAML parser correctly parses dates as Date objects
          const date = dataResult.data[0].date;
          if (date instanceof Date) {
            assertEquals(date.toISOString().split("T")[0], "2023-01-01");
          } else {
            assertEquals(date, "2023-01-01");
          }
          assertEquals(dataResult.data[0].author, "Test Author");
        }
      }
    });

    it("should fail when no data has been extracted", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      const serviceResult = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      assertEquals(serviceResult.ok, true);

      if (serviceResult.ok) {
        const service = serviceResult.data;
        const dataResult = service.getExtractedDataForProcessing();

        assertEquals(dataResult.ok, false);
        if (!dataResult.ok) {
          assertEquals(dataResult.error.kind, "EXCEPTION_CAUGHT");
        }
      }
    });
  });

  describe("Domain Boundary Protection", () => {
    it("should maintain data integrity through domain boundaries", () => {
      const fileReader = new MockFileReader();
      const fileLister = new MockFileLister();

      // Setup test data
      fileReader.setMockFile("test1.md", createSampleMarkdownWithFrontmatter());
      fileReader.setMockFile(
        "test2.md",
        `---
title: Second Article
tags: [test, demo]
---

# Second Article
`,
      );
      fileLister.setMockFiles(["test1.md", "test2.md"]);

      const serviceResult = FrontmatterAnalysisDomainService.create(
        fileReader,
        fileLister,
      );
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;

        const extractResult = service.extractFrontmatterData("*.md", schema);
        assertEquals(extractResult.ok, true);

        const dataResult = service.getExtractedDataForProcessing();
        assertEquals(dataResult.ok, true);

        if (dataResult.ok) {
          // Verify data integrity
          assertEquals(dataResult.data.length, 2);

          // Verify first article
          const firstArticle = dataResult.data.find((d) =>
            d.title === "Test Article"
          );
          assertExists(firstArticle);
          assertEquals(firstArticle.author, "Test Author");

          // Verify second article
          const secondArticle = dataResult.data.find((d) =>
            d.title === "Second Article"
          );
          assertExists(secondArticle);
          // YAML parser correctly parses arrays as arrays
          const tags = secondArticle.tags;
          if (Array.isArray(tags)) {
            assertEquals(tags, ["test", "demo"]);
          } else {
            assertEquals(tags, "[test, demo]");
          }
        }
      }
    });
  });
});
