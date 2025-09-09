/**
 * Programmatic Execution Integration Tests
 *
 * Tests for Issue #603: Critical programmatic execution failures
 * Ensures CLI and programmatic paths work identically
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { ProcessDocumentsOrchestrator } from "../../src/application/orchestrators/process-documents.orchestrator.ts";
import { DenoFileSystemRepository } from "../../src/infrastructure/adapters/deno-file-system-repository.ts";
import { TemplateRepositoryImpl } from "../../src/infrastructure/repositories/template-repository-impl.ts";
import type { Logger } from "../../src/domain/shared/logger.ts";
import * as path from "jsr:@std/path@1.0.9";

/**
 * Silent Logger for Integration Tests
 * Captures logs without console output during CI
 */
class SilentLogger implements Logger {
  public logs: Array<{ level: string; message: string }> = [];

  info(message: string): void {
    this.logs.push({ level: "info", message });
  }

  warn(message: string): void {
    this.logs.push({ level: "warn", message });
  }

  error(message: string): void {
    this.logs.push({ level: "error", message });
  }

  debug(message: string): void {
    this.logs.push({ level: "debug", message });
  }

  clear(): void {
    this.logs = [];
  }
}

Deno.test("Programmatic Execution - Issue #603 Fix", async (t) => {
  await t.step("Programmatic vs CLI Consistency", async (t) => {
    await t.step(
      "should execute programmatically with correct interface",
      async () => {
        // Arrange - Create real dependencies like CLI does
        const fileSystem = new DenoFileSystemRepository();
        const templateRepo = new TemplateRepositoryImpl();
        const logger = new SilentLogger();

        const orchestrator = new ProcessDocumentsOrchestrator(
          fileSystem,
          templateRepo,
          logger,
        );

        // Create test files
        const testDir = "tmp/programmatic-test";
        const testFile = path.join(testDir, "test.md");
        const testSchema = path.join(testDir, "schema.json");
        const testTemplate = path.join(testDir, "template.json");
        const outputFile = path.join(testDir, "output.json");

        try {
          await Deno.mkdir(testDir, { recursive: true });

          // Create test markdown file
          await Deno.writeTextFile(
            testFile,
            `---
c1: test
c2: programmatic
c3: execution
title: Test Document
description: Testing programmatic execution
---
# Test Content

This is a test document for programmatic execution.`,
          );

          // Create test schema
          await Deno.writeTextFile(
            testSchema,
            JSON.stringify(
              {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "type": "object",
                "properties": {
                  "version": { "type": "string", "default": "1.0.0" },
                  "description": {
                    "type": "string",
                    "default": "Generated from programmatic test",
                  },
                  "items": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "c1": { "type": "string" },
                        "c2": { "type": "string" },
                        "c3": { "type": "string" },
                        "title": { "type": "string" },
                        "description": { "type": "string" },
                      },
                    },
                    "x-frontmatter-part": true,
                  },
                },
                "x-template": "./template.json",
              },
              null,
              2,
            ),
          );

          // Create test template
          await Deno.writeTextFile(
            testTemplate,
            JSON.stringify(
              {
                "version": "{version}",
                "description": "{description}",
                "items": "{items}",
              },
              null,
              2,
            ),
          );

          // Act - Execute programmatically with CORRECT interface
          const result = await orchestrator.execute({
            schemaPath: testSchema,
            sourcePath: testFile, // Correct property name (not 'pattern')
            outputPath: outputFile,
            format: "json" as const,
            verbose: true,
          });

          // Assert - Should succeed without undefined errors
          assertEquals(
            result.ok,
            true,
            `Execution should succeed. Error: ${
              !result.ok ? JSON.stringify(result.error, null, 2) : "none"
            }`,
          );

          if (result.ok) {
            assertEquals(result.data.filesProcessed >= 1, true);
            assertExists(result.data.result);
            assertEquals(result.data.outputPath, outputFile);

            // Verify output file was created
            const outputExists = await Deno.stat(outputFile).then(() => true)
              .catch(() => false);
            assertEquals(outputExists, true, "Output file should be created");
          }

          // Verify no undefined access errors in logs
          const undefinedErrors = logger.logs.filter((log) =>
            log.message.includes("Cannot read properties of undefined") ||
            log.message.includes("undefined (reading 'includes')")
          );
          assertEquals(
            undefinedErrors.length,
            0,
            `Should not have undefined errors. Found: ${
              JSON.stringify(undefinedErrors, null, 2)
            }`,
          );

          // Verify proper verbose logging occurred
          const infoLogs = logger.logs.filter((log) => log.level === "info");
          assertEquals(
            infoLogs.length >= 2,
            true,
            "Should have verbose logging",
          );
        } finally {
          // Cleanup
          try {
            await Deno.remove(testDir, { recursive: true });
          } catch {
            // Ignore cleanup errors
          }
        }
      },
    );

    await t.step("should handle directory patterns like CLI", async () => {
      // Arrange
      const fileSystem = new DenoFileSystemRepository();
      const templateRepo = new TemplateRepositoryImpl();
      const logger = new SilentLogger();

      const orchestrator = new ProcessDocumentsOrchestrator(
        fileSystem,
        templateRepo,
        logger,
      );

      const testDir = "tmp/programmatic-dir-test";
      const subDir = path.join(testDir, "subdir");
      const testSchema = path.join(testDir, "schema.json");
      const outputFile = path.join(testDir, "output.json");

      try {
        await Deno.mkdir(subDir, { recursive: true });

        // Create multiple test files
        await Deno.writeTextFile(
          path.join(testDir, "file1.md"),
          `---
c1: file
c2: one
c3: test
---
# File One`,
        );

        await Deno.writeTextFile(
          path.join(subDir, "file2.md"),
          `---
c1: file
c2: two  
c3: test
---
# File Two`,
        );

        // Create minimal schema
        await Deno.writeTextFile(
          testSchema,
          JSON.stringify(
            {
              "$schema": "http://json-schema.org/draft-07/schema#",
              "type": "object",
              "properties": {
                "items": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "c1": { "type": "string" },
                      "c2": { "type": "string" },
                      "c3": { "type": "string" },
                    },
                  },
                  "x-frontmatter-part": true,
                },
              },
            },
            null,
            2,
          ),
        );

        // Act - Test glob pattern like CLI uses
        const result = await orchestrator.execute({
          schemaPath: testSchema,
          sourcePath: path.join(testDir, "**/*.md"), // Glob pattern
          outputPath: outputFile,
          verbose: true,
        });

        // Assert
        assertEquals(
          result.ok,
          true,
          `Directory pattern execution should succeed. Error: ${
            !result.ok ? JSON.stringify(result.error, null, 2) : "none"
          }`,
        );

        if (result.ok) {
          assertEquals(
            result.data.filesProcessed >= 1,
            true,
            "Should process multiple files",
          );
        }

        // Verify no pattern-related undefined errors
        const patternErrors = logger.logs.filter((log) =>
          log.message.includes("undefined") && log.message.includes("pattern")
        );
        assertEquals(
          patternErrors.length,
          0,
          "Should not have pattern undefined errors",
        );
      } finally {
        try {
          await Deno.remove(testDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  await t.step("Error Handling Parity", async (t) => {
    await t.step(
      "should handle schema file not found consistently",
      async () => {
        // Arrange
        const fileSystem = new DenoFileSystemRepository();
        const templateRepo = new TemplateRepositoryImpl();
        const logger = new SilentLogger();

        const orchestrator = new ProcessDocumentsOrchestrator(
          fileSystem,
          templateRepo,
          logger,
        );

        // Act
        const result = await orchestrator.execute({
          schemaPath: "nonexistent-schema.json",
          sourcePath: "test.md",
        });

        // Assert - Should fail gracefully
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertExists(result.error);
          assertExists(result.error.message);
          assertEquals(typeof result.error.message, "string");
          assertEquals(result.error.message.length > 0, true);
        }

        // Should not have undefined access errors during error handling
        const undefinedErrors = logger.logs.filter((log) =>
          log.message.includes("Cannot read properties of undefined")
        );
        assertEquals(
          undefinedErrors.length,
          0,
          "Error handling should not cause undefined access",
        );
      },
    );

    await t.step("should handle invalid source path consistently", async () => {
      // Arrange
      const fileSystem = new DenoFileSystemRepository();
      const templateRepo = new TemplateRepositoryImpl();
      const logger = new SilentLogger();

      const orchestrator = new ProcessDocumentsOrchestrator(
        fileSystem,
        templateRepo,
        logger,
      );

      const testSchema = "tmp/error-test-schema.json";

      try {
        // Create minimal valid schema
        await Deno.writeTextFile(
          testSchema,
          JSON.stringify({
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
              "items": { "type": "array", "x-frontmatter-part": true },
            },
          }),
        );

        // Act - Test with nonexistent source path
        const result = await orchestrator.execute({
          schemaPath: testSchema,
          sourcePath: "nonexistent/**/*.md",
        });

        // Assert - Should handle gracefully (no files found is ok)
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(
            result.data.filesProcessed,
            0,
            "Should process 0 files for nonexistent path",
          );
        }

        // Should not have undefined access errors during path processing
        const pathErrors = logger.logs.filter((log) =>
          log.message.includes("undefined") &&
          (log.message.includes("includes") || log.message.includes("split"))
        );
        assertEquals(
          pathErrors.length,
          0,
          "Path processing should not cause undefined access",
        );
      } finally {
        try {
          await Deno.remove(testSchema);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  await t.step("Repository Integration", async (t) => {
    await t.step("should initialize repositories correctly", () => {
      // Arrange & Act
      const fileSystem = new DenoFileSystemRepository();
      const templateRepo = new TemplateRepositoryImpl();
      const logger = new SilentLogger();

      // Should not throw during construction
      const orchestrator = new ProcessDocumentsOrchestrator(
        fileSystem,
        templateRepo,
        logger,
      );

      // Assert
      assertExists(orchestrator);
    });

    await t.step("should handle repository dependency injection", () => {
      // Test that all required dependencies are properly injected
      const fileSystem = new DenoFileSystemRepository();
      const templateRepo = new TemplateRepositoryImpl();
      const logger = new SilentLogger();

      // Different logger instance
      const altLogger = new SilentLogger();

      const orchestrator1 = new ProcessDocumentsOrchestrator(
        fileSystem,
        templateRepo,
        logger,
      );
      const orchestrator2 = new ProcessDocumentsOrchestrator(
        fileSystem,
        templateRepo,
        altLogger,
      );

      assertExists(orchestrator1);
      assertExists(orchestrator2);

      // Verify they are different instances
      assertEquals(orchestrator1 === orchestrator2, false);
    });
  });
});
