import { assertEquals } from "jsr:@std/assert";
import { Schema, SchemaId } from "../../../../src/domain/models/entities.ts";
import {
  SchemaDefinition,
  SchemaVersion,
} from "../../../../src/domain/models/value-objects.ts";

// Test Helpers
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

function createTestSchema(
  id: string,
  definition: unknown,
  version: string = "1.0.0",
  description?: string,
): Schema {
  const schemaId = createTestSchemaId(id);
  const schemaDefinition = createTestSchemaDefinition(definition);
  const schemaVersion = createTestSchemaVersion(version);

  const schemaResult = Schema.create(
    schemaId,
    schemaDefinition,
    schemaVersion,
    description,
  );
  if (!schemaResult.ok) throw new Error("Failed to create test schema");
  return schemaResult.data;
}

const TEST_DEFINITION = {
  type: "object",
  properties: {
    title: { type: "string" },
    author: { type: "string" },
  },
  required: ["title"],
};

Deno.test("Schema - DDD Compliant Tests", async (t) => {
  await t.step("should create valid schema with all parameters", () => {
    const schema = createTestSchema(
      "test-schema",
      TEST_DEFINITION,
      "1.0.0",
      "Test schema for documents",
    );

    assertEquals(schema.getId().getValue(), "test-schema");
    assertEquals(schema.getDefinition().getRawDefinition(), TEST_DEFINITION);
    assertEquals(schema.getVersion().toString(), "1.0.0");
    assertEquals(schema.getDescription(), "Test schema for documents");
  });

  await t.step("should create schema with minimal parameters", () => {
    const schema = createTestSchema("minimal-schema", TEST_DEFINITION, "1.0.0");

    assertEquals(schema.getId().getValue(), "minimal-schema");
    assertEquals(schema.getDefinition().getRawDefinition(), TEST_DEFINITION);
    assertEquals(schema.getVersion().toString(), "1.0.0");
    assertEquals(schema.getDescription(), "");
  });

  await t.step("should handle complex schema IDs", () => {
    const complexId = "schema-with-dashes_and_underscores.v1";
    const schema = createTestSchema(complexId, TEST_DEFINITION, "2.1.0");

    assertEquals(schema.getId().getValue(), complexId);
    assertEquals(schema.getVersion().toString(), "2.1.0");
  });

  await t.step("should provide access to schema definition", () => {
    const schema = createTestSchema(
      "definition-test",
      TEST_DEFINITION,
      "1.0.0",
    );
    const retrievedDefinition = schema.getDefinition();

    assertEquals(retrievedDefinition.getRawDefinition(), TEST_DEFINITION);
    assertEquals(retrievedDefinition.getVersion(), "1.0.0");
  });

  await t.step("should handle schema description properly", () => {
    const testDescription = "This is a test schema description";
    const schema = createTestSchema(
      "description-test",
      TEST_DEFINITION,
      "1.0.0",
      testDescription,
    );

    assertEquals(schema.getDescription(), testDescription);
  });

  await t.step("should default to empty description when not provided", () => {
    const schema = createTestSchema(
      "no-description-test",
      TEST_DEFINITION,
      "1.0.0",
    );

    assertEquals(schema.getDescription(), "");
  });
});

Deno.test("SchemaDefinition - Smart Constructor Tests", async (t) => {
  await t.step("should create valid schema definition with version", () => {
    const definition = {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" },
      },
      required: ["title"],
    };

    const result = SchemaDefinition.create(definition, "1.0.0");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getVersion(), "1.0.0");
      assertEquals(result.data.getRawDefinition(), definition);
    }
  });

  await t.step(
    "should create valid schema definition with default version",
    () => {
      const definition = {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: "string" },
        },
      };

      const result = SchemaDefinition.create(definition);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getVersion(), "1.0.0"); // default version
        assertEquals(result.data.getRawDefinition(), definition);
      }
    },
  );

  await t.step(
    "should create valid schema definition with custom version",
    () => {
      const definition = { customRule: "validate-title-length" };

      const result = SchemaDefinition.create(definition, "2.1.0");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getVersion(), "2.1.0");
        assertEquals(result.data.getRawDefinition(), definition);
      }
    },
  );

  await t.step("should reject empty definition", () => {
    const result = SchemaDefinition.create(null, "1.0.0");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject undefined definition", () => {
    const result = SchemaDefinition.create(undefined, "1.0.0");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject non-object definition", () => {
    const result = SchemaDefinition.create(
      "not an object" as unknown as Record<string, unknown>,
      "1.0.0",
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("should reject array definition", () => {
    const result = SchemaDefinition.create(
      [1, 2, 3] as unknown as Record<string, unknown>,
      "1.0.0",
    );

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });
});

Deno.test("SchemaId - Value Object Tests", async (t) => {
  await t.step("should create valid schema ID", () => {
    const result = SchemaId.create("valid-schema-id");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getValue(), "valid-schema-id");
    }
  });

  await t.step("should reject empty schema ID", () => {
    const result = SchemaId.create("");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should reject whitespace-only schema ID", () => {
    const result = SchemaId.create("   ");

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("should support schema ID equality comparison", () => {
    const result1 = SchemaId.create("same-id");
    const result2 = SchemaId.create("same-id");
    const result3 = SchemaId.create("different-id");

    if (result1.ok && result2.ok && result3.ok) {
      assertEquals(result1.data.equals(result2.data), true);
      assertEquals(result1.data.equals(result3.data), false);
    }
  });
});
