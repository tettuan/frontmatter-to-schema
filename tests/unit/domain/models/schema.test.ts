import { assertEquals } from "jsr:@std/assert";
import {
  Schema,
  SchemaDefinition,
  type SchemaFormat,
} from "../../../../src/domain/models/domain-models.ts";

Deno.test("SchemaDefinition - Smart Constructor", async (t) => {
  await t.step("should create valid schema definition with JSON format", () => {
    const definition = {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
      },
      required: ["title"],
    };

    const result = SchemaDefinition.create(definition, "json");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getFormat(), "json");
      assertEquals(result.data.getDefinition(), definition);
    }
  });

  await t.step("should create valid schema definition with YAML format", () => {
    const definition = {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
      },
    };

    const result = SchemaDefinition.create(definition, "yaml");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getFormat(), "yaml");
      assertEquals(result.data.getDefinition(), definition);
    }
  });

  await t.step(
    "should create valid schema definition with custom format",
    () => {
      const definition = { customRule: "validate-title-length" };

      const result = SchemaDefinition.create(definition, "custom");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getFormat(), "custom");
        assertEquals(result.data.getDefinition(), definition);
      }
    },
  );

  await t.step("should reject empty definition", () => {
    const result = SchemaDefinition.create(null, "json");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(result.error.message, "Schema definition cannot be empty");
    }
  });

  await t.step("should reject undefined definition", () => {
    const result = SchemaDefinition.create(undefined, "json");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(result.error.message, "Schema definition cannot be empty");
    }
  });

  await t.step("should reject array definition", () => {
    const result = SchemaDefinition.create(["not", "an", "object"], "json");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(
        result.error.message,
        "Schema definition must be a plain object",
      );
      // Additional validation details removed after consolidation
    }
  });

  await t.step("should reject primitive string definition", () => {
    const result = SchemaDefinition.create("not an object", "json");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(
        result.error.message,
        "Schema definition must be a plain object",
      );
      // Additional validation details removed after consolidation
    }
  });

  await t.step("should reject primitive number definition", () => {
    const result = SchemaDefinition.create(42, "json");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(
        result.error.message,
        "Schema definition must be a plain object",
      );
      // Additional validation details removed after consolidation
    }
  });

  await t.step("should reject boolean definition", () => {
    const result = SchemaDefinition.create(true, "json");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(
        result.error.message,
        "Schema definition must be a plain object",
      );
      // Additional validation details removed after consolidation
    }
  });
});

Deno.test("SchemaDefinition - Validation", async (t) => {
  const createValidSchemaDefinition = () => {
    const definition = {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
      },
    };
    const result = SchemaDefinition.create(definition, "json");
    if (result.ok) {
      return result.data;
    }
    throw new Error("Failed to create test schema definition");
  };

  await t.step("should validate non-null data successfully", () => {
    const schema = createValidSchemaDefinition();
    const testData = { title: "Test Document", author: "Test Author" };

    const result = schema.validate(testData);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should validate empty object successfully", () => {
    const schema = createValidSchemaDefinition();
    const testData = {};

    const result = schema.validate(testData);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should validate complex nested object successfully", () => {
    const schema = createValidSchemaDefinition();
    const testData = {
      title: "Complex Document",
      author: "Complex Author",
      metadata: {
        tags: ["tag1", "tag2"],
        created: "2023-01-01",
        nested: {
          level: 2,
          value: "deep",
        },
      },
    };

    const result = schema.validate(testData);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should reject null data", () => {
    const schema = createValidSchemaDefinition();

    const result = schema.validate(null);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(
        result.error.message,
        "Data to validate cannot be null or undefined",
      );
    }
  });

  await t.step("should reject undefined data", () => {
    const schema = createValidSchemaDefinition();

    const result = schema.validate(undefined);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
      assertEquals(
        result.error.message,
        "Data to validate cannot be null or undefined",
      );
    }
  });

  await t.step("should validate array data successfully", () => {
    const schema = createValidSchemaDefinition();
    const testData = [1, 2, 3, "test"];

    const result = schema.validate(testData);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should validate primitive string successfully", () => {
    const schema = createValidSchemaDefinition();
    const testData = "simple string";

    const result = schema.validate(testData);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should validate primitive number successfully", () => {
    const schema = createValidSchemaDefinition();
    const testData = 42;

    const result = schema.validate(testData);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });

  await t.step("should validate boolean successfully", () => {
    const schema = createValidSchemaDefinition();
    const testData = false;

    const result = schema.validate(testData);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, true);
    }
  });
});

Deno.test("Schema - Smart Constructor", async (t) => {
  const createValidSchemaDefinition = () => {
    const definition = {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
      },
      required: ["title"],
    };
    const result = SchemaDefinition.create(definition, "json");
    if (result.ok) {
      return result.data;
    }
    throw new Error("Failed to create test schema definition");
  };

  await t.step("should create schema with valid parameters", () => {
    const definition = createValidSchemaDefinition();
    const result = Schema.create(
      "test-schema",
      definition,
      "Test schema for documents",
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getId(), "test-schema");
      assertEquals(result.data.getDefinition(), definition);
      assertEquals(result.data.getDescription(), "Test schema for documents");
    }
  });

  await t.step("should create schema without description", () => {
    const definition = createValidSchemaDefinition();
    const result = Schema.create("minimal-schema", definition);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getId(), "minimal-schema");
      assertEquals(result.data.getDefinition(), definition);
      assertEquals(result.data.getDescription(), undefined);
    }
  });

  await t.step("should reject empty id", () => {
    const definition = createValidSchemaDefinition();
    const result = Schema.create("", definition);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should reject whitespace-only id", () => {
    const definition = createValidSchemaDefinition();
    const result = Schema.create("   ", definition);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should trim whitespace from id", () => {
    const definition = createValidSchemaDefinition();
    const result = Schema.create(
      "  trimmed-id  ",
      definition,
      "Trimmed schema",
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getId(), "trimmed-id");
    }
  });

  await t.step("should handle complex id with special characters", () => {
    const definition = createValidSchemaDefinition();
    const complexId = "schema-with-dashes_and_underscores.v1";
    const result = Schema.create(complexId, definition);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getId(), complexId);
    }
  });
});

Deno.test("Schema - Validation", async (t) => {
  const createTestSchema = (description?: string) => {
    const definition = {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
      },
      required: ["title"],
    };
    const schemaDefResult = SchemaDefinition.create(definition, "json");
    if (!schemaDefResult.ok) {
      throw new Error("Failed to create schema definition");
    }

    const schemaResult = Schema.create(
      "test-schema",
      schemaDefResult.data,
      description,
    );
    if (!schemaResult.ok) {
      throw new Error("Failed to create schema");
    }

    return schemaResult.data;
  };

  await t.step("should validate data through schema definition", () => {
    const schema = createTestSchema();
    const testData = { title: "Valid Document", author: "Valid Author" };

    const result = schema.validate(testData);

    assertEquals(result.ok, true);
  });

  await t.step("should reject null data through schema definition", () => {
    const schema = createTestSchema();

    const result = schema.validate(null);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should reject undefined data through schema definition", () => {
    const schema = createTestSchema();

    const result = schema.validate(undefined);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "ValidationError");
    }
  });

  await t.step("should validate complex data structures", () => {
    const schema = createTestSchema();
    const complexData = {
      title: "Complex Document",
      author: "Complex Author",
      metadata: {
        tags: ["javascript", "deno"],
        created: new Date().toISOString(),
        version: 1.0,
        published: true,
      },
      content: {
        sections: [
          { name: "Introduction", wordCount: 150 },
          { name: "Methods", wordCount: 300 },
          { name: "Conclusion", wordCount: 100 },
        ],
      },
    };

    const result = schema.validate(complexData);

    assertEquals(result.ok, true);
  });
});

Deno.test("Schema - Getters", async (t) => {
  await t.step("should return correct id", () => {
    const definition = {
      type: "object",
      properties: { title: { type: "string" } },
    };
    const schemaDefResult = SchemaDefinition.create(definition, "json");
    if (!schemaDefResult.ok) return;

    const schemaResult = Schema.create(
      "getter-test",
      schemaDefResult.data,
      "Test description",
    );
    if (!schemaResult.ok) return;

    const schema = schemaResult.data;
    assertEquals(schema.getId(), "getter-test");
  });

  await t.step("should return correct definition", () => {
    const definition = {
      type: "object",
      properties: { title: { type: "string" } },
    };
    const schemaDefResult = SchemaDefinition.create(definition, "json");
    if (!schemaDefResult.ok) return;

    const schemaResult = Schema.create("definition-test", schemaDefResult.data);
    if (!schemaResult.ok) return;

    const schema = schemaResult.data;
    assertEquals(schema.getDefinition(), schemaDefResult.data);
  });

  await t.step("should return correct description when provided", () => {
    const definition = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    const schemaDefResult = SchemaDefinition.create(definition, "json");
    if (!schemaDefResult.ok) return;

    const testDescription = "This is a test schema description";
    const schemaResult = Schema.create(
      "description-test",
      schemaDefResult.data,
      testDescription,
    );
    if (!schemaResult.ok) return;

    const schema = schemaResult.data;
    assertEquals(schema.getDescription(), testDescription);
  });

  await t.step("should return undefined description when not provided", () => {
    const definition = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    const schemaDefResult = SchemaDefinition.create(definition, "json");
    if (!schemaDefResult.ok) return;

    const schemaResult = Schema.create(
      "no-description-test",
      schemaDefResult.data,
    );
    if (!schemaResult.ok) return;

    const schema = schemaResult.data;
    assertEquals(schema.getDescription(), undefined);
  });
});

Deno.test("Schema - Edge Cases and Error Handling", async (t) => {
  await t.step("should handle schema with empty properties object", () => {
    const definition = { type: "object", properties: {} };
    const schemaDefResult = SchemaDefinition.create(definition, "json");

    assertEquals(schemaDefResult.ok, true);
    if (schemaDefResult.ok) {
      const schemaResult = Schema.create("empty-props", schemaDefResult.data);
      assertEquals(schemaResult.ok, true);

      if (schemaResult.ok) {
        const validationResult = schemaResult.data.validate({});
        assertEquals(validationResult.ok, true);
      }
    }
  });

  await t.step("should handle schema with deeply nested properties", () => {
    const definition = {
      type: "object",
      properties: {
        level1: {
          type: "object",
          properties: {
            level2: {
              type: "object",
              properties: {
                level3: {
                  type: "object",
                  properties: {
                    value: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    };

    const schemaDefResult = SchemaDefinition.create(definition, "json");
    assertEquals(schemaDefResult.ok, true);

    if (schemaDefResult.ok) {
      const schemaResult = Schema.create("nested-schema", schemaDefResult.data);
      assertEquals(schemaResult.ok, true);
    }
  });

  await t.step("should handle different schema formats", () => {
    const formats: SchemaFormat[] = ["json", "yaml", "custom"];

    for (const format of formats) {
      const definition = { type: "object", format: format };
      const schemaDefResult = SchemaDefinition.create(definition, format);

      assertEquals(
        schemaDefResult.ok,
        true,
        `Schema creation should succeed for format: ${format}`,
      );

      if (schemaDefResult.ok) {
        assertEquals(schemaDefResult.data.getFormat(), format);

        const schemaResult = Schema.create(
          `test-${format}`,
          schemaDefResult.data,
        );
        assertEquals(
          schemaResult.ok,
          true,
          `Schema creation should succeed for format: ${format}`,
        );
      }
    }
  });

  await t.step("should handle validation with various data types", () => {
    const definition = { type: "object", allowsAny: true };
    const schemaDefResult = SchemaDefinition.create(definition, "json");

    if (!schemaDefResult.ok) return;

    const schemaResult = Schema.create("flexible-schema", schemaDefResult.data);
    if (!schemaResult.ok) return;

    const schema = schemaResult.data;
    const testCases = [
      { data: "string", description: "string" },
      { data: 42, description: "number" },
      { data: true, description: "boolean" },
      { data: [1, 2, 3], description: "array" },
      { data: { key: "value" }, description: "object" },
      { data: new Date(), description: "Date object" },
      { data: /regex/, description: "RegExp object" },
    ];

    for (const testCase of testCases) {
      const result = schema.validate(testCase.data);
      assertEquals(
        result.ok,
        true,
        `Validation should succeed for ${testCase.description}`,
      );
    }
  });
});
