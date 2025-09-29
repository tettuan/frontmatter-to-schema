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
    // Default schema file
    this.files.set(
      "/test/schema.json",
      JSON.stringify({
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
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
  assertEquals(error.code, "INPUT_ACCESS_ERROR");
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
  assertEquals(error.code, "INPUT_ACCESS_ERROR");
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

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, "OUTPUT_WRITE_ERROR");
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
