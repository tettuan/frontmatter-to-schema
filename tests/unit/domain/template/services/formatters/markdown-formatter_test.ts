import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { MarkdownFormatter } from "../../../../../../src/domain/template/services/formatters/markdown-formatter.ts";

describe("MarkdownFormatter Service", () => {
  describe("create", () => {
    it("should create MarkdownFormatter instance", () => {
      // Arrange & Act
      const result = MarkdownFormatter.create();

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertExists(result.data.format);
      }
    });

    it("should maintain Result pattern compliance", () => {
      // Arrange & Act
      const result = MarkdownFormatter.create();

      // Assert
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertExists(result.data);
        assertExists(result.data.format);
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });
  });

  describe("format", () => {
    let formatter: MarkdownFormatter;

    beforeEach(() => {
      const result = MarkdownFormatter.create();
      assertEquals(result.ok, true);
      if (result.ok) {
        formatter = result.data;
      }
    });

    it("should format simple object as Markdown with JSON code block", () => {
      // Arrange
      const data = {
        name: "John Doe",
        age: 30,
        active: true,
      };

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("```"), true);
        assertEquals(result.data.includes("John Doe"), true);
        assertEquals(result.data.includes("30"), true);
        assertEquals(result.data.includes("true"), true);
      }
    });

    it("should format array as Markdown with JSON code block", () => {
      // Arrange
      const data = ["apple", "banana", "cherry"];

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("apple"), true);
        assertEquals(result.data.includes("banana"), true);
        assertEquals(result.data.includes("cherry"), true);
      }
    });

    it("should format string as Markdown with JSON code block", () => {
      // Arrange
      const data = "Hello, World!";

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("Hello, World!"), true);
      }
    });

    it("should format number as Markdown with JSON code block", () => {
      // Arrange
      const data = 42;

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("42"), true);
      }
    });

    it("should format boolean as Markdown with JSON code block", () => {
      // Arrange
      const data = false;

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("false"), true);
      }
    });

    it("should format null as Markdown with JSON code block", () => {
      // Arrange
      const data = null;

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("null"), true);
      }
    });

    it("should format nested object as Markdown with JSON code block", () => {
      // Arrange
      const data = {
        user: {
          profile: {
            name: "Jane Smith",
            preferences: {
              theme: "dark",
              notifications: true,
            },
          },
          posts: [
            { title: "First Post", likes: 5 },
            { title: "Second Post", likes: 12 },
          ],
        },
      };

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("Jane Smith"), true);
        assertEquals(result.data.includes("dark"), true);
        assertEquals(result.data.includes("First Post"), true);
        assertEquals(result.data.includes("Second Post"), true);
      }
    });

    it("should maintain proper Markdown structure", () => {
      // Arrange
      const data = { test: "value" };

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const lines = result.data.split("\n");
        assertEquals(lines[0], "# Generated Output");
        assertEquals(lines[1], "");
        assertEquals(lines[2], "```json");
        assertEquals(lines[lines.length - 2], "```");
        assertEquals(lines[lines.length - 1], "");
      }
    });

    it("should handle empty object", () => {
      // Arrange
      const data = {};

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("{}"), true);
      }
    });

    it("should handle empty array", () => {
      // Arrange
      const data: unknown[] = [];

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        assertEquals(result.data.includes("[]"), true);
      }
    });

    it("should handle special characters in data", () => {
      // Arrange
      const data = {
        message: 'Hello "World"!',
        special: "Line 1\nLine 2\tTabbed",
        unicode: "Testing 测试 🚀",
      };

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.includes("# Generated Output"), true);
        assertEquals(result.data.includes("```json"), true);
        // JSON should properly escape special characters
        assertEquals(result.data.includes("Hello"), true);
        assertEquals(result.data.includes("World"), true);
        assertEquals(result.data.includes("Line 1"), true);
        assertEquals(result.data.includes("测试"), true);
        assertEquals(result.data.includes("🚀"), true);
      }
    });

    it("should maintain Result pattern in format method", () => {
      // Arrange
      const data = { test: "data" };

      // Act
      const result = formatter.format(data);

      // Assert
      assertExists(result);
      assertEquals(typeof result.ok, "boolean");

      if (result.ok) {
        assertExists(result.data);
        assertEquals(typeof result.data, "string");
      } else {
        assertExists(result.error);
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });
  });

  describe("error handling", () => {
    it("should handle formatting errors from JsonFormatter", () => {
      // This test verifies the error propagation path
      // Note: JsonFormatter typically handles all JSON-serializable data,
      // but we test the error handling path exists

      const formatterResult = MarkdownFormatter.create();
      assertEquals(formatterResult.ok, true);

      if (formatterResult.ok) {
        const formatter = formatterResult.data;

        // Even with potentially problematic data, JsonFormatter should handle it
        const result = formatter.format({ circular: "not actually circular" });
        assertEquals(result.ok, true);

        // Verify error structure exists in case of future error conditions
        if (!result.ok) {
          assertExists(result.error.kind);
          assertExists(result.error.message);
          assertEquals(
            result.error.message.includes("Markdown formatting failed"),
            true,
          );
        }
      }
    });
  });

  describe("integration with JsonFormatter", () => {
    it("should properly delegate JSON formatting to JsonFormatter", () => {
      // Arrange
      const formatterResult = MarkdownFormatter.create();
      assertEquals(formatterResult.ok, true);

      if (formatterResult.ok) {
        const formatter = formatterResult.data;
        const complexData = {
          numbers: [1, 2, 3.14, -5],
          booleans: [true, false],
          mixed: {
            string: "text",
            null_value: null,
            nested: {
              array: ["a", "b", "c"],
            },
          },
        };

        // Act
        const result = formatter.format(complexData);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          // Verify it contains properly formatted JSON
          assertEquals(result.data.includes("3.14"), true);
          assertEquals(result.data.includes("-5"), true);
          assertEquals(result.data.includes("true"), true);
          assertEquals(result.data.includes("false"), true);
          assertEquals(result.data.includes("null"), true);
          assertEquals(result.data.includes('"text"'), true);

          // Verify Markdown wrapper
          assertEquals(result.data.startsWith("# Generated Output"), true);
          assertEquals(result.data.includes("```json"), true);
          assertEquals(result.data.endsWith("```\n"), true);
        }
      }
    });
  });
});
