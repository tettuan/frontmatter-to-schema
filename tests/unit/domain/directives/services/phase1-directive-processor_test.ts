/**
 * Tests for Phase1DirectiveProcessor.
 * Verifies Phase 1 per-file directive processing before aggregation.
 * Tests x-flatten-arrays directive and Totality compliance.
 */

import { assertEquals } from "@std/assert";
import {
  DocumentId,
  MarkdownDocument,
} from "../../../../../src/domain/frontmatter/entities/markdown-document.ts";
import { FilePath } from "../../../../../src/domain/shared/value-objects/file-path.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { Phase1DirectiveProcessor } from "../../../../../src/domain/directives/services/phase1-directive-processor.ts";

// Helper function to create mock MarkdownDocument
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

Deno.test("Phase1DirectiveProcessor - create returns success", () => {
  const result = Phase1DirectiveProcessor.create();

  assertEquals(result.isOk(), true);
});

Deno.test("Phase1DirectiveProcessor - processDocument without directives returns unchanged document", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    title: "Test Document",
    tags: ["test", "example"],
  });

  const result = processor.processDocument(document);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  assertEquals(processed.getFrontmatter()?.getData().title, "Test Document");
});

Deno.test("Phase1DirectiveProcessor - processDocument without frontmatter returns unchanged document", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md");

  const result = processor.processDocument(document);

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getFrontmatter(), undefined);
});

Deno.test("Phase1DirectiveProcessor - processDocument with null schema returns unchanged document", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    title: "Test",
  });

  const result = processor.processDocument(document, undefined);

  assertEquals(result.isOk(), true);
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays flattens nested arrays", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    tags: [["web", "frontend"], ["javascript", "typescript"]],
  });

  const schema = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        "x-flatten-arrays": "tags",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(Array.isArray(data?.tags), true);
  assertEquals(data?.tags, ["web", "frontend", "javascript", "typescript"]);
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays with deeply nested arrays", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    categories: [[["level1", "level2"]], [["level3"]]],
  });

  const schema = {
    type: "object",
    properties: {
      categories: {
        type: "array",
        "x-flatten-arrays": "categories",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.categories, ["level1", "level2", "level3"]);
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays preserves already flat arrays", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    tags: ["react", "vue", "angular"],
  });

  const schema = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        "x-flatten-arrays": "tags",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.tags, ["react", "vue", "angular"]);
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays handles empty arrays", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    tags: [[], []],
  });

  const schema = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        "x-flatten-arrays": "tags",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.tags, []);
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays with mixed nested levels", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    items: ["single", ["nested1", "nested2"], [["deep1"]]],
  });

  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        "x-flatten-arrays": "items",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.items, ["single", "nested1", "nested2", "deep1"]);
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays only affects properties with directive", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    flatten: [["a", "b"], ["c"]],
    noFlatten: [["x", "y"], ["z"]],
  });

  const schema = {
    type: "object",
    properties: {
      flatten: {
        type: "array",
        "x-flatten-arrays": "flatten",
        items: { type: "string" },
      },
      noFlatten: {
        type: "array",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.flatten, ["a", "b", "c"]);
  assertEquals(data?.noFlatten, [["x", "y"], ["z"]]); // unchanged
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays with multiple properties", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    tags: [["frontend"], ["backend"]],
    categories: [["web"], ["mobile"]],
  });

  const schema = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        "x-flatten-arrays": "tags",
        items: { type: "string" },
      },
      categories: {
        type: "array",
        "x-flatten-arrays": "categories",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.tags, ["frontend", "backend"]);
  assertEquals(data?.categories, ["web", "mobile"]);
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays with non-array property is unchanged", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    title: "Test Document",
  });

  const schema = {
    type: "object",
    properties: {
      title: {
        type: "string",
        "x-flatten-arrays": "tags", // directive on non-array property
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.title, "Test Document");
});

Deno.test("Phase1DirectiveProcessor - x-jmespath-filter filters array data", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    traceability: [
      { id: { level: "req" }, title: "Requirement 1" },
      { id: { level: "req" }, title: "Requirement 2" },
      { id: { level: "design" }, title: "Design 1" },
      { id: { level: "req" }, title: "Requirement 3" },
      { id: { level: "design" }, title: "Design 2" },
      { id: { level: "req" }, title: "Requirement 4" },
      { id: { level: "req" }, title: "Requirement 5" },
    ],
  });

  const schema = {
    type: "object",
    properties: {
      traceability: {
        type: "array",
        "x-jmespath-filter": "[?id.level == 'req']",
        items: { type: "object" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(Array.isArray(data?.traceability), true);

  const filtered = data?.traceability as Array<
    { id: { level: string }; title: string }
  >;
  assertEquals(filtered.length, 5);

  // All items should be 'req' level
  filtered.forEach((item) => {
    assertEquals(item.id.level, "req");
  });
});

Deno.test("Phase1DirectiveProcessor - x-jmespath-filter with invalid expression returns error", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    items: [{ value: 1 }],
  });

  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        "x-jmespath-filter": "[?invalid..syntax]",
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "JMESPATH_FILTER_ERROR");
});

Deno.test("Phase1DirectiveProcessor - x-jmespath-filter without directive returns unchanged", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    items: [{ value: 1 }, { value: 2 }],
  });

  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { type: "object" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.items, [{ value: 1 }, { value: 2 }]);
});

Deno.test("Phase1DirectiveProcessor - Totality compliance (never throws)", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();

  const tests = [
    () => processor.processDocument(createMockDocument("/test/doc.md")),
    () =>
      processor.processDocument(
        createMockDocument("/test/doc.md", { title: "Test" }),
      ),
    () =>
      processor.processDocument(
        createMockDocument("/test/doc.md"),
        undefined,
      ),
    () => processor.processDocument(createMockDocument("/test/doc.md"), {}),
  ];

  for (const test of tests) {
    try {
      const result = test();
      assertEquals(typeof result.isOk, "function");
      assertEquals(typeof result.isError, "function");
    } catch (error) {
      throw new Error(`Method threw exception: ${error}`);
    }
  }
});

// ========================================
// Issue 5: x-flatten-arrays scalar/null handling tests
// These tests verify that Phase 1 uses FlattenArraysDirective
// for consistent semantics (scalar→[value], null→[], undefined→[])
// ========================================

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays wraps scalar value in array (Issue 5)", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    traceability: "REQ-004", // scalar string, not array
  });

  const schema = {
    type: "object",
    properties: {
      traceability: {
        type: "array",
        "x-flatten-arrays": "traceability",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.traceability, ["REQ-004"]); // scalar wrapped in array
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays converts null to empty array (Issue 5)", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    traceability: null, // null value
  });

  const schema = {
    type: "object",
    properties: {
      traceability: {
        type: "array",
        "x-flatten-arrays": "traceability",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.traceability, []); // null → empty array
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays converts undefined to empty array (Issue 5)", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    title: "Test Document", // traceability property is missing (undefined)
  });

  const schema = {
    type: "object",
    properties: {
      traceability: {
        type: "array",
        "x-flatten-arrays": "traceability",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.traceability, []); // undefined → empty array
  assertEquals(data?.title, "Test Document"); // other properties unchanged
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays wraps numeric scalar (Issue 5)", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    priority: 5, // numeric scalar
  });

  const schema = {
    type: "object",
    properties: {
      priority: {
        type: "array",
        "x-flatten-arrays": "priority",
        items: { type: "number" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.priority, [5]); // number wrapped in array
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays spec example: nested array [A, [B]] (Issue 5)", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    traceability: ["A", ["B"]], // from docs/requirements.ja.md:253
  });

  const schema = {
    type: "object",
    properties: {
      traceability: {
        type: "array",
        "x-flatten-arrays": "traceability",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.traceability, ["A", "B"]); // flattened
});

Deno.test("Phase1DirectiveProcessor - x-flatten-arrays spec example: scalar D (Issue 5)", () => {
  const processor = Phase1DirectiveProcessor.create().unwrap();
  const document = createMockDocument("/test/doc.md", {
    traceability: "D", // from docs/requirements.ja.md:253
  });

  const schema = {
    type: "object",
    properties: {
      traceability: {
        type: "array",
        "x-flatten-arrays": "traceability",
        items: { type: "string" },
      },
    },
  };

  const result = processor.processDocument(document, schema);

  assertEquals(result.isOk(), true);
  const processed = result.unwrap();
  const data = processed.getFrontmatter()?.getData();
  assertEquals(data?.traceability, ["D"]); // scalar → [scalar]
});
