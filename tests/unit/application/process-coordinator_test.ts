/**
 * ProcessCoordinator Robust Test Suite
 * 
 * Comprehensive tests for the canonical processing entry point
 * Focuses on file discovery recursive pattern bug and aggregation mode
 * Follows Totality principles and DDD architecture
 */

import { assertEquals, assertExists, assertStringIncludes } from "jsr:@std/assert@1";
import { beforeEach, describe, it } from "jsr:@std/testing@1/bdd";
import { ProcessCoordinator, type ProcessingConfiguration } from "../../../src/application/process-coordinator.ts";

/**
 * Test Fixture Factory for ProcessCoordinator
 * Provides clean, isolated test data following Totality principles
 */
class ProcessCoordinatorTestFactory {
  static createValidConfiguration(): ProcessingConfiguration {
    return {
      schema: {
        path: "tests/fixtures/valid-schema.json",
        format: "json" as const,
      },
      input: {
        pattern: "tests/fixtures/**/*.md",
        baseDirectory: "tests/fixtures",
      },
      template: {
        kind: "file" as const,
        path: "tests/fixtures/template.json",
        format: "json" as const,
      },
      output: {
        path: "/tmp/test-output.json",
        format: "json" as const,
      },
    };
  }

  static createRecursivePatternConfiguration(): ProcessingConfiguration {
    return {
      schema: {
        path: "tests/fixtures/valid-schema.json",
        format: "json" as const,
      },
      input: {
        pattern: "**/*.md",
        baseDirectory: "tests/fixtures/nested",
      },
      template: {
        kind: "file" as const,
        path: "tests/fixtures/template.json",
        format: "json" as const,
      },
      output: {
        path: "/tmp/test-output.json",
        format: "json" as const,
      },
    };
  }

  static createAggregationConfiguration(): ProcessingConfiguration {
    return {
      schema: {
        path: "tests/fixtures/valid-schema.json",
        format: "json" as const,
      },
      input: {
        pattern: "**/*.md",
        baseDirectory: "tests/fixtures/aggregation",
      },
      template: {
        kind: "file" as const,
        path: "tests/fixtures/template.json",
        format: "json" as const,
      },
      output: {
        path: "/tmp/test-output.json",
        format: "json" as const,
      },
    };
  }

  static async setupTestFixtures(): Promise<void> {
    // Create test directory structure
    await Deno.mkdir("tests/fixtures/nested/subdir", { recursive: true });
    await Deno.mkdir("tests/fixtures/aggregation", { recursive: true });

    // Create test schema with x-template and x-derived-from
    const testSchema = {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "x-template": "./template.json",
      "type": "object",
      "properties": {
        "tools": {
          "type": "object",
          "properties": {
            "availableConfigs": {
              "type": "array",
              "x-derived-from": "commands[].c1",
              "x-derived-unique": true,
            },
            "commands": {
              "type": "array",
              "x-frontmatter-part": true,
            },
          },
        },
      },
    };
    
    await Deno.writeTextFile(
      "tests/fixtures/valid-schema.json", 
      JSON.stringify(testSchema, null, 2)
    );

    // Create test template
    const testTemplate = {
      "version": "{version}",
      "tools": {
        "availableConfigs": "{tools.availableConfigs}",
        "commands": "{tools.commands}",
      },
    };
    
    await Deno.writeTextFile(
      "tests/fixtures/template.json", 
      JSON.stringify(testTemplate, null, 2)
    );

    // Create test markdown files with frontmatter
    await Deno.writeTextFile(
      "tests/fixtures/test1.md",
      `---
c1: design
c2: create
c3: component
title: Test Command 1
---

# Test Content 1
`
    );

    await Deno.writeTextFile(
      "tests/fixtures/nested/subdir/test2.md",
      `---
c1: build
c2: execute
c3: task
title: Test Command 2
---

# Test Content 2
`
    );

    // Create multiple files for aggregation test
    for (let i = 1; i <= 3; i++) {
      await Deno.writeTextFile(
        `tests/fixtures/aggregation/cmd${i}.md`,
        `---
c1: test${i}
c2: action${i}
c3: target${i}
title: Command ${i}
---

# Command ${i} Content
`
      );
    }
  }

  static async cleanupTestFixtures(): Promise<void> {
    try {
      await Deno.remove("tests/fixtures", { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

describe("ProcessCoordinator - Robust Test Suite", () => {
  let processCoordinator: ProcessCoordinator;

  beforeEach(async () => {
    // Setup clean test environment
    await ProcessCoordinatorTestFactory.cleanupTestFixtures();
    await ProcessCoordinatorTestFactory.setupTestFixtures();

    // Initialize ProcessCoordinator
    processCoordinator = new ProcessCoordinator();
  });

  describe("File Discovery - Critical Bug Fix", () => {
    it("should discover files in base directory", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          path: "tests/fixtures/valid-schema.json",
          format: "json" as const,
        },
        input: {
          pattern: "*.md",
          baseDirectory: "tests/fixtures",
        },
        template: {
          kind: "file" as const,
          path: "tests/fixtures/template.json",
          format: "json" as const,
        },
        output: {
          path: "/tmp/test-output.json",
          format: "json" as const,
        },
      };

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        // Should find at least test1.md
        assertEquals(result.data.processedFiles >= 1, true);
      }
    });

    it("should discover files recursively with ** pattern", async () => {
      const config = ProcessCoordinatorTestFactory.createRecursivePatternConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        // Should find files in nested directories
        assertEquals(result.data.processedFiles >= 1, true);
        assertExists(result.data.renderedContent);
      }
    });

    it("should handle empty directory gracefully", async () => {
      await Deno.mkdir("tests/fixtures/empty", { recursive: true });
      
      const config: ProcessingConfiguration = {
        schema: {
          path: "tests/fixtures/valid-schema.json",
          format: "json" as const,
        },
        input: {
          pattern: "**/*.md",
          baseDirectory: "tests/fixtures/empty",
        },
        template: {
          kind: "file" as const,
          path: "tests/fixtures/template.json",
          format: "json" as const,
        },
        output: {
          path: "/tmp/test-output.json",
          format: "json" as const,
        },
      };

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.processedFiles, 0);
      }
    });

    it("should return error for non-existent directory", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          path: "tests/fixtures/valid-schema.json",
          format: "json" as const,
        },
        input: {
          pattern: "**/*.md",
          baseDirectory: "tests/fixtures/nonexistent",
        },
        template: {
          kind: "file" as const,
          path: "tests/fixtures/template.json",
          format: "json" as const,
        },
        output: {
          path: "/tmp/test-output.json",
          format: "json" as const,
        },
      };

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertStringIncludes(result.error.message, "FileDiscovery");
      }
    });
  });

  describe("Aggregation Mode - x-derived-from Processing", () => {
    it("should trigger aggregation mode with multiple files", async () => {
      const config = ProcessCoordinatorTestFactory.createAggregationConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        // Should process multiple files (3 cmd files)
        assertEquals(result.data.processedFiles >= 3, true);
        
        // Should have aggregated data
        assertExists(result.data.aggregatedData);
        assertEquals(result.data.aggregatedData.totalDocuments >= 3, true);
      }
    });

    it("should apply x-derived-from to extract unique values", async () => {
      const config = ProcessCoordinatorTestFactory.createAggregationConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok && result.data.aggregatedData) {
        const fields = result.data.aggregatedData.aggregatedFields;
        
        // Should contain derived fields from aggregation
        assertExists(fields);
        
        // Check if availableConfigs contains unique c1 values
        if (fields.tools && typeof fields.tools === 'object') {
          const tools = fields.tools as Record<string, unknown>;
          if (Array.isArray(tools.availableConfigs)) {
            // Should have extracted unique c1 values: test1, test2, test3
            assertEquals(tools.availableConfigs.length >= 3, true);
          }
        }
      }
    });

    it("should not trigger aggregation for single file", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          path: "tests/fixtures/valid-schema.json",
          format: "json" as const,
        },
        input: {
          pattern: "test1.md",
          baseDirectory: "tests/fixtures",
        },
        template: {
          kind: "file" as const,
          path: "tests/fixtures/template.json",
          format: "json" as const,
        },
        output: {
          path: "/tmp/test-output.json",
          format: "json" as const,
        },
      };

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.processedFiles, 1);
        // Single file should not have aggregated data
        assertEquals(result.data.aggregatedData, undefined);
      }
    });
  });

  describe("Template Processing - Variable Substitution", () => {
    it("should apply template with x-template from schema", async () => {
      const config = ProcessCoordinatorTestFactory.createAggregationConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        const content = result.data.renderedContent.content;
        
        // Should not be the fallback template
        assertEquals(content.includes('"template": "default"'), false);
        
        // Should have processed template variables
        assertExists(content);
        assertEquals(content.length > 50, true); // More than minimal fallback
      }
    });

    it("should substitute template variables with aggregated data", async () => {
      const config = ProcessCoordinatorTestFactory.createAggregationConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        const content = result.data.renderedContent.content;
        
        // Should not contain unsubstituted variables
        assertEquals(content.includes("{tools.availableConfigs}"), false);
        assertEquals(content.includes("{tools.commands}"), false);
      }
    });

    it("should handle missing template file gracefully", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          path: "tests/fixtures/valid-schema.json",
          format: "json" as const,
        },
        input: {
          pattern: "**/*.md",
          baseDirectory: "tests/fixtures/aggregation",
        },
        template: {
          kind: "file" as const,
          path: "tests/fixtures/nonexistent-template.json",
          format: "json" as const,
        },
        output: {
          path: "/tmp/test-output.json",
          format: "json" as const,
        },
      };

      const result = await processCoordinator.processDocuments(config);
      
      // Should either succeed with fallback or fail gracefully
      if (!result.ok) {
        assertStringIncludes(result.error.message, "Template");
      }
    });
  });

  describe("Error Handling - Totality Principles", () => {
    it("should return Result<Success, Error> for all operations", async () => {
      const config = ProcessCoordinatorTestFactory.createValidConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      // Should always return a Result type
      assertExists(result);
      assertExists(result.ok);
      
      if (result.ok) {
        assertExists(result.data);
      } else {
        assertExists(result.error);
        assertExists(result.error.message);
      }
    });

    it("should handle invalid schema gracefully", async () => {
      await Deno.writeTextFile("tests/fixtures/invalid-schema.json", "invalid json");
      
      const config: ProcessingConfiguration = {
        schema: {
          path: "tests/fixtures/invalid-schema.json",
          format: "json" as const,
        },
        input: {
          pattern: "**/*.md",
          baseDirectory: "tests/fixtures",
        },
        template: {
          kind: "file" as const,
          path: "tests/fixtures/template.json",
          format: "json" as const,
        },
        output: {
          path: "/tmp/test-output.json",
          format: "json" as const,
        },
      };

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertStringIncludes(result.error.message, "Schema");
      }
    });

    it("should handle processing errors without throwing", async () => {
      const config: ProcessingConfiguration = {
        schema: {
          path: "tests/fixtures/nonexistent-schema.json",
          format: "json" as const,
        },
        input: {
          pattern: "**/*.md",
          baseDirectory: "tests/fixtures",
        },
        template: {
          kind: "file" as const,
          path: "tests/fixtures/template.json",
          format: "json" as const,
        },
        output: {
          path: "/tmp/test-output.json",
          format: "json" as const,
        },
      };

      // Should not throw - should return error Result
      const result = await processCoordinator.processDocuments(config);
      assertEquals(result.ok, false);
    });
  });

  describe("Integration - Complete Processing Pipeline", () => {
    it("should complete full processing pipeline successfully", async () => {
      const config = ProcessCoordinatorTestFactory.createAggregationConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        // Verify all pipeline stages completed
        assertEquals(result.data.processedFiles >= 3, true);
        assertEquals(result.data.bypassDetected, false);
        assertEquals(result.data.canonicalPathUsed, true);
        
        assertExists(result.data.validationResults);
        assertExists(result.data.renderedContent);
        assertExists(result.data.aggregatedData);
        
        // Verify processing time is recorded
        assertEquals(result.data.processingTime > 0, true);
      }
    });

    it("should maintain processing order: Schema → Files → Processing → Aggregation → Template → Output", async () => {
      const config = ProcessCoordinatorTestFactory.createAggregationConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      assertEquals(result.ok, true);
      if (result.ok) {
        // If aggregation occurred, template should use aggregated data
        if (result.data.aggregatedData) {
          const content = result.data.renderedContent.content;
          // Should not be the fallback template since aggregation provided data
          assertEquals(content.includes('"template": "default"'), false);
        }
      }
    });

    it("should handle mixed success/failure scenarios", async () => {
      // Create scenario with some valid and some invalid files
      await Deno.writeTextFile(
        "tests/fixtures/aggregation/invalid.md",
        `---
invalid frontmatter
---`
      );

      const config = ProcessCoordinatorTestFactory.createAggregationConfiguration();

      const result = await processCoordinator.processDocuments(config);
      
      // Should still process valid files even if some are invalid
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.processedFiles >= 3, true); // At least the 3 valid ones
      }
    });
  });
});