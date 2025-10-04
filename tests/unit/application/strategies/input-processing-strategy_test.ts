import { assertEquals } from "@std/assert";
import {
  ConfigurableDocumentFilter,
  DirectoryStrategy,
  DocumentLoader,
  InputProcessingStrategyFactory,
  SingleFileStrategy,
} from "../../../../src/application/strategies/input-processing-strategy.ts";
import { Result } from "../../../../src/domain/shared/types/result.ts";
import { ProcessingError } from "../../../../src/domain/shared/types/errors.ts";
import { MarkdownDocument } from "../../../../src/domain/frontmatter/entities/markdown-document.ts";
import { FileSystemPort } from "../../../../src/infrastructure/ports/file-system-port.ts";
import {
  DirectoryEntry,
  FileError,
  FileInfo,
} from "../../../../src/domain/shared/types/file-errors.ts";

/**
 * Unit tests for input processing strategy patterns
 */

// Mock FileSystemPort
class MockFileSystemPort implements FileSystemPort {
  private mockStats = new Map<string, FileInfo>();
  private mockDirectories = new Map<string, DirectoryEntry[]>();

  setMockStat(path: string, info: FileInfo) {
    this.mockStats.set(path, info);
  }

  setMockDirectory(path: string, entries: DirectoryEntry[]) {
    this.mockDirectories.set(path, entries);
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

  readDir(path: string): Promise<Result<DirectoryEntry[], FileError>> {
    const entries = this.mockDirectories.get(path);
    if (entries) {
      return Promise.resolve(Result.ok(entries));
    }
    return Promise.resolve(Result.error({
      kind: "DirectoryNotFound",
      path,
    }));
  }

  readTextFile(_path: string): Promise<Result<string, FileError>> {
    return Promise.resolve(Result.ok("mock content"));
  }

  writeTextFile(
    _path: string,
    _content: string,
  ): Promise<Result<void, FileError>> {
    return Promise.resolve(Result.ok(undefined));
  }

  exists(path: string): Promise<Result<boolean, FileError>> {
    return Promise.resolve(Result.ok(this.mockStats.has(path)));
  }
}

// Mock DocumentLoader
class MockDocumentLoader implements DocumentLoader {
  private mockDocuments = new Map<string, MarkdownDocument>();

  setMockDocument(path: string, document: MarkdownDocument) {
    this.mockDocuments.set(path, document);
  }

  loadMarkdownDocument(
    filePath: string,
  ): Promise<Result<MarkdownDocument, ProcessingError>> {
    const document = this.mockDocuments.get(filePath);
    if (document) {
      return Promise.resolve(Result.ok(document));
    }
    return Promise.resolve(Result.error(
      new ProcessingError("Document not found", "DOCUMENT_NOT_FOUND", {
        filePath,
      }),
    ));
  }
}

Deno.test("SingleFileStrategy - create instance", () => {
  const strategy = new SingleFileStrategy();
  assertEquals(strategy.strategyType, "single-file");
});

Deno.test("SingleFileStrategy - canProcess file", async () => {
  const strategy = new SingleFileStrategy();
  const mockFs = new MockFileSystemPort();
  mockFs.setMockStat("/test/file.md", {
    isFile: true,
    isDirectory: false,
    size: 100,
    mtime: new Date(),
  });

  const result = await strategy.canProcess("/test/file.md", mockFs);
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), true);
});

Deno.test("SingleFileStrategy - canProcess directory", async () => {
  const strategy = new SingleFileStrategy();
  const mockFs = new MockFileSystemPort();
  mockFs.setMockStat("/test/dir", {
    isFile: false,
    isDirectory: true,
    size: 0,
    mtime: new Date(),
  });

  const result = await strategy.canProcess("/test/dir", mockFs);
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), false);
});

Deno.test("SingleFileStrategy - canProcess stat fails", async () => {
  const strategy = new SingleFileStrategy();
  const mockFs = new MockFileSystemPort();

  const result = await strategy.canProcess("/nonexistent", mockFs);
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), false);
});

Deno.test("SingleFileStrategy - processInput success", async () => {
  const strategy = new SingleFileStrategy();
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Create mock document
  const { MarkdownDocument, DocumentId } = await import(
    "../../../../src/domain/frontmatter/entities/markdown-document.ts"
  );
  const { FilePath } = await import(
    "../../../../src/domain/shared/value-objects/file-path.ts"
  );

  const documentId = DocumentId.create("test-doc");
  const filePath = FilePath.create("/test/file.md").unwrap();
  const mockDocument = MarkdownDocument.create(
    documentId,
    filePath,
    "# Test",
    undefined,
  );

  mockLoader.setMockDocument("/test/file.md", mockDocument);

  const result = await strategy.processInput(
    "/test/file.md",
    mockFs,
    mockLoader,
  );
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().length, 1);
});

Deno.test("SingleFileStrategy - processInput document load fails", async () => {
  const strategy = new SingleFileStrategy();
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  const result = await strategy.processInput(
    "/test/missing.md",
    mockFs,
    mockLoader,
  );
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "DOCUMENT_NOT_FOUND");
});

Deno.test("DirectoryStrategy - create instance", () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategy = new DirectoryStrategy(mockFilter);
  assertEquals(strategy.strategyType, "directory");
});

Deno.test("DirectoryStrategy - canProcess directory", async () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategy = new DirectoryStrategy(mockFilter);
  const mockFs = new MockFileSystemPort();

  mockFs.setMockStat("/test/dir", {
    isFile: false,
    isDirectory: true,
    size: 0,
    mtime: new Date(),
  });

  const result = await strategy.canProcess("/test/dir", mockFs);
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), true);
});

Deno.test("DirectoryStrategy - canProcess file", async () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategy = new DirectoryStrategy(mockFilter);
  const mockFs = new MockFileSystemPort();

  mockFs.setMockStat("/test/file.md", {
    isFile: true,
    isDirectory: false,
    size: 100,
    mtime: new Date(),
  });

  const result = await strategy.canProcess("/test/file.md", mockFs);
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), false);
});

Deno.test("DirectoryStrategy - processInput success", async () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategy = new DirectoryStrategy(mockFilter);
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup mock directory
  mockFs.setMockDirectory("/test/dir", [
    { name: "file1.md", isFile: true, isDirectory: false },
    { name: "file2.md", isFile: true, isDirectory: false },
    { name: "other.txt", isFile: true, isDirectory: false },
  ]);

  // Create mock documents
  const { MarkdownDocument, DocumentId } = await import(
    "../../../../src/domain/frontmatter/entities/markdown-document.ts"
  );
  const { FilePath } = await import(
    "../../../../src/domain/shared/value-objects/file-path.ts"
  );

  const doc1Id = DocumentId.create("doc1");
  const doc1Path = FilePath.create("/test/dir/file1.md").unwrap();
  const doc1 = MarkdownDocument.create(doc1Id, doc1Path, "# Test 1", undefined);

  const doc2Id = DocumentId.create("doc2");
  const doc2Path = FilePath.create("/test/dir/file2.md").unwrap();
  const doc2 = MarkdownDocument.create(doc2Id, doc2Path, "# Test 2", undefined);

  mockLoader.setMockDocument("/test/dir/file1.md", doc1);
  mockLoader.setMockDocument("/test/dir/file2.md", doc2);

  const result = await strategy.processInput("/test/dir", mockFs, mockLoader);
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().length, 2);
});

Deno.test("DirectoryStrategy - processInput directory read fails", async () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategy = new DirectoryStrategy(mockFilter);
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  const result = await strategy.processInput(
    "/nonexistent",
    mockFs,
    mockLoader,
  );
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "DIRECTORY_READ_ERROR");
});

Deno.test("DirectoryStrategy - processInput no documents found", async () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategy = new DirectoryStrategy(mockFilter);
  const mockFs = new MockFileSystemPort();
  const mockLoader = new MockDocumentLoader();

  // Setup directory with no markdown files
  mockFs.setMockDirectory("/test/dir", [
    { name: "other.txt", isFile: true, isDirectory: false },
  ]);

  const result = await strategy.processInput("/test/dir", mockFs, mockLoader);
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "NO_DOCUMENTS_FOUND");
});

Deno.test("ConfigurableDocumentFilter - create with extensions", () => {
  const filter = new ConfigurableDocumentFilter(new Set([".md", ".markdown"]));
  assertEquals(filter instanceof ConfigurableDocumentFilter, true);
});

Deno.test("ConfigurableDocumentFilter - shouldProcess markdown file", async () => {
  const filter = new ConfigurableDocumentFilter(new Set([".md", ".markdown"]));

  const result = await filter.shouldProcess({
    name: "test.md",
    isFile: true,
  });
  assertEquals(result, true);
});

Deno.test("ConfigurableDocumentFilter - shouldProcess markdown file different extension", async () => {
  const filter = new ConfigurableDocumentFilter(new Set([".md", ".markdown"]));

  const result = await filter.shouldProcess({
    name: "test.markdown",
    isFile: true,
  });
  assertEquals(result, true);
});

Deno.test("ConfigurableDocumentFilter - shouldProcess non-markdown file", async () => {
  const filter = new ConfigurableDocumentFilter(new Set([".md", ".markdown"]));

  const result = await filter.shouldProcess({
    name: "test.txt",
    isFile: true,
  });
  assertEquals(result, false);
});

Deno.test("ConfigurableDocumentFilter - shouldProcess directory", async () => {
  const filter = new ConfigurableDocumentFilter(new Set([".md", ".markdown"]));

  const result = await filter.shouldProcess({
    name: "directory",
    isFile: false,
  });
  assertEquals(result, false);
});

Deno.test("ConfigurableDocumentFilter - shouldProcess directory with fileTypesOnly false", async () => {
  const filter = new ConfigurableDocumentFilter(
    new Set([".md", ".markdown"]),
    false,
  );

  const result = await filter.shouldProcess({
    name: "directory",
    isFile: false,
  });
  assertEquals(result, false);
});

Deno.test("ConfigurableDocumentFilter - createMarkdownFilter", () => {
  const filter = ConfigurableDocumentFilter.createMarkdownFilter();
  assertEquals(filter instanceof ConfigurableDocumentFilter, true);
});

Deno.test("InputProcessingStrategyFactory - createDefaultStrategies", () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategies = InputProcessingStrategyFactory.createDefaultStrategies(
    mockFilter,
  );

  assertEquals(strategies.length, 3);
  assertEquals(strategies[0].strategyType, "glob-pattern");
  assertEquals(strategies[1].strategyType, "single-file");
  assertEquals(strategies[2].strategyType, "directory");
});

Deno.test("InputProcessingStrategyFactory - selectStrategy file", async () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategies = InputProcessingStrategyFactory.createDefaultStrategies(
    mockFilter,
  );
  const mockFs = new MockFileSystemPort();

  mockFs.setMockStat("/test/file.md", {
    isFile: true,
    isDirectory: false,
    size: 100,
    mtime: new Date(),
  });

  const result = await InputProcessingStrategyFactory.selectStrategy(
    strategies,
    "/test/file.md",
    mockFs,
  );

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().strategyType, "single-file");
});

Deno.test("InputProcessingStrategyFactory - selectStrategy directory", async () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategies = InputProcessingStrategyFactory.createDefaultStrategies(
    mockFilter,
  );
  const mockFs = new MockFileSystemPort();

  mockFs.setMockStat("/test/dir", {
    isFile: false,
    isDirectory: true,
    size: 0,
    mtime: new Date(),
  });

  const result = await InputProcessingStrategyFactory.selectStrategy(
    strategies,
    "/test/dir",
    mockFs,
  );

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().strategyType, "directory");
});

Deno.test("InputProcessingStrategyFactory - selectStrategy input not found", async () => {
  const mockFilter = new ConfigurableDocumentFilter(new Set([".md"]));
  const strategies = InputProcessingStrategyFactory.createDefaultStrategies(
    mockFilter,
  );
  const mockFs = new MockFileSystemPort();

  const result = await InputProcessingStrategyFactory.selectStrategy(
    strategies,
    "/nonexistent",
    mockFs,
  );

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INPUT_ACCESS_ERROR");
});

Deno.test("InputProcessingStrategyFactory - selectStrategy no compatible strategy", async () => {
  // Create strategies that won't match any input
  const strategies: any[] = [];
  const mockFs = new MockFileSystemPort();

  mockFs.setMockStat("/test/file.md", {
    isFile: true,
    isDirectory: false,
    size: 100,
    mtime: new Date(),
  });

  const result = await InputProcessingStrategyFactory.selectStrategy(
    strategies,
    "/test/file.md",
    mockFs,
  );

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "NO_STRATEGY_FOUND");
});
