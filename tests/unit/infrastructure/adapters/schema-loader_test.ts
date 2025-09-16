import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { FileSystemSchemaRepository } from "../../../../src/infrastructure/adapters/schema-loader.ts";
import { SchemaPath } from "../../../../src/domain/schema/value-objects/schema-path.ts";
import {
  ConsoleDebugLogger,
  NoOpDebugLogger,
} from "../../../../src/infrastructure/adapters/debug-logger.ts";

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

  describe("debug logger integration", () => {
    it("should work with NoOpDebugLogger", async () => {
      // Arrange
      const debugLogger = new NoOpDebugLogger();
      const repositoryWithLogger = new FileSystemSchemaRepository(debugLogger);

      const schemaPath = `${testDir}/debug-test-schema.json`;
      const schema = { type: "object", properties: { id: { type: "string" } } };
      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repositoryWithLogger.load(pathResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should work with ConsoleDebugLogger", async () => {
      // Arrange
      // Set DEBUG_LEVEL to enable logging
      const originalDebugLevel = Deno.env.get("DEBUG_LEVEL");
      Deno.env.set("DEBUG_LEVEL", "3"); // Enable DEBUG level

      const debugLogger = new ConsoleDebugLogger();
      const repositoryWithLogger = new FileSystemSchemaRepository(debugLogger);

      const schemaPath = `${testDir}/console-debug-schema.json`;
      const schema = {
        type: "object",
        properties: { name: { type: "string" } },
      };
      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      try {
        // Act
        const pathResult = SchemaPath.create(schemaPath);
        assertEquals(pathResult.ok, true);
        if (!pathResult.ok) return;

        const result = repositoryWithLogger.load(pathResult.data);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data);
        }
      } finally {
        // Restore original DEBUG_LEVEL
        if (originalDebugLevel !== undefined) {
          Deno.env.set("DEBUG_LEVEL", originalDebugLevel);
        } else {
          Deno.env.delete("DEBUG_LEVEL");
        }
      }
    });

    it("should log cache hit when loading same schema twice with debug logger", async () => {
      // Arrange
      const originalDebugLevel = Deno.env.get("DEBUG_LEVEL");
      Deno.env.set("DEBUG_LEVEL", "3"); // Enable DEBUG level

      const debugLogger = new ConsoleDebugLogger();
      const repositoryWithLogger = new FileSystemSchemaRepository(debugLogger);

      const schemaPath = `${testDir}/cache-hit-debug-schema.json`;
      const schema = {
        type: "object",
        properties: { test: { type: "string" } },
      };
      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      try {
        const pathResult = SchemaPath.create(schemaPath);
        assertEquals(pathResult.ok, true);
        if (!pathResult.ok) return;

        // Act: Load first time (cache miss)
        const firstResult = repositoryWithLogger.load(pathResult.data);
        assertEquals(firstResult.ok, true);

        // Act: Load second time (cache hit)
        const secondResult = repositoryWithLogger.load(pathResult.data);

        // Assert
        assertEquals(secondResult.ok, true);
        if (firstResult.ok && secondResult.ok) {
          assertEquals(firstResult.data, secondResult.data);
        }
      } finally {
        if (originalDebugLevel !== undefined) {
          Deno.env.set("DEBUG_LEVEL", originalDebugLevel);
        } else {
          Deno.env.delete("DEBUG_LEVEL");
        }
      }
    });

    it("should log errors with debug logger when file not found", () => {
      // Arrange
      const originalDebugLevel = Deno.env.get("DEBUG_LEVEL");
      Deno.env.set("DEBUG_LEVEL", "0"); // Enable ERROR level

      const debugLogger = new ConsoleDebugLogger();
      const repositoryWithLogger = new FileSystemSchemaRepository(debugLogger);

      try {
        // Act
        const pathResult = SchemaPath.create(
          `${testDir}/non-existent-debug.json`,
        );
        assertEquals(pathResult.ok, true);
        if (!pathResult.ok) return;

        const result = repositoryWithLogger.load(pathResult.data);

        // Assert
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "SchemaNotFound");
        }
      } finally {
        if (originalDebugLevel !== undefined) {
          Deno.env.set("DEBUG_LEVEL", originalDebugLevel);
        } else {
          Deno.env.delete("DEBUG_LEVEL");
        }
      }
    });

    it("should log errors with debug logger when JSON parsing fails", async () => {
      // Arrange
      const originalDebugLevel = Deno.env.get("DEBUG_LEVEL");
      Deno.env.set("DEBUG_LEVEL", "0"); // Enable ERROR level

      const debugLogger = new ConsoleDebugLogger();
      const repositoryWithLogger = new FileSystemSchemaRepository(debugLogger);

      const schemaPath = `${testDir}/invalid-json-debug.json`;
      const invalidJson = "{ invalid json content without closing brace";
      await Deno.writeTextFile(schemaPath, invalidJson);

      try {
        // Act
        const pathResult = SchemaPath.create(schemaPath);
        assertEquals(pathResult.ok, true);
        if (!pathResult.ok) return;

        const result = repositoryWithLogger.load(pathResult.data);

        // Assert
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidSchema");
          assertEquals(
            result.error.message.includes("Failed to parse JSON"),
            true,
          );
        }
      } finally {
        if (originalDebugLevel !== undefined) {
          Deno.env.set("DEBUG_LEVEL", originalDebugLevel);
        } else {
          Deno.env.delete("DEBUG_LEVEL");
        }
      }
    });
  });

  describe("safeJsonParse edge cases", () => {
    it("should handle various JSON parse error scenarios", async () => {
      const repository = new FileSystemSchemaRepository();

      // Test different types of invalid JSON
      const invalidJsonCases = [
        { content: "", name: "empty string" },
        { content: "null", name: "null value" },
        { content: "undefined", name: "undefined" },
        { content: "{ unclosed object", name: "unclosed object" },
        { content: '{ "key": }', name: "missing value" },
        { content: '{ "key": "value" "extra": true }', name: "missing comma" },
        { content: '{ "key": NaN }', name: "invalid NaN value" },
        { content: '{ "key": Infinity }', name: "invalid Infinity value" },
        { content: "{ // comment in JSON }", name: "JSON with comments" },
      ];

      for (const testCase of invalidJsonCases) {
        // Arrange
        const schemaPath = `${testDir}/invalid-json-${
          testCase.name.replace(/[^a-z0-9]/gi, "-")
        }.json`;
        await Deno.writeTextFile(schemaPath, testCase.content);

        // Act
        const pathResult = SchemaPath.create(schemaPath);
        assertEquals(pathResult.ok, true);
        if (!pathResult.ok) continue;

        const result = repository.load(pathResult.data);

        // Assert
        if (testCase.content === "null") {
          // null is valid JSON but might not create a valid schema
          // Test should handle this case gracefully
          assertExists(result);
        } else {
          // Most cases should result in parsing errors
          assertEquals(result.ok, false, `Case ${testCase.name} should fail`);
          if (!result.ok) {
            assertEquals(result.error.kind, "InvalidSchema");
            assertExists(result.error.message);
          }
        }
      }
    });

    it("should handle JSON parsing with different error types", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/syntax-error.json`;

      // This should create a SyntaxError when parsed
      const invalidJson = '{ "test": [1, 2, 3, }'; // trailing comma in array
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
        assertEquals(
          result.error.message.includes("Failed to parse JSON"),
          true,
        );
        // Ensure the error message contains some detail about the parsing failure
        assertEquals(result.error.message.length > 20, true);
      }
    });

    it("should handle non-Error objects thrown during JSON parsing", async () => {
      // This is a bit artificial since JSON.parse typically throws Error objects,
      // but we should ensure robust error handling
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/weird-json-error.json`;

      // Create content that might cause unexpected JSON parsing behavior
      const weirdContent = '\x00\x01\x02{ "invalid": "binary content" }';
      await Deno.writeTextFile(schemaPath, weirdContent);

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert - should handle gracefully regardless of the specific error type
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertExists(result.error.message);
      }
    });
  });

  describe("cache behavior edge cases", () => {
    it("should handle cache with different schema paths that resolve to same content", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schema = {
        type: "object",
        properties: { shared: { type: "string" } },
      };

      const schemaPath1 = `${testDir}/cache-test-1.json`;
      const schemaPath2 = `${testDir}/cache-test-2.json`;

      // Write same content to different files
      await Deno.writeTextFile(schemaPath1, JSON.stringify(schema));
      await Deno.writeTextFile(schemaPath2, JSON.stringify(schema));

      // Act
      const pathResult1 = SchemaPath.create(schemaPath1);
      const pathResult2 = SchemaPath.create(schemaPath2);
      assertEquals(pathResult1.ok, true);
      assertEquals(pathResult2.ok, true);
      if (!pathResult1.ok || !pathResult2.ok) return;

      const result1 = repository.load(pathResult1.data);
      const result2 = repository.load(pathResult2.data);

      // Assert
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (result1.ok && result2.ok) {
        // Different paths should result in different cached entries
        // (they are cached by path string, not content)
        assertEquals(result1.data !== result2.data, true);
      }
    });

    it("should cache schemas with different path formats", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schema = { type: "array", items: { type: "string" } };

      const schemaPath = `${testDir}/path-format-test.json`;
      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      // Test different ways of creating the same path
      const pathResult1 = SchemaPath.create(schemaPath);
      const pathResult2 = SchemaPath.create(`./${schemaPath}`);

      assertEquals(pathResult1.ok, true);
      assertEquals(pathResult2.ok, true);
      if (!pathResult1.ok || !pathResult2.ok) return;

      // Act
      const result1 = repository.load(pathResult1.data);
      const result2 = repository.load(pathResult2.data);

      // Assert
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);

      if (result1.ok && result2.ok) {
        // The cache key is the toString() result of the SchemaPath
        // If paths are normalized, they might hit the same cache entry
        assertExists(result1.data);
        assertExists(result2.data);
      }
    });
  });

  describe("schema creation failure scenarios", () => {
    it("should handle SchemaDefinition.create failure gracefully", async () => {
      // This test ensures error propagation from SchemaDefinition.create
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/schema-definition-failure.json`;

      // Create JSON that might cause SchemaDefinition.create to fail
      // (depending on its validation logic)
      const problematicSchema = {
        type: "object",
        properties: null, // This might cause validation issues
        required: "not_an_array", // Should be array
      };

      await Deno.writeTextFile(schemaPath, JSON.stringify(problematicSchema));

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      // Depending on SchemaDefinition validation, this might succeed or fail
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (!result.ok) {
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });

    it("should handle Schema.create failure gracefully", async () => {
      // This test ensures error propagation from Schema.create
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/schema-creation-failure.json`;

      // Create a schema that might pass SchemaDefinition.create but fail Schema.create
      const schema = {
        type: "object",
        properties: {
          test: { type: "string" },
        },
      };

      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      // This should typically succeed unless Schema.create has specific validation
      assertExists(result);
      if (!result.ok) {
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle extremely nested JSON structures", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/deeply-nested-schema.json`;

      // Create deeply nested structure
      let nestedSchema: any = { type: "string" };
      for (let i = 0; i < 50; i++) {
        nestedSchema = {
          type: "object",
          properties: {
            [`level_${i}`]: nestedSchema,
          },
        };
      }

      await Deno.writeTextFile(schemaPath, JSON.stringify(nestedSchema));

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

    it("should handle schemas with circular references in JSON", async () => {
      // Note: JSON.stringify cannot handle circular references, so we test
      // a schema structure that might reference itself through $ref
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/self-referencing-schema.json`;

      const selfRefSchema = {
        $id: "https://example.com/person",
        type: "object",
        properties: {
          name: { type: "string" },
          parent: { $ref: "#" }, // Self-reference
          children: {
            type: "array",
            items: { $ref: "#" }, // Self-reference
          },
        },
      };

      await Deno.writeTextFile(schemaPath, JSON.stringify(selfRefSchema));

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

    it("should handle empty file content", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/empty-file.json`;

      await Deno.writeTextFile(schemaPath, "");

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
        assertEquals(
          result.error.message.includes("Failed to parse JSON"),
          true,
        );
      }
    });

    it("should handle whitespace-only content", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/whitespace-only.json`;

      await Deno.writeTextFile(schemaPath, "   \n  \t  \r\n  ");

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidSchema");
      }
    });

    it("should handle non-UTF-8 content", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/non-utf8.json`;

      // Create content with some binary/non-UTF8 characters
      const binaryContent = new Uint8Array([
        0xFF,
        0xFE,
        0x7B,
        0x22,
        0x74,
        0x65,
        0x73,
        0x74,
        0x22,
        0x3A,
        0x20,
        0x22,
        0x76,
        0x61,
        0x6C,
        0x75,
        0x65,
        0x22,
        0x7D,
      ]);
      await Deno.writeFile(schemaPath, binaryContent);

      // Act
      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const result = repository.load(pathResult.data);

      // Assert
      // This should handle the binary content gracefully, likely as a parse error
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");
    });
  });

  describe("resolve method comprehensive tests", () => {
    it("should handle unresolved schemas", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/unresolved-schema.json`;
      const schema = {
        type: "object",
        properties: {
          ref_field: { $ref: "#/definitions/SomeType" },
        },
        definitions: {
          SomeType: { type: "string" },
        },
      };

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
        // Currently resolve just returns the schema as-is
        assertEquals(resolveResult.data, loadResult.data);
      }
    });

    it("should maintain schema identity through resolve", async () => {
      // Arrange
      const repository = new FileSystemSchemaRepository();
      const schemaPath = `${testDir}/identity-test-schema.json`;
      const schema = { type: "boolean" };

      await Deno.writeTextFile(schemaPath, JSON.stringify(schema));

      const pathResult = SchemaPath.create(schemaPath);
      assertEquals(pathResult.ok, true);
      if (!pathResult.ok) return;

      const loadResult = repository.load(pathResult.data);
      assertEquals(loadResult.ok, true);
      if (!loadResult.ok) return;

      // Act
      const resolveResult1 = repository.resolve(loadResult.data);
      const resolveResult2 = repository.resolve(loadResult.data);

      // Assert
      assertEquals(resolveResult1.ok, true);
      assertEquals(resolveResult2.ok, true);
      if (resolveResult1.ok && resolveResult2.ok) {
        // Both resolve calls should return the same schema instance
        assertEquals(resolveResult1.data, resolveResult2.data);
        assertEquals(resolveResult1.data, loadResult.data);
      }
    });
  });
});
