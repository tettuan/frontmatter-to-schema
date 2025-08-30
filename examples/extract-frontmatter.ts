#!/usr/bin/env -S deno run --allow-read
/**
 * Example script demonstrating frontmatter extraction according to schema
 * Usage: deno run examples/extract-frontmatter.ts
 */

import { extractAccordingToSchemaLegacy as extractAccordingToSchema } from "../src/domain/services/frontmatter-extractor.ts";

// Example from the task
const frontmatter = "title:プロジェクト全体の深掘り調査と修正タスク洗い出し";

const schema = {
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
        "description": "Command registry - defines all available C3L commands",
        "items": {
          "$ref": "command.schema.json",
        },
      },
    },
    "required": ["availableConfigs", "commands"],
    "additionalProperties": false,
  },
};

console.log("Input Frontmatter:");
console.log(`  ${frontmatter}`);
console.log("\nSchema Structure:");
console.log("  - version (string with pattern)");
console.log("  - description (string)");
console.log("  - tools (object with availableConfigs and commands arrays)");

const result = extractAccordingToSchema(frontmatter, schema);

console.log("\nExtracted JSON Result:");
console.log(JSON.stringify(result, null, 2));

console.log("\nExplanation:");
console.log(
  "- The frontmatter contains 'title' field which is not in the schema",
);
console.log(
  "- All schema fields are returned with null values for missing data",
);
console.log(
  "- The tools object is structured according to the schema properties",
);
