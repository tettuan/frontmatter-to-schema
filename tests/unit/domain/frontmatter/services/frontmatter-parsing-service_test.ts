import { assertEquals, assertExists } from "@std/assert";
import { FrontmatterParsingService } from "../../../../../src/domain/frontmatter/services/frontmatter-parsing-service.ts";
import { ProcessingError } from "../../../../../src/domain/shared/types/errors.ts";

// Mock FileSystemPort for testing
class MockFileSystemPort {
  private files: Map<string, string> = new Map();
  private shouldError = false;
  private errorType = "FILE_NOT_FOUND";

  setFileContent(path: string, content: string): void {
    this.files.set(path, content);
  }

  setShouldError(shouldError: boolean, errorType = "FILE_NOT_FOUND"): void {
    this.shouldError = shouldError;
    this.errorType = errorType;
  }

  async readTextFile(path: string) {
    await Promise.resolve(); // Satisfy async requirement

    if (this.shouldError) {
      return {
        isError: () => true,
        unwrapError: () => ({
          code: this.errorType,
          message: `Error reading ${path}`,
        }),
        isOk: () => false,
        unwrap: () => {
          throw new Error("Cannot unwrap error result");
        },
        getValue: () => undefined,
        getError: () => ({
          code: this.errorType,
          message: `Error reading ${path}`,
        }),
      };
    }

    const content = this.files.get(path);
    if (content === undefined) {
      return {
        isError: () => true,
        unwrapError: () => ({
          code: "FILE_NOT_FOUND",
          message: `File not found: ${path}`,
        }),
        isOk: () => false,
        unwrap: () => {
          throw new Error("Cannot unwrap error result");
        },
        getValue: () => undefined,
        getError: () => ({
          code: "FILE_NOT_FOUND",
          message: `File not found: ${path}`,
        }),
      };
    }

    return {
      isError: () => false,
      unwrapError: () => {
        throw new Error("Cannot unwrap ok result");
      },
      isOk: () => true,
      unwrap: () => content,
      getValue: () => content,
      getError: () => undefined,
    };
  }
}

Deno.test("FrontmatterParsingService - create with valid FileSystemPort", () => {
  const mockFileSystem = new MockFileSystemPort();
  const result = FrontmatterParsingService.create(mockFileSystem as any);

  assertEquals(result.isOk(), true);
  assertExists(result.unwrap());
});

Deno.test("FrontmatterParsingService - create fails with null FileSystemPort", () => {
  const result = FrontmatterParsingService.create(null as any);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_DEPENDENCY");
  assertEquals(
    error.message,
    "FileSystemPort is required for frontmatter parsing",
  );
});

Deno.test("FrontmatterParsingService - parseFrontmatter with valid YAML frontmatter", () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  const content = `---
title: Test Document
author: John Doe
tags: ["test", "example"]
---

# Test Content

This is the main content of the document.`;

  const result = service.parseFrontmatter(content);

  assertEquals(result.isOk(), true);
  const parsed = result.unwrap();
  assertEquals(parsed.frontmatter?.title, "Test Document");
  assertEquals(parsed.frontmatter?.author, "John Doe");
  assertEquals(
    parsed.content,
    "# Test Content\n\nThis is the main content of the document.",
  );
});

Deno.test("FrontmatterParsingService - parseFrontmatter with no frontmatter", () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  const content = `# Test Content

This is content without frontmatter.`;

  const result = service.parseFrontmatter(content);

  assertEquals(result.isOk(), true);
  const parsed = result.unwrap();
  assertEquals(parsed.frontmatter, undefined);
  assertEquals(parsed.content, content);
});

Deno.test("FrontmatterParsingService - parseFrontmatter with quoted values", () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  const content = `---
title: "Quoted Title"
description: 'Single quoted description'
number: 42
---

Content here.`;

  const result = service.parseFrontmatter(content);

  assertEquals(result.isOk(), true);
  const parsed = result.unwrap();
  assertEquals(parsed.frontmatter?.title, "Quoted Title");
  assertEquals(parsed.frontmatter?.description, "Single quoted description");
  assertEquals(parsed.frontmatter?.number, "42");
});

Deno.test("FrontmatterParsingService - parseFrontmatter fails with non-string input", () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  const result = service.parseFrontmatter(123 as any);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "INVALID_CONTENT_TYPE");
  assertEquals(
    error.message,
    "Content must be a string for frontmatter parsing",
  );
});

Deno.test("FrontmatterParsingService - loadMarkdownDocument with valid file", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  const filePath = "/test/document.md";
  const content = `---
title: Test Document
---

# Test Content`;

  mockFileSystem.setFileContent(filePath, content);

  const result = await service.loadMarkdownDocument(filePath);

  assertEquals(result.isOk(), true);
  const document = result.unwrap();
  assertEquals(document.getPath().toString(), filePath);
  assertEquals(document.getFrontmatter()?.getData().title, "Test Document");
});

Deno.test("FrontmatterParsingService - loadMarkdownDocument with file read error", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  mockFileSystem.setShouldError(true, "PERMISSION_DENIED");

  const result = await service.loadMarkdownDocument("/test/nonexistent.md");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "DOCUMENT_READ_ERROR");
  assertEquals(error.message.includes("Failed to read document"), true);
});

Deno.test("FrontmatterParsingService - loadMarkdownDocument with invalid file path", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  const result = await service.loadMarkdownDocument("");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof ProcessingError, true);
  assertEquals(error.code, "DOCUMENT_READ_ERROR");
});

Deno.test("FrontmatterParsingService - loadMarkdownDocument without frontmatter", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  const filePath = "/test/plain.md";
  const content = `# Plain Document

This document has no frontmatter.`;

  mockFileSystem.setFileContent(filePath, content);

  const result = await service.loadMarkdownDocument(filePath);

  assertEquals(result.isOk(), true);
  const document = result.unwrap();
  assertEquals(document.getPath().toString(), filePath);
  assertEquals(document.getFrontmatter(), undefined);
});

Deno.test("FrontmatterParsingService - loadMarkdownDocument with malformed frontmatter data", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  const filePath = "/test/malformed.md";
  const content = `---
title: Test
data: {}
---

Content`;

  mockFileSystem.setFileContent(filePath, content);

  // This should still work since we parse basic key-value pairs
  const result = await service.loadMarkdownDocument(filePath);

  assertEquals(result.isOk(), true);
  const document = result.unwrap();
  assertEquals(document.getFrontmatter()?.getData().title, "Test");
});

Deno.test("FrontmatterParsingService - parseFrontmatter edge cases", () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  // Empty frontmatter
  const emptyResult = service.parseFrontmatter(`---
---

Content`);
  assertEquals(emptyResult.isOk(), true);

  // Frontmatter with colons in values
  const colonResult = service.parseFrontmatter(`---
url: https://example.com:8080
---

Content`);
  assertEquals(colonResult.isOk(), true);
  const colonParsed = colonResult.unwrap();
  assertEquals(colonParsed.frontmatter?.url, "https://example.com:8080");

  // Frontmatter with spaces around delimiters
  const spaceResult = service.parseFrontmatter(`---
  title  :  Spaced Title
---

Content`);
  assertEquals(spaceResult.isOk(), true);
  const spaceParsed = spaceResult.unwrap();
  assertEquals(spaceParsed.frontmatter?.title, "Spaced Title");
});

Deno.test("FrontmatterParsingService - comprehensive error handling", () => {
  const mockFileSystem = new MockFileSystemPort();

  // Test service creation with undefined
  const undefinedResult = FrontmatterParsingService.create(undefined as any);
  assertEquals(undefinedResult.isError(), true);

  // Test with valid service
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  // Test parseFrontmatter with various invalid inputs
  const nullResult = service.parseFrontmatter(null as any);
  assertEquals(nullResult.isError(), true);

  const undefinedContentResult = service.parseFrontmatter(undefined as any);
  assertEquals(undefinedContentResult.isError(), true);

  const objectResult = service.parseFrontmatter({} as any);
  assertEquals(objectResult.isError(), true);
});

Deno.test("FrontmatterParsingService - totality principle compliance", async () => {
  const mockFileSystem = new MockFileSystemPort();
  const service = FrontmatterParsingService.create(mockFileSystem as any)
    .unwrap();

  // All methods should return Result types, never throw exceptions
  const tests = [
    () => service.parseFrontmatter("invalid"),
    () => service.parseFrontmatter(""),
    () => service.parseFrontmatter("---\ntitle: test\n---\ncontent"),
    () => service.loadMarkdownDocument("/nonexistent"),
    () => service.loadMarkdownDocument(""),
    () => service.loadMarkdownDocument("/valid/path"),
  ];

  for (const test of tests) {
    try {
      const result = await test();
      // Should always return a Result, never throw
      assertEquals(typeof result.isOk, "function");
      assertEquals(typeof result.isError, "function");
    } catch (error) {
      // Should never reach here in totality-compliant code
      throw new Error(`Method threw exception: ${error}`);
    }
  }
});
