/**
 * Tests for Schema $ref Resolver
 */

import { assertEquals, assert } from "jsr:@std/assert@1.0.9";
import { SchemaRefResolver } from "../../../../src/domain/config/schema-ref-resolver.ts";

// Create test schemas
const mainSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "commands": {
      "type": "array",
      "items": { "$ref": "command.schema.json" }
    }
  }
};

const commandSchema = {
  "type": "object",
  "properties": {
    "c1": { "type": "string" },
    "c2": { "type": "string" },
    "c3": { "type": "string" }
  },
  "required": ["c1", "c2", "c3"]
};

Deno.test("SchemaRefResolver should resolve external file $ref", async () => {
  // Create temporary test files
  const tempDir = await Deno.makeTempDir();
  
  try {
    // Write main schema
    await Deno.writeTextFile(
      `${tempDir}/main.schema.json`,
      JSON.stringify(mainSchema)
    );
    
    // Write referenced schema
    await Deno.writeTextFile(
      `${tempDir}/command.schema.json`,
      JSON.stringify(commandSchema)
    );
    
    // Create resolver with temp directory as base
    const resolver = new SchemaRefResolver(tempDir);
    
    // Resolve the schema
    const result = await resolver.resolveSchema(
      mainSchema,
      `${tempDir}/main.schema.json`
    );
    
    assert(result.ok, "Resolution should succeed");
    
    // Check that $ref was resolved
    const resolved = result.data as any;
    assertEquals(resolved.type, "object");
    assertEquals(resolved.properties.commands.type, "array");
    
    // The $ref should be replaced with the actual schema
    assertEquals(resolved.properties.commands.items.type, "object");
    assertEquals(
      resolved.properties.commands.items.properties.c1.type,
      "string"
    );
    assertEquals(
      resolved.properties.commands.items.required,
      ["c1", "c2", "c3"]
    );
  } finally {
    // Clean up
    await Deno.remove(tempDir, { recursive: true });
  }
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
            "items": { "type": "string" }
          },
          "commands": {
            "type": "array",
            "items": { "$ref": "nested.json" }
          }
        }
      }
    }
  };
  
  const nestedRef = {
    "type": "object",
    "properties": {
      "nested": { "$ref": "leaf.json" }
    }
  };
  
  const leafSchema = {
    "type": "string",
    "enum": ["value1", "value2"]
  };
  
  const tempDir = await Deno.makeTempDir();
  
  try {
    await Deno.writeTextFile(
      `${tempDir}/main.json`,
      JSON.stringify(nestedSchema)
    );
    await Deno.writeTextFile(
      `${tempDir}/nested.json`,
      JSON.stringify(nestedRef)
    );
    await Deno.writeTextFile(
      `${tempDir}/leaf.json`,
      JSON.stringify(leafSchema)
    );
    
    const resolver = new SchemaRefResolver(tempDir);
    const result = await resolver.resolveSchema(
      nestedSchema,
      `${tempDir}/main.json`
    );
    
    assert(result.ok, "Nested resolution should succeed");
    
    const resolved = result.data as any;
    // Check nested resolution
    assertEquals(
      resolved.properties.tools.properties.commands.items.properties.nested.type,
      "string"
    );
    assertEquals(
      resolved.properties.tools.properties.commands.items.properties.nested.enum,
      ["value1", "value2"]
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("SchemaRefResolver should detect circular references", async () => {
  const circularA = {
    "type": "object",
    "properties": {
      "b": { "$ref": "b.json" }
    }
  };
  
  const circularB = {
    "type": "object",
    "properties": {
      "a": { "$ref": "a.json" }
    }
  };
  
  const tempDir = await Deno.makeTempDir();
  
  try {
    await Deno.writeTextFile(
      `${tempDir}/a.json`,
      JSON.stringify(circularA)
    );
    await Deno.writeTextFile(
      `${tempDir}/b.json`,
      JSON.stringify(circularB)
    );
    
    const resolver = new SchemaRefResolver(tempDir);
    const result = await resolver.resolveSchema(
      circularA,
      `${tempDir}/a.json`
    );
    
    assert(!result.ok, "Should detect circular reference");
    assert(
      result.error.message.includes("Circular reference"),
      "Error should mention circular reference"
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("SchemaRefResolver should handle missing file references", async () => {
  const schemaWithMissingRef = {
    "type": "object",
    "properties": {
      "missing": { "$ref": "does-not-exist.json" }
    }
  };
  
  const resolver = new SchemaRefResolver("/tmp");
  const result = await resolver.resolveSchema(schemaWithMissingRef, "/tmp/main.json");
  
  assert(!result.ok, "Should fail for missing file");
  assert(
    result.error.message.includes("not found"),
    "Error should mention file not found"
  );
});

Deno.test("SchemaRefResolver should preserve non-ref properties", async () => {
  const schemaWithMixed = {
    "type": "object",
    "title": "Mixed Schema",
    "description": "Has both refs and regular properties",
    "properties": {
      "regular": { "type": "string" },
      "referenced": { "$ref": "simple.json" }
    }
  };
  
  const simpleSchema = {
    "type": "number",
    "minimum": 0
  };
  
  const tempDir = await Deno.makeTempDir();
  
  try {
    await Deno.writeTextFile(
      `${tempDir}/simple.json`,
      JSON.stringify(simpleSchema)
    );
    
    const resolver = new SchemaRefResolver(tempDir);
    const result = await resolver.resolveSchema(
      schemaWithMixed,
      `${tempDir}/main.json`
    );
    
    assert(result.ok, "Resolution should succeed");
    
    const resolved = result.data as any;
    // Check that non-ref properties are preserved
    assertEquals(resolved.title, "Mixed Schema");
    assertEquals(resolved.description, "Has both refs and regular properties");
    assertEquals(resolved.properties.regular.type, "string");
    
    // Check that ref was resolved
    assertEquals(resolved.properties.referenced.type, "number");
    assertEquals(resolved.properties.referenced.minimum, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});