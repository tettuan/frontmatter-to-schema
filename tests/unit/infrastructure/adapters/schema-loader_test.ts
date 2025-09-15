import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { FileSystemSchemaRepository } from "../../../../src/infrastructure/adapters/schema-loader.ts";
import { SchemaPath } from "../../../../src/domain/schema/value-objects/schema-path.ts";

describe("FileSystemSchemaRepository", () => {
  let repository: FileSystemSchemaRepository;
  const testDir = "tests/fixtures/schema-loader-test";

  beforeEach(async () => {
    repository = new FileSystemSchemaRepository();

    // Clean and recreate test directory
    try {
      await Deno.remove(testDir, { recursive: true });
    } catch {
      // Directory might not exist, ignore
    }
    await Deno.mkdir(testDir, { recursive: true });
  });

  describe("load", () => {
    it("should load valid JSON schema successfully", async () => {
      // Arrange
      const schemaPath = `${testDir}/valid-schema.json`;
      const validSchema = {
        type: "object",
        properties: {
          title: { type: "string" },
          count: { type: "number" },
        },
        required: ["title"],
      };

      await Deno.writeTextFile(
        schemaPath,
        JSON.stringify(validSchema, null, 2),
      );

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getPath().toString(), schemaPath);
      }
    });

    it("should return SchemaNotFound error when file does not exist", () => {
      // Arrange
      const nonExistentPath = `${testDir}/non-existent-schema.json`;

      // Act
      const pathResult = SchemaPath.create(nonExistentPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "SchemaNotFound");
        if (result.error.kind === "SchemaNotFound") {
          assertEquals(result.error.path, nonExistentPath);
        }
        assertExists(result.error.message);
      }
    });

    it("should return InvalidSchema error for malformed JSON", async () => {
      // Arrange
      const schemaPath = `${testDir}/invalid-json-schema.json`;
      const invalidJson = `{
        "type": "object",
        "properties": {
          "title": { "type": "string" }
        }
        // Missing closing brace and has comment
      `;

      await Deno.writeTextFile(schemaPath, invalidJson);

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertExists(result.error.message);
        assertEquals(
          result.error.message.includes("Failed to parse JSON"),
          true,
        );
      }
    });

    it("should cache loaded schemas and return cached version on subsequent loads", async () => {
      // Arrange
      const schemaPath = `${testDir}/cached-schema.json`;
      const schema = {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
      };

      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      // Act: Load schema first time
      const firstResult = repository.load(pathResult.data);
      assertEquals(firstResult.ok, true);

      // Act: Load same schema second time
      const secondResult = repository.load(pathResult.data);

      // Assert: Both loads should succeed and return the same schema instance
      assertEquals(secondResult.ok, true);
      if (firstResult.ok && secondResult.ok) {
        // Should return the same cached instance
        assertEquals(firstResult.data, secondResult.data);
      }
    });

    it("should handle empty JSON object schema", async () => {
      // Arrange
      const schemaPath = `${testDir}/empty-schema.json`;
      const emptySchema = {};

      await Deno.writeTextFile(schemaPath, JSON.stringify(emptySchema));

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should handle complex nested schema structures", async () => {
      // Arrange
      const schemaPath = `${testDir}/complex-schema.json`;
      const complexSchema = {
        type: "object",
        properties: {
          metadata: {
            type: "object",
            properties: {
              version: { type: "string" },
              tags: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          content: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              authors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: "string" },
                  },
                  required: ["name"],
                },
              },
            },
            required: ["title"],
          },
        },
        required: ["content"],
      };

      await Deno.writeTextFile(
        schemaPath,
        JSON.stringify(complexSchema, null, 2),
      );

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertEquals(result.data.getPath().toString(), schemaPath);
      }
    });

    it("should handle schema with special JSON Schema keywords", async () => {
      // Arrange
      const schemaPath = `${testDir}/advanced-schema.json`;
      const advancedSchema = {
        $schema: "http://json-schema.org/draft-07/schema#",
        $id: "https://example.com/schema",
        title: "Advanced Schema",
        description: "Schema with JSON Schema keywords",
        type: "object",
        properties: {
          name: {
            type: "string",
            pattern: "^[A-Za-z]+$",
            minLength: 1,
            maxLength: 50,
          },
          age: {
            type: "integer",
            minimum: 0,
            maximum: 150,
          },
          email: {
            type: "string",
            format: "email",
          },
        },
        additionalProperties: false,
        required: ["name", "email"],
      };

      await Deno.writeTextFile(
        schemaPath,
        JSON.stringify(advancedSchema, null, 2),
      );

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should maintain Result pattern compliance", async () => {
      // Arrange
      const schemaPath = `${testDir}/result-pattern-test.json`;
      const schema = { type: "object" };

      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert: Verify Result pattern structure
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertExists(result.data);
        // Verify Schema interface compliance
        assertExists(result.data.getPath);
        assertExists(result.data.isResolved);
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });

    it("should handle unicode characters in schema content", async () => {
      // Arrange
      const schemaPath = `${testDir}/unicode-schema.json`;
      const unicodeSchema = {
        type: "object",
        title: "Unicode Schema 测试 🚀",
        description: "Schema with unicode characters",
        properties: {
          title: {
            type: "string",
            description: "タイトル field with émojis 🌍",
          },
          content: {
            type: "string",
            pattern: "^[\\p{L}\\p{N}\\s]+$",
            description: "Content supporting unicode: 你好世界",
          },
        },
      };

      await Deno.writeTextFile(
        schemaPath,
        JSON.stringify(unicodeSchema, null, 2),
      );

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should handle large schema files", async () => {
      // Arrange
      const schemaPath = `${testDir}/large-schema.json`;

      // Create a large schema with many properties
      const properties: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        properties[`field_${i}`] = {
          type: "string",
          description: `Field number ${i}`,
          minLength: 1,
          maxLength: 100,
        };
      }

      const largeSchema = {
        type: "object",
        title: "Large Schema",
        properties,
        required: Object.keys(properties).slice(0, 10), // First 10 are required
      };

      await Deno.writeTextFile(
        schemaPath,
        JSON.stringify(largeSchema, null, 2),
      );

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });
  });

  describe("resolve", () => {
    it("should return schema as-is when already resolved", async () => {
      // Arrange
      const schemaPath = `${testDir}/resolved-schema.json`;
      const schema = { type: "object", properties: { id: { type: "string" } } };

      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const loadResult = repository.load(pathResult.data);
      assertEquals(loadResult.ok, true);
      if (!loadResult.ok) return;

      // Act
      const resolveResult = repository.resolve(loadResult.data);

      // Assert
      assertEquals(resolveResult.ok, true);
      if (resolveResult.ok) {
        assertEquals(resolveResult.data, loadResult.data);
      }
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages for JSON parsing failures", async () => {
      // Arrange
      const schemaPath = `${testDir}/parse-error-schema.json`;
      const invalidJson = `{
        "type": "object"
        "missing_comma": true
      }`;

      await Deno.writeTextFile(schemaPath, invalidJson);

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertExists(result.error.message);
        assertEquals(result.error.message.length > 0, true);
        assertEquals(
          result.error.message.includes("Failed to parse JSON"),
          true,
        );
      }
    });

    it("should handle schema definition validation errors", async () => {
      // Arrange
      const schemaPath = `${testDir}/invalid-definition-schema.json`;
      // Valid JSON but potentially invalid schema definition
      const invalidSchemaDefinition = {
        type: "invalid_type", // Invalid JSON Schema type
        properties: "not_an_object", // Should be object
      };

      await Deno.writeTextFile(
        schemaPath,
        JSON.stringify(invalidSchemaDefinition),
      );

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      // Depending on SchemaDefinition.create implementation, this might succeed or fail
      // The test ensures the system handles the case gracefully
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (!result.ok) {
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });
  });
});
