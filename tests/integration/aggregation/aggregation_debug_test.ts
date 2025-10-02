/**
 * Debug test for Issue #1259: Multi-property aggregation
 *
 * This test verifies the issue identified by inspector-debug analysis:
 * - Nested x-frontmatter-part properties are not discovered
 * - Multiple x-frontmatter-part properties receive identical data
 *
 * Expected to FAIL until Issue #1259 is resolved.
 */

import { assertEquals } from "@std/assert";
import { DocumentAggregationService } from "../../../src/domain/aggregation/services/document-aggregation-service.ts";
import {
  DocumentId,
  MarkdownDocument,
} from "../../../src/domain/frontmatter/entities/markdown-document.ts";
import { FilePath } from "../../../src/domain/shared/value-objects/file-path.ts";
import { FrontmatterData } from "../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

function createMockDocument(
  path: string,
  frontmatterData?: Record<string, unknown>,
): MarkdownDocument {
  const filePath = FilePath.create(path).unwrap();
  const documentId = DocumentId.fromPath(filePath);
  const frontmatter = frontmatterData
    ? FrontmatterData.create(frontmatterData).unwrap()
    : undefined;
  return MarkdownDocument.create(
    documentId,
    filePath,
    "# Test Content",
    frontmatter,
  );
}

Deno.test({
  name: "Issue #1259 Debug Test - Multiple x-frontmatter-part properties",
  ignore: true, // Enable after Issue #1259 is fixed
  fn: () => {
    const service = DocumentAggregationService.create().unwrap();

    // Create documents with different content types
    const doc1 = createMockDocument("/test/cmd1.md", {
      type: "command",
      id: "cmd-1",
      name: "Test Command",
    });

    const doc2 = createMockDocument("/test/tut1.md", {
      type: "tutorial",
      id: "tut-1",
      name: "Test Tutorial",
    });

    const documents = [doc1, doc2];

    // Schema with MULTIPLE nested x-frontmatter-part properties
    const schema = {
      type: "object",
      properties: {
        version: {
          type: "string",
          default: "1.0.0",
        },
        tools: {
          type: "object",
          properties: {
            commands: {
              type: "array",
              "x-frontmatter-part": true, // ← Nested property #1
              items: { type: "object" },
            },
            tutorials: {
              type: "array",
              "x-frontmatter-part": true, // ← Nested property #2
              items: { type: "object" },
            },
          },
        },
      },
    };

    // Execute aggregation with BreakdownLogger
    // Set LOG_KEY=aggregation LOG_LEVEL=debug to capture detailed logs
    const result = service.transformDocuments(documents, null, schema);

    // Debug assertions - these will FAIL until #1259 is fixed
    assertEquals(
      result.isOk(),
      true,
      "Should handle multiple x-frontmatter-part properties",
    );

    const transformed = result.unwrap();

    // Verify nested structure is created
    assertEquals(
      transformed.tools !== undefined,
      true,
      "Should create nested 'tools' structure",
    );

    const tools = transformed.tools as Record<string, unknown>;

    // Verify property-specific data extraction
    assertEquals(
      Array.isArray(tools.commands),
      true,
      "Should have 'commands' array",
    );

    assertEquals(
      Array.isArray(tools.tutorials),
      true,
      "Should have 'tutorials' array",
    );

    // CRITICAL: Each property should contain ONLY relevant documents
    const commands = tools.commands as Array<Record<string, unknown>>;
    const tutorials = tools.tutorials as Array<Record<string, unknown>>;

    // Currently FAILS: Both arrays get ALL documents instead of filtered ones
    assertEquals(
      commands.length,
      1,
      "Commands array should contain only command documents",
    );
    assertEquals(
      commands[0].type,
      "command",
      "Commands should be filtered by type",
    );

    assertEquals(
      tutorials.length,
      1,
      "Tutorials array should contain only tutorial documents",
    );
    assertEquals(
      tutorials[0].type,
      "tutorial",
      "Tutorials should be filtered by type",
    );

    // Debug output for manual verification
    console.log("Aggregation result:", JSON.stringify(transformed, null, 2));
  },
});

Deno.test({
  name: "Issue #1259 - Fixed: Nested x-frontmatter-part discovery",
  fn: () => {
    const service = DocumentAggregationService.create().unwrap();

    // Use MULTIPLE documents to trigger aggregation logic
    const documents = [
      createMockDocument("/test/doc1.md", { id: "1", name: "Test 1" }),
      createMockDocument("/test/doc2.md", { id: "2", name: "Test 2" }),
    ];

    // Schema with nested x-frontmatter-part (tools.commands)
    const schema = {
      type: "object",
      properties: {
        tools: {
          type: "object",
          properties: {
            commands: {
              type: "array",
              "x-frontmatter-part": true,
            },
          },
        },
      },
    };

    const result = service.transformDocuments(documents, null, schema);

    // FIXED: Now succeeds with nested x-frontmatter-part discovery
    assertEquals(
      result.isOk(),
      true,
      "Fixed implementation can find nested x-frontmatter-part",
    );

    const transformed = result.unwrap();

    // Verify nested structure was created correctly
    assertEquals(typeof transformed.tools, "object");
    assertEquals(Array.isArray((transformed.tools as any).commands), true);
    assertEquals(((transformed.tools as any).commands as any[]).length, 2);
    assertEquals(((transformed.tools as any).commands as any[])[0].id, "1");
    assertEquals(((transformed.tools as any).commands as any[])[1].id, "2");
  },
});
