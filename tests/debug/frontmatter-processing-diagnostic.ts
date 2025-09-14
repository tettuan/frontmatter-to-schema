/**
 * Diagnostic test for frontmatter processing pipeline
 * To understand where the aggregation breaks down
 */

// import { assertEquals } from "@std/assert"; // Not needed for diagnostic
import { ProcessCoordinator } from "../../src/application/coordinators/process-coordinator.ts";
import {
  DenoFileLister,
  DenoFileReader,
  DenoFileWriter,
  FileSystemSchemaRepository,
  JsonFrontmatterParser,
  YamlFrontmatterExtractor,
} from "../../src/infrastructure/index.ts";
import { FrontmatterProcessor } from "../../src/domain/frontmatter/processors/frontmatter-processor.ts";
import { TemplateRenderer } from "../../src/domain/template/renderers/template-renderer.ts";
import { Aggregator } from "../../src/domain/aggregation/aggregators/aggregator.ts";

Deno.test({
  name: "DIAGNOSTIC - Frontmatter Processing Pipeline",
  fn: async () => {
    // Setup basic infrastructure manually to get detailed logging
    const fileReader = new DenoFileReader();
    const fileWriter = new DenoFileWriter();
    const fileLister = new DenoFileLister();
    const schemaRepository = new FileSystemSchemaRepository();

    const frontmatterExtractor = new YamlFrontmatterExtractor();
    const frontmatterParser = new JsonFrontmatterParser();
    const frontmatterProcessor = new FrontmatterProcessor(
      frontmatterExtractor,
      frontmatterParser,
    );

    const templateRendererResult = TemplateRenderer.create();
    if (!templateRendererResult.ok) {
      throw new Error(
        `Failed to create TemplateRenderer: ${templateRendererResult.error.message}`,
      );
    }
    const templateRenderer = templateRendererResult.data;
    const aggregator = new Aggregator();

    // Create test directory
    await Deno.mkdir("./tmp/debug-frontmatter", { recursive: true });

    // Test schema with frontmatter-part
    const testSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "x-template": "./test-template.json",
      "type": "object",
      "properties": {
        "version": {
          "type": "string",
          "x-base-property": true,
          "x-default-value": "1.0.0",
        },
        "commands": {
          "type": "array",
          "x-frontmatter-part": true, // This should trigger frontmatter aggregation
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "description": { "type": "string" },
            },
          },
        },
      },
    };

    const testTemplate = {
      "version": "{version}",
      "commands": "{commands}",
      "totalCommands": "{commands.length}",
    };

    const testMarkdown = `---
name: TestCommand
description: Test command description
---

# Test Content`;

    try {
      // Setup files
      await Deno.writeTextFile(
        "./tmp/debug-frontmatter/schema.json",
        JSON.stringify(testSchema, null, 2),
      );
      await Deno.writeTextFile(
        "./tmp/debug-frontmatter/test-template.json",
        JSON.stringify(testTemplate, null, 2),
      );
      await Deno.writeTextFile(
        "./tmp/debug-frontmatter/test.md",
        testMarkdown,
      );

      console.log("\n=== DIAGNOSTIC: Schema Analysis ===");

      // Load and analyze schema
      const schemaLoadResult = schemaRepository.load({
        toString: () => "./tmp/debug-frontmatter/schema.json",
      } as any);

      if (schemaLoadResult.ok) {
        const schema = schemaLoadResult.data;
        console.log("Schema loaded successfully");

        // Check frontmatter-part schema
        const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
        console.log(
          "Frontmatter part schema:",
          frontmatterPartSchemaResult.ok ? "FOUND" : "NOT FOUND",
        );

        if (frontmatterPartSchemaResult.ok) {
          console.log(
            "Frontmatter part details:",
            JSON.stringify(frontmatterPartSchemaResult.data, null, 2),
          );
        }

        // Check validation rules
        const validationRules = schema.getValidationRules();
        console.log(
          "Validation rules:",
          validationRules ? "found" : "not found",
        );

        // Check derived rules
        const derivedRules = schema.getDerivedRules();
        console.log("Derived rules count:", derivedRules.length);
        console.log("Derived rules:", derivedRules);
      } else {
        console.log("Schema load failed:", schemaLoadResult.error);
      }

      console.log("\n=== DIAGNOSTIC: Manual Frontmatter Processing ===");

      // Test frontmatter processing manually
      const contentResult = fileReader.read("./tmp/debug-frontmatter/test.md");
      if (contentResult.ok) {
        console.log("File content loaded");

        const extractResult = frontmatterExtractor.extract(contentResult.data);
        if (extractResult.ok) {
          console.log("Frontmatter extracted:", extractResult.data.frontmatter);

          const parseResult = frontmatterParser.parse(
            extractResult.data.frontmatter,
          );
          if (parseResult.ok) {
            console.log("Frontmatter parsed:", parseResult.data);
          } else {
            console.log("Parse failed:", parseResult.error);
          }
        } else {
          console.log("Extract failed:", extractResult.error);
        }
      }

      console.log("\n=== DIAGNOSTIC: ProcessCoordinator Test ===");

      const coordinator = new ProcessCoordinator(
        schemaRepository,
        frontmatterProcessor,
        templateRenderer,
        aggregator,
        fileReader,
        fileWriter,
        fileLister,
      );

      const result = coordinator.processDocuments(
        "./tmp/debug-frontmatter/schema.json",
        "./tmp/debug-frontmatter/output.json",
        "./tmp/debug-frontmatter/**/*.md",
      );

      if (result.ok) {
        const output = await Deno.readTextFile(
          "./tmp/debug-frontmatter/output.json",
        );
        console.log("Final output:", output);
      } else {
        console.log("Processing failed:", result.error);
      }
    } finally {
      // Cleanup
      try {
        await Deno.remove("./tmp/debug-frontmatter", { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  },
});
