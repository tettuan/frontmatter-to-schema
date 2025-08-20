import { assertEquals } from "jsr:@std/assert";
import { SchemaValidator } from "../../../../src/domain/services/schema-validator.ts";
import { Schema, SchemaDefinition } from "../../../../src/domain/models/schema.ts";
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
});
