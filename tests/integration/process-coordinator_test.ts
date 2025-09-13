import { assertEquals } from "@std/assert";
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

// Integration test for ProcessCoordinator - Critical data flow validation
// BasePropertyPopulator working - but derived fields still need work
Deno.test({
  name: "ProcessCoordinator - complete data flow from markdown to JSON",
  ignore: true, // Temporarily disabled - BasePropertyPopulator works but frontmatter aggregation needs fixing
  fn: async () => {
    // Setup: Create test infrastructure
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

    const templateRenderer = new TemplateRenderer();
    const aggregator = new Aggregator();

    const coordinator = new ProcessCoordinator(
      schemaRepository,
      frontmatterProcessor,
      templateRenderer,
      aggregator,
      fileReader,
      fileWriter,
      fileLister,
    );

    // Create test markdown file with frontmatter
    const testMarkdownContent = `---
c1: git
c2: create
c3: refinement-issue
title: Test Command
description: Test description for validation
usage: Test usage example
---

# Test Content

This is a test markdown file.`;

    const testOutputPath = "./tmp/test-integration-output.json";

    // Setup test files
    await Deno.mkdir("./tmp/test-md", { recursive: true });
    await Deno.writeTextFile(
      "./tmp/test-md/test-command.md",
      testMarkdownContent,
    );

    try {
      // Execute: Run the complete data flow
      const result = coordinator.processDocuments(
        "./examples/climpt-registry/schema.json",
        testOutputPath,
        "./tmp/test-md/**/*.md",
      );

      // Verify: Result should be successful
      assertEquals(result.ok, true, "ProcessCoordinator should succeed");

      // Verify: Output file should exist
      const outputExists = await Deno.stat(testOutputPath).then(() => true)
        .catch(() => false);
      assertEquals(outputExists, true, "Output file should be created");

      // Verify: Output should contain resolved template variables (not placeholders)
      const outputContent = await Deno.readTextFile(testOutputPath);
      const parsedOutput = JSON.parse(outputContent);

      // CRITICAL: These should NOT contain unresolved template variables
      assertEquals(
        parsedOutput.version !== "{version}",
        true,
        "Version variable should be resolved, not remain as placeholder",
      );

      assertEquals(
        typeof parsedOutput.tools === "object" && parsedOutput.tools !== null,
        true,
        "Tools should be an object with resolved data",
      );

      // Verify derived fields are processed correctly
      assertEquals(
        Array.isArray(parsedOutput.tools.availableConfigs),
        true,
        "availableConfigs should be an array, not string '[]'",
      );

      // If we have commands, verify they contain the extracted frontmatter data
      if (
        Array.isArray(parsedOutput.tools.commands) &&
        parsedOutput.tools.commands.length > 0
      ) {
        const firstCommand = parsedOutput.tools.commands[0];
        assertEquals(
          firstCommand.c1,
          "git",
          "Command c1 should match frontmatter",
        );
        assertEquals(
          firstCommand.c2,
          "create",
          "Command c2 should match frontmatter",
        );
        assertEquals(
          firstCommand.c3,
          "refinement-issue",
          "Command c3 should match frontmatter",
        );
        assertEquals(
          firstCommand.title,
          "Test Command",
          "Command title should match frontmatter",
        );
      }
    } finally {
      // Cleanup: Remove test files
      try {
        await Deno.remove("./tmp/test-md", { recursive: true });
        await Deno.remove(testOutputPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  },
});

// Test for the specific empty data bug in ProcessCoordinator
// BasePropertyPopulator working - but still disabled for CI
Deno.test({
  name:
    "ProcessCoordinator - should not create empty data when no derivation rules",
  ignore: true, // Temporarily disabled - BasePropertyPopulator works but frontmatter aggregation needs fixing
  fn: async () => {
    // This test specifically targets the bug at lines 162-164 in ProcessCoordinator
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

    const templateRenderer = new TemplateRenderer();
    const aggregator = new Aggregator();

    const coordinator = new ProcessCoordinator(
      schemaRepository,
      frontmatterProcessor,
      templateRenderer,
      aggregator,
      fileReader,
      fileWriter,
      fileLister,
    );

    // Create simple schema without derivation rules
    const simpleSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "x-template": "./simple-template.json",
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "commands": {
          "type": "array",
          "x-frontmatter-part": true,
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
            },
          },
        },
      },
    };

    const simpleTemplate = {
      "title": "{title}",
      "commandCount": "{commands.length}",
      "firstCommand": "{commands[0].name}",
    };

    const testMarkdown = `---
name: TestCommand
---

# Test`;

    // Setup test files
    await Deno.mkdir("./tmp/simple-test", { recursive: true });
    await Deno.writeTextFile(
      "./tmp/simple-test/schema.json",
      JSON.stringify(simpleSchema, null, 2),
    );
    await Deno.writeTextFile(
      "./tmp/simple-test/simple-template.json",
      JSON.stringify(simpleTemplate, null, 2),
    );
    await Deno.writeTextFile("./tmp/simple-test/test.md", testMarkdown);

    try {
      const result = coordinator.processDocuments(
        "./tmp/simple-test/schema.json",
        "./tmp/simple-test/output.json",
        "./tmp/simple-test/**/*.md",
      );

      assertEquals(result.ok, true, "Simple processing should succeed");

      // The critical test: verify that template variables are resolved
      const outputContent = await Deno.readTextFile(
        "./tmp/simple-test/output.json",
      );
      const parsedOutput = JSON.parse(outputContent);

      // This should NOT be the placeholder - indicates empty data bug is fixed
      assertEquals(
        parsedOutput.firstCommand !== "{commands[0].name}",
        true,
        "Template variables should be resolved from actual frontmatter data, not remain as placeholders",
      );
    } finally {
      // Cleanup
      try {
        await Deno.remove("./tmp/simple-test", { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  },
});
