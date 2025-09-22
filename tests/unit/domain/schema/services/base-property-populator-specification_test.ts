import { describe, it } from "jsr:@std/testing@^1.0.5/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.7";
import {
  BasePropertyPopulator,
} from "../../../../../src/domain/schema/services/base-property-populator.ts";
import { Schema } from "../../../../../src/domain/schema/entities/schema.ts";
import { SchemaPath } from "../../../../../src/domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../../../../src/domain/schema/value-objects/schema-definition.ts";
import { FrontmatterData } from "../../../../../src/domain/frontmatter/value-objects/frontmatter-data.ts";

/**
 * BasePropertyPopulator Specification Test Suite
 *
 * This test suite follows DDD and Totality principles:
 * - Tests business requirements for standard JSON Schema default property handling
 * - Uses real domain objects instead of mocks
 * - Validates comprehensive error scenarios and edge cases
 * - Focuses on standard JSON Schema default property functionality
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

  describe("Business Requirement: Standard JSON Schema Default Property Handling", () => {
    it("should populate missing properties with standard JSON Schema defaults", () => {
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

      // When: Populating default properties
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

    it("should not overwrite existing properties", () => {
      // Given: Schema with default properties and frontmatter with existing values
      const schema = createTestSchema({
        type: "object",
        properties: {
          status: {
            type: "string",
            default: "draft",
          },
          priority: {
            type: "number",
            default: 1,
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        status: "published", // Existing value
        priority: 5, // Existing value
      });

      const populator = new BasePropertyPopulator();

      // When: Populating default properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Existing properties should remain unchanged
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.status, "published"); // Original value preserved
      assertEquals(populatedData.priority, 5); // Original value preserved
    });

    it("should handle nested object properties with defaults", () => {
      // Given: Schema with nested default properties
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          config: {
            type: "object",
            properties: {
              theme: {
                type: "string",
                default: "light", // Standard default
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
                    default: 5000, // Standard default
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

      // When: Populating default properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Nested default properties should be populated with proper paths
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(populatedData["config.theme"], "light");
      assertEquals(populatedData["config.debug"], false);
      assertEquals(populatedData["config.settings.timeout"], 5000);
    });

    it("should return original data when no default properties are defined", () => {
      // Given: Schema without any default properties
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

      // When: Populating default properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Original data should be returned unchanged
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(populatedData.description, "A test document");
      assertEquals(Object.keys(populatedData).length, 2);
    });

    it("should handle simple default values", () => {
      // Given: Schema with simple default values
      const schema = createTestSchema({
        type: "object",
        properties: {
          title: { type: "string" },
          count: {
            type: "number",
            default: 0,
          },
          isActive: {
            type: "boolean",
            default: true,
          },
          description: {
            type: "string",
            default: "No description provided",
          },
        },
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // All default properties are missing
      });

      const populator = new BasePropertyPopulator();

      // When: Populating default properties
      const result = populator.populate(frontmatterData, schema);

      // Then: Simple default values should be populated
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");
      assertEquals(populatedData.count, 0);
      assertEquals(populatedData.isActive, true);
      assertEquals(populatedData.description, "No description provided");
    });
  });

  describe("Performance and Scale Testing", () => {
    it("should handle large schemas with many default properties efficiently", () => {
      // Given: Large schema with many default properties
      const properties: Record<string, any> = {
        title: { type: "string" },
      };

      // Create 50 default properties for performance testing
      for (let i = 0; i < 50; i++) {
        properties[`defaultProp${i}`] = {
          type: "string",
          default: `defaultValue${i}`,
        };
      }

      const schema = createTestSchema({
        type: "object",
        properties,
      });

      const frontmatterData = createTestFrontmatterData({
        title: "Test Document",
        // All default properties are missing
      });

      const populator = new BasePropertyPopulator();

      // When: Populating many default properties with performance measurement
      const startTime = performance.now();
      const result = populator.populate(frontmatterData, schema);
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Then: Should complete efficiently and populate all properties
      assertExists(result.ok);
      if (!result.ok) return;

      const populatedData = result.data.getData();
      assertEquals(populatedData.title, "Test Document");

      // Verify all default properties were populated
      for (let i = 0; i < 50; i++) {
        assertEquals(populatedData[`defaultProp${i}`], `defaultValue${i}`);
      }

      // Performance benchmark: Should complete within 100ms for 50 properties
      assertEquals(
        duration < 100,
        true,
        `BasePropertyPopulator took ${duration}ms for 50 properties, expected <100ms`,
      );
    });

    it("should be stateless across multiple populate operations", () => {
      // Given: Same populator instance used for multiple operations
      const schema1 = createTestSchema({
        type: "object",
        properties: {
          version: {
            type: "string",
            default: "1.0.0",
          },
        },
      });

      const schema2 = createTestSchema({
        type: "object",
        properties: {
          author: {
            type: "string",
            default: "Anonymous",
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
  });
});
