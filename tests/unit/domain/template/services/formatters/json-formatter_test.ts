import { assertEquals, assertExists } from "jsr:@std/assert";
import { beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { JsonFormatter } from "../../../../../../src/domain/template/services/formatters/json-formatter.ts";

describe("JsonFormatter Service", () => {
  describe("create", () => {
    it("should create JsonFormatter instance", () => {
      // Arrange & Act
      const result = JsonFormatter.create();

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertExists(result.data);
        assertExists(result.data.format);
      }
    });

    it("should maintain Result pattern compliance", () => {
      // Arrange & Act
      const result = JsonFormatter.create();

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
    let formatter: JsonFormatter;

    beforeEach(() => {
      const result = JsonFormatter.create();
      assertEquals(result.ok, true);
      if (result.ok) {
        formatter = result.data;
      }
    });

    it("should format simple object with default indentation", () => {
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
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.name, "John Doe");
        assertEquals(parsed.age, 30);
        assertEquals(parsed.active, true);

        // Check default indentation (2 spaces)
        assertEquals(result.data.includes('  "name"'), true);
        assertEquals(result.data.includes('  "age"'), true);
      }
    });

    it("should format simple object with custom indentation", () => {
      // Arrange
      const data = { test: "value" };

      // Act
      const result = formatter.format(data, 4);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        // Check custom indentation (4 spaces)
        assertEquals(result.data.includes('    "test"'), true);
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.test, "value");
      }
    });

    it("should format array", () => {
      // Arrange
      const data = ["apple", "banana", "cherry"];

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(Array.isArray(parsed), true);
        assertEquals(parsed.length, 3);
        assertEquals(parsed[0], "apple");
        assertEquals(parsed[1], "banana");
        assertEquals(parsed[2], "cherry");
      }
    });

    it("should format nested object", () => {
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
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.user.profile.name, "Jane Smith");
        assertEquals(parsed.user.profile.preferences.theme, "dark");
        assertEquals(parsed.user.posts.length, 2);
        assertEquals(parsed.user.posts[0].title, "First Post");
        assertEquals(parsed.user.posts[1].likes, 12);
      }
    });

    it("should format string", () => {
      // Arrange
      const data = "Hello, World!";

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, '"Hello, World!"');
        const parsed = JSON.parse(result.data);
        assertEquals(parsed, "Hello, World!");
      }
    });

    it("should format number", () => {
      // Arrange
      const data = 42.5;

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "42.5");
        const parsed = JSON.parse(result.data);
        assertEquals(parsed, 42.5);
      }
    });

    it("should format boolean", () => {
      // Arrange
      const data = false;

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "false");
        const parsed = JSON.parse(result.data);
        assertEquals(parsed, false);
      }
    });

    it("should format null", () => {
      // Arrange
      const data = null;

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "null");
        const parsed = JSON.parse(result.data);
        assertEquals(parsed, null);
      }
    });

    it("should format undefined as undefined", () => {
      // Arrange
      const data = undefined;

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        // JSON.stringify(undefined) returns undefined, not a string
        assertEquals(result.data, undefined);
      }
    });

    it("should format empty object", () => {
      // Arrange
      const data = {};

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "{}");
        const parsed = JSON.parse(result.data);
        assertEquals(Object.keys(parsed).length, 0);
      }
    });

    it("should format empty array", () => {
      // Arrange
      const data: unknown[] = [];

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data, "[]");
        const parsed = JSON.parse(result.data);
        assertEquals(Array.isArray(parsed), true);
        assertEquals(parsed.length, 0);
      }
    });

    it("should handle special characters in strings", () => {
      // Arrange
      const data = {
        message: 'Hello "World"!',
        newlines: "Line 1\nLine 2",
        tabs: "Column 1\tColumn 2",
        backslashes: "Path\\to\\file",
        unicode: "Testing 测试 🚀",
      };

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.message, 'Hello "World"!');
        assertEquals(parsed.newlines, "Line 1\nLine 2");
        assertEquals(parsed.tabs, "Column 1\tColumn 2");
        assertEquals(parsed.backslashes, "Path\\to\\file");
        assertEquals(parsed.unicode, "Testing 测试 🚀");
      }
    });

    it("should format with zero indentation", () => {
      // Arrange
      const data = { compact: true };

      // Act
      const result = formatter.format(data, 0);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        // With 0 indentation, JSON should be compact
        assertEquals(result.data, '{"compact":true}');
      }
    });

    it("should format with large indentation", () => {
      // Arrange
      const data = { test: "value" };

      // Act
      const result = formatter.format(data, 8);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        // Check large indentation (8 spaces)
        assertEquals(result.data.includes('        "test"'), true);
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.test, "value");
      }
    });

    it("should handle Date objects", () => {
      // Arrange
      const data = {
        timestamp: new Date("2023-01-01T00:00:00Z"),
      };

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.timestamp, "2023-01-01T00:00:00.000Z");
      }
    });

    it("should handle objects with toJSON method", () => {
      // Arrange
      const data = {
        custom: {
          value: 42,
          toJSON: function () {
            return { serialized: this.value * 2 };
          },
        },
      };

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.custom.serialized, 84);
      }
    });

    it("should maintain Result pattern compliance", () => {
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
    let formatter: JsonFormatter;

    beforeEach(() => {
      const result = JsonFormatter.create();
      assertEquals(result.ok, true);
      if (result.ok) {
        formatter = result.data;
      }
    });

    it("should handle circular references", () => {
      // Arrange
      const data: any = { name: "test" };
      data.circular = data; // Create circular reference

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "RenderFailed");
        assertExists(result.error.message);
        assertEquals(
          result.error.message.includes("circular") ||
            result.error.message.includes("Converting circular"),
          true,
        );
      }
    });

    it("should handle functions (non-serializable)", () => {
      // Arrange
      const data = {
        name: "test",
        func: () => "hello",
      };

      // Act
      const result = formatter.format(data);

      // Assert
      // Functions are dropped in JSON serialization, so this should succeed
      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.name, "test");
        assertEquals(parsed.func, undefined); // Function is dropped
      }
    });

    it("should handle BigInt (non-serializable)", () => {
      // Arrange
      const data = {
        name: "test",
        bigInt: BigInt(123),
      };

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "RenderFailed");
        assertExists(result.error.message);
      }
    });

    it("should handle Symbol (non-serializable)", () => {
      // Arrange
      const data = {
        name: "test",
        sym: Symbol("test"),
      };

      // Act
      const result = formatter.format(data);

      // Assert
      // Symbols are dropped in JSON serialization, so this should succeed
      assertEquals(result.ok, true);
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed.name, "test");
        assertEquals(parsed.sym, undefined); // Symbol is dropped
      }
    });

    it("should provide meaningful error messages", () => {
      // Arrange
      const data: any = {};
      data.self = data; // Circular reference

      // Act
      const result = formatter.format(data);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "RenderFailed");
        assertExists(result.error.message);
        assertEquals(typeof result.error.message, "string");
        assertEquals(result.error.message.length > 0, true);
      }
    });
  });
});
