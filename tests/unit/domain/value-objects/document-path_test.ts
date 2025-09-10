/**
 * DocumentPath Value Object Tests
 *
 * Tests for DocumentPath Smart Constructor and validation
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { DocumentPath } from "../../../../src/domain/value-objects/document-path.ts";

Deno.test("DocumentPath - should create valid path with .md extension", () => {
  const result = DocumentPath.create("docs/readme.md");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "docs/readme.md");
    assertEquals(result.data.getExtension(), ".md");
    assertEquals(result.data.getFilename(), "readme.md");
    assertEquals(result.data.getBasename(), "readme");
    assertEquals(result.data.isMarkdown(), true);
  }
});

Deno.test("DocumentPath - should create valid path with .mdx extension", () => {
  const result = DocumentPath.create("components/Button.mdx");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "components/Button.mdx");
    assertEquals(result.data.getExtension(), ".mdx");
    assertEquals(result.data.isMarkdown(), true);
  }
});

Deno.test("DocumentPath - should create valid path with .markdown extension", () => {
  const result = DocumentPath.create("posts/article.markdown");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".markdown");
    assertEquals(result.data.isMarkdown(), true);
  }
});

Deno.test("DocumentPath - should create valid path with .txt extension", () => {
  const result = DocumentPath.create("notes/todo.txt");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getExtension(), ".txt");
    assertEquals(result.data.isMarkdown(), false);
  }
});

Deno.test("DocumentPath - should reject empty string", () => {
  const result = DocumentPath.create("");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
    assertExists(result.error.message);
  }
});

Deno.test("DocumentPath - should reject whitespace-only string", () => {
  const result = DocumentPath.create("   ");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "EmptyInput");
  }
});

Deno.test("DocumentPath - should reject path with unsupported extension", () => {
  const result = DocumentPath.create("document.pdf");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "FileExtensionMismatch");
    assertExists(result.error.message);
  }
});

Deno.test("DocumentPath - should reject path with null byte", () => {
  const result = DocumentPath.create("document\0.md");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("DocumentPath - should reject path with directory traversal", () => {
  const result1 = DocumentPath.create("../../../etc/passwd.md");
  assertEquals(result1.ok, false);
  if (!result1.ok) {
    assertEquals(result1.error.kind, "InvalidFormat");
  }

  const result2 = DocumentPath.create("..\\..\\windows\\system.md");
  assertEquals(result2.ok, false);
  if (!result2.ok) {
    assertEquals(result2.error.kind, "InvalidFormat");
  }
});

Deno.test("DocumentPath - should reject excessively long path", () => {
  const longPath = "a".repeat(1025) + ".md";
  const result = DocumentPath.create(longPath);

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "TooLong");
  }
});

Deno.test("DocumentPath - should reject filename that is just extension", () => {
  const result = DocumentPath.create(".md");

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error.kind, "InvalidFormat");
  }
});

Deno.test("DocumentPath - should trim whitespace from valid path", () => {
  const result = DocumentPath.create("  docs/readme.md  ");

  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.data.getValue(), "docs/readme.md");
  }
});

Deno.test("DocumentPath - should get directory path", () => {
  const result = DocumentPath.create("path/to/document.md");

  if (result.ok) {
    assertEquals(result.data.getDirectory(), "path/to");
  }

  const rootResult = DocumentPath.create("document.md");
  if (rootResult.ok) {
    assertEquals(rootResult.data.getDirectory(), "");
  }
});

Deno.test("DocumentPath - should identify absolute paths", () => {
  const absoluteUnix = DocumentPath.create("/absolute/path/doc.md");
  if (absoluteUnix.ok) {
    assertEquals(absoluteUnix.data.isAbsolute(), true);
  }

  const relative = DocumentPath.create("relative/path/doc.md");
  if (relative.ok) {
    assertEquals(relative.data.isAbsolute(), false);
  }
});

Deno.test("DocumentPath - should create relative path from base", () => {
  const result = DocumentPath.create("/project/docs/readme.md");

  if (result.ok) {
    const relativeResult = result.data.makeRelative("/project/");
    assertEquals(relativeResult.ok, true);
    if (relativeResult.ok) {
      assertEquals(relativeResult.data.getValue(), "docs/readme.md");
    }
  }
});

Deno.test("DocumentPath - should fail to create relative path from non-matching base", () => {
  const result = DocumentPath.create("/project/docs/readme.md");

  if (result.ok) {
    const relativeResult = result.data.makeRelative("/other/");
    assertEquals(relativeResult.ok, false);
    if (!relativeResult.ok) {
      assertEquals(relativeResult.error.kind, "InvalidFormat");
    }
  }
});

Deno.test("DocumentPath - should join path segments", () => {
  const result = DocumentPath.create("docs/readme.md");

  if (result.ok) {
    const joinResult = result.data.join("section.md");
    assertEquals(joinResult.ok, true);
    if (joinResult.ok) {
      assertEquals(joinResult.data.getValue(), "docs/readme.md/section.md");
    }
  }
});

Deno.test("DocumentPath - should handle empty segment in join", () => {
  const result = DocumentPath.create("docs/readme.md");

  if (result.ok) {
    const joinResult = result.data.join("");
    assertEquals(joinResult.ok, true);
    if (joinResult.ok) {
      assertEquals(joinResult.data.getValue(), "docs/readme.md");
    }
  }
});

Deno.test("DocumentPath - should change extension", () => {
  const result = DocumentPath.create("document.md");

  if (result.ok) {
    const txtResult = result.data.withExtension(".txt");
    assertEquals(txtResult.ok, true);
    if (txtResult.ok) {
      assertEquals(txtResult.data.getValue(), "document.txt");
      assertEquals(txtResult.data.getExtension(), ".txt");
    }
  }
});

Deno.test("DocumentPath - should check equality", () => {
  const result1 = DocumentPath.create("docs/readme.md");
  const result2 = DocumentPath.create("docs/readme.md");
  const result3 = DocumentPath.create("docs/other.md");

  if (result1.ok && result2.ok && result3.ok) {
    assertEquals(result1.data.equals(result2.data), true);
    assertEquals(result1.data.equals(result3.data), false);
  }
});

Deno.test("DocumentPath - should have string representation", () => {
  const result = DocumentPath.create("docs/readme.md");

  if (result.ok) {
    assertEquals(result.data.toString(), "DocumentPath(docs/readme.md)");
  }
});
