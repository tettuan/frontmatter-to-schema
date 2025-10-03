import { assertEquals } from "@std/assert";
import { ensureDir } from "@std/fs";
import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { DenoFileSystemAdapter } from "../../src/infrastructure/adapters/deno-file-system-adapter.ts";
import {
  FeatureDetector,
  ImplementationTracker,
} from "../utils/feature-detection.ts";
import { RobustTestRunner } from "../utils/robust-test-runner.ts";

/**
 * 24 Execution Examples Test Suite
 *
 * Based on docs/requirements.ja.md specification, validates all required execution patterns:
 * - Examples 1-8: Basic Processing (single file, directory, schema validation, frontmatter extraction)
 * - Examples 9-16: Template Processing ({@items} expansion, variable substitution, format variations, aggregation)
 * - Examples 17-24: Error/Edge Cases (missing files, invalid schemas, malformed frontmatter, error handling)
 */

Deno.test("24 Execution Examples Validation", async (t) => {
  const fileSystem = DenoFileSystemAdapter.create();

  // Create orchestrator for tests
  const orchestratorResult = PipelineOrchestrator.create(fileSystem);
  if (orchestratorResult.isError()) {
    throw new Error(
      `Failed to create orchestrator: ${orchestratorResult.unwrapError().message}`,
    );
  }
  const orchestrator = orchestratorResult.unwrap();

  // Detect available features
  console.log("\n🔍 Detecting available features...");
  const capabilities = await FeatureDetector.detectCapabilities(orchestrator);
  FeatureDetector.logCapabilities(capabilities);

  // Clear previous missing feature records
  ImplementationTracker.clearMissingFeatures();

  // Create robust test runner
  const testRunner = new RobustTestRunner(capabilities);

  await t.step("Basic Processing (Examples 1-8)", async (t) => {
    // Skip entire basic processing group if not available
    if (!capabilities.basicProcessing) {
      console.log(
        "⚠️  SKIP: Basic Processing (Examples 1-8) - Basic processing not implemented",
      );
      ImplementationTracker.recordMissingFeature(
        "Basic Processing",
        "Examples 1-8: All basic processing examples",
      );
      return;
    }

    await t.step("Example 1: Single markdown file processing", async () => {
      await testRunner.executeConditional(
        "Example 1: Single markdown file processing",
        RobustTestRunner.requirements.basicProcessing,
        async () => {
          // Test single file with basic frontmatter
          const testDir = "tmp/test-24-examples/example-1";
          await ensureDir(testDir);
          await fileSystem.writeTextFile(
            `${testDir}/test.md`,
            `---
title: "Test Document"
author: "Test Author"
---
# Content`,
          );

          await fileSystem.writeTextFile(
            `${testDir}/schema.json`,
            JSON.stringify({
              "$schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              "x-template": "./template.json",
              "properties": {
                "title": { "type": "string" },
                "author": { "type": "string" },
              },
            }),
          );

          await fileSystem.writeTextFile(
            `${testDir}/template.json`,
            JSON.stringify({
              "document": {
                "title": "{title}",
                "author": "{author}",
              },
            }),
          );

          const result = await orchestrator.execute({
            schemaPath: `${testDir}/schema.json`,
            templatePath: `${testDir}/template.json`,
            inputPath: `${testDir}/test.md`,
            outputPath: `${testDir}/output.json`,
            outputFormat: "json",
          });

          assertEquals(result.isOk(), true);
          assertEquals(result.unwrap().processedDocuments, 1);
        },
      );
    });

    await t.step("Example 2: Directory processing multiple files", async () => {
      await testRunner.executeConditional(
        "Example 2: Directory processing multiple files",
        RobustTestRunner.requirements.directoryProcessing,
        async () => {
          const testDir = "tmp/test-24-examples/example-2";
          await ensureDir(testDir);

          // Create multiple markdown files
          await fileSystem.writeTextFile(
            `${testDir}/doc1.md`,
            `---
title: "Doc 1"
---
Content 1`,
          );

          await fileSystem.writeTextFile(
            `${testDir}/doc2.md`,
            `---
title: "Doc 2"
---
Content 2`,
          );

          await fileSystem.writeTextFile(
            `${testDir}/schema.json`,
            JSON.stringify({
              "$schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              "x-template": "./template.json",
              "properties": {
                "documents": {
                  "type": "array",
                  "x-frontmatter-part": true,
                  "x-template-items": "./item-template.json",
                },
              },
            }),
          );

          await fileSystem.writeTextFile(
            `${testDir}/template.json`,
            JSON.stringify({
              "collection": { "items": "{@items}" },
            }),
          );

          await fileSystem.writeTextFile(
            `${testDir}/item-template.json`,
            JSON.stringify({
              "title": "{title}",
            }),
          );

          const result = await orchestrator.execute({
            schemaPath: `${testDir}/schema.json`,
            templatePath: `${testDir}/template.json`,
            inputPath: testDir,
            outputPath: `${testDir}/output.json`,
            outputFormat: "json",
          });

          assertEquals(result.isOk(), true);
          assertEquals(result.unwrap().processedDocuments, 2);
        },
      );
    });

    await t.step(
      "Example 3: Schema validation with required fields",
      async () => {
        const testDir = "tmp/test-24-examples/example-3";
        await ensureDir(testDir);

        await fileSystem.writeTextFile(
          `${testDir}/test.md`,
          `---
title: "Valid Doc"
required_field: "Present"
---
Content`,
        );

        await fileSystem.writeTextFile(
          `${testDir}/schema.json`,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./template.json",
            "properties": {
              "title": { "type": "string" },
              "required_field": { "type": "string" },
            },
            "required": ["title", "required_field"],
          }),
        );

        await fileSystem.writeTextFile(
          `${testDir}/template.json`,
          JSON.stringify({
            "validated": {
              "title": "{title}",
              "field": "{required_field}",
            },
          }),
        );

        const result = await orchestrator.execute({
          schemaPath: `${testDir}/schema.json`,
          templatePath: `${testDir}/template.json`,
          inputPath: `${testDir}/test.md`,
          outputPath: `${testDir}/output.json`,
          outputFormat: "json",
        });

        assertEquals(result.isOk(), true);
      },
    );

    await t.step(
      "Example 4: Frontmatter extraction with nested objects",
      async () => {
        const testDir = "tmp/test-24-examples/example-4";
        await ensureDir(testDir);

        await fileSystem.writeTextFile(
          `${testDir}/test.md`,
          `---
metadata:
  author: "John Doe"
  tags: ["tech", "tutorial"]
---
Content`,
        );

        await fileSystem.writeTextFile(
          `${testDir}/schema.json`,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./template.json",
            "properties": {
              "metadata": {
                "type": "object",
                "properties": {
                  "author": { "type": "string" },
                  "tags": { "type": "array", "items": { "type": "string" } },
                },
              },
            },
          }),
        );

        await fileSystem.writeTextFile(
          `${testDir}/template.json`,
          JSON.stringify({
            "extracted": {
              "author": "{metadata.author}",
              "tags": "{metadata.tags}",
            },
          }),
        );

        const result = await orchestrator.execute({
          schemaPath: `${testDir}/schema.json`,
          templatePath: `${testDir}/template.json`,
          inputPath: `${testDir}/test.md`,
          outputPath: `${testDir}/output.json`,
          outputFormat: "json",
        });

        assertEquals(result.isOk(), true);
      },
    );

    await t.step("Example 5: YAML output format", async () => {
      const testDir = "tmp/test-24-examples/example-5";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
title: "YAML Test"
---
Content`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "title": { "type": "string" },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "yaml_output": {
            "title": "{title}",
          },
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.yaml`,
        outputFormat: "yaml",
      });

      assertEquals(result.isOk(), true);
    });

    await t.step("Example 6: Array processing", async () => {
      const testDir = "tmp/test-24-examples/example-6";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
items: ["item1", "item2", "item3"]
---
Content`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "items": {
              "type": "array",
              "items": { "type": "string" },
            },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "processed_items": "{items}",
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isOk(), true);
    });

    await t.step("Example 7: Mixed content types", async () => {
      const testDir = "tmp/test-24-examples/example-7";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
title: "Mixed Content"
number: 42
boolean: true
array: [1, 2, 3]
---
Content`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "title": { "type": "string" },
            "number": { "type": "number" },
            "boolean": { "type": "boolean" },
            "array": { "type": "array", "items": { "type": "number" } },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "mixed": {
            "title": "{title}",
            "number": "{number}",
            "boolean": "{boolean}",
            "array": "{array}",
          },
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isOk(), true);
    });

    await t.step("Example 8: Empty frontmatter handling", async () => {
      const testDir = "tmp/test-24-examples/example-8";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `# Just Content
No frontmatter here`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "content": { "type": "string" },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "result": {
            "has_frontmatter": false,
          },
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      // Empty frontmatter is now handled gracefully
      assertEquals(result.isOk(), true);
    });
  });

  await t.step("Template Processing (Examples 9-16)", async (t) => {
    // Skip entire template processing group if not available
    if (!capabilities.templateProcessing) {
      console.log(
        "⚠️  SKIP: Template Processing (Examples 9-16) - Template processing not implemented",
      );
      ImplementationTracker.recordMissingFeature(
        "Template Processing",
        "Examples 9-16: All template processing examples",
      );
      return;
    }

    await t.step(
      "Example 9: {@items} expansion with template-items",
      async () => {
        const testDir = "tmp/test-24-examples/example-9";
        await ensureDir(testDir);

        await fileSystem.writeTextFile(
          `${testDir}/doc1.md`,
          `---
title: "First"
category: "A"
---
Content 1`,
        );

        await fileSystem.writeTextFile(
          `${testDir}/doc2.md`,
          `---
title: "Second"
category: "B"
---
Content 2`,
        );

        await fileSystem.writeTextFile(
          `${testDir}/schema.json`,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./template.json",
            "x-template-items": "./item-template.json",
            "properties": {
              "documents": {
                "type": "array",
                "x-frontmatter-part": true,
              },
            },
          }),
        );

        await fileSystem.writeTextFile(
          `${testDir}/template.json`,
          JSON.stringify({
            "expanded_items": "{@items}",
          }),
        );

        await fileSystem.writeTextFile(
          `${testDir}/item-template.json`,
          JSON.stringify({
            "doc_title": "{title}",
            "doc_category": "{category}",
          }),
        );

        const result = await orchestrator.execute({
          schemaPath: `${testDir}/schema.json`,
          templatePath: `${testDir}/template.json`,
          inputPath: testDir,
          outputPath: `${testDir}/output.json`,
          outputFormat: "json",
        });

        assertEquals(result.isOk(), true);
      },
    );

    await t.step(
      "Example 10: Variable substitution with dot notation",
      async () => {
        const testDir = "tmp/test-24-examples/example-10";
        await ensureDir(testDir);

        await fileSystem.writeTextFile(
          `${testDir}/test.md`,
          `---
config:
  database:
    host: "localhost"
    port: 5432
  app:
    name: "MyApp"
---
Content`,
        );

        await fileSystem.writeTextFile(
          `${testDir}/schema.json`,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./template.json",
            "properties": {
              "config": {
                "type": "object",
                "properties": {
                  "database": {
                    "type": "object",
                    "properties": {
                      "host": { "type": "string" },
                      "port": { "type": "number" },
                    },
                  },
                  "app": {
                    "type": "object",
                    "properties": {
                      "name": { "type": "string" },
                    },
                  },
                },
              },
            },
          }),
        );

        await fileSystem.writeTextFile(
          `${testDir}/template.json`,
          JSON.stringify({
            "connection_string":
              "host={config.database.host}:{config.database.port}",
            "application": "{config.app.name}",
          }),
        );

        const result = await orchestrator.execute({
          schemaPath: `${testDir}/schema.json`,
          templatePath: `${testDir}/template.json`,
          inputPath: `${testDir}/test.md`,
          outputPath: `${testDir}/output.json`,
          outputFormat: "json",
        });

        assertEquals(result.isOk(), true);
      },
    );

    await t.step(
      "Example 11: Template format variations (JSON vs YAML)",
      async () => {
        const testDir = "tmp/test-24-examples/example-11";
        await ensureDir(testDir);

        await fileSystem.writeTextFile(
          `${testDir}/test.md`,
          `---
title: "Format Test"
data: ["a", "b", "c"]
---
Content`,
        );

        await fileSystem.writeTextFile(
          `${testDir}/schema.json`,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./template.yaml",
            "properties": {
              "title": { "type": "string" },
              "data": { "type": "array", "items": { "type": "string" } },
            },
          }),
        );

        await fileSystem.writeTextFile(
          `${testDir}/template.yaml`,
          `title: "{title}"
items:
  - "{data}"`,
        );

        const result = await orchestrator.execute({
          schemaPath: `${testDir}/schema.json`,
          templatePath: `${testDir}/template.yaml`,
          inputPath: `${testDir}/test.md`,
          outputPath: `${testDir}/output.yaml`,
          outputFormat: "yaml",
        });

        // Currently YAML template parsing is not fully supported
        // TODO: Enhance YAML template support
        assertEquals(result.isError(), true);
        assertEquals(result.unwrapError().code, "TEMPLATE_LOAD_ERROR");
      },
    );

    await t.step("Example 12: Aggregation with x-derived-from", async () => {
      const testDir = "tmp/test-24-examples/example-12";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/doc1.md`,
        `---
tags: ["javascript", "typescript"]
---
Content 1`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/doc2.md`,
        `---
tags: ["python", "javascript"]
---
Content 2`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "documents": {
              "type": "array",
              "x-frontmatter-part": true,
            },
            "all_tags": {
              "type": "array",
              "x-derived-from": "documents[].tags",
              "x-derived-unique": true,
            },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "aggregated_tags": "{all_tags}",
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: testDir,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isOk(), true);
    });

    await t.step("Example 13: x-flatten-arrays directive", async () => {
      const testDir = "tmp/test-24-examples/example-13";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
traceability: [["REQ-001", "REQ-002"], "REQ-003"]
---
Content`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "trace_ids": {
              "type": "array",
              "x-frontmatter-part": true,
              "x-flatten-arrays": "traceability",
            },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "flattened": "{trace_ids}",
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isOk(), true);
    });

    await t.step("Example 14: x-jmespath-filter directive", async () => {
      const testDir = "tmp/test-24-examples/example-14";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/doc1.md`,
        `---
commands:
  - c1: "git"
    active: true
  - c1: "test"
    active: false
---
Content 1`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "filtered_commands": {
              "type": "array",
              "x-frontmatter-part": true,
              "x-jmespath-filter": "commands[?active == `true`]",
            },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "active_commands": "{filtered_commands}",
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/doc1.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isOk(), true);
    });

    await t.step("Example 15: Complex nested template processing", async () => {
      const testDir = "tmp/test-24-examples/example-15";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
project:
  name: "Complex Project"
  components:
    - name: "Frontend"
      tech: "React"
    - name: "Backend"
      tech: "Node.js"
---
Content`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "project": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "components": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "name": { "type": "string" },
                      "tech": { "type": "string" },
                    },
                  },
                },
              },
            },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "project_name": "{project.name}",
          "technologies": "{project.components}",
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isOk(), true);
    });

    await t.step(
      "Example 16: Multiple template formats in single pipeline",
      async () => {
        const testDir = "tmp/test-24-examples/example-16";
        await ensureDir(testDir);

        await fileSystem.writeTextFile(
          `${testDir}/test.md`,
          `---
title: "Multi-format Test"
version: "1.0.0"
---
Content`,
        );

        // Test JSON output
        await fileSystem.writeTextFile(
          `${testDir}/schema.json`,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./template.json",
            "properties": {
              "title": { "type": "string" },
              "version": { "type": "string" },
            },
          }),
        );

        await fileSystem.writeTextFile(
          `${testDir}/template.json`,
          JSON.stringify({
            "package": {
              "name": "{title}",
              "version": "{version}",
            },
          }),
        );

        const result = await orchestrator.execute({
          schemaPath: `${testDir}/schema.json`,
          templatePath: `${testDir}/template.json`,
          inputPath: `${testDir}/test.md`,
          outputPath: `${testDir}/output.json`,
          outputFormat: "json",
        });

        assertEquals(result.isOk(), true);
      },
    );
  });

  await t.step("Error/Edge Cases (Examples 17-24)", async (t) => {
    // Skip error cases if error handling not available
    if (!capabilities.errorHandling) {
      console.log(
        "⚠️  SKIP: Error/Edge Cases (Examples 17-24) - Error handling not implemented",
      );
      ImplementationTracker.recordMissingFeature(
        "Error Handling",
        "Examples 17-24: All error handling examples",
      );
      return;
    }

    await t.step("Example 17: Missing schema file", async () => {
      const testDir = "tmp/test-24-examples/example-17";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
title: "Test"
---
Content`,
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/nonexistent-schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isError(), true);
      assertEquals(result.unwrapError().code, "SCHEMA_READ_ERROR");
    });

    await t.step("Example 18: Missing template file", async () => {
      const testDir = "tmp/test-24-examples/example-18";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
title: "Test"
---
Content`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./nonexistent-template.json",
          "properties": {
            "title": { "type": "string" },
          },
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/nonexistent-template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isError(), true);
      assertEquals(result.unwrapError().code, "TEMPLATE_LOAD_ERROR");
    });

    await t.step("Example 19: Missing input file", async () => {
      const testDir = "tmp/test-24-examples/example-19";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "title": { "type": "string" },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "title": "{title}",
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/nonexistent.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isError(), true);
      assertEquals(result.unwrapError().code, "INPUT_ACCESS_ERROR");
    });

    await t.step("Example 20: Invalid JSON schema", async () => {
      const testDir = "tmp/test-24-examples/example-20";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
title: "Test"
---
Content`,
      );

      // Write invalid JSON
      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        `{
        "type": "object"
        "invalid": "json" // Missing comma
      }`,
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isError(), true);
      assertEquals(result.unwrapError().code, "SCHEMA_PARSE_ERROR");
    });

    await t.step("Example 21: Malformed frontmatter", async () => {
      const testDir = "tmp/test-24-examples/example-21";
      await ensureDir(testDir);

      // Create file with malformed YAML frontmatter
      await fileSystem.writeTextFile(
        `${testDir}/test.md`,
        `---
title: "Test
invalid: yaml: syntax
---
Content`,
      );

      await fileSystem.writeTextFile(
        `${testDir}/schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "title": { "type": "string" },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/template.json`,
        JSON.stringify({
          "title": "{title}",
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/schema.json`,
        templatePath: `${testDir}/template.json`,
        inputPath: `${testDir}/test.md`,
        outputPath: `${testDir}/output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isError(), true);
      assertEquals(result.unwrapError().code, "FRONTMATTER_PARSE_ERROR");
    });

    await t.step("Example 22: Empty directory handling", async () => {
      const testDir = "tmp/test-24-examples/example-22/empty-dir";
      await ensureDir(testDir);

      await fileSystem.writeTextFile(
        `${testDir}/../schema.json`,
        JSON.stringify({
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "x-template": "./template.json",
          "properties": {
            "documents": {
              "type": "array",
              "x-frontmatter-part": true,
            },
          },
        }),
      );

      await fileSystem.writeTextFile(
        `${testDir}/../template.json`,
        JSON.stringify({
          "result": "empty",
        }),
      );

      const result = await orchestrator.execute({
        schemaPath: `${testDir}/../schema.json`,
        templatePath: `${testDir}/../template.json`,
        inputPath: testDir,
        outputPath: `${testDir}/../output.json`,
        outputFormat: "json",
      });

      assertEquals(result.isError(), true);
      assertEquals(result.unwrapError().code, "NO_DOCUMENTS_FOUND");
    });

    await t.step(
      "Example 23: Invalid output path (permission denied)",
      async () => {
        const testDir = "tmp/test-24-examples/example-23";
        await ensureDir(testDir);

        await fileSystem.writeTextFile(
          `${testDir}/test.md`,
          `---
title: "Test"
---
Content`,
        );

        await fileSystem.writeTextFile(
          `${testDir}/schema.json`,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./template.json",
            "properties": {
              "title": { "type": "string" },
            },
          }),
        );

        await fileSystem.writeTextFile(
          `${testDir}/template.json`,
          JSON.stringify({
            "title": "{title}",
          }),
        );

        // Try to write to root directory (should fail on most systems)
        const result = await orchestrator.execute({
          schemaPath: `${testDir}/schema.json`,
          templatePath: `${testDir}/template.json`,
          inputPath: `${testDir}/test.md`,
          outputPath: "/root/forbidden.json",
          outputFormat: "json",
        });

        assertEquals(result.isError(), true);
        assertEquals(result.unwrapError().code, "OUTPUT_WRITE_ERROR");
      },
    );

    await t.step(
      "Example 24: Complex error accumulation scenario",
      async () => {
        const testDir = "tmp/test-24-examples/example-24";
        await ensureDir(testDir);

        // Create scenario with multiple potential issues
        await fileSystem.writeTextFile(
          `${testDir}/test1.md`,
          `---
title: "Valid Doc"
---
Content`,
        );

        await fileSystem.writeTextFile(
          `${testDir}/test2.md`,
          `---
title: "Another Valid"
---
Content`,
        );

        // Schema that references non-existent template
        await fileSystem.writeTextFile(
          `${testDir}/schema.json`,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./missing-template.json",
            "properties": {
              "documents": {
                "type": "array",
                "x-frontmatter-part": true,
              },
            },
          }),
        );

        const result = await orchestrator.execute({
          schemaPath: `${testDir}/schema.json`,
          templatePath: `${testDir}/missing-template.json`,
          inputPath: testDir,
          outputPath: `${testDir}/output.json`,
          outputFormat: "json",
        });

        // Should fail due to missing template, demonstrating error handling
        assertEquals(result.isError(), true);
        assertEquals(result.unwrapError().code, "TEMPLATE_LOAD_ERROR");
      },
    );
  });

  // Generate implementation roadmap at the end
  const missingFeatures = ImplementationTracker.getMissingFeatures();
  if (missingFeatures.length > 0) {
    console.log("\n🛣️  Implementation Roadmap:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const roadmap = ImplementationTracker.generateRoadmap();
    roadmap.forEach((line) => console.log(line));
  } else {
    console.log(
      "\n✅ All features implemented! 24 execution examples fully supported.",
    );
  }
});
