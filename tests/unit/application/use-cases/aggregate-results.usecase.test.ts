/**
 * AggregateResultsUseCase Unit Tests
 *
 * Comprehensive test coverage for aggregation logic and derivation rules
 * Addressing Issue #595 - Critical Test Gap
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { AggregateResultsUseCase } from "../../../../src/application/use-cases/aggregate-results/aggregate-results.usecase.ts";
import type { AggregateResultsInput } from "../../../../src/application/use-cases/aggregate-results/aggregate-results.usecase.ts";
import { SchemaTemplateInfo } from "../../../../src/domain/models/schema-extensions.ts";
import { SchemaExtensions } from "../../../../src/domain/schema/value-objects/schema-extensions.ts";

Deno.test("AggregateResultsUseCase", async (t) => {
  let useCase: AggregateResultsUseCase;

  await t.step("Constructor", async (t) => {
    await t.step("should create instance without parameters", () => {
      useCase = AggregateResultsUseCase.createOrDefault();
      assertExists(useCase);
    });

    await t.step("should have aggregationAdapter property", () => {
      const adapter = (useCase as unknown as { aggregationAdapter: unknown })
        .aggregationAdapter;
      assertExists(adapter);
    });
  });

  await t.step("Execute Method - Input Validation", async (t) => {
    useCase = AggregateResultsUseCase.createOrDefault();

    await t.step("should reject non-array data input", async () => {
      const templateInfoResult = SchemaTemplateInfo.extract({});
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const invalidInput: AggregateResultsInput = {
        data: ("not-an-array" as unknown) as unknown[],
        templateInfo: templateInfo!,
        schema: {},
      };

      const result = await useCase.execute(invalidInput);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
        if ("expectedFormat" in result.error) {
          assertEquals(result.error.expectedFormat, "array");
        }
      }
    });

    await t.step("should reject null data input", async () => {
      const templateInfoResult = SchemaTemplateInfo.extract({});
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const invalidInput: AggregateResultsInput = {
        data: (null as unknown) as unknown[],
        templateInfo: templateInfo!,
        schema: {},
      };

      const result = await useCase.execute(invalidInput);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    });

    await t.step("should reject undefined data input", async () => {
      const templateInfoResult = SchemaTemplateInfo.extract({});
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const invalidInput: AggregateResultsInput = {
        data: (undefined as unknown) as unknown[],
        templateInfo: templateInfo!,
        schema: {},
      };

      const result = await useCase.execute(invalidInput);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
      }
    });
  });

  await t.step("Execute Method - Basic Aggregation", async (t) => {
    useCase = AggregateResultsUseCase.createOrDefault();

    await t.step("should handle empty array input", async () => {
      const templateInfoResult = SchemaTemplateInfo.extract({});
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const input: AggregateResultsInput = {
        data: [],
        templateInfo: templateInfo!,
        schema: {},
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.itemCount, 0);
        assertExists(result.data.aggregated);
        assertEquals(result.data.aggregated.items, []);
      }
    });

    await t.step("should aggregate simple data array", async () => {
      const testData = [
        { id: 1, name: "test1" },
        { id: 2, name: "test2" },
      ];

      const templateInfoResult = SchemaTemplateInfo.extract({});
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfo!,
        schema: {},
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.itemCount, 2);
        assertEquals(result.data.aggregated.items, testData);
      }
    });

    await t.step("should handle complex nested data", async () => {
      const complexData = [
        {
          id: { full: "cmd:test:one" },
          metadata: { tags: ["cli", "test"] },
          content: "test content 1",
        },
        {
          id: { full: "cmd:test:two" },
          metadata: { tags: ["cli", "debug"] },
          content: "test content 2",
        },
      ];

      const templateInfoResult = SchemaTemplateInfo.extract({});
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const input: AggregateResultsInput = {
        data: complexData,
        templateInfo: templateInfo!,
        schema: {},
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.itemCount, 2);
        assertEquals(result.data.aggregated.items, complexData);
      }
    });
  });

  await t.step("Execute Method - Frontmatter Part Handling", async (t) => {
    useCase = AggregateResultsUseCase.createOrDefault();

    await t.step("should handle x-frontmatter-part schema", async () => {
      const testData = [
        { command: "test-cmd-1", description: "Test command 1" },
        { command: "test-cmd-2", description: "Test command 2" },
      ];

      const schemaWithFrontmatterPart = {
        properties: {
          commands: {
            [SchemaExtensions.FRONTMATTER_PART]: true,
            type: "array",
          },
        },
      };

      const templateInfoResult = SchemaTemplateInfo.extract(
        schemaWithFrontmatterPart,
      );
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfo!,
        schema: schemaWithFrontmatterPart,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.itemCount, 2);
        // Basic aggregation should work, specific frontmatter-part handling
        // depends on SchemaTemplateInfo and aggregationAdapter implementation
        assertExists(result.data.aggregated);
        assertExists(
          result.data.aggregated.items || result.data.aggregated.commands,
        );
      }
    });

    await t.step(
      "should handle multiple frontmatter-part properties",
      async () => {
        const testData = [{ name: "test" }];

        const schemaWithMultipleParts = {
          properties: {
            firstPart: { [SchemaExtensions.FRONTMATTER_PART]: true },
            secondPart: { [SchemaExtensions.FRONTMATTER_PART]: true },
          },
        };

        const templateInfoResult = SchemaTemplateInfo.extract(
          schemaWithMultipleParts,
        );
        const templateInfo = templateInfoResult.ok
          ? templateInfoResult.data
          : null;

        const input: AggregateResultsInput = {
          data: testData,
          templateInfo: templateInfo!,
          schema: schemaWithMultipleParts,
        };

        const result = await useCase.execute(input);

        assertEquals(result.ok, true);
        if (result.ok) {
          // Basic aggregation should work
          assertEquals(result.data.itemCount, 1);
          assertExists(result.data.aggregated);
          assertExists(
            result.data.aggregated.items || result.data.aggregated.firstPart,
          );
        }
      },
    );
  });

  await t.step("Execute Method - Derived Fields Detection", async (t) => {
    useCase = AggregateResultsUseCase.createOrDefault();

    await t.step(
      "should detect derived fields not present in source data",
      async () => {
        const sourceData = [
          { id: 1, name: "test1" },
          { id: 2, name: "test2" },
        ];

        const templateInfoResult = SchemaTemplateInfo.extract({});
        const templateInfo = templateInfoResult.ok
          ? templateInfoResult.data
          : null;

        const input: AggregateResultsInput = {
          data: sourceData,
          templateInfo: templateInfo!,
          schema: {},
        };

        // Mock aggregationAdapter to return derived fields
        const mockAdapter =
          (useCase as unknown as { aggregationAdapter: unknown })
            .aggregationAdapter as { processAggregation: () => unknown };
        const originalProcess = mockAdapter.processAggregation;
        mockAdapter.processAggregation = () => ({
          ok: true,
          data: {
            items: sourceData,
            totalCount: 2,
            categories: ["test"], // This is a derived field
          },
        });

        const result = await useCase.execute(input);

        // Restore original method
        mockAdapter.processAggregation = originalProcess;

        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data.derivedFields);
          assertEquals(result.data.derivedFields?.totalCount, 2);
          assertEquals(result.data.derivedFields?.categories, ["test"]);
        }
      },
    );

    await t.step(
      "should return undefined derivedFields when no derived fields exist",
      async () => {
        const sourceData = [{ name: "test" }];

        const templateInfoResult = SchemaTemplateInfo.extract({});
        const templateInfo = templateInfoResult.ok
          ? templateInfoResult.data
          : null;

        const input: AggregateResultsInput = {
          data: sourceData,
          templateInfo: templateInfo!,
          schema: {},
        };

        const result = await useCase.execute(input);

        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data.derivedFields, undefined);
        }
      },
    );
  });

  await t.step("Execute Method - Error Handling", async (t) => {
    useCase = AggregateResultsUseCase.createOrDefault();

    await t.step(
      "should handle aggregationAdapter processing errors",
      async () => {
        const testData = [{ test: "data" }];

        const templateInfoResult = SchemaTemplateInfo.extract({});
        const templateInfo = templateInfoResult.ok
          ? templateInfoResult.data
          : null;

        const input: AggregateResultsInput = {
          data: testData,
          templateInfo: templateInfo!,
          schema: {},
        };

        // Mock aggregationAdapter to return error
        const mockAdapter =
          (useCase as unknown as { aggregationAdapter: unknown })
            .aggregationAdapter as { processAggregation: () => unknown };
        const originalProcess = mockAdapter.processAggregation;
        mockAdapter.processAggregation = () => ({
          ok: false,
          error: {
            kind: "ProcessingStageError",
            stage: "aggregation",
            message: "Mock aggregation error",
          },
        });

        const result = await useCase.execute(input);

        // Restore original method
        mockAdapter.processAggregation = originalProcess;

        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "ProcessingStageError");
        }
      },
    );

    await t.step("should handle unexpected exceptions", async () => {
      const testData = [{ test: "data" }];

      const templateInfoResult = SchemaTemplateInfo.extract({});
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfo!,
        schema: {},
      };

      // Mock aggregationAdapter to throw exception
      const mockAdapter =
        (useCase as unknown as { aggregationAdapter: unknown })
          .aggregationAdapter as { processAggregation: () => unknown };
      const originalProcess = mockAdapter.processAggregation;
      mockAdapter.processAggregation = () => {
        throw new Error("Unexpected error");
      };

      const result = await useCase.execute(input);

      // Restore original method
      mockAdapter.processAggregation = originalProcess;

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ProcessingStageError");
        if ("stage" in result.error) {
          assertEquals(result.error.stage, "AggregateResults");
        }
      }
    });
  });

  await t.step("Integration with SchemaAggregationAdapter", async (t) => {
    useCase = AggregateResultsUseCase.createOrDefault();

    await t.step("should properly delegate to aggregationAdapter", async () => {
      const testData = [
        { command: "test1", type: "cli" },
        { command: "test2", type: "api" },
      ];

      const testSchema = {
        properties: {
          commands: {
            type: "array",
            items: {
              type: "object",
              properties: {
                command: { type: "string" },
                type: { type: "string" },
              },
            },
          },
        },
      };

      const templateInfoResult = SchemaTemplateInfo.extract(testSchema);
      const templateInfo = templateInfoResult.ok
        ? templateInfoResult.data
        : null;

      const input: AggregateResultsInput = {
        data: testData,
        templateInfo: templateInfo!,
        schema: testSchema,
      };

      const result = await useCase.execute(input);

      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.itemCount, 2);
        assertExists(result.data.aggregated);
      }
    });
  });
});
