/**
 * ProcessDocumentsOrchestrator Robust Business Logic Tests
 *
 * Tests critical business logic gaps identified in deep analysis:
 * - Schema constraints pre-filtering (lines 151-179)
 * - Template path resolution (lines 213-217)
 * - Result pattern compliance (Totality violations)
 *
 * Using real repositories with temporary files for robust, realistic testing
 */

import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { ProcessDocumentsOrchestrator } from "../../../../src/application/orchestrators/process-documents.orchestrator.ts";
import { DenoFileSystemRepository } from "../../../../src/infrastructure/adapters/deno-file-system-repository.ts";
import { TemplateRepositoryImpl } from "../../../../src/infrastructure/repositories/template-repository-impl.ts";
import type { Logger } from "../../../../src/domain/shared/logger.ts";
import { join } from "jsr:@std/path";

/**
 * Test Logger Implementation
 * Captures logs for verification without console output - ensures reproducibility
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

  hasLogContaining(text: string): boolean {
    return this.logs.some((log) => log.message.includes(text));
  }

  getLogsByLevel(level: string): string[] {
    return this.logs
      .filter((log) => log.level === level)
      .map((log) => log.message);
  }
}

/**
 * Test Setup Helper
 * Creates temporary files for isolated, reproducible tests
 */
class TestSetup {
  private tempDir: string;
  private fileSystem: DenoFileSystemRepository;
  private templateRepo: TemplateRepositoryImpl;
  private logger: TestLogger;

  constructor() {
    this.tempDir = `/tmp/robust-test-${Date.now()}`;
    this.fileSystem = new DenoFileSystemRepository();
    this.templateRepo = new TemplateRepositoryImpl();
    this.logger = new TestLogger();
  }

  async setup(): Promise<void> {
    await Deno.mkdir(this.tempDir, { recursive: true });
  }

  async cleanup(): Promise<void> {
    try {
      await Deno.remove(this.tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  createOrchestrator(): ProcessDocumentsOrchestrator {
    return new ProcessDocumentsOrchestrator(
      this.fileSystem,
      this.templateRepo,
      this.logger,
    );
  }

  getLogger(): TestLogger {
    return this.logger;
  }

  async writeFile(filename: string, content: string): Promise<string> {
    const path = join(this.tempDir, filename);
    await Deno.writeTextFile(path, content);
    return path;
  }

  getTempPath(filename: string): string {
    return join(this.tempDir, filename);
  }
}

Deno.test("ProcessDocumentsOrchestrator Robust Business Logic Tests", async (t) => {
  await t.step("Schema Constraints Pre-filtering Logic", async (t) => {
    await t.step("should process file when constraints match", async () => {
      // Arrange
      const setup = new TestSetup();
      await setup.setup();

      try {
        const orchestrator = setup.createOrchestrator();

        // Setup schema with constraints
        const schemaWithConstraints = {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "traceability": {
              "type": "array",
              "items": {
                "properties": {
                  "id": {
                    "properties": {
                      "level": { "const": "req" },
                    },
                  },
                },
              },
            },
          },
        };

        const schemaPath = await setup.writeFile(
          "schema.json",
          JSON.stringify(schemaWithConstraints, null, 2),
        );

        // Setup valid frontmatter that matches constraints
        const validFrontmatter = {
          "title": "Test Requirement",
          "traceability": [
            {
              "id": {
                "level": "req",
                "full": "req:test:001",
              },
            },
          ],
        };

        const markdownContent = `---
${JSON.stringify(validFrontmatter, null, 2)}
---
# Test Document
This is a test requirement document.`;

        const markdownPath = await setup.writeFile("test.md", markdownContent);
        const outputPath = setup.getTempPath("output.json");

        // Act
        const result = await orchestrator.execute({
          schemaPath,
          sourcePath: markdownPath,
          outputPath,
          verbose: true,
        });

        // Assert - Result pattern compliance (Totality)
        assert(
          result.ok,
          `Expected success but got error: ${
            result.ok ? "" : JSON.stringify(result.error)
          }`,
        );

        if (result.ok) {
          assertEquals(result.data.filesProcessed, 1);

          // Verify constraint evaluation occurred and file was processed
          const logger = setup.getLogger();
          assert(logger.hasLogContaining("matches schema constraints"));
          assert(!logger.hasLogContaining("Filtered"));
        }
      } finally {
        await setup.cleanup();
      }
    });

    await t.step(
      "should filter file when constraints don't match",
      async () => {
        // Arrange
        const setup = new TestSetup();
        await setup.setup();

        try {
          const orchestrator = setup.createOrchestrator();

          // Setup schema with constraints
          const schemaWithConstraints = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "traceability": {
                "type": "array",
                "items": {
                  "properties": {
                    "id": {
                      "properties": {
                        "level": { "const": "req" },
                      },
                    },
                  },
                },
              },
            },
          };

          const schemaPath = await setup.writeFile(
            "schema.json",
            JSON.stringify(schemaWithConstraints, null, 2),
          );

          // Setup invalid frontmatter that doesn't match constraints
          const invalidFrontmatter = {
            "title": "Test Specification",
            "traceability": [
              {
                "id": {
                  "level": "spec", // Different level - should be filtered
                  "full": "spec:test:001",
                },
              },
            ],
          };

          const markdownContent = `---
${JSON.stringify(invalidFrontmatter, null, 2)}
---
# Test Document
This is a test specification document.`;

          const markdownPath = await setup.writeFile(
            "test.md",
            markdownContent,
          );
          const outputPath = setup.getTempPath("output.json");

          // Act
          const result = await orchestrator.execute({
            schemaPath,
            sourcePath: markdownPath,
            outputPath,
            verbose: true,
          });

          // Assert - Result pattern compliance (Totality)
          assert(
            result.ok,
            `Expected success but got error: ${
              result.ok ? "" : JSON.stringify(result.error)
            }`,
          );

          if (result.ok) {
            assertEquals(result.data.filesProcessed, 0); // File was filtered

            // Verify filtering logic worked
            const logger = setup.getLogger();
            assert(logger.hasLogContaining("Filtered"));
          }
        } finally {
          await setup.cleanup();
        }
      },
    );
  });

  await t.step("Template Path Resolution Logic", async (t) => {
    await t.step(
      "should resolve relative template path correctly",
      async () => {
        // Arrange
        const setup = new TestSetup();
        await setup.setup();

        try {
          const orchestrator = setup.createOrchestrator();

          // Create subdirectory structure
          await Deno.mkdir(join(setup.getTempPath("schemas")), {
            recursive: true,
          });

          // Setup schema with template reference
          const schemaWithTemplate = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./template.json",
            "properties": {
              "title": { "type": "string" },
              "description": { "type": "string" },
            },
          };

          const schemaPath = await setup.writeFile(
            "schemas/schema.json",
            JSON.stringify(schemaWithTemplate, null, 2),
          );

          // Setup template in same directory as schema
          const template = {
            "title": "{title}",
            "description": "{description}",
            "processed": true,
          };

          await setup.writeFile(
            "schemas/template.json",
            JSON.stringify(template, null, 2),
          );

          const frontmatter = {
            "title": "Test Title",
            "description": "Test Description",
          };

          const markdownContent = `---
${JSON.stringify(frontmatter, null, 2)}
---
# Test Document`;

          const markdownPath = await setup.writeFile(
            "test.md",
            markdownContent,
          );
          const outputPath = setup.getTempPath("output.json");

          // Act
          const result = await orchestrator.execute({
            schemaPath, // Schema in subdirectory
            sourcePath: markdownPath,
            outputPath,
          });

          // Assert - Template processing should succeed with relative path resolution
          assert(
            result.ok,
            `Expected success but got error: ${
              result.ok ? "" : JSON.stringify(result.error)
            }`,
          );

          if (result.ok) {
            assertEquals(result.data.filesProcessed, 1);

            // Result should contain template-processed data
            assertExists(result.data.result);
          }
        } finally {
          await setup.cleanup();
        }
      },
    );

    await t.step(
      "should handle missing template gracefully with fallback",
      async () => {
        // Arrange
        const setup = new TestSetup();
        await setup.setup();

        try {
          const orchestrator = setup.createOrchestrator();

          // Setup schema with non-existent template
          const schemaWithBadTemplate = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "x-template": "./nonexistent.json",
            "properties": {
              "title": { "type": "string" },
              "description": { "type": "string" },
            },
          };

          const schemaPath = await setup.writeFile(
            "schema.json",
            JSON.stringify(schemaWithBadTemplate, null, 2),
          );

          const frontmatter = {
            "title": "Test Title",
            "description": "Test Description",
          };

          const markdownContent = `---
${JSON.stringify(frontmatter, null, 2)}
---
# Test Document`;

          const markdownPath = await setup.writeFile(
            "test.md",
            markdownContent,
          );
          const outputPath = setup.getTempPath("output.json");

          // Act
          const result = await orchestrator.execute({
            schemaPath,
            sourcePath: markdownPath,
            outputPath,
          });

          // Assert - Should fallback gracefully with Result pattern
          assert(
            result.ok,
            `Expected success but got error: ${
              result.ok ? "" : JSON.stringify(result.error)
            }`,
          );

          if (result.ok) {
            assertEquals(result.data.filesProcessed, 1);

            // Should log template loading failure but continue
            const logger = setup.getLogger();
            assert(logger.hasLogContaining("Failed to load template"));

            // Raw data should be used as fallback
            assertExists(result.data.result);
          }
        } finally {
          await setup.cleanup();
        }
      },
    );
  });

  await t.step("Result Pattern Compliance (Totality Violations)", async (t) => {
    await t.step(
      "should use Result pattern for schema loading failures",
      async () => {
        // Arrange
        const setup = new TestSetup();
        await setup.setup();

        try {
          const orchestrator = setup.createOrchestrator();

          // Act - Try to load non-existent schema
          const result = await orchestrator.execute({
            schemaPath: "/nonexistent/schema.json",
            sourcePath: setup.getTempPath("test.md"),
            outputPath: setup.getTempPath("output.json"),
          });

          // Assert - Should return Result<T,E> not throw exception
          assert(!result.ok, "Expected error result for non-existent schema");

          if (!result.ok) {
            // Should be a domain error, not an exception
            assertExists(result.error.kind);
          }

          // No exceptions should have been thrown (Totality compliance)
          assert(true);
        } finally {
          await setup.cleanup();
        }
      },
    );

    await t.step(
      "should handle null/undefined frontmatter values safely",
      async () => {
        // Arrange
        const setup = new TestSetup();
        await setup.setup();

        try {
          const orchestrator = setup.createOrchestrator();

          const schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
              "title": { "type": "string" },
              "description": { "type": "string" },
            },
          };

          const schemaPath = await setup.writeFile(
            "schema.json",
            JSON.stringify(schema, null, 2),
          );

          // Setup markdown with null/undefined values
          const nullFrontmatter = {
            title: null,
            description: undefined,
            emptyString: "",
            data: null,
          };

          const markdownContent = `---
${JSON.stringify(nullFrontmatter, null, 2)}
---
# Test Document`;

          const markdownPath = await setup.writeFile(
            "test.md",
            markdownContent,
          );
          const outputPath = setup.getTempPath("output.json");

          // Act
          const result = await orchestrator.execute({
            schemaPath,
            sourcePath: markdownPath,
            outputPath,
          });

          // Assert - Should handle null/undefined values safely
          assert(
            result.ok,
            `Expected success but got error: ${
              result.ok ? "" : JSON.stringify(result.error)
            }`,
          );

          if (result.ok) {
            assertEquals(result.data.filesProcessed, 1);

            // Should not throw null reference errors
            assertExists(result.data.result);
          }
        } finally {
          await setup.cleanup();
        }
      },
    );
  });
});
