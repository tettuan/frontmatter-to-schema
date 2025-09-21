/**
 * Specification-driven tests for DynamicDataComposer
 *
 * This test file validates business requirements for dynamic data composition
 * rather than testing implementation details with mocks.
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assert, assertEquals } from "jsr:@std/assert";
import { DynamicDataComposer } from "../../../../../src/domain/template/services/dynamic-data-composer.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { ArrayExpansionKey } from "../../../../../src/domain/template/value-objects/template-structure.ts";
import {
  DomainRule,
  SpecificationAssertions,
} from "../../../../helpers/specification-test-framework.ts";

/**
 * Test scenario builder for dynamic data composition scenarios
 * Creates valid business scenarios without mock complexity
 */
class DataCompositionScenarioBuilder {
  private mainData: Record<string, unknown> = {};
  private itemsData: Record<string, unknown>[] = [];
  private expansionKeys: Array<{
    key: string;
    marker: string;
    targetProperty: string;
  }> = [];
  private renderedItems: string[] = [];

  withMainData(data: Record<string, unknown>): this {
    this.mainData = data;
    return this;
  }

  withItemsData(items: Record<string, unknown>[]): this {
    this.itemsData = items;
    return this;
  }

  withExpansionKey(
    key: string,
    marker: string,
    targetProperty: string,
  ): this {
    this.expansionKeys.push({ key, marker, targetProperty });
    return this;
  }

  withRenderedItems(items: string[]): this {
    this.renderedItems = items;
    return this;
  }

  build(): {
    composer: DynamicDataComposer;
    mainData: FrontmatterData;
    itemsData: FrontmatterData[];
    expansionKeys: ArrayExpansionKey[];
    renderedItems: string[];
  } {
    const composerResult = DynamicDataComposer.create();
    if (!composerResult.ok) {
      throw new Error("Failed to create composer");
    }

    // Create main data
    const mainDataResult = FrontmatterData.create(this.mainData);
    if (!mainDataResult.ok) {
      throw new Error("Failed to create main data");
    }

    // Create items data
    const itemsData: FrontmatterData[] = [];
    for (const item of this.itemsData) {
      const itemResult = FrontmatterData.create(item);
      if (!itemResult.ok) {
        throw new Error("Failed to create item data");
      }
      itemsData.push(itemResult.data);
    }

    // Create expansion keys
    const expansionKeys: ArrayExpansionKey[] = [];
    for (const key of this.expansionKeys) {
      const keyResult = ArrayExpansionKey.create(
        key.key,
        key.marker,
        key.targetProperty,
      );
      if (!keyResult.ok) {
        throw new Error("Failed to create expansion key");
      }
      expansionKeys.push(keyResult.data);
    }

    return {
      composer: composerResult.data,
      mainData: mainDataResult.data,
      itemsData,
      expansionKeys,
      renderedItems: this.renderedItems,
    };
  }
}

/**
 * Business requirements for dynamic data composition
 */
const dataCompositionRequirements = {
  compositionIntegrity: {
    name: "data-composition-integrity",
    description: "Data composition must preserve all source data without loss",
    validator: (data: any) => ({
      isValid: data.preservesMainData && data.preservesItemsData,
      violation: !data.preservesMainData || !data.preservesItemsData
        ? "All source data must be preserved during composition"
        : undefined,
    }),
  },

  expansionKeySupport: {
    name: "expansion-key-support",
    description:
      "Expansion keys must correctly map array data to template variables",
    validator: (data: any) => ({
      isValid: data.hasExpansionMapping && data.correctKeyHandling,
      violation: !data.hasExpansionMapping || !data.correctKeyHandling
        ? "Expansion keys must properly map array data"
        : undefined,
    }),
  },

  conflictResolution: {
    name: "key-conflict-resolution",
    description:
      "Key conflicts must be resolved through unique naming strategies",
    validator: (data: any) => ({
      isValid: data.resolvesConflicts && data.preservesOriginalData,
      violation: !data.resolvesConflicts || !data.preservesOriginalData
        ? "Key conflicts must be resolved while preserving original data"
        : undefined,
    }),
  },

  compositionMethods: {
    name: "composition-method-completeness",
    description: "All composition methods must handle their specific use cases",
    validator: (data: any) => ({
      isValid: data.supportsSingleComposition &&
        data.supportsArrayComposition &&
        data.supportsDualTemplateComposition,
      violation: "All composition methods must be available and functional",
    }),
  },

  dataTypeHandling: {
    name: "data-type-handling",
    description: "All data types must be handled correctly during composition",
    validator: (data: any) => ({
      isValid: data.handlesComplexTypes && data.preservesDataTypes,
      violation: !data.handlesComplexTypes || !data.preservesDataTypes
        ? "All data types must be handled and preserved correctly"
        : undefined,
    }),
  },
};

describe("BUSINESS REQUIREMENT: Dynamic Data Composer Initialization", () => {
  describe("GIVEN: DynamicDataComposer creation request", () => {
    it("WHEN: Creating composer THEN: Should initialize successfully", () => {
      // Arrange - Business scenario setup
      // Act - Execute business operation
      const result = DynamicDataComposer.create();

      // Assert - Validate business requirements
      assert(result.ok, "DynamicDataComposer creation should succeed");

      if (result.ok) {
        // Business requirement: Composer must be properly initialized
        assert(
          result.data instanceof DynamicDataComposer,
          "Must return valid DynamicDataComposer instance",
        );
      }
    });

    it("WHEN: Creating multiple composers THEN: Should create independent instances", () => {
      // Arrange - Multiple instance business scenario
      // Act - Execute multiple instance creation
      const result1 = DynamicDataComposer.create();
      const result2 = DynamicDataComposer.create();

      // Assert - Validate independence requirement
      assert(result1.ok && result2.ok, "Both instances should be created");

      if (result1.ok && result2.ok) {
        // Business requirement: Instances must be independent
        assert(
          result1.data !== result2.data,
          "Instances must be independent objects",
        );

        // Validate composition methods completeness
        SpecificationAssertions.assertBusinessRequirement(
          {
            supportsSingleComposition: typeof result1.data.composeSingle ===
              "function",
            supportsArrayComposition: typeof result1.data.composeArray ===
              "function",
            supportsDualTemplateComposition: typeof result1.data
              .createDualTemplateData === "function",
          },
          dataCompositionRequirements.compositionMethods,
          "All composition methods must be available",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Data Composition with Expansion Keys", () => {
  describe("GIVEN: Main data and items with expansion keys", () => {
    it("WHEN: Composing with simple expansion keys THEN: Should merge data correctly", () => {
      // Arrange - Business scenario with expansion mapping
      const scenario = new DataCompositionScenarioBuilder()
        .withMainData({
          title: "Main Document",
          author: "John Doe",
        })
        .withItemsData([
          { name: "Item 1", value: 100 },
          { name: "Item 2", value: 200 },
        ])
        .withExpansionKey("books", "{@items}", "books")
        .build();

      // Act - Execute data composition
      const result = scenario.composer.compose(
        scenario.mainData,
        scenario.itemsData,
        scenario.expansionKeys,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Data composition should succeed");

      if (result.ok) {
        // Business requirement: Data composition integrity
        assertEquals(result.data.mainData.title, "Main Document");
        assertEquals(result.data.mainData.author, "John Doe");

        // Validate composition integrity requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            preservesMainData: result.data.mainData.title === "Main Document" &&
              result.data.mainData.author === "John Doe",
            preservesItemsData: Array.isArray(result.data.arrayData) &&
              result.data.arrayData.length === 2,
          },
          dataCompositionRequirements.compositionIntegrity,
          "Data composition must preserve all source data",
        );

        // Business requirement: Expansion key support
        assertEquals(result.data.mainData.books, [
          { name: "Item 1", value: 100 },
          { name: "Item 2", value: 200 },
        ]);

        // Validate expansion key support requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            hasExpansionMapping: result.data.mainData.books !== undefined,
            correctKeyHandling: Array.isArray(result.data.mainData.books) &&
              result.data.mainData.books.length === 2,
          },
          dataCompositionRequirements.expansionKeySupport,
          "Expansion keys must correctly map array data",
        );
      }
    });

    it("WHEN: Using multiple expansion keys THEN: Should handle multiple mappings", () => {
      // Arrange - Multiple expansion keys business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withMainData({
          project: "Test Project",
        })
        .withItemsData([
          { id: 1, status: "active" },
          { id: 2, status: "pending" },
        ])
        .withExpansionKey("tasks", "{@items}", "tasks")
        .withExpansionKey("items", "{@items}", "items")
        .build();

      // Act - Execute multiple expansion key composition
      const result = scenario.composer.compose(
        scenario.mainData,
        scenario.itemsData,
        scenario.expansionKeys,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Multiple expansion key composition should succeed");

      if (result.ok) {
        // Business requirement: Multiple expansion mappings
        assertEquals(result.data.mainData.project, "Test Project");
        assertEquals(result.data.mainData.tasks, [
          { id: 1, status: "active" },
          { id: 2, status: "pending" },
        ]);
        assertEquals(result.data.mainData.items, [
          { id: 1, status: "active" },
          { id: 2, status: "pending" },
        ]);

        // Validate expansion key support for multiple keys
        SpecificationAssertions.assertBusinessRequirement(
          {
            hasExpansionMapping: result.data.mainData.tasks !== undefined &&
              result.data.mainData.items !== undefined,
            correctKeyHandling: Array.isArray(result.data.mainData.tasks) &&
              Array.isArray(result.data.mainData.items),
          },
          dataCompositionRequirements.expansionKeySupport,
          "Multiple expansion keys must be handled correctly",
        );
      }
    });

    it("WHEN: Encountering key conflicts THEN: Should resolve with unique naming", () => {
      // Arrange - Key conflict business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withMainData({
          books: "existing value",
          title: "Test Document",
        })
        .withItemsData([
          { title: "Book 1" },
          { title: "Book 2" },
        ])
        .withExpansionKey("books", "{@items}", "books")
        .build();

      // Act - Execute composition with key conflict
      const result = scenario.composer.compose(
        scenario.mainData,
        scenario.itemsData,
        scenario.expansionKeys,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Key conflict resolution should succeed");

      if (result.ok) {
        // Business requirement: Conflict resolution
        assertEquals(result.data.mainData.books, "existing value");
        assertEquals(result.data.mainData.books_items, [
          { title: "Book 1" },
          { title: "Book 2" },
        ]);

        // Validate conflict resolution requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            resolvesConflicts: result.data.mainData.books_items !== undefined,
            preservesOriginalData: result.data.mainData.books ===
              "existing value",
          },
          dataCompositionRequirements.conflictResolution,
          "Key conflicts must be resolved while preserving original data",
        );
      }
    });

    it("WHEN: Processing empty items array THEN: Should handle gracefully", () => {
      // Arrange - Empty items business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withMainData({
          title: "Empty Project",
        })
        .withItemsData([])
        .withExpansionKey("empty_list", "{@items}", "empty_list")
        .build();

      // Act - Execute empty items composition
      const result = scenario.composer.compose(
        scenario.mainData,
        scenario.itemsData,
        scenario.expansionKeys,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Empty items composition should succeed");

      if (result.ok) {
        // Business requirement: Empty case handling
        assertEquals(result.data.mainData.title, "Empty Project");
        assertEquals(result.data.mainData.empty_list, []);
        assertEquals(result.data.arrayData, []);

        // Validate composition integrity for empty case
        SpecificationAssertions.assertBusinessRequirement(
          {
            preservesMainData: result.data.mainData.title === "Empty Project",
            preservesItemsData: Array.isArray(result.data.arrayData) &&
              result.data.arrayData.length === 0,
          },
          dataCompositionRequirements.compositionIntegrity,
          "Empty items must be handled while preserving data integrity",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Single Data Composition", () => {
  describe("GIVEN: Main data only composition scenarios", () => {
    it("WHEN: Composing single data THEN: Should preserve structure and content", () => {
      // Arrange - Single data business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withMainData({
          title: "Single Document",
          content: "This is the content",
          tags: ["tag1", "tag2"],
        })
        .build();

      // Act - Execute single data composition
      const result = scenario.composer.composeSingle(scenario.mainData);

      // Assert - Validate business requirements
      assert(result.ok, "Single data composition should succeed");

      if (result.ok) {
        // Business requirement: Single data preservation
        assertEquals(result.data.mainData.title, "Single Document");
        assertEquals(result.data.mainData.content, "This is the content");
        assertEquals(result.data.mainData.tags, ["tag1", "tag2"]);
        assertEquals(result.data.arrayData, undefined);

        // Validate data type handling requirement
        SpecificationAssertions.assertBusinessRequirement(
          {
            handlesComplexTypes: Array.isArray(result.data.mainData.tags),
            preservesDataTypes:
              typeof result.data.mainData.title === "string" &&
              typeof result.data.mainData.content === "string",
          },
          dataCompositionRequirements.dataTypeHandling,
          "Single composition must handle all data types correctly",
        );
      }
    });

    it("WHEN: Processing complex nested data THEN: Should preserve deep structures", () => {
      // Arrange - Complex nested business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withMainData({
          metadata: {
            author: { name: "John", email: "john@example.com" },
            created: "2023-01-01",
          },
          settings: {
            theme: "dark",
            language: "en",
          },
        })
        .build();

      // Act - Execute complex structure composition
      const result = scenario.composer.composeSingle(scenario.mainData);

      // Assert - Validate business requirements
      assert(result.ok, "Complex structure composition should succeed");

      if (result.ok) {
        // Business requirement: Complex structure preservation
        assertEquals(result.data.mainData.metadata, {
          author: { name: "John", email: "john@example.com" },
          created: "2023-01-01",
        });
        assertEquals(result.data.mainData.settings, {
          theme: "dark",
          language: "en",
        });

        // Validate data type handling for complex structures
        const metadata = result.data.mainData.metadata as any;
        SpecificationAssertions.assertBusinessRequirement(
          {
            handlesComplexTypes: typeof metadata === "object" &&
              metadata !== null && typeof metadata.author === "object",
            preservesDataTypes: metadata?.author?.name === "John",
          },
          dataCompositionRequirements.dataTypeHandling,
          "Complex nested structures must be handled correctly",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Array Data Composition", () => {
  describe("GIVEN: Array-only composition scenarios", () => {
    it("WHEN: Composing array data THEN: Should create proper array structure", () => {
      // Arrange - Array composition business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withItemsData([
          { id: 1, name: "First Item" },
          { id: 2, name: "Second Item" },
          { id: 3, name: "Third Item" },
        ])
        .build();

      // Act - Execute array composition
      const result = scenario.composer.composeArray(scenario.itemsData);

      // Assert - Validate business requirements
      assert(result.ok, "Array composition should succeed");

      if (result.ok) {
        // Business requirement: Array structure creation
        assertEquals(result.data.mainData, {});
        assertEquals(result.data.arrayData, [
          { id: 1, name: "First Item" },
          { id: 2, name: "Second Item" },
          { id: 3, name: "Third Item" },
        ]);

        // Validate composition integrity for array-only case
        SpecificationAssertions.assertBusinessRequirement(
          {
            preservesMainData: typeof result.data.mainData === "object",
            preservesItemsData: Array.isArray(result.data.arrayData) &&
              result.data.arrayData.length === 3,
          },
          dataCompositionRequirements.compositionIntegrity,
          "Array composition must preserve item data structure",
        );
      }
    });

    it("WHEN: Processing mixed data types in array THEN: Should handle type diversity", () => {
      // Arrange - Mixed data types business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withItemsData([
          { type: "string", value: "text" },
          { type: "number", value: 42 },
          { type: "boolean", value: true },
          { type: "object", value: { nested: "data" } },
        ])
        .build();

      // Act - Execute mixed type array composition
      const result = scenario.composer.composeArray(scenario.itemsData);

      // Assert - Validate business requirements
      assert(result.ok, "Mixed type array composition should succeed");

      if (result.ok) {
        // Business requirement: Mixed data type handling
        assertEquals(result.data.arrayData, [
          { type: "string", value: "text" },
          { type: "number", value: 42 },
          { type: "boolean", value: true },
          { type: "object", value: { nested: "data" } },
        ]);

        // Validate data type handling for diverse types
        const arrayData = result.data.arrayData as any[];
        SpecificationAssertions.assertBusinessRequirement(
          {
            handlesComplexTypes: arrayData && arrayData[3] &&
              typeof arrayData[3].value === "object",
            preservesDataTypes: arrayData && arrayData[1] &&
              arrayData[2] && typeof arrayData[1].value === "number" &&
              typeof arrayData[2].value === "boolean",
          },
          dataCompositionRequirements.dataTypeHandling,
          "Mixed data types must be handled correctly in arrays",
        );
      }
    });
  });
});

describe("BUSINESS REQUIREMENT: Dual Template Data Composition", () => {
  describe("GIVEN: Rendered items for dual template scenarios", () => {
    it("WHEN: Creating dual template data with JSON items THEN: Should process JSON correctly", () => {
      // Arrange - JSON rendered items business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withMainData({
          title: "Dual Template Document",
          author: "Jane Doe",
        })
        .withRenderedItems([
          '{"name": "Item 1", "value": 100}',
          '{"name": "Item 2", "value": 200}',
        ])
        .build();

      // Act - Execute dual template data creation
      const result = scenario.composer.createDualTemplateData(
        scenario.mainData,
        scenario.renderedItems,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Dual template data creation should succeed");

      if (result.ok) {
        // Business requirement: Dual template data preservation
        assertEquals(result.data.mainData.title, "Dual Template Document");
        assertEquals(result.data.mainData.author, "Jane Doe");
        assertEquals(
          result.data.mainData.items,
          '[{"name":"Item 1","value":100},{"name":"Item 2","value":200}]',
        );

        // Validate composition integrity for dual template
        const items = result.data.mainData.items as string;
        SpecificationAssertions.assertBusinessRequirement(
          {
            preservesMainData: result.data.mainData.title ===
              "Dual Template Document",
            preservesItemsData: items !== undefined &&
              typeof items === "string" && items.includes("Item 1"),
          },
          dataCompositionRequirements.compositionIntegrity,
          "Dual template composition must preserve all data",
        );
      }
    });

    it("WHEN: Processing mixed JSON and text items THEN: Should handle format diversity", () => {
      // Arrange - Mixed format business scenario
      const scenario = new DataCompositionScenarioBuilder()
        .withMainData({
          title: "Mixed Items Document",
        })
        .withRenderedItems([
          '{"name": "JSON Item", "type": "object"}',
          "Plain text item",
          '{"another": "JSON item"}',
          "Another plain text",
        ])
        .build();

      // Act - Execute mixed format dual template creation
      const result = scenario.composer.createDualTemplateData(
        scenario.mainData,
        scenario.renderedItems,
      );

      // Assert - Validate business requirements
      assert(result.ok, "Mixed format dual template creation should succeed");

      if (result.ok) {
        const expectedItems = [
          { name: "JSON Item", type: "object" },
          "Plain text item",
          { another: "JSON item" },
          "Another plain text",
        ];

        assertEquals(result.data.mainData.title, "Mixed Items Document");
        assertEquals(
          result.data.mainData.items,
          JSON.stringify(expectedItems),
        );

        // Validate data type handling for mixed formats
        const mixedItems = result.data.mainData.items as string;
        SpecificationAssertions.assertBusinessRequirement(
          {
            handlesComplexTypes: mixedItems &&
              mixedItems.includes("JSON Item") &&
              mixedItems.includes("Plain text item"),
            preservesDataTypes: typeof mixedItems === "string",
          },
          dataCompositionRequirements.dataTypeHandling,
          "Mixed format items must be handled correctly",
        );
      }
    });
  });
});

/**
 * Domain rule validation tests
 */
describe("DOMAIN RULES: Dynamic Data Composition", () => {
  const dataCompositionRules: DomainRule<any> = {
    name: "dynamic-data-composition-completeness",
    description: "Data composition must handle all business scenarios",
    validator: (data) => ({
      isValid: data.composer &&
        typeof data.composer.compose === "function" &&
        typeof data.composer.composeSingle === "function" &&
        typeof data.composer.composeArray === "function" &&
        typeof data.composer.createDualTemplateData === "function",
      violation: "Data composer must provide complete composition interface",
    }),
  };

  it("Should enforce dynamic data composition domain rules", () => {
    const composerResult = DynamicDataComposer.create();
    assert(composerResult.ok);

    SpecificationAssertions.assertDomainRule(
      { composer: composerResult.data },
      dataCompositionRules,
      "dynamic-data-composition",
      "Dynamic data composition must satisfy domain requirements",
    );
  });
});
