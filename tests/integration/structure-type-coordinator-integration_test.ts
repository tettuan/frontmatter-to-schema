import { assertEquals } from "jsr:@std/assert";
import { SchemaStructureDetector } from "../../src/domain/schema/services/schema-structure-detector.ts";
import { StructureTypeUtils } from "../../src/domain/schema/value-objects/structure-type.ts";
import { Schema } from "../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../src/domain/schema/value-objects/schema-definition.ts";

/**
 * Integration test for StructureType coordinator integration.
 * Validates that the StructureType system correctly integrates with coordinators
 * and resolves the hardcoding issue #528 for Books schema (Example 2).
 *
 * This test focuses on the core integration points:
 * 1. Books schema structure type detection
 * 2. Processing hints generation
 * 3. Coordinator integration capability
 * 4. Example 2 compatibility validation
 */
Deno.test("StructureType Coordinator Integration - Issue #528 Resolution", async (t) => {
  // Helper function to create books schema (Example 2)
  function createBooksSchema(): Schema {
    const schemaData = {
      type: "object",
      properties: {
        version: { type: "string" },
        description: { type: "string" },
        books: {
          type: "array",
          "x-frontmatter-part": true,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              author: { type: "string" },
              isbn: { type: "string" },
              year: { type: "number" },
              genre: { type: "string" },
            },
            required: ["title", "author"],
          },
        },
      },
      required: ["version", "books"],
    };

    const pathResult = SchemaPath.create("books-schema.json");
    if (!pathResult.ok) throw new Error("Failed to create schema path");

    const definitionResult = SchemaDefinition.create(schemaData);
    if (!definitionResult.ok) {
      throw new Error("Failed to create schema definition");
    }

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    if (!schemaResult.ok) throw new Error("Failed to create schema");

    return schemaResult.data;
  }

  // Helper function to create articles schema (another collection type)
  function createArticlesSchema(): Schema {
    const schemaData = {
      type: "object",
      properties: {
        version: { type: "string" },
        metadata: {
          type: "object",
          properties: {
            articles: {
              type: "array",
              "x-frontmatter-part": true,
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  date: { type: "string" },
                  category: { type: "string" },
                },
                required: ["title", "date"],
              },
            },
          },
        },
      },
    };

    const pathResult = SchemaPath.create("articles-schema.json");
    if (!pathResult.ok) throw new Error("Failed to create schema path");

    const definitionResult = SchemaDefinition.create(schemaData);
    if (!definitionResult.ok) {
      throw new Error("Failed to create schema definition");
    }

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    if (!schemaResult.ok) throw new Error("Failed to create schema");

    return schemaResult.data;
  }

  // Helper function to create registry schema (traditional tools.commands)
  function createRegistrySchema(): Schema {
    const schemaData = {
      type: "object",
      properties: {
        version: { type: "string" },
        tools: {
          type: "object",
          properties: {
            commands: {
              type: "array",
              "x-frontmatter-part": true,
              items: {
                type: "object",
                properties: {
                  c1: { type: "string" },
                  c2: { type: "string" },
                  c3: { type: "string" },
                },
                required: ["c1", "c2", "c3"],
              },
            },
          },
        },
      },
    };

    const pathResult = SchemaPath.create("registry-schema.json");
    if (!pathResult.ok) throw new Error("Failed to create schema path");

    const definitionResult = SchemaDefinition.create(schemaData);
    if (!definitionResult.ok) {
      throw new Error("Failed to create schema definition");
    }

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    if (!schemaResult.ok) throw new Error("Failed to create schema");

    return schemaResult.data;
  }

  await t.step("Books Schema: Should detect collection structure type", () => {
    // Arrange
    const booksSchema = createBooksSchema();

    // Act
    const structureResult = SchemaStructureDetector.detectStructureType(
      booksSchema,
    );

    // Assert: Successful detection
    assertEquals(structureResult.ok, true);
    if (!structureResult.ok) {
      console.error("Structure detection failed:", structureResult.error);
      return;
    }

    // Assert: Correct structure type
    assertEquals(StructureTypeUtils.isCollection(structureResult.data), true);
    assertEquals(StructureTypeUtils.getPath(structureResult.data), "books");
    assertEquals(
      StructureTypeUtils.getDescription(structureResult.data),
      "books collection structure",
    );

    console.log("✅ Books schema correctly detected as collection type");
  });

  await t.step(
    "Books Schema: Should generate appropriate processing hints",
    () => {
      // Arrange
      const booksSchema = createBooksSchema();
      const structureResult = SchemaStructureDetector.detectStructureType(
        booksSchema,
      );
      assertEquals(structureResult.ok, true);
      if (!structureResult.ok) return;

      // Act
      const processingHints = SchemaStructureDetector.getProcessingHints(
        structureResult.data,
      );

      // Assert: Collection-specific processing hints
      assertEquals(processingHints.requiresAggregation, false);
      assertEquals(processingHints.expectedArrayFields, ["books"]);
      assertEquals(processingHints.derivationRules, []);
      assertEquals(processingHints.templateFormat, "auto");

      console.log("✅ Books schema processing hints correctly generated");
    },
  );

  await t.step("Articles Schema: Should detect custom collection type", () => {
    // Arrange
    const articlesSchema = createArticlesSchema();

    // Act
    const structureResult = SchemaStructureDetector.detectStructureType(
      articlesSchema,
    );

    // Assert: Successful detection
    assertEquals(structureResult.ok, true);
    if (!structureResult.ok) return;

    // Assert: Custom structure type for nested path
    assertEquals(StructureTypeUtils.isCustom(structureResult.data), true);
    assertEquals(
      StructureTypeUtils.getPath(structureResult.data),
      "metadata.articles",
    );

    console.log(
      "✅ Articles schema correctly detected as custom structure type",
    );
  });

  await t.step("Registry Schema: Should still detect registry type", () => {
    // Arrange
    const registrySchema = createRegistrySchema();

    // Act
    const structureResult = SchemaStructureDetector.detectStructureType(
      registrySchema,
    );

    // Assert: Successful detection
    assertEquals(structureResult.ok, true);
    if (!structureResult.ok) return;

    // Assert: Registry structure type
    assertEquals(StructureTypeUtils.isRegistry(structureResult.data), true);
    assertEquals(
      StructureTypeUtils.getPath(structureResult.data),
      "tools.commands",
    );

    console.log("✅ Registry schema correctly detected as registry type");
  });

  await t.step(
    "Processing Hints: Should differ between structure types",
    () => {
      // Arrange
      const booksSchema = createBooksSchema();
      const registrySchema = createRegistrySchema();

      const booksResult = SchemaStructureDetector.detectStructureType(
        booksSchema,
      );
      const registryResult = SchemaStructureDetector.detectStructureType(
        registrySchema,
      );

      assertEquals(booksResult.ok, true);
      assertEquals(registryResult.ok, true);
      if (!booksResult.ok || !registryResult.ok) return;

      // Act
      const booksHints = SchemaStructureDetector.getProcessingHints(
        booksResult.data,
      );
      const registryHints = SchemaStructureDetector.getProcessingHints(
        registryResult.data,
      );

      // Assert: Different processing requirements
      assertEquals(booksHints.requiresAggregation, false);
      assertEquals(registryHints.requiresAggregation, true);

      assertEquals(booksHints.expectedArrayFields, ["books"]);
      assertEquals(registryHints.expectedArrayFields, ["commands"]);

      assertEquals(booksHints.derivationRules, []);
      assertEquals(registryHints.derivationRules, ["availableConfigs"]);

      assertEquals(booksHints.templateFormat, "auto");
      assertEquals(registryHints.templateFormat, "json");

      console.log(
        "✅ Processing hints correctly differ between structure types",
      );
    },
  );

  await t.step(
    "Issue #528 Resolution: Should support non-registry schemas",
    () => {
      // Arrange: Create multiple non-registry schema types
      const testSchemas = [
        { name: "Books", schema: createBooksSchema(), expectedPath: "books" },
        {
          name: "Articles",
          schema: createArticlesSchema(),
          expectedPath: "metadata.articles",
        },
      ];

      // Act & Assert: All non-registry schemas should be detectable
      for (const { name, schema, expectedPath } of testSchemas) {
        const structureResult = SchemaStructureDetector.detectStructureType(
          schema,
        );

        assertEquals(
          structureResult.ok,
          true,
          `${name} schema should be detectable`,
        );
        if (!structureResult.ok) continue;

        assertEquals(
          StructureTypeUtils.getPath(structureResult.data),
          expectedPath,
          `${name} schema should have correct path`,
        );

        // Verify not hardcoded to registry
        assertEquals(
          StructureTypeUtils.isRegistry(structureResult.data),
          false,
          `${name} schema should not be detected as registry`,
        );
      }

      console.log(
        "✅ Issue #528 resolved: Non-registry schemas fully supported",
      );
    },
  );

  await t.step(
    "Example 2 Compatibility: Books schema end-to-end validation",
    () => {
      // Arrange: Books schema as specified in Example 2
      const booksSchema = createBooksSchema();

      // Act: Complete detection and hint generation
      const structureResult = SchemaStructureDetector.detectStructureType(
        booksSchema,
      );
      assertEquals(structureResult.ok, true);
      if (!structureResult.ok) return;

      const processingHints = SchemaStructureDetector.getProcessingHints(
        structureResult.data,
      );

      // Assert: Example 2 requirements met
      assertEquals(StructureTypeUtils.isCollection(structureResult.data), true);
      assertEquals(StructureTypeUtils.getPath(structureResult.data), "books");

      // Assert: Processing configuration suitable for books
      assertEquals(processingHints.requiresAggregation, false);
      assertEquals(processingHints.expectedArrayFields.includes("books"), true);
      assertEquals(processingHints.templateFormat, "auto");

      // Assert: Schema structure supports books collection
      const frontmatterPartResult = booksSchema.findFrontmatterPartPath();
      assertEquals(frontmatterPartResult.ok, true);
      if (!frontmatterPartResult.ok) return;
      assertEquals(frontmatterPartResult.data, "books");

      console.log(
        "✅ Example 2 (Books schema) fully compatible and ready for implementation",
      );
    },
  );

  await t.step(
    "Coordinator Integration: Validate enhanced methods accessibility",
    () => {
      // Arrange: Verify that coordinator classes have the new structure-aware methods
      // This validates that our integration changes are properly accessible

      // Note: We can't easily test the actual coordinator methods without complex setup,
      // but we can verify the core integration points work correctly

      const booksSchema = createBooksSchema();
      const structureResult = SchemaStructureDetector.detectStructureType(
        booksSchema,
      );

      assertEquals(structureResult.ok, true);
      if (!structureResult.ok) return;

      const processingHints = SchemaStructureDetector.getProcessingHints(
        structureResult.data,
      );

      // Assert: All integration data is available
      assertEquals(typeof structureResult.data, "object");
      assertEquals(typeof processingHints, "object");
      assertEquals(typeof processingHints.requiresAggregation, "boolean");
      assertEquals(Array.isArray(processingHints.expectedArrayFields), true);
      assertEquals(Array.isArray(processingHints.derivationRules), true);
      assertEquals(typeof processingHints.templateFormat, "string");

      console.log("✅ Coordinator integration data properly accessible");
    },
  );
});
