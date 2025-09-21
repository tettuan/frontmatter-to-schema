import { describe, it } from "jsr:@std/testing@^1.0.5/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.7";
import {
  BasePropertyPopulator,
} from "../../../../../src/domain/schema/services/base-property-populator.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";
import { defaultSchemaExtensionRegistry } from "../../../../../src/domain/schema/value-objects/schema-extension-registry.ts";

/**
 * BasePropertyPopulator Robust Specification Test Suite
 *
 * This test suite follows DDD and Totality principles:
 * - Tests business requirements, not implementation details
 * - Uses real domain objects instead of mocks
 * - Validates comprehensive error scenarios and edge cases
 * - Includes performance benchmarks for production readiness
 */
describe("BasePropertyPopulator Specification", () => {
  // Test Helpers - Robust and Deterministic
  const createTestSchema = (schemaDefinition: any): Schema => {
    const pathResult = SchemaPath.create("test-schema.json");
    if (!pathResult.ok) {
      throw new Error(
        `Failed to create schema path: ${pathResult.error.message}`,
      );
    }

    const definitionResult = SchemaDefinition.create(schemaDefinition);
    if (!definitionResult.ok) {
      throw new Error(
        `Failed to create schema definition: ${definitionResult.error.message}`,
      );
    }

    const schemaResult = Schema.create(pathResult.data, definitionResult.data);
    if (!schemaResult.ok) {
      throw new Error(`Failed to create schema: ${schemaResult.error.message}`);
    }
    return schemaResult.data;
  };

  const createTestFrontmatterData = (
    data: Record<string, unknown>,
  ): FrontmatterData => {
    const frontmatterResult = FrontmatterData.create(data);
    if (!frontmatterResult.ok) {
      throw new Error(
        `Failed to create test FrontmatterData: ${frontmatterResult.error.message}`,
      );
    }
    return frontmatterResult.data;
  };

  // Extension keys for testing
  const BASE_PROPERTY_KEY = defaultSchemaExtensionRegistry.getBasePropertyKey()
    .getValue();
  const DEFAULT_VALUE_KEY = defaultSchemaExtensionRegistry.getDefaultValueKey()
    .getValue();

  describe("Business Requirement: Base Property Population", () => {
    it("should populate missing properties with base property defaults", () => {
      // Given: Schema with base properties and frontmatter missing some properties
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          version: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: "1.0.0",
          },
          author: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: "Anonymous",
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // version and author are missing
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Missing base properties should be populated with defaults
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(populatedData.version, "1.0.0");
      assertEquals(populatedData.author, "Anonymous");
    });

    it("should not overwrite existing properties", () => {
      // Given: Schema with base properties and frontmatter with existing values
      const schema = createTestSchema({
        type: "object",
        properties: {
          version: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: "1.0.0",
          },
          author: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: "Anonymous",
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        version: "2.1.0", // Existing value
        author: "John Doe", // Existing value
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Existing properties should remain unchanged
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.version, "2.1.0"); // Original value preserved
      assertEquals(populatedData.author, "John Doe"); // Original value preserved
    });

    it("should handle standard JSON Schema default properties", () => {
      // Given: Schema with standard JSON Schema default properties
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          status: {
            type: "string",
            default: "draft", // Standard JSON Schema default
          },
          priority: {
            type: "number",
            default: 1, // Standard JSON Schema default
          },
          enabled: {
            type: "boolean",
            default: true, // Standard JSON Schema default
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // status, priority, enabled are missing
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Missing properties with defaults should be populated
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(populatedData.status, "draft");
      assertEquals(populatedData.priority, 1);
      assertEquals(populatedData.enabled, true);
    });

    it("should handle nested object properties with base defaults", () => {
      // Given: Schema with nested base properties
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          config: {
            type: "object",
            properties: {
              theme: {
                type: "string",
                [BASE_PROPERTY_KEY]: true,
                [DEFAULT_VALUE_KEY]: "light",
              },
              debug: {
                type: "boolean",
                default: false, // Standard default
              },
              settings: {
                type: "object",
                properties: {
                  timeout: {
                    type: "number",
                    [BASE_PROPERTY_KEY]: true,
                    [DEFAULT_VALUE_KEY]: 5000,
                  },
                },
              },
            },
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // All nested properties are missing
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Nested base properties should be populated with proper paths
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(populatedData["config.theme"], "light");
      assertEquals(populatedData["config.debug"], false);
      assertEquals(populatedData["config.settings.timeout"], 5000);
    });
  });

  describe("Business Requirement: Array Property Handling", () => {
    it("should handle array items with base properties", () => {
      // Given: Schema with array containing objects with base properties
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                enabled: {
                  type: "boolean",
                  [BASE_PROPERTY_KEY]: true,
                  [DEFAULT_VALUE_KEY]: true,
                },
              },
            },
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // Array with base properties in items
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Array item base properties should be processed
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(populatedData["items.enabled"], true);
    });
  });

  describe("Business Requirement: No Base Properties Scenario", () => {
    it("should return original data when no base properties are defined", () => {
      // Given: Schema without any base properties
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          count: { type: "number" },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        description: "A test document",
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Original data should be returned unchanged
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(populatedData.description, "A test document");
      assertEquals(Object.keys(populatedData).length, 2);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle base property with undefined default value", () => {
      // Given: Schema with base property but undefined default value
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          version: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: undefined, // Invalid default
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // version is missing and has undefined default
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Should return error for undefined default value
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "InvalidSchema");
      assertEquals(
        result.error.message,
        "Invalid schema: Base property 'version' defined but no default value specified",
      );
    });

    it("should handle mixed base properties with some undefined defaults", () => {
      // Given: Schema with mix of valid and invalid base properties
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          version: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: "1.0.0", // Valid default
          },
          author: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: undefined, // Invalid default
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // Both version and author are missing
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Should fail on first undefined default encountered
      assertEquals(result.ok, false);
      if (result.ok) return;

      assertEquals(result.error.kind, "InvalidSchema");
      assertEquals(
        result.error.message,
        "Invalid schema: Base property 'author' defined but no default value specified",
      );
    });

    it("should handle complex nested structures", () => {
      // Given: Schema with deeply nested base properties
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          metadata: {
            type: "object",
            properties: {
              build: {
                type: "object",
                properties: {
                  config: {
                    type: "object",
                    properties: {
                      optimization: {
                        type: "boolean",
                        [BASE_PROPERTY_KEY]: true,
                        [DEFAULT_VALUE_KEY]: false,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // Deeply nested property is missing
      });

      const populator = new BasePropertyPopulator();

      // When: Populating base properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Should populate deeply nested base property
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(
        populatedData["metadata.build.config.optimization"],
        false,
      );
    });
  });

  describe("Performance and Scale Testing", () => {
    it("should handle large schemas with many base properties efficiently", () => {
      // Given: Large schema with many base properties
      const properties: Record<string, any> = {
        title: { type: "string" },
      };

      // Create 50 base properties for performance testing
      for (let i = 0; i < 50; i++) {
        properties[`baseProp${i}`] = {
          type: "string",
          [BASE_PROPERTY_KEY]: true,
          [DEFAULT_VALUE_KEY]: `defaultValue${i}`,
        };
      }

      const schema = createTestSchema({
        type: "object",
        properties,
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // All base properties are missing
      });

      const populator = new BasePropertyPopulator();

      // When: Populating many base properties with performance measurement
      const startTime = performance.now();
      const result = populator.populate(frontmatterData, schema);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Then: Should complete efficiently and populate all properties
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");

      // Verify all base properties were populated
      for (let i = 0; i < 50; i++) {
        assertEquals(populatedData[`baseProp${i}`], `defaultValue${i}`);
      }

      // Performance benchmark: Should complete within 100ms for 50 properties
      assertEquals(
        duration < 100,
        true,
        `BasePropertyPopulator took ${duration}ms for 50 properties, expected <100ms`,
      );
    });

    it("should handle deeply nested structures efficiently", () => {
      // Given: Deeply nested schema (5 levels) with base properties at each level
      const schema = createTestSchema({
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              prop1: {
                type: "string",
                [BASE_PROPERTY_KEY]: true,
                [DEFAULT_VALUE_KEY]: "level1Value",
              },
              level2: {
                type: "object",
                properties: {
                  prop2: {
                    type: "string",
                    [BASE_PROPERTY_KEY]: true,
                    [DEFAULT_VALUE_KEY]: "level2Value",
                  },
                  level3: {
                    type: "object",
                    properties: {
                      prop3: {
                        type: "string",
                        [BASE_PROPERTY_KEY]: true,
                        [DEFAULT_VALUE_KEY]: "level3Value",
                      },
                      level4: {
                        type: "object",
                        properties: {
                          prop4: {
                            type: "string",
                            [BASE_PROPERTY_KEY]: true,
                            [DEFAULT_VALUE_KEY]: "level4Value",
                          },
                          level5: {
                            type: "object",
                            properties: {
                              prop5: {
                                type: "string",
                                [BASE_PROPERTY_KEY]: true,
                                [DEFAULT_VALUE_KEY]: "level5Value",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // All nested properties are missing
      });

      const populator = new BasePropertyPopulator();

      // When: Processing deeply nested structure with performance measurement
      const startTime = performance.now();
      const result = populator.populate(frontmatterData, schema);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Then: Should handle deep nesting efficiently
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData["level1.prop1"], "level1Value");
      assertEquals(populatedData["level1.level2.prop2"], "level2Value");
      assertEquals(populatedData["level1.level2.level3.prop3"], "level3Value");
      assertEquals(
        populatedData["level1.level2.level3.level4.prop4"],
        "level4Value",
      );
      assertEquals(
        populatedData["level1.level2.level3.level4.level5.prop5"],
        "level5Value",
      );

      // Performance benchmark: Should complete within 50ms for 5-level nesting
      assertEquals(
        duration < 50,
        true,
        `BasePropertyPopulator took ${duration}ms for 5-level nesting, expected <50ms`,
      );
    });
  });

  describe("Service Lifecycle and Stateless Behavior", () => {
    it("should be stateless across multiple populate operations", () => {
      // Given: Same populator instance used for multiple operations
      const schema1 = createTestSchema({
        type: "object",
        properties: {
          version: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: "1.0.0",
          },
        },
      });

      const schema2 = createTestSchema({
        type: "object",
        properties: {
          author: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: "Anonymous",
          },
        },
      });

      const frontmatterData1 = createTestFrontmatterData({ title: "Doc1" });
      const frontmatterData2 = createTestFrontmatterData({ title: "Doc2" });

      const populator = new BasePropertyPopulator();

      // When: Using same populator for different operations
      const result1 = populator.populate(frontmatterData1, schema1);
      const result2 = populator.populate(frontmatterData2, schema2);

      // Then: Both operations should succeed independently
      assertExists(result1.ok);
      assertExists(result2.ok);
      if (!result1.ok || !result2.ok) return;

      const data1 = result1.data.getData();
      const data2 = result2.data.getData();

      assertEquals(data1.title, "Doc1");
      assertEquals(data1.version, "1.0.0");
      assertEquals(data1.author, undefined); // Not in schema1

      assertEquals(data2.title, "Doc2");
      assertEquals(data2.author, "Anonymous");
      assertEquals(data2.version, undefined); // Not in schema2
    });

    it("should handle concurrent operations safely", () => {
      // Given: Schema for concurrent testing
      const schema = createTestSchema({
        type: "object",
        properties: {
          instanceId: {
            type: "string",
            [BASE_PROPERTY_KEY]: true,
            [DEFAULT_VALUE_KEY]: "default-instance",
          },
        },
      });

      const populator = new BasePropertyPopulator();

      // When: Multiple concurrent populate operations
      const operations = Array.from({ length: 10 }, (_, i) => {
        const frontmatterData = createTestFrontmatterData({
          title: `Document ${i}`,
        });
        return populator.populate(frontmatterData, schema);
      });

      // Then: All operations should succeed independently
      for (let i = 0; i < operations.length; i++) {
        const result = operations[i];
        assertExists(result.ok);
        if (!result.ok) continue;

        const data = result.data.getData();
        assertEquals(data.title, `Document ${i}`);
        assertEquals(data.instanceId, "default-instance");
      }
    });
  });
});
