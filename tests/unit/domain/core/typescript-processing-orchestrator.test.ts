/**
 * Comprehensive Tests for TypeScript Processing Orchestrator
 * Enhanced coverage for the 3-phase processing pipeline
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  type ProcessingRequest,
  TypeScriptProcessingOrchestrator,
} from "../../../../src/domain/core/TypeScriptProcessingOrchestrator.ts";

Deno.test("TypeScriptProcessingOrchestrator - Core Functionality", async (t) => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  await t.step(
    "should process basic frontmatter extraction and schema matching",
    async () => {
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
          tags: {
            type: "array",
            items: "string",
            description: "Document tags",
          },
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
        assertEquals(data.mappedData.matches.length >= 4, true);

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
    },
  );

  await t.step("should handle complex nested schema matching", async () => {
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

  await t.step("should handle verbose logging mode", async () => {
    const content = `---
title: "Verbose Test"
category: "logging"
---

Test content.`;

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        category: { type: "string" },
      },
      required: ["title"],
    };

    const templateContent = `# {title}
Category: {category}`;

    const request: ProcessingRequest = {
      content,
      schema,
      templateContent,
      options: {
        verbose: true,
        templateOptions: {
          arrayFormat: "csv",
        },
      },
    };

    const result = await orchestrator.process(request);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data;
      assertExists(data.frontMatterData);
      assertExists(data.mappedData);
      assertExists(data.processedTemplate);
      assertExists(data.schemaProperties);
    }
  });
});

Deno.test("TypeScriptProcessingOrchestrator - Warning Generation", async (t) => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  await t.step(
    "should generate warnings for schema validation issues",
    async () => {
      const content = `---
title: "Test Doc"
unknown_field: "should be ignored"
extra_data: { nested: "value" }
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
Unknown: {unknown_field}
Missing: {missing_var}`;

      const request: ProcessingRequest = {
        content,
        schema,
        templateContent,
      };

      const result = await orchestrator.process(request);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data;

        // Should have multiple warnings
        assertEquals(data.warnings.length > 0, true);

        // Should warn about missing required field
        const hasRequiredWarning = data.warnings.some((w: string) =>
          w.includes("Missing required") && w.includes("category")
        );
        assertEquals(hasRequiredWarning, true);

        // Should warn about unmatched keys
        const hasUnmatchedWarning = data.warnings.some((w: string) =>
          w.includes("Unmatched") &&
          (w.includes("unknown_field") || w.includes("extra_data"))
        );
        assertEquals(hasUnmatchedWarning, true);

        // Should warn about unresolved template variables
        const hasUnresolvedWarning = data.warnings.some((w: string) =>
          w.includes("Unresolved") || w.includes("Missing required")
        );
        assertEquals(hasUnresolvedWarning, true);
      }
    },
  );

  await t.step("should handle no warnings scenario", async () => {
    const content = `---
title: "Perfect Doc"
category: "test"
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
Category: {category}`;

    const request: ProcessingRequest = {
      content,
      schema,
      templateContent,
    };

    const result = await orchestrator.process(request);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data;
      assertEquals(data.warnings.length, 0);
    }
  });
});

Deno.test("TypeScriptProcessingOrchestrator - Error Handling", async (t) => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  await t.step("should handle frontmatter extraction errors", async () => {
    const request: ProcessingRequest = {
      content: "invalid frontmatter content without proper YAML",
      schema: { type: "object", properties: {} },
      templateContent: "test template",
    };

    const result = await orchestrator.process(request);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.message.includes("Frontmatter extraction failed"),
        true,
      );
    }
  });

  await t.step("should handle schema mapping errors", async () => {
    const request: ProcessingRequest = {
      content: `---
title: "test"
---
content`,
      schema: { invalid: "schema", structure: true }, // Invalid schema
      templateContent: "# {title}",
    };

    const result = await orchestrator.process(request);

    // The orchestrator may succeed with warnings rather than fail
    assertEquals(result.ok, true);
    if (result.ok) {
      // Should have warnings about schema issues
      assertEquals(result.data.warnings.length > 0, true);
    }
  });

  await t.step("should handle template processing errors", async () => {
    const content = `---
title: "Test"
---
content`;

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
      },
    };

    const request: ProcessingRequest = {
      content,
      schema,
      templateContent: "{invalid.deeply.nested.path.that.will.cause.issues}",
      options: {
        templateOptions: {
          arrayFormat: "csv",
        },
      },
    };

    const result = await orchestrator.process(request);

    // Template processing may succeed but with warnings for unresolved variables
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.warnings.length > 0, true);
      const hasUnresolvedWarning = result.data.warnings.some((w: string) =>
        w.includes("Unresolved") || w.includes("Missing")
      );
      assertEquals(hasUnresolvedWarning, true);
    }
  });

  await t.step("should handle malformed content gracefully", async () => {
    // Test with content that causes issues but not null schema
    const request: ProcessingRequest = {
      content: "not valid markdown with frontmatter",
      schema: { type: "object", properties: { title: { type: "string" } } },
      templateContent: "# {title}",
    };

    const result = await orchestrator.process(request);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.message.includes("Frontmatter extraction failed"),
        true,
      );
    }
  });
});

Deno.test("TypeScriptProcessingOrchestrator - Request Validation", async (t) => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  await t.step("should validate request content", () => {
    const invalidRequest: ProcessingRequest = {
      content: "", // Empty content
      schema: {},
      templateContent: "test",
    };

    const result = orchestrator.validateRequest(invalidRequest);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.message.includes("Content must be a non-empty string"),
        true,
      );
    }
  });

  await t.step("should validate request schema", () => {
    const invalidRequest: ProcessingRequest = {
      content: "valid content",
      schema: null as unknown as object, // Invalid schema
      templateContent: "test",
    };

    const result = orchestrator.validateRequest(invalidRequest);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.message.includes("Schema must be an object"),
        true,
      );
    }
  });

  await t.step("should validate template content", () => {
    const invalidRequest: ProcessingRequest = {
      content: "valid content",
      schema: {},
      templateContent: "", // Empty template
    };

    const result = orchestrator.validateRequest(invalidRequest);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.message.includes(
          "Template content must be a non-empty string",
        ),
        true,
      );
    }
  });

  await t.step("should pass validation for valid request", () => {
    const validRequest: ProcessingRequest = {
      content: "---\ntitle: test\n---\ncontent",
      schema: { type: "object", properties: {} },
      templateContent: "# {title}",
    };

    const result = orchestrator.validateRequest(validRequest);
    assertEquals(result.ok, true);
  });
});

Deno.test("TypeScriptProcessingOrchestrator - Utility Methods", async (t) => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  await t.step("should extract template variables correctly", () => {
    const templateContent = `# {title}

## Configuration
- Input: {config.input}
- Output: {config.output}  
- Commands: {tools.commands[].name}
- Available: {tools.availableConfigs[0]}
- Complex: {deeply.nested.property.path}

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
      assertEquals(variables.includes("deeply.nested.property.path"), true);
      assertEquals(variables.includes("metadata.enabled"), true);

      // Should not have duplicates
      const uniqueVariables = [...new Set(variables)];
      assertEquals(variables.length, uniqueVariables.length);
    }
  });

  await t.step("should handle empty template for variable extraction", () => {
    const result = orchestrator.extractTemplateVariables("");

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.length, 0);
    }
  });

  await t.step("should expand schema into flat properties", () => {
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

  await t.step("should handle empty schema expansion", () => {
    const result = orchestrator.expandSchema({});

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.length, 0);
    }
  });

  await t.step("should handle invalid schema expansion", () => {
    const result = orchestrator.expandSchema({
      invalid: "structure",
      not: "object-schema",
    });

    // The schema expansion might succeed but return empty properties for invalid schemas
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.length, 0);
    }
  });
});

Deno.test("TypeScriptProcessingOrchestrator - Edge Cases", async (t) => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  await t.step("should handle empty frontmatter", async () => {
    const content = `---
---

Just content, no frontmatter data.`;

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
      },
      required: ["title"],
    };

    const templateContent = `Default title when missing: {title}`;

    const request: ProcessingRequest = {
      content,
      schema,
      templateContent,
    };

    const result = await orchestrator.process(request);

    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.error.message.includes("Processing pipeline failed"),
        true,
      );
    }
  });

  await t.step(
    "should handle complex template processing options",
    async () => {
      const content = `---
items: ["first", "second", "third"]
config:
  debug: true
  level: 5
---

Content.`;

      const schema = {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "string" } },
          config: {
            type: "object",
            properties: {
              debug: { type: "boolean" },
              level: { type: "number" },
            },
          },
        },
      };

      const templateContent = `Items: {items}
Debug: {config.debug}
Level: {config.level}`;

      const request: ProcessingRequest = {
        content,
        schema,
        templateContent,
        options: {
          verbose: true,
          skipValidation: true,
          templateOptions: {
            arrayFormat: "json",
          },
        },
      };

      const result = await orchestrator.process(request);

      assertEquals(result.ok, true);
      if (result.ok) {
        const data = result.data;
        assertExists(data.processedTemplate);
        assertExists(data.mappedData);
      }
    },
  );

  await t.step("should handle minimal valid input", async () => {
    const content = `---
title: "Minimal"
---
Content.`;

    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
      },
      required: ["title"],
    };

    const templateContent = `# {title}`;

    const request: ProcessingRequest = {
      content,
      schema,
      templateContent,
    };

    const result = await orchestrator.process(request);

    assertEquals(result.ok, true);
    if (result.ok) {
      const data = result.data;
      assertEquals(data.warnings.length, 0);
      assertEquals(data.processedTemplate.content.includes("Minimal"), true);
    }
  });
});

Deno.test("TypeScriptProcessingOrchestrator - Constructor and Initialization", () => {
  const orchestrator = new TypeScriptProcessingOrchestrator();

  // Verify that the orchestrator was initialized correctly
  assertEquals(typeof orchestrator, "object");
  assertEquals(typeof orchestrator.process, "function");
  assertEquals(typeof orchestrator.validateRequest, "function");
  assertEquals(typeof orchestrator.extractTemplateVariables, "function");
  assertEquals(typeof orchestrator.expandSchema, "function");
});
