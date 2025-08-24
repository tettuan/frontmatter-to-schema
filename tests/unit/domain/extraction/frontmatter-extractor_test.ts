/**
 * Tests for Frontmatter Extraction Function
 */

import { assertEquals } from "jsr:@std/assert";
import { extractAccordingToSchema } from "../../../../src/domain/extraction/frontmatter-extractor.ts";

Deno.test("extractAccordingToSchema - Extract title from frontmatter", () => {
  const frontmatter = "title:プロジェクト全体の深掘り調査と修正タスク洗い出し";
  const schema = {
    version: {
      type: "string",
      description: 'Registry version (e.g., "1.0.0")',
      pattern: "^\\d+\\.\\d+\\.\\d+$",
    },
    description: {
      type: "string",
      description: "Overall registry description",
    },
    tools: {
      type: "object",
      description: "Tool configuration and command registry",
      properties: {
        availableConfigs: {
          type: "array",
          description:
            "Tool names array - each becomes available as climpt-{name}",
          items: {
            type: "string",
            enum: ["git", "spec", "test", "code", "docs", "meta"],
          },
        },
        commands: {
          type: "array",
          description: "Command registry - defines all available C3L commands",
          items: {
            $ref: "command.schema.json",
          },
        },
      },
      required: ["availableConfigs", "commands"],
      additionalProperties: false,
    },
  };

  const result = extractAccordingToSchema(frontmatter, schema);

  // The result should have the schema structure with null values for missing fields
  assertEquals(result.version, null);
  assertEquals(result.description, null);
  assertEquals(typeof result.tools, "object");

  const tools = result.tools as Record<string, unknown>;
  assertEquals(tools.availableConfigs, null);
  assertEquals(tools.commands, null);
});

Deno.test("extractAccordingToSchema - Extract matching version field", () => {
  const frontmatter = "version:1.0.0";
  const schema = {
    version: {
      type: "string",
      description: "Registry version",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
    },
  };

  const result = extractAccordingToSchema(frontmatter, schema);
  assertEquals(result.version, "1.0.0");
});

Deno.test("extractAccordingToSchema - Handle multiple frontmatter fields", () => {
  const frontmatter = "description:Test registry for commands";
  const schema = {
    version: {
      type: "string",
      description: "Registry version",
    },
    description: {
      type: "string",
      description: "Overall registry description",
    },
  };

  const result = extractAccordingToSchema(frontmatter, schema);
  assertEquals(result.version, null);
  assertEquals(result.description, "Test registry for commands");
});

Deno.test("extractAccordingToSchema - Return null for all fields when no match", () => {
  const frontmatter = "unknownField:some value";
  const schema = {
    version: {
      type: "string",
    },
    description: {
      type: "string",
    },
    tools: {
      type: "object",
      properties: {
        availableConfigs: {
          type: "array",
        },
      },
    },
  };

  const result = extractAccordingToSchema(frontmatter, schema);
  assertEquals(result.version, null);
  assertEquals(result.description, null);

  const tools = result.tools as Record<string, unknown>;
  assertEquals(tools.availableConfigs, null);
});

Deno.test("extractAccordingToSchema - Handle colon in value", () => {
  const frontmatter = "description:Command: create new file";
  const schema = {
    description: {
      type: "string",
    },
  };

  const result = extractAccordingToSchema(frontmatter, schema);
  assertEquals(result.description, "Command: create new file");
});

Deno.test("extractAccordingToSchema - Complete example matching task requirements", () => {
  // This test matches the exact example from the uploaded file
  const frontmatter = "title:プロジェクト全体の深掘り調査と修正タスク洗い出し";
  const schema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "version": {
      "type": "string",
      "description": 'Registry version (e.g., "1.0.0")',
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
    },
    "description": {
      "type": "string",
      "description": "Overall registry description",
    },
    "tools": {
      "type": "object",
      "description": "Tool configuration and command registry",
      "properties": {
        "availableConfigs": {
          "type": "array",
          "description":
            "Tool names array - each becomes available as climpt-{name}",
          "items": {
            "type": "string",
            "enum": ["git", "spec", "test", "code", "docs", "meta"],
          },
        },
        "commands": {
          "type": "array",
          "description":
            "Command registry - defines all available C3L commands",
          "items": {
            "$ref": "command.schema.json",
          },
        },
      },
      "required": ["availableConfigs", "commands"],
      "additionalProperties": false,
    },
  };

  const result = extractAccordingToSchema(frontmatter, schema);

  // Validate the result structure matches the schema
  assertEquals(typeof result, "object");
  assertEquals(result.version, null);
  assertEquals(result.description, null);
  assertEquals(typeof result.tools, "object");

  const tools = result.tools as Record<string, unknown>;
  assertEquals(tools.availableConfigs, null);
  assertEquals(tools.commands, null);

  // The result should be a valid JSON object
  const jsonString = JSON.stringify(result);
  const parsed = JSON.parse(jsonString);
  assertEquals(parsed.version, null);
  assertEquals(parsed.description, null);
});
