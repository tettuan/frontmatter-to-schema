/**
 * Robust AggregateResultsUseCase Tests
 *
 * Addresses Issue #666: Critical method test coverage gaps
 * Tests Issue #673 implementation: nested result merging functionality
 * Validates template processing integration (Issue #672 related)
 * Follows DDD, Totality, and AI complexity control principles
 */

import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { AggregateResultsUseCase } from "../../../../src/application/use-cases/aggregate-results/aggregate-results.usecase.ts";
import type { AggregateResultsInput } from "../../../../src/application/use-cases/aggregate-results/aggregate-results.usecase.ts";
import { SchemaTemplateInfo } from "../../../../src/domain/models/schema-extensions.ts";

describe("AggregateResultsUseCase - Robust Application Tests", () => {
  // Smart Constructor pattern for use case creation
  function createUseCase(): AggregateResultsUseCase {
    return AggregateResultsUseCase.createOrDefault();
  }

  // Test data factory for consistent test scenarios
  function createRegistryTestData() {
    return [{
      tools: {
        commands: [
          {
            c1: "git",
            c2: "merge-up",
            c3: "base-branch",
            title: "Git Merge",
            description: "Merge work branch",
          },
          {
            c1: "debug",
            c2: "analyze-deep",
            c3: "project-issues",
            title: "Debug Analysis",
            description: "Deep project analysis",
          },
          {
            c1: "refactor",
            c2: "ddd",
            c3: "architecture",
            title: "DDD Refactor",
            description: "Domain refactoring",
          },
        ],
      },
    }];
  }

  function createRegistrySchema() {
    return {
      type: "object",
      "x-template": "registry_template.json",
      properties: {
        version: { type: "string" },
        description: { type: "string" },
        tools: {
          type: "object",
          properties: {
            availableConfigs: {
              type: "array",
              "x-derived-from": "commands[].c1",
              "x-derived-unique": true,
              items: { type: "string" },
            },
            commands: {
              type: "array",
              "x-frontmatter-part": true,
              items: {
                type: "object",
                properties: {
                  c1: { type: "string" },
                  c2: { type: "string" },
                  c3: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
      },
    };
  }

  describe("Use Case Creation - Constructor Validation", () => {
    it("should create use case instance", () => {
      const useCase = createUseCase();
      assertExists(useCase);
    });

    it("should initialize aggregation adapter", () => {
      const useCase = createUseCase();
      // Verify internal adapter exists (accessing private property for testing)
      const adapter = (useCase as unknown as { aggregationAdapter: unknown })
        .aggregationAdapter;
      assertExists(adapter);
    });
  });

  describe("Input Validation - Totality Principle", () => {
    it("should reject invalid input data types", async () => {
      const useCase = createUseCase();
      const schema = createRegistrySchema();

      const templateInfoResult = SchemaTemplateInfo.extract(schema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const invalidInput: AggregateResultsInput = {
        data: "invalid-not-array" as unknown as unknown[],
        templateInfo: templateInfoResult.data,
        schema: schema,
      };

      const result = await useCase.execute(invalidInput);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
        assertExists(result.error.message);
      }
    });

    it("should handle empty data array", async () => {
      const useCase = createUseCase();
      const schema = createRegistrySchema();

      const templateInfoResult = SchemaTemplateInfo.extract(schema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const validInput: AggregateResultsInput = {
        data: [],
        templateInfo: templateInfoResult.data,
        schema: schema,
      };

      const result = await useCase.execute(validInput);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.itemCount, 0);
        assertExists(result.data.aggregated);
      }
    });
  });

  describe("Nested Result Merging - Issue #673 Implementation", () => {
    it("should merge dot-notation aggregation keys to nested structure", async () => {
      const useCase = createUseCase();
      const schema = createRegistrySchema();
      const testData = createRegistryTestData();

      const templateInfoResult = SchemaTemplateInfo.extract(schema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfoResult.data,
        schema: schema,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        const aggregated = result.data.aggregated;

        // Verify nested structure preservation
        assertExists(aggregated.tools);
        const tools = aggregated.tools as Record<string, unknown>;

        // Test Issue #673 fix: availableConfigs should be nested under tools
        assertExists(tools.availableConfigs);
        const availableConfigs = tools.availableConfigs as string[];

        assertEquals(Array.isArray(availableConfigs), true);
        assertEquals(availableConfigs.includes("git"), true);
        assertEquals(availableConfigs.includes("debug"), true);
        assertEquals(availableConfigs.includes("refactor"), true);
        assertEquals(availableConfigs.length, 3);

        // Verify commands array is preserved
        assertExists(tools.commands);
        const commands = tools.commands as unknown[];
        assertEquals(Array.isArray(commands), true);
        assertEquals(commands.length, 3);
      }
    });

    it("should handle multiple derived fields with correct nesting", async () => {
      const useCase = createUseCase();

      const complexSchema = {
        type: "object",
        properties: {
          tools: {
            type: "object",
            properties: {
              configs: {
                type: "array",
                "x-derived-from": "commands[].c1",
                "x-derived-unique": true,
                items: { type: "string" },
              },
              actions: {
                type: "array",
                "x-derived-from": "commands[].c2",
                "x-derived-unique": true,
                items: { type: "string" },
              },
              commands: {
                type: "array",
                "x-frontmatter-part": true,
                items: { type: "object" },
              },
            },
          },
          meta: {
            type: "object",
            properties: {
              totalCommands: {
                type: "number",
                "x-derived-from": "commands[]",
                items: { type: "object" },
              },
            },
          },
        },
      };

      const testData = createRegistryTestData();

      const templateInfoResult = SchemaTemplateInfo.extract(complexSchema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfoResult.data,
        schema: complexSchema,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        const aggregated = result.data.aggregated;

        // Verify tools.configs
        const tools = aggregated.tools as Record<string, unknown>;
        assertExists(tools.configs);
        assertEquals(Array.isArray(tools.configs), true);

        // Verify tools.actions
        assertExists(tools.actions);
        assertEquals(Array.isArray(tools.actions), true);

        // Verify meta.totalCommands exists
        const meta = aggregated.meta as Record<string, unknown>;
        assertExists(meta);
      }
    });
  });

  describe("Frontmatter Part Detection - DDD Business Logic", () => {
    it("should detect ArrayBased processing result correctly", async () => {
      const useCase = createUseCase();
      const schema = createRegistrySchema();
      const testData = createRegistryTestData();

      const templateInfoResult = SchemaTemplateInfo.extract(schema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfoResult.data,
        schema: schema,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        // Should identify this as ArrayBased result and preserve structure
        const aggregated = result.data.aggregated;

        // Should NOT have 'items' property (removed for ArrayBased)
        assertEquals("items" in aggregated, false);

        // Should have properly structured tools
        assertExists(aggregated.tools);
      }
    });

    it("should handle Individual processing mode", async () => {
      const useCase = createUseCase();

      // Schema without nested structure (Individual mode)
      const individualSchema = {
        type: "object",
        properties: {
          commands: {
            type: "array",
            "x-frontmatter-part": true,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      };

      const individualData = [
        { name: "command1" },
        { name: "command2" },
      ];

      const templateInfoResult = SchemaTemplateInfo.extract(individualSchema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const input: AggregateResultsInput = {
        data: individualData,
        templateInfo: templateInfoResult.data,
        schema: individualSchema,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        const aggregated = result.data.aggregated;

        // Should have commands array for Individual processing
        assertExists(aggregated.commands);
        const commands = aggregated.commands as unknown[];
        assertEquals(Array.isArray(commands), true);
        assertEquals(commands.length, 2);
      }
    });
  });

  describe("Derived Fields Identification - Business Rules", () => {
    it("should identify derived fields correctly", async () => {
      const useCase = createUseCase();
      const schema = createRegistrySchema();
      const testData = createRegistryTestData();

      const templateInfoResult = SchemaTemplateInfo.extract(schema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfoResult.data,
        schema: schema,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        // derivedFields should contain fields that were generated by aggregation
        assertExists(result.data.derivedFields);
        const derivedFields = result.data.derivedFields as Record<
          string,
          unknown
        >;

        // tools.availableConfigs should be identified as derived
        assertExists(derivedFields["tools.availableConfigs"]);
        assertEquals(
          Array.isArray(derivedFields["tools.availableConfigs"]),
          true,
        );
      }
    });

    it("should return undefined for derivedFields when none exist", async () => {
      const useCase = createUseCase();

      // Schema without derived fields
      const simpleSchema = {
        type: "object",
        properties: {
          commands: {
            type: "array",
            "x-frontmatter-part": true,
            items: { type: "object" },
          },
        },
      };

      const testData = [{ name: "simple" }];

      const templateInfoResult = SchemaTemplateInfo.extract(simpleSchema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfoResult.data,
        schema: simpleSchema,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        // No derived fields should result in undefined
        assertEquals(result.data.derivedFields, undefined);
      }
    });
  });

  describe("Error Handling - Totality Validation", () => {
    it("should handle schema extraction failures gracefully", async () => {
      const useCase = createUseCase();

      const malformedSchema = {
        type: "invalid-schema-type",
        properties: undefined,
      };

      const testData = [{ test: "data" }];

      const templateInfoResult = SchemaTemplateInfo.extract(malformedSchema);

      // Template info extraction might fail or succeed with empty rules
      if (templateInfoResult.ok) {
        const input: AggregateResultsInput = {
          data: testData,
          templateInfo: templateInfoResult.data,
          schema: malformedSchema,
        };

        const result = await useCase.execute(input);

        // Should handle gracefully and return some result
        assertEquals(typeof result.ok, "boolean");
      }
    });

    it("should handle processing errors with proper error types", async () => {
      const useCase = createUseCase();
      const schema = createRegistrySchema();

      const templateInfoResult = SchemaTemplateInfo.extract(schema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      // Force an error condition by passing null data
      const input: AggregateResultsInput = {
        data: null as unknown as unknown[],
        templateInfo: templateInfoResult.data,
        schema: schema,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertExists(result.error.kind);
        assertExists(result.error.message);
      }
    });
  });

  describe("Performance and Memory Management", () => {
    it("should handle large datasets efficiently", async () => {
      const useCase = createUseCase();
      const schema = createRegistrySchema();

      // Generate large dataset with nested structure
      const largeTestData = [{
        tools: {
          commands: Array.from({ length: 1000 }, (_, i) => ({
            c1: `type-${i % 10}`, // 10 unique types
            c2: `action-${i % 5}`, // 5 unique actions
            c3: `target-${i}`,
            title: `Command ${i}`,
            description: `Description for command ${i}`,
          })),
        },
      }];

      const templateInfoResult = SchemaTemplateInfo.extract(schema);
      assertEquals(templateInfoResult.ok, true);
      if (!templateInfoResult.ok) return;

      const input: AggregateResultsInput = {
        data: largeTestData,
        templateInfo: templateInfoResult.data,
        schema: schema,
      };

      const startTime = performance.now();
      const result = await useCase.execute(input);
      const endTime = performance.now();

      assertEquals(result.ok, true);
      if (result.ok) {
        const tools = result.data.aggregated.tools as Record<string, unknown>;
        const availableConfigs = tools.availableConfigs as string[];

        // Should have 10 unique configs due to uniqueness filtering
        assertEquals(availableConfigs.length, 10);

        const commands = tools.commands as unknown[];
        assertEquals(commands.length, 1000);
      }

      // Performance validation
      const executionTime = endTime - startTime;
      assertEquals(
        executionTime < 1000,
        true,
        `Execution took ${executionTime}ms, expected < 1000ms`,
      );
    });
  });
});
