/**
 * Robust Integration Test Helper
 * Following DDD and Totality principles for change-resistant, reproducible tests
 */

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

/**
 * Isolated test environment for integration tests
 * Ensures reproducibility and idempotency
 */
export class IntegrationTestEnvironment {
  private readonly testId: string;
  private readonly basePath: string;
  private readonly coordinator: ProcessCoordinator;
  private createdPaths: string[] = [];

  constructor(testName: string) {
    // Create unique test ID for complete isolation
    this.testId = `${testName}-${Date.now()}-${
      Math.random().toString(36).substring(7)
    }`;
    this.basePath = `./tmp/integration-tests/${this.testId}`;

    // Initialize ProcessCoordinator with infrastructure dependencies
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

    this.coordinator = new ProcessCoordinator(
      schemaRepository,
      frontmatterProcessor,
      templateRenderer,
      aggregator,
      fileReader,
      fileWriter,
      fileLister,
    );
  }

  /**
   * Setup test files with guaranteed cleanup
   * Following idempotency principle - same input produces same state
   */
  async setupTestFiles(files: TestFileDefinition[]): Promise<TestPaths> {
    await Deno.mkdir(this.basePath, { recursive: true });

    const paths: TestPaths = {};

    for (const file of files) {
      const filePath = `${this.basePath}/${file.name}`;
      await Deno.writeTextFile(filePath, file.content);
      this.createdPaths.push(filePath);

      // Store path by type for easy access
      if (file.type === "schema") paths.schema = filePath;
      else if (file.type === "template") paths.template = filePath;
      else if (file.type === "markdown") {
        if (!paths.markdownFiles) paths.markdownFiles = [];
        paths.markdownFiles.push(filePath);
      } else if (file.type === "output") paths.output = filePath;
    }

    return paths;
  }

  /**
   * Execute ProcessCoordinator with error context
   * Follows Totality principle - all error paths handled
   */
  async executeProcessing(
    schemaPath: string,
    outputPath: string,
    inputPattern: string,
  ): Promise<ProcessingResult> {
    try {
      const result = this.coordinator.processDocuments(
        schemaPath,
        outputPath,
        inputPattern,
      );

      if (!result.ok) {
        return {
          success: false,
          error: {
            message: result.error.message,
            kind: result.error.kind,
            context: result.error,
          },
        };
      }

      // Verify output file exists
      const outputExists = await Deno.stat(outputPath)
        .then(() => true)
        .catch(() => false);

      if (!outputExists) {
        return {
          success: false,
          error: {
            message: "Output file was not created",
            kind: "OutputFileNotFound",
            context: { outputPath },
          },
        };
      }

      // Read and parse output
      const outputContent = await Deno.readTextFile(outputPath);
      let parsedOutput;
      try {
        parsedOutput = JSON.parse(outputContent);
      } catch (parseError) {
        return {
          success: false,
          error: {
            message: "Output file is not valid JSON",
            kind: "InvalidOutputFormat",
            context: { parseError, content: outputContent },
          },
        };
      }

      return {
        success: true,
        output: parsedOutput,
        rawOutput: outputContent,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          kind: "UnexpectedError",
          context: error,
        },
      };
    }
  }

  /**
   * Cleanup test environment
   * Ensures no test pollution between runs
   */
  async cleanup(): Promise<void> {
    try {
      // Remove specific created paths first
      for (const path of this.createdPaths) {
        try {
          await Deno.remove(path);
        } catch {
          // Ignore individual file cleanup errors
        }
      }

      // Remove base directory
      await Deno.remove(this.basePath, { recursive: true });
    } catch {
      // Ignore cleanup errors to prevent test failures
      // In production, we might want to log these for monitoring
    }
  }
}

/**
 * Type definitions for robust test configuration
 */
export interface TestFileDefinition {
  name: string;
  type: "schema" | "template" | "markdown" | "output";
  content: string;
}

export interface TestPaths {
  schema?: string;
  template?: string;
  markdownFiles?: string[];
  output?: string;
}

export interface ProcessingResult {
  success: boolean;
  output?: unknown;
  rawOutput?: string;
  error?: {
    message: string;
    kind: string;
    context?: unknown;
  };
}

/**
 * Standard test schemas for different scenarios
 * Reduces code duplication and ensures consistency
 */
export const TestSchemas = {
  /**
   * Schema with base properties for default value testing
   */
  withBaseProperties: {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "x-template": "./test-template.json",
    "type": "object",
    "properties": {
      "version": {
        "type": "string",
        "x-base-property": true,
        "x-default-value": "1.0.0",
      },
      "description": {
        "type": "string",
        "x-base-property": true,
        "x-default-value": "Generated by frontmatter-to-schema",
      },
      "commands": {
        "type": "array",
        "x-frontmatter-part": true,
        "items": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "description": { "type": "string" },
          },
        },
      },
    },
  },

  /**
   * Simple schema without base properties
   */
  simple: {
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
  },
} as const;

/**
 * Standard test templates
 */
export const TestTemplates = {
  withBaseProperties: {
    "version": "{version}",
    "description": "{description}",
    "totalCommands": "{commands.length}",
    "commands": "{commands}",
  },

  simple: {
    "title": "{title}",
    "commandCount": "{commands.length}",
    "firstCommand": "{commands[0].name}",
  },
} as const;

/**
 * Standard test markdown files
 */
export const TestMarkdownFiles = {
  basicCommand: `---
name: TestCommand
description: Test command description
---

# Test Content

This is a test markdown file.`,

  commandWithVersion: `---
version: "2.0.0"
title: "Custom Title"
---

# Custom Content`,

  climptCommand: `---
c1: git
c2: create
c3: refinement-issue
title: Test Command
description: Test description for validation
usage: Test usage example
---

# Test Content

This is a test markdown file.`,
} as const;
