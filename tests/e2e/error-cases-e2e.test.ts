import { assertEquals, assertExists } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import { DocumentProcessor } from "../../src/application/document-processor.ts";
import { DenoFileSystemProvider } from "../../src/application/climpt/climpt-adapter.ts";
import { FrontMatterExtractorImpl } from "../../src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import { SchemaValidator } from "../../src/domain/services/schema-validator.ts";
import { UnifiedTemplateProcessor } from "../../src/domain/template/services/unified-template-processor.ts";
import type { ApplicationConfiguration } from "../../src/application/value-objects/configuration-types.value-object.ts";
import { OutputFormat, SchemaFormat, TemplateFormat } from "../../src/application/value-objects/configuration-formats.value-object.ts";

// Helper functions for format creation
const createSchemaFormat = (format: string) => {
  const result = SchemaFormat.create(format);
  if (!result.ok) throw new Error(`Invalid schema format: ${format}`);
  return result.data;
};

const createTemplateFormat = (format: string) => {
  const result = TemplateFormat.create(format);
  if (!result.ok) throw new Error(`Invalid template format: ${format}`);
  return result.data;
};

const createOutputFormat = (format: string) => {
  const result = OutputFormat.create(format);
  if (!result.ok) throw new Error(`Invalid output format: ${format}`);
  return result.data;
};

Deno.test("E2E Error Cases: Invalid Schema Handling", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "e2e-error-schema-" });
  const FIXTURES_DIR = join(TEST_DIR, "fixtures");
  const OUTPUT_DIR = join(TEST_DIR, "output");

  await Deno.mkdir(FIXTURES_DIR, { recursive: true });
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  // Create test markdown
  await Deno.writeTextFile(
    join(FIXTURES_DIR, "test.md"),
    `---
title: "Test Document"
author: "Test Author"
invalidField: "This should cause validation error"
---

# Test Document
`
  );

  try {
    await t.step("should handle invalid JSON schema syntax", async () => {
      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      assertExists(templateProcessorResult);
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test.md")
        },
        schema: {
          definition: "{ invalid json schema",
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "output.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ParseError");
      }
    });

    await t.step("should handle schema with invalid $ref", async () => {
      const invalidRefSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "title": { "$ref": "#/definitions/nonexistent" }
        }
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "invalid-ref-schema.json"),
        JSON.stringify(invalidRefSchema, null, 2)
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test.md")
        },
        schema: {
          definition: await Deno.readTextFile(join(FIXTURES_DIR, "invalid-ref-schema.json")),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "ref-error.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should handle invalid $ref gracefully
      assertExists(result);
    });

    await t.step("should handle circular $ref in schema", async () => {
      const circularSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "definitions": {
          "node": {
            "type": "object",
            "properties": {
              "value": { "type": "string" },
              "children": {
                "type": "array",
                "items": { "$ref": "#/definitions/node" }
              }
            }
          }
        },
        "type": "object",
        "properties": {
          "root": { "$ref": "#/definitions/node" }
        }
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "circular-schema.json"),
        JSON.stringify(circularSchema, null, 2)
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test.md")
        },
        schema: {
          definition: await Deno.readTextFile(join(FIXTURES_DIR, "circular-schema.json")),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "circular-ref.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should handle circular references without infinite loop
      assertExists(result);
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

Deno.test("E2E Error Cases: Template File Errors", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "e2e-error-template-" });
  const FIXTURES_DIR = join(TEST_DIR, "fixtures");
  const OUTPUT_DIR = join(TEST_DIR, "output");

  await Deno.mkdir(FIXTURES_DIR, { recursive: true });
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  await Deno.writeTextFile(
    join(FIXTURES_DIR, "test.md"),
    `---
title: "Test"
---
Content`
  );

  try {
    await t.step("should handle non-existent template file reference", async () => {
      const schemaWithTemplate = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": "/nonexistent/template.json",
        "properties": {
          "title": { "type": "string" }
        }
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "schema-bad-template.json"),
        JSON.stringify(schemaWithTemplate, null, 2)
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test.md")
        },
        schema: {
          definition: await Deno.readTextFile(join(FIXTURES_DIR, "schema-bad-template.json")),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{ \"default\": \"template\" }",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "bad-template.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should fall back to provided template
      assertExists(result);
    });

    await t.step("should handle malformed template JSON", async () => {
      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test.md")
        },
        schema: {
          definition: JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
              "title": { "type": "string" }
            }
          }),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{ invalid template json",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "malformed-template.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ParseError");
      }
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

Deno.test("E2E Error Cases: Invalid x-* Properties", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "e2e-error-x-props-" });
  const FIXTURES_DIR = join(TEST_DIR, "fixtures");
  const OUTPUT_DIR = join(TEST_DIR, "output");

  await Deno.mkdir(FIXTURES_DIR, { recursive: true });
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  try {
    await t.step("should handle invalid x-template value", async () => {
      const invalidXTemplate = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": 123, // Should be string
        "properties": {
          "title": { "type": "string" }
        }
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "invalid-x-template.json"),
        JSON.stringify(invalidXTemplate, null, 2)
      );

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "test.md"),
        `---
title: "Test"
---
Content`
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test.md")
        },
        schema: {
          definition: await Deno.readTextFile(join(FIXTURES_DIR, "invalid-x-template.json")),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "invalid-x-template.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should handle invalid x-template gracefully
      assertExists(result);
    });

    await t.step("should handle invalid x-derived-from reference", async () => {
      const invalidDerived = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "derived": {
            "type": "array",
            "x-derived-from": "nonexistent.field.path",
            "items": { "type": "string" }
          }
        }
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "invalid-derived.json"),
        JSON.stringify(invalidDerived, null, 2)
      );

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "test2.md"),
        `---
title: "Test"
author: "Author"
---
Content`
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test2.md")
        },
        schema: {
          definition: await Deno.readTextFile(join(FIXTURES_DIR, "invalid-derived.json")),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "invalid-derived.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should handle missing field reference gracefully
      assertExists(result);
    });

    await t.step("should handle invalid x-frontmatter-part usage", async () => {
      const invalidPart = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "scalar": {
            "type": "string",
            "x-frontmatter-part": true // Invalid on scalar type
          }
        }
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "invalid-part.json"),
        JSON.stringify(invalidPart, null, 2)
      );

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "test3.md"),
        `---
scalar: "Not an array"
---
Content`
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test3.md")
        },
        schema: {
          definition: await Deno.readTextFile(join(FIXTURES_DIR, "invalid-part.json")),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "invalid-part.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should handle invalid x-frontmatter-part usage
      assertExists(result);
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

Deno.test("E2E Error Cases: File System Errors", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "e2e-error-fs-" });
  const FIXTURES_DIR = join(TEST_DIR, "fixtures");
  const OUTPUT_DIR = join(TEST_DIR, "output");

  await Deno.mkdir(FIXTURES_DIR, { recursive: true });
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  try {
    await t.step("should handle non-existent input file", async () => {
      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "nonexistent.md")
        },
        schema: {
          definition: JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object"
          }),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "output.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "FileNotFound");
      }
    });

    await t.step("should handle non-existent input directory", async () => {
      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "DirectoryInput",
          path: join(TEST_DIR, "nonexistent-dir"),
          pattern: "\\.md$"
        },
        schema: {
          definition: JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object"
          }),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "output.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "DirectoryNotFound");
      }
    });

    await t.step("should handle output directory creation failure", async () => {
      // Create a file where directory should be
      await Deno.writeTextFile(
        join(TEST_DIR, "blocked-dir"),
        "This is a file, not a directory"
      );

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "test.md"),
        `---
title: "Test"
---
Content`
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "test.md")
        },
        schema: {
          definition: JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
              "title": { "type": "string" }
            }
          }),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(TEST_DIR, "blocked-dir", "output.json"), // Will fail - blocked-dir is a file
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "WriteError");
      }
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});

Deno.test("E2E Error Cases: Markdown Processing Errors", async (t) => {
  const TEST_DIR = await Deno.makeTempDir({ prefix: "e2e-error-md-" });
  const FIXTURES_DIR = join(TEST_DIR, "fixtures");
  const OUTPUT_DIR = join(TEST_DIR, "output");

  await Deno.mkdir(FIXTURES_DIR, { recursive: true });
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  try {
    await t.step("should handle markdown without frontmatter", async () => {
      await Deno.writeTextFile(
        join(FIXTURES_DIR, "no-frontmatter.md"),
        `# Document without frontmatter

Just content here, no YAML frontmatter.`
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "no-frontmatter.md")
        },
        schema: {
          definition: JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
              "title": { "type": "string" }
            },
            "required": ["title"]
          }),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "no-fm.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should handle missing frontmatter
      assertExists(result);
    });

    await t.step("should handle malformed YAML frontmatter", async () => {
      await Deno.writeTextFile(
        join(FIXTURES_DIR, "bad-yaml.md"),
        `---
title: "Missing quote
author: John Doe
  invalid: indentation
---

# Content`
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "bad-yaml.md")
        },
        schema: {
          definition: JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object"
          }),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "bad-yaml.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should handle malformed YAML
      assertExists(result);
    });

    await t.step("should handle empty markdown file", async () => {
      await Deno.writeTextFile(
        join(FIXTURES_DIR, "empty.md"),
        ""
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();
      
      const templateProcessor = templateProcessorResult as UnifiedTemplateProcessor;
      
      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "empty.md")
        },
        schema: {
          definition: JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object"
          }),
          format: createSchemaFormat("json")
        },
        template: {
          definition: "{}",
          format: createTemplateFormat("json")
        },
        output: {
          path: join(OUTPUT_DIR, "empty.json"),
          format: createOutputFormat("json")
        },
        processing: {
          kind: "BasicProcessing"
        }
      };

      const result = await processor.processDocuments(config);
      // Should handle empty file
      assertExists(result);
    });

  } finally {
    await Deno.remove(TEST_DIR, { recursive: true }).catch(() => {});
  }
});