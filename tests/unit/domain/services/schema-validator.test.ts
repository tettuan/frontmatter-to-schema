import { assertEquals } from "jsr:@std/assert";
import { SchemaValidator } from "../../../../src/domain/services/schema-validator.ts";
import {
  Schema,
  SchemaDefinition,
} from "../../../../src/domain/models/schema.ts";
import { isError, isOk } from "../../../../src/domain/shared/result.ts";

Deno.test("SchemaValidator", async (t) => {
  const validator = new SchemaValidator();

  await t.step("should validate object against schema", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["name", "age"],
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const data = {
          name: "John",
          age: 30,
          active: true,
        };

        const result = validator.validate(data, schemaResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          assertEquals(result.data, data);
        }
      }
    }
  });

  await t.step("should reject missing required fields", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const data = {
          name: "John",
        };

        const result = validator.validate(data, schemaResult.data);
        assertEquals(isError(result), true);
        if (isError(result)) {
          assertEquals(result.error.kind, "ValidationError");
          assertEquals(result.error.field, "age");
        }
      }
    }
  });

  await t.step("should validate arrays", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const data = {
          tags: ["one", "two", "three"],
        };

        const result = validator.validate(data, schemaResult.data);
        assertEquals(isOk(result), true);
      }
    }
  });

  await t.step("should reject invalid types", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        count: { type: "number" },
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const data = {
          count: "not a number",
        };

        const result = validator.validate(data, schemaResult.data);
        assertEquals(isError(result), true);
        if (isError(result)) {
          assertEquals(result.error.kind, "ValidationError");
          assertEquals(result.error.field, "count");
        }
      }
    }
  });

  await t.step("should handle additional properties", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        name: { type: "string" },
      },
      additionalProperties: false,
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const data = {
          name: "John",
          extra: "field",
        };

        const result = validator.validate(data, schemaResult.data);
        assertEquals(isError(result), true);
        if (isError(result)) {
          assertEquals(result.error.field, "extra");
        }
      }
    }
  });

  await t.step("should handle invalid schema definition", () => {
    const schemaDefResult = SchemaDefinition.create(null as unknown, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const result = validator.validate({}, schemaResult.data);
        assertEquals(isError(result), true);
        if (isError(result)) {
          assertEquals(result.error.message, "Invalid schema definition");
        }
      }
    }
  });

  await t.step("should validate non-object data", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        name: { type: "string" },
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const result = validator.validate("not an object", schemaResult.data);
        assertEquals(isError(result), true);
        if (isError(result)) {
          assertEquals(result.error.message, "Expected object, got string");
        }
      }
    }
  });

  await t.step("should validate integer type", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        id: { type: "integer" },
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const data = { id: 42 };
        const result = validator.validate(data, schemaResult.data);
        assertEquals(isOk(result), true);

        const invalidData = { id: "not a number" };
        const invalidResult = validator.validate(
          invalidData,
          schemaResult.data,
        );
        assertEquals(isError(invalidResult), true);
      }
    }
  });

  await t.step("should validate boolean type", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        active: { type: "boolean" },
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const invalidData = { active: "not a boolean" };
        const result = validator.validate(invalidData, schemaResult.data);
        assertEquals(isError(result), true);
        if (isError(result)) {
          assertEquals(result.error.field, "active");
        }
      }
    }
  });

  await t.step("should validate nested objects", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" },
          },
          required: ["name"],
        },
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const validData = {
          user: { name: "Alice", age: 25 },
        };
        const result = validator.validate(validData, schemaResult.data);
        assertEquals(isOk(result), true);

        const invalidData = {
          user: "not an object",
        };
        const invalidResult = validator.validate(
          invalidData,
          schemaResult.data,
        );
        assertEquals(isError(invalidResult), true);
      }
    }
  });

  await t.step("should handle array with invalid items", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        numbers: {
          type: "array",
          items: { type: "number" },
        },
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const invalidData = {
          numbers: [1, 2, "three", 4],
        };
        const result = validator.validate(invalidData, schemaResult.data);
        assertEquals(isError(result), true);
        if (isError(result)) {
          assertEquals(result.error.field, "numbers[2]");
        }
      }
    }
  });

  await t.step("should handle invalid array type", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        list: { type: "array" },
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const invalidData = {
          list: "not an array",
        };
        const result = validator.validate(invalidData, schemaResult.data);
        assertEquals(isError(result), true);
        if (isError(result)) {
          assertEquals(result.error.field, "list");
        }
      }
    }
  });

  await t.step("should handle fields without type specification", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
      properties: {
        anything: {},
      },
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const data = {
          anything: { nested: "value", number: 123 },
        };
        const result = validator.validate(data, schemaResult.data);
        assertEquals(isOk(result), true);
      }
    }
  });

  await t.step(
    "should handle properties without additionalProperties restriction",
    () => {
      const schemaDefResult = SchemaDefinition.create({
        type: "object",
        properties: {
          name: { type: "string" },
        },
      }, "json");

      if (isOk(schemaDefResult)) {
        const schemaResult = Schema.create("test", schemaDefResult.data);
        if (isOk(schemaResult)) {
          const data = {
            name: "John",
            extra1: "field1",
            extra2: 123,
          };
          const result = validator.validate(data, schemaResult.data);
          assertEquals(isOk(result), true);
          if (isOk(result)) {
            const validated = result.data as Record<string, unknown>;
            assertEquals(validated.extra1, "field1");
            assertEquals(validated.extra2, 123);
          }
        }
      }
    },
  );

  await t.step("should handle empty schema properties", () => {
    const schemaDefResult = SchemaDefinition.create({
      type: "object",
    }, "json");

    if (isOk(schemaDefResult)) {
      const schemaResult = Schema.create("test", schemaDefResult.data);
      if (isOk(schemaResult)) {
        const data = { any: "data", here: 42 };
        const result = validator.validate(data, schemaResult.data);
        assertEquals(isOk(result), true);
        if (isOk(result)) {
          assertEquals(result.data, data);
        }
      }
    }
  });
});
