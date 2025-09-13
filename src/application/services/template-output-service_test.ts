/**
 * Template Output Service Test Suite
 * Addresses critical issues identified in Issue #746
 */

import { assertEquals } from "jsr:@std/assert";
import {
  type OutputContext,
  TemplateOutputService,
} from "./template-output-service.ts";
import type {
  FileInfo,
  FileSystemPort,
} from "../../infrastructure/ports/index.ts";
import type { DomainError, Result } from "../../domain/core/result.ts";

// Mock FileSystem for testing
class MockFileSystem implements FileSystemPort {
  private files = new Map<string, string>();
  private shouldFailWrites = false;

  setWriteFailure(shouldFail: boolean) {
    this.shouldFailWrites = shouldFail;
  }

  getWrittenContent(path: string): string | undefined {
    return this.files.get(path);
  }

  readFile(path: string): Promise<Result<string, DomainError>> {
    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.resolve({
        ok: false,
        error: { kind: "FileNotFound", path },
      });
    }
    return Promise.resolve({ ok: true, data: content });
  }

  writeFile(path: string, content: string): Promise<Result<void, DomainError>> {
    if (this.shouldFailWrites) {
      return Promise.resolve({
        ok: false,
        error: { kind: "WriteError", path, details: "Mock write failure" },
      });
    }
    this.files.set(path, content);
    return Promise.resolve({ ok: true, data: undefined });
  }

  exists(_path: string): Promise<Result<boolean, DomainError>> {
    return Promise.resolve({ ok: true, data: true });
  }

  listFiles(
    _path: string,
    _pattern?: string,
  ): Promise<Result<FileInfo[], DomainError>> {
    return Promise.resolve({ ok: true, data: [] });
  }

  createDirectory(_path: string): Promise<Result<void, DomainError>> {
    return Promise.resolve({ ok: true, data: undefined });
  }

  deleteFile(_path: string): Promise<Result<void, DomainError>> {
    return Promise.resolve({ ok: true, data: undefined });
  }
}

Deno.test("TemplateOutputService - Factory Method", async (t) => {
  await t.step("should create service successfully", () => {
    const mockFileSystem = new MockFileSystem();
    const result = TemplateOutputService.create(mockFileSystem);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(typeof result.data, "object");
    }
  });
});

Deno.test("TemplateOutputService - Basic Template Variable Replacement", async (t) => {
  const mockFileSystem = new MockFileSystem();
  const serviceResult = TemplateOutputService.create(mockFileSystem);
  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  await t.step("should replace simple template variables", async () => {
    const context: OutputContext = {
      schemaData: {
        type: "object",
        properties: {},
      },
      templateContent: `{
  "version": "{version}",
  "description": "{description}"
}`,
      documentData: [{
        version: "1.0.0",
        description: "Test description",
      }],
      outputPath: "/test/output.json",
    };

    const result = await service.generateOutput(context);
    assertEquals(result.ok, true);

    const writtenContent = mockFileSystem.getWrittenContent(
      "/test/output.json",
    );
    assertEquals(writtenContent?.includes('"version": "1.0.0"'), true);
    assertEquals(
      writtenContent?.includes('"description": "Test description"'),
      true,
    );
  });

  await t.step("should handle missing variables gracefully", async () => {
    const context: OutputContext = {
      schemaData: {
        type: "object",
        properties: {},
      },
      templateContent: `{
  "version": "{version}",
  "missing": "{nonexistent}"
}`,
      documentData: [{
        version: "1.0.0",
      }],
      outputPath: "/test/output.json",
    };

    const result = await service.generateOutput(context);
    assertEquals(result.ok, true);

    const writtenContent = mockFileSystem.getWrittenContent(
      "/test/output.json",
    );
    assertEquals(writtenContent?.includes('"version": "1.0.0"'), true);
    // Missing variables should remain as placeholders or be handled gracefully
  });
});

Deno.test("TemplateOutputService - x-derived-from Processing", async (t) => {
  const mockFileSystem = new MockFileSystem();
  const serviceResult = TemplateOutputService.create(mockFileSystem);
  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  await t.step(
    "should process x-derived-from aggregation correctly",
    async () => {
      const context: OutputContext = {
        schemaData: {
          type: "object",
          properties: {
            availableConfigs: {
              type: "array",
              "x-derived-from": "commands[].c1",
            },
          },
        },
        templateContent: `{
  "tools": {
    "availableConfigs": "{availableConfigs}"
  }
}`,
        documentData: [
          {
            commands: [{ c1: "git", c2: "create" }, { c1: "build", c2: "run" }],
          },
          {
            commands: [{ c1: "test", c2: "execute" }, {
              c1: "git",
              c2: "commit",
            }],
          },
        ],
        outputPath: "/test/output.json",
      };

      const result = await service.generateOutput(context);
      assertEquals(result.ok, true);

      const writtenContent = mockFileSystem.getWrittenContent(
        "/test/output.json",
      );

      // Should contain aggregated values from commands[].c1
      assertEquals(writtenContent?.includes("git"), true);
      assertEquals(writtenContent?.includes("build"), true);
      assertEquals(writtenContent?.includes("test"), true);
    },
  );

  await t.step(
    "should handle unique aggregation with x-derived-unique",
    async () => {
      const context: OutputContext = {
        schemaData: {
          type: "object",
          properties: {
            uniqueConfigs: {
              type: "array",
              "x-derived-from": "commands[].c1",
              "x-derived-unique": true,
            },
          },
        },
        templateContent: `{
  "tools": {
    "availableConfigs": "{uniqueConfigs}"
  }
}`,
        documentData: [
          {
            commands: [{ c1: "git", c2: "create" }, {
              c1: "git",
              c2: "commit",
            }],
          },
          { commands: [{ c1: "build", c2: "run" }, { c1: "git", c2: "push" }] },
        ],
        outputPath: "/test/output.json",
      };

      const result = await service.generateOutput(context);
      assertEquals(result.ok, true);

      const writtenContent = mockFileSystem.getWrittenContent(
        "/test/output.json",
      );

      // Should contain unique values only
      const gitMatches = (writtenContent?.match(/git/g) || []).length;
      assertEquals(gitMatches, 1); // Should appear only once due to uniqueness
    },
  );
});

Deno.test("TemplateOutputService - x-frontmatter-part Processing", async (t) => {
  const mockFileSystem = new MockFileSystem();
  const serviceResult = TemplateOutputService.create(mockFileSystem);
  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  await t.step(
    "should process x-frontmatter-part arrays correctly",
    async () => {
      const context: OutputContext = {
        schemaData: {
          type: "object",
          properties: {
            commands: {
              type: "array",
              "x-frontmatter-part": true,
              items: {
                type: "object",
                properties: {
                  c1: { type: "string" },
                  c2: { type: "string" },
                  c3: { type: "string" },
                },
              },
            },
          },
        },
        templateContent: `{
  "tools": {
    "commands": "{commands}"
  }
}`,
        documentData: [
          {
            commands: [
              { c1: "git", c2: "create", c3: "refinement-issue" },
              { c1: "build", c2: "run", c3: "tests" },
            ],
          },
        ],
        outputPath: "/test/output.json",
      };

      const result = await service.generateOutput(context);
      assertEquals(result.ok, true);

      const writtenContent = mockFileSystem.getWrittenContent(
        "/test/output.json",
      );

      // Should contain the commands array from frontmatter
      assertEquals(writtenContent?.includes("git"), true);
      assertEquals(writtenContent?.includes("create"), true);
      assertEquals(writtenContent?.includes("refinement-issue"), true);
    },
  );
});

Deno.test("TemplateOutputService - Complex Schema with Mixed Features", async (t) => {
  const mockFileSystem = new MockFileSystem();
  const serviceResult = TemplateOutputService.create(mockFileSystem);
  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  await t.step(
    "should handle schema with both x-derived-from and x-frontmatter-part",
    async () => {
      const context: OutputContext = {
        schemaData: {
          type: "object",
          properties: {
            version: { type: "string" },
            description: { type: "string" },
            tools: {
              type: "object",
              properties: {
                availableConfigs: {
                  type: "array",
                  "x-derived-from": "commands[].c1",
                  "x-derived-unique": true,
                },
                commands: {
                  type: "array",
                  "x-frontmatter-part": true,
                },
              },
            },
          },
        },
        templateContent: `{
  "version": "{version}",
  "description": "{description}",
  "tools": {
    "availableConfigs": "{tools.availableConfigs}",
    "commands": "{tools.commands}"
  }
}`,
        documentData: [
          {
            version: "1.0.0",
            description: "Creates a git refinement issue for code improvements",
            commands: [
              { c1: "git", c2: "create", c3: "refinement-issue" },
            ],
          },
        ],
        outputPath: "/test/output.json",
      };

      const result = await service.generateOutput(context);
      assertEquals(result.ok, true);

      const writtenContent = mockFileSystem.getWrittenContent(
        "/test/output.json",
      );

      // Should contain version and description replacements
      assertEquals(writtenContent?.includes('"version": "1.0.0"'), true);
      assertEquals(
        writtenContent?.includes(
          '"description": "Creates a git refinement issue for code improvements"',
        ),
        true,
      );

      // Should contain derived availableConfigs
      assertEquals(writtenContent?.includes('"git"'), true);

      // Should contain frontmatter commands
      assertEquals(writtenContent?.includes('"create"'), true);
      assertEquals(writtenContent?.includes('"refinement-issue"'), true);
    },
  );
});

Deno.test("TemplateOutputService - Error Handling", async (t) => {
  const mockFileSystem = new MockFileSystem();
  const serviceResult = TemplateOutputService.create(mockFileSystem);
  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  await t.step("should handle file write errors", async () => {
    mockFileSystem.setWriteFailure(true);

    const context: OutputContext = {
      schemaData: { type: "object", properties: {} },
      templateContent: `{"test": "content"}`,
      documentData: [{}],
      outputPath: "/test/output.json",
    };

    const result = await service.generateOutput(context);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "FileWriteError");
    }
  });

  await t.step("should handle malformed template gracefully", async () => {
    mockFileSystem.setWriteFailure(false);

    const context: OutputContext = {
      schemaData: { type: "object", properties: {} },
      templateContent: `{"unclosed": "{malformed}`,
      documentData: [{}],
      outputPath: "/test/output.json",
    };

    // Should not throw, but may produce unprocessed output
    const result = await service.generateOutput(context);
    // The service should still attempt to process and write, even if template is malformed
    assertEquals(result.ok, true);
  });
});

Deno.test("TemplateOutputService - Regression Tests for Issue #746", async (t) => {
  const mockFileSystem = new MockFileSystem();
  const serviceResult = TemplateOutputService.create(mockFileSystem);
  assertEquals(serviceResult.ok, true);
  if (!serviceResult.ok) return;

  const service = serviceResult.data;

  await t.step(
    "should NOT output unprocessed {version} and {description} variables",
    async () => {
      const context: OutputContext = {
        schemaData: {
          type: "object",
          properties: {
            version: { type: "string" },
            description: { type: "string" },
          },
        },
        templateContent: `{
  "version": "{version}",
  "description": "{description}"
}`,
        documentData: [{
          version: "1.0.0",
          description: "Test description",
        }],
        outputPath: "/test/output.json",
      };

      const result = await service.generateOutput(context);
      assertEquals(result.ok, true);

      const writtenContent = mockFileSystem.getWrittenContent(
        "/test/output.json",
      );

      // CRITICAL: Should NOT contain unprocessed variables
      assertEquals(writtenContent?.includes('"{version}"'), false);
      assertEquals(writtenContent?.includes('"{description}"'), false);

      // Should contain actual values
      assertEquals(writtenContent?.includes('"1.0.0"'), true);
      assertEquals(writtenContent?.includes('"Test description"'), true);
    },
  );

  await t.step(
    "should populate availableConfigs array with values from commands[].c1",
    async () => {
      const context: OutputContext = {
        schemaData: {
          type: "object",
          properties: {
            tools: {
              type: "object",
              properties: {
                availableConfigs: {
                  type: "array",
                  "x-derived-from": "commands[].c1",
                },
              },
            },
          },
        },
        templateContent: `{
  "tools": {
    "availableConfigs": "{tools.availableConfigs}"
  }
}`,
        documentData: [{
          commands: [
            { c1: "git", c2: "create", c3: "refinement-issue" },
          ],
        }],
        outputPath: "/test/output.json",
      };

      const result = await service.generateOutput(context);
      assertEquals(result.ok, true);

      const writtenContent = mockFileSystem.getWrittenContent(
        "/test/output.json",
      );

      // CRITICAL: Should NOT have empty availableConfigs array
      assertEquals(writtenContent?.includes('"availableConfigs": []'), false);

      // Should contain actual values from commands[].c1
      assertEquals(writtenContent?.includes('"git"'), true);
    },
  );

  await t.step(
    "should populate commands array with frontmatter objects",
    async () => {
      const context: OutputContext = {
        schemaData: {
          type: "object",
          properties: {
            tools: {
              type: "object",
              properties: {
                commands: {
                  type: "array",
                  "x-frontmatter-part": true,
                },
              },
            },
          },
        },
        templateContent: `{
  "tools": {
    "commands": "{tools.commands}"
  }
}`,
        documentData: [{
          commands: [
            { c1: "git", c2: "create", c3: "refinement-issue" },
          ],
        }],
        outputPath: "/test/output.json",
      };

      const result = await service.generateOutput(context);
      assertEquals(result.ok, true);

      const writtenContent = mockFileSystem.getWrittenContent(
        "/test/output.json",
      );

      // CRITICAL: Should NOT have empty commands array
      assertEquals(writtenContent?.includes('"commands": []'), false);

      // Should contain actual frontmatter command objects
      assertEquals(writtenContent?.includes('"c1": "git"'), true);
      assertEquals(writtenContent?.includes('"c2": "create"'), true);
      assertEquals(writtenContent?.includes('"c3": "refinement-issue"'), true);
    },
  );
});
