import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { FilePath } from "../../../../../src/domain/frontmatter/value-objects/file-path.ts";

describe("FilePath Value Object", () => {
  describe("create", () => {
    it("should create FilePath with valid path", () => {
      // Arrange & Act
      const result = FilePath.create("src/test/file.md");

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getValue(), "src/test/file.md");
      }
    });

    it("should trim whitespace from path", () => {
      // Arrange & Act
      const result = FilePath.create("  src/test/file.md  ");

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getValue(), "src/test/file.md");
      }
    });

    it("should reject empty path", () => {
      // Arrange & Act
      const result = FilePath.create("");

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
        assertExists(result.error.message);
      }
    });

    it("should reject whitespace-only path", () => {
      // Arrange & Act
      const result = FilePath.create("   ");

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
        assertExists(result.error.message);
      }
    });

    it("should reject path with null characters", () => {
      // Arrange & Act
      const result = FilePath.create("src/test\0/file.md");

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
        if (result.error.kind === "InvalidFormat") {
          assertEquals(result.error.format, "file path");
          assertEquals(result.error.value, "src/test\0/file.md");
        }
        assertEquals(
          result.error.message,
          "File path cannot contain null characters",
        );
      }
    });

    it("should maintain Result pattern compliance", () => {
      // Arrange & Act
      const validResult = FilePath.create("valid/path.md");
      const invalidResult = FilePath.create("");

      // Assert
      assertExists(validResult);
      assertEquals(typeof validResult.ok, "boolean");
      assertExists(invalidResult);
      assertEquals(typeof invalidResult.ok, "boolean");

      if (validResult.ok) {
        assertExists(validResult.data);
        assertExists(validResult.data.getValue);
      } else {
        assertExists(validResult.error);
        assertExists(validResult.error.kind);
        assertExists(validResult.error.message);
      }
    });
  });

  describe("path type detection", () => {
    it("should detect absolute paths", () => {
      // Arrange
      const result = FilePath.create("/absolute/path/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.isAbsolute(), true);
      assertEquals(result.data.isRelative(), false);
    });

    it("should detect relative paths", () => {
      // Arrange
      const result = FilePath.create("relative/path/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.isAbsolute(), false);
      assertEquals(result.data.isRelative(), true);
    });

    it("should detect current directory relative paths", () => {
      // Arrange
      const result = FilePath.create("./file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.isAbsolute(), false);
      assertEquals(result.data.isRelative(), true);
    });

    it("should detect parent directory relative paths", () => {
      // Arrange
      const result = FilePath.create("../parent/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.isAbsolute(), false);
      assertEquals(result.data.isRelative(), true);
    });
  });

  describe("file name extraction", () => {
    it("should extract file name from simple path", () => {
      // Arrange
      const result = FilePath.create("file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getFileName(), "file.md");
    });

    it("should extract file name from nested path", () => {
      // Arrange
      const result = FilePath.create("src/test/nested/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getFileName(), "file.md");
    });

    it("should extract file name from absolute path", () => {
      // Arrange
      const result = FilePath.create("/absolute/path/document.txt");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getFileName(), "document.txt");
    });

    it("should handle file name without extension", () => {
      // Arrange
      const result = FilePath.create("src/README");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getFileName(), "README");
    });

    it("should handle directory-only path", () => {
      // Arrange
      const result = FilePath.create("src/test/");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getFileName(), "");
    });
  });

  describe("extension extraction", () => {
    it("should extract common file extensions", () => {
      // Test cases
      const testCases = [
        ["file.md", "md"],
        ["document.txt", "txt"],
        ["script.js", "js"],
        ["style.css", "css"],
        ["data.json", "json"],
      ];

      testCases.forEach(([path, expectedExt]) => {
        const result = FilePath.create(path);
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.getExtension(), expectedExt);
        }
      });
    });

    it("should handle multiple dots in filename", () => {
      // Arrange
      const result = FilePath.create("file.test.spec.ts");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getExtension(), "ts");
    });

    it("should handle files without extension", () => {
      // Arrange
      const result = FilePath.create("README");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getExtension(), "");
    });

    it("should handle hidden files with extension", () => {
      // Arrange
      const result = FilePath.create(".gitignore");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getExtension(), "gitignore");
    });

    it("should handle hidden files with real extension", () => {
      // Arrange
      const result = FilePath.create(".eslintrc.json");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getExtension(), "json");
    });
  });

  describe("directory extraction", () => {
    it("should extract directory from nested path", () => {
      // Arrange
      const result = FilePath.create("src/test/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getDirectory(), "src/test");
    });

    it("should extract directory from absolute path", () => {
      // Arrange
      const result = FilePath.create("/home/user/documents/file.txt");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getDirectory(), "/home/user/documents");
    });

    it("should return current directory for file in root", () => {
      // Arrange
      const result = FilePath.create("file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getDirectory(), ".");
    });

    it("should handle root directory files", () => {
      // Arrange
      const result = FilePath.create("/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.getDirectory(), "");
    });
  });

  describe("markdown detection", () => {
    it("should detect .md files as markdown", () => {
      // Arrange
      const result = FilePath.create("document.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.isMarkdown(), true);
    });

    it("should detect .markdown files as markdown", () => {
      // Arrange
      const result = FilePath.create("document.markdown");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.isMarkdown(), true);
    });

    it("should handle case-insensitive markdown extensions", () => {
      // Test cases
      const testCases = [
        "file.MD",
        "file.Md",
        "file.MARKDOWN",
        "file.Markdown",
      ];

      testCases.forEach((path) => {
        const result = FilePath.create(path);
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.isMarkdown(), true);
        }
      });
    });

    it("should not detect non-markdown files", () => {
      // Test cases
      const testCases = [
        "file.txt",
        "file.js",
        "file.json",
        "file.css",
        "file",
      ];

      testCases.forEach((path) => {
        const result = FilePath.create(path);
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.isMarkdown(), false);
        }
      });
    });
  });

  describe("path resolution", () => {
    it("should resolve relative path with base path", () => {
      // Arrange
      const result = FilePath.create("relative/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act
      const resolved = result.data.resolve("/base/path");

      // Assert
      assertEquals(resolved.getValue(), "/base/path/relative/file.md");
    });

    it("should resolve relative path with base path ending in slash", () => {
      // Arrange
      const result = FilePath.create("relative/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act
      const resolved = result.data.resolve("/base/path/");

      // Assert
      assertEquals(resolved.getValue(), "/base/path/relative/file.md");
    });

    it("should return same path for absolute path resolution", () => {
      // Arrange
      const result = FilePath.create("/absolute/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act
      const resolved = result.data.resolve("/base/path");

      // Assert
      assertEquals(resolved.getValue(), "/absolute/file.md");
    });

    it("should handle empty relative path", () => {
      // Arrange
      const result = FilePath.create("file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act
      const resolved = result.data.resolve("/base");

      // Assert
      assertEquals(resolved.getValue(), "/base/file.md");
    });
  });

  describe("string conversion", () => {
    it("should convert to string correctly", () => {
      // Arrange
      const path = "src/test/file.md";
      const result = FilePath.create(path);
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act & Assert
      assertEquals(result.data.toString(), path);
      assertEquals(String(result.data), path);
    });

    it("should maintain string representation after operations", () => {
      // Arrange
      const result = FilePath.create("relative/file.md");
      assertEquals(result.ok, true);
      if (!result.ok) return;

      // Act
      const resolved = result.data.resolve("/base");

      // Assert
      assertEquals(resolved.toString(), "/base/relative/file.md");
    });
  });

  describe("edge cases", () => {
    it("should handle unicode characters in path", () => {
      // Arrange
      const unicodePath = "documents/测试文档.md";
      const result = FilePath.create(unicodePath);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getValue(), unicodePath);
        assertEquals(result.data.getFileName(), "测试文档.md");
        assertEquals(result.data.isMarkdown(), true);
      }
    });

    it("should handle special characters in path", () => {
      // Arrange
      const specialPath = "docs/file with spaces & special-chars.md";
      const result = FilePath.create(specialPath);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getValue(), specialPath);
        assertEquals(
          result.data.getFileName(),
          "file with spaces & special-chars.md",
        );
        assertEquals(result.data.isMarkdown(), true);
      }
    });

    it("should handle very long paths", () => {
      // Arrange
      const longPath = "a".repeat(100) + "/" + "b".repeat(100) + ".md";
      const result = FilePath.create(longPath);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getValue(), longPath);
        assertEquals(result.data.isMarkdown(), true);
      }
    });

    it("should handle single character paths", () => {
      // Arrange
      const result = FilePath.create("a");

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.getValue(), "a");
        assertEquals(result.data.getFileName(), "a");
        assertEquals(result.data.getDirectory(), ".");
      }
    });
  });
});
