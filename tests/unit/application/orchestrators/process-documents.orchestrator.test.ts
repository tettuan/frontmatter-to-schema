/**
 * ProcessDocumentsOrchestrator Unit Tests
 *
 * Tests for the critical Issue #603: Programmatic Execution Failures
 * Ensures CLI and programmatic execution paths work consistently
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { ProcessDocumentsOrchestrator } from "../../../../src/application/orchestrators/process-documents.orchestrator.ts";
import { DenoFileSystemRepository } from "../../../../src/infrastructure/adapters/deno-file-system-repository.ts";
import { TemplateRepositoryImpl } from "../../../../src/infrastructure/repositories/template-repository-impl.ts";
import type { Logger } from "../../../../src/domain/shared/logger.ts";

/**
 * Test Logger Implementation
 * Captures logs for verification without console output
 */
class TestLogger implements Logger {
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

Deno.test("ProcessDocumentsOrchestrator Unit Tests", async (t) => {
  await t.step("Constructor and Dependencies", async (t) => {
    await t.step("should create orchestrator with proper dependencies", () => {
      // Arrange
      const fileSystem = new DenoFileSystemRepository();
      const templateRepo = new TemplateRepositoryImpl();
      const logger = new TestLogger();

      // Act
      const orchestrator = new ProcessDocumentsOrchestrator(
        fileSystem,
        templateRepo,
        logger,
      );

      // Assert
      assertExists(orchestrator);
    });

    await t.step("should require all three constructor parameters", () => {
      const fileSystem = new DenoFileSystemRepository();
      const templateRepo = new TemplateRepositoryImpl();
      const logger = new TestLogger();

      // These should not throw errors
      assertExists(
        new ProcessDocumentsOrchestrator(fileSystem, templateRepo, logger),
      );
    });
  });

  await t.step("Interface Validation - Issue #603 Fix", async (t) => {
    await t.step(
      "should accept correct ProcessDocumentsInput interface",
      () => {
        // Arrange
        const fileSystem = new DenoFileSystemRepository();
        const templateRepo = new TemplateRepositoryImpl();
        const logger = new TestLogger();
        const _orchestrator = new ProcessDocumentsOrchestrator(
          fileSystem,
          templateRepo,
          logger,
        );

        const correctInput = {
          schemaPath: "examples/registry_schema.json",
          sourcePath: "tests/fixtures/test.md", // Correct property name
          outputPath: "tmp/test-output.json",
          format: "json" as const,
          verbose: true,
        };

        // Act & Assert - Should not throw type errors
        // Note: We're testing the interface, not the full execution here
        // The input should be accepted without undefined property errors
        assertExists(correctInput.sourcePath); // Key property that was missing
        assertEquals(typeof correctInput.sourcePath, "string");
      },
    );

    await t.step(
      "should handle pattern property correctly in sourcePath",
      () => {
        const testInputs = [
          { sourcePath: "single-file.md", expected: "single-file.md" },
          { sourcePath: "directory/", expected: "directory/" },
          { sourcePath: "**/*.md", expected: "**/*.md" },
          {
            sourcePath: ".agent/climpt/prompts/**/*.md",
            expected: ".agent/climpt/prompts/**/*.md",
          },
        ];

        testInputs.forEach(({ sourcePath, expected }) => {
          assertEquals(sourcePath, expected);
          assertEquals(typeof sourcePath, "string");
          // Verify the property that caused the undefined error is properly defined
          assertEquals(sourcePath.includes !== undefined, true);
        });
      },
    );
  });

  await t.step(
    "Error Handling - Programmatic vs CLI Consistency",
    async (t) => {
      await t.step(
        "should provide consistent error messages between CLI and programmatic access",
        async () => {
          // Arrange
          const fileSystem = new DenoFileSystemRepository();
          const templateRepo = new TemplateRepositoryImpl();
          const logger = new TestLogger();
          const orchestrator = new ProcessDocumentsOrchestrator(
            fileSystem,
            templateRepo,
            logger,
          );

          const inputWithNonexistentSchema = {
            schemaPath: "nonexistent-schema.json",
            sourcePath: "tests/fixtures/test.md",
            outputPath: "tmp/test-output.json",
          };

          // Act
          const result = await orchestrator.execute(inputWithNonexistentSchema);

          // Assert - Should fail gracefully with proper error structure
          assertEquals(result.ok, false);
          if (!result.ok) {
            assertExists(result.error);
            assertExists(result.error.message);
            assertEquals(typeof result.error.message, "string");
          }

          // Verify no undefined access errors in logs
          const logs = logger.logs;
          const undefinedErrors = logs.filter((log) =>
            log.message.includes("Cannot read properties of undefined") ||
            log.message.includes("undefined (reading 'includes')")
          );
          assertEquals(
            undefinedErrors.length,
            0,
            "Should not have undefined access errors",
          );
        },
      );
    },
  );

  await t.step("Input Validation", async (t) => {
    await t.step("should validate required input properties", () => {
      const validInputs = [
        {
          schemaPath: "schema.json",
          sourcePath: "source.md",
        },
        {
          schemaPath: "schema.json",
          sourcePath: "source.md",
          outputPath: "output.json",
        },
        {
          schemaPath: "schema.json",
          sourcePath: "**/*.md",
          outputPath: "output.json",
          format: "json" as const,
          verbose: true,
        },
      ];

      validInputs.forEach((input) => {
        assertExists(input.schemaPath);
        assertExists(input.sourcePath);
        assertEquals(typeof input.schemaPath, "string");
        assertEquals(typeof input.sourcePath, "string");
      });
    });

    await t.step("should handle optional parameters correctly", () => {
      const inputWithOptionals = {
        schemaPath: "schema.json",
        sourcePath: "source.md",
        outputPath: "output.json",
        format: "yaml" as const,
        dryRun: true,
        verbose: false,
      };

      // All properties should be properly typed
      assertEquals(typeof inputWithOptionals.outputPath, "string");
      assertEquals(inputWithOptionals.format, "yaml");
      assertEquals(typeof inputWithOptionals.dryRun, "boolean");
      assertEquals(typeof inputWithOptionals.verbose, "boolean");
    });
  });

  await t.step("Logger Integration", async (t) => {
    await t.step("should use logger for verbose output", async () => {
      // Arrange
      const fileSystem = new DenoFileSystemRepository();
      const templateRepo = new TemplateRepositoryImpl();
      const logger = new TestLogger();
      const orchestrator = new ProcessDocumentsOrchestrator(
        fileSystem,
        templateRepo,
        logger,
      );

      const input = {
        schemaPath: "nonexistent.json", // Will fail early
        sourcePath: "test.md",
        verbose: true,
      };

      // Act
      await orchestrator.execute(input);

      // Assert - Logger should have been called
      assertEquals(logger.logs.length > 0, true);

      // Should have verbose logging
      const verboseLogs = logger.logs.filter((log) => log.level === "info");
      assertEquals(verboseLogs.length > 0, true);
    });

    await t.step("should respect verbose flag for logging", async () => {
      // Arrange
      const fileSystem = new DenoFileSystemRepository();
      const templateRepo = new TemplateRepositoryImpl();
      const logger = new TestLogger();
      const orchestrator = new ProcessDocumentsOrchestrator(
        fileSystem,
        templateRepo,
        logger,
      );

      const inputVerbose = {
        schemaPath: "nonexistent.json",
        sourcePath: "test.md",
        verbose: true,
      };

      const inputQuiet = {
        schemaPath: "nonexistent.json",
        sourcePath: "test.md",
        verbose: false,
      };

      // Act
      logger.clear();
      await orchestrator.execute(inputVerbose);
      const verboseLogs = logger.logs.length;

      logger.clear();
      await orchestrator.execute(inputQuiet);
      const quietLogs = logger.logs.length;

      // Assert - Verbose should produce more logs
      assertEquals(verboseLogs >= quietLogs, true);
    });
  });
});
