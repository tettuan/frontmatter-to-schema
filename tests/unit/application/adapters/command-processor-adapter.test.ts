/**
 * Tests for CommandProcessorAdapter - Stage 1 Processing
 *
 * Tests c1/c2/c3 field extraction, validation, and command generation
 * following TDD and Totality principles.
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { beforeEach, describe, it } from "@std/testing/bdd";

import { CommandProcessorAdapter } from "../../../../src/application/adapters/command-processor-adapter.ts";
import { createDomainError } from "../../../../src/domain/core/result.ts";
import { MockFrontMatterExtractor } from "../../../mocks/front-matter-extractor-mock.ts";
import { MockSchemaAnalyzer } from "../../../mocks/schema-analyzer-mock.ts";
import { MockTemplateMapper } from "../../../mocks/template-mapper-mock.ts";
import {
  createMockDocument,
  createMockSchema,
  createMockTemplate,
} from "../../../test-helpers/mock-factories.ts";
import { FrontMatter } from "../../../../src/domain/models/entities.ts";
import { FrontMatterContent } from "../../../../src/domain/models/value-objects.ts";

describe("CommandProcessorAdapter", () => {
  const mockExtractor = new MockFrontMatterExtractor();
  const mockAnalyzer = new MockSchemaAnalyzer();
  const mockMapper = new MockTemplateMapper();
  const adapter = new CommandProcessorAdapter(
    mockExtractor,
    mockAnalyzer,
    mockMapper,
  );

  // Reset all mocks before each test
  beforeEach(() => {
    mockExtractor.reset();
    mockAnalyzer.reset();
    mockMapper.reset();
  });

  // Helper function to create FrontMatter from object
  function createFrontMatter(data: Record<string, unknown>): FrontMatter {
    const contentResult = FrontMatterContent.fromObject(data);
    if (!contentResult.ok) {
      throw new Error(
        `Failed to create FrontMatterContent: ${
          JSON.stringify(contentResult.error)
        }`,
      );
    }
    return FrontMatter.create(contentResult.data, JSON.stringify(data));
  }

  describe("processDocument - Success Cases", () => {
    it("should successfully process document with valid c1/c2/c3 frontmatter", async () => {
      // Arrange
      const document = createMockDocument({
        path: "/test/valid-command.md",
        content: "# Test Command",
      });

      const frontMatter = {
        c1: "climpt-build",
        c2: "robust",
        c3: "test",
        description: "Test command description",
        options: { input: "file.md" },
      };

      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter(frontMatter),
      });

      const schema = createMockSchema("command-schema");
      const template = createMockTemplate("command-template");

      // Act
      const result = await adapter.processDocument(document, schema, template);

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        assertEquals(result.command.c1, "climpt-build");
        assertEquals(result.command.c2, "robust");
        assertEquals(result.command.c3, "test");
        assertEquals(result.command.sourcePath, "/test/valid-command.md");
        assertEquals(
          result.command.options.description,
          "Test command description",
        );
        assertEquals(result.command.options.options, { input: "file.md" });
      }
    });

    it("should handle frontmatter with additional fields beyond c1/c2/c3", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/extended.md" });
      const frontMatter = {
        c1: "climpt-design",
        c2: "domain",
        c3: "architecture",
        author: "Test Author",
        version: "1.0.0",
        tags: ["domain", "design"],
        complexity: "high",
      };

      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter(frontMatter),
      });

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        assertEquals(result.command.c1, "climpt-design");
        assertEquals(result.command.c2, "domain");
        assertEquals(result.command.c3, "architecture");
        assertEquals(result.command.options.author, "Test Author");
        assertEquals(result.command.options.version, "1.0.0");
        assertEquals(result.command.options.tags, ["domain", "design"]);
        assertEquals(result.command.options.complexity, "high");
      }
    });
  });

  describe("processDocument - Error Cases", () => {
    it("should return NoFrontMatter when document has no frontmatter", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/no-frontmatter.md" });
      mockExtractor.setExtractionResult({ kind: "NotPresent" });

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "NoFrontMatter");
      if (result.kind === "NoFrontMatter") {
        assertEquals(result.documentPath, "/test/no-frontmatter.md");
      }
    });

    it("should return MissingC1C2C3 when c1 field is missing", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/missing-c1.md" });
      const frontMatter = {
        // c1: missing
        c2: "robust",
        c3: "test",
        description: "Test without c1",
      };

      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter(frontMatter),
      });

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "MissingC1C2C3");
      if (result.kind === "MissingC1C2C3") {
        assertEquals(result.missingFields, ["c1"]);
        assertEquals(result.frontMatter, frontMatter);
      }
    });

    it("should return MissingC1C2C3 when c2 field is missing", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/missing-c2.md" });
      const frontMatter = {
        c1: "climpt-build",
        // c2: missing
        c3: "test",
        description: "Test without c2",
      };

      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter(frontMatter),
      });

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "MissingC1C2C3");
      if (result.kind === "MissingC1C2C3") {
        assertEquals(result.missingFields, ["c2"]);
      }
    });

    it("should return MissingC1C2C3 when c3 field is missing", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/missing-c3.md" });
      const frontMatter = {
        c1: "climpt-build",
        c2: "robust",
        // c3: missing
        description: "Test without c3",
      };

      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter(frontMatter),
      });

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "MissingC1C2C3");
      if (result.kind === "MissingC1C2C3") {
        assertEquals(result.missingFields, ["c3"]);
      }
    });

    it("should return MissingC1C2C3 when multiple fields are missing", async () => {
      // Arrange
      const document = createMockDocument({
        path: "/test/missing-multiple.md",
      });
      const frontMatter = {
        // c1: missing
        // c2: missing
        c3: "test",
        description: "Test without c1 and c2",
      };

      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter(frontMatter),
      });

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "MissingC1C2C3");
      if (result.kind === "MissingC1C2C3") {
        assertEquals(result.missingFields.length, 2);
        assertEquals(result.missingFields.includes("c1"), true);
        assertEquals(result.missingFields.includes("c2"), true);
      }
    });

    it("should return MissingC1C2C3 when c1/c2/c3 have wrong types", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/wrong-types.md" });
      const frontMatter = {
        c1: 123, // should be string
        c2: true, // should be string
        c3: ["test"], // should be string
      };

      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter(frontMatter),
      });

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "MissingC1C2C3");
      if (result.kind === "MissingC1C2C3") {
        assertEquals(result.missingFields.length, 3);
        assertEquals(result.missingFields.includes("c1"), true);
        assertEquals(result.missingFields.includes("c2"), true);
        assertEquals(result.missingFields.includes("c3"), true);
      }
    });

    it("should return SchemaAnalysisError when schema analysis fails", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/schema-error.md" });
      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter({ c1: "test", c2: "test", c3: "test" }),
      });

      const baseError = {
        kind: "SchemaValidationFailed" as const,
        schema: "command-schema",
        data: { c1: "test", c2: "test", c3: "test" },
      };
      const error = createDomainError(baseError, "Schema validation failed");
      mockAnalyzer.setAnalysisError(error);

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "SchemaAnalysisError");
      if (result.kind === "SchemaAnalysisError") {
        assertStringIncludes(result.error.message, "Schema validation failed");
      }
    });

    it("should return TemplateMappingError when template mapping fails", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/template-error.md" });
      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter({ c1: "test", c2: "test", c3: "test" }),
      });

      const baseError = {
        kind: "TemplateMappingFailed" as const,
        template: "command-template",
        source: { c1: "test", c2: "test", c3: "test" },
      };
      const error = createDomainError(baseError, "Template mapping failed");
      mockMapper.setMappingError(error);

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "TemplateMappingError");
      if (result.kind === "TemplateMappingError") {
        assertStringIncludes(result.error.message, "Template mapping failed");
      }
    });
  });

  describe("processDocuments - Batch Processing", () => {
    it("should process multiple documents successfully", async () => {
      // Arrange
      const documents = [
        createMockDocument({ path: "/test/doc1.md" }),
        createMockDocument({ path: "/test/doc2.md" }),
        createMockDocument({ path: "/test/doc3.md" }),
      ];

      // Set up successful extraction for all documents
      mockExtractor.setMultipleExtractionResults([
        {
          kind: "Extracted",
          frontMatter: createFrontMatter({
            c1: "climpt-build",
            c2: "robust",
            c3: "test",
          }),
        },
        {
          kind: "Extracted",
          frontMatter: createFrontMatter({
            c1: "climpt-design",
            c2: "domain",
            c3: "architecture",
          }),
        },
        {
          kind: "Extracted",
          frontMatter: createFrontMatter({
            c1: "climpt-spec",
            c2: "analyze",
            c3: "quality-metrics",
          }),
        },
      ]);

      // Act
      const result = await adapter.processDocuments(
        documents,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.successful.length, 3);
      assertEquals(result.failed.length, 0);
      assertEquals(result.successful[0].c1, "climpt-build");
      assertEquals(result.successful[1].c1, "climpt-design");
      assertEquals(result.successful[2].c1, "climpt-spec");
    });

    it("should handle mixed success and failure in batch processing", async () => {
      // Arrange
      const documents = [
        createMockDocument({ path: "/test/success1.md" }),
        createMockDocument({ path: "/test/failure1.md" }),
        createMockDocument({ path: "/test/success2.md" }),
      ];

      mockExtractor.setMultipleExtractionResults([
        {
          kind: "Extracted",
          frontMatter: createFrontMatter({
            c1: "climpt-build",
            c2: "robust",
            c3: "test",
          }),
        },
        { kind: "NotPresent" }, // This will cause failure
        {
          kind: "Extracted",
          frontMatter: createFrontMatter({
            c1: "climpt-design",
            c2: "domain",
            c3: "architecture",
          }),
        },
      ]);

      // Act
      const result = await adapter.processDocuments(
        documents,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.successful.length, 2);
      assertEquals(result.failed.length, 1);
      assertEquals(result.failed[0].documentPath, "/test/failure1.md");
      assertEquals(result.failed[0].error.kind, "NoFrontMatter");
    });
  });

  describe("c1/c2/c3 Field Processing", () => {
    it("should correctly extract and preserve c1/c2/c3 values", async () => {
      // Arrange - Test various c1/c2/c3 combinations
      const testCases = [
        { c1: "climpt-build", c2: "robust", c3: "code" },
        { c1: "climpt-design", c2: "domain", c3: "boundary" },
        { c1: "climpt-spec", c2: "analyze", c3: "quality-metrics" },
        { c1: "climpt-git", c2: "merge-up", c3: "base-branch" },
      ];

      for (const testCase of testCases) {
        const document = createMockDocument({
          path: `/test/${testCase.c1}.md`,
        });
        mockExtractor.setExtractionResult({
          kind: "Extracted",
          frontMatter: createFrontMatter(testCase),
        });

        // Act
        const result = await adapter.processDocument(
          document,
          createMockSchema("command-schema"),
          createMockTemplate("command-template"),
        );

        // Assert
        assertEquals(result.kind, "Success");
        if (result.kind === "Success") {
          assertEquals(result.command.c1, testCase.c1);
          assertEquals(result.command.c2, testCase.c2);
          assertEquals(result.command.c3, testCase.c3);
        }
      }
    });

    it("should preserve options excluding c1/c2/c3 fields", async () => {
      // Arrange
      const document = createMockDocument({ path: "/test/with-options.md" });
      const frontMatter = {
        c1: "climpt-build",
        c2: "robust",
        c3: "test",
        input: "-f=file.md",
        adaptation: "default",
        destination: "output/",
        description: "Test command with options",
      };

      mockExtractor.setExtractionResult({
        kind: "Extracted",
        frontMatter: createFrontMatter(frontMatter),
      });

      // Act
      const result = await adapter.processDocument(
        document,
        createMockSchema("command-schema"),
        createMockTemplate("command-template"),
      );

      // Assert
      assertEquals(result.kind, "Success");
      if (result.kind === "Success") {
        // c1/c2/c3 should be separate fields
        assertEquals(result.command.c1, "climpt-build");
        assertEquals(result.command.c2, "robust");
        assertEquals(result.command.c3, "test");

        // Other fields should be in options
        assertEquals(result.command.options.input, "-f=file.md");
        assertEquals(result.command.options.adaptation, "default");
        assertEquals(result.command.options.destination, "output/");
        assertEquals(
          result.command.options.description,
          "Test command with options",
        );

        // c1/c2/c3 should NOT appear in options
        assertEquals(result.command.options.c1, undefined);
        assertEquals(result.command.options.c2, undefined);
        assertEquals(result.command.options.c3, undefined);
      }
    });
  });
});
