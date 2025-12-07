import { assertEquals } from "@std/assert";
import { Result } from "../../../../src/domain/shared/types/result.ts";
import {
  DirectoryEntry,
  FileError,
  FileInfo,
} from "../../../../src/domain/shared/types/file-errors.ts";
import { FileSystemPort } from "../../../../src/infrastructure/ports/file-system-port.ts";
import {
  PipelineConfig,
  PipelineOrchestrator,
} from "../../../../src/application/services/pipeline-orchestrator.ts";

/**
 * Mock FileSystemPort for testing PipelineOrchestrator
 */
class MockFileSystemPort implements FileSystemPort {
  private files: Map<string, string> = new Map();
  private directories: Map<string, DirectoryEntry[]> = new Map();
  private errors: Map<string, FileError> = new Map();

  constructor() {
    this.setupDefaultFiles();
  }

  private setupDefaultFiles() {
    // Default schema file with x-frontmatter-part for multiple document support
    this.files.set(
      "/test/schema.json",
      JSON.stringify({
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          documents: {
            type: "array",
            "x-frontmatter-part": true,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                author: { type: "string" },
              },
            },
          },
        },
      }),
    );

    // Default template file
    this.files.set(
      "/test/template.json",
      JSON.stringify({
        output: {
          title: "${title}",
          author: "${author}",
        },
      }),
    );

    // Default markdown file
    this.files.set(
      "/test/document.md",
      `---
title: Test Document
author: Test Author
---

# Test Content

This is a test document.`,
    );

    // Directory entries
    this.directories.set("/test/docs", [
      { name: "doc1.md", isFile: true, isDirectory: false },
      { name: "doc2.md", isFile: true, isDirectory: false },
    ]);

    this.files.set(
      "/test/docs/doc1.md",
      `---
title: Document 1
author: Author 1
---

Content 1`,
    );

    this.files.set(
      "/test/docs/doc2.md",
      `---
title: Document 2
author: Author 2
---

Content 2`,
    );
  }

  setFileContent(path: string, content: string): void {
    this.files.set(path, content);
  }

  setDirectoryEntries(path: string, entries: DirectoryEntry[]): void {
    this.directories.set(path, entries);
  }

  setError(path: string, error: FileError): void {
    this.errors.set(path, error);
  }

  readTextFile(path: string): Promise<Result<string, FileError>> {
    if (this.errors.has(path)) {
      return Promise.resolve(Result.error(this.errors.get(path)!));
    }

    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.resolve(Result.error({ kind: "FileNotFound", path }));
    }

    return Promise.resolve(Result.ok(content));
  }

  writeTextFile(
    path: string,
    content: string,
  ): Promise<Result<void, FileError>> {
    if (this.errors.has(path)) {
      return Promise.resolve(Result.error(this.errors.get(path)!));
    }

    this.files.set(path, content);
    return Promise.resolve(Result.ok(undefined));
  }

  stat(path: string): Promise<Result<FileInfo, FileError>> {
    if (this.errors.has(path)) {
      return Promise.resolve(Result.error(this.errors.get(path)!));
    }

    if (this.files.has(path)) {
      return Promise.resolve(Result.ok({
        isFile: true,
        isDirectory: false,
        size: this.files.get(path)!.length,
        mtime: new Date(),
      }));
    }

    if (this.directories.has(path)) {
      return Promise.resolve(Result.ok({
        isFile: false,
        isDirectory: true,
        size: 0,
        mtime: new Date(),
      }));
    }

    return Promise.resolve(Result.error({ kind: "FileNotFound", path }));
  }

  exists(path: string): Promise<Result<boolean, FileError>> {
    if (this.errors.has(path)) {
      return Promise.resolve(Result.error(this.errors.get(path)!));
    }

    return Promise.resolve(
      Result.ok(this.files.has(path) || this.directories.has(path)),
    );
  }

  readDir(path: string): Promise<Result<DirectoryEntry[], FileError>> {
    if (this.errors.has(path)) {
      return Promise.resolve(Result.error(this.errors.get(path)!));
    }

    const entries = this.directories.get(path);
    if (entries === undefined) {
      return Promise.resolve(Result.error({ kind: "DirectoryNotFound", path }));
    }

    return Promise.resolve(Result.ok(entries));
  }

  /**
   * Expands a glob pattern and returns matching file paths.
   * Issue 6 fix: Custom adapters can now provide their own glob expansion.
   */
  expandGlob(
    pattern: string,
    _root?: string,
  ): Promise<Result<string[], FileError>> {
    const files: string[] = [];

    // Extract the base directory from the pattern
    // For patterns like "/test/glob-test/**/*.md", base is "/test/glob-test"
    // For patterns like "**/*.md", base is "." (use cwd)
    let baseDir = "";
    const parts = pattern.split("/");
    for (let i = 0; i < parts.length; i++) {
      if (
        parts[i].includes("*") || parts[i].includes("?") ||
        parts[i].includes("[")
      ) {
        break;
      }
      if (parts[i]) {
        baseDir += (baseDir || pattern.startsWith("/") ? "/" : "") + parts[i];
      }
    }

    if (!baseDir) {
      baseDir = this.cwd();
    }

    // Check if base directory exists (for absolute paths in pattern)
    if (
      pattern.startsWith("/") && !this.directories.has(baseDir) &&
      !this.files.has(baseDir)
    ) {
      // Base directory doesn't exist - return empty
      return Promise.resolve(Result.ok(files));
    }

    // Simple glob matching for tests - match files based on pattern
    for (const [path, _content] of this.files) {
      // Check if path is under base directory
      if (!path.startsWith(baseDir)) {
        continue;
      }

      // Check extension matches
      if (pattern.includes("*.md") && !path.endsWith(".md")) {
        continue;
      }

      files.push(path);
    }

    return Promise.resolve(Result.ok(files));
  }

  /**
   * Gets the current working directory.
   * Issue 6 fix: Custom adapters can provide their own cwd.
   */
  cwd(): string {
    return "/test";
  }
}

Deno.test("PipelineOrchestrator - create successfully", () => {
  const fileSystem = new MockFileSystemPort();
  const result = PipelineOrchestrator.create(fileSystem);

  assertEquals(result.isOk(), true);
  const orchestrator = result.unwrap();
  assertEquals(typeof orchestrator, "object");
  assertEquals(orchestrator !== null, true);
});

Deno.test("PipelineOrchestrator - execute single file successfully", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 1);
  assertEquals(pipelineResult.outputPath, "/test/output.json");
  assertEquals(pipelineResult.metadata.outputFormat, "json");

  // Verify output file was written
  const outputContent = await fileSystem.readTextFile("/test/output.json");
  assertEquals(outputContent.isOk(), true);
});

Deno.test("PipelineOrchestrator - execute directory successfully", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/docs",
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 2);
});

Deno.test("PipelineOrchestrator - schema file not found", async () => {
  const fileSystem = new MockFileSystemPort();
  fileSystem.setError("/test/missing-schema.json", {
    kind: "FileNotFound",
    path: "/test/missing-schema.json",
  });
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/missing-schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "SCHEMA_READ_ERROR");
});

Deno.test("PipelineOrchestrator - invalid schema path", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/invalid.txt", // not .json
    templatePath: "/test/template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_SCHEMA_PATH");
});

Deno.test("PipelineOrchestrator - invalid JSON in schema", async () => {
  const fileSystem = new MockFileSystemPort();
  fileSystem.setFileContent("/test/invalid-schema.json", "{ invalid json");
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/invalid-schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "SCHEMA_PARSE_ERROR");
});

Deno.test("PipelineOrchestrator - template file not found", async () => {
  const fileSystem = new MockFileSystemPort();
  fileSystem.setError("/test/missing-template.json", {
    kind: "FileNotFound",
    path: "/test/missing-template.json",
  });
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/missing-template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "TEMPLATE_LOAD_ERROR");
});

Deno.test("PipelineOrchestrator - invalid template path", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/invalid.txt", // not .json or .yaml
    inputPath: "/test/document.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "INVALID_TEMPLATE_PATH");
});

Deno.test("PipelineOrchestrator - input file not found", async () => {
  const fileSystem = new MockFileSystemPort();
  fileSystem.setError("/test/missing.md", {
    kind: "FileNotFound",
    path: "/test/missing.md",
  });
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/missing.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  // Issue 6 fix: non-existent paths now return INPUT_NOT_FOUND instead of NO_FILES_FOUND
  assertEquals(error.code, "INPUT_NOT_FOUND");
});

Deno.test("PipelineOrchestrator - invalid input path type", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/dev/null", // neither file nor directory in our mock
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  // Issue 6 fix: non-existent paths now return INPUT_NOT_FOUND instead of NO_FILES_FOUND
  assertEquals(error.code, "INPUT_NOT_FOUND");
});

Deno.test("PipelineOrchestrator - directory with no markdown files", async () => {
  const fileSystem = new MockFileSystemPort();
  fileSystem.setDirectoryEntries("/test/empty", [
    { name: "readme.txt", isFile: true, isDirectory: false },
  ]);
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/empty",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "NO_DOCUMENTS_FOUND");
});

Deno.test("PipelineOrchestrator - frontmatter parsing without frontmatter", async () => {
  const fileSystem = new MockFileSystemPort();
  fileSystem.setFileContent(
    "/test/no-frontmatter.md",
    "# Just Content\n\nNo frontmatter here.",
  );
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/no-frontmatter.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 1);
});

Deno.test("PipelineOrchestrator - output write error", async () => {
  const fileSystem = new MockFileSystemPort();
  fileSystem.setError("/test/readonly-output.json", {
    kind: "PermissionDenied",
    path: "/test/readonly-output.json",
    operation: "write",
  });
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/readonly-output.json",
  };

  const result = await orchestrator.execute(config);

  // With resilient error handling, processing continues with warnings
  assertEquals(result.isError(), false);
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.metadata.warnings! > 0, true);
  assertEquals(pipelineResult.metadata.errors![0].code, "OUTPUT_WRITE_ERROR");
});

Deno.test("PipelineOrchestrator - complex frontmatter parsing", async () => {
  const fileSystem = new MockFileSystemPort();
  fileSystem.setFileContent(
    "/test/complex.md",
    `---
title: "Complex Document"
author: 'John Doe'
tags: one, two, three
published: true
---

# Content

This has complex frontmatter.`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/complex.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 1);
});

Deno.test("PipelineOrchestrator - execution timing measurement", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/output.json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  assertEquals(typeof pipelineResult.executionTime, "number");
  assertEquals(pipelineResult.executionTime >= 0, true);
});

Deno.test("PipelineOrchestrator - default output format", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/output.json",
    // no outputFormat specified - should default to "json"
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.metadata.outputFormat, "json");
});

Deno.test("PipelineOrchestrator - yaml output format", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/document.md",
    outputPath: "/test/output.yaml",
    outputFormat: "yaml",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.metadata.outputFormat, "yaml");
});

// Tests for Issue 2 fix: recursive directory scanning and .markdown extension support

Deno.test("PipelineOrchestrator - directory with .markdown extension files", async () => {
  const fileSystem = new MockFileSystemPort();
  // Set up directory with .markdown extension files
  fileSystem.setDirectoryEntries("/test/markdown-docs", [
    { name: "doc1.markdown", isFile: true, isDirectory: false },
    { name: "doc2.md", isFile: true, isDirectory: false },
  ]);
  fileSystem.setFileContent(
    "/test/markdown-docs/doc1.markdown",
    `---
title: Markdown Extension File
author: Author 1
---

Content in .markdown file`,
  );
  fileSystem.setFileContent(
    "/test/markdown-docs/doc2.md",
    `---
title: MD Extension File
author: Author 2
---

Content in .md file`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/markdown-docs",
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  // Should find both .md and .markdown files
  assertEquals(pipelineResult.processedDocuments, 2);
});

Deno.test("PipelineOrchestrator - recursive directory scanning", async () => {
  const fileSystem = new MockFileSystemPort();
  // Set up nested directory structure
  fileSystem.setDirectoryEntries("/test/nested-docs", [
    { name: "root.md", isFile: true, isDirectory: false },
    { name: "subdir", isFile: false, isDirectory: true },
  ]);
  fileSystem.setDirectoryEntries("/test/nested-docs/subdir", [
    { name: "nested.md", isFile: true, isDirectory: false },
  ]);
  fileSystem.setFileContent(
    "/test/nested-docs/root.md",
    `---
title: Root Document
author: Root Author
---

Root content`,
  );
  fileSystem.setFileContent(
    "/test/nested-docs/subdir/nested.md",
    `---
title: Nested Document
author: Nested Author
---

Nested content`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/nested-docs",
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  // Should find files in both root and subdirectory
  assertEquals(pipelineResult.processedDocuments, 2);
});

Deno.test("PipelineOrchestrator - deeply nested directory scanning", async () => {
  const fileSystem = new MockFileSystemPort();
  // Set up deeply nested directory structure
  fileSystem.setDirectoryEntries("/test/deep", [
    { name: "level1", isFile: false, isDirectory: true },
  ]);
  fileSystem.setDirectoryEntries("/test/deep/level1", [
    { name: "level2", isFile: false, isDirectory: true },
  ]);
  fileSystem.setDirectoryEntries("/test/deep/level1/level2", [
    { name: "deep-file.md", isFile: true, isDirectory: false },
  ]);
  fileSystem.setFileContent(
    "/test/deep/level1/level2/deep-file.md",
    `---
title: Deeply Nested
author: Deep Author
---

Deep content`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/deep",
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  // Should find the deeply nested file
  assertEquals(pipelineResult.processedDocuments, 1);
});

Deno.test("PipelineOrchestrator - directory with .mdown extension files", async () => {
  const fileSystem = new MockFileSystemPort();
  // Set up directory with .mdown extension files
  fileSystem.setDirectoryEntries("/test/mdown-docs", [
    { name: "doc.mdown", isFile: true, isDirectory: false },
  ]);
  fileSystem.setFileContent(
    "/test/mdown-docs/doc.mdown",
    `---
title: Mdown Extension File
author: Mdown Author
---

Content in .mdown file`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/mdown-docs",
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  // Should find .mdown files
  assertEquals(pipelineResult.processedDocuments, 1);
});

// ============================================================================
// Issue 6: Custom FileSystemPort adapter glob/directory support tests
// ============================================================================

Deno.test("PipelineOrchestrator - glob pattern uses custom adapter expandGlob (Issue 6)", async () => {
  // Issue 6 fix: Glob patterns should be processed through FileSystemPort
  // instead of falling back to native Deno APIs
  const fileSystem = new MockFileSystemPort();

  // Add additional markdown files for glob matching
  fileSystem.setFileContent(
    "/test/glob-test/article1.md",
    `---
title: Article 1
author: Author 1
---

Article 1 content`,
  );

  fileSystem.setFileContent(
    "/test/glob-test/article2.md",
    `---
title: Article 2
author: Author 2
---

Article 2 content`,
  );

  fileSystem.setDirectoryEntries("/test/glob-test", [
    { name: "article1.md", isFile: true, isDirectory: false },
    { name: "article2.md", isFile: true, isDirectory: false },
  ]);

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/glob-test/**/*.md", // Glob pattern
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  // Should process files found through custom adapter's expandGlob
  assertEquals(result.isOk(), true);
  const pipelineResult = result.unwrap();
  assertEquals(pipelineResult.processedDocuments, 2);
});

Deno.test("PipelineOrchestrator - glob pattern with no matches returns error (Issue 6)", async () => {
  const fileSystem = new MockFileSystemPort();
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/nonexistent/**/*.md", // Glob pattern that won't match
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "NO_FILES_FOUND");
});

Deno.test("PipelineOrchestrator - custom adapter cwd is used for glob resolution (Issue 6)", async () => {
  // Issue 6 fix: The custom adapter's cwd() should be used for relative glob patterns
  const fileSystem = new MockFileSystemPort();

  // Mock cwd returns "/test", so "**/*.md" should find files under /test
  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();

  const config: PipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "**/*.md", // Relative glob pattern - should use adapter's cwd
    outputPath: "/test/output.json",
    outputFormat: "json",
  };

  const result = await orchestrator.execute(config);

  // Should find files using the adapter's cwd ("/test")
  assertEquals(result.isOk(), true);
});
