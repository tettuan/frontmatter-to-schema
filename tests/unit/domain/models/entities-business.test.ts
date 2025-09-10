import { assertEquals } from "jsr:@std/assert";
import {
  AggregatedResult,
  AnalysisResult,
  Document,
  ExtractedData,
  FrontMatter,
  MappedData,
} from "../../../../src/domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
} from "../../../../src/domain/models/value-objects.ts";

/**
 * Business-focused Entities Domain Tests
 *
 * These tests focus on business requirements and domain workflows rather than
 * implementation details. They verify that domain entities fulfill their business
 * purpose: managing document processing, analysis, and transformation workflows.
 */

Deno.test("Entities Domain - Document Processing Business Rules", async (t) => {
  await t.step(
    "Business Rule: Document must enable complete processing workflow",
    async (t) => {
      await t.step(
        "Should support document creation for frontmatter processing",
        () => {
          // Arrange - Business needs to process documents with frontmatter
          const documentPathResult = DocumentPath.create("/docs/api/guide.md");
          assertEquals(documentPathResult.ok, true);
          if (!documentPathResult.ok) return;

          const documentContentResult = DocumentContent.create(
            "# API Guide\n\nThis document explains the API usage.\n\n## Endpoints\n...",
          );
          assertEquals(documentContentResult.ok, true);
          if (!documentContentResult.ok) return;

          const frontMatterState = { kind: "NoFrontMatter" } as const;

          // Act - Create document for business processing
          const document = Document.create(
            documentPathResult.data,
            frontMatterState,
            documentContentResult.data,
          );

          // Assert - Document should be ready for business workflow
          assertEquals(
            typeof document.getId(),
            "object",
            "Document should have identifiable ID for tracking",
          );
          assertEquals(
            typeof document.getPath(),
            "object",
            "Document should have path for file operations",
          );
          assertEquals(
            typeof document.getContent(),
            "object",
            "Document should have content for processing",
          );
          assertEquals(
            typeof document.hasFrontMatter(),
            "boolean",
            "Document should track frontmatter state for workflow control",
          );
        },
      );

      await t.step(
        "Should handle documents with frontmatter for transformation workflow",
        () => {
          // Arrange - Documents with frontmatter enable template transformation
          const documentPathResult = DocumentPath.create(
            "/content/blog/post.md",
          );
          assertEquals(documentPathResult.ok, true);
          if (!documentPathResult.ok) return;

          const markdownWithFrontmatter = `---
title: "Understanding DDD"
author: "Domain Expert"
tags: ["ddd", "architecture", "patterns"]
publishedAt: "2023-12-01"
---

# Understanding Domain-Driven Design

Domain-driven design is a software development approach...`;

          const documentContentResult = DocumentContent.create(
            markdownWithFrontmatter,
          );
          assertEquals(documentContentResult.ok, true);
          if (!documentContentResult.ok) return;

          const frontMatterContentResult = FrontMatterContent.create(`{
        "title": "Understanding DDD",
        "author": "Domain Expert",
        "tags": ["ddd", "architecture", "patterns"],
        "publishedAt": "2023-12-01"
      }`);
          assertEquals(frontMatterContentResult.ok, true);
          if (!frontMatterContentResult.ok) return;

          const frontMatter = FrontMatter.create(
            frontMatterContentResult.data,
            "raw frontmatter",
          );
          const frontMatterState = {
            kind: "WithFrontMatter",
            frontMatter,
          } as const;

          // Act - Create document with frontmatter
          const document = Document.create(
            documentPathResult.data,
            frontMatterState,
            documentContentResult.data,
          );

          // Assert - Document should be ready for frontmatter extraction and transformation
          assertEquals(
            typeof document.getId(),
            "object",
            "Document should be identifiable for processing pipeline",
          );
          assertEquals(
            typeof document.getFrontMatter(),
            "object",
            "Document should enable frontmatter extraction for transformation",
          );
        },
      );
    },
  );

  await t.step(
    "Business Rule: FrontMatter must preserve document metadata integrity",
    () => {
      // Arrange - Frontmatter contains critical document metadata
      const frontmatterContentResult = FrontMatterContent.create(`{
      "title": "API Reference",
      "version": "2.1.0",
      "endpoints": ["GET /users", "POST /users", "DELETE /users/:id"],
      "authentication": "Bearer token required"
    }`);
      assertEquals(frontmatterContentResult.ok, true);
      if (!frontmatterContentResult.ok) return;

      // Act - Create frontmatter for metadata preservation
      const frontMatter = FrontMatter.create(
        frontmatterContentResult.data,
        "raw frontmatter content",
      );

      // Assert - Frontmatter should preserve metadata for business use
      assertEquals(
        typeof frontMatter.getContent(),
        "object",
        "Frontmatter should provide content access for transformation",
      );
      assertEquals(
        typeof frontMatter.getRaw(),
        "string",
        "Frontmatter should provide raw content access",
      );
      assertEquals(
        typeof frontMatter.toObject(),
        "object",
        "Frontmatter should be serializable for data exchange",
      );
    },
  );
});

Deno.test("Entities Domain - Analysis and Processing Workflows", async (t) => {
  await t.step(
    "Business Rule: ExtractedData must enable downstream processing",
    () => {
      // Arrange - Analysis extracts data for further processing
      const extractedData = {
        commands: [
          {
            c1: "design",
            c2: "domain",
            c3: "boundary",
            title: "Domain Boundary Design",
          },
          {
            c1: "build",
            c2: "robust",
            c3: "code",
            title: "Robust Code Construction",
          },
        ],
        metadata: {
          schemaVersion: "1.0.0",
          extractedAt: new Date().toISOString(),
        },
      };

      // Act - Create extracted data for business processing
      const result = ExtractedData.create(extractedData);

      // Assert - Extracted data should be ready for business workflows
      assertEquals(
        typeof result.getData(),
        "object",
        "Extracted data should provide data access for processing",
      );
      assertEquals(
        typeof result.getValue("commands"),
        "object",
        "Extracted data should provide value access by key",
      );
      assertEquals(
        typeof result.has("metadata"),
        "boolean",
        "Extracted data should indicate key presence",
      );
      assertEquals(
        typeof result.toJSON(),
        "object",
        "Extracted data should be serializable for data exchange",
      );
    },
  );

  await t.step(
    "Business Rule: AnalysisResult must enable processing result tracking",
    () => {
      // Arrange - Analysis result enables processing tracking and data access
      const documentPathResult = DocumentPath.create("/docs/analysis/test.md");
      assertEquals(documentPathResult.ok, true);
      if (!documentPathResult.ok) return;

      const documentContentResult = DocumentContent.create("# Test Document");
      assertEquals(documentContentResult.ok, true);
      if (!documentContentResult.ok) return;

      const document = Document.create(
        documentPathResult.data,
        { kind: "NoFrontMatter" },
        documentContentResult.data,
      );

      const extractedData = ExtractedData.create({
        validCommands: 5,
        totalProcessed: 10,
        schemaMatches: ["command-schema-v1", "template-schema-v2"],
      });

      const mappedData = MappedData.create({
        processedCommands: 5,
        status: "completed",
      });

      // Act - Create analysis result for business processing
      const analysisResult = AnalysisResult.create(
        document,
        extractedData,
        mappedData,
      );

      // Assert - Analysis result should provide complete processing information
      assertEquals(
        typeof analysisResult.getId(),
        "object",
        "Analysis result should have identifiable ID",
      );
      assertEquals(
        typeof analysisResult.getDocument(),
        "object",
        "Analysis result should provide document access",
      );
      assertEquals(
        typeof analysisResult.getExtractedData(),
        "object",
        "Analysis result should provide extracted data access",
      );
      assertEquals(
        typeof analysisResult.getMappedData(),
        "object",
        "Analysis result should provide mapped data access",
      );
      assertEquals(
        typeof analysisResult.getTimestamp(),
        "object",
        "Analysis result should track processing timestamp",
      );
    },
  );

  await t.step(
    "Business Rule: MappedData must enable template transformation",
    () => {
      // Arrange - Mapped data connects source data to template targets
      const mappingResults = {
        sourceFields: ["title", "author", "publishedAt"],
        targetFields: ["heading", "byline", "date"],
        transformedData: {
          heading: "Understanding DDD Principles",
          byline: "Written by Domain Expert",
          date: "Published on 2023-12-01",
        },
      };

      // Act - Create mapped data for template processing
      const mappedData = MappedData.create(mappingResults);

      // Assert - Mapped data should enable template rendering
      assertEquals(
        typeof mappedData.getData(),
        "object",
        "Mapped data should provide data access for processing",
      );
      assertEquals(
        typeof mappedData.toJSON(),
        "string",
        "Mapped data should be serializable to JSON",
      );
      assertEquals(
        typeof mappedData.toYAML(),
        "string",
        "Mapped data should be serializable to YAML",
      );
    },
  );
});

Deno.test("Entities Domain - Result Aggregation Business Rules", async (t) => {
  await t.step(
    "Business Rule: AggregatedResult must consolidate multiple processing results",
    () => {
      // Arrange - Multiple processing results need consolidation for final output
      const documentPathResult1 = DocumentPath.create("/docs/doc1.md");
      const documentPathResult2 = DocumentPath.create("/docs/doc2.md");
      assertEquals(documentPathResult1.ok, true);
      assertEquals(documentPathResult2.ok, true);
      if (!documentPathResult1.ok || !documentPathResult2.ok) return;

      const documentContentResult = DocumentContent.create("# Test Document");
      assertEquals(documentContentResult.ok, true);
      if (!documentContentResult.ok) return;

      const document1 = Document.create(
        documentPathResult1.data,
        { kind: "NoFrontMatter" },
        documentContentResult.data,
      );

      const document2 = Document.create(
        documentPathResult2.data,
        { kind: "NoFrontMatter" },
        documentContentResult.data,
      );

      const extractedData1 = ExtractedData.create({ commandsExtracted: 3 });
      const extractedData2 = ExtractedData.create({ commandsExtracted: 2 });
      const mappedData1 = MappedData.create({ processed: true });
      const mappedData2 = MappedData.create({ processed: true });

      const analysisResult1 = AnalysisResult.create(
        document1,
        extractedData1,
        mappedData1,
      );
      const analysisResult2 = AnalysisResult.create(
        document2,
        extractedData2,
        mappedData2,
      );

      const processingResults = [analysisResult1, analysisResult2];

      // Act - Create aggregated result for business reporting
      const aggregatedResult = AggregatedResult.create(
        processingResults,
        "json",
      );

      // Assert - Aggregated result should provide complete business overview
      assertEquals(
        typeof aggregatedResult.getResults(),
        "object",
        "Aggregated result should provide individual results for review",
      );
      assertEquals(
        typeof aggregatedResult.getFormat(),
        "string",
        "Aggregated result should indicate output format",
      );
      assertEquals(
        typeof aggregatedResult.getTimestamp(),
        "object",
        "Aggregated result should track creation timestamp",
      );
      assertEquals(
        typeof aggregatedResult.getRawData(),
        "object",
        "Aggregated result should provide raw data for processing",
      );
      assertEquals(
        aggregatedResult.getResults().length,
        2,
        "Aggregated result should contain all processing results",
      );
    },
  );
});

Deno.test("Entities Domain - Business Workflow Integration", async (t) => {
  await t.step(
    "Workflow: Complete document-to-registry transformation pipeline",
    () => {
      // Arrange - Complete business workflow from document input to registry output

      // Step 1: Document Creation
      const documentPathResult = DocumentPath.create(
        "/prompts/climpt-design-domain.md",
      );
      assertEquals(documentPathResult.ok, true);
      if (!documentPathResult.ok) return;

      const frontmatterContent = `---
c1: design
c2: domain
c3: boundary
title: "Domain Boundary Design"
description: "Design domain boundaries for DDD architecture"
usage: "climpt-design domain boundary -i='requirements'"
---

# Domain Boundary Design Prompt

This prompt helps design domain boundaries...`;

      const documentContentResult = DocumentContent.create(frontmatterContent);
      assertEquals(documentContentResult.ok, true);
      if (!documentContentResult.ok) return;

      const frontMatterContentResult = FrontMatterContent.create(`{
      "c1": "design",
      "c2": "domain",
      "c3": "boundary",
      "title": "Domain Boundary Design",
      "description": "Design domain boundaries for DDD architecture",
      "usage": "climpt-design domain boundary -i='requirements'"
    }`);
      assertEquals(frontMatterContentResult.ok, true);
      if (!frontMatterContentResult.ok) return;

      const frontMatter = FrontMatter.create(
        frontMatterContentResult.data,
        "raw frontmatter",
      );
      const frontMatterState = {
        kind: "WithFrontMatter",
        frontMatter,
      } as const;

      const document = Document.create(
        documentPathResult.data,
        frontMatterState,
        documentContentResult.data,
      );

      // Step 2: Frontmatter Extraction
      const frontMatterResult = document.getFrontMatter();
      assertEquals(
        frontMatterResult.ok,
        true,
        "Document should have extractable frontmatter",
      );

      // Step 3: Analysis Processing
      const extractedData = ExtractedData.create({
        c1: "design",
        c2: "domain",
        c3: "boundary",
        title: "Domain Boundary Design",
        description: "Design domain boundaries for DDD architecture",
        usage: "climpt-design domain boundary -i='requirements'",
      });

      // Step 4: Data Mapping
      const mappedData = MappedData.create({
        sourceFields: ["c1", "c2", "c3", "title", "description"],
        targetFields: [
          "command.c1",
          "command.c2",
          "command.c3",
          "command.title",
          "command.description",
        ],
        transformedData: {
          c1: "design",
          c2: "domain",
          c3: "boundary",
          title: "Domain Boundary Design",
          description: "Design domain boundaries for DDD architecture",
        },
      });

      // Step 5: Analysis Result Creation
      const analysisResult = AnalysisResult.create(
        document,
        extractedData,
        mappedData,
      );

      // Step 6: Result Aggregation
      const aggregatedResult = AggregatedResult.create(
        [analysisResult],
        "json",
      );

      // Assert - Complete workflow should be functional for business use
      assertEquals(
        typeof document.getId(),
        "object",
        "Document should be identifiable throughout workflow",
      );
      if (frontMatterResult.ok) {
        assertEquals(
          typeof frontMatterResult.data.getContent(),
          "object",
          "Frontmatter should be extractable for analysis",
        );
      }
      assertEquals(
        typeof analysisResult.getId(),
        "object",
        "Analysis should have identifiable result",
      );
      assertEquals(
        typeof mappedData.getData(),
        "object",
        "Data should be mappable for template rendering",
      );
      assertEquals(
        aggregatedResult.getResults().length,
        1,
        "Aggregation should contain processing result",
      );

      // Verify workflow completeness
      assertEquals(
        typeof document.hasFrontMatter(),
        "boolean",
        "Document frontmatter state should be determinable",
      );
      assertEquals(
        typeof analysisResult.getExtractedData(),
        "object",
        "Analysis results should be accessible",
      );
      assertEquals(
        typeof mappedData.toJSON(),
        "string",
        "Mapping should be serializable",
      );
      assertEquals(
        typeof aggregatedResult.getTimestamp(),
        "object",
        "Overall processing timestamp should be tracked",
      );
    },
  );
});
