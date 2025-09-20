import { assertEquals } from "jsr:@std/assert";
import { SchemaStructureDetector } from "../../../../../src/domain/schema/services/schema-structure-detector.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { StructureTypeUtils } from "../../../../../src/domain/schema/value-objects/structure-type.ts";

/**
 * Comprehensive tests for SchemaStructureDetector domain service.
 * Tests the core functionality that replaces detectStructureType hardcoding.
 */
Deno.test("SchemaStructureDetector - Critical Issue #528 Fix", async (t) => {
  // Helper function to create test schemas
  function createTestSchema(schemaData: unknown): Schema {
    const pathResult = SchemaPath.create("test-schema.json");
    if (!pathResult.ok) throw new Error("Failed to create schema path");

    const definitionResult = SchemaDefinition.create(schemaData);
    if (!definitionResult.ok) {
      throw new Error("Failed to create schema definition");
    }

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    if (!schemaResult.ok) throw new Error("Failed to create schema");

    return schemaResult.data;
  }

  await t.step(
    "Should detect registry structure from x-frontmatter-part",
    () => {
      // Arrange: Schema with x-frontmatter-part pointing to tools.commands
      const registrySchema = createTestSchema({
        type: "object",
        properties: {
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
                },
              },
            },
          },
        },
      });

      // Act
      const result = SchemaStructureDetector.detectStructureType(
        registrySchema,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(StructureTypeUtils.isRegistry(result.data), true);
      assertEquals(StructureTypeUtils.getPath(result.data), "tools.commands");
    },
  );

  await t.step(
    "Should detect collection structure from x-frontmatter-part",
    () => {
      // Arrange: Schema with x-frontmatter-part pointing to books
      const booksSchema = createTestSchema({
        type: "object",
        properties: {
          books: {
            type: "array",
            "x-frontmatter-part": true,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                author: { type: "string" },
                isbn: { type: "string" },
              },
            },
          },
        },
      });

      // Act
      const result = SchemaStructureDetector.detectStructureType(booksSchema);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(StructureTypeUtils.isCollection(result.data), true);
      assertEquals(StructureTypeUtils.getPath(result.data), "books");
    },
  );

  await t.step(
    "Should detect custom structure from nested x-frontmatter-part",
    () => {
      // Arrange: Schema with nested x-frontmatter-part
      const customSchema = createTestSchema({
        type: "object",
        properties: {
          content: {
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
                  },
                },
              },
            },
          },
        },
      });

      // Act
      const result = SchemaStructureDetector.detectStructureType(customSchema);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(StructureTypeUtils.isCustom(result.data), true);
      assertEquals(StructureTypeUtils.getPath(result.data), "content.articles");
    },
  );

  await t.step(
    "Should fallback to registry detection by structure patterns",
    () => {
      // Arrange: Registry-like schema without x-frontmatter-part
      const registryLikeSchema = createTestSchema({
        type: "object",
        properties: {
          tools: {
            type: "object",
            properties: {
              commands: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    c1: { type: "string" },
                    c2: { type: "string" },
                    c3: { type: "string" },
                  },
                },
              },
            },
          },
        },
      });

      // Act
      const result = SchemaStructureDetector.detectStructureType(
        registryLikeSchema,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(StructureTypeUtils.isRegistry(result.data), true);
    },
  );

  await t.step("Should fallback to collection for unknown schemas", () => {
    // Arrange: Simple schema without recognizable patterns
    const simpleSchema = createTestSchema({
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
      },
    });

    // Act
    const result = SchemaStructureDetector.detectStructureType(simpleSchema);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) return;

    assertEquals(StructureTypeUtils.isCollection(result.data), true);
    assertEquals(StructureTypeUtils.getPath(result.data), "items");
  });

  await t.step(
    "Should provide processing hints based on structure type",
    () => {
      // Arrange
      const registrySchema = createTestSchema({
        type: "object",
        properties: {
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
                },
              },
            },
          },
        },
      });

      const booksSchema = createTestSchema({
        type: "object",
        properties: {
          books: {
            type: "array",
            "x-frontmatter-part": true,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                author: { type: "string" },
              },
            },
          },
        },
      });

      // Act
      const registryResult = SchemaStructureDetector.detectStructureType(
        registrySchema,
      );
      const booksResult = SchemaStructureDetector.detectStructureType(
        booksSchema,
      );

      // Assert
      assertEquals(registryResult.ok, true);
      assertEquals(booksResult.ok, true);

      if (!registryResult.ok || !booksResult.ok) return;

      const registryHints = SchemaStructureDetector.getProcessingHints(
        registryResult.data,
      );
      const booksHints = SchemaStructureDetector.getProcessingHints(
        booksResult.data,
      );

      // Registry hints
      assertEquals(registryHints.requiresAggregation, true);
      assertEquals(registryHints.expectedArrayFields, ["commands"]);
      assertEquals(registryHints.derivationRules, ["availableConfigs"]);
      assertEquals(registryHints.templateFormat, "json");

      // Collection hints
      assertEquals(booksHints.requiresAggregation, false);
      assertEquals(booksHints.expectedArrayFields, ["books"]);
      assertEquals(booksHints.derivationRules, []);
      assertEquals(booksHints.templateFormat, "auto");
    },
  );

  await t.step("Should detect command fields pattern", () => {
    // Arrange: Schema with c1/c2/c3 command pattern
    const commandSchema = createTestSchema({
      type: "object",
      properties: {
        c1: { type: "string" },
        c2: { type: "string" },
        c3: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
      },
    });

    // Act
    const result = SchemaStructureDetector.detectStructureType(commandSchema);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) return;

    assertEquals(StructureTypeUtils.isRegistry(result.data), true);
  });

  await t.step("Should handle edge cases gracefully", () => {
    // Arrange: Minimal schema
    const minimalSchema = createTestSchema({
      type: "string",
    });

    // Act
    const result = SchemaStructureDetector.detectStructureType(minimalSchema);

    // Assert
    assertEquals(result.ok, true);
    if (!result.ok) return;

    // Should default to collection
    assertEquals(StructureTypeUtils.isCollection(result.data), true);
  });
});
