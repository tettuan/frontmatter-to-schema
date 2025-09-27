import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { DataProcessingInstructionDomainService } from "../../../../../src/domain/data-processing/services/data-processing-instruction-domain-service.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";

// Test helpers
const createTestSchema = () => {
  const definition = SchemaDefinition.create({
    type: "object",
    properties: {
      // Add x-frontmatter-part directive as boolean marker to the title property
      title: { type: "string", "x-frontmatter-part": true },
      items: { type: "array" },
      "x-template": {
        type: "string",
        default: "# {{title}}\n\nItems: {{items}}",
      },
      "x-template-items": { type: "string" },
      "x-derived-from": { type: "string" },
    },
  });
  const path = SchemaPath.create("data-processing-test-schema.json");

  if (!definition.ok) throw new Error("Failed to create schema definition");
  if (!path.ok) throw new Error("Failed to create schema path");

  return Schema.create(path.data, definition.data);
};

const createTestFrontmatterData = () => [
  {
    title: "Article 1",
    author: "John Doe",
    tags: ["tech", "programming"],
    content: "Article content 1",
  },
  {
    title: "Article 2",
    author: "Jane Smith",
    tags: ["design", "ui"],
    content: "Article content 2",
  },
  {
    title: "Article 3",
    author: "Bob Wilson",
    tags: ["tech", "api"],
    content: "Article content 3",
  },
];

describe("DataProcessingInstructionDomainService", () => {
  describe("Domain Service Creation", () => {
    it("should create service successfully", () => {
      const result = DataProcessingInstructionDomainService.create();

      assertEquals(result.ok, true);
      assertExists(result.ok && result.data);
    });
  });

  describe("Data Loading and Processing", () => {
    it("should load frontmatter data successfully", () => {
      const serviceResult = DataProcessingInstructionDomainService.create();
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;
        const testData = createTestFrontmatterData();

        const loadResult = service.initializeWithFrontmatterData(
          testData,
          schema,
        );

        assertEquals(loadResult.ok, true);
        assertEquals(service.getProcessedData("").ok, true);
        const frontmatterArray = service.getFrontmatterPartArray();
        assertEquals(
          frontmatterArray.ok && frontmatterArray.data
            ? frontmatterArray.data.length
            : 0,
          3,
        );
      }
    });

    it("should handle empty data gracefully", () => {
      const serviceResult = DataProcessingInstructionDomainService.create();
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;

        const loadResult = service.initializeWithFrontmatterData([], schema);

        assertEquals(loadResult.ok, false);
        assertEquals(service.getProcessedData("").ok, false);
        const frontmatterArray = service.getFrontmatterPartArray();
        assertEquals(
          frontmatterArray.ok && frontmatterArray.data
            ? frontmatterArray.data.length
            : 0,
          0,
        );
      }
    });
  });

  describe("Data Processing Operations", () => {
    it("should process data with x-directive instructions", () => {
      const serviceResult = DataProcessingInstructionDomainService.create();
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;
        const testData = createTestFrontmatterData();

        // Load data
        const loadResult = service.initializeWithFrontmatterData(
          testData,
          schema,
        );
        assertEquals(loadResult.ok, true);

        // Process data with schema instructions
        const processResult = service.getProcessedData("");

        assertEquals(processResult.ok, true);
        if (processResult.ok) {
          assertEquals(Array.isArray(processResult.data), true);
          assertEquals((processResult.data as unknown[]).length, 3);
        }
      }
    });

    it("should handle filtering operations", () => {
      const serviceResult = DataProcessingInstructionDomainService.create();

      // Create schema with filter instruction
      const definition = SchemaDefinition.create({
        type: "object",
        properties: {
          title: { type: "string" },
          "x-jmespath-filter": {
            type: "string",
            default: "[?contains(tags, 'tech')]",
          },
        },
      });

      assertEquals(definition.ok, true);

      if (definition.ok && serviceResult.ok) {
        const path = SchemaPath.create("unit-test-schema.json");
        if (!path.ok) throw new Error("Failed to create schema path");

        const schema = Schema.create(path.data, definition.data);

        assertEquals(schema.ok, true);

        if (schema.ok) {
          const service = serviceResult.data;
          const testData = createTestFrontmatterData();

          // Load data
          const loadResult = service.initializeWithFrontmatterData(
            testData,
            schema.data,
          );
          assertEquals(loadResult.ok, true);

          // Process with filter
          const processResult = service.getProcessedData("");

          assertEquals(processResult.ok, true);
          if (processResult.ok) {
            // Should filter to only articles with 'tech' tag
            const expectedTechArticles = testData.filter((article) =>
              article.tags.includes("tech")
            );
            assertEquals(
              (processResult.data as unknown[]).length,
              expectedTechArticles.length,
            );
          }
        }
      }
    });

    it("should handle data transformation operations", () => {
      const serviceResult = DataProcessingInstructionDomainService.create();
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;
        const testData = createTestFrontmatterData();

        // Load data
        const loadResult = service.initializeWithFrontmatterData(
          testData,
          schema,
        );
        assertEquals(loadResult.ok, true);

        // Test different processing operations
        const processResult1 = service.getProcessedData("");
        const processResult2 = service.getProcessedData("");

        assertEquals(processResult1.ok, true);
        assertEquals(processResult2.ok, true);

        // Verify both operations return consistent data
        if (processResult1.ok && processResult2.ok) {
          assertEquals(
            (processResult1.data as unknown[]).length,
            testData.length,
          );
          assertEquals(
            (processResult2.data as unknown[]).length,
            testData.length,
          );
        }
      }
    });
  });

  describe("Domain Boundary Protection", () => {
    it("should maintain data integrity across processing operations", () => {
      const serviceResult = DataProcessingInstructionDomainService.create();
      const schemaResult = createTestSchema();

      assertEquals(serviceResult.ok, true);
      assertEquals(schemaResult.ok, true);

      if (serviceResult.ok && schemaResult.ok) {
        const service = serviceResult.data;
        const schema = schemaResult.data;
        const testData = createTestFrontmatterData();

        // Load data
        const loadResult = service.initializeWithFrontmatterData(
          testData,
          schema,
        );
        assertEquals(loadResult.ok, true);

        // Process multiple times to verify data consistency
        const processResult1 = service.getProcessedData("");
        const processResult2 = service.getProcessedData("");

        assertEquals(processResult1.ok, true);
        assertEquals(processResult2.ok, true);

        if (processResult1.ok && processResult2.ok) {
          // Verify data integrity is maintained
          assertEquals(
            (processResult1.data as unknown[]).length,
            (processResult2.data as unknown[]).length,
          );

          // Verify original data structure is preserved
          const firstResult = (processResult1.data as any[])[0];
          assertExists(firstResult.title);
          assertExists(firstResult.author);
          assertExists(firstResult.tags);
        }
      }
    });

    it("should handle schema changes gracefully", () => {
      const serviceResult = DataProcessingInstructionDomainService.create();

      assertEquals(serviceResult.ok, true);

      if (serviceResult.ok) {
        const service = serviceResult.data;
        const testData = createTestFrontmatterData();

        // Load with first schema
        const schema1Result = createTestSchema();
        assertEquals(schema1Result.ok, true);

        if (schema1Result.ok) {
          const loadResult1 = service.initializeWithFrontmatterData(
            testData,
            schema1Result.data,
          );
          assertEquals(loadResult1.ok, true);

          // Create different schema
          const definition2 = SchemaDefinition.create({
            type: "object",
            properties: {
              title: { type: "string" },
              author: { type: "string" },
            },
          });

          assertEquals(definition2.ok, true);

          if (definition2.ok) {
            const path2 = SchemaPath.create("unit-test-schema2.json");
            if (!path2.ok) throw new Error("Failed to create schema path 2");

            const schema2 = Schema.create(path2.data, definition2.data);

            assertEquals(schema2.ok, true);

            if (schema2.ok) {
              // Load with second schema should work
              const loadResult2 = service.initializeWithFrontmatterData(
                testData,
                schema2.data,
              );
              assertEquals(loadResult2.ok, true);

              // Processing with new schema should work
              const processResult = service.getProcessedData("");
              assertEquals(processResult.ok, true);
            }
          }
        }
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle processing errors gracefully", () => {
      const serviceResult = DataProcessingInstructionDomainService.create();

      assertEquals(serviceResult.ok, true);

      if (serviceResult.ok) {
        const service = serviceResult.data;

        // Try to process without loading data first
        const schemaResult = createTestSchema();
        assertEquals(schemaResult.ok, true);

        if (schemaResult.ok) {
          const processResult = service.getProcessedData("");

          assertEquals(processResult.ok, false);
          if (!processResult.ok) {
            assertEquals(processResult.error.kind, "InitializationError");
          }
        }
      }
    });
  });
});
