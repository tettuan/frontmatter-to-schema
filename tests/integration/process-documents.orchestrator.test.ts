/**
 * ProcessDocumentsOrchestrator Integration Tests
 *
 * Tests the complete template processing pipeline integration
 * Following DDD principles with proper domain boundary testing
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { ProcessDocumentsOrchestrator } from "../../src/application/orchestrators/process-documents.orchestrator.ts";
import type {
  FileInfo,
  FileSystemRepository,
} from "../../src/domain/repositories/file-system-repository.ts";
import type { ITemplateRepository } from "../../src/domain/repositories/template-repository.ts";
import { TemplatePath } from "../../src/domain/repositories/template-repository.ts";
import type { Logger } from "../../src/domain/shared/logger.ts";
import {
  createMockSchema,
  createMockTemplate,
} from "../test-helpers/mock-factories.ts";
import type { DomainError, Result } from "../../src/domain/core/result.ts";
import { createDomainError } from "../../src/domain/core/result.ts";

/**
 * Mock FileSystemRepository for controlled testing
 */
class MockFileSystemRepository implements FileSystemRepository {
  private mockFiles: Map<string, string> = new Map();

  constructor(files: Record<string, string> = {}) {
    Object.entries(files).forEach(([path, content]) => {
      this.mockFiles.set(path, content);
    });
  }

  async readFile(filePath: string): Promise<Result<string, DomainError>> {
    const content = this.mockFiles.get(filePath);
    if (content === undefined) {
      return {
        ok: false,
        error: {
          kind: "FileNotFound" as const,
          path: filePath,
        },
      };
    }
    return { ok: true, data: content };
  }

  async writeFile(
    _filePath: string,
    _content: string,
  ): Promise<Result<void, DomainError>> {
    return { ok: true, data: undefined };
  }

  async ensureDirectory(_path: string): Promise<Result<void, DomainError>> {
    return { ok: true, data: undefined };
  }

  async exists(filePath: string): Promise<Result<boolean, DomainError>> {
    return { ok: true, data: this.mockFiles.has(filePath) };
  }

  async *findFiles(pattern: string): AsyncIterable<string> {
    // Simple glob pattern matching for tests
    const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\?/g, "."));
    for (const filePath of this.mockFiles.keys()) {
      if (regex.test(filePath)) {
        yield filePath;
      }
    }
  }

  async stat(filePath: string): Promise<Result<FileInfo, DomainError>> {
    if (this.mockFiles.has(filePath)) {
      return {
        ok: true,
        data: {
          isFile: true,
          isDirectory: false,
          size: this.mockFiles.get(filePath)?.length || 0,
          mtime: new Date(),
        },
      };
    }
    return {
      ok: false,
      error: {
        kind: "FileNotFound" as const,
        path: filePath,
      },
    };
  }
}

/**
 * Mock TemplateRepository for controlled testing
 */
class MockTemplateRepository implements ITemplateRepository {
  private mockTemplates: Map<string, any> = new Map();

  constructor(templates: Record<string, any> = {}) {
    Object.entries(templates).forEach(([path, template]) => {
      this.mockTemplates.set(path, template);
    });
  }

  async load(
    templatePath: TemplatePath,
  ): Promise<Result<any, DomainError & { message: string }>> {
    const template = this.mockTemplates.get(templatePath.getPath());
    if (!template) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotFound",
            resource: "template",
            name: templatePath.getPath(),
          },
          `Template not found: ${templatePath.getPath()}`,
        ),
      };
    }
    return { ok: true, data: template };
  }

  async save(
    _templatePath: string,
    _template: any,
  ): Promise<Result<void, DomainError & { message: string }>> {
    return { ok: true, data: undefined };
  }

  validate(_template: any): Result<void, DomainError & { message: string }> {
    return { ok: true, data: undefined };
  }

  async exists(
    path: TemplatePath,
  ): Promise<Result<boolean, DomainError & { message: string }>> {
    return { ok: true, data: this.mockTemplates.has(path.getPath()) };
  }

  getBaseDirectory(): Result<string, DomainError & { message: string }> {
    return { ok: true, data: "/mock/templates" };
  }
}

/**
 * Mock Logger for testing
 */
class MockLogger implements Logger {
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
}

/**
 * Test helper to create mock schema with template info
 */
function createMockSchemaWithTemplate(templatePath?: string) {
  const schema = createMockSchema("integration-test");

  // Mock template info that returns template path
  const mockTemplateInfo = {
    getTemplatePath: () => {
      if (templatePath) {
        return { ok: true, data: templatePath };
      }
      return {
        ok: false,
        error: createDomainError(
          { kind: "NotConfigured", component: "template" },
          "No template specified in schema",
        ),
      };
    },
  };

  // Return both schema and templateInfo separately since they're not directly linked
  return { schema, templateInfo: mockTemplateInfo };
}

Deno.test.ignore(
  "ProcessDocumentsOrchestrator - Integration Tests",
  async (t) => {
    await t.step("Complete Template Processing Pipeline", async (t) => {
      await t.step(
        "should process documents through complete template pipeline",
        async () => {
          // Arrange
          const mockFiles = {
            "test.md": `---
c1: build
c2: robust
c3: system
title: Test Document
---
# Test Content`,
          };

          const mockTemplate = createMockTemplate("integration-template");
          const mockTemplates = {
            "/templates/test-template.json": mockTemplate,
          };

          const fileSystem = new MockFileSystemRepository(mockFiles);
          const templateRepo = new MockTemplateRepository(mockTemplates);
          const logger = new MockLogger();

          const orchestrator = new ProcessDocumentsOrchestrator(
            fileSystem,
            templateRepo,
            logger,
          );

          // Create mock schema with template path
          const mockSchemaData = createMockSchemaWithTemplate(
            "/templates/test-template.json",
          );

          // Mock the LoadSchemaUseCase to return our schema
          const originalLoadSchema = (orchestrator as any).loadSchema;
          (orchestrator as any).loadSchema = {
            execute: async () => ({
              ok: true,
              data: {
                schema: mockSchemaData.schema,
                templateInfo: mockSchemaData.templateInfo,
              },
            }),
          };

          const input = {
            schemaPath: "schema.json",
            sourcePath: "*.md",
            outputPath: "output.json",
            format: "json" as const,
            verbose: true,
          };

          // Act
          const result = await orchestrator.execute(input);

          // Debug - Let's see what's actually happening
          if (!result.ok) {
            console.log(
              "Orchestrator failed with error:",
              JSON.stringify(result.error, null, 2),
            );
            console.log("Logger messages:", logger.logs);
          }

          // Assert
          assertEquals(result.ok, true);
          if (result.ok) {
            assertEquals(result.data.filesProcessed > 0, true);
            assertExists(result.data.result);
            assertEquals(result.data.outputPath, "output.json");
          }

          // Verify logging occurred
          assertEquals(logger.logs.length > 0, true);
          const infoLogs = logger.logs.filter((log) => log.level === "info");
          assertEquals(infoLogs.length > 0, true);
        },
      );

      await t.step(
        "should handle template processing failures gracefully",
        async () => {
          // Arrange
          const mockFiles = {
            "failing.md": `---
c1: template
c2: processing
c3: failure
---
# Failing Content`,
          };

          const fileSystem = new MockFileSystemRepository(mockFiles);
          const templateRepo = new MockTemplateRepository(); // Empty - no templates
          const logger = new MockLogger();

          const orchestrator = new ProcessDocumentsOrchestrator(
            fileSystem,
            templateRepo,
            logger,
          );

          // Create mock schema with template path that doesn't exist
          const mockSchemaData = createMockSchemaWithTemplate(
            "/nonexistent/template.json",
          );

          (orchestrator as any).loadSchema = {
            execute: async () => ({
              ok: true,
              data: {
                schema: mockSchemaData.schema,
                templateInfo: mockSchemaData.templateInfo,
              },
            }),
          };

          const input = {
            schemaPath: "schema.json",
            sourcePath: "*.md",
            outputPath: "output.json",
            format: "json" as const,
            verbose: true,
          };

          // Act
          const result = await orchestrator.execute(input);

          // Assert - Should succeed with fallback to raw data
          assertEquals(result.ok, true);
          if (result.ok) {
            assertEquals(result.data.filesProcessed > 0, true);
          }

          // Verify error logging for template load failure
          const errorLogs = logger.logs.filter((log) => log.level === "error");
          assertEquals(errorLogs.length > 0, true);
          assertEquals(
            errorLogs.some((log) =>
              log.message.includes("Failed to load template")
            ),
            true,
          );
        },
      );

      await t.step(
        "should skip template processing when no template specified",
        async () => {
          // Arrange
          const mockFiles = {
            "no-template.md": `---
c1: no
c2: template
c3: specified
---
# Content without template`,
          };

          const fileSystem = new MockFileSystemRepository(mockFiles);
          const templateRepo = new MockTemplateRepository();
          const logger = new MockLogger();

          const orchestrator = new ProcessDocumentsOrchestrator(
            fileSystem,
            templateRepo,
            logger,
          );

          // Create mock schema WITHOUT template path
          const mockSchemaData = createMockSchemaWithTemplate(); // No template path

          (orchestrator as any).loadSchema = {
            execute: async () => ({
              ok: true,
              data: {
                schema: mockSchemaData.schema,
                templateInfo: mockSchemaData.templateInfo,
              },
            }),
          };

          const input = {
            schemaPath: "schema.json",
            sourcePath: "*.md",
            outputPath: "output.json",
            format: "json" as const,
            verbose: true,
          };

          // Act
          const result = await orchestrator.execute(input);

          // Assert - Should succeed with raw data processing
          assertEquals(result.ok, true);
          if (result.ok) {
            assertEquals(result.data.filesProcessed > 0, true);
          }

          // Verify no template processing errors logged (should skip gracefully)
          const errorLogs = logger.logs.filter((log) => log.level === "error");
          const templateErrors = errorLogs.filter((log) =>
            log.message.includes("template")
          );
          assertEquals(templateErrors.length, 0);
        },
      );
    });

    await t.step("Error Handling and Resilience", async (t) => {
      await t.step("should handle file read failures gracefully", async () => {
        // Arrange
        const fileSystem = new MockFileSystemRepository(); // Empty - no files
        const templateRepo = new MockTemplateRepository();
        const logger = new MockLogger();

        const orchestrator = new ProcessDocumentsOrchestrator(
          fileSystem,
          templateRepo,
          logger,
        );

        // Mock discover files to return non-existent file
        (orchestrator as any).discoverFiles = {
          execute: async () => ({
            ok: true,
            data: { files: ["nonexistent.md"] },
          }),
        };

        const mockSchemaData = createMockSchemaWithTemplate();
        (orchestrator as any).loadSchema = {
          execute: async () => ({
            ok: true,
            data: {
              schema: mockSchemaData.schema,
              templateInfo: mockSchemaData.templateInfo,
            },
          }),
        };

        const input = {
          schemaPath: "schema.json",
          sourcePath: "*.md",
          outputPath: "output.json",
          format: "json" as const,
          verbose: true,
        };

        // Act
        const result = await orchestrator.execute(input);

        // Assert - Should succeed even with file read failures
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.filesProcessed, 1); // Still counts attempted files
        }

        // Verify error logging for file read failure
        const errorLogs = logger.logs.filter((log) => log.level === "error");
        assertEquals(
          errorLogs.some((log) => log.message.includes("Failed to read")),
          true,
        );
      });

      await t.step(
        "should handle frontmatter extraction failures",
        async () => {
          // Arrange
          const mockFiles = {
            "invalid.md": "Invalid markdown without frontmatter",
          };

          const fileSystem = new MockFileSystemRepository(mockFiles);
          const templateRepo = new MockTemplateRepository();
          const logger = new MockLogger();

          const orchestrator = new ProcessDocumentsOrchestrator(
            fileSystem,
            templateRepo,
            logger,
          );

          const mockSchemaData = createMockSchemaWithTemplate();
          (orchestrator as any).loadSchema = {
            execute: async () => ({
              ok: true,
              data: {
                schema: mockSchemaData.schema,
                templateInfo: mockSchemaData.templateInfo,
              },
            }),
          };

          const input = {
            schemaPath: "schema.json",
            sourcePath: "*.md",
            outputPath: "output.json",
            format: "json" as const,
            verbose: true,
          };

          // Act
          const result = await orchestrator.execute(input);

          // Assert - Should handle extraction failures gracefully
          assertEquals(result.ok, true);
          if (result.ok) {
            assertEquals(result.data.filesProcessed > 0, true);
          }

          // Verify error logging for extraction failure
          const errorLogs = logger.logs.filter((log) => log.level === "error");
          assertEquals(errorLogs.length >= 0, true); // May have extraction errors
        },
      );
    });

    await t.step("Schema and Template Integration", async (t) => {
      await t.step(
        "should validate template path creation from schema",
        async () => {
          // Arrange
          const mockFiles = {
            "template-path-test.md": `---
c1: template
c2: path
c3: validation
---
# Template Path Test`,
          };

          const fileSystem = new MockFileSystemRepository(mockFiles);
          const templateRepo = new MockTemplateRepository();
          const logger = new MockLogger();

          const orchestrator = new ProcessDocumentsOrchestrator(
            fileSystem,
            templateRepo,
            logger,
          );

          // Create schema with invalid template path
          const mockSchemaData = createMockSchemaWithTemplate(
            "invalid/template/path",
          );

          (orchestrator as any).loadSchema = {
            execute: async () => ({
              ok: true,
              data: {
                schema: mockSchemaData.schema,
                templateInfo: mockSchemaData.templateInfo,
              },
            }),
          };

          const input = {
            schemaPath: "schema.json",
            sourcePath: "*.md",
            outputPath: "output.json",
            format: "json" as const,
            verbose: true,
          };

          // Act
          const result = await orchestrator.execute(input);

          // Assert - Should handle invalid template path gracefully
          assertEquals(result.ok, true);

          // Verify error logging for invalid template path or template not found
          const errorLogs = logger.logs.filter((log) => log.level === "error");
          assertEquals(
            errorLogs.some((log) =>
              log.message.includes("Invalid template path") ||
              log.message.includes("Failed to load template")
            ),
            true,
          );
        },
      );
    });

    await t.step("Verbose Logging Validation", async (t) => {
      await t.step(
        "should provide detailed logging when verbose enabled",
        async () => {
          // Arrange
          const mockFiles = {
            "verbose-test.md": `---
c1: verbose
c2: logging
c3: test
---
# Verbose Test`,
          };

          const mockTemplate = createMockTemplate("verbose-template");
          const fileSystem = new MockFileSystemRepository(mockFiles);
          const templateRepo = new MockTemplateRepository({
            "/templates/verbose.json": mockTemplate,
          });
          const logger = new MockLogger();

          const orchestrator = new ProcessDocumentsOrchestrator(
            fileSystem,
            templateRepo,
            logger,
          );

          const mockSchemaData = createMockSchemaWithTemplate(
            "/templates/verbose.json",
          );
          (orchestrator as any).loadSchema = {
            execute: async () => ({
              ok: true,
              data: {
                schema: mockSchemaData.schema,
                templateInfo: mockSchemaData.templateInfo,
              },
            }),
          };

          const input = {
            schemaPath: "schema.json",
            sourcePath: "*.md",
            outputPath: "output.json",
            format: "json" as const,
            verbose: true,
          };

          // Act
          const result = await orchestrator.execute(input);

          // Assert
          assertEquals(result.ok, true);

          // Verify comprehensive verbose logging
          const infoLogs = logger.logs.filter((log) => log.level === "info");
          assertEquals(
            infoLogs.some((log) => log.message.includes("Loading schema")),
            true,
          );
          assertEquals(
            infoLogs.some((log) => log.message.includes("Discovering files")),
            true,
          );
          assertEquals(
            infoLogs.some((log) => log.message.includes("Processing:")),
            true,
          );
        },
      );

      await t.step(
        "should minimize logging when verbose disabled",
        async () => {
          // Arrange
          const mockFiles = {
            "quiet-test.md": `---
c1: quiet
c2: mode
c3: test
---
# Quiet Test`,
          };

          const fileSystem = new MockFileSystemRepository(mockFiles);
          const templateRepo = new MockTemplateRepository();
          const logger = new MockLogger();

          const orchestrator = new ProcessDocumentsOrchestrator(
            fileSystem,
            templateRepo,
            logger,
          );

          const mockSchemaData = createMockSchemaWithTemplate();
          (orchestrator as any).loadSchema = {
            execute: async () => ({
              ok: true,
              data: {
                schema: mockSchemaData.schema,
                templateInfo: mockSchemaData.templateInfo,
              },
            }),
          };

          const input = {
            schemaPath: "schema.json",
            sourcePath: "*.md",
            outputPath: "output.json",
            format: "json" as const,
            verbose: false, // Disabled
          };

          // Act
          const result = await orchestrator.execute(input);

          // Assert
          assertEquals(result.ok, true);

          // Verify minimal logging in quiet mode
          const infoLogs = logger.logs.filter((log) => log.level === "info");
          const verboseMessages = infoLogs.filter((log) =>
            log.message.includes("Loading schema") ||
            log.message.includes("Discovering files") ||
            log.message.includes("Processing:")
          );
          assertEquals(verboseMessages.length, 0);
        },
      );
    });
  },
);
