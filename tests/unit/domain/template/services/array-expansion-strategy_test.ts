/**
 * Unit tests for ArrayExpansionStrategy domain service
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - ArrayExpansionStrategy creation and validation
 * - Item expansion for different template formats (YAML, JSON, plain text)
 * - Format detection and template structure analysis
 * - Error handling and edge cases following Totality principles
 * - Structured expansion requirements determination
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { ArrayExpansionStrategy } from "../../../../../src/domain/template/services/array-expansion-strategy.ts";

describe("ArrayExpansionStrategy", () => {
  describe("creation", () => {
    it("should create strategy instance successfully", () => {
      // Act
      const result = ArrayExpansionStrategy.create();

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertExists(result.data);
    });

    it("should create multiple independent instances", () => {
      // Act
      const result1 = ArrayExpansionStrategy.create();
      const result2 = ArrayExpansionStrategy.create();

      // Assert
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (!result1.ok || !result2.ok) return;

      // Instances should be independent
      assertEquals(result1.data !== result2.data, true);
    });
  });

  describe("expandItems", () => {
    const strategy = ArrayExpansionStrategy.create();
    if (!strategy.ok) throw new Error("Failed to create strategy");
    const strategyInstance = strategy.data;

    describe("YAML list format", () => {
      it("should expand simple YAML list format correctly", () => {
        // Arrange
        const template = "books:\n  - {@items}";
        const dataArray = [
          { title: "Book 1", author: "Author 1" },
          { title: "Book 2", author: "Author 2" },
        ];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, { books: dataArray });
      });

      it("should handle YAML list with quoted items placeholder", () => {
        // Arrange
        const template = 'items:\n  - "{@items}"';
        const dataArray = ["item1", "item2", "item3"];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, { items: dataArray });
      });

      it("should extract correct key from YAML list format", () => {
        // Arrange
        const template = "products:\n  - {@items}";
        const dataArray = [{ name: "Product 1" }, { name: "Product 2" }];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, { products: dataArray });
      });

      it("should handle YAML list with complex key names", () => {
        // Arrange
        const template = "user_preferences:\n  - {@items}";
        const dataArray = [{ setting: "dark_mode", value: true }];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, { user_preferences: dataArray });
      });

      it("should handle empty arrays in YAML format", () => {
        // Arrange
        const template = "empty_list:\n  - {@items}";
        const dataArray: unknown[] = [];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, { empty_list: [] });
      });
    });

    describe("JSON array format", () => {
      it("should expand pure JSON array format correctly", () => {
        // Arrange
        const template = "{@items}";
        const dataArray = [
          { id: 1, name: "Item 1" },
          { id: 2, name: "Item 2" },
        ];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, dataArray);
      });

      it("should handle JSON array with whitespace", () => {
        // Arrange
        const template = "  {@items}  ";
        const dataArray = ["a", "b", "c"];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, dataArray);
      });

      it("should handle complex object arrays in JSON format", () => {
        // Arrange
        const template = "{@items}";
        const dataArray = [
          { nested: { prop: "value1" }, array: [1, 2] },
          { nested: { prop: "value2" }, array: [3, 4] },
        ];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, dataArray);
      });

      it("should handle mixed-type arrays in JSON format", () => {
        // Arrange
        const template = "{@items}";
        const dataArray = [1, "string", { object: true }, [1, 2, 3]];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, dataArray);
      });
    });

    describe("plain text format", () => {
      it("should handle embedded items placeholder in text", () => {
        // Arrange
        const template = "Items: {@items}";
        const dataArray = ["apple", "banana", "cherry"];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(
          result.data,
          'Items: ["apple","banana","cherry"]',
        );
      });

      it("should handle complex embedded format", () => {
        // Arrange
        const template = "Total items: {@items}, count: 3";
        const dataArray = [{ name: "item1" }, { name: "item2" }];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(
          result.data,
          'Total items: [{"name":"item1"},{"name":"item2"}], count: 3',
        );
      });

      it("should handle multiple line text with items placeholder", () => {
        // Arrange
        const template = "Line 1\nItems: {@items}\nLine 3";
        const dataArray = [1, 2, 3];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, "Line 1\nItems: [1,2,3]\nLine 3");
      });

      it("should handle text with no actual content replacement", () => {
        // Arrange
        const template = "Simple text {@items} here";
        const dataArray: unknown[] = [];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, "Simple text [] here");
      });

      it("should handle quoted items placeholder in text", () => {
        // Arrange
        const template = '"{@items}"';
        const dataArray = [1, 2, 3];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        // Quoted format is treated as plain text format by the detector
        // It replaces {@items} with JSON stringified version within the quotes
        assertEquals(result.data, '"[1,2,3]"');
      });
    });

    describe("no items placeholder", () => {
      it("should return template unchanged when no items placeholder", () => {
        // Arrange
        const template = "This is a simple template without placeholders";
        const dataArray = [1, 2, 3];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, template);
      });

      it("should handle empty template without items placeholder", () => {
        // Arrange
        const template = "";
        const dataArray = ["a", "b"];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, "");
      });

      it("should handle whitespace-only template", () => {
        // Arrange
        const template = "   \n  \t  \n   ";
        const dataArray = [1];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, template);
      });
    });

    describe("edge cases and error handling", () => {
      it("should handle null and undefined values in data array", () => {
        // Arrange
        const template = "{@items}";
        const dataArray = [null, undefined, 0, "", false];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, dataArray);
      });

      it("should handle very large arrays efficiently", () => {
        // Arrange
        const template = "{@items}";
        const dataArray = Array.from({ length: 1000 }, (_, i) => ({ id: i }));

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(Array.isArray(result.data), true);
        if (Array.isArray(result.data)) {
          assertEquals(result.data.length, 1000);
          assertEquals(result.data[0], { id: 0 });
          assertEquals(result.data[999], { id: 999 });
        }
      });

      it("should handle deeply nested object structures", () => {
        // Arrange
        const template = "{@items}";
        const dataArray = [
          {
            level1: {
              level2: {
                level3: {
                  value: "deep",
                  array: [1, 2, { nested: true }],
                },
              },
            },
          },
        ];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        assertEquals(result.data, dataArray);
      });

      it("should handle circular reference detection gracefully", () => {
        // Arrange
        const template = "Text: {@items}";
        const circularObject: Record<string, unknown> = { prop: "value" };
        circularObject.self = circularObject; // Create circular reference
        const dataArray = [circularObject];

        // Act & Assert - JSON.stringify will throw, this is expected behavior
        // The current implementation doesn't handle circular references
        // This test documents the current limitation
        let threwError = false;
        try {
          strategyInstance.expandItems(template, dataArray);
        } catch (_error) {
          threwError = true;
        }

        assertEquals(
          threwError,
          true,
          "Should throw error on circular references",
        );
      });
    });

    describe("format detection integration", () => {
      it("should correctly detect and handle mixed format scenarios", () => {
        // Arrange - Template that could be ambiguous
        const template = "data:\n{@items}";
        const dataArray = [{ key: "value" }];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        // Should be treated as plain text since it's not properly formatted YAML
        assertEquals(result.data, 'data:\n[{"key":"value"}]');
      });

      it("should handle templates with similar but invalid YAML structure", () => {
        // Arrange - Looks like YAML but missing proper indentation
        const template = "books:\n- {@items}"; // Missing proper indentation
        const dataArray = [{ title: "Book" }];

        // Act
        const result = strategyInstance.expandItems(template, dataArray);

        // Assert
        assertEquals(result.ok, true);
        if (!result.ok) return;

        // Should detect as YAML format despite minimal indentation
        assertEquals(result.data, { books: dataArray });
      });
    });
  });

  describe("requiresStructuredExpansion", () => {
    const strategy = ArrayExpansionStrategy.create();
    if (!strategy.ok) throw new Error("Failed to create strategy");
    const strategyInstance = strategy.data;

    it("should return true for YAML list format ending with items placeholder", () => {
      // Arrange
      const template = "books:\n  - {@items}";

      // Act
      const result = strategyInstance.requiresStructuredExpansion(template);

      // Assert
      assertEquals(result, true);
    });

    it("should return false for JSON array format", () => {
      // Arrange
      const template = "{@items}";

      // Act
      const result = strategyInstance.requiresStructuredExpansion(template);

      // Assert
      assertEquals(result, false);
    });

    it("should return false for plain text format", () => {
      // Arrange
      const template = "Items: {@items}";

      // Act
      const result = strategyInstance.requiresStructuredExpansion(template);

      // Assert
      assertEquals(result, false);
    });

    it("should return false when no items placeholder present", () => {
      // Arrange
      const template = "Simple template without placeholders";

      // Act
      const result = strategyInstance.requiresStructuredExpansion(template);

      // Assert
      assertEquals(result, false);
    });

    it("should return false for YAML format not ending with items placeholder", () => {
      // Arrange
      const template = "books:\n  - {@items}\nextra: content";

      // Act
      const result = strategyInstance.requiresStructuredExpansion(template);

      // Assert
      assertEquals(result, false);
    });

    it("should handle templates with trailing whitespace correctly", () => {
      // Arrange
      const template = "books:\n  - {@items}\n   \n  ";

      // Act
      const result = strategyInstance.requiresStructuredExpansion(template);

      // Assert
      assertEquals(result, true); // Should ignore trailing whitespace
    });

    it("should handle empty lines correctly", () => {
      // Arrange
      const template = "items:\n  - {@items}\n\n\n";

      // Act
      const result = strategyInstance.requiresStructuredExpansion(template);

      // Assert
      assertEquals(result, true); // Should ignore empty lines at end
    });
  });

  describe("integration with format detector", () => {
    const strategy = ArrayExpansionStrategy.create();
    if (!strategy.ok) throw new Error("Failed to create strategy");
    const strategyInstance = strategy.data;

    it("should handle format detector errors gracefully", () => {
      // Arrange - Template that might cause format detection issues
      const template = "malformed:\n  {@items"; // Missing closing brace
      const dataArray = [1, 2, 3];

      // Act
      const result = strategyInstance.expandItems(template, dataArray);

      // Assert
      assertEquals(result.ok, true); // Should handle gracefully
      if (!result.ok) return;

      // Should treat as plain text and not find {@items}
      assertEquals(result.data, template);
    });

    it("should handle complex indentation patterns", () => {
      // Arrange
      const template = "    deep_nested:\n      - {@items}";
      const dataArray = [{ value: "test" }];

      // Act
      const result = strategyInstance.expandItems(template, dataArray);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data, { deep_nested: dataArray });
    });

    it("should handle mixed line endings", () => {
      // Arrange
      const template = "items:\r\n  - {@items}"; // Windows line endings
      const dataArray = ["item1", "item2"];

      // Act
      const result = strategyInstance.expandItems(template, dataArray);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data, { items: dataArray });
    });
  });
});
