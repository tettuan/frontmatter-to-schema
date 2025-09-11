import { assertEquals, assertExists } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import { exists } from "jsr:@std/fs";
import { DocumentProcessor } from "../../src/application/document-processor.ts";
import { DenoFileSystemProvider } from "../../src/application/climpt/climpt-adapter.ts";
import { FrontMatterExtractorImpl } from "../../src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import { SchemaValidator } from "../../src/domain/services/schema-validator.ts";
import { UnifiedTemplateProcessor } from "../../src/domain/template/services/unified-template-processor.ts";
import type { ApplicationConfiguration } from "../../src/application/value-objects/configuration-types.value-object.ts";
import {
  OutputFormat,
  SchemaFormat,
  TemplateFormat,
} from "../../src/application/value-objects/configuration-formats.value-object.ts";

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

// Create test fixtures directory
const TEST_DIR = await Deno.makeTempDir({ prefix: "e2e-workflow-" });
const FIXTURES_DIR = join(TEST_DIR, "fixtures");
const OUTPUT_DIR = join(TEST_DIR, "output");

// Cleanup function
const cleanup = async () => {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
};

// Setup test fixtures
const setup = async () => {
  await Deno.mkdir(FIXTURES_DIR, { recursive: true });
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  // Create test markdown files
  await Deno.writeTextFile(
    join(FIXTURES_DIR, "article1.md"),
    `---
title: "Test Article 1"
author: "John Doe"
tags: ["test", "e2e"]
date: "2024-01-01"
status: "published"
---

# Test Article 1

This is a test article for E2E testing.
`,
  );

  await Deno.writeTextFile(
    join(FIXTURES_DIR, "article2.md"),
    `---
title: "Test Article 2"
author: "Jane Smith"
tags: ["testing", "workflow"]
date: "2024-01-02"
status: "draft"
---

# Test Article 2

Another test article with different metadata.
`,
  );

  // Create schema file
  await Deno.writeTextFile(
    join(FIXTURES_DIR, "schema.json"),
    JSON.stringify(
      {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "author": { "type": "string" },
          "tags": {
            "type": "array",
            "items": { "type": "string" },
            "x-frontmatter-part": true,
          },
          "date": { "type": "string", "format": "date" },
          "status": {
            "type": "string",
            "enum": ["draft", "published", "archived"],
          },
        },
        "required": ["title", "author", "status"],
      },
      null,
      2,
    ),
  );

  // Create template file
  await Deno.writeTextFile(
    join(FIXTURES_DIR, "template.json"),
    JSON.stringify(
      {
        "articles": "{{articles}}",
        "metadata": {
          "total": "{{total}}",
          "generated": "{{generated_at}}",
        },
      },
      null,
      2,
    ),
  );
};

Deno.test({
  name: "E2E: Complete Workflow - Markdown → Schema → Template → Output",
}, async (t) => {
  await setup();

  try {
    await t.step(
      "should process single markdown file with schema validation",
      async () => {
        const fileSystem = new DenoFileSystemProvider();
        const frontMatterExtractor = new FrontMatterExtractorImpl();
        const schemaValidator = new SchemaValidator();
        const templateProcessorResult = UnifiedTemplateProcessor.create();

        assertExists(templateProcessorResult);
        assertEquals("kind" in templateProcessorResult, false);

        const templateProcessor =
          templateProcessorResult as UnifiedTemplateProcessor;

        const processor = new DocumentProcessor(
          fileSystem,
          frontMatterExtractor,
          schemaValidator,
          templateProcessor,
        );

        const config: ApplicationConfiguration = {
          input: {
            kind: "FileInput",
            path: join(FIXTURES_DIR, "article1.md"),
          },
          schema: {
            definition: JSON.parse(
              await Deno.readTextFile(
                join(FIXTURES_DIR, "schema.json"),
              ),
            ),
            format: createSchemaFormat("json"),
          },
          template: {
            definition: await Deno.readTextFile(
              join(FIXTURES_DIR, "template.json"),
            ),
            format: createTemplateFormat("json"),
          },
          output: {
            path: join(OUTPUT_DIR, "single-output.json"),
            format: createOutputFormat("json"),
          },
          processing: {
            kind: "BasicProcessing",
          },
        };

        const result = await processor.processDocuments(config);
        assertEquals(result.ok, true);

        if (result.ok) {
          assertEquals(result.data.getSuccessCount(), 1);
          assertEquals(result.data.getErrorCount(), 0);
        }

        // Verify output file exists
        const outputExists = await exists(
          join(OUTPUT_DIR, "single-output.json"),
        );
        assertEquals(outputExists, true);
      },
    );

    await t.step(
      "should process multiple markdown files in batch",
      async () => {
        const fileSystem = new DenoFileSystemProvider();
        const frontMatterExtractor = new FrontMatterExtractorImpl();
        const schemaValidator = new SchemaValidator();
        const templateProcessorResult = UnifiedTemplateProcessor.create();

        const templateProcessor =
          templateProcessorResult as UnifiedTemplateProcessor;

        const processor = new DocumentProcessor(
          fileSystem,
          frontMatterExtractor,
          schemaValidator,
          templateProcessor,
        );

        const config: ApplicationConfiguration = {
          input: {
            kind: "DirectoryInput",
            path: FIXTURES_DIR,
            pattern: "\\.md$",
          },
          schema: {
            definition: JSON.parse(
              await Deno.readTextFile(
                join(FIXTURES_DIR, "schema.json"),
              ),
            ),
            format: createSchemaFormat("json"),
          },
          template: {
            definition: await Deno.readTextFile(
              join(FIXTURES_DIR, "template.json"),
            ),
            format: createTemplateFormat("json"),
          },
          output: {
            path: join(OUTPUT_DIR, "batch-output.json"),
            format: createOutputFormat("json"),
          },
          processing: {
            kind: "BasicProcessing",
          },
        };

        const result = await processor.processDocuments(config);
        assertEquals(result.ok, true);

        if (result.ok) {
          assertEquals(result.data.getSuccessCount(), 2);
          assertEquals(result.data.getErrorCount(), 0);
        }

        // Verify output file exists
        const outputExists = await exists(
          join(OUTPUT_DIR, "batch-output.json"),
        );
        assertEquals(outputExists, true);
      },
    );

    await t.step("should generate YAML output format", async () => {
      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();

      const templateProcessor =
        templateProcessorResult as UnifiedTemplateProcessor;

      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor,
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "article1.md"),
        },
        schema: {
          definition: JSON.parse(
            await Deno.readTextFile(
              join(FIXTURES_DIR, "schema.json"),
            ),
          ),
          format: createSchemaFormat("json"),
        },
        template: {
          definition: await Deno.readTextFile(
            join(FIXTURES_DIR, "template.json"),
          ),
          format: createTemplateFormat("json"),
        },
        output: {
          path: join(OUTPUT_DIR, "yaml-output.yaml"),
          format: createOutputFormat("yaml"),
        },
        processing: {
          kind: "BasicProcessing",
        },
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, true);

      // Verify YAML output file exists
      const outputExists = await exists(join(OUTPUT_DIR, "yaml-output.yaml"));
      assertEquals(outputExists, true);
    });

    await t.step("should handle x-template dynamic selection", async () => {
      // Create schema with x-template
      const schemaWithXTemplate = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": join(FIXTURES_DIR, "template.json"),
        "properties": {
          "title": { "type": "string" },
          "author": { "type": "string" },
        },
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "schema-x-template.json"),
        JSON.stringify(schemaWithXTemplate, null, 2),
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();

      const templateProcessor =
        templateProcessorResult as UnifiedTemplateProcessor;

      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor,
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "article1.md"),
        },
        schema: {
          definition: JSON.parse(
            await Deno.readTextFile(
              join(FIXTURES_DIR, "schema-x-template.json"),
            ),
          ),
          format: createSchemaFormat("json"),
        },
        template: {
          definition: await Deno.readTextFile(
            join(FIXTURES_DIR, "template.json"),
          ),
          format: createTemplateFormat("json"),
        },
        output: {
          path: join(OUTPUT_DIR, "x-template-output.json"),
          format: createOutputFormat("json"),
        },
        processing: {
          kind: "BasicProcessing",
        },
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, true);
    });

    await t.step("should handle complex nested schema with $ref", async () => {
      // Create complex schema with $ref
      const complexSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "definitions": {
          "tag": {
            "type": "string",
            "minLength": 1,
            "maxLength": 20,
          },
        },
        "properties": {
          "title": { "type": "string" },
          "tags": {
            "type": "array",
            "items": { "$ref": "#/definitions/tag" },
          },
          "metadata": {
            "type": "object",
            "properties": {
              "author": { "type": "string" },
              "date": { "type": "string", "format": "date" },
            },
          },
        },
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "complex-schema.json"),
        JSON.stringify(complexSchema, null, 2),
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();

      const templateProcessor =
        templateProcessorResult as UnifiedTemplateProcessor;

      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor,
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "FileInput",
          path: join(FIXTURES_DIR, "article1.md"),
        },
        schema: {
          definition: JSON.parse(
            await Deno.readTextFile(
              join(FIXTURES_DIR, "complex-schema.json"),
            ),
          ),
          format: createSchemaFormat("json"),
        },
        template: {
          definition: await Deno.readTextFile(
            join(FIXTURES_DIR, "template.json"),
          ),
          format: createTemplateFormat("json"),
        },
        output: {
          path: join(OUTPUT_DIR, "complex-schema-output.json"),
          format: createOutputFormat("json"),
        },
        processing: {
          kind: "BasicProcessing",
        },
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, true);
    });
  } finally {
    await cleanup();
  }
});

Deno.test({
  name: "E2E: x-* Feature Integration with Real Data",
}, async (t) => {
  await setup();

  try {
    await t.step("should process x-derived-from aggregation", async () => {
      // Create schema with x-derived-from
      const derivedSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "allTags": {
            "type": "array",
            "x-derived-from": "tags",
            "items": { "type": "string" },
          },
          "title": { "type": "string" },
          "tags": {
            "type": "array",
            "items": { "type": "string" },
          },
        },
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "derived-schema.json"),
        JSON.stringify(derivedSchema, null, 2),
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();

      const templateProcessor =
        templateProcessorResult as UnifiedTemplateProcessor;

      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor,
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "DirectoryInput",
          path: FIXTURES_DIR,
          pattern: "\\.md$",
        },
        schema: {
          definition: JSON.parse(
            await Deno.readTextFile(
              join(FIXTURES_DIR, "derived-schema.json"),
            ),
          ),
          format: createSchemaFormat("json"),
        },
        template: {
          definition: '{ "tags": {{allTags}} }',
          format: createTemplateFormat("json"),
        },
        output: {
          path: join(OUTPUT_DIR, "derived-output.json"),
          format: createOutputFormat("json"),
        },
        processing: {
          kind: "BasicProcessing",
        },
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, true);
    });

    await t.step("should process x-derived-unique deduplication", async () => {
      // Create schema with x-derived-unique
      const uniqueSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
          "uniqueAuthors": {
            "type": "array",
            "x-derived-from": "author",
            "x-derived-unique": true,
            "items": { "type": "string" },
          },
          "author": { "type": "string" },
        },
      };

      await Deno.writeTextFile(
        join(FIXTURES_DIR, "unique-schema.json"),
        JSON.stringify(uniqueSchema, null, 2),
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();

      const templateProcessor =
        templateProcessorResult as UnifiedTemplateProcessor;

      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor,
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "DirectoryInput",
          path: FIXTURES_DIR,
          pattern: "\\.md$",
        },
        schema: {
          definition: JSON.parse(
            await Deno.readTextFile(
              join(FIXTURES_DIR, "unique-schema.json"),
            ),
          ),
          format: createSchemaFormat("json"),
        },
        template: {
          definition: '{ "authors": {{uniqueAuthors}} }',
          format: createTemplateFormat("json"),
        },
        output: {
          path: join(OUTPUT_DIR, "unique-output.json"),
          format: createOutputFormat("json"),
        },
        processing: {
          kind: "BasicProcessing",
        },
      };

      const result = await processor.processDocuments(config);
      assertEquals(result.ok, true);
    });

    await t.step(
      "should process x-frontmatter-part array transformation",
      async () => {
        // Create schema with x-frontmatter-part
        const partSchema = {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": {
            "categories": {
              "type": "array",
              "x-frontmatter-part": true,
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "count": { "type": "number" },
                },
              },
            },
          },
        };

        // Create markdown with array data
        await Deno.writeTextFile(
          join(FIXTURES_DIR, "array-data.md"),
          `---
categories:
  - name: "Tech"
    count: 5
  - name: "Science"
    count: 3
---

# Array Data Test
`,
        );

        await Deno.writeTextFile(
          join(FIXTURES_DIR, "part-schema.json"),
          JSON.stringify(partSchema, null, 2),
        );

        const fileSystem = new DenoFileSystemProvider();
        const frontMatterExtractor = new FrontMatterExtractorImpl();
        const schemaValidator = new SchemaValidator();
        const templateProcessorResult = UnifiedTemplateProcessor.create();

        const templateProcessor =
          templateProcessorResult as UnifiedTemplateProcessor;

        const processor = new DocumentProcessor(
          fileSystem,
          frontMatterExtractor,
          schemaValidator,
          templateProcessor,
        );

        const config: ApplicationConfiguration = {
          input: {
            kind: "FileInput",
            path: join(FIXTURES_DIR, "array-data.md"),
          },
          schema: {
            definition: JSON.parse(
              await Deno.readTextFile(
                join(FIXTURES_DIR, "part-schema.json"),
              ),
            ),
            format: createSchemaFormat("json"),
          },
          template: {
            definition: '{ "categories": {{categories}} }',
            format: createTemplateFormat("json"),
          },
          output: {
            path: join(OUTPUT_DIR, "part-output.json"),
            format: createOutputFormat("json"),
          },
          processing: {
            kind: "BasicProcessing",
          },
        };

        const result = await processor.processDocuments(config);
        assertEquals(result.ok, true);
      },
    );
  } finally {
    await cleanup();
  }
});

Deno.test({
  name: "E2E: Performance with Large Dataset",
}, async (t) => {
  const LARGE_TEST_DIR = await Deno.makeTempDir({ prefix: "e2e-perf-" });
  const LARGE_FIXTURES_DIR = join(LARGE_TEST_DIR, "fixtures");
  const LARGE_OUTPUT_DIR = join(LARGE_TEST_DIR, "output");

  await Deno.mkdir(LARGE_FIXTURES_DIR, { recursive: true });
  await Deno.mkdir(LARGE_OUTPUT_DIR, { recursive: true });

  try {
    await t.step("should handle 100+ markdown files efficiently", async () => {
      // Create 100 test markdown files
      for (let i = 1; i <= 100; i++) {
        await Deno.writeTextFile(
          join(LARGE_FIXTURES_DIR, `article${i}.md`),
          `---
title: "Article ${i}"
author: "Author ${i % 10}"
tags: ["tag${i % 5}", "category${i % 3}"]
date: "2024-01-${String(i % 28 + 1).padStart(2, "0")}"
status: ${i % 3 === 0 ? '"published"' : '"draft"'}
---

# Article ${i}

Content for article ${i}.
`,
        );
      }

      // Create schema
      await Deno.writeTextFile(
        join(LARGE_FIXTURES_DIR, "schema.json"),
        JSON.stringify(
          {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "author": { "type": "string" },
              "tags": {
                "type": "array",
                "items": { "type": "string" },
              },
            },
          },
          null,
          2,
        ),
      );

      const fileSystem = new DenoFileSystemProvider();
      const frontMatterExtractor = new FrontMatterExtractorImpl();
      const schemaValidator = new SchemaValidator();
      const templateProcessorResult = UnifiedTemplateProcessor.create();

      const templateProcessor =
        templateProcessorResult as UnifiedTemplateProcessor;

      const processor = new DocumentProcessor(
        fileSystem,
        frontMatterExtractor,
        schemaValidator,
        templateProcessor,
      );

      const config: ApplicationConfiguration = {
        input: {
          kind: "DirectoryInput",
          path: LARGE_FIXTURES_DIR,
          pattern: "\\.md$",
        },
        schema: {
          definition: JSON.parse(
            await Deno.readTextFile(
              join(LARGE_FIXTURES_DIR, "schema.json"),
            ),
          ),
          format: createSchemaFormat("json"),
        },
        template: {
          definition: '{ "articles": {{articles}}, "total": {{total}} }',
          format: createTemplateFormat("json"),
        },
        output: {
          path: join(LARGE_OUTPUT_DIR, "large-batch-output.json"),
          format: createOutputFormat("json"),
        },
        processing: {
          kind: "BasicProcessing",
        },
      };

      const startTime = performance.now();
      const result = await processor.processDocuments(config);
      const endTime = performance.now();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getSuccessCount(), 100);
        assertEquals(result.data.getErrorCount(), 0);

        // Performance assertion: should process 100 files in under 5 seconds
        const duration = endTime - startTime;
        assertEquals(
          duration < 5000,
          true,
          `Processing took ${duration}ms, expected < 5000ms`,
        );
      }
    });
  } finally {
    await Deno.remove(LARGE_TEST_DIR, { recursive: true }).catch(() => {});
  }
});
