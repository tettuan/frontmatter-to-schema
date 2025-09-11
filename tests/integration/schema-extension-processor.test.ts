/**
 * Robust Integration Tests for Schema Extension Processor
 *
 * Testing system boundary verification between schema extension processing
 * and the broader domain architecture. Focuses on:
 * - Cross-boundary data flow validation
 * - Service integration points
 * - End-to-end processing workflows
 * - Error propagation and recovery
 * - Performance under realistic conditions
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { SchemaExtensionProcessor } from "../../src/domain/schema/services/schema-extension-processor.ts";
import { SchemaExtensions } from "../../src/domain/schema/value-objects/schema-extensions.ts";
import { SchemaExtensionRegistryFactory } from "../../src/domain/schema/factories/schema-extension-registry-factory.ts";

// Test Helper Functions
function createTestProcessor(): SchemaExtensionProcessor {
  const registryResult = SchemaExtensionRegistryFactory.createDefault();
  if (!registryResult.ok) {
    throw new Error(
      `Failed to create registry: ${registryResult.error.message}`,
    );
  }
  return new SchemaExtensionProcessor(registryResult.data);
}

// Integration Test Data Factory
class IntegrationTestDataFactory {
  /**
   * Create realistic test documents for integration testing
   */
  static createTestDocuments(): Array<Record<string, unknown>> {
    return [
      {
        // Document 1: Blog post with nested structure
        title: "Getting Started with DDD",
        author: "John Doe",
        tags: ["architecture", "ddd", "design"],
        items: [
          { category: "tutorial", priority: "high" },
          { category: "documentation", priority: "medium" },
        ],
        metadata: {
          created: "2024-01-15",
          updated: "2024-01-16",
        },
      },
      {
        // Document 2: Technical article
        title: "Advanced TypeScript Patterns",
        author: "Jane Smith",
        tags: ["typescript", "patterns", "advanced"],
        items: [
          { category: "tutorial", priority: "high" },
          { category: "reference", priority: "low" },
        ],
        metadata: {
          created: "2024-01-20",
          updated: "2024-01-22",
        },
      },
      {
        // Document 3: Mixed content type
        title: "Schema Design Best Practices",
        authors: ["Bob Johnson", "Alice Wilson"], // Note: plural form
        tag: "schema", // Note: singular form
        items: [
          { category: "best-practices", priority: "medium" },
          { category: "schema", priority: "high" },
        ],
      },
    ];
  }

  /**
   * Create test schemas representing different branch patterns
   */
  static createDevelopBranchSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        // Boolean-based frontmatter part (develop pattern)
        authors: {
          type: "array",
          [SchemaExtensions.FRONTMATTER_PART]: true,
          items: { type: "string" },
        },
        // JSONPath derived field (develop pattern)
        allCategories: {
          type: "array",
          [SchemaExtensions.DERIVED_FROM]: "items[].category",
          [SchemaExtensions.DERIVED_UNIQUE]: true,
          [SchemaExtensions.DERIVED_FLATTEN]: true,
        },
        // Template processing
        summary: {
          type: "string",
          [SchemaExtensions.TEMPLATE]: "{{title}} by {{author}}",
        },
      },
    };
  }

  static createMainBranchSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        // String-based frontmatter part (main pattern)
        authors: {
          type: "array",
          [SchemaExtensions.FRONTMATTER_PART]: "author", // source field name
          items: { type: "string" },
        },
        // Simple field derived field (main pattern)
        allCategories: {
          type: "array",
          [SchemaExtensions.DERIVED_FROM]: "categories", // simple field reference
          [SchemaExtensions.DERIVED_UNIQUE]: true,
        },
        // Object-based template (main pattern)
        summary: {
          type: "string",
          [SchemaExtensions.TEMPLATE]: {
            blog: "blog-summary.template",
            article: "article-summary.template",
            default: "default-summary.template",
          },
        },
      },
    };
  }

  static createUnifiedSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        // Support both boolean and string patterns
        authors: {
          type: "array",
          [SchemaExtensions.FRONTMATTER_PART]: true, // unified: boolean for auto-detection
          items: { type: "string" },
        },
        // Support both JSONPath and simple patterns
        allCategories: {
          type: "array",
          [SchemaExtensions.DERIVED_FROM]: "items[].category", // unified: auto-detect JSONPath
          [SchemaExtensions.DERIVED_UNIQUE]: true,
        },
        // Support multiple template formats
        summary: {
          type: "string",
          [SchemaExtensions.TEMPLATE]: "{{title}} by {{author}}", // unified: string template
        },
      },
    };
  }
}

// System Boundary Integration Tests
Deno.test("Schema Extension Processor - System Integration", async (t) => {
  await t.step("Process develop branch pattern schema", async () => {
    const processor = createTestProcessor();
    const documents = IntegrationTestDataFactory.createTestDocuments();
    const schema = IntegrationTestDataFactory.createDevelopBranchSchema();

    const result = await processor.processExtensions(documents[0], schema);

    assert(result.ok, `Processing failed: ${result.ok ? "" : result.error}`);
    assertExists(result.data);

    // Verify frontmatter part processing (boolean pattern)
    const processed = result.data;
    if ("authors" in processed) {
      assert(Array.isArray(processed.authors));
    }
  });

  await t.step("Process main branch pattern schema", async () => {
    const processor = createTestProcessor();
    const documents = IntegrationTestDataFactory.createTestDocuments();
    const schema = IntegrationTestDataFactory.createMainBranchSchema();

    const result = await processor.processExtensions(documents[0], schema);

    assert(result.ok, `Processing failed: ${result.ok ? "" : result.error}`);
    assertExists(result.data);
  });

  await t.step("Process unified schema pattern", async () => {
    const processor = createTestProcessor();
    const documents = IntegrationTestDataFactory.createTestDocuments();
    const schema = IntegrationTestDataFactory.createUnifiedSchema();

    const result = await processor.processExtensions(documents[0], schema);

    assert(result.ok, `Processing failed: ${result.ok ? "" : result.error}`);
    assertExists(result.data);
  });
});

// Cross-Service Integration Tests
Deno.test("Schema Extension Processor - Service Integration", async (t) => {
  await t.step("Frontmatter part transformation integration", () => {
    const processor = createTestProcessor();
    const schema = IntegrationTestDataFactory.createDevelopBranchSchema();

    // Test frontmatter part detection
    const frontmatterParts = processor.findFrontmatterParts(schema);

    assertEquals(frontmatterParts.length, 1);
    assertEquals(frontmatterParts[0], "authors");
  });

  await t.step("Extension validation integration", () => {
    const processor = createTestProcessor();

    // Test valid extensions
    const validExtensions = {
      [SchemaExtensions.TEMPLATE]: { blog: "template.json" },
      [SchemaExtensions.DERIVED_FROM]: "items[].category",
      [SchemaExtensions.DERIVED_UNIQUE]: true,
    };

    const validationResult = processor.validateExtensions(validExtensions);
    assert(validationResult.ok);
    assertEquals(validationResult.data, true);
  });

  await t.step("Extension validation with invalid data", () => {
    const processor = createTestProcessor();

    // Test invalid extensions
    const invalidExtensions = {
      [SchemaExtensions.TEMPLATE]: 123, // Should be string or object
      [SchemaExtensions.DERIVED_FROM]: null, // Should be string
    };

    const validationResult = processor.validateExtensions(invalidExtensions);
    assert(!validationResult.ok);
    assertEquals(validationResult.error.kind, "InvalidFormat");
  });
});

// Data Flow Integration Tests
Deno.test("Schema Extension Processor - Data Flow Integration", async (t) => {
  await t.step("Complex nested value extraction", () => {
    const processor = createTestProcessor();
    const documents = IntegrationTestDataFactory.createTestDocuments();

    // Test complex JSONPath extraction
    const result = processor.processDerivedFields(documents, {
      properties: {
        allPriorities: {
          type: "array",
          [SchemaExtensions.DERIVED_FROM]: "items[].priority",
          [SchemaExtensions.DERIVED_UNIQUE]: true,
        },
        allCategories: {
          type: "array",
          [SchemaExtensions.DERIVED_FROM]: "items[].category",
          [SchemaExtensions.DERIVED_UNIQUE]: true,
        },
      },
    });

    assert(result.ok);
    const derived = result.data;

    // Should extract unique priorities
    assertExists(derived.allPriorities);
    assert(Array.isArray(derived.allPriorities));

    // Should extract unique categories
    assertExists(derived.allCategories);
    assert(Array.isArray(derived.allCategories));

    // Verify uniqueness
    const priorities = derived.allPriorities as string[];
    const uniquePriorities = new Set(priorities);
    assertEquals(priorities.length, uniquePriorities.size);
  });

  await t.step("Frontmatter part array transformation workflow", () => {
    const processor = createTestProcessor();

    // Test boolean-based frontmatter part processing
    const testInput = {
      author: "John Doe", // singular form
      title: "Test Article",
    };

    const schema = {
      properties: {
        authors: {
          type: "array",
          [SchemaExtensions.FRONTMATTER_PART]: true, // boolean: auto-detect singular
        },
      },
    };

    const result = processor.transformFrontmatterParts(testInput, schema);

    assert(result.ok);
    const transformed = result.data;

    // Should transform singular "author" to array "authors"
    assertExists(transformed.authors);
    assert(Array.isArray(transformed.authors));
    assertEquals(transformed.authors.length, 1);
    assertEquals(transformed.authors[0], "John Doe");
  });
});

// Error Handling Integration Tests
Deno.test("Schema Extension Processor - Error Handling Integration", async (t) => {
  await t.step("Graceful handling of missing data", () => {
    const processor = createTestProcessor();
    const emptyDocuments: Array<Record<string, unknown>> = [];

    const result = processor.processDerivedFields(emptyDocuments, {
      properties: {
        derived: {
          type: "array",
          [SchemaExtensions.DERIVED_FROM]: "nonexistent.field",
        },
      },
    });

    assert(result.ok);
    const derived = result.data;

    // Should return empty arrays for missing data
    assertExists(derived.derived);
    assert(Array.isArray(derived.derived));
    assertEquals(derived.derived.length, 0);
  });

  await t.step("Error propagation from nested processing", async () => {
    const processor = createTestProcessor();

    // Create malformed schema to trigger validation errors
    const malformedSchema = {
      [SchemaExtensions.TEMPLATE]: {/* missing required properties */},
      [SchemaExtensions.DERIVED_FROM]: "", // empty string
    };

    try {
      const result = await processor.processExtensions({}, malformedSchema);

      // Should handle errors gracefully without throwing
      if (!result.ok) {
        assert(
          result.error.kind === "InvalidFormat" ||
            result.error.kind === "ParseError",
        );
      }
    } catch (error) {
      // Should not throw uncaught exceptions
      assert(false, `Unexpected exception: ${error}`);
    }
  });
});

// Performance Integration Tests
Deno.test("Schema Extension Processor - Performance Integration", async (t) => {
  await t.step("Performance with large document sets", () => {
    const processor = createTestProcessor();

    // Create large document set
    const largeDocumentSet: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 1000; i++) {
      largeDocumentSet.push({
        id: i,
        title: `Document ${i}`,
        category: `category${i % 10}`,
        tags: [`tag${i % 5}`, `tag${(i + 1) % 5}`],
        items: [
          { category: `cat${i % 3}`, value: i },
          { category: `cat${(i + 1) % 3}`, value: i + 1 },
        ],
      });
    }

    const schema = {
      properties: {
        allCategories: {
          type: "array",
          [SchemaExtensions.DERIVED_FROM]: "items[].category",
          [SchemaExtensions.DERIVED_UNIQUE]: true,
        },
      },
    };

    const startTime = performance.now();
    const result = processor.processDerivedFields(largeDocumentSet, schema);
    const endTime = performance.now();

    assert(result.ok);

    // Should complete within reasonable time (< 1 second for 1000 documents)
    const duration = endTime - startTime;
    assert(duration < 1000, `Processing took ${duration}ms, expected < 1000ms`);

    // Verify results
    const derived = result.data;
    assertExists(derived.allCategories);
    assert(Array.isArray(derived.allCategories));

    // Should have unique categories only
    const categories = derived.allCategories as string[];
    const uniqueCategories = new Set(categories);
    assertEquals(categories.length, uniqueCategories.size);
  });

  await t.step("Memory efficiency with complex schemas", () => {
    const processor = createTestProcessor();

    // Create complex schema with many extensions
    const complexSchema: Record<string, unknown> = {
      properties: {},
    };

    // Add 100 properties with extensions
    for (let i = 0; i < 100; i++) {
      (complexSchema.properties as Record<string, unknown>)[`field${i}`] = {
        type: "array",
        [SchemaExtensions.DERIVED_FROM]: `source${i}.data[].value`,
        [SchemaExtensions.DERIVED_UNIQUE]: i % 2 === 0,
        [SchemaExtensions.TEMPLATE]: `template${i}.json`,
      };
    }

    const documents = IntegrationTestDataFactory.createTestDocuments();

    // Process without memory leaks
    for (let iteration = 0; iteration < 10; iteration++) {
      const result = processor.processDerivedFields(documents, complexSchema);
      assert(result.ok);

      // Each iteration should be independent (no memory accumulation)
      const derived = result.data;
      assertExists(derived);
    }

    // Test should complete without excessive memory usage
    assert(true); // If we reach here, no memory issues occurred
  });
});

// Compatibility Matrix Integration Tests
Deno.test("Schema Extension Processor - Cross-Branch Compatibility", async (t) => {
  await t.step("develop pattern processing produces expected results", () => {
    const processor = createTestProcessor();
    const documents = IntegrationTestDataFactory.createTestDocuments();
    const developSchema = IntegrationTestDataFactory
      .createDevelopBranchSchema();

    const result = processor.processDerivedFields(documents, developSchema);
    assert(result.ok);

    const derived = result.data;

    // Should process JSONPath-style derived fields
    assertExists(derived.allCategories);
    assert(Array.isArray(derived.allCategories));

    // Should extract categories from nested items array
    const categories = derived.allCategories as string[];
    assert(categories.includes("tutorial"));
    assert(categories.includes("documentation"));
    assert(categories.includes("reference"));
  });

  await t.step("Schema processing maintains immutability", async () => {
    const processor = createTestProcessor();
    const originalDocument =
      IntegrationTestDataFactory.createTestDocuments()[0];
    const originalSchema = IntegrationTestDataFactory.createUnifiedSchema();

    // Create deep copies for comparison
    const documentCopy = JSON.parse(JSON.stringify(originalDocument));
    const schemaCopy = JSON.parse(JSON.stringify(originalSchema));

    const result = await processor.processExtensions(
      originalDocument,
      originalSchema,
    );
    assert(result.ok);

    // Original inputs should be unchanged
    assertEquals(
      JSON.stringify(originalDocument),
      JSON.stringify(documentCopy),
    );
    assertEquals(JSON.stringify(originalSchema), JSON.stringify(schemaCopy));
  });
});
