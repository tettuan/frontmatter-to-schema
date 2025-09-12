/**
 * FilePattern Value Object Tests
 *
 * Tests Smart Constructor pattern following Totality principles:
 * - All Result<T,E> patterns validated
 * - Error conditions comprehensively tested
 * - Business rules enforced through tests
 * - DDD value object behavior verified
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { FilePattern } from "../../../../src/domain/value-objects/file-pattern.ts";
import { FILE_PATTERNS } from "../../../../src/domain/constants/index.ts";

describe("FilePattern - Smart Constructor Value Object", () => {
  describe("createGlob() - Glob Pattern Creation", () => {
    it("should create valid glob pattern", () => {
      const result = FilePattern.createGlob("*.md");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "*.md");
        assertEquals(result.data.getType(), "glob");
      }
    });

    it("should create complex glob patterns", () => {
      const patterns = ["**/*.ts", "src/**/*.js", "test_*.md", "file?.txt"];

      for (const pattern of patterns) {
        const result = FilePattern.createGlob(pattern);
        assertEquals(result.ok, true, `Pattern ${pattern} should be valid`);
        if (result.ok) {
          assertEquals(result.data.toString(), pattern);
          assertEquals(result.data.getType(), "glob");
        }
      }
    });

    it("should trim whitespace from patterns", () => {
      const result = FilePattern.createGlob("  *.md  ");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "*.md");
      }
    });

    it("should reject empty patterns", () => {
      const emptyPatterns = ["", "   ", "\t", "\n"];

      for (const pattern of emptyPatterns) {
        const result = FilePattern.createGlob(pattern);
        assertEquals(
          result.ok,
          false,
          `Pattern '${pattern}' should be rejected`,
        );
        if (!result.ok) {
          assertEquals(result.error.kind, "EmptyInput");
          assertExists(result.error.message);
        }
      }
    });

    it("should reject invalid glob patterns", () => {
      const invalidPatterns = ["***", "file***.md"];

      for (const pattern of invalidPatterns) {
        const result = FilePattern.createGlob(pattern);
        assertEquals(
          result.ok,
          false,
          `Pattern '${pattern}' should be rejected`,
        );
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidFormat");
          assertExists(result.error.message);
        }
      }
    });
  });

  describe("createRegex() - Regex Pattern Creation", () => {
    it("should create valid regex pattern", () => {
      const result = FilePattern.createRegex("\\.md$");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "\\.md$");
        assertEquals(result.data.getType(), "regex");
      }
    });

    it("should create complex regex patterns", () => {
      const patterns = [".*\\.ts$", "^test.*\\.js$", "\\.(md|mdx)$"];

      for (const pattern of patterns) {
        const result = FilePattern.createRegex(pattern);
        assertEquals(result.ok, true, `Pattern ${pattern} should be valid`);
        if (result.ok) {
          assertEquals(result.data.toString(), pattern);
          assertEquals(result.data.getType(), "regex");
        }
      }
    });

    it("should reject invalid regex patterns", () => {
      const invalidPatterns = ["[unclosed", "(?invalid)", "*+", "(?"];

      for (const pattern of invalidPatterns) {
        const result = FilePattern.createRegex(pattern);
        assertEquals(
          result.ok,
          false,
          `Pattern '${pattern}' should be rejected`,
        );
        if (!result.ok) {
          assertEquals(result.error.kind, "InvalidFormat");
          assertExists(result.error.message);
        }
      }
    });

    it("should reject empty regex patterns", () => {
      const result = FilePattern.createRegex("");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
        assertExists(result.error.message);
      }
    });
  });

  describe("createDefault() - Default Pattern Factory", () => {
    it("should create default markdown pattern", () => {
      const pattern = FilePattern.createDefault();

      assertEquals(pattern.toString(), FILE_PATTERNS.MARKDOWN);
      assertEquals(pattern.getType(), "regex");
    });

    it("should use domain constant not hardcoded value", () => {
      const pattern = FilePattern.createDefault();

      // Should match the constant, proving no hardcoding
      assertEquals(pattern.toString(), FILE_PATTERNS.MARKDOWN);
      assertEquals(pattern.toString(), "\\.md$"); // Current constant value
    });
  });

  describe("createMarkdownGlob() - Markdown Glob Factory", () => {
    it("should create markdown glob pattern", () => {
      const result = FilePattern.createMarkdownGlob();

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "*.md");
        assertEquals(result.data.getType(), "glob");
      }
    });
  });

  describe("forExtension() - Extension-based Factory", () => {
    it("should create pattern for file extension", () => {
      const result = FilePattern.forExtension("ts");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "*.ts");
        assertEquals(result.data.getType(), "glob");
      }
    });

    it("should handle extensions with leading dots", () => {
      const result = FilePattern.forExtension(".js");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.toString(), "*.js");
      }
    });

    it("should reject empty extensions", () => {
      const result = FilePattern.forExtension("");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
        assertExists(result.error.message);
      }
    });
  });

  describe("toRegex() - Pattern Conversion", () => {
    it("should convert glob to regex correctly", () => {
      const globResult = FilePattern.createGlob("*.md");
      assertEquals(globResult.ok, true);

      if (globResult.ok) {
        const regex = globResult.data.toRegex();

        // Test the regex works correctly
        assertEquals(regex.test("file.md"), true);
        assertEquals(regex.test("test.md"), true);
        assertEquals(regex.test("file.txt"), false);
        assertEquals(regex.test("path/file.md"), false); // * doesn't match /
      }
    });

    it("should handle complex glob patterns", () => {
      const globResult = FilePattern.createGlob("**/*.ts");
      assertEquals(globResult.ok, true);

      if (globResult.ok) {
        const regex = globResult.data.toRegex();

        // ** should match paths with /
        assertEquals(regex.test("src/file.ts"), true);
        assertEquals(regex.test("deep/path/file.ts"), true);
        assertEquals(regex.test("file.ts"), true);
        assertEquals(regex.test("file.js"), false);
      }
    });

    it("should return regex directly for regex patterns", () => {
      const regexResult = FilePattern.createRegex("\\.md$");
      assertEquals(regexResult.ok, true);

      if (regexResult.ok) {
        const regex = regexResult.data.toRegex();

        assertEquals(regex.test("file.md"), true);
        assertEquals(regex.test("test.md"), true);
        assertEquals(regex.test("file.txt"), false);
      }
    });
  });

  describe("matches() - Pattern Matching", () => {
    it("should match filenames correctly with glob patterns", () => {
      const globResult = FilePattern.createGlob("*.md");
      assertEquals(globResult.ok, true);

      if (globResult.ok) {
        const pattern = globResult.data;

        assertEquals(pattern.matches("file.md"), true);
        assertEquals(pattern.matches("README.md"), true);
        assertEquals(pattern.matches("file.txt"), false);
        assertEquals(pattern.matches("path/file.md"), false);
      }
    });

    it("should match filenames correctly with regex patterns", () => {
      const regexResult = FilePattern.createRegex(".*\\.md$");
      assertEquals(regexResult.ok, true);

      if (regexResult.ok) {
        const pattern = regexResult.data;

        assertEquals(pattern.matches("file.md"), true);
        assertEquals(pattern.matches("path/file.md"), true);
        assertEquals(pattern.matches("file.txt"), false);
      }
    });
  });

  describe("equals() - Value Object Equality", () => {
    it("should be equal for identical patterns and types", () => {
      const glob1Result = FilePattern.createGlob("*.md");
      const glob2Result = FilePattern.createGlob("*.md");

      assertEquals(glob1Result.ok, true);
      assertEquals(glob2Result.ok, true);

      if (glob1Result.ok && glob2Result.ok) {
        assertEquals(glob1Result.data.equals(glob2Result.data), true);
      }
    });

    it("should not be equal for different patterns", () => {
      const pattern1Result = FilePattern.createGlob("*.md");
      const pattern2Result = FilePattern.createGlob("*.txt");

      assertEquals(pattern1Result.ok, true);
      assertEquals(pattern2Result.ok, true);

      if (pattern1Result.ok && pattern2Result.ok) {
        assertEquals(pattern1Result.data.equals(pattern2Result.data), false);
      }
    });

    it("should not be equal for different types", () => {
      const globResult = FilePattern.createGlob("*.md");
      const regexResult = FilePattern.createRegex("\\*\\.md");

      assertEquals(globResult.ok, true);
      assertEquals(regexResult.ok, true);

      if (globResult.ok && regexResult.ok) {
        assertEquals(globResult.data.equals(regexResult.data), false);
      }
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle special characters in glob patterns", () => {
      const specialPatterns = ["test[abc].md", "file{1,2,3}.txt"];

      for (const pattern of specialPatterns) {
        const result = FilePattern.createGlob(pattern);
        assertEquals(result.ok, true, `Pattern ${pattern} should be accepted`);
      }
    });

    it("should maintain immutability", () => {
      const result = FilePattern.createGlob("*.md");
      assertEquals(result.ok, true);

      if (result.ok) {
        const pattern = result.data;
        const originalString = pattern.toString();
        const originalType = pattern.getType();

        // No methods should mutate the object
        pattern.toRegex();
        pattern.matches("test.md");

        assertEquals(pattern.toString(), originalString);
        assertEquals(pattern.getType(), originalType);
      }
    });
  });

  describe("Integration with Domain Constants", () => {
    it("should use FILE_PATTERNS constants correctly", () => {
      const defaultPattern = FilePattern.createDefault();

      // Should match exactly with domain constant
      assertEquals(defaultPattern.toString(), FILE_PATTERNS.MARKDOWN);
    });

    it("should work with all defined file pattern constants", () => {
      const patterns = [
        FILE_PATTERNS.MARKDOWN,
        FILE_PATTERNS.JSON,
        FILE_PATTERNS.YAML,
        FILE_PATTERNS.HANDLEBARS,
      ];

      for (const pattern of patterns) {
        const result = FilePattern.createRegex(pattern);
        assertEquals(
          result.ok,
          true,
          `Constant pattern ${pattern} should be valid`,
        );
      }
    });
  });
});
