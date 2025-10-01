/**
 * Tests for items hierarchy omission rule (Issue #1230).
 * Verifies that array element references use commands[].c1 notation
 * instead of commands.items[].c1 notation.
 */

import { assertEquals } from "jsr:@std/assert";
import { SchemaDirectiveProcessor } from "../../../../../src/domain/schema/services/schema-directive-processor.ts";

// Mock FileSystemPort for testing
class MockFileSystemPort {
  async readTextFile(_path: string) {
    await Promise.resolve(); // Satisfy async requirement
    return {
      isError: () => false,
      unwrapError: () => {
        throw new Error("Cannot unwrap ok result");
      },
      isOk: () => true,
      unwrap: () => "{}",
    };
  }
}

const mockFileSystem = new MockFileSystemPort();

Deno.test("items hierarchy omission - x-derived-from uses commands[] notation", () => {
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    commands: [
      { c1: "git", c2: "commit", c3: "all" },
      { c1: "npm", c2: "install", c3: "deps" },
      { c1: "deno", c2: "test", c3: "all" },
    ],
  };

  // Schema uses commands[].c1 notation (NOT commands.items[].c1)
  const schema = {
    properties: {
      commandNames: {
        type: "array",
        "x-derived-from": "commands[].c1",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processedData = result.unwrap();
  assertEquals(processedData.commandNames, ["deno", "git", "npm"]);
});

Deno.test("items hierarchy omission - nested array notation works", () => {
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    tools: {
      commands: [
        { name: "git", version: "2.34" },
        { name: "npm", version: "8.19" },
      ],
    },
  };

  // Schema uses tools.commands[].name notation (NOT tools.commands.items[].name)
  const schema = {
    properties: {
      toolNames: {
        type: "array",
        "x-derived-from": "tools.commands[].name",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processedData = result.unwrap();
  assertEquals(processedData.toolNames, ["git", "npm"]);
});

Deno.test("items hierarchy omission - verifies .items[] notation is NOT supported", () => {
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    commands: [
      { c1: "git" },
      { c1: "npm" },
    ],
  };

  // Intentionally use WRONG notation with .items[]
  const schema = {
    properties: {
      commandNames: {
        type: "array",
        "x-derived-from": "commands.items[].c1",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processedData = result.unwrap();
  // This should fail to extract values because .items[] is wrong notation
  assertEquals(processedData.commandNames, []);
});

Deno.test("items hierarchy omission - does NOT use .items fallback", () => {
  const processor = SchemaDirectiveProcessor.create(mockFileSystem as any)
    .unwrap();

  const data = {
    // Note: no top-level 'commands' array, but has 'items' array
    items: [
      { c1: "git" },
      { c1: "npm" },
    ],
  };

  // Schema asks for commands[].c1 but data doesn't have 'commands'
  const schema = {
    properties: {
      commandNames: {
        type: "array",
        "x-derived-from": "commands[].c1",
      },
    },
  };

  const result = processor.applySchemaDirectives(data, schema);

  assertEquals(result.isOk(), true);
  const processedData = result.unwrap();
  // Should NOT fall back to using 'items' array - should return empty
  assertEquals(processedData.commandNames, []);
});
