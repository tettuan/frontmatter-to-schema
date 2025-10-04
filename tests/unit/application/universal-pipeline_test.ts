import { assertEquals } from "@std/assert";
import {
  DocumentLoader,
  PipelineContext,
  SchemaLoadingStage,
  TemplateLoadingStage,
  UniversalPipeline,
  UniversalPipelineConfig,
} from "../../../src/application/universal-pipeline.ts";
import { ConfigurationManager } from "../../../src/application/strategies/configuration-strategy.ts";
import { Result } from "../../../src/domain/shared/types/result.ts";
import { ProcessingError } from "../../../src/domain/shared/types/errors.ts";
import { MarkdownDocument } from "../../../src/domain/frontmatter/entities/markdown-document.ts";
import { FileSystemPort } from "../../../src/infrastructure/ports/file-system-port.ts";
import {
  DirectoryEntry,
  FileError,
  FileInfo,
} from "../../../src/domain/shared/types/file-errors.ts";

/**
 * Unit tests for Universal Pipeline architecture
 */

// Mock FileSystemPort
class MockFileSystemPort implements FileSystemPort {
  private mockFiles = new Map<string, string>();
  private mockStats = new Map<string, FileInfo>();

  setMockFile(path: string, content: string) {
    this.mockFiles.set(path, content);
    this.mockStats.set(path, {
      isFile: true,
      isDirectory: false,
      size: content.length,
      mtime: new Date(),
    });
  }

  setMockDirectory(path: string) {
    this.mockStats.set(path, {
      isFile: false,
      isDirectory: true,
      size: 0,
      mtime: new Date(),
    });
  }

  readTextFile(path: string): Promise<Result<string, FileError>> {
    const content = this.mockFiles.get(path);
    if (content !== undefined) {
      return Promise.resolve(Result.ok(content));
    }
    return Promise.resolve(Result.error({
      kind: "FileNotFound",
      path,
    }));
  }

  writeTextFile(
    path: string,
    content: string,
  ): Promise<Result<void, FileError>> {
    this.mockFiles.set(path, content);
    return Promise.resolve(Result.ok(undefined));
  }

  stat(path: string): Promise<Result<FileInfo, FileError>> {
    const info = this.mockStats.get(path);
    if (info) {
      return Promise.resolve(Result.ok(info));
    }
    return Promise.resolve(Result.error({
      kind: "FileNotFound",
      path,
    }));
  }

  exists(path: string): Promise<Result<boolean, FileError>> {
    return Promise.resolve(
      Result.ok(this.mockFiles.has(path) || this.mockStats.has(path)),
    );
  }

  readDir(_path: string): Promise<Result<DirectoryEntry[], FileError>> {
    return Promise.resolve(Result.ok([]));
  }
}

// Mock DocumentLoader
class MockDocumentLoader implements DocumentLoader {
  private mockFiles = new Map<string, string>();

  setMockDocument(path: string, content: string) {
    this.mockFiles.set(path, content);
  }

  async loadMarkdownDocument(
    filePath: string,
  ): Promise<Result<MarkdownDocument, ProcessingError>> {
    const { MarkdownDocument, DocumentId } = await import(
      "../../../src/domain/frontmatter/entities/markdown-document.ts"
    );
    const { FilePath } = await import(
      "../../../src/domain/shared/value-objects/file-path.ts"
    );

    const documentId = DocumentId.create("test-doc");
    const pathResult = FilePath.create(filePath);
    if (pathResult.isError()) {
      return Result.error(
        new ProcessingError("Invalid file path", "INVALID_FILE_PATH", {
          filePath,
        }),
      );
    }

    // Check if mock file exists
    const content = this.mockFiles.get(filePath);
    if (content === undefined) {
      return Result.error(
        new ProcessingError(
          `File not found: ${filePath}`,
          "INPUT_ACCESS_ERROR",
          { filePath },
        ),
      );
    }

    const document = MarkdownDocument.create(
      documentId,
      pathResult.unwrap(),
      content,
      undefined,
    );
    return Result.ok(document);
  }
}

Deno.test("UniversalPipeline - create with default configuration", () => {
  const config: UniversalPipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/input.md",
    outputPath: "/test/output.json",
  };

  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  const result = UniversalPipeline.create(config, mockFs, mockLoader);
  assertEquals(result.isOk(), true);
});

Deno.test("UniversalPipeline - create with custom configuration", () => {
  const customConfig = new ConfigurationManager();
  const config: UniversalPipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/input.md",
    outputPath: "/test/output.json",
    customConfiguration: customConfig,
  };

  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  const result = UniversalPipeline.create(config, mockFs, mockLoader);
  assertEquals(result.isOk(), true);
});

Deno.test("UniversalPipeline - addStage", () => {
  const config: UniversalPipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/input.md",
    outputPath: "/test/output.json",
  };

  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  const pipelineResult = UniversalPipeline.create(config, mockFs, mockLoader);
  const pipeline = pipelineResult.unwrap();

  // Create a custom stage
  const customStage = new SchemaLoadingStage();
  pipeline.addStage(customStage);

  // Cannot easily test the internal stages array, but this tests the method exists
  assertEquals(typeof pipeline.addStage, "function");
});

Deno.test("SchemaLoadingStage - create instance", () => {
  const stage = new SchemaLoadingStage();
  assertEquals(stage.stageName, "schema-loading");
});

Deno.test("SchemaLoadingStage - execute with valid schema", async () => {
  const stage = new SchemaLoadingStage();
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup valid schema file
  const validSchema = JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string" },
    },
  });
  mockFs.setMockFile("/test/schema.json", validSchema);

  const context: PipelineContext = {
    config: {
      schemaPath: "/test/schema.json",
      templatePath: "/test/template.json",
      inputPath: "/test/input.md",
      outputPath: "/test/output.json",
    },
    fileSystem: mockFs,
    configManager: new ConfigurationManager(),
    documentLoader: mockLoader,
  };

  const result = await stage.execute("/test/schema.json", context);
  assertEquals(result.isOk(), true);
});

Deno.test("SchemaLoadingStage - execute with missing schema file", async () => {
  const stage = new SchemaLoadingStage();
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  const context: PipelineContext = {
    config: {
      schemaPath: "/test/missing.json",
      templatePath: "/test/template.json",
      inputPath: "/test/input.md",
      outputPath: "/test/output.json",
    },
    fileSystem: mockFs,
    configManager: new ConfigurationManager(),
    documentLoader: mockLoader,
  };

  const result = await stage.execute("/test/missing.json", context);
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "SCHEMA_READ_ERROR");
});

Deno.test("SchemaLoadingStage - execute with invalid JSON", async () => {
  const stage = new SchemaLoadingStage();
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup invalid JSON
  mockFs.setMockFile("/test/invalid.json", "{ invalid json");

  const context: PipelineContext = {
    config: {
      schemaPath: "/test/invalid.json",
      templatePath: "/test/template.json",
      inputPath: "/test/input.md",
      outputPath: "/test/output.json",
    },
    fileSystem: mockFs,
    configManager: new ConfigurationManager(),
    documentLoader: mockLoader,
  };

  const result = await stage.execute("/test/invalid.json", context);
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "SCHEMA_PARSE_ERROR");
});

Deno.test("TemplateLoadingStage - create instance", () => {
  const stage = new TemplateLoadingStage();
  assertEquals(stage.stageName, "template-loading");
});

Deno.test("TemplateLoadingStage - execute with valid template", async () => {
  const stage = new TemplateLoadingStage();
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup valid template file
  const validTemplate = JSON.stringify({
    output: {
      title: "${title}",
    },
  });
  mockFs.setMockFile("/test/template.json", validTemplate);

  const context: PipelineContext = {
    config: {
      schemaPath: "/test/schema.json",
      templatePath: "/test/template.json",
      inputPath: "/test/input.md",
      outputPath: "/test/output.json",
    },
    fileSystem: mockFs,
    configManager: new ConfigurationManager(),
    documentLoader: mockLoader,
  };

  const result = await stage.execute("/test/template.json", context);
  assertEquals(result.isOk(), true);
});

Deno.test("TemplateLoadingStage - execute with missing template file", async () => {
  const stage = new TemplateLoadingStage();
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  const context: PipelineContext = {
    config: {
      schemaPath: "/test/schema.json",
      templatePath: "/test/missing.json",
      inputPath: "/test/input.md",
      outputPath: "/test/output.json",
    },
    fileSystem: mockFs,
    configManager: new ConfigurationManager(),
    documentLoader: mockLoader,
  };

  const result = await stage.execute("/test/missing.json", context);
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "TEMPLATE_LOAD_ERROR");
});

Deno.test("UniversalPipeline - execute full pipeline success", async () => {
  const config: UniversalPipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/input.md",
    outputPath: "/test/output.json",
  };

  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup valid files
  const validSchema = JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string" },
    },
  });
  mockFs.setMockFile("/test/schema.json", validSchema);

  const validTemplate = JSON.stringify({
    output: {
      title: "${title}",
    },
  });
  mockFs.setMockFile("/test/template.json", validTemplate);
  mockFs.setMockFile("/test/input.md", "# Test");
  mockLoader.setMockDocument("/test/input.md", "# Test");

  const pipelineResult = UniversalPipeline.create(config, mockFs, mockLoader);
  assertEquals(pipelineResult.isOk(), true);

  const pipeline = pipelineResult.unwrap();
  const result = await pipeline.execute();

  assertEquals(result.isOk(), true);
  const pipelineOutput = result.unwrap();
  assertEquals(typeof pipelineOutput.executionTime, "number");
  assertEquals(pipelineOutput.outputFormat, "json");
  assertEquals(pipelineOutput.metadata.processedDocuments, 1);
});

Deno.test("UniversalPipeline - execute with custom output format", async () => {
  const config: UniversalPipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/input.md",
    outputPath: "/test/output.yaml",
    outputFormat: "yaml",
  };

  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup valid files
  const validSchema = JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string" },
    },
  });
  mockFs.setMockFile("/test/schema.json", validSchema);

  const validTemplate = JSON.stringify({
    output: {
      title: "${title}",
    },
  });
  mockFs.setMockFile("/test/template.json", validTemplate);
  mockFs.setMockFile("/test/input.md", "# Test");
  mockLoader.setMockDocument("/test/input.md", "# Test");

  const pipelineResult = UniversalPipeline.create(config, mockFs, mockLoader);
  const pipeline = pipelineResult.unwrap();
  const result = await pipeline.execute();

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().outputFormat, "yaml");
});

Deno.test("UniversalPipeline - execute with schema error", async () => {
  const config: UniversalPipelineConfig = {
    schemaPath: "/test/missing.json",
    templatePath: "/test/template.json",
    inputPath: "/test/input.md",
    outputPath: "/test/output.json",
  };

  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  const pipelineResult = UniversalPipeline.create(config, mockFs, mockLoader);
  const pipeline = pipelineResult.unwrap();
  const result = await pipeline.execute();

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "SCHEMA_READ_ERROR");
});

Deno.test("UniversalPipeline - execute with template error", async () => {
  const config: UniversalPipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/missing.json",
    inputPath: "/test/input.md",
    outputPath: "/test/output.json",
  };

  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup valid schema
  const validSchema = JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string" },
    },
  });
  mockFs.setMockFile("/test/schema.json", validSchema);

  const pipelineResult = UniversalPipeline.create(config, mockFs, mockLoader);
  const pipeline = pipelineResult.unwrap();
  const result = await pipeline.execute();

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "TEMPLATE_LOAD_ERROR");
});

Deno.test("UniversalPipeline - execute with input error", async () => {
  const config: UniversalPipelineConfig = {
    schemaPath: "/test/schema.json",
    templatePath: "/test/template.json",
    inputPath: "/test/missing.md",
    outputPath: "/test/output.json",
  };

  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup valid schema and template
  const validSchema = JSON.stringify({
    type: "object",
    properties: {
      title: { type: "string" },
    },
  });
  mockFs.setMockFile("/test/schema.json", validSchema);

  const validTemplate = JSON.stringify({
    output: {
      title: "${title}",
    },
  });
  mockFs.setMockFile("/test/template.json", validTemplate);

  const pipelineResult = UniversalPipeline.create(config, mockFs, mockLoader);
  const pipeline = pipelineResult.unwrap();
  const result = await pipeline.execute();

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INPUT_ACCESS_ERROR");
});
