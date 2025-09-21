/**
 * @fileoverview ExtractFromProcessor Tests - Issue #899
 * @description Test suite for x-frontmatter-part array processing with x-extract-from integration
 * Following TDD and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { ExtractFromProcessor } from "../../../../../src/domain/schema/services/extract-from-processor.ts";
import { ExtractFromDirective } from "../../../../../src/domain/schema/value-objects/extract-from-directive.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { PropertyExtractor } from "../../../../../src/domain/schema/extractors/property-extractor.ts";

// Helper function to create test data
const createTestFrontmatterData = (
  data: Record<string, unknown> = {},
): FrontmatterData => {
  const dataResult = FrontmatterData.create(data);
  if (!dataResult.ok) {
    throw new Error("Failed to create test FrontmatterData");
  }
  return dataResult.data;
};

describe("ExtractFromProcessor", () => {
  it("should create successfully with PropertyExtractor", () => {
    const extractor = PropertyExtractor.create();
    const result = ExtractFromProcessor.create(extractor);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
    }
  });

  it("should return unchanged data when no directives", () => {
    const extractor = PropertyExtractor.create();
    const processor = ExtractFromProcessor.create(extractor);
    assertEquals(processor.ok, true);

    if (processor.ok) {
      const testData = createTestFrontmatterData({
        "title": "Test",
        "id": "123",
      });

      const result = processor.data.processDirectives(testData, []);
      assertEquals(result.ok, true);
      if (result.ok) {
        const titleResult = result.data.get("title");
        const idResult = result.data.get("id");
        assertEquals(titleResult.ok, true);
        assertEquals(idResult.ok, true);
        if (titleResult.ok && idResult.ok) {
          assertEquals(titleResult.data, "Test");
          assertEquals(idResult.data, "123");
        }
      }
    }
  });

  it("should extract simple property path", () => {
    const extractor = PropertyExtractor.create();
    const processor = ExtractFromProcessor.create(extractor);
    assertEquals(processor.ok, true);

    if (processor.ok) {
      const testData = createTestFrontmatterData({
        "user": {
          "name": "John Doe",
          "email": "john@example.com",
        },
        "settings": {
          "theme": "dark",
        },
      });

      const directive = ExtractFromDirective.create("user.name");
      assertEquals(directive.ok, true);

      if (directive.ok) {
        const result = processor.data.processDirectives(testData, [
          directive.data,
        ]);
        assertEquals(result.ok, true);
        if (result.ok) {
          // Should extract user.name and make it the root value
          const extractedResult = result.data.get("extracted");
          assertEquals(extractedResult.ok, true);
          if (extractedResult.ok) {
            assertEquals(extractedResult.data, "John Doe");
          }
        }
      }
    }
  });

  it("should extract from array with bracket notation", () => {
    const extractor = PropertyExtractor.create();
    const processor = ExtractFromProcessor.create(extractor);
    assertEquals(processor.ok, true);

    if (processor.ok) {
      const testData = createTestFrontmatterData({
        "traceability": [
          { "id": { "full": "TRACE-001" }, "type": "requirement" },
          { "id": { "full": "TRACE-002" }, "type": "design" },
        ],
      });

      const directive = ExtractFromDirective.create("traceability[].id.full");
      assertEquals(directive.ok, true);

      if (directive.ok) {
        const result = processor.data.processDirectives(testData, [
          directive.data,
        ]);
        assertEquals(result.ok, true);
        if (result.ok) {
          // Should extract array of id.full values
          const extractedResult = result.data.get("extracted");
          assertEquals(extractedResult.ok, true);
          if (extractedResult.ok) {
            const extractedArray = extractedResult.data;
            assertEquals(Array.isArray(extractedArray), true);
            if (Array.isArray(extractedArray)) {
              assertEquals(extractedArray.length, 2);
              assertEquals(extractedArray[0], "TRACE-001");
              assertEquals(extractedArray[1], "TRACE-002");
            }
          }
        }
      }
    }
  });

  it("should handle multiple directives", () => {
    const extractor = PropertyExtractor.create();
    const processor = ExtractFromProcessor.create(extractor);
    assertEquals(processor.ok, true);

    if (processor.ok) {
      const testData = createTestFrontmatterData({
        "user": {
          "name": "John Doe",
          "department": "Engineering",
        },
        "project": {
          "title": "Frontend Rewrite",
        },
      });

      const directive1 = ExtractFromDirective.create("user.name");
      const directive2 = ExtractFromDirective.create("project.title");

      assertEquals(directive1.ok, true);
      assertEquals(directive2.ok, true);

      if (directive1.ok && directive2.ok) {
        const result = processor.data.processDirectives(
          testData,
          [directive1.data, directive2.data],
        );
        assertEquals(result.ok, true);
        if (result.ok) {
          // Should extract both values
          const userNameResult = result.data.get("userName");
          const projectTitleResult = result.data.get("projectTitle");
          assertEquals(userNameResult.ok, true);
          assertEquals(projectTitleResult.ok, true);
          if (userNameResult.ok && projectTitleResult.ok) {
            assertEquals(userNameResult.data, "John Doe");
            assertEquals(projectTitleResult.data, "Frontend Rewrite");
          }
        }
      }
    }
  });

  it("should handle extraction errors gracefully", () => {
    const extractor = PropertyExtractor.create();
    const processor = ExtractFromProcessor.create(extractor);
    assertEquals(processor.ok, true);

    if (processor.ok) {
      const testData = createTestFrontmatterData({
        "user": {
          "name": "John Doe",
        },
      });

      const directive = ExtractFromDirective.create("nonexistent.path");
      assertEquals(directive.ok, true);

      if (directive.ok) {
        const result = processor.data.processDirectives(testData, [
          directive.data,
        ]);
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "ExtractionFailed");
        }
      }
    }
  });
});
