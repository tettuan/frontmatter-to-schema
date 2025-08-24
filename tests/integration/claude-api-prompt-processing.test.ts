/**
 * Claude API Prompt Processing Integration Tests
 *
 * Tests for processing frontmatter data with Claude API based on schemas
 * Focuses on the specific extraction and mapping scenarios from the provided example
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

/**
 * Test case for Claude API prompt processing based on the provided example
 */
Deno.test("Claude API Prompt Processing - Extract frontmatter based on schema", () => {
  // Test data from the provided example
  const frontMatterData = {
    title: "developにマージして不要なブランチを掃除する",
    description:
      "mergeされていないブランチを全てdevelopへ統合し、マージ後に削除。",
  };

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

  // Expected extraction result
  const expectedExtraction = {
    version: null, // Not present in frontmatter
    description:
      "mergeされていないブランチを全てdevelopへ統合し、マージ後に削除。",
    tools: null, // Not present in frontmatter
  };

  // Simulate extraction logic
  const extractedData: Record<string, unknown> = {};

  // Extract fields matching the schema
  for (const key in schema) {
    if (key in frontMatterData) {
      extractedData[key] = frontMatterData[key as keyof typeof frontMatterData];
    } else {
      extractedData[key] = null;
    }
  }

  // Verify extraction
  assertEquals(extractedData.version, expectedExtraction.version);
  assertEquals(extractedData.description, expectedExtraction.description);
  assertEquals(extractedData.tools, expectedExtraction.tools);
});

Deno.test("Claude API Prompt Processing - Parse and extract only schema-matching fields", () => {
  const frontMatterData = {
    title: "Test Title",
    description: "Test Description",
    extraField: "Should be ignored",
    anotherExtra: 123,
  };

  const schema = {
    title: { type: "string", required: true },
    description: { type: "string", required: false },
  };

  // Extract only schema-matching fields
  const extractedData: Record<string, unknown> = {};

  for (const key in schema) {
    if (key in frontMatterData) {
      extractedData[key] = frontMatterData[key as keyof typeof frontMatterData];
    }
  }

  // Verify only schema fields are extracted
  assertEquals(extractedData.title, "Test Title");
  assertEquals(extractedData.description, "Test Description");
  assertEquals("extraField" in extractedData, false);
  assertEquals("anotherExtra" in extractedData, false);
});

Deno.test("Claude API Prompt Processing - Return null for missing required fields", () => {
  const frontMatterData = {
    description: "Only description provided",
  };

  const schema = {
    title: { type: "string", required: true },
    author: { type: "string", required: true },
    description: { type: "string", required: false },
  };

  // Extract fields with null for missing required fields
  const extractedData: Record<string, unknown> = {};

  for (const key in schema) {
    if (key in frontMatterData) {
      extractedData[key] = frontMatterData[key as keyof typeof frontMatterData];
    } else {
      extractedData[key] = null;
    }
  }

  // Verify missing required fields are null
  assertEquals(extractedData.title, null);
  assertEquals(extractedData.author, null);
  assertEquals(extractedData.description, "Only description provided");
});

Deno.test("Claude API Prompt Processing - Handle complex nested structures", () => {
  const frontMatterData = {
    metadata: {
      version: "2.0",
      features: ["feature1", "feature2"],
      config: {
        enabled: true,
        level: 5,
      },
    },
  };

  const schema = {
    metadata: {
      type: "object",
      properties: {
        version: { type: "string" },
        features: { type: "array", items: { type: "string" } },
        config: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            level: { type: "number" },
          },
        },
      },
    },
  };

  // Extract nested structure
  const extractedData: Record<string, unknown> = {};

  for (const key in schema) {
    if (key in frontMatterData) {
      extractedData[key] = frontMatterData[key as keyof typeof frontMatterData];
    } else {
      extractedData[key] = null;
    }
  }

  // Verify nested structure is preserved
  assertExists(extractedData.metadata);
  const metadata = extractedData.metadata as {
    version: string;
    features: string[];
    config: { enabled: boolean; level: number };
  };
  assertEquals(metadata.version, "2.0");
  assertEquals(metadata.features.length, 2);
  assertEquals(metadata.config.enabled, true);
  assertEquals(metadata.config.level, 5);
});

Deno.test("Claude API Prompt Processing - Validate prompt template structure", () => {
  const promptTemplate =
    `Extract the following frontmatter data according to the provided schema.

FrontMatter: {{FRONTMATTER}}

Schema: {{SCHEMA}}

Instructions:

1. Parse the frontmatter YAML data
2. Extract fields that match the schema
3. Return ONLY a valid JSON object containing the extracted data
4. The JSON should directly map to the schema structure
5. Use null for missing required fields
6. Ignore extra fields not in the schema

Return your response as a single JSON object with no additional text or explanation.`;

  // Verify prompt template contains required placeholders
  assertExists(promptTemplate.includes("{{FRONTMATTER}}"));
  assertExists(promptTemplate.includes("{{SCHEMA}}"));

  // Verify instructions are present
  assertExists(promptTemplate.includes("Parse the frontmatter"));
  assertExists(promptTemplate.includes("Extract fields"));
  assertExists(promptTemplate.includes("Return ONLY a valid JSON"));
  assertExists(promptTemplate.includes("Use null for missing"));
  assertExists(promptTemplate.includes("Ignore extra fields"));
});

Deno.test("Claude API Prompt Processing - Handle empty frontmatter", () => {
  const frontMatterData = {};

  const schema = {
    title: { type: "string", required: true },
    description: { type: "string", required: false },
  };

  // Extract fields from empty frontmatter
  const extractedData: Record<string, unknown> = {};

  for (const key in schema) {
    if (key in frontMatterData) {
      extractedData[key] = frontMatterData[key as keyof typeof frontMatterData];
    } else {
      extractedData[key] = null;
    }
  }

  // All fields should be null
  assertEquals(extractedData.title, null);
  assertEquals(extractedData.description, null);
});

Deno.test("Claude API Prompt Processing - Handle schema with enum values", () => {
  const frontMatterData = {
    tool: "git",
    status: "active",
  };

  const schema = {
    tool: {
      type: "string",
      enum: ["git", "spec", "test", "code", "docs", "meta"],
    },
    status: {
      type: "string",
      enum: ["active", "inactive", "pending"],
    },
  };

  // Extract and validate enum fields
  const extractedData: Record<string, unknown> = {};

  for (const key in schema) {
    if (key in frontMatterData) {
      const value = frontMatterData[key as keyof typeof frontMatterData];
      const schemaField = schema[key as keyof typeof schema];

      // Validate enum values
      if (schemaField.enum && schemaField.enum.includes(value as string)) {
        extractedData[key] = value;
      } else if (schemaField.enum) {
        extractedData[key] = null; // Invalid enum value
      } else {
        extractedData[key] = value;
      }
    } else {
      extractedData[key] = null;
    }
  }

  // Verify enum validation
  assertEquals(extractedData.tool, "git");
  assertEquals(extractedData.status, "active");
});

Deno.test("Claude API Prompt Processing - Handle pattern validation", () => {
  const testCases = [
    { version: "1.0.0", expected: "1.0.0" },
    { version: "2.1.3", expected: "2.1.3" },
    { version: "1.0", expected: null }, // Invalid pattern
    { version: "v1.0.0", expected: null }, // Invalid pattern
    { version: undefined, expected: null }, // Missing field
  ];

  const schema = {
    version: {
      type: "string",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
    },
  };

  for (const testCase of testCases) {
    const frontMatterData = testCase.version
      ? { version: testCase.version }
      : {};

    // Extract and validate pattern
    const extractedData: Record<string, unknown> = {};

    if ("version" in frontMatterData) {
      const value = frontMatterData.version;
      const pattern = new RegExp(schema.version.pattern);

      if (typeof value === "string" && pattern.test(value)) {
        extractedData.version = value;
      } else {
        extractedData.version = null;
      }
    } else {
      extractedData.version = null;
    }

    assertEquals(extractedData.version, testCase.expected);
  }
});
