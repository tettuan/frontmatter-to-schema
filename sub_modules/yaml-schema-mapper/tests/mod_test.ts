/**
 * Integration tests for the main API
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { mapDataToSchema, WarningCode } from "../src/mod.ts";

Deno.test("mapDataToSchema - basic property mapping with x-map-from", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        input_file: {
          type: "boolean",
          "x-map-from": "file",
        },
      },
    },
    data: {
      file: false,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.input_file, false);
  assertEquals(mapped.metadata.propertiesMapped, 1);
});

Deno.test("mapDataToSchema - array to single value coercion", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        file: { type: "boolean" },
        stdin: { type: "boolean" },
      },
    },
    data: {
      file: [false],
      stdin: [true],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.file, false);
  assertEquals(mapped.data.stdin, true);
  // Array to single value coercion should produce warnings
  assertEquals(mapped.warnings.length > 0, true);
});

Deno.test("mapDataToSchema - case-insensitive matching", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
      },
    },
    data: {
      Title: "Test",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.title, "Test");
});

Deno.test("mapDataToSchema - heuristic matching (snake_case to camelCase)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        fileName: { type: "string" },
      },
    },
    data: {
      file_name: "test.txt",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.fileName, "test.txt");
});

Deno.test("mapDataToSchema - string to number coercion", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        count: { type: "number" },
      },
    },
    data: {
      count: "42",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.count, 42);
});

Deno.test("mapDataToSchema - extended boolean parsing (with semantic conversions)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        active: { type: "boolean" },
        disabled: { type: "boolean" },
      },
    },
    data: {
      active: 1,
      disabled: 0,
    },
    options: {
      allowSemanticConversions: true,
      semanticConversionRules: ["number-to-boolean"],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.active, true);
  assertEquals(mapped.data.disabled, false);
});

Deno.test("mapDataToSchema - single value to array", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
          "x-map-from": "tag",
        },
      },
    },
    data: {
      tag: "important",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.tags, ["important"]);
});

Deno.test("mapDataToSchema - nested object mapping", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        options: {
          type: "object",
          properties: {
            input_file: {
              type: "boolean",
              "x-map-from": "file",
            },
            stdin: { type: "boolean" },
          },
        },
      },
    },
    data: {
      options: {
        file: [false],
        stdin: [true],
      },
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.options, { input_file: false, stdin: true });
});

Deno.test("mapDataToSchema - array of objects with mapping", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        commands: {
          type: "array",
          items: {
            type: "object",
            properties: {
              command: {
                type: "string",
                "x-map-from": "cmd",
              },
              arguments: {
                type: "array",
                "x-map-from": "args",
              },
            },
          },
        },
      },
    },
    data: {
      commands: [
        { cmd: "git", args: ["status"] },
        { cmd: "npm", args: ["test"] },
      ],
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.commands, [
    { command: "git", arguments: ["status"] },
    { command: "npm", arguments: ["test"] },
  ]);
});

Deno.test("mapDataToSchema - required property validation", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
      },
      required: ["title", "description"],
    },
    data: {
      title: "Test",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(
    mapped.warnings.some((w) =>
      w.message.includes("Missing required property: description")
    ),
    true,
  );
});

Deno.test("mapDataToSchema - enum validation", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "inactive", "pending"],
        },
      },
    },
    data: {
      status: "invalid",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertExists(
    mapped.warnings.find((w) => w.message.includes("Invalid enum value")),
  );
});

Deno.test("mapDataToSchema - union type support", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        value: {
          type: ["string", "null"],
        },
      },
    },
    data: {
      value: "text",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.value, "text");
});

Deno.test("mapDataToSchema - x-map-from array (fallback)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        displayName: {
          type: "string",
          "x-map-from": ["fullName", "name", "userName"],
        },
      },
    },
    data: {
      name: "John",
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.displayName, "John");
});

Deno.test("mapDataToSchema - additional properties handling (strict mode)", () => {
  const result = mapDataToSchema({
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
      },
      additionalProperties: false,
    },
    data: {
      title: "Test",
      extra: "not allowed",
    },
    options: {
      strict: true,
    },
  });

  assertEquals(result.isOk(), true);
  const mapped = result.unwrap();
  assertEquals(mapped.data.extra, undefined);
  assertEquals(
    mapped.warnings.some((w) => w.code === WarningCode.ADDITIONAL_PROPERTY),
    true,
  );
  assertEquals(mapped.metadata.propertiesDropped, 1);
});
