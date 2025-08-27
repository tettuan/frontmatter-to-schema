/**
 * Tests for frontmatter extraction functions
 * Tests the specific functions in frontmatter-extractor.ts
 */

import { assertEquals } from "jsr:@std/assert";
import {
  extractAccordingToSchema,
  extractFrontmatterToSchema,
  parseFrontmatterAndExtract,
} from "../../../../src/domain/services/frontmatter-extractor.ts";

Deno.test("extractFrontmatterToSchema", async (t) => {
  await t.step("should extract version with pattern validation", () => {
    const frontmatterData = {
      version: "1.0.0",
      description: "Test description",
    };

    const schema = {
      version: {
        type: "string",
        description: "Version",
        pattern: "^\\d+\\.\\d+\\.\\d+$",
      },
      description: {
        type: "string",
        description: "Description",
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.version, "1.0.0");
    assertEquals(result.description, "Test description");
    assertEquals(result.tools, null);
  });

  await t.step("should reject version that doesn't match pattern", () => {
    const frontmatterData = {
      version: "invalid-version",
    };

    const schema = {
      version: {
        type: "string",
        description: "Version",
        pattern: "^\\d+\\.\\d+\\.\\d+$",
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.version, null); // Should be null due to pattern mismatch
    assertEquals(result.description, null);
    assertEquals(result.tools, null);
  });

  await t.step("should extract version without pattern validation", () => {
    const frontmatterData = {
      version: "v1.0.0-alpha",
    };

    const schema = {
      version: {
        type: "string",
        description: "Version",
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.version, "v1.0.0-alpha");
    assertEquals(result.description, null);
    assertEquals(result.tools, null);
  });

  await t.step("should handle non-string version", () => {
    const frontmatterData = {
      version: 123,
    };

    const schema = {
      version: {
        type: "string",
        description: "Version",
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.version, null); // Should be null for non-string
  });

  await t.step("should extract description when present", () => {
    const frontmatterData = {
      description: "This is a test description",
    };

    const schema = {
      description: {
        type: "string",
        description: "Description",
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.version, null);
    assertEquals(result.description, "This is a test description");
    assertEquals(result.tools, null);
  });

  await t.step("should handle non-string description", () => {
    const frontmatterData = {
      description: 123,
    };

    const schema = {
      description: {
        type: "string",
        description: "Description",
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.description, null); // Should be null for non-string
  });

  await t.step("should extract tools with availableConfigs", () => {
    const frontmatterData = {
      tools: {
        availableConfigs: ["config1", "config2"],
      },
    };

    const schema = {
      tools: {
        type: "object",
        description: "Tools",
        properties: {
          availableConfigs: {
            type: "array",
            description: "Available configs",
            items: {
              type: "string",
            },
          },
        },
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.version, null);
    assertEquals(result.description, null);
    assertEquals(result.tools?.availableConfigs, ["config1", "config2"]);
    assertEquals(result.tools?.commands, null);
  });

  await t.step("should validate availableConfigs enum", () => {
    const frontmatterData = {
      tools: {
        availableConfigs: ["valid", "invalid", "config"],
      },
    };

    const schema = {
      tools: {
        type: "object",
        description: "Tools",
        properties: {
          availableConfigs: {
            type: "array",
            description: "Available configs",
            items: {
              type: "string",
              enum: ["valid", "config"],
            },
          },
        },
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.tools?.availableConfigs, ["valid", "config"]);
    assertEquals(result.tools?.commands, null);
  });

  await t.step("should filter out non-string configs", () => {
    const frontmatterData = {
      tools: {
        availableConfigs: ["config1", 123, "config2", null, "config3"],
      },
    };

    const schema = {
      tools: {
        type: "object",
        description: "Tools",
        properties: {
          availableConfigs: {
            type: "array",
            description: "Available configs",
            items: {
              type: "string",
            },
          },
        },
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.tools?.availableConfigs, [
      "config1",
      "config2",
      "config3",
    ]);
  });

  await t.step("should handle empty valid configs", () => {
    const frontmatterData = {
      tools: {
        availableConfigs: [123, null, true],
      },
    };

    const schema = {
      tools: {
        type: "object",
        description: "Tools",
        properties: {
          availableConfigs: {
            type: "array",
            description: "Available configs",
            items: {
              type: "string",
            },
          },
        },
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.tools?.availableConfigs, null); // Should be null when no valid configs
  });

  await t.step("should extract commands", () => {
    const frontmatterData = {
      tools: {
        commands: [{ name: "cmd1" }, { name: "cmd2" }],
      },
    };

    const schema = {
      tools: {
        type: "object",
        description: "Tools",
        properties: {
          commands: {
            type: "array",
            description: "Commands",
            items: {
              $ref: "#/definitions/command",
            },
          },
        },
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.tools?.commands, [{ name: "cmd1" }, { name: "cmd2" }]);
    assertEquals(result.tools?.availableConfigs, null);
  });

  await t.step("should handle non-array commands", () => {
    const frontmatterData = {
      tools: {
        commands: "not-an-array",
      },
    };

    const schema = {
      tools: {
        type: "object",
        description: "Tools",
        properties: {
          commands: {
            type: "array",
            description: "Commands",
          },
        },
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.tools?.commands, null); // Should be null for non-array
  });

  await t.step("should handle non-object tools", () => {
    const frontmatterData = {
      tools: "not-an-object",
    };

    const schema = {
      tools: {
        type: "object",
        description: "Tools",
      },
    };

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.tools, null); // Should be null for non-object
  });

  await t.step("should handle missing schema properties", () => {
    const frontmatterData = {
      version: "1.0.0",
      description: "Test",
      tools: {
        availableConfigs: ["config"],
      },
    };

    const schema = {}; // Empty schema

    const result = extractFrontmatterToSchema(frontmatterData, schema);

    assertEquals(result.version, null);
    assertEquals(result.description, null);
    assertEquals(result.tools, null);
  });
});

Deno.test("parseFrontmatterAndExtract", async (t) => {
  await t.step("should parse simple YAML and extract", () => {
    const yamlContent = `version: 1.0.0
description: Test description
author: John Doe`;

    const schema = {
      version: {
        type: "string",
        description: "Version",
      },
      description: {
        type: "string",
        description: "Description",
      },
    };

    const result = parseFrontmatterAndExtract(yamlContent, schema);

    assertEquals(result.version, "1.0.0");
    assertEquals(result.description, "Test description");
    assertEquals(result.tools, null);
  });

  await t.step("should handle quoted values", () => {
    const yamlContent = `version: "1.0.0"
description: 'Test description'
title: "Another 'nested' quotes"`;

    const schema = {
      version: {
        type: "string",
        description: "Version",
      },
      description: {
        type: "string",
        description: "Description",
      },
    };

    const result = parseFrontmatterAndExtract(yamlContent, schema);

    assertEquals(result.version, "1.0.0");
    assertEquals(result.description, "Test description");
  });

  await t.step("should ignore malformed lines", () => {
    const yamlContent = `version: 1.0.0
malformed-line-without-colon
description: Test description
: value-without-key
invalid: 
key-without-value:`;

    const schema = {
      version: {
        type: "string",
        description: "Version",
      },
      description: {
        type: "string",
        description: "Description",
      },
    };

    const result = parseFrontmatterAndExtract(yamlContent, schema);

    assertEquals(result.version, "1.0.0");
    assertEquals(result.description, "Test description");
  });

  await t.step("should handle empty content", () => {
    const yamlContent = "";

    const schema = {
      version: {
        type: "string",
        description: "Version",
      },
    };

    const result = parseFrontmatterAndExtract(yamlContent, schema);

    assertEquals(result.version, null);
    assertEquals(result.description, null);
    assertEquals(result.tools, null);
  });
});

Deno.test("extractAccordingToSchema", async (t) => {
  await t.step("should parse simple key:value format", () => {
    const frontmatterYaml =
      "title:プロジェクト全体の深掘り調査と修正タスク洗い出し";
    const schema = {
      title: {
        type: "string",
        description: "Title",
      },
      author: {
        type: "string",
        description: "Author",
      },
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    assertEquals(
      result.title,
      "プロジェクト全体の深掘り調査と修正タスク洗い出し",
    );
    assertEquals(result.author, null); // Not present in frontmatter
  });

  await t.step("should handle colon in value", () => {
    const frontmatterYaml = "url:https://example.com:8080/path";
    const schema = {
      url: {
        type: "string",
        description: "URL",
      },
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    assertEquals(result.url, "https://example.com:8080/path");
  });

  await t.step("should handle missing colon", () => {
    const frontmatterYaml = "invalidformat";
    const schema = {
      title: {
        type: "string",
        description: "Title",
      },
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    assertEquals(result.title, null);
  });

  await t.step("should skip $schema meta property", () => {
    const frontmatterYaml = "title:Test Title";
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      title: {
        type: "string",
        description: "Title",
      },
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    // $schema should not be in result
    assertEquals(
      Object.prototype.hasOwnProperty.call(result, "$schema"),
      false,
    );
    assertEquals(result.title, "Test Title");
  });

  await t.step("should initialize nested objects from schema", () => {
    const frontmatterYaml = "title:Test Title";
    const schema = {
      title: {
        type: "string",
        description: "Title",
      },
      metadata: {
        type: "object",
        properties: {
          author: {
            type: "string",
            description: "Author",
          },
          date: {
            type: "string",
            description: "Date",
          },
        },
      },
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    assertEquals(result.title, "Test Title");
    assertEquals(typeof result.metadata, "object");
    assertEquals(
      (result.metadata as { author: unknown; date: unknown }).author,
      null,
    );
    assertEquals(
      (result.metadata as { author: unknown; date: unknown }).date,
      null,
    );
  });

  await t.step("should handle array type in schema", () => {
    const frontmatterYaml = "title:Test Title";
    const schema = {
      title: {
        type: "string",
        description: "Title",
      },
      tags: {
        type: "array",
        description: "Tags",
        items: {
          type: "string",
        },
      },
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    assertEquals(result.title, "Test Title");
    assertEquals(result.tags, null);
  });

  await t.step("should handle string type in schema", () => {
    const frontmatterYaml = "title:Test Title";
    const schema = {
      title: {
        type: "string",
        description: "Title",
      },
      description: {
        type: "string",
        description: "Description",
      },
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    assertEquals(result.title, "Test Title");
    assertEquals(result.description, null);
  });

  await t.step("should handle unknown schema types", () => {
    const frontmatterYaml = "title:Test Title";
    const schema = {
      title: {
        type: "string",
        description: "Title",
      },
      unknown: {
        type: "unknown-type",
        description: "Unknown",
      },
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    assertEquals(result.title, "Test Title");
    assertEquals(result.unknown, null);
  });

  await t.step("should handle non-object schema value", () => {
    const frontmatterYaml = "title:Test Title";
    const schema = {
      title: {
        type: "string",
        description: "Title",
      },
      primitive: "not-an-object",
    };

    const result = extractAccordingToSchema(frontmatterYaml, schema);

    assertEquals(result.title, "Test Title");
    assertEquals(result.primitive, null);
  });
});
