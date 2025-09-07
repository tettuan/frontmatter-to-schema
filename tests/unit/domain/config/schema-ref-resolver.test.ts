/**
 * Tests for Schema $ref Resolver
 */

// deno-lint-ignore-file no-explicit-any

import { assert, assertEquals } from "jsr:@std/assert@1.0.9";
import { SchemaRefResolver } from "../../../../src/domain/config/schema-ref-resolver.ts";
import type { FileSystemRepository } from "../../../../src/domain/repositories/file-system-repository.ts";
import type { DomainError } from "../../../../src/domain/core/result.ts";

// Mock FileSystemRepository for testing
class TestFileSystemRepository implements FileSystemRepository {
  private files = new Map<string, string>();

  // Set test files
  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  readFile(
    path: string,
  ): Promise<{ ok: true; data: string } | { ok: false; error: DomainError }> {
    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.resolve({
        ok: false,
        error: { kind: "FileNotFound", path },
      });
    }
    return Promise.resolve({ ok: true, data: content });
  }

  writeFile(
    _path: string,
    _content: string,
  ): Promise<{ ok: true; data: void } | { ok: false; error: DomainError }> {
    return Promise.resolve({ ok: true, data: undefined });
  }

  ensureDirectory(
    _path: string,
  ): Promise<{ ok: true; data: void } | { ok: false; error: DomainError }> {
    return Promise.resolve({ ok: true, data: undefined });
  }

  exists(
    path: string,
  ): Promise<{ ok: true; data: boolean } | { ok: false; error: DomainError }> {
    return Promise.resolve({ ok: true, data: this.files.has(path) });
  }

  async *findFiles(_pattern: string): AsyncIterable<string> {
    // Not needed for these tests
  }
}

// Create test schemas
const mainSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "commands": {
      "type": "array",
      "items": { "$ref": "command.schema.json" },
    },
  },
};

const commandSchema = {
  "type": "object",
  "properties": {
    "c1": { "type": "string" },
    "c2": { "type": "string" },
    "c3": { "type": "string" },
  },
  "required": ["c1", "c2", "c3"],
};

Deno.test("SchemaRefResolver should resolve external file $ref", async () => {
  // Create mock file system repository
  const mockFileSystem = new TestFileSystemRepository();

  // Set up test files
  mockFileSystem.setFile("command.schema.json", JSON.stringify(commandSchema));

  // Create resolver with mock file system
  const resolver = new SchemaRefResolver(mockFileSystem, ".");

  // Resolve the schema
  const result = await resolver.resolveSchema(mainSchema, "main.schema.json");

  assert(result.ok, "Resolution should succeed");

  // Check that $ref was resolved
  const resolved = result.data as any;
  assertEquals(resolved.type, "object");
  assertEquals(resolved.properties.commands.type, "array");

  // The $ref should be replaced with the actual schema
  assertEquals(resolved.properties.commands.items.type, "object");
  assertEquals(
    resolved.properties.commands.items.properties.c1.type,
    "string",
  );
  assertEquals(
    resolved.properties.commands.items.required,
    ["c1", "c2", "c3"],
  );
});

Deno.test("SchemaRefResolver should handle nested $ref resolution", async () => {
  const nestedSchema = {
    "type": "object",
    "properties": {
      "tools": {
        "type": "object",
        "properties": {
          "availableConfigs": {
            "type": "array",
            "items": { "type": "string" },
          },
          "commands": {
            "type": "array",
            "items": { "$ref": "nested.json" },
          },
        },
      },
    },
  };

  const nestedRef = {
    "type": "object",
    "properties": {
      "nested": { "$ref": "leaf.json" },
    },
  };

  const leafSchema = {
    "type": "string",
    "enum": ["value1", "value2"],
  };

  // Set up mock file system with test data
  const mockFileSystem = new TestFileSystemRepository();
  mockFileSystem.setFile("nested.json", JSON.stringify(nestedRef));
  mockFileSystem.setFile("leaf.json", JSON.stringify(leafSchema));

  const resolver = new SchemaRefResolver(mockFileSystem, ".");
  const result = await resolver.resolveSchema(nestedSchema, "main.json");

  assert(result.ok, "Nested resolution should succeed");

  const resolved = result.data as any;
  // Check nested resolution
  assertEquals(
    resolved.properties.tools.properties.commands.items.properties.nested
      .type,
    "string",
  );
  assertEquals(
    resolved.properties.tools.properties.commands.items.properties.nested
      .enum,
    ["value1", "value2"],
  );
});

Deno.test("SchemaRefResolver should detect circular references", async () => {
  const circularA = {
    "type": "object",
    "properties": {
      "b": { "$ref": "b.json" },
    },
  };

  const circularB = {
    "type": "object",
    "properties": {
      "a": { "$ref": "a.json" },
    },
  };

  // Set up mock file system with circular references
  const mockFileSystem = new TestFileSystemRepository();
  mockFileSystem.setFile("a.json", JSON.stringify(circularA));
  mockFileSystem.setFile("b.json", JSON.stringify(circularB));

  const resolver = new SchemaRefResolver(mockFileSystem, ".");
  const result = await resolver.resolveSchema(circularA, "a.json");

  assert(!result.ok, "Should detect circular reference");
  assert(
    result.error.message.includes("Circular reference"),
    "Error should mention circular reference",
  );
});

Deno.test("SchemaRefResolver should handle missing file references", async () => {
  const schemaWithMissingRef = {
    "type": "object",
    "properties": {
      "missing": { "$ref": "does-not-exist.json" },
    },
  };

  const mockFileSystem = new TestFileSystemRepository();
  const resolver = new SchemaRefResolver(mockFileSystem, "/tmp");
  const result = await resolver.resolveSchema(
    schemaWithMissingRef,
    "/tmp/main.json",
  );

  assert(!result.ok, "Should fail for missing file");
  assert(
    result.error.message.includes("not found"),
    "Error should mention file not found",
  );
});

Deno.test("SchemaRefResolver should preserve non-ref properties", async () => {
  const schemaWithMixed = {
    "type": "object",
    "title": "Mixed Schema",
    "description": "Has both refs and regular properties",
    "properties": {
      "regular": { "type": "string" },
      "referenced": { "$ref": "simple.json" },
    },
  };

  const simpleSchema = {
    "type": "number",
    "minimum": 0,
  };

  // Set up mock file system with referenced schema
  const mockFileSystem = new TestFileSystemRepository();
  mockFileSystem.setFile("simple.json", JSON.stringify(simpleSchema));

  const resolver = new SchemaRefResolver(mockFileSystem, ".");
  const result = await resolver.resolveSchema(schemaWithMixed, "main.json");

  assert(result.ok, "Resolution should succeed");

  const resolved = result.data as any;
  // Check that non-ref properties are preserved
  assertEquals(resolved.title, "Mixed Schema");
  assertEquals(resolved.description, "Has both refs and regular properties");
  assertEquals(resolved.properties.regular.type, "string");

  // Check that ref was resolved
  assertEquals(resolved.properties.referenced.type, "number");
  assertEquals(resolved.properties.referenced.minimum, 0);
});
