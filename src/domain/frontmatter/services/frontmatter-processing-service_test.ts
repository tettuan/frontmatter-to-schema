import { assert, assertEquals, assertExists, assertFalse } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { FrontmatterProcessingService } from "./frontmatter-processing-service.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { createError } from "../../shared/types/errors.ts";
import { err, ok } from "../../shared/types/result.ts";

// Mock implementations for testing
class MockFrontmatterProcessor {
  constructor(
    private shouldSucceed: boolean = true,
    private mockFrontmatterData?: FrontmatterData,
  ) {}

  extract(content: string) {
    if (this.shouldSucceed && this.mockFrontmatterData) {
      return ok({
        frontmatter: this.mockFrontmatterData,
        body: content.replace(/^---[\s\S]*?---\n/, ""),
      });
    }
    return err(createError({
      kind: "ExtractionFailed",
      message: "Mock extraction error",
    }));
  }

  validate(data: FrontmatterData, _rules: ValidationRules) {
    if (this.shouldSucceed) {
      return ok(data);
    }
    return err(createError({
      kind: "InvalidFormat",
      format: "frontmatter",
    }));
  }

  extractFromPart(_data: FrontmatterData, _partPath: string) {
    return ok([]);
  }

  // Add required properties to match FrontmatterProcessor interface
  extractor = null as any;
  parser = null as any;
}

class MockFileSystemReader {
  constructor(
    private fileContents: Map<string, string> = new Map(),
    private shouldSucceed: boolean = true,
  ) {}

  async readFile(path: string) {
    // Simulate async operation
    await Promise.resolve();

    if (this.shouldSucceed && this.fileContents.has(path)) {
      return ok(this.fileContents.get(path)!);
    }
    return err(createError({
      kind: "ReadFailed",
      path,
      message: `Mock file system error for ${path}`,
    }));
  }

  setFileContent(path: string, content: string) {
    this.fileContents.set(path, content);
  }
}

class MockProcessingBoundsMonitor {
  constructor(private shouldPass: boolean = true) {}

  checkState(_filesProcessed: number) {
    if (this.shouldPass) {
      return {
        kind: "within_bounds" as const,
        usage: {
          heapUsed: 1000000,
          heapTotal: 2000000,
          external: 500000,
          rss: 3000000,
        },
      };
    }
    return {
      kind: "exceeded_limit" as const,
      usage: {
        heapUsed: 2000000,
        heapTotal: 2000000,
        external: 500000,
        rss: 3000000,
      },
      limit: 1500000,
    };
  }

  validateMemoryGrowth(_filesProcessed: number) {
    return ok(void 0);
  }

  getBounds() {
    return { kind: "unbounded" as const };
  }

  // Add required properties to match ProcessingBoundsMonitor interface
  bounds = { kind: "unbounded" as const };
  startTime = performance.now();
  initialMemory = {
    heapUsed: 1000000,
    heapTotal: 2000000,
    external: 500000,
    rss: 3000000,
  };
}

// Helper functions for creating test data
function createTestFrontmatterData(): FrontmatterData {
  const result = FrontmatterData.create({
    title: "Test Document",
    description: "Test description",
  });
  if (!result.ok) {
    throw new Error("Failed to create test frontmatter data");
  }
  return result.data;
}

function _createTestMarkdownDocument(path: string): MarkdownDocument {
  const filePathResult = FilePath.create(path);
  if (!filePathResult.ok) {
    throw new Error("Failed to create test file path");
  }

  const result = MarkdownDocument.create(
    filePathResult.data,
    "# Test Document\n\nTest content",
    createTestFrontmatterData(),
    "Test content",
  );
  if (!result.ok) {
    throw new Error("Failed to create test markdown document");
  }
  return result.data;
}

function createTestValidationRules(): ValidationRules {
  return ValidationRules.create([]);
}

describe("FrontmatterProcessingService", () => {
  describe("create (Smart Constructor)", () => {
    it("should create service with valid configuration", () => {
      const mockProcessor = new MockFrontmatterProcessor();
      const mockReader = new MockFileSystemReader();
      const config = {
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      };

      const result = FrontmatterProcessingService.create(config);

      assert(result.ok);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should reject configuration without processor", () => {
      const mockReader = new MockFileSystemReader();
      const config = {
        processor: null as any,
        fileSystem: { reader: mockReader },
      };

      const result = FrontmatterProcessingService.create(config);

      assertFalse(result.ok);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assert(
          result.error.message.includes("FrontmatterProcessor is required"),
        );
      }
    });

    it("should reject configuration without file system reader", () => {
      const mockProcessor = new MockFrontmatterProcessor();
      const config = {
        processor: mockProcessor as any,
        fileSystem: { reader: null as any },
      };

      const result = FrontmatterProcessingService.create(config);

      assertFalse(result.ok);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assert(
          result.error.message.includes("FileSystem reader is required"),
        );
      }
    });

    it("should reject configuration with invalid file system reader", () => {
      const mockProcessor = new MockFrontmatterProcessor();
      const config = {
        processor: mockProcessor as any,
        fileSystem: {
          reader: {
            invalidMethod: () => {},
          } as any,
        },
      };

      const result = FrontmatterProcessingService.create(config);

      assertFalse(result.ok);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assert(
          result.error.message.includes("must implement readFile method"),
        );
      }
    });
  });

  describe("processDocuments - Sequential Processing", () => {
    it("should successfully process documents sequentially", async () => {
      // Arrange
      const mockFrontmatterData = createTestFrontmatterData();
      const mockProcessor = new MockFrontmatterProcessor(
        true,
        mockFrontmatterData,
      );
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");
      mockReader.setFileContent("/test/doc2.md", "# Test 2\n\nContent 2");

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md", "/test/doc2.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: false, maxWorkers: 1 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedData.length, 2);
        assertEquals(result.data.documents.length, 2);
        assertEquals(result.data.successCount, 2);
        assertEquals(result.data.errorCount, 0);
        assertEquals(result.data.processingStrategy, "sequential");
      }
    });

    it("should handle file read errors in sequential processing", async () => {
      // Arrange
      const mockProcessor = new MockFrontmatterProcessor();
      const mockReader = new MockFileSystemReader(new Map(), false); // Will fail
      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/nonexistent.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: false, maxWorkers: 1 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedData.length, 0);
        assertEquals(result.data.documents.length, 0);
        assertEquals(result.data.successCount, 0);
        assertEquals(result.data.errorCount, 1);
        assertEquals(result.data.processingStrategy, "sequential");
      }
    });

    it("should handle processing bounds violation in sequential processing", async () => {
      // Arrange
      const mockFrontmatterData = createTestFrontmatterData();
      const mockProcessor = new MockFrontmatterProcessor(
        true,
        mockFrontmatterData,
      );
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: false, maxWorkers: 1 };
      const boundsMonitor = new MockProcessingBoundsMonitor(false); // Will fail

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assertFalse(result.ok);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assert(
          result.error.message.includes("Memory bounds exceeded"),
        );
      }
    });
  });

  describe("processDocuments - Parallel Processing", () => {
    it("should successfully process documents in parallel", async () => {
      // Arrange
      const mockFrontmatterData = createTestFrontmatterData();
      const mockProcessor = new MockFrontmatterProcessor(
        true,
        mockFrontmatterData,
      );
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");
      mockReader.setFileContent("/test/doc2.md", "# Test 2\n\nContent 2");
      mockReader.setFileContent("/test/doc3.md", "# Test 3\n\nContent 3");

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md", "/test/doc2.md", "/test/doc3.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: true, maxWorkers: 2 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedData.length, 3);
        assertEquals(result.data.documents.length, 3);
        assertEquals(result.data.successCount, 3);
        assertEquals(result.data.errorCount, 0);
        assertEquals(result.data.processingStrategy, "parallel");
      }
    });

    it("should handle mixed success and failure in parallel processing", async () => {
      // Arrange
      const mockFrontmatterData = createTestFrontmatterData();
      const mockProcessor = new MockFrontmatterProcessor(
        true,
        mockFrontmatterData,
      );
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");
      // doc2.md intentionally missing to cause failure

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md", "/test/doc2.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: true, maxWorkers: 2 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedData.length, 1);
        assertEquals(result.data.documents.length, 1);
        assertEquals(result.data.successCount, 1);
        assertEquals(result.data.errorCount, 1);
        assertEquals(result.data.processingStrategy, "parallel");
      }
    });

    it("should handle bounds violation during parallel batch processing", async () => {
      // Arrange
      const mockFrontmatterData = createTestFrontmatterData();
      const mockProcessor = new MockFrontmatterProcessor(
        true,
        mockFrontmatterData,
      );
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: true, maxWorkers: 1 };
      const boundsMonitor = new MockProcessingBoundsMonitor(false); // Will fail

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assertFalse(result.ok);
      if (!result.ok) {
        assertEquals(result.error.kind, "InitializationError");
        assert(
          result.error.message.includes("Memory bounds exceeded"),
        );
      }
    });

    it("should create appropriate batch sizes for parallel processing", async () => {
      // Arrange
      const mockFrontmatterData = createTestFrontmatterData();
      const mockProcessor = new MockFrontmatterProcessor(
        true,
        mockFrontmatterData,
      );
      const mockReader = new MockFileSystemReader();

      // Create 10 files
      for (let i = 1; i <= 10; i++) {
        mockReader.setFileContent(
          `/test/doc${i}.md`,
          `# Test ${i}\n\nContent ${i}`,
        );
      }

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = Array.from(
        { length: 10 },
        (_, i) => `/test/doc${i + 1}.md`,
      );
      const validationRules = createTestValidationRules();
      const options = { useParallel: true, maxWorkers: 3 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedData.length, 10);
        assertEquals(result.data.documents.length, 10);
        assertEquals(result.data.successCount, 10);
        assertEquals(result.data.errorCount, 0);
        assertEquals(result.data.processingStrategy, "parallel");
      }
    });
  });

  describe("Processing with Logger", () => {
    it("should log debug information when logger is provided", async () => {
      // Arrange
      const loggedMessages: string[] = [];
      const mockLogger = {
        debug: (message: string) => {
          loggedMessages.push(`DEBUG: ${message}`);
          return ok(undefined);
        },
        info: (message: string) => {
          loggedMessages.push(`INFO: ${message}`);
          return ok(undefined);
        },
        warn: (message: string) => {
          loggedMessages.push(`WARN: ${message}`);
          return ok(undefined);
        },
        error: (message: string) => {
          loggedMessages.push(`ERROR: ${message}`);
          return ok(undefined);
        },
      } as any;

      const mockFrontmatterData = createTestFrontmatterData();
      const mockProcessor = new MockFrontmatterProcessor(
        true,
        mockFrontmatterData,
      );
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: false, maxWorkers: 1 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
        mockLogger,
      );

      // Assert
      assert(
        loggedMessages.some((msg) =>
          msg.includes("Starting document processing")
        ),
      );
      assert(
        loggedMessages.some((msg) =>
          msg.includes("Using sequential processing")
        ),
      );
      assert(
        loggedMessages.some((msg) =>
          msg.includes("Sequential processing completed")
        ),
      );
    });

    it("should log error information for failed processing", async () => {
      // Arrange
      const loggedMessages: string[] = [];
      const mockLogger = {
        debug: (message: string) => {
          loggedMessages.push(`DEBUG: ${message}`);
          return ok(undefined);
        },
        info: (message: string) => {
          loggedMessages.push(`INFO: ${message}`);
          return ok(undefined);
        },
        warn: (message: string) => {
          loggedMessages.push(`WARN: ${message}`);
          return ok(undefined);
        },
        error: (message: string) => {
          loggedMessages.push(`ERROR: ${message}`);
          return ok(undefined);
        },
      } as any;

      const mockProcessor = new MockFrontmatterProcessor(false); // Will fail
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: false, maxWorkers: 1 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
        mockLogger,
      );

      // Assert
      assert(
        loggedMessages.some((msg) => msg.includes("Failed to process file")),
      );
    });
  });

  describe("getConfiguration", () => {
    it("should return configuration status", () => {
      // Arrange
      const mockProcessor = new MockFrontmatterProcessor();
      const mockReader = new MockFileSystemReader();
      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      // Act
      const config = service.getConfiguration();

      // Assert
      assert(config.hasProcessor);
      assert(config.hasFileSystemReader);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty file list", async () => {
      // Arrange
      const mockProcessor = new MockFrontmatterProcessor();
      const mockReader = new MockFileSystemReader();
      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths: string[] = [];
      const validationRules = createTestValidationRules();
      const options = { useParallel: false, maxWorkers: 1 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedData.length, 0);
        assertEquals(result.data.documents.length, 0);
        assertEquals(result.data.successCount, 0);
        assertEquals(result.data.errorCount, 0);
        assertEquals(result.data.processingStrategy, "sequential");
      }
    });

    it("should handle single file processing", async () => {
      // Arrange
      const mockFrontmatterData = createTestFrontmatterData();
      const mockProcessor = new MockFrontmatterProcessor(
        true,
        mockFrontmatterData,
      );
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: true, maxWorkers: 4 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedData.length, 1);
        assertEquals(result.data.documents.length, 1);
        assertEquals(result.data.successCount, 1);
        assertEquals(result.data.errorCount, 0);
        assertEquals(result.data.processingStrategy, "parallel");
      }
    });

    it("should handle unexpected errors during processing", async () => {
      // Arrange
      const mockProcessor = {
        extract() {
          throw new Error("Unexpected processing error");
        },
        validate() {
          return ok(createTestFrontmatterData());
        },
        extractFromPart() {
          return ok([]);
        },
        extractor: null,
        parser: null,
      } as any;
      const mockReader = new MockFileSystemReader();
      mockReader.setFileContent("/test/doc1.md", "# Test\n\nContent");

      const serviceResult = FrontmatterProcessingService.create({
        processor: mockProcessor as any,
        fileSystem: { reader: mockReader },
      });
      assert(serviceResult.ok);
      const service = serviceResult.data;

      const filePaths = ["/test/doc1.md"];
      const validationRules = createTestValidationRules();
      const options = { useParallel: false, maxWorkers: 1 };
      const boundsMonitor = new MockProcessingBoundsMonitor();

      // Act
      const result = await service.processDocuments(
        filePaths,
        validationRules,
        options,
        boundsMonitor as any,
      );

      // Assert
      assert(result.ok);
      if (result.ok) {
        assertEquals(result.data.processedData.length, 0);
        assertEquals(result.data.documents.length, 0);
        assertEquals(result.data.successCount, 0);
        assertEquals(result.data.errorCount, 1);
      }
    });
  });
});
