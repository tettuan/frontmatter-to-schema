import { assertEquals } from "jsr:@std/assert";
import { SchemaValidator } from "../../../../src/domain/services/schema-validator.ts";
import { Schema, SchemaId } from "../../../../src/domain/models/entities.ts";
import {
  SchemaDefinition,
  SchemaVersion,
} from "../../../../src/domain/models/value-objects.ts";

// Test helpers following DDD pattern
function createTestSchemaId(id: string): SchemaId {
  const result = SchemaId.create(id);
  if (!result.ok) {
    throw new Error(`Failed to create test SchemaId: ${result.error.kind}`);
  }
  return result.data;
}

function createTestSchemaVersion(version: string = "1.0.0"): SchemaVersion {
  const result = SchemaVersion.create(version);
  if (!result.ok) {
    throw new Error(
      `Failed to create test SchemaVersion: ${result.error.kind}`,
    );
  }
  return result.data;
}

function createTestSchemaDefinition(definition: unknown): SchemaDefinition {
  const result = SchemaDefinition.create(definition, "1.0.0");
  if (!result.ok) {
    throw new Error(
      `Failed to create test SchemaDefinition: ${result.error.kind}`,
    );
  }
  return result.data;
}

Deno.test("SchemaValidator", async (t) => {
  const validator = new SchemaValidator();

  await t.step("should validate object against schema", () => {
    const schemaDefinition = createTestSchemaDefinition({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["name", "age"],
    });

    const schemaId = createTestSchemaId("test");
    const schemaVersion = createTestSchemaVersion("1.0.0");
    const schemaResult = Schema.create(
      schemaId,
      schemaDefinition,
      schemaVersion,
    );

    if (!schemaResult.ok) {
      throw new Error("Failed to create schema for test");
    }
    const schema = schemaResult.data;

    const data = {
      name: "John",
      age: 30,
      active: true,
    };

    const result = validator.validate(data, schema);

    assertEquals(result.ok, true);
  });

  await t.step("should reject invalid data", () => {
    const schemaDefinition = createTestSchemaDefinition({
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    });

    const schemaId = createTestSchemaId("test");
    const schemaVersion = createTestSchemaVersion("1.0.0");
    const schemaResult = Schema.create(
      schemaId,
      schemaDefinition,
      schemaVersion,
    );

    if (!schemaResult.ok) {
      throw new Error("Failed to create schema for test");
    }
    const schema = schemaResult.data;

    const invalidData = {
      name: "John",
      // missing required age field
    };

    const result = validator.validate(invalidData, schema);

    // The validator properly validates required fields, so this should fail
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
    }
  });

  await t.step("should handle null data", () => {
    const schemaDefinition = createTestSchemaDefinition({
      type: "object",
      properties: { name: { type: "string" } },
    });

    const schemaId = createTestSchemaId("test");
    const schemaVersion = createTestSchemaVersion("1.0.0");
    const schemaResult = Schema.create(
      schemaId,
      schemaDefinition,
      schemaVersion,
    );

    if (!schemaResult.ok) {
      throw new Error("Failed to create schema for test");
    }
    const schema = schemaResult.data;

    const result = validator.validate(null, schema);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should handle undefined data", () => {
    const schemaDefinition = createTestSchemaDefinition({
      type: "object",
      properties: { name: { type: "string" } },
    });

    const schemaId = createTestSchemaId("test");
    const schemaVersion = createTestSchemaVersion("1.0.0");
    const schemaResult = Schema.create(
      schemaId,
      schemaDefinition,
      schemaVersion,
    );

    if (!schemaResult.ok) {
      throw new Error("Failed to create schema for test");
    }
    const schema = schemaResult.data;

    const result = validator.validate(undefined, schema);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should handle invalid schema definition", () => {
    // Test with an invalid schema definition (null)
    const schemaDefResult = SchemaDefinition.create(null as unknown, "1.0.0");

    if (!schemaDefResult.ok) {
      // This should fail to create the schema definition
      assertEquals(schemaDefResult.error.kind, "EmptyInput");
    } else {
      const schemaId = createTestSchemaId("test");
      const schemaVersion = createTestSchemaVersion("1.0.0");
      const schemaResult = Schema.create(
        schemaId,
        schemaDefResult.data,
        schemaVersion,
      );

      if (!schemaResult.ok) {
        throw new Error("Failed to create schema for test");
      }
      const schema = schemaResult.data;

      const result = validator.validate({}, schema);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    }
  });
});
