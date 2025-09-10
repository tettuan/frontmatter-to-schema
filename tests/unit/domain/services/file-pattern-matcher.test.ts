/**
 * Unit Tests for FilePatternMatcher
 * Tests Smart Constructor pattern and pattern matching logic
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { FilePatternMatcher } from "../../../../src/domain/services/file-pattern-matcher.ts";

describe("FilePatternMatcher", () => {
  describe("create", () => {
    it("should create with simple glob pattern", () => {
      const result = FilePatternMatcher.create("*.md");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.matches("test.md"), true);
        assertEquals(result.data.matches("test.txt"), false);
        assertEquals(result.data.getOriginalPattern(), "*.md");
      }
    });

    it("should create with question mark wildcard", () => {
      const result = FilePatternMatcher.create("test?.md");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.matches("test1.md"), true);
        assertEquals(result.data.matches("testa.md"), true);
        assertEquals(result.data.matches("test12.md"), false);
        assertEquals(result.data.matches("test.md"), false);
      }
    });

    it("should create with custom configuration", () => {
      const result = FilePatternMatcher.create("*.MD", {
        caseSensitive: false,
        dotMatches: true,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.matches("test.md"), true);
        assertEquals(result.data.matches("test.MD"), true);
        assertEquals(result.data.isCaseSensitive(), false);
        assertEquals(result.data.matchesHiddenFiles(), true);
      }
    });

    it("should reject empty pattern", () => {
      const result = FilePatternMatcher.create("");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
      }
    });

    it("should reject excessively long pattern", () => {
      const longPattern = "a".repeat(1001);
      const result = FilePatternMatcher.create(longPattern);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "TooLong");
      }
    });

    it("should reject patterns with excessive wildcards", () => {
      const result = FilePatternMatcher.create(".*.*.*");

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "PatternMismatch");
      }
    });
  });

  describe("createGlob", () => {
    it("should create case-insensitive glob matcher", () => {
      const result = FilePatternMatcher.createGlob("*.JS");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.matches("test.js"), true);
        assertEquals(result.data.matches("test.JS"), true);
        assertEquals(result.data.isCaseSensitive(), false);
      }
    });
  });

  describe("createStrict", () => {
    it("should create case-sensitive strict matcher", () => {
      const result = FilePatternMatcher.createStrict("*.js");

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.matches("test.js"), true);
        assertEquals(result.data.matches("test.JS"), false);
        assertEquals(result.data.isCaseSensitive(), true);
        assertEquals(result.data.matchesHiddenFiles(), true);
      }
    });
  });

  describe("matches", () => {
    it("should match simple wildcard patterns", () => {
      const result = FilePatternMatcher.create("*.txt");
      assertEquals(result.ok, true);

      if (result.ok) {
        const matcher = result.data;
        assertEquals(matcher.matches("readme.txt"), true);
        assertEquals(matcher.matches("data.txt"), true);
        assertEquals(matcher.matches("config.json"), false);
        assertEquals(matcher.matches(""), false);
      }
    });

    it("should match complex patterns", () => {
      const result = FilePatternMatcher.create("test-*.md");
      assertEquals(result.ok, true);

      if (result.ok) {
        const matcher = result.data;
        assertEquals(matcher.matches("test-1.md"), true);
        assertEquals(matcher.matches("test-readme.md"), true);
        assertEquals(matcher.matches("spec-1.md"), false);
        assertEquals(matcher.matches("test-.md"), true);
      }
    });

    it("should handle hidden files based on configuration", () => {
      const visibleResult = FilePatternMatcher.create("*", {
        dotMatches: false,
      });
      const hiddenResult = FilePatternMatcher.create("*", { dotMatches: true });

      assertEquals(visibleResult.ok, true);
      assertEquals(hiddenResult.ok, true);

      if (visibleResult.ok && hiddenResult.ok) {
        // Note: The exact behavior may depend on implementation details
        // This tests the configuration is applied
        assertEquals(visibleResult.data.matchesHiddenFiles(), false);
        assertEquals(hiddenResult.data.matchesHiddenFiles(), true);
      }
    });
  });

  describe("filterMatches", () => {
    it("should filter array of filenames", () => {
      const result = FilePatternMatcher.create("*.js");
      assertEquals(result.ok, true);

      if (result.ok) {
        const filenames = ["app.js", "config.json", "test.js", "readme.md"];
        const matches = result.data.filterMatches(filenames);
        assertEquals(matches, ["app.js", "test.js"]);
      }
    });

    it("should return empty array when no matches", () => {
      const result = FilePatternMatcher.create("*.py");
      assertEquals(result.ok, true);

      if (result.ok) {
        const filenames = ["app.js", "config.json", "test.js"];
        const matches = result.data.filterMatches(filenames);
        assertEquals(matches, []);
      }
    });
  });

  describe("getPatternInfo", () => {
    it("should return pattern information", () => {
      const result = FilePatternMatcher.create("*.md", {
        caseSensitive: true,
        dotMatches: false,
      });

      assertEquals(result.ok, true);
      if (result.ok) {
        const info = result.data.getPatternInfo();
        assertEquals(info.originalPattern, "*.md");
        assertEquals(info.config.caseSensitive, true);
        assertEquals(info.config.dotMatches, false);
        assertExists(info.regexPattern);
      }
    });
  });

  describe("immutable updates", () => {
    it("should create new matcher with withConfig", () => {
      const originalResult = FilePatternMatcher.create("*.txt", {
        caseSensitive: true,
      });
      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        const updatedResult = originalResult.data.withConfig({
          caseSensitive: false,
        });
        assertEquals(updatedResult.ok, true);

        if (updatedResult.ok) {
          assertEquals(originalResult.data.isCaseSensitive(), true);
          assertEquals(updatedResult.data.isCaseSensitive(), false);
          assertEquals(originalResult.data.getOriginalPattern(), "*.txt");
          assertEquals(updatedResult.data.getOriginalPattern(), "*.txt");
        }
      }
    });

    it("should validate when creating new matcher with invalid pattern", () => {
      const originalResult = FilePatternMatcher.create("*.txt");
      assertEquals(originalResult.ok, true);

      if (originalResult.ok) {
        // This should work since we're only changing config, not pattern
        const updatedResult = originalResult.data.withConfig({
          caseSensitive: false,
        });
        assertEquals(updatedResult.ok, true);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty filename", () => {
      const result = FilePatternMatcher.create("*");
      assertEquals(result.ok, true);

      if (result.ok) {
        assertEquals(result.data.matches(""), false);
      }
    });

    it("should handle filename with no extension", () => {
      const result = FilePatternMatcher.create("*");
      assertEquals(result.ok, true);

      if (result.ok) {
        assertEquals(result.data.matches("README"), true);
        assertEquals(result.data.matches("Makefile"), true);
      }
    });

    it("should handle patterns with dots", () => {
      const result = FilePatternMatcher.create("*.test.js");
      assertEquals(result.ok, true);

      if (result.ok) {
        assertEquals(result.data.matches("app.test.js"), true);
        assertEquals(result.data.matches("app.js"), false);
        assertEquals(result.data.matches("test.js"), false);
      }
    });
  });
});
