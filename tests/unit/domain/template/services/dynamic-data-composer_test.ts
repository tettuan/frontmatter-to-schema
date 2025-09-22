/**
 * Unit tests for DynamicDataComposer domain service
 * Following DDD, TDD, and Totality testing principles
 *
 * Test coverage for:
 * - DynamicDataComposer creation and validation
 * - Data composition with expansion keys (main + items)
 * - Single data composition scenarios
 * - Array-only composition scenarios
 * - Dual template data creation and handling
 * - Error handling and edge cases following Totality principles
 * - Dynamic key determination and conflict resolution
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { DynamicDataComposer } from "../../../../../src/domain/template/services/dynamic-data-composer.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ArrayExpansionKey } from "../../../../../src/domain/template/value-objects/template-structure.ts";

describe("DynamicDataComposer", () => {
  describe("creation", () => {
    it("should create composer instance successfully", () => {
      // Act
      const result = DynamicDataComposer.create();

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertExists(result.data);
    });

    it("should create multiple independent instances", () => {
      // Act
      const result1 = DynamicDataComposer.create();
      const result2 = DynamicDataComposer.create();

      // Assert
      assertEquals(result1.ok, true);
      assertEquals(result2.ok, true);
      if (!result1.ok || !result2.ok) return;

      // Instances should be independent
      assertEquals(result1.data !== result2.data, true);
    });
  });

  describe("compose", () => {
    const composer = DynamicDataComposer.create();
    if (!composer.ok) throw new Error("Failed to create composer");
    const composerInstance = composer.data;

    it("should compose data with simple expansion keys", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        title: "Main Document",
        author: "John Doe",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const itemsData = [
        FrontmatterData.create({ name: "Item 1", value: 100 }),
        FrontmatterData.create({ name: "Item 2", value: 200 }),
      ];
      if (!itemsData[0].ok || !itemsData[1].ok) {
        throw new Error("Failed to create items data");
      }

      const expansionKeyResult = ArrayExpansionKey.create(
        "books",
        "{@items}",
        "books",
      );
      if (!expansionKeyResult.ok) {
        throw new Error("Failed to create expansion key");
      }

      // Act
      const result = composerInstance.compose(
        mainDataResult.data,
        [itemsData[0].data, itemsData[1].data],
        [expansionKeyResult.data],
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.title, "Main Document");
      assertEquals(result.data.mainData.author, "John Doe");
      assertEquals(result.data.mainData.books, [
        { name: "Item 1", value: 100 },
        { name: "Item 2", value: 200 },
      ]);
      assertEquals(result.data.arrayData, [
        { name: "Item 1", value: 100 },
        { name: "Item 2", value: 200 },
      ]);
    });

    it("should handle multiple expansion keys", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        project: "Test Project",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const itemsData = [
        FrontmatterData.create({ id: 1, status: "active" }),
        FrontmatterData.create({ id: 2, status: "pending" }),
      ];
      if (!itemsData[0].ok || !itemsData[1].ok) {
        throw new Error("Failed to create items data");
      }

      const expansionKeys = [
        ArrayExpansionKey.create("tasks", "{@items}", "tasks"),
        ArrayExpansionKey.create("items", "{@items}", "items"),
      ];
      if (!expansionKeys[0].ok || !expansionKeys[1].ok) {
        throw new Error("Failed to create expansion keys");
      }

      // Act
      const result = composerInstance.compose(
        mainDataResult.data,
        [itemsData[0].data, itemsData[1].data],
        [expansionKeys[0].data, expansionKeys[1].data],
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.project, "Test Project");
      assertEquals(result.data.mainData.tasks, [
        { id: 1, status: "active" },
        { id: 2, status: "pending" },
      ]);
      assertEquals(result.data.mainData.items, [
        { id: 1, status: "active" },
        { id: 2, status: "pending" },
      ]);
    });

    it("should handle empty items array", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        title: "Empty Project",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const expansionKeyResult = ArrayExpansionKey.create(
        "empty_list",
        "{@items}",
        "empty_list",
      );
      if (!expansionKeyResult.ok) {
        throw new Error("Failed to create expansion key");
      }

      // Act
      const result = composerInstance.compose(
        mainDataResult.data,
        [],
        [expansionKeyResult.data],
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.title, "Empty Project");
      assertEquals(result.data.mainData.empty_list, []);
      assertEquals(result.data.arrayData, []);
    });

    it("should handle expansion keys with different markers", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        base: "test",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const itemsData = [
        FrontmatterData.create({ type: "special" }),
      ];
      if (!itemsData[0].ok) {
        throw new Error("Failed to create items data");
      }

      const expansionKeyResult = ArrayExpansionKey.create(
        "special_items",
        "{@other}",
        "special_items",
      );
      if (!expansionKeyResult.ok) {
        throw new Error("Failed to create expansion key");
      }

      // Act
      const result = composerInstance.compose(
        mainDataResult.data,
        [itemsData[0].data],
        [expansionKeyResult.data],
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.base, "test");
      // Non-{@items} markers should not add data to mainData
      assertEquals(result.data.mainData.special_items, undefined);
      assertEquals(result.data.arrayData, [{ type: "special" }]);
    });

    it("should handle key conflicts by generating unique keys", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        books: "existing value",
        title: "Test Document",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const itemsData = [
        FrontmatterData.create({ title: "Book 1" }),
        FrontmatterData.create({ title: "Book 2" }),
      ];
      if (!itemsData[0].ok || !itemsData[1].ok) {
        throw new Error("Failed to create items data");
      }

      const expansionKeyResult = ArrayExpansionKey.create(
        "books",
        "{@items}",
        "books",
      );
      if (!expansionKeyResult.ok) {
        throw new Error("Failed to create expansion key");
      }

      // Act
      const result = composerInstance.compose(
        mainDataResult.data,
        [itemsData[0].data, itemsData[1].data],
        [expansionKeyResult.data],
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.books, "existing value");
      assertEquals(result.data.mainData.books_items, [
        { title: "Book 1" },
        { title: "Book 2" },
      ]);
    });
  });

  describe("composeSingle", () => {
    const composer = DynamicDataComposer.create();
    if (!composer.ok) throw new Error("Failed to create composer");
    const composerInstance = composer.data;

    it("should compose single data successfully", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        title: "Single Document",
        content: "This is the content",
        tags: ["tag1", "tag2"],
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      // Act
      const result = composerInstance.composeSingle(mainDataResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.title, "Single Document");
      assertEquals(result.data.mainData.content, "This is the content");
      assertEquals(result.data.mainData.tags, ["tag1", "tag2"]);
      assertEquals(result.data.arrayData, undefined);
    });

    it("should handle empty main data", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({});
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      // Act
      const result = composerInstance.composeSingle(mainDataResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData, {});
      assertEquals(result.data.arrayData, undefined);
    });

    it("should handle complex nested data", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        metadata: {
          author: { name: "John", email: "john@example.com" },
          created: "2023-01-01",
        },
        settings: {
          theme: "dark",
          language: "en",
        },
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      // Act
      const result = composerInstance.composeSingle(mainDataResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.metadata, {
        author: { name: "John", email: "john@example.com" },
        created: "2023-01-01",
      });
      assertEquals(result.data.mainData.settings, {
        theme: "dark",
        language: "en",
      });
    });
  });

  describe("composeArray", () => {
    const composer = DynamicDataComposer.create();
    if (!composer.ok) throw new Error("Failed to create composer");
    const composerInstance = composer.data;

    it("should compose array data successfully", () => {
      // Arrange
      const itemsData = [
        FrontmatterData.create({ id: 1, name: "First Item" }),
        FrontmatterData.create({ id: 2, name: "Second Item" }),
        FrontmatterData.create({ id: 3, name: "Third Item" }),
      ];
      if (!itemsData[0].ok || !itemsData[1].ok || !itemsData[2].ok) {
        throw new Error("Failed to create items data");
      }

      // Act
      const result = composerInstance.composeArray([
        itemsData[0].data,
        itemsData[1].data,
        itemsData[2].data,
      ]);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData, {});
      assertEquals(result.data.arrayData, [
        { id: 1, name: "First Item" },
        { id: 2, name: "Second Item" },
        { id: 3, name: "Third Item" },
      ]);
    });

    it("should handle empty array", () => {
      // Act
      const result = composerInstance.composeArray([]);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData, {});
      assertEquals(result.data.arrayData, []);
    });

    it("should handle mixed data types in array", () => {
      // Arrange
      const itemsData = [
        FrontmatterData.create({ type: "string", value: "text" }),
        FrontmatterData.create({ type: "number", value: 42 }),
        FrontmatterData.create({ type: "boolean", value: true }),
        FrontmatterData.create({ type: "object", value: { nested: "data" } }),
      ];
      if (
        !itemsData[0].ok || !itemsData[1].ok || !itemsData[2].ok ||
        !itemsData[3].ok
      ) {
        throw new Error("Failed to create items data");
      }

      // Act
      const result = composerInstance.composeArray([
        itemsData[0].data,
        itemsData[1].data,
        itemsData[2].data,
        itemsData[3].data,
      ]);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.arrayData, [
        { type: "string", value: "text" },
        { type: "number", value: 42 },
        { type: "boolean", value: true },
        { type: "object", value: { nested: "data" } },
      ]);
    });
  });

  describe("createDualTemplateData", () => {
    const composer = DynamicDataComposer.create();
    if (!composer.ok) throw new Error("Failed to create composer");
    const composerInstance = composer.data;

    it("should create dual template data with JSON rendered items", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        title: "Dual Template Document",
        author: "Jane Doe",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const renderedItems = [
        '{"name": "Item 1", "value": 100}',
        '{"name": "Item 2", "value": 200}',
      ];

      // Act
      const result = composerInstance.createDualTemplateData(
        mainDataResult.data,
        renderedItems,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.title, "Dual Template Document");
      assertEquals(result.data.mainData.author, "Jane Doe");
      assertEquals(
        result.data.mainData["@items"],
        [{ name: "Item 1", value: 100 }, { name: "Item 2", value: 200 }],
      );
      assertEquals(result.data.arrayData, [
        { name: "Item 1", value: 100 },
        { name: "Item 2", value: 200 },
      ]);
    });

    it("should handle non-JSON rendered items", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        title: "Text Items Document",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const renderedItems = [
        "Plain text item 1",
        "Plain text item 2",
        "Plain text item 3",
      ];

      // Act
      const result = composerInstance.createDualTemplateData(
        mainDataResult.data,
        renderedItems,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.title, "Text Items Document");
      assertEquals(
        result.data.mainData["@items"],
        ["Plain text item 1", "Plain text item 2", "Plain text item 3"],
      );
      assertEquals(result.data.arrayData, [
        "Plain text item 1",
        "Plain text item 2",
        "Plain text item 3",
      ]);
    });

    it("should handle mixed JSON and non-JSON items", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        title: "Mixed Items Document",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const renderedItems = [
        '{"name": "JSON Item", "type": "object"}',
        "Plain text item",
        '{"another": "JSON item"}',
        "Another plain text",
      ];

      // Act
      const result = composerInstance.createDualTemplateData(
        mainDataResult.data,
        renderedItems,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.title, "Mixed Items Document");
      // Should parse valid JSON items and keep text items as strings
      const expectedItems = [
        { name: "JSON Item", type: "object" },
        "Plain text item",
        { another: "JSON item" },
        "Another plain text",
      ];
      assertEquals(
        result.data.mainData["@items"],
        expectedItems,
      );
      assertEquals(result.data.arrayData, expectedItems);
    });

    it("should handle empty rendered items array", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        title: "Empty Items Document",
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      // Act
      const result = composerInstance.createDualTemplateData(
        mainDataResult.data,
        [],
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.title, "Empty Items Document");
      assertEquals(result.data.mainData["@items"], []);
      assertEquals(result.data.arrayData, []);
    });

    it("should preserve existing main data properties", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        title: "Document Title",
        existing_items: "should be preserved",
        metadata: { author: "John", date: "2023-01-01" },
        settings: { theme: "dark" },
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      const renderedItems = ['{"rendered": "item"}'];

      // Act
      const result = composerInstance.createDualTemplateData(
        mainDataResult.data,
        renderedItems,
      );

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.title, "Document Title");
      assertEquals(result.data.mainData.existing_items, "should be preserved");
      assertEquals(result.data.mainData.metadata, {
        author: "John",
        date: "2023-01-01",
      });
      assertEquals(result.data.mainData.settings, { theme: "dark" });
      assertEquals(result.data.mainData["@items"], [{ rendered: "item" }]);
      assertEquals(result.data.arrayData, [{ rendered: "item" }]);
    });
  });

  describe("error handling", () => {
    const composer = DynamicDataComposer.create();
    if (!composer.ok) throw new Error("Failed to create composer");
    const composerInstance = composer.data;

    it("should handle data extraction errors gracefully", () => {
      // Arrange - Create a mock FrontmatterData that throws on getData()
      const mockMainData = {
        getData: () => {
          throw new Error("Data extraction failed");
        },
      } as unknown as FrontmatterData;

      const validItemData = FrontmatterData.create({ test: "data" });
      if (!validItemData.ok) {
        throw new Error("Failed to create valid item data");
      }

      const expansionKeyResult = ArrayExpansionKey.create(
        "test",
        "{@items}",
        "test",
      );
      if (!expansionKeyResult.ok) {
        throw new Error("Failed to create expansion key");
      }

      // Act
      const result = composerInstance.compose(
        mockMainData,
        [validItemData.data],
        [expansionKeyResult.data],
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "DataCompositionFailed");
      if (result.error.kind === "DataCompositionFailed") {
        assertEquals(
          result.error.reason.includes("Failed to extract main data"),
          true,
        );
      }
    });

    it("should handle items data extraction errors", () => {
      // Arrange
      const validMainData = FrontmatterData.create({ title: "Test" });
      if (!validMainData.ok) {
        throw new Error("Failed to create valid main data");
      }

      const mockItemData = {
        getData: () => {
          throw new Error("Item data extraction failed");
        },
      } as unknown as FrontmatterData;

      const expansionKeyResult = ArrayExpansionKey.create(
        "test",
        "{@items}",
        "test",
      );
      if (!expansionKeyResult.ok) {
        throw new Error("Failed to create expansion key");
      }

      // Act
      const result = composerInstance.compose(
        validMainData.data,
        [mockItemData],
        [expansionKeyResult.data],
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "DataCompositionFailed");
      if (result.error.kind === "DataCompositionFailed") {
        assertEquals(
          result.error.reason.includes("Failed to extract items data"),
          true,
        );
      }
    });

    it("should handle single data extraction errors", () => {
      // Arrange
      const mockMainData = {
        getData: () => {
          throw new Error("Single data extraction failed");
        },
      } as unknown as FrontmatterData;

      // Act
      const result = composerInstance.composeSingle(mockMainData);

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "DataCompositionFailed");
    });

    it("should handle array data extraction errors", () => {
      // Arrange
      const validItemData = FrontmatterData.create({ test: "data" });
      if (!validItemData.ok) {
        throw new Error("Failed to create valid item data");
      }

      const mockItemData = {
        getData: () => {
          throw new Error("Array item extraction failed");
        },
      } as unknown as FrontmatterData;

      // Act
      const result = composerInstance.composeArray([
        validItemData.data,
        mockItemData,
      ]);

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "DataCompositionFailed");
    });

    it("should handle dual template data extraction errors", () => {
      // Arrange
      const mockMainData = {
        getData: () => {
          throw new Error("Dual template data extraction failed");
        },
      } as unknown as FrontmatterData;

      // Act
      const result = composerInstance.createDualTemplateData(
        mockMainData,
        ["test item"],
      );

      // Assert
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "DataCompositionFailed");
    });
  });

  describe("edge cases", () => {
    const composer = DynamicDataComposer.create();
    if (!composer.ok) throw new Error("Failed to create composer");
    const composerInstance = composer.data;

    it("should handle null and undefined values in data", () => {
      // Arrange
      const mainDataResult = FrontmatterData.create({
        nullValue: null,
        undefinedValue: undefined,
        emptyString: "",
        zeroValue: 0,
        falseValue: false,
      });
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      // Act
      const result = composerInstance.composeSingle(mainDataResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData.nullValue, null);
      assertEquals(result.data.mainData.undefinedValue, undefined);
      assertEquals(result.data.mainData.emptyString, "");
      assertEquals(result.data.mainData.zeroValue, 0);
      assertEquals(result.data.mainData.falseValue, false);
    });

    it("should handle very deep nested structures", () => {
      // Arrange
      const deepData = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  deepValue: "found at level 5",
                  array: [1, 2, { nested: "in array" }],
                },
              },
            },
          },
        },
      };

      const mainDataResult = FrontmatterData.create(deepData);
      if (!mainDataResult.ok) throw new Error("Failed to create main data");

      // Act
      const result = composerInstance.composeSingle(mainDataResult.data);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(result.data.mainData, deepData);
    });

    it("should handle large arrays efficiently", () => {
      // Arrange
      const largeItemsData = Array.from(
        { length: 1000 },
        (_, i) => FrontmatterData.create({ id: i, value: `item-${i}` }),
      );

      // Verify all items were created successfully and extract data
      const validItemsData = [];
      for (const item of largeItemsData) {
        if (!item.ok) throw new Error("Failed to create large items data");
        validItemsData.push(item.data);
      }

      // Act
      const result = composerInstance.composeArray(validItemsData);

      // Assert
      assertEquals(result.ok, true);
      if (!result.ok) return;

      assertEquals(Array.isArray(result.data.arrayData), true);
      if (Array.isArray(result.data.arrayData)) {
        assertEquals(result.data.arrayData.length, 1000);
        assertEquals(result.data.arrayData[0], { id: 0, value: "item-0" });
        assertEquals(result.data.arrayData[999], {
          id: 999,
          value: "item-999",
        });
      }
    });
  });
});
