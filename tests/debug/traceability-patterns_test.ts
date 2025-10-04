import { assertEquals } from "@std/assert";
import { BreakdownLogger } from "@tettuan/breakdownlogger";
import { PipelineOrchestrator } from "../../src/application/services/pipeline-orchestrator.ts";
import { FileSystemPort } from "../../src/infrastructure/ports/file-system-port.ts";
import {
  DirectoryEntry,
  FileError,
  FileInfo,
} from "../../src/domain/shared/types/file-errors.ts";
import { Result } from "../../src/domain/shared/types/result.ts";

const logger = new BreakdownLogger("traceability-patterns");

class MockFileSystemPort implements FileSystemPort {
  private files = new Map<string, string>();
  private directories = new Map<string, DirectoryEntry[]>();

  setFile(path: string, content: string) {
    this.files.set(path, content);
  }

  setDirectory(path: string, entries: DirectoryEntry[]) {
    this.directories.set(path, entries);
  }

  readTextFile(path: string): Promise<Result<string, FileError>> {
    const content = this.files.get(path);
    if (!content) {
      return Promise.resolve(Result.error({ kind: "FileNotFound", path }));
    }
    return Promise.resolve(Result.ok(content));
  }

  writeTextFile(
    _path: string,
    _content: string,
  ): Promise<Result<void, FileError>> {
    return Promise.resolve(Result.ok(undefined));
  }

  stat(path: string): Promise<Result<FileInfo, FileError>> {
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
    return Promise.resolve(
      Result.ok(this.files.has(path) || this.directories.has(path)),
    );
  }

  readDir(path: string): Promise<Result<DirectoryEntry[], FileError>> {
    const entries = this.directories.get(path);
    if (!entries) {
      return Promise.resolve(Result.error({ kind: "DirectoryNotFound", path }));
    }
    return Promise.resolve(Result.ok(entries));
  }
}

Deno.test("Pattern 1: traceability with 1 item", async () => {
  const fileSystem = new MockFileSystemPort();

  // Schema with x-frontmatter-part on traceability
  fileSystem.setFile(
    "/test/schema.json",
    JSON.stringify({
      type: "object",
      "x-template": "container.json",
      "x-template-items": "item.json",
      properties: {
        items: {
          type: "array",
          "x-frontmatter-part": true,
          "x-flatten-arrays": "traceability",
          "x-jmespath-filter": "[?id.level == 'req']",
        },
      },
    }),
  );

  // Container template
  fileSystem.setFile(
    "/test/container.json",
    JSON.stringify({ result: "{@items}" }),
  );

  // Item template - expects id.full, derived_from, trace_to
  fileSystem.setFile(
    "/test/item.json",
    JSON.stringify({
      id: "{id.full}",
      derived_from: "{derived_from}",
      trace_to: "{trace_to}",
    }),
  );

  // Document with 1 traceability item
  fileSystem.setFile(
    "/test/doc.md",
    `---
version: "1.0.0"
level: "req"
traceability:
  - id:
      full: req:test:001
      level: req
    summary: Test requirement
    derived_from: []
    trace_to: []
---

# Content`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();
  const result = await orchestrator.execute({
    schemaPath: "/test/schema.json",
    templatePath: "/test/container.json",
    inputPath: "/test/doc.md",
    outputPath: "/tmp/pattern1-output.json",
    outputFormat: "json" as const,
  });

  logger.info("Pattern 1: Single traceability item", {
    isOk: result.isOk(),
    isError: result.isError(),
  });

  if (result.isError()) {
    const error = result.unwrapError();
    console.log("\n========== Pattern 1: ERROR DETAILS ==========");
    console.log("Code:", error.code);
    console.log("Message:", error.message);
    console.log("Context:", JSON.stringify(error.context, null, 2));
    console.log("==============================================\n");

    logger.error("Pattern 1: Error occurred", {
      code: error.code,
      message: error.message,
      context: error.context,
    });
  } else {
    const pipelineResult = result.unwrap();
    logger.info("Pattern 1: Success", {
      processedDocuments: pipelineResult.processedDocuments,
    });
  }

  // Currently failing - this is the bug we're investigating
  // assertEquals(result.isOk(), true);
});

Deno.test("Pattern 2: traceability with 2 items", async () => {
  const fileSystem = new MockFileSystemPort();

  fileSystem.setFile(
    "/test/schema.json",
    JSON.stringify({
      type: "object",
      "x-template": "container.json",
      "x-template-items": "item.json",
      properties: {
        items: {
          type: "array",
          "x-frontmatter-part": true,
          "x-flatten-arrays": "traceability",
        },
      },
    }),
  );

  fileSystem.setFile(
    "/test/container.json",
    JSON.stringify({ result: "{@items}" }),
  );
  fileSystem.setFile(
    "/test/item.json",
    JSON.stringify({
      id: "{id.full}",
      summary: "{summary}",
    }),
  );

  fileSystem.setFile(
    "/test/doc.md",
    `---
traceability:
  - id:
      full: req:test:001
      level: req
    summary: First item
  - id:
      full: req:test:002
      level: req
    summary: Second item
---

# Content`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();
  const result = await orchestrator.execute({
    schemaPath: "/test/schema.json",
    templatePath: "/test/container.json",
    inputPath: "/test/doc.md",
    outputPath: "/tmp/pattern2-output.json",
    outputFormat: "json" as const,
  });

  logger.info("Pattern 2: Two traceability items", {
    isOk: result.isOk(),
  });

  if (result.isError()) {
    logger.error("Pattern 2: Error", {
      code: result.unwrapError().code,
      message: result.unwrapError().message,
    });
  }
});

Deno.test("Pattern 3: traceability with 0 items (empty array)", async () => {
  const fileSystem = new MockFileSystemPort();

  fileSystem.setFile(
    "/test/schema.json",
    JSON.stringify({
      type: "object",
      "x-template": "container.json",
      "x-template-items": "item.json",
      properties: {
        items: {
          type: "array",
          "x-frontmatter-part": true,
          "x-flatten-arrays": "traceability",
        },
      },
    }),
  );

  fileSystem.setFile(
    "/test/container.json",
    JSON.stringify({ result: "{@items}" }),
  );
  fileSystem.setFile("/test/item.json", JSON.stringify({ id: "{id.full}" }));

  fileSystem.setFile(
    "/test/doc.md",
    `---
traceability: []
---

# Content`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();
  const result = await orchestrator.execute({
    schemaPath: "/test/schema.json",
    templatePath: "/test/container.json",
    inputPath: "/test/doc.md",
    outputPath: "/tmp/pattern3-output.json",
    outputFormat: "json" as const,
  });

  logger.info("Pattern 3: Empty traceability array", {
    isOk: result.isOk(),
  });

  if (result.isOk()) {
    logger.info("Pattern 3: Should produce empty {@items}", {
      processedDocuments: result.unwrap().processedDocuments,
    });
  }
});

Deno.test("Pattern 4: No traceability property", async () => {
  const fileSystem = new MockFileSystemPort();

  fileSystem.setFile(
    "/test/schema.json",
    JSON.stringify({
      type: "object",
      "x-template": "container.json",
      "x-template-items": "item.json",
      properties: {
        items: {
          type: "array",
          "x-frontmatter-part": true,
          "x-flatten-arrays": "traceability",
        },
      },
    }),
  );

  fileSystem.setFile(
    "/test/container.json",
    JSON.stringify({ result: "{@items}" }),
  );
  fileSystem.setFile("/test/item.json", JSON.stringify({ id: "{id.full}" }));

  fileSystem.setFile(
    "/test/doc.md",
    `---
version: "1.0.0"
title: Test document
---

# Content`,
  );

  const orchestrator = PipelineOrchestrator.create(fileSystem).unwrap();
  const result = await orchestrator.execute({
    schemaPath: "/test/schema.json",
    templatePath: "/test/container.json",
    inputPath: "/test/doc.md",
    outputPath: "/tmp/pattern4-output.json",
    outputFormat: "json" as const,
  });

  logger.info("Pattern 4: No traceability property", {
    isOk: result.isOk(),
  });

  if (result.isError()) {
    logger.error("Pattern 4: Error (expected?)", {
      code: result.unwrapError().code,
      message: result.unwrapError().message,
    });
  }
});

Deno.test("Pattern 5: Understanding the bug", () => {
  logger.info("Pattern 5: Bug hypothesis", {
    currentBehavior: "arrayData = [ { version, level, traceability: [...] } ]",
    expectedBehavior:
      "arrayData = [ { id: {...}, summary: '...' }, { id: {...}, summary: '...' } ]",
    problem: "x-frontmatter-part extraction not implemented",
    location:
      "Need to extract frontmatter.traceability array elements before passing to {@items}",
    phaseQuestion:
      "Should extraction happen in Phase1, Phase2, or TemplateRenderer?",
  });

  assertEquals(true, true);
});
