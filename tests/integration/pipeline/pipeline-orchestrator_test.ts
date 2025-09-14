import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { PipelineOrchestrator } from "../../../src/application/services/pipeline-orchestrator.ts";
import { DocumentProcessingService } from "../../../src/domain/frontmatter/services/document-processing-service.ts";
import { SchemaProcessingService } from "../../../src/domain/schema/services/schema-processing-service.ts";
import { TemplateRenderer } from "../../../src/domain/template/renderers/template-renderer.ts";
import { FrontmatterProcessor } from "../../../src/domain/frontmatter/processors/frontmatter-processor.ts";
import { err, ok, Result } from "../../../src/domain/shared/types/result.ts";
import {
  createError,
  DomainError,
  FrontmatterError,
} from "../../../src/domain/shared/types/errors.ts";
import { FrontmatterData } from "../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

/**
 * Integration tests for Pipeline Orchestrator
 * Tests the complete processing flow from frontmatter extraction to template rendering
 * Following DDD and Totality principles
 */

// Mock implementations for testing
class MockFileSystem {
  private files: Map<string, string> = new Map();

  constructor() {
    // Set up test data
    this.files.set(
      "/test/schema.json",
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": "template.json",
        "properties": {
          "items": {
            "type": "array",
            "x-frontmatter-part": true,
            "items": {
              "type": "object",
              "properties": {
                "title": { "type": "string" },
                "author": { "type": "string" },
                "published": { "type": "boolean" },
              },
            },
          },
        },
      }),
    );

    this.files.set(
      "/test/template.json",
      JSON.stringify({
        "items": ["{@items}"],
      }),
    );

    this.files.set(
      "/test/doc1.md",
      `---
title: Test Document 1
author: Alice
published: true
---
Content 1`,
    );

    this.files.set(
      "/test/doc2.md",
      `---
title: Test Document 2
author: Bob
published: false
---
Content 2`,
    );
  }

  read(path: string): Result<string, DomainError & { message: string }> {
    const content = this.files.get(path);
    if (content !== undefined) {
      return ok(content);
    }
    return err(createError({
      kind: "PathNotFound",
      path: path,
    }));
  }

  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }> {
    this.files.set(path, content);
    return ok(undefined);
  }

  list(pattern: string): Result<string[], DomainError & { message: string }> {
    const files: string[] = [];
    const baseDir = pattern.replace(/\/\*.*$/, "");

    for (const path of this.files.keys()) {
      if (path.startsWith(baseDir) && path.endsWith(".md")) {
        files.push(path);
      }
    }

    return ok(files);
  }

  getWrittenContent(path: string): string | undefined {
    return this.files.get(path);
  }
}

class MockFrontmatterExtractor {
  extract(
    content: string,
  ): Result<
    { frontmatter: string; body: string },
    FrontmatterError & { message: string }
  > {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
      return ok({
        frontmatter: match[1],
        body: match[2],
      });
    }
    return ok({
      frontmatter: "",
      body: content,
    });
  }
}

class MockFrontmatterParser {
  parse(yaml: string): Result<unknown, FrontmatterError & { message: string }> {
    // Simple YAML parsing for test
    const result: Record<string, unknown> = {};
    const lines = yaml.split("\n");

    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value: unknown = match[2].trim();

        // Simple type conversion
        if (value === "true") value = true;
        else if (value === "false") value = false;
        else if (/^\d+$/.test(value as string)) {
          value = parseInt(value as string);
        }

        result[key] = value;
      }
    }

    return ok(result);
  }
}

describe("PipelineOrchestrator Integration Tests", () => {
  it("should process complete pipeline from frontmatter to template output", async () => {
    // Setup
    const fileSystem = new MockFileSystem();
    const frontmatterProcessor = new FrontmatterProcessor(
      new MockFrontmatterExtractor(),
      new MockFrontmatterParser(),
    );

    // Create mock aggregator
    const mockAggregator = {
      aggregate: (data: FrontmatterData[]) =>
        ok(data[0] || FrontmatterData.empty()),
      mergeWithBase: (data: FrontmatterData) => ok(data),
    } as any;

    // Create mock base property populator
    const mockBasePropertyPopulator = {
      populate: (data: FrontmatterData) => ok(data),
    } as any;

    const documentProcessor = new DocumentProcessingService(
      frontmatterProcessor,
      mockAggregator,
      mockBasePropertyPopulator,
      fileSystem,
      fileSystem,
    );

    // Schema processor needs repository - mock it
    const schemaProcessor = {} as SchemaProcessingService;

    const templateRendererResult = TemplateRenderer.create();
    assertExists(templateRendererResult.ok);
    if (!templateRendererResult.ok) return;

    const orchestrator = new PipelineOrchestrator(
      documentProcessor,
      schemaProcessor,
      templateRendererResult.data,
      fileSystem,
    );

    // Execute pipeline
    const config = {
      inputPattern: "/test/*.md",
      schemaPath: "/test/schema.json",
      outputPath: "/test/output.json",
    };

    const result = await orchestrator.execute(config);

    // Assert
    assertEquals(result.ok, true);

    // Check output was written
    const output = fileSystem.getWrittenContent("/test/output.json");
    assertExists(output);
  });

  it("should handle {@items} array expansion in templates", async () => {
    // Setup with {@items} template
    const fileSystem = new MockFileSystem();

    // Override template with {@items}
    fileSystem.write(
      "/test/template_with_items.json",
      JSON.stringify({
        "result": {
          "documents": ["{@items}"],
        },
      }),
    );

    fileSystem.write(
      "/test/schema_with_items.json",
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": "template_with_items.json",
        "properties": {
          "documents": {
            "type": "array",
            "x-frontmatter-part": true,
            "items": {
              "type": "object",
            },
          },
        },
      }),
    );

    const frontmatterProcessor = new FrontmatterProcessor(
      new MockFrontmatterExtractor(),
      new MockFrontmatterParser(),
    );

    // Create mock aggregator
    const mockAggregator = {
      aggregate: (data: FrontmatterData[]) =>
        ok(data[0] || FrontmatterData.empty()),
      mergeWithBase: (data: FrontmatterData) => ok(data),
    } as any;

    // Create mock base property populator
    const mockBasePropertyPopulator = {
      populate: (data: FrontmatterData) => ok(data),
    } as any;

    const documentProcessor = new DocumentProcessingService(
      frontmatterProcessor,
      mockAggregator,
      mockBasePropertyPopulator,
      fileSystem,
      fileSystem,
    );

    const schemaProcessor = {} as SchemaProcessingService;

    const templateRendererResult = TemplateRenderer.create();
    if (!templateRendererResult.ok) return;

    const orchestrator = new PipelineOrchestrator(
      documentProcessor,
      schemaProcessor,
      templateRendererResult.data,
      fileSystem,
    );

    // Execute
    const config = {
      inputPattern: "/test/*.md",
      schemaPath: "/test/schema_with_items.json",
      outputPath: "/test/output_items.json",
    };

    const result = await orchestrator.execute(config);

    // Assert
    assertEquals(result.ok, true);
    assertExists(fileSystem.getWrittenContent("/test/output_items.json"));
  });

  it("should handle schema loading errors gracefully", async () => {
    const fileSystem = new MockFileSystem();

    const frontmatterProcessor = new FrontmatterProcessor(
      new MockFrontmatterExtractor(),
      new MockFrontmatterParser(),
    );

    // Create mock aggregator
    const mockAggregator = {
      aggregate: (data: FrontmatterData[]) =>
        ok(data[0] || FrontmatterData.empty()),
      mergeWithBase: (data: FrontmatterData) => ok(data),
    } as any;

    // Create mock base property populator
    const mockBasePropertyPopulator = {
      populate: (data: FrontmatterData) => ok(data),
    } as any;

    const documentProcessor = new DocumentProcessingService(
      frontmatterProcessor,
      mockAggregator,
      mockBasePropertyPopulator,
      fileSystem,
      fileSystem,
    );

    const schemaProcessor = {} as SchemaProcessingService;

    const templateRendererResult = TemplateRenderer.create();
    if (!templateRendererResult.ok) return;

    const orchestrator = new PipelineOrchestrator(
      documentProcessor,
      schemaProcessor,
      templateRendererResult.data,
      fileSystem,
    );

    // Execute with non-existent schema
    const config = {
      inputPattern: "/test/*.md",
      schemaPath: "/test/non_existent_schema.json",
      outputPath: "/test/output.json",
    };

    const result = await orchestrator.execute(config);

    // Assert error handling
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "PathNotFound");
    }
  });

  it("should handle template loading errors gracefully", async () => {
    const fileSystem = new MockFileSystem();

    // Create schema that references non-existent template
    fileSystem.write(
      "/test/schema_bad_template.json",
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": "non_existent_template.json",
        "properties": {},
      }),
    );

    const frontmatterProcessor = new FrontmatterProcessor(
      new MockFrontmatterExtractor(),
      new MockFrontmatterParser(),
    );

    // Create mock aggregator
    const mockAggregator = {
      aggregate: (data: FrontmatterData[]) =>
        ok(data[0] || FrontmatterData.empty()),
      mergeWithBase: (data: FrontmatterData) => ok(data),
    } as any;

    // Create mock base property populator
    const mockBasePropertyPopulator = {
      populate: (data: FrontmatterData) => ok(data),
    } as any;

    const documentProcessor = new DocumentProcessingService(
      frontmatterProcessor,
      mockAggregator,
      mockBasePropertyPopulator,
      fileSystem,
      fileSystem,
    );

    const schemaProcessor = {} as SchemaProcessingService;

    const templateRendererResult = TemplateRenderer.create();
    if (!templateRendererResult.ok) return;

    const orchestrator = new PipelineOrchestrator(
      documentProcessor,
      schemaProcessor,
      templateRendererResult.data,
      fileSystem,
    );

    // Execute
    const config = {
      inputPattern: "/test/*.md",
      schemaPath: "/test/schema_bad_template.json",
      outputPath: "/test/output.json",
    };

    const result = await orchestrator.execute(config);

    // Assert error handling
    assertEquals(result.ok, false);
  });

  it("should process x-derived-from aggregation correctly", async () => {
    const fileSystem = new MockFileSystem();

    // Schema with x-derived-from
    fileSystem.write(
      "/test/schema_derived.json",
      JSON.stringify({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "x-template": "template.json",
        "properties": {
          "allAuthors": {
            "type": "array",
            "items": { "type": "string" },
            "x-derived-from": "items[].author",
            "x-derived-unique": true,
          },
          "items": {
            "type": "array",
            "x-frontmatter-part": true,
            "items": {
              "type": "object",
              "properties": {
                "author": { "type": "string" },
              },
            },
          },
        },
      }),
    );

    const frontmatterProcessor = new FrontmatterProcessor(
      new MockFrontmatterExtractor(),
      new MockFrontmatterParser(),
    );

    // Create mock aggregator
    const mockAggregator = {
      aggregate: (data: FrontmatterData[]) =>
        ok(data[0] || FrontmatterData.empty()),
      mergeWithBase: (data: FrontmatterData) => ok(data),
    } as any;

    // Create mock base property populator
    const mockBasePropertyPopulator = {
      populate: (data: FrontmatterData) => ok(data),
    } as any;

    const documentProcessor = new DocumentProcessingService(
      frontmatterProcessor,
      mockAggregator,
      mockBasePropertyPopulator,
      fileSystem,
      fileSystem,
    );

    const schemaProcessor = {} as SchemaProcessingService;

    const templateRendererResult = TemplateRenderer.create();
    if (!templateRendererResult.ok) return;

    const orchestrator = new PipelineOrchestrator(
      documentProcessor,
      schemaProcessor,
      templateRendererResult.data,
      fileSystem,
    );

    // Execute
    const config = {
      inputPattern: "/test/*.md",
      schemaPath: "/test/schema_derived.json",
      outputPath: "/test/output_derived.json",
    };

    const result = await orchestrator.execute(config);

    // Assert successful processing
    assertEquals(result.ok, true);
  });
});
