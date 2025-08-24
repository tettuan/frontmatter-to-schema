/**
 * Tests for TypeScript Processing Orchestrator
 * Verifies the new TypeScript implementation replaces Claude -p correctly
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  type ProcessingRequest,
  TypeScriptProcessingOrchestrator,
} from "../../../../src/domain/core/TypeScriptProcessingOrchestrator.ts";

Deno.test("TypeScriptProcessingOrchestrator - Basic frontmatter extraction and schema matching", async () => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  const content = `---
title: "Sample Document"
category: "test"
tags: ["typescript", "testing"]
priority: 1
enabled: true
---

# Sample Content

This is a test document.`;

  const schema = {
    type: "object",
    properties: {
      title: { type: "string", description: "Document title" },
      category: { type: "string", description: "Document category" },
      tags: { type: "array", items: "string", description: "Document tags" },
      priority: { type: "number", description: "Priority level" },
      enabled: { type: "boolean", description: "Whether enabled" },
    },
    required: ["title", "category"],
  };

  const templateContent = `# {title}

Category: {category}
Tags: {tags}
Priority: {priority}
Enabled: {enabled}`;

  const request: ProcessingRequest = {
    content,
    schema,
    templateContent,
    options: {
      verbose: false,
      templateOptions: {
        arrayFormat: "csv",
      },
    },
  };

  const result = await orchestrator.process(request);

  assertEquals(result.ok, true);
  if (result.ok) {
    const data = result.data;

    // Check frontmatter was extracted
    assertExists(data.frontMatterData);
    assertEquals(data.frontMatterData.data.title, "Sample Document");
    assertEquals(data.frontMatterData.data.category, "test");

    // Check schema mapping worked
    assertExists(data.mappedData);
    assertEquals(data.mappedData.matches.length >= 4, true); // Should match most fields

    // Check template processing worked
    assertExists(data.processedTemplate);
    assertEquals(
      data.processedTemplate.content.includes("Sample Document"),
      true,
    );
    assertEquals(data.processedTemplate.content.includes("test"), true);

    // Check no missing required fields
    assertEquals(data.mappedData.missingRequiredKeys.length, 0);
  }
});

Deno.test("TypeScriptProcessingOrchestrator - Complex nested schema matching", async () => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  const content = `---
tools:
  commands:
    - name: "build"
      description: "Build the project"
      options:
        input: "src/"
        output: "dist/"
    - name: "test"  
      description: "Run tests"
      options:
        input: "tests/"
  availableConfigs:
    - "development"
    - "production"
metadata:
  version: "1.0.0"
  author: "Test User"
---

Content here.`;

  const schema = {
    type: "object",
    properties: {
      tools: {
        type: "object",
        properties: {
          commands: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                options: {
                  type: "object",
                  properties: {
                    input: { type: "string" },
                    output: { type: "string" },
                  },
                },
              },
            },
          },
          availableConfigs: {
            type: "array",
            items: "string",
          },
        },
      },
      metadata: {
        type: "object",
        properties: {
          version: { type: "string" },
          author: { type: "string" },
        },
      },
    },
    required: ["tools"],
  };

  const templateContent = `# Project Tools

Commands: {tools.commands[].name}
Available Configs: {tools.availableConfigs}
Version: {metadata.version}
Author: {metadata.author}`;

  const request: ProcessingRequest = {
    content,
    schema,
    templateContent,
    options: {
      verbose: false,
      templateOptions: {
        arrayFormat: "csv",
      },
    },
  };

  const result = await orchestrator.process(request);

  assertEquals(result.ok, true);
  if (result.ok) {
    const data = result.data;

    // Check nested structure was parsed
    assertExists(data.mappedData.schemaCompliantData.tools);
    const tools = data.mappedData.schemaCompliantData.tools as {
      commands: Array<{ name: string }>;
      availableConfigs: string[];
    };
    assertEquals(Array.isArray(tools.commands), true);
    assertEquals(tools.commands.length, 2);
    assertEquals(tools.commands[0].name, "build");

    // Check array configs
    assertEquals(Array.isArray(tools.availableConfigs), true);
    assertEquals(tools.availableConfigs.includes("development"), true);
    assertEquals(tools.availableConfigs.includes("production"), true);
  }
});

Deno.test("TypeScriptProcessingOrchestrator - Schema validation and warnings", async () => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  const content = `---
title: "Test Doc"
unknown_field: "should be ignored"
# missing required category field
---

Content.`;

  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      category: { type: "string" },
    },
    required: ["title", "category"],
  };

  const templateContent = `# {title}
Category: {category}
Unknown: {unknown_field}`;

  const request: ProcessingRequest = {
    content,
    schema,
    templateContent,
  };

  const result = await orchestrator.process(request);

  assertEquals(result.ok, true);
  if (result.ok) {
    const data = result.data;

    // Should have warnings about missing required field
    assertEquals(data.warnings.length > 0, true);

    const hasRequiredWarning = data.warnings.some((w) =>
      w.includes("Missing required") && w.includes("category")
    );
    assertEquals(hasRequiredWarning, true);

    // Should have warnings about unmatched keys
    const hasUnmatchedWarning = data.warnings.some((w) =>
      w.includes("Unmatched") && w.includes("unknown_field")
    );
    assertEquals(hasUnmatchedWarning, true);
  }
});

Deno.test("TypeScriptProcessingOrchestrator - Template variable extraction", () => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  const templateContent = `# {title}

## Configuration
- Input: {config.input}
- Output: {config.output}  
- Commands: {tools.commands[].name}
- Available: {tools.availableConfigs[0]}

Status: {metadata.enabled}`;

  const result = orchestrator.extractTemplateVariables(templateContent);

  assertEquals(result.ok, true);
  if (result.ok) {
    const variables = result.data;

    assertEquals(variables.includes("title"), true);
    assertEquals(variables.includes("config.input"), true);
    assertEquals(variables.includes("config.output"), true);
    assertEquals(variables.includes("tools.commands[].name"), true);
    assertEquals(variables.includes("tools.availableConfigs[0]"), true);
    assertEquals(variables.includes("metadata.enabled"), true);

    // Should not have duplicates
    const uniqueVariables = [...new Set(variables)];
    assertEquals(variables.length, uniqueVariables.length);
  }
});

Deno.test("TypeScriptProcessingOrchestrator - Schema expansion", () => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  const schema = {
    type: "object",
    properties: {
      title: { type: "string", description: "Document title" },
      metadata: {
        type: "object",
        properties: {
          version: { type: "string" },
          tags: { type: "array", items: "string" },
        },
      },
      commands: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            options: {
              type: "object",
              properties: {
                input: { type: "string" },
              },
            },
          },
        },
      },
    },
    required: ["title"],
  };

  const result = orchestrator.expandSchema(schema);

  assertEquals(result.ok, true);
  if (result.ok) {
    const properties = result.data;

    // Should have flattened all nested properties
    const paths = properties.map((p) => p.path);
    assertEquals(paths.includes("title"), true);
    assertEquals(paths.includes("metadata.version"), true);
    assertEquals(paths.includes("metadata.tags[]"), true);
    assertEquals(paths.includes("commands[]"), true);

    // Check required field marking
    const titleProp = properties.find((p) => p.path === "title");
    assertEquals(titleProp?.required, true);

    const versionProp = properties.find((p) => p.path === "metadata.version");
    assertEquals(versionProp?.required, false);
  }
});

Deno.test("TypeScriptProcessingOrchestrator - Error handling", () => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  // Test with invalid content
  const invalidRequest: ProcessingRequest = {
    content: "", // Empty content
    schema: {},
    templateContent: "test",
  };

  const validationResult = orchestrator.validateRequest(invalidRequest);
  assertEquals(validationResult.ok, false);

  // Test with invalid schema
  const invalidSchemaRequest: ProcessingRequest = {
    content: "---\ntitle: test\n---\ncontent",
    schema: null as unknown as Record<string, unknown>, // Invalid schema
    templateContent: "test",
  };

  const schemaValidationResult = orchestrator.validateRequest(
    invalidSchemaRequest,
  );
  assertEquals(schemaValidationResult.ok, false);
});
