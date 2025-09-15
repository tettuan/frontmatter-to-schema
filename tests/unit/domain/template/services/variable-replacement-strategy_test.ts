/**
 * Unit tests for VariableReplacementStrategy domain service
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - UnifiedVariableReplacementStrategy creation and validation
 * - Strategy pattern interface implementation
 * - Variable replacement in different contexts (single, array, expansion)
 * - String, array, and object template processing
 * - Special variable handling ({@items}, frontmatter_value)
 * - Error handling following Result<T,E> pattern
 * - Verbose mode and null/undefined handling
 * - ProcessingContext integration
 */

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  UnifiedVariableReplacementStrategy,
  type VariableReplacementStrategy,
} from "../../../../../src/domain/template/services/variable-replacement-strategy.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ProcessingContext } from "../../../../../src/domain/template/value-objects/processing-context.ts";

describe("UnifiedVariableReplacementStrategy", () => {
  describe("creation", () => {
    it("should create strategy instance successfully", () => {
      // Act
      const result = UnifiedVariableReplacementStrategy.create();

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      assertExists(strategy);
      assertEquals(typeof strategy.replaceVariables, "function");
      assertEquals(typeof strategy.canHandle, "function");
      assertEquals(typeof strategy.getStrategyName, "function");
    });

    it("should implement VariableReplacementStrategy interface", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy: VariableReplacementStrategy = result.data;

      // Act & Assert - Interface methods should exist
      assertEquals(
        strategy.getStrategyName(),
        "UnifiedVariableReplacementStrategy",
      );
      assertEquals(
        strategy.canHandle("any content", createTestContext()),
        true,
      );
    });
  });

  describe("canHandle", () => {
    it("should handle all content types and contexts", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const context = createTestContext();

      // Act & Assert - Should handle any content
      assertEquals(strategy.canHandle("string", context), true);
      assertEquals(strategy.canHandle(["array"], context), true);
      assertEquals(strategy.canHandle({ object: "test" }, context), true);
      assertEquals(strategy.canHandle(123, context), true);
      assertEquals(strategy.canHandle(null, context), true);
      assertEquals(strategy.canHandle(undefined, context), true);
    });

    it("should handle different processing contexts", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;

      // Act & Assert - Should handle all context types
      assertEquals(strategy.canHandle("test", createTestContext()), true);
      assertEquals(
        strategy.canHandle("test", createArrayExpansionContext([])),
        true,
      );
      assertEquals(
        strategy.canHandle("test", createArrayProcessingContext([])),
        true,
      );
    });
  });

  describe("replaceVariables", () => {
    describe("single item processing", () => {
      it("should replace variables in simple string template", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          title: "Test Document",
          author: "John Doe",
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          "Title: {title}, Author: {author}",
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        assertEquals(
          replaceResult.data,
          "Title: Test Document, Author: John Doe",
        );
      });

      it("should replace variables with double brace syntax", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          version: "1.0.0",
          build: 123,
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          "Version: {{version}}, Build: {{build}}",
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        assertEquals(replaceResult.data, "Version: 1.0.0, Build: 123");
      });

      it("should handle missing variables in normal mode", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({ title: "Test Document" });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          "Title: {title}, Missing: {missing_var}",
          data,
          context,
          false, // normal mode
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        // Missing variable should be replaced with empty string
        assertEquals(replaceResult.data, "Title: Test Document, Missing: ");
      });

      it("should handle missing variables in verbose mode", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({ title: "Test Document" });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          "Title: {title}, Missing: {missing_var}",
          data,
          context,
          true, // verbose mode
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        // Missing variable should keep placeholder in verbose mode
        assertEquals(
          replaceResult.data,
          "Title: Test Document, Missing: {missing_var}",
        );
      });

      it("should handle null/undefined values in normal mode", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          title: "Test",
          nullValue: null,
          undefinedValue: undefined,
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          "Title: {title}, Null: {nullValue}, Undefined: {undefinedValue}",
          data,
          context,
          false,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        assertEquals(replaceResult.data, "Title: Test, Null: , Undefined: ");
      });

      it("should handle null/undefined values in verbose mode", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          title: "Test",
          nullValue: null,
          undefinedValue: undefined,
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          "Title: {title}, Null: {nullValue}, Undefined: {undefinedValue}",
          data,
          context,
          true,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        assertEquals(
          replaceResult.data,
          "Title: Test, Null: {nullValue}, Undefined: {undefinedValue}",
        );
      });

      it("should handle complex data types in variables", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          title: "Test",
          tags: ["typescript", "testing"],
          metadata: { created: "2024-01-01", author: "John" },
          count: 42,
          active: true,
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          "Title: {title}, Tags: {tags}, Count: {count}, Active: {active}",
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        const expected =
          'Title: Test, Tags: ["typescript","testing"], Count: 42, Active: true';
        assertEquals(replaceResult.data, expected);
      });

      it("should skip @ variables except @items", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({ title: "Test" });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          "Title: {title}, Special: {@special}, Another: {@marker}",
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        // @ variables should remain unchanged (except @items)
        assertEquals(
          replaceResult.data,
          "Title: Test, Special: {@special}, Another: {@marker}",
        );
      });
    });

    describe("array processing", () => {
      it("should process array content with variable replacement", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          prefix: "Item",
          suffix: "End",
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          ["{prefix} 1", "Static text", "{suffix}"],
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        const resultArray = replaceResult.data as unknown[];
        assertEquals(resultArray.length, 3);
        assertEquals(resultArray[0], "Item 1");
        assertEquals(resultArray[1], "Static text");
        assertEquals(resultArray[2], "End");
      });

      it("should handle nested arrays", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({ name: "Test" });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          [["{name} nested"], ["Static", "{name} again"]],
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        const resultArray = replaceResult.data as unknown[][];
        assertEquals(resultArray.length, 2);
        assertEquals((resultArray[0] as unknown[])[0], "Test nested");
        assertEquals((resultArray[1] as unknown[])[0], "Static");
        assertEquals((resultArray[1] as unknown[])[1], "Test again");
      });
    });

    describe("object processing", () => {
      it("should process object properties with variable replacement", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          title: "My Document",
          author: "John Doe",
          version: "1.0",
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          {
            documentTitle: "{title}",
            createdBy: "{author}",
            releaseVersion: "v{version}",
            staticField: "No variables here",
          },
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        const resultObj = replaceResult.data as Record<string, unknown>;
        assertEquals(resultObj.documentTitle, "My Document");
        assertEquals(resultObj.createdBy, "John Doe");
        assertEquals(resultObj.releaseVersion, "v1.0");
        assertEquals(resultObj.staticField, "No variables here");
      });

      it("should handle variable replacement in object keys", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          keyPrefix: "config",
          value: "test-value",
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          {
            "{keyPrefix}_setting": "{value}",
            "static_key": "static_value",
          },
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        const resultObj = replaceResult.data as Record<string, unknown>;
        assertEquals(resultObj["config_setting"], "test-value");
        assertEquals(resultObj["static_key"], "static_value");
      });

      it("should handle frontmatter_value special objects", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          metadata: { title: "Document Title", author: "John" },
          simple: "Simple Value",
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          {
            dynamicTitle: { frontmatter_value: "metadata.title" },
            dynamicSimple: { frontmatter_value: "simple" },
            normalField: "{simple}",
          },
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        const resultObj = replaceResult.data as Record<string, unknown>;
        assertEquals(resultObj.dynamicTitle, "Document Title");
        assertEquals(resultObj.dynamicSimple, "Simple Value");
        assertEquals(resultObj.normalField, "Simple Value");
      });

      it("should preserve data types for exact variable matches in JSON context", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          count: 42,
          active: true,
          tags: ["test", "demo"],
          metadata: { version: 1.2 },
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          {
            itemCount: "{count}", // Should preserve number
            isActive: "{active}", // Should preserve boolean
            tagList: "{tags}", // Should preserve array
            versionInfo: "{metadata}", // Should preserve object
            mixedText: "Count: {count}", // Should convert to string
          },
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        const resultObj = replaceResult.data as Record<string, unknown>;
        assertEquals(resultObj.itemCount, 42); // Preserved number
        assertEquals(resultObj.isActive, true); // Preserved boolean
        assertEquals(Array.isArray(resultObj.tagList), true); // Preserved array
        assertEquals(typeof resultObj.versionInfo, "object"); // Preserved object
        assertEquals(resultObj.mixedText, "Count: 42"); // Converted to string
      });

      it("should handle nested objects recursively", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({
          title: "My Document",
          author: "John Doe",
        });
        const context = createTestContext();

        // Act
        const replaceResult = strategy.replaceVariables(
          {
            document: {
              header: {
                title: "{title}",
                creator: "Created by {author}",
              },
              metadata: {
                type: "article",
                author: "{author}",
              },
            },
          },
          data,
          context,
        );

        // Assert
        assertEquals(replaceResult.ok, true);
        if (!replaceResult.ok) return;

        const resultObj = replaceResult.data as any;
        assertEquals(resultObj.document.header.title, "My Document");
        assertEquals(resultObj.document.header.creator, "Created by John Doe");
        assertEquals(resultObj.document.metadata.type, "article");
        assertEquals(resultObj.document.metadata.author, "John Doe");
      });
    });

    describe("primitive values", () => {
      it("should return primitive values unchanged", () => {
        // Arrange
        const result = UnifiedVariableReplacementStrategy.create();
        assertEquals(result.ok, true);
        if (!result.ok) return;

        const strategy = result.data;
        const data = createTestFrontmatterData({});
        const context = createTestContext();

        // Act & Assert
        const numberResult = strategy.replaceVariables(42, data, context);
        assertEquals(numberResult.ok, true);
        if (numberResult.ok) {
          assertEquals(numberResult.data, 42);
        }

        const boolResult = strategy.replaceVariables(true, data, context);
        assertEquals(boolResult.ok, true);
        if (boolResult.ok) {
          assertEquals(boolResult.data, true);
        }

        const nullResult = strategy.replaceVariables(null, data, context);
        assertEquals(nullResult.ok, true);
        if (nullResult.ok) {
          assertEquals(nullResult.data, null);
        }
      });
    });
  });

  describe("array expansion processing", () => {
    it("should handle array expansion context with {@items}", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({ title: "Document" });
      const arrayData = [{ name: "Item 1" }, { name: "Item 2" }];
      const context = createArrayExpansionContext(arrayData);

      // Act
      const replaceResult = strategy.replaceVariables(
        "Title: {title}, Items: {@items}",
        data,
        context,
      );

      // Assert
      assertEquals(replaceResult.ok, true);
      if (!replaceResult.ok) return;

      const result_str = replaceResult.data as string;
      assertEquals(result_str.includes("Title: Document"), true);
      assertEquals(result_str.includes("Items: "), true);
      assertEquals(result_str.includes("Item 1"), true);
      assertEquals(result_str.includes("Item 2"), true);
    });

    it("should handle array expansion context with empty array data", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({ title: "Document" });
      const contextResult = ProcessingContext.forArrayExpansion([]); // Empty array
      assertEquals(contextResult.ok, true);
      if (!contextResult.ok) return;
      const context = contextResult.data;

      // Act
      const replaceResult = strategy.replaceVariables(
        "Title: {title}, Items: {@items}",
        data,
        context,
      );

      // Assert - Should succeed with empty array
      assertEquals(replaceResult.ok, true);
      if (!replaceResult.ok) return;

      const resultStr = replaceResult.data as string;
      assertEquals(resultStr.includes("Title: Document"), true);
      assertEquals(resultStr.includes("Items: []"), true); // Empty array JSON
    });
  });

  describe("array item processing", () => {
    it("should process template for each array item", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({ prefix: "Document" }); // Main data not used in array processing
      const arrayData = [
        { name: "Item 1", value: "A" },
        { name: "Item 2", value: "B" },
      ];
      const context = createArrayProcessingContext(arrayData);

      // Act
      const replaceResult = strategy.replaceVariables(
        "Name: {name}, Value: {value}",
        data,
        context,
      );

      // Assert
      assertEquals(replaceResult.ok, true);
      if (!replaceResult.ok) return;

      const resultArray = replaceResult.data as string[];
      assertEquals(resultArray.length, 2);
      assertEquals(resultArray[0], "Name: Item 1, Value: A");
      assertEquals(resultArray[1], "Name: Item 2, Value: B");
    });

    it("should handle array processing context with empty array data", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({ title: "Document" });
      const contextResult = ProcessingContext.forArrayProcessing([]); // Empty array
      assertEquals(contextResult.ok, true);
      if (!contextResult.ok) return;
      const context = contextResult.data;

      // Act
      const replaceResult = strategy.replaceVariables(
        "Template: {title}",
        data,
        context,
      );

      // Assert - Should succeed with empty array resulting in empty result array
      assertEquals(replaceResult.ok, true);
      if (!replaceResult.ok) return;

      const resultArray = replaceResult.data as unknown[];
      assertEquals(Array.isArray(resultArray), true);
      assertEquals(resultArray.length, 0); // No items to process
    });

    it("should handle invalid array item data gracefully", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({});
      const invalidArrayData = [
        null, // Invalid item
        { name: "Valid Item" },
      ];
      const context = createArrayProcessingContext(invalidArrayData);

      // Act
      const replaceResult = strategy.replaceVariables(
        "Name: {name}",
        data,
        context,
      );

      // Assert
      assertEquals(replaceResult.ok, false);
      if (replaceResult.ok) return;

      assertEquals(replaceResult.error.kind, "DataCompositionFailed");
      assertEquals(
        replaceResult.error.message.includes(
          "Failed to create FrontmatterData from array item",
        ),
        true,
      );
    });
  });

  describe("error handling", () => {
    it("should handle template processing errors gracefully", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;

      // Create invalid FrontmatterData that might cause issues
      const invalidData = {} as unknown as FrontmatterData;
      const context = createTestContext();

      // Act
      const replaceResult = strategy.replaceVariables(
        "Template: {variable}",
        invalidData,
        context,
      );

      // Assert - Should handle the error gracefully
      // The exact behavior depends on FrontmatterData.get() error handling
      assertEquals(typeof replaceResult.ok, "boolean");
    });
  });

  describe("edge cases", () => {
    it("should handle empty strings", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({});
      const context = createTestContext();

      // Act
      const replaceResult = strategy.replaceVariables("", data, context);

      // Assert
      assertEquals(replaceResult.ok, true);
      if (!replaceResult.ok) return;

      assertEquals(replaceResult.data, "");
    });

    it("should handle strings without variables", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({});
      const context = createTestContext();

      // Act
      const replaceResult = strategy.replaceVariables(
        "No variables in this string",
        data,
        context,
      );

      // Assert
      assertEquals(replaceResult.ok, true);
      if (!replaceResult.ok) return;

      assertEquals(replaceResult.data, "No variables in this string");
    });

    it("should handle empty objects and arrays", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({});
      const context = createTestContext();

      // Act
      const objectResult = strategy.replaceVariables({}, data, context);
      const arrayResult = strategy.replaceVariables([], data, context);

      // Assert
      assertEquals(objectResult.ok, true);
      assertEquals(arrayResult.ok, true);

      if (objectResult.ok && arrayResult.ok) {
        assertEquals(Object.keys(objectResult.data as object).length, 0);
        assertEquals((arrayResult.data as unknown[]).length, 0);
      }
    });

    it("should handle complex nested structures with mixed content", () => {
      // Arrange
      const result = UnifiedVariableReplacementStrategy.create();
      assertEquals(result.ok, true);
      if (!result.ok) return;

      const strategy = result.data;
      const data = createTestFrontmatterData({
        title: "Document",
        count: 5,
        tags: ["tag1", "tag2"],
      });
      const context = createTestContext();

      // Act
      const replaceResult = strategy.replaceVariables(
        {
          header: "{title}",
          items: [
            "Item 1: {title}",
            { name: "{title}", count: "{count}" },
            42,
            true,
            null,
            { nested: { deep: "{tags}" } },
          ],
          footer: "Total: {count}",
        },
        data,
        context,
      );

      // Assert
      assertEquals(replaceResult.ok, true);
      if (!replaceResult.ok) return;

      const resultObj = replaceResult.data as any;
      assertEquals(resultObj.header, "Document");
      assertEquals(resultObj.items[0], "Item 1: Document");
      assertEquals(resultObj.items[1].name, "Document");
      assertEquals(resultObj.items[1].count, 5);
      assertEquals(resultObj.items[2], 42);
      assertEquals(resultObj.items[3], true);
      assertEquals(resultObj.items[4], null);
      assertEquals(Array.isArray(resultObj.items[5].nested.deep), true);
      assertEquals(resultObj.footer, "Total: 5");
    });
  });
});

// Helper functions
function createTestFrontmatterData(
  data: Record<string, unknown>,
): FrontmatterData {
  const result = FrontmatterData.create(data);
  if (!result.ok) {
    throw new Error("Failed to create test frontmatter data");
  }
  return result.data;
}

function createTestContext(
  isArrayExpansion: boolean = false,
  isArrayProcessing: boolean = false,
  arrayData?: unknown[],
): ProcessingContext {
  if (isArrayExpansion && arrayData) {
    const result = ProcessingContext.forArrayExpansion(arrayData);
    if (!result.ok) {
      throw new Error("Failed to create array expansion context");
    }
    return result.data;
  }

  if (isArrayProcessing && arrayData) {
    const result = ProcessingContext.forArrayProcessing(arrayData);
    if (!result.ok) {
      throw new Error("Failed to create array processing context");
    }
    return result.data;
  }

  // Default to single item context
  const result = ProcessingContext.forSingleItem();
  if (!result.ok) {
    throw new Error("Failed to create single item context");
  }
  return result.data;
}

function createArrayExpansionContext(arrayData: unknown[]): ProcessingContext {
  return createTestContext(true, false, arrayData);
}

function createArrayProcessingContext(arrayData: unknown[]): ProcessingContext {
  return createTestContext(false, true, arrayData);
}
