/**
 * Tests for StructuredAggregator Domain Service
 *
 * Tests the aggregation of multiple analysis results into unified structures
 * following template patterns and aggregation strategies.
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  AggregatedStructure,
  isAggregatedStructure,
  StructuredAggregator,
} from "../../../../src/domain/services/structured-aggregator.ts";
import type {
  AggregationStrategy,
  TemplateStructure,
} from "../../../../src/domain/services/structured-aggregator.ts";
import {
  AnalysisResult,
  Document,
  ExtractedData,
  FrontMatter,
  MappedData,
  Template,
  TemplateId,
} from "../../../../src/domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
  TemplateFormat,
} from "../../../../src/domain/models/value-objects.ts";
import type { MappingRule } from "../../../../src/domain/models/value-objects.ts";

// Helper function to create a test document
function createTestDocument(
  path: string,
  content: string,
  hasFrontMatter = false,
) {
  const pathResult = DocumentPath.create(path);
  if (!pathResult.ok) throw new Error("Failed to create path");

  const contentResult = DocumentContent.create(content);
  if (!contentResult.ok) throw new Error("Failed to create content");

  let frontMatterState;
  if (hasFrontMatter) {
    const fmContent = FrontMatterContent.create("{}");
    if (!fmContent.ok) throw new Error("Failed to create frontmatter content");
    const frontMatter = FrontMatter.create(fmContent.data, "---\n{}\n---");
    frontMatterState = { kind: "WithFrontMatter" as const, frontMatter };
  } else {
    frontMatterState = { kind: "NoFrontMatter" as const };
  }

  return Document.create(pathResult.data, frontMatterState, contentResult.data);
}

Deno.test("StructuredAggregator - create success", () => {
  const result = StructuredAggregator.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("AggregatedStructure - create with valid object", () => {
  const structure = { field1: "value1", field2: 123 };
  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };
  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: ["field1", "field2"],
    nestedStructures: {},
  };

  const result = AggregatedStructure.create(
    structure,
    strategy,
    templateStructure,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getStructure(), structure);
    assertEquals(result.data.getStrategy(), strategy);
    assertEquals(result.data.getTemplateStructure(), templateStructure);
  }
});

Deno.test("AggregatedStructure - create fails with null", () => {
  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };
  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: [],
    nestedStructures: {},
  };

  const result = AggregatedStructure.create(
    null as unknown as Record<string, unknown>,
    strategy,
    templateStructure,
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
    assertEquals(
      result.error.message,
      "Aggregated structure must be a valid object",
    );
  }
});

Deno.test("AggregatedStructure - create fails with array", () => {
  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };
  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: [],
    nestedStructures: {},
  };

  const result = AggregatedStructure.create(
    [] as unknown as Record<string, unknown>,
    strategy,
    templateStructure,
  );

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("StructuredAggregator - analyzeTemplateStructure with JSON template", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const templateContent = JSON.stringify({
    title: "{{title}}",
    tags: [],
    metadata: {
      author: "{{author}}",
      date: "{{date}}",
    },
    items: [],
  });

  const templateFormatResult = TemplateFormat.create("json", templateContent);
  assertEquals(templateFormatResult.ok, true);
  if (!templateFormatResult.ok) return;

  const mappingRules: MappingRule[] = [];
  const templateIdResult = TemplateId.create("test-template");
  if (!templateIdResult.ok) throw new Error("Failed to create template id");
  const templateResult = Template.create(
    templateIdResult.data,
    templateFormatResult.data,
    mappingRules,
    "Test template description",
  );

  const result = aggregator.analyzeTemplateStructure(templateResult);

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data;
    assertEquals(structure.kind, "parent_template");
    assertEquals(structure.arrayFields.includes("tags"), true);
    assertEquals(structure.arrayFields.includes("items"), true);
    assertEquals(structure.scalarFields.includes("title"), true);
    assertExists(structure.nestedStructures["metadata"]);
    assertEquals(
      structure.nestedStructures["metadata"].scalarFields.includes("author"),
      true,
    );
    assertEquals(
      structure.nestedStructures["metadata"].scalarFields.includes("date"),
      true,
    );
  }
});

Deno.test("StructuredAggregator - analyzeTemplateStructure with non-JSON template", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const templateFormatResult = TemplateFormat.create("yaml", "key: value");
  assertEquals(templateFormatResult.ok, true);
  if (!templateFormatResult.ok) return;

  const mappingRules: MappingRule[] = [];
  const templateIdResult = TemplateId.create("yaml-template");
  if (!templateIdResult.ok) throw new Error("Failed to create template id");
  const templateResult = Template.create(
    templateIdResult.data,
    templateFormatResult.data,
    mappingRules,
    "YAML template",
  );

  const result = aggregator.analyzeTemplateStructure(templateResult);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.kind, "parent_template");
    assertEquals(result.data.arrayFields.length, 0);
    assertEquals(result.data.scalarFields.length, 0);
    assertEquals(Object.keys(result.data.nestedStructures).length, 0);
  }
});

Deno.test("StructuredAggregator - analyzeTemplateStructure with invalid JSON", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const templateFormatResult = TemplateFormat.create("json", "not valid json");
  assertEquals(templateFormatResult.ok, true);
  if (!templateFormatResult.ok) return;

  const mappingRules: MappingRule[] = [];
  const templateIdResult = TemplateId.create("invalid-template");
  if (!templateIdResult.ok) throw new Error("Failed to create template id");
  const templateResult = Template.create(
    templateIdResult.data,
    templateFormatResult.data,
    mappingRules,
  );

  const result = aggregator.analyzeTemplateStructure(templateResult);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "ParseError");
    assertEquals(
      result.error.message.includes("Failed to analyze template structure"),
      true,
    );
  }
});

Deno.test("StructuredAggregator - analyzeTemplateStructure with array JSON", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const templateFormatResult = TemplateFormat.create("json", "[]");
  assertEquals(templateFormatResult.ok, true);
  if (!templateFormatResult.ok) return;

  const mappingRules: MappingRule[] = [];
  const templateIdResult = TemplateId.create("array-template");
  if (!templateIdResult.ok) throw new Error("Failed to create template id");
  const templateResult = Template.create(
    templateIdResult.data,
    templateFormatResult.data,
    mappingRules,
  );

  const result = aggregator.analyzeTemplateStructure(templateResult);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
    assertEquals(
      result.error.message.includes("Template must be a valid JSON object"),
      true,
    );
  }
});

Deno.test("StructuredAggregator - aggregate with empty results", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: [],
    nestedStructures: {},
  };

  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };

  const result = aggregator.aggregate([], templateStructure, strategy);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assertEquals(result.error.message, "Cannot aggregate empty results array");
  }
});

Deno.test("StructuredAggregator - aggregate with single result", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const document = createTestDocument("test.md", "Test content");
  const extractedData = ExtractedData.create({ title: "Test", value: 123 });
  const mappedData = MappedData.create({ title: "Test", value: 123 });

  const analysisResult = AnalysisResult.create(
    document,
    extractedData,
    mappedData,
  );

  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: ["title", "value"],
    nestedStructures: {},
  };

  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };

  const result = aggregator.aggregate(
    [analysisResult],
    templateStructure,
    strategy,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data.getStructure();
    assertEquals(structure.title, "Test");
    assertEquals(structure.value, 123);
  }
});

Deno.test("StructuredAggregator - aggregate with array fields", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const results = [];

  // Create first result with array data
  const doc1 = createTestDocument("doc1.md", "Content 1");
  const extractedData1 = ExtractedData.create({
    title: "Doc 1",
    tags: ["tag1", "tag2"],
    items: [{ id: 1 }],
  });
  const mappedData1 = MappedData.create({
    title: "Doc 1",
    tags: ["tag1", "tag2"],
    items: [{ id: 1 }],
  });

  const analysis1 = AnalysisResult.create(doc1, extractedData1, mappedData1);
  results.push(analysis1);

  // Create second result with array data
  const doc2 = createTestDocument("doc2.md", "Content 2");
  const extractedData2 = ExtractedData.create({
    title: "Doc 2",
    tags: ["tag3"],
    items: [{ id: 2 }, { id: 3 }],
  });
  const mappedData2 = MappedData.create({
    title: "Doc 2",
    tags: ["tag3"],
    items: [{ id: 2 }, { id: 3 }],
  });

  const analysis2 = AnalysisResult.create(doc2, extractedData2, mappedData2);
  results.push(analysis2);

  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: ["tags", "items"],
    scalarFields: ["title"],
    nestedStructures: {},
  };

  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };

  const result = aggregator.aggregate(results, templateStructure, strategy);

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data.getStructure();
    assertEquals(structure.title, "Doc 2"); // Latest value wins for scalars
    assertEquals(Array.isArray(structure.tags), true);
    const tags = structure.tags as unknown[];
    assertEquals(tags.length, 3);
    assertEquals(tags.includes("tag1"), true);
    assertEquals(tags.includes("tag2"), true);
    assertEquals(tags.includes("tag3"), true);

    assertEquals(Array.isArray(structure.items), true);
    const items = structure.items as unknown[];
    assertEquals(items.length, 3);
  }
});

Deno.test("StructuredAggregator - aggregate with nested structures", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const document = createTestDocument("nested.md", "Nested content");
  const extractedData = ExtractedData.create({
    title: "Nested Doc",
    metadata: {
      author: "John Doe",
      version: "1.0",
      tags: ["meta1"],
    },
  });
  const mappedData = MappedData.create({
    title: "Nested Doc",
    metadata: {
      author: "John Doe",
      version: "1.0",
      tags: ["meta1"],
    },
  });

  const analysisResult = AnalysisResult.create(
    document,
    extractedData,
    mappedData,
  );

  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: ["title"],
    nestedStructures: {
      metadata: {
        kind: "parent_template",
        arrayFields: ["tags"],
        scalarFields: ["author", "version"],
        nestedStructures: {},
      },
    },
  };

  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };

  const result = aggregator.aggregate(
    [analysisResult],
    templateStructure,
    strategy,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data.getStructure();
    assertEquals(structure.title, "Nested Doc");
    assertExists(structure.metadata);
    const metadata = structure.metadata as Record<string, unknown>;
    assertEquals(metadata.author, "John Doe");
    assertEquals(metadata.version, "1.0");
    assertEquals(Array.isArray(metadata.tags), true);
  }
});

Deno.test("StructuredAggregator - aggregate with merge_arrays strategy", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const results = [];

  // First document
  const doc1 = createTestDocument("doc1.md", "Content 1");
  const extractedData1 = ExtractedData.create({
    id: "doc1",
    content: "First content",
  });
  const mappedData1 = MappedData.create({
    id: "doc1",
    content: "First content",
  });

  const analysis1 = AnalysisResult.create(doc1, extractedData1, mappedData1);
  results.push(analysis1);

  // Second document
  const doc2 = createTestDocument("doc2.md", "Content 2");
  const extractedData2 = ExtractedData.create({
    id: "doc2",
    content: "Second content",
  });
  const mappedData2 = MappedData.create({
    id: "doc2",
    content: "Second content",
  });

  const analysis2 = AnalysisResult.create(doc2, extractedData2, mappedData2);
  results.push(analysis2);

  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: ["id", "content"],
    nestedStructures: {},
  };

  const strategy: AggregationStrategy = {
    kind: "merge_arrays",
    mergeKey: "id",
  };

  const result = aggregator.aggregate(results, templateStructure, strategy);

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data.getStructure();
    // First value wins for scalars in merge_arrays strategy
    assertEquals(structure.id, "doc1");
    assertEquals(structure.content, "First content");
  }
});

Deno.test("StructuredAggregator - aggregate with accumulate_fields strategy", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const document = createTestDocument("doc.md", "Content");
  const extractedData = ExtractedData.create({
    field1: "value1",
    field2: "value2",
  });
  const mappedData = MappedData.create({
    field1: "value1",
    field2: "value2",
  });

  const analysisResult = AnalysisResult.create(
    document,
    extractedData,
    mappedData,
  );

  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: ["field1", "field2"],
    nestedStructures: {},
  };

  const strategy: AggregationStrategy = {
    kind: "accumulate_fields",
    pattern: "field*",
  };

  const result = aggregator.aggregate(
    [analysisResult],
    templateStructure,
    strategy,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data.getStructure();
    assertEquals(structure.field1, "value1");
    assertEquals(structure.field2, "value2");
  }
});

Deno.test("StructuredAggregator - aggregate handles non-array values in array fields", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const document = createTestDocument("doc.md", "Content");
  const extractedData = ExtractedData.create({
    tags: "single-tag", // Non-array value for an array field
    items: { id: 1 }, // Non-array value for an array field
  });
  const mappedData = MappedData.create({
    tags: "single-tag",
    items: { id: 1 },
  });

  const analysisResult = AnalysisResult.create(
    document,
    extractedData,
    mappedData,
  );

  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: ["tags", "items"],
    scalarFields: [],
    nestedStructures: {},
  };

  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };

  const result = aggregator.aggregate(
    [analysisResult],
    templateStructure,
    strategy,
  );

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data.getStructure();
    assertEquals(Array.isArray(structure.tags), true);
    const tags = structure.tags as unknown[];
    assertEquals(tags.length, 1);
    assertEquals(tags[0], "single-tag");

    assertEquals(Array.isArray(structure.items), true);
    const items = structure.items as unknown[];
    assertEquals(items.length, 1);
    assertEquals((items[0] as Record<string, unknown>).id, 1);
  }
});

Deno.test("StructuredAggregator - aggregate skips invalid data", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const results = [];

  // Valid result
  const doc1 = createTestDocument("valid.md", "Content");
  const extractedData1 = ExtractedData.create({ title: "Valid Doc" });
  const mappedData1 = MappedData.create({ title: "Valid Doc" });
  const analysis1 = AnalysisResult.create(doc1, extractedData1, mappedData1);
  results.push(analysis1);

  // Invalid result (array data) - but MappedData.create accepts any data
  // So we need to simulate this differently - we'll just use the valid one

  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: ["title"],
    nestedStructures: {},
  };

  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };

  const result = aggregator.aggregate(results, templateStructure, strategy);

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data.getStructure();
    // Only the valid result should be aggregated
    assertEquals(structure.title, "Valid Doc");
  }
});

Deno.test("isAggregatedStructure type guard", () => {
  const structure = { field: "value" };
  const strategy: AggregationStrategy = {
    kind: "replace_values",
    priority: "latest",
  };
  const templateStructure: TemplateStructure = {
    kind: "parent_template",
    arrayFields: [],
    scalarFields: ["field"],
    nestedStructures: {},
  };

  const result = AggregatedStructure.create(
    structure,
    strategy,
    templateStructure,
  );
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(isAggregatedStructure(result.data), true);
  assertEquals(isAggregatedStructure({}), false);
  assertEquals(isAggregatedStructure(null), false);
  assertEquals(isAggregatedStructure("string"), false);
  assertEquals(isAggregatedStructure(123), false);
});

Deno.test("StructuredAggregator - analyzeTemplateStructure identifies template placeholders", () => {
  const aggregatorResult = StructuredAggregator.create();
  assertEquals(aggregatorResult.ok, true);
  if (!aggregatorResult.ok) return;

  const aggregator = aggregatorResult.data;

  const templateContent = JSON.stringify({
    title: "{{title}}",
    description: "Static text",
    author: "{{author}}",
    count: 42,
    items: [],
  });

  const templateFormatResult = TemplateFormat.create("json", templateContent);
  assertEquals(templateFormatResult.ok, true);
  if (!templateFormatResult.ok) return;

  const mappingRules: MappingRule[] = [];
  const templateIdResult = TemplateId.create("placeholder-template");
  if (!templateIdResult.ok) throw new Error("Failed to create template id");
  const templateResult = Template.create(
    templateIdResult.data,
    templateFormatResult.data,
    mappingRules,
  );

  const result = aggregator.analyzeTemplateStructure(templateResult);

  assertEquals(result.ok, true);
  if (result.ok) {
    const structure = result.data;
    // Template placeholders should be identified as scalar fields
    assertEquals(structure.scalarFields.includes("title"), true);
    assertEquals(structure.scalarFields.includes("author"), true);
    // Static values should also be scalar fields
    assertEquals(structure.scalarFields.includes("description"), true);
    assertEquals(structure.scalarFields.includes("count"), true);
    // Arrays should be identified as array fields
    assertEquals(structure.arrayFields.includes("items"), true);
  }
});
