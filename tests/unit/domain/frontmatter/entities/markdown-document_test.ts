import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { MarkdownDocument } from "../../../../../src/domain/frontmatter/entities/markdown-document.ts";
import { FilePath } from "../../../../../src/domain/frontmatter/value-objects/file-path.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

describe("MarkdownDocument", () => {
  // Helper function to create test data
  const createTestFilePath = (): FilePath => {
    const pathResult = FilePath.create("/test/document.md");
    if (!pathResult.ok) throw new Error("Failed to create test FilePath");
    return pathResult.data;
  };

  const createTestFrontmatterData = (
    data: Record<string, unknown> = {},
  ): FrontmatterData => {
    const dataResult = FrontmatterData.create(data);
    if (!dataResult.ok) {
      throw new Error("Failed to create test FrontmatterData");
    }
    return dataResult.data;
  };

  describe("create", () => {
    it("should create MarkdownDocument with all required fields", () => {
      const path = createTestFilePath();
      const content = "---\ntitle: Test\n---\nBody content";
      const frontmatter = createTestFrontmatterData({ title: "Test" });
      const body = "Body content";

      const result = MarkdownDocument.create(path, content, frontmatter, body);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should create MarkdownDocument with empty frontmatter", () => {
      const path = createTestFilePath();
      const content = "Just body content";
      const frontmatter = createTestFrontmatterData({});
      const body = "Just body content";

      const result = MarkdownDocument.create(path, content, frontmatter, body);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should create MarkdownDocument with empty body", () => {
      const path = createTestFilePath();
      const content = "---\ntitle: Test\n---\n";
      const frontmatter = createTestFrontmatterData({ title: "Test" });
      const body = "";

      const result = MarkdownDocument.create(path, content, frontmatter, body);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
      }
    });

    it("should create MarkdownDocument with complex frontmatter", () => {
      const path = createTestFilePath();
      const content =
        "---\ntitle: Test\ntags: [a, b]\nmeta:\n  author: John\n---\nBody";
      const frontmatter = createTestFrontmatterData({
        title: "Test",
        tags: ["a", "b"],
        meta: { author: "John" },
      });
      const body = "Body";

      const result = MarkdownDocument.create(path, content, frontmatter, body);

      assertEquals(result.ok, true);
    });
  });

  describe("getPath", () => {
    it("should return the FilePath", () => {
      const path = createTestFilePath();
      const frontmatter = createTestFrontmatterData();
      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      const retrievedPath = doc.getPath();

      assertEquals(retrievedPath.getValue(), "/test/document.md");
    });
  });

  describe("getContent", () => {
    it("should return the full content", () => {
      const path = createTestFilePath();
      const content = "---\ntitle: Test\n---\nBody content";
      const frontmatter = createTestFrontmatterData({ title: "Test" });
      const body = "Body content";

      const result = MarkdownDocument.create(path, content, frontmatter, body);

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getContent(), content);
    });

    it("should return empty content when content is empty", () => {
      const path = createTestFilePath();
      const content = "";
      const frontmatter = createTestFrontmatterData();
      const body = "";

      const result = MarkdownDocument.create(path, content, frontmatter, body);

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getContent(), "");
    });
  });

  describe("getFrontmatter", () => {
    it("should return the FrontmatterData", () => {
      const path = createTestFilePath();
      const frontmatterData = { title: "Test", author: "John" };
      const frontmatter = createTestFrontmatterData(frontmatterData);

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      const retrievedFrontmatter = doc.getFrontmatter();

      const titleResult = retrievedFrontmatter.get("title");
      if (titleResult.ok) {
        assertEquals(titleResult.data, "Test");
      }

      const authorResult = retrievedFrontmatter.get("author");
      if (authorResult.ok) {
        assertEquals(authorResult.data, "John");
      }
    });

    it("should return empty FrontmatterData when no frontmatter", () => {
      const path = createTestFilePath();
      const frontmatter = createTestFrontmatterData({});

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      const retrievedFrontmatter = doc.getFrontmatter();

      assertEquals(retrievedFrontmatter.isEmpty(), true);
    });
  });

  describe("getBody", () => {
    it("should return the body content", () => {
      const path = createTestFilePath();
      const frontmatter = createTestFrontmatterData();
      const body = "This is the body content\nWith multiple lines";

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        body,
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getBody(), body);
    });

    it("should return empty string when body is empty", () => {
      const path = createTestFilePath();
      const frontmatter = createTestFrontmatterData();
      const body = "";

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        body,
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getBody(), "");
    });
  });

  describe("hasFrontmatter", () => {
    it("should return true when frontmatter has data", () => {
      const path = createTestFilePath();
      const frontmatter = createTestFrontmatterData({ title: "Test" });

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.hasFrontmatter(), true);
    });

    it("should return false when frontmatter is empty", () => {
      const path = createTestFilePath();
      const frontmatter = createTestFrontmatterData({});

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.hasFrontmatter(), false);
    });
  });

  describe("withFrontmatter", () => {
    it("should create new document with updated frontmatter", () => {
      const path = createTestFilePath();
      const originalFrontmatter = createTestFrontmatterData({
        title: "Original",
      });
      const body = "Body content";

      const result = MarkdownDocument.create(
        path,
        "content",
        originalFrontmatter,
        body,
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;

      const newFrontmatter = createTestFrontmatterData({
        title: "Updated",
        version: "2.0",
      });
      const updatedDoc = doc.withFrontmatter(newFrontmatter);

      // Check that frontmatter was updated
      const titleResult = updatedDoc.getFrontmatter().get("title");
      if (titleResult.ok) {
        assertEquals(titleResult.data, "Updated");
      }

      const versionResult = updatedDoc.getFrontmatter().get("version");
      if (versionResult.ok) {
        assertEquals(versionResult.data, "2.0");
      }

      // Check that other properties remain unchanged
      assertEquals(updatedDoc.getPath().getValue(), path.getValue());
      assertEquals(updatedDoc.getBody(), body);
    });

    it("should preserve immutability of original document", () => {
      const path = createTestFilePath();
      const originalFrontmatter = createTestFrontmatterData({
        title: "Original",
      });

      const result = MarkdownDocument.create(
        path,
        "content",
        originalFrontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;

      const newFrontmatter = createTestFrontmatterData({ title: "Updated" });
      const updatedDoc = doc.withFrontmatter(newFrontmatter);

      // Original should remain unchanged
      const originalTitle = doc.getFrontmatter().get("title");
      if (originalTitle.ok) {
        assertEquals(originalTitle.data, "Original");
      }

      // Updated should have new value
      const updatedTitle = updatedDoc.getFrontmatter().get("title");
      if (updatedTitle.ok) {
        assertEquals(updatedTitle.data, "Updated");
      }
    });
  });

  describe("getFileName", () => {
    it("should return the file name from path", () => {
      const pathResult = FilePath.create("/test/path/document.md");
      if (!pathResult.ok) throw new Error("Failed to create path");

      const path = pathResult.data;
      const frontmatter = createTestFrontmatterData();

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getFileName(), "document.md");
    });

    it("should return file name for root level file", () => {
      const pathResult = FilePath.create("/README.md");
      if (!pathResult.ok) throw new Error("Failed to create path");

      const path = pathResult.data;
      const frontmatter = createTestFrontmatterData();

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getFileName(), "README.md");
    });
  });

  describe("getDirectory", () => {
    it("should return the directory from path", () => {
      const pathResult = FilePath.create("/test/path/document.md");
      if (!pathResult.ok) throw new Error("Failed to create path");

      const path = pathResult.data;
      const frontmatter = createTestFrontmatterData();

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getDirectory(), "/test/path");
    });

    it("should return root for root level file", () => {
      const pathResult = FilePath.create("/README.md");
      if (!pathResult.ok) throw new Error("Failed to create path");

      const path = pathResult.data;
      const frontmatter = createTestFrontmatterData();

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getDirectory(), "");
    });

    it("should handle nested directories", () => {
      const pathResult = FilePath.create("/a/b/c/d/file.md");
      if (!pathResult.ok) throw new Error("Failed to create path");

      const path = pathResult.data;
      const frontmatter = createTestFrontmatterData();

      const result = MarkdownDocument.create(
        path,
        "content",
        frontmatter,
        "body",
      );

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;
      assertEquals(doc.getDirectory(), "/a/b/c/d");
    });
  });

  describe("integration scenarios", () => {
    it("should handle document with all features", () => {
      const pathResult = FilePath.create("/docs/guide/introduction.md");
      if (!pathResult.ok) throw new Error("Failed to create path");

      const path = pathResult.data;
      const content = `---
title: Introduction
author: John Doe
tags:
  - guide
  - basics
meta:
  version: 1.0.0
  updated: 2024-01-01
---

# Introduction

This is the introduction content.`;

      const frontmatter = createTestFrontmatterData({
        title: "Introduction",
        author: "John Doe",
        tags: ["guide", "basics"],
        meta: {
          version: "1.0.0",
          updated: "2024-01-01",
        },
      });

      const body = "\n# Introduction\n\nThis is the introduction content.";

      const result = MarkdownDocument.create(path, content, frontmatter, body);

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;

      // Verify all methods work correctly
      assertEquals(doc.getPath().getValue(), "/docs/guide/introduction.md");
      assertEquals(doc.getContent(), content);
      assertEquals(doc.getBody(), body);
      assertEquals(doc.hasFrontmatter(), true);
      assertEquals(doc.getFileName(), "introduction.md");
      assertEquals(doc.getDirectory(), "/docs/guide");

      // Verify frontmatter data
      const titleResult = doc.getFrontmatter().get("title");
      if (titleResult.ok) {
        assertEquals(titleResult.data, "Introduction");
      }

      const tagsResult = doc.getFrontmatter().get("tags");
      if (tagsResult.ok) {
        assertEquals(Array.isArray(tagsResult.data), true);
        assertEquals((tagsResult.data as string[]).length, 2);
      }
    });

    it("should handle minimal document", () => {
      const pathResult = FilePath.create("/simple.md");
      if (!pathResult.ok) throw new Error("Failed to create path");

      const path = pathResult.data;
      const content = "Just content";
      const frontmatter = createTestFrontmatterData({});
      const body = "Just content";

      const result = MarkdownDocument.create(path, content, frontmatter, body);

      if (!result.ok) throw new Error("Failed to create document");

      const doc = result.data;

      assertEquals(doc.getPath().getValue(), "/simple.md");
      assertEquals(doc.getContent(), content);
      assertEquals(doc.getBody(), body);
      assertEquals(doc.hasFrontmatter(), false);
      assertEquals(doc.getFileName(), "simple.md");
      assertEquals(doc.getDirectory(), "");
    });
  });
});
