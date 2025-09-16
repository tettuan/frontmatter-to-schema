/**
 * Unit tests for TemplatePath value object
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - TemplatePath creation and validation
 * - Path format validation (.json, .yaml, .yml)
 * - Path manipulation methods (getFileName, getDirectory, resolve)
 * - Path type detection (absolute/relative)
 * - Error handling following Totality principles
 */

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { TemplatePath } from "../../../../../src/domain/template/value-objects/template-path.ts";

describe("TemplatePath", () => {
  describe("create", () => {
    describe("valid paths", () => {
      it("should create template path with .json extension", () => {
        // Act
        const result = TemplatePath.create("template.json");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const path = result.data;
        assertEquals(path.getValue(), "template.json");
        assertEquals(path.getFormat(), "json");
      });

      it("should create template path with .yaml extension", () => {
        // Act
        const result = TemplatePath.create("template.yaml");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const path = result.data;
        assertEquals(path.getValue(), "template.yaml");
        assertEquals(path.getFormat(), "yaml");
      });

      it("should create template path with .yml extension", () => {
        // Act
        const result = TemplatePath.create("template.yml");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const path = result.data;
        assertEquals(path.getValue(), "template.yml");
        assertEquals(path.getFormat(), "yaml");
      });

      it("should create absolute path with leading slash", () => {
        // Act
        const result = TemplatePath.create("/absolute/path/template.json");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const path = result.data;
        assertEquals(path.getValue(), "/absolute/path/template.json");
        assertEquals(path.isAbsolute(), true);
        assertEquals(path.isRelative(), false);
      });

      it("should create relative path without leading slash", () => {
        // Act
        const result = TemplatePath.create("relative/path/template.json");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const path = result.data;
        assertEquals(path.getValue(), "relative/path/template.json");
        assertEquals(path.isRelative(), true);
        assertEquals(path.isAbsolute(), false);
      });

      it("should trim whitespace from path", () => {
        // Act
        const result = TemplatePath.create("  template.json  ");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data.getValue(), "template.json");
      });

      it("should handle nested directory structure", () => {
        // Act
        const result = TemplatePath.create("dir1/dir2/dir3/template.yaml");

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const path = result.data;
        assertEquals(path.getValue(), "dir1/dir2/dir3/template.yaml");
        assertEquals(path.getFileName(), "template.yaml");
        assertEquals(path.getDirectory(), "dir1/dir2/dir3");
      });
    });

    describe("invalid paths", () => {
      it("should reject empty string", () => {
        // Act
        const result = TemplatePath.create("");

        // Assert
        assertEquals(result.ok, false);
        if (result.ok) return;

        assertEquals(result.error.kind, "EmptyInput");
      });

      it("should reject whitespace-only string", () => {
        // Act
        const result = TemplatePath.create("   ");

        // Assert
        assertEquals(result.ok, false);
        if (result.ok) return;

        assertEquals(result.error.kind, "EmptyInput");
      });

      it("should reject path without valid extension", () => {
        // Act
        const result = TemplatePath.create("template.txt");

        // Assert
        assertEquals(result.ok, false);
        if (result.ok) return;

        assertEquals(result.error.kind, "InvalidFormat");
        if (result.error.kind === "InvalidFormat") {
          assertEquals(result.error.format, "template path");
          assertEquals(result.error.value, "template.txt");
        }
      });

      it("should reject path with no extension", () => {
        // Act
        const result = TemplatePath.create("template");

        // Assert
        assertEquals(result.ok, false);
        if (result.ok) return;

        assertEquals(result.error.kind, "InvalidFormat");
        if (result.error.kind === "InvalidFormat") {
          assertEquals(result.error.format, "template path");
          assertEquals(result.error.value, "template");
        }
      });

      it("should reject path with invalid extension", () => {
        // Act
        const result = TemplatePath.create("template.xml");

        // Assert
        assertEquals(result.ok, false);
        if (result.ok) return;

        assertEquals(result.error.kind, "InvalidFormat");
        if (result.error.kind === "InvalidFormat") {
          assertEquals(result.error.format, "template path");
          assertEquals(result.error.value, "template.xml");
        }
      });

      it("should reject path ending with just a period", () => {
        // Act
        const result = TemplatePath.create("template.");

        // Assert
        assertEquals(result.ok, false);
        if (result.ok) return;

        assertEquals(result.error.kind, "InvalidFormat");
      });
    });
  });

  describe("path type detection", () => {
    it("should detect absolute path starting with slash", () => {
      // Arrange
      const result = TemplatePath.create("/home/user/template.json");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act & Assert
      assertEquals(path.isAbsolute(), true);
      assertEquals(path.isRelative(), false);
    });

    it("should detect relative path not starting with slash", () => {
      // Arrange
      const result = TemplatePath.create("templates/config.yaml");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act & Assert
      assertEquals(path.isRelative(), true);
      assertEquals(path.isAbsolute(), false);
    });

    it("should detect current directory relative path", () => {
      // Arrange
      const result = TemplatePath.create("template.json");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act & Assert
      assertEquals(path.isRelative(), true);
      assertEquals(path.isAbsolute(), false);
    });
  });

  describe("getFileName", () => {
    it("should extract filename from simple path", () => {
      // Arrange
      const result = TemplatePath.create("template.json");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const fileName = path.getFileName();

      // Assert
      assertEquals(fileName, "template.json");
    });

    it("should extract filename from nested path", () => {
      // Arrange
      const result = TemplatePath.create("dir1/dir2/template.yaml");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const fileName = path.getFileName();

      // Assert
      assertEquals(fileName, "template.yaml");
    });

    it("should extract filename from absolute path", () => {
      // Arrange
      const result = TemplatePath.create("/absolute/path/template.yml");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const fileName = path.getFileName();

      // Assert
      assertEquals(fileName, "template.yml");
    });
  });

  describe("getDirectory", () => {
    it("should return current directory for simple filename", () => {
      // Arrange
      const result = TemplatePath.create("template.json");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const directory = path.getDirectory();

      // Assert
      assertEquals(directory, ".");
    });

    it("should extract directory from nested path", () => {
      // Arrange
      const result = TemplatePath.create("dir1/dir2/template.yaml");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const directory = path.getDirectory();

      // Assert
      assertEquals(directory, "dir1/dir2");
    });

    it("should extract directory from absolute path", () => {
      // Arrange
      const result = TemplatePath.create("/absolute/path/template.yml");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const directory = path.getDirectory();

      // Assert
      assertEquals(directory, "/absolute/path");
    });

    it("should handle root directory path", () => {
      // Arrange
      const result = TemplatePath.create("/template.json");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const directory = path.getDirectory();

      // Assert
      assertEquals(directory, "");
    });
  });

  describe("getFormat", () => {
    it("should detect json format", () => {
      // Arrange
      const result = TemplatePath.create("template.json");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const format = path.getFormat();

      // Assert
      assertEquals(format, "json");
    });

    it("should detect yaml format for .yaml extension", () => {
      // Arrange
      const result = TemplatePath.create("template.yaml");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const format = path.getFormat();

      // Assert
      assertEquals(format, "yaml");
    });

    it("should detect yaml format for .yml extension", () => {
      // Arrange
      const result = TemplatePath.create("template.yml");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const format = path.getFormat();

      // Assert
      assertEquals(format, "yaml");
    });
  });

  describe("resolve", () => {
    describe("relative path resolution", () => {
      it("should resolve relative path with base path ending with slash", () => {
        // Arrange
        const result = TemplatePath.create("template.json");
        assertEquals(result.ok, true);
        if (!result.ok) return;
        const path = result.data;

        // Act
        const resolved = path.resolve("/base/path/");

        // Assert
        assertEquals(resolved.getValue(), "/base/path/template.json");
        assertEquals(resolved.isAbsolute(), true);
      });

      it("should resolve relative path with base path not ending with slash", () => {
        // Arrange
        const result = TemplatePath.create("template.yaml");
        assertEquals(result.ok, true);
        if (!result.ok) return;
        const path = result.data;

        // Act
        const resolved = path.resolve("/base/path");

        // Assert
        assertEquals(resolved.getValue(), "/base/path/template.yaml");
        assertEquals(resolved.isAbsolute(), true);
      });

      it("should resolve nested relative path", () => {
        // Arrange
        const result = TemplatePath.create("subdir/template.yml");
        assertEquals(result.ok, true);
        if (!result.ok) return;
        const path = result.data;

        // Act
        const resolved = path.resolve("/base");

        // Assert
        assertEquals(resolved.getValue(), "/base/subdir/template.yml");
      });

      it("should resolve with relative base path", () => {
        // Arrange
        const result = TemplatePath.create("template.json");
        assertEquals(result.ok, true);
        if (!result.ok) return;
        const path = result.data;

        // Act
        const resolved = path.resolve("base/path");

        // Assert
        assertEquals(resolved.getValue(), "base/path/template.json");
        assertEquals(resolved.isRelative(), true);
      });
    });

    describe("absolute path resolution", () => {
      it("should return self for absolute path", () => {
        // Arrange
        const result = TemplatePath.create("/absolute/template.json");
        assertEquals(result.ok, true);
        if (!result.ok) return;
        const path = result.data;

        // Act
        const resolved = path.resolve("/some/base/path");

        // Assert
        assertEquals(resolved.getValue(), "/absolute/template.json");
        assertEquals(resolved, path); // Should be the same instance
      });

      it("should ignore base path for absolute paths", () => {
        // Arrange
        const result = TemplatePath.create("/root/config.yaml");
        assertEquals(result.ok, true);
        if (!result.ok) return;
        const path = result.data;

        // Act
        const resolved = path.resolve("relative/base");

        // Assert
        assertEquals(resolved.getValue(), "/root/config.yaml");
        assertEquals(resolved, path);
      });
    });
  });

  describe("toString", () => {
    it("should return the path value", () => {
      // Arrange
      const result = TemplatePath.create("template.json");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const stringValue = path.toString();

      // Assert
      assertEquals(stringValue, "template.json");
    });

    it("should return absolute path value", () => {
      // Arrange
      const result = TemplatePath.create("/absolute/path/template.yaml");
      assertEquals(result.ok, true);
      if (!result.ok) return;
      const path = result.data;

      // Act
      const stringValue = path.toString();

      // Assert
      assertEquals(stringValue, "/absolute/path/template.yaml");
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("should handle path with multiple extensions correctly", () => {
      // Act
      const result = TemplatePath.create("template.backup.json");

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const path = result.data;
      assertEquals(path.getFormat(), "json");
      assertEquals(path.getFileName(), "template.backup.json");
    });

    it("should handle very long paths", () => {
      // Arrange
      const longPath = "a".repeat(100) + "/b".repeat(100) + "/template.json";

      // Act
      const result = TemplatePath.create(longPath);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.getValue(), longPath);
    });

    it("should preserve path exactly as provided after trimming", () => {
      // Arrange
      const pathWithSpaces = "path with spaces/template.yaml";

      // Act
      const result = TemplatePath.create("  " + pathWithSpaces + "  ");

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.getValue(), pathWithSpaces);
    });

    it("should handle path with dots in directory names", () => {
      // Act
      const result = TemplatePath.create("dir.with.dots/template.json");

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const path = result.data;
      assertEquals(path.getDirectory(), "dir.with.dots");
      assertEquals(path.getFileName(), "template.json");
    });
  });

  describe("totality error handling", () => {
    it("should provide meaningful error message for invalid format", () => {
      // Act
      const result = TemplatePath.create("template.invalid");

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "InvalidFormat");
      assertEquals(
        result.error.message,
        "Template path must end with .json, .yaml, or .yml",
      );
    });

    it("should handle null-like inputs gracefully", () => {
      // These would be handled by TypeScript at compile time,
      // but we test the runtime behavior for robustness

      // Act
      const result1 = TemplatePath.create("");
      const result2 = TemplatePath.create("   ");

      // Assert
      assertEquals(result1.ok, false);
      assertEquals(result2.ok, false);

      if (!result1.ok) {
        assertEquals(result1.error.kind, "EmptyInput");
      }
      if (!result2.ok) {
        assertEquals(result2.error.kind, "EmptyInput");
      }
    });
  });
});
