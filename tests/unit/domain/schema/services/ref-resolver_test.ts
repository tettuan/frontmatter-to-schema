import { assertEquals } from "@std/assert";
import {
  RefResolver,
  SchemaLoader,
} from "../../../../../src/domain/schema/services/ref-resolver.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaData } from "../../../../../src/domain/schema/entities/schema.ts";
import { Result } from "../../../../../src/domain/shared/types/result.ts";
import { SchemaError } from "../../../../../src/domain/shared/types/errors.ts";

/**
 * Mock schema loader for testing.
 */
class MockSchemaLoader implements SchemaLoader {
  private schemas: Map<string, SchemaData> = new Map();
  private loadErrors: Map<string, SchemaError> = new Map();

  constructor(schemas: Record<string, SchemaData> = {}) {
    for (const [path, schema] of Object.entries(schemas)) {
      this.schemas.set(path, schema);
    }
  }

  loadSchema(path: SchemaPath): Promise<Result<SchemaData, SchemaError>> {
    const pathString = path.toString();

    if (this.loadErrors.has(pathString)) {
      return Promise.resolve(Result.error(this.loadErrors.get(pathString)!));
    }

    const schema = this.schemas.get(pathString);
    if (!schema) {
      return Promise.resolve(Result.error(
        new SchemaError(
          `Schema not found: ${pathString}`,
          "SCHEMA_NOT_FOUND",
          { path: pathString },
        ),
      ));
    }

    return Promise.resolve(Result.ok(schema));
  }

  addSchema(path: string, schema: SchemaData): void {
    this.schemas.set(path, schema);
  }

  addLoadError(path: string, error: SchemaError): void {
    this.loadErrors.set(path, error);
  }
}

// Test data
const basicSchema: SchemaData = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
  },
};

const schemaWithRef: SchemaData = {
  type: "object",
  properties: {
    user: { "$ref": "user.json" },
    metadata: { type: "object" },
  },
};

const userSchema: SchemaData = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string" },
  },
};

const schemaWithFragment: SchemaData = {
  type: "object",
  properties: {
    address: { "$ref": "definitions.json#/definitions/Address" },
  },
};

const definitionsSchema: SchemaData = {
  type: "object",
  definitions: {
    Address: {
      type: "object",
      properties: {
        street: { type: "string" },
        city: { type: "string" },
      },
    },
  },
};

const circularSchema1: SchemaData = {
  type: "object",
  properties: {
    next: { "$ref": "circular2.json" },
  },
};

const circularSchema2: SchemaData = {
  type: "object",
  properties: {
    prev: { "$ref": "circular1.json" },
  },
};

const nestedRefSchema: SchemaData = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        user: { "$ref": "user.json" },
        settings: { "$ref": "settings.json" },
      },
    },
  },
};

const settingsSchema: SchemaData = {
  type: "object",
  properties: {
    theme: { type: "string" },
    notifications: { type: "boolean" },
  },
};

Deno.test("RefResolver - create instance", () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);

  assertEquals(typeof resolver, "object");
  assertEquals(resolver.constructor.name, "RefResolver");
});

Deno.test("RefResolver - create with custom max depth", () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader, 5);

  assertEquals(typeof resolver, "object");
});

Deno.test("RefResolver - resolve schema without references", async () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("test.json").unwrap();

  const result = await resolver.resolveReferences(basicSchema, basePath);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();
  assertEquals(resolved.type, "object");
  assertEquals(resolved.properties?.title, { type: "string" });
});

Deno.test("RefResolver - resolve simple reference", async () => {
  const mockLoader = new MockSchemaLoader({
    "user.json": userSchema,
  });
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("main.json").unwrap();

  const result = await resolver.resolveReferences(schemaWithRef, basePath);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();
  assertEquals(resolved.type, "object");

  const userProperty = (resolved.properties as any).user;
  assertEquals(userProperty.type, "object");
  assertEquals(userProperty.properties.name.type, "string");
  assertEquals(userProperty.properties.email.type, "string");
});

Deno.test("RefResolver - resolve reference with fragment", async () => {
  const mockLoader = new MockSchemaLoader({
    "definitions.json": definitionsSchema,
  });
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("main.json").unwrap();

  const result = await resolver.resolveReferences(schemaWithFragment, basePath);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();

  const addressProperty = (resolved.properties as any).address;
  assertEquals(addressProperty.type, "object");
  assertEquals(addressProperty.properties.street.type, "string");
  assertEquals(addressProperty.properties.city.type, "string");
});

Deno.test("RefResolver - handle missing referenced schema", async () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("main.json").unwrap();

  const result = await resolver.resolveReferences(schemaWithRef, basePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "SCHEMA_NOT_FOUND");
});

Deno.test("RefResolver - detect circular references", async () => {
  const mockLoader = new MockSchemaLoader({
    "circular1.json": circularSchema1,
    "circular2.json": circularSchema2,
  });
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("circular1.json").unwrap();

  const result = await resolver.resolveReferences(circularSchema1, basePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "CIRCULAR_REFERENCE");
});

Deno.test("RefResolver - handle nested references", async () => {
  const mockLoader = new MockSchemaLoader({
    "user.json": userSchema,
    "settings.json": settingsSchema,
  });
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("main.json").unwrap();

  const result = await resolver.resolveReferences(nestedRefSchema, basePath);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();

  const dataProperty = (resolved.properties as any).data;
  assertEquals(dataProperty.properties.user.properties.name.type, "string");
  assertEquals(
    dataProperty.properties.settings.properties.theme.type,
    "string",
  );
});

Deno.test("RefResolver - handle array references", async () => {
  const arraySchema: SchemaData = {
    type: "array",
    items: { "$ref": "user.json" },
  };

  const mockLoader = new MockSchemaLoader({
    "user.json": userSchema,
  });
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("main.json").unwrap();

  const result = await resolver.resolveReferences(arraySchema, basePath);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();
  assertEquals(resolved.type, "array");
  assertEquals((resolved.items as any).type, "object");
});

Deno.test("RefResolver - parseReference with simple path", () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);

  const result = resolver.parseReference("user.json", "main.json");

  assertEquals(result.isOk(), true);
  const ref = result.unwrap();
  assertEquals(ref.refPath, "user.json");
  assertEquals(ref.fragment, undefined);
  assertEquals(ref.baseContext, "main.json");
});

Deno.test("RefResolver - parseReference with fragment", () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);

  const result = resolver.parseReference(
    "definitions.json#/definitions/User",
    "main.json",
  );

  assertEquals(result.isOk(), true);
  const ref = result.unwrap();
  assertEquals(ref.refPath, "definitions.json");
  assertEquals(ref.fragment, "/definitions/User");
  assertEquals(ref.baseContext, "main.json");
});

Deno.test("RefResolver - parseReference with fragment only", () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);

  const result = resolver.parseReference("#/definitions/User", "main.json");

  assertEquals(result.isOk(), true);
  const ref = result.unwrap();
  assertEquals(ref.refPath, "main.json");
  assertEquals(ref.fragment, "/definitions/User");
});

Deno.test("RefResolver - parseReference with invalid input", () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);

  const result = resolver.parseReference("", "main.json");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_REF_FORMAT");
});

Deno.test("RefResolver - handle max depth exceeded", async () => {
  // Create a linear chain of references: level1 -> level2 -> level3 -> level4
  const level1Schema: SchemaData = {
    type: "object",
    properties: {
      nested: { "$ref": "level2.json" },
    },
  };

  const level2Schema: SchemaData = {
    type: "object",
    properties: {
      nested: { "$ref": "level3.json" },
    },
  };

  const level3Schema: SchemaData = {
    type: "object",
    properties: {
      nested: { "$ref": "level4.json" },
    },
  };

  const level4Schema: SchemaData = {
    type: "object",
    properties: {
      data: { type: "string" },
    },
  };

  const mockLoader = new MockSchemaLoader({
    "level2.json": level2Schema,
    "level3.json": level3Schema,
    "level4.json": level4Schema,
  });
  const resolver = RefResolver.create(mockLoader, 2); // Max depth of 2
  const basePath = SchemaPath.create("level1.json").unwrap();

  const result = await resolver.resolveReferences(level1Schema, basePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "MAX_DEPTH_EXCEEDED");
});

Deno.test("RefResolver - handle fragment not found", async () => {
  const schemaWithBadFragment: SchemaData = {
    type: "object",
    properties: {
      data: { "$ref": "definitions.json#/definitions/NonExistent" },
    },
  };

  const mockLoader = new MockSchemaLoader({
    "definitions.json": definitionsSchema,
  });
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("main.json").unwrap();

  const result = await resolver.resolveReferences(
    schemaWithBadFragment,
    basePath,
  );

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "FRAGMENT_NOT_FOUND");
});

Deno.test("RefResolver - handle loader errors", async () => {
  const mockLoader = new MockSchemaLoader();
  mockLoader.addLoadError(
    "user.json",
    new SchemaError("File not found", "FILE_NOT_FOUND", {}),
  );

  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("main.json").unwrap();

  const result = await resolver.resolveReferences(schemaWithRef, basePath);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "SCHEMA_NOT_FOUND");
});

Deno.test("RefResolver - handle relative path resolution", () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);

  const result = resolver.parseReference(
    "../schemas/user.json",
    "config/main.json",
  );

  assertEquals(result.isOk(), true);
  const ref = result.unwrap();
  assertEquals(ref.refPath, "schemas/user.json");
});

Deno.test("RefResolver - handle absolute path resolution", () => {
  const mockLoader = new MockSchemaLoader();
  const resolver = RefResolver.create(mockLoader);

  const result = resolver.parseReference(
    "/absolute/path/user.json",
    "config/main.json",
  );

  assertEquals(result.isOk(), true);
  const ref = result.unwrap();
  assertEquals(ref.refPath, "/absolute/path/user.json");
});

Deno.test("RefResolver - handle concurrent resolutions", async () => {
  const mockLoader = new MockSchemaLoader({
    "user1.json": userSchema,
    "user2.json": userSchema,
    "user3.json": userSchema,
  });
  const resolver = RefResolver.create(mockLoader);

  const schemas = [
    { type: "object", properties: { user: { "$ref": "user1.json" } } },
    { type: "object", properties: { user: { "$ref": "user2.json" } } },
    { type: "object", properties: { user: { "$ref": "user3.json" } } },
  ];

  const basePath = SchemaPath.create("main.json").unwrap();
  const promises = schemas.map((schema) =>
    resolver.resolveReferences(schema as SchemaData, basePath)
  );

  const results = await Promise.all(promises);

  assertEquals(results.length, 3);
  results.forEach((result) => {
    assertEquals(result.isOk(), true);
  });
});

Deno.test("RefResolver - preserve non-reference properties", async () => {
  const mixedSchema: SchemaData = {
    type: "object",
    title: "Mixed Schema",
    description: "A schema with both refs and regular properties",
    properties: {
      id: { type: "string" },
      user: { "$ref": "user.json" },
      count: { type: "number" },
    },
    required: ["id", "user"],
  };

  const mockLoader = new MockSchemaLoader({
    "user.json": userSchema,
  });
  const resolver = RefResolver.create(mockLoader);
  const basePath = SchemaPath.create("main.json").unwrap();

  const result = await resolver.resolveReferences(mixedSchema, basePath);

  assertEquals(result.isOk(), true);
  const resolved = result.unwrap();

  assertEquals(resolved.title, "Mixed Schema");
  assertEquals(
    resolved.description,
    "A schema with both refs and regular properties",
  );
  assertEquals((resolved.properties as any).id.type, "string");
  assertEquals((resolved.properties as any).count.type, "number");
  assertEquals(resolved.required as string[], ["id", "user"]);
});
