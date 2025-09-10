/**
 * RefResolver Domain Service Tests
 *
 * Tests for RefResolver following DDD and Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { RefResolver } from "../../../../../src/domain/schema/services/ref-resolver.ts";
import { SchemaDefinition } from "../../../../../src/domain/value-objects/schema-definition.ts";
import type { SchemaPath } from "../../../../../src/domain/value-objects/schema-path.ts";

Deno.test("RefResolver - should create valid RefResolver with default max depth", () => {
  const result = RefResolver.create();

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("RefResolver - should create valid RefResolver with custom max depth", () => {
  const result = RefResolver.create(5);

  assertEquals(result.ok, true);
  if (result.ok) {
    assertExists(result.data);
  }
});

Deno.test("RefResolver - should reject invalid max depth (too low)", () => {
  const result = RefResolver.create(0);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "OutOfRange");
  }
});

Deno.test("RefResolver - should reject invalid max depth (too high)", () => {
  const result = RefResolver.create(101);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "OutOfRange");
  }
});

Deno.test("RefResolver - should detect refs in schema", () => {
  const schemaContent = {
    type: "object",
    properties: {
      user: { $ref: "#/definitions/User" },
      posts: {
        type: "array",
        items: { $ref: "#/definitions/Post" },
      },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const hasRefs = RefResolver.hasRefs(schemaResult.data);
  assertEquals(hasRefs, true);
});

Deno.test("RefResolver - should extract refs from schema", () => {
  const schemaContent = {
    type: "object",
    properties: {
      user: { $ref: "#/definitions/User" },
      posts: {
        type: "array",
        items: { $ref: "#/definitions/Post" },
      },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const refs = RefResolver.extractRefs(schemaResult.data);
  assertEquals(refs.length, 2);
  assertEquals(refs.includes("#/definitions/User"), true);
  assertEquals(refs.includes("#/definitions/Post"), true);
});

Deno.test("RefResolver - should handle schema without refs", () => {
  const schemaContent = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const hasRefs = RefResolver.hasRefs(schemaResult.data);
  assertEquals(hasRefs, false);

  const refs = RefResolver.extractRefs(schemaResult.data);
  assertEquals(refs.length, 0);
});

Deno.test("RefResolver - should resolve simple ref", async () => {
  const mainSchemaContent = {
    type: "object",
    properties: {
      user: { $ref: "user.json" },
    },
  };

  const referencedSchemaContent = {
    type: "object",
    properties: {
      name: { type: "string" },
      email: { type: "string" },
    },
  };

  const mainSchemaResult = SchemaDefinition.createFromObject(mainSchemaContent);
  const referencedSchemaResult = SchemaDefinition.createFromObject(
    referencedSchemaContent,
  );

  if (!mainSchemaResult.ok || !referencedSchemaResult.ok) {
    throw new Error("Failed to create schemas");
  }

  const resolverResult = RefResolver.create();
  if (!resolverResult.ok) {
    throw new Error("Failed to create resolver");
  }

  // Mock schema loader
  const schemaLoader = (path: SchemaPath) => {
    if (path.getValue() === "user.json") {
      return Promise.resolve(
        { ok: true, data: referencedSchemaResult.data } as const,
      );
    }
    return Promise.resolve(
      {
        ok: false,
        error: {
          kind: "NotFound",
          resource: "schema",
          message: "Schema not found",
        },
      } as const,
    );
  };

  const resolvedResult = await resolverResult.data.resolveRefs(
    mainSchemaResult.data,
    schemaLoader,
  );

  assertEquals(resolvedResult.ok, true);
  if (resolvedResult.ok) {
    assertEquals(resolvedResult.data.resolvedRefs.length, 1);
    assertEquals(resolvedResult.data.resolvedRefs[0], "user.json");

    // Check that the ref was replaced
    const resolvedContent = resolvedResult.data.content;
    assertEquals(resolvedContent.type, "object");
    assertExists(resolvedContent.properties);

    const properties = resolvedContent.properties as Record<string, unknown>;
    assertExists(properties.user);

    const userProperty = properties.user as Record<string, unknown>;
    assertEquals(userProperty.type, "object");
    assertExists(userProperty.properties);
  }
});

Deno.test("RefResolver - should detect circular references", async () => {
  const schemaContent = {
    type: "object",
    properties: {
      child: { $ref: "circular.json" },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  const resolverResult = RefResolver.create();
  if (!resolverResult.ok) {
    throw new Error("Failed to create resolver");
  }

  // Mock schema loader that creates circular reference
  const schemaLoader = (path: SchemaPath) => {
    if (path.getValue() === "circular.json") {
      const circularContent = {
        type: "object",
        properties: {
          parent: { $ref: "circular.json" }, // Points back to itself
        },
      };
      const circularSchemaResult = SchemaDefinition.createFromObject(
        circularContent,
      );
      if (!circularSchemaResult.ok) {
        throw new Error("Failed to create circular schema");
      }
      return Promise.resolve(
        { ok: true, data: circularSchemaResult.data } as const,
      );
    }
    return Promise.resolve(
      {
        ok: false,
        error: {
          kind: "NotFound",
          resource: "schema",
          message: "Schema not found",
        },
      } as const,
    );
  };

  const resolvedResult = await resolverResult.data.resolveRefs(
    schemaResult.data,
    schemaLoader,
  );

  assertEquals(resolvedResult.ok, false);
  if (!resolvedResult.ok) {
    assertEquals(resolvedResult.error.kind, "CircularReference");
  }
});

Deno.test("RefResolver - should respect max depth limit", async () => {
  const resolverResult = RefResolver.create(2); // Very low limit
  if (!resolverResult.ok) {
    throw new Error("Failed to create resolver");
  }

  const schemaContent = {
    type: "object",
    properties: {
      level1: { $ref: "level1.json" },
    },
  };

  const schemaResult = SchemaDefinition.createFromObject(schemaContent);
  if (!schemaResult.ok) {
    throw new Error("Failed to create schema");
  }

  // Mock schema loader that creates deep nesting
  let depth = 0;
  const schemaLoader = (_path: SchemaPath) => {
    depth++;
    const nextLevel = `level${depth + 1}.json`;
    const content = {
      type: "object",
      properties: {
        [`level${depth + 1}`]: { $ref: nextLevel },
      },
    };
    const levelSchemaResult = SchemaDefinition.createFromObject(content);
    if (!levelSchemaResult.ok) {
      throw new Error("Failed to create level schema");
    }
    return Promise.resolve({ ok: true, data: levelSchemaResult.data } as const);
  };

  const resolvedResult = await resolverResult.data.resolveRefs(
    schemaResult.data,
    schemaLoader,
  );

  assertEquals(resolvedResult.ok, false);
  if (!resolvedResult.ok) {
    assertEquals(resolvedResult.error.kind, "TooDeep");
  }
});
