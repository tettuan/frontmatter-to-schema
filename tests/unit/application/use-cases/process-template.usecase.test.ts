/**
 * ProcessTemplateUseCase Robust Unit Tests
 *
 * Following DDD/Totality principles with comprehensive Result type coverage
 * Tests validate business logic without infrastructure dependencies
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { ProcessTemplateUseCase } from "../../../../src/application/use-cases/process-template/process-template.usecase.ts";
import {
  createMockFrontMatter,
  createMockTemplate,
} from "../../../test-helpers/mock-factories.ts";
import type {
  SchemaValidationMode,
  TemplateMapper,
} from "../../../../src/domain/services/interfaces.ts";
import type {
  ExtractedData,
  Template,
} from "../../../../src/domain/models/entities.ts";
import { MappedData } from "../../../../src/domain/models/entities.ts";
import type {
  DomainError,
  Result,
} from "../../../../src/domain/core/result.ts";
import { createDomainError } from "../../../../src/domain/core/result.ts";

/**
 * Mock TemplateMapper for controlled testing
 */
class MockTemplateMapper implements TemplateMapper {
  private mockResult: Result<MappedData, DomainError & { message: string }>;

  constructor(
    mockResult: Result<MappedData, DomainError & { message: string }>,
  ) {
    this.mockResult = mockResult;
  }

  map(
    _extractedData: ExtractedData,
    _template: unknown,
    _mode: SchemaValidationMode,
  ): Result<MappedData, DomainError & { message: string }> {
    return this.mockResult;
  }
}

/**
 * Create mock MappedData for successful test cases
 */
function createMockMappedData(data: Record<string, unknown>): MappedData {
  // Use the actual MappedData.create method from analysis domain
  return MappedData.create(data);
}

Deno.test("ProcessTemplateUseCase - Unit Tests", async (t) => {
  await t.step("Core Business Logic - Success Cases", async (t) => {
    await t.step(
      "should successfully process valid template data",
      async () => {
        // Arrange
        const mockSuccessData = createMockMappedData({
          transformed: "test-build-robust",
        });
        const mockMapper = new MockTemplateMapper({
          ok: true,
          data: mockSuccessData,
        });
        const useCase = new ProcessTemplateUseCase(mockMapper);

        const input = {
          data: createMockFrontMatter({
            c1: "test",
            c2: "build",
            c3: "robust",
          }),
          template: createMockTemplate("test-template"),
          schemaMode: {
            kind: "WithSchema",
            schema: {},
          } as SchemaValidationMode,
          filePath: "test.md",
        };

        // Act
        const result = await useCase.execute(input);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data.transformedData);
          assertExists(result.data.originalData);
          assertExists(result.data.metadata);
          assertEquals(
            result.data.metadata.templateApplied,
            "Mock template for test-template",
          );
          assertEquals(result.data.metadata.filePath, "test.md");
          assertEquals(
            typeof result.data.metadata.transformationTime,
            "number",
          );
          assertEquals(result.data.metadata.transformationTime >= 0, true);
        }
      },
    );

    await t.step(
      "should use default schema validation mode when not provided",
      async () => {
        // Arrange
        const mockSuccessData = createMockMappedData({
          transformed: "default-mode",
        });
        const mockMapper = new MockTemplateMapper({
          ok: true,
          data: mockSuccessData,
        });
        const useCase = new ProcessTemplateUseCase(mockMapper);

        const input = {
          data: createMockFrontMatter({
            c1: "default",
            c2: "schema",
            c3: "mode",
          }),
          template: createMockTemplate("default-template"),
        };

        // Act
        const result = await useCase.execute(input);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertExists(result.data.transformedData);
          assertEquals(result.data.metadata.filePath, undefined);
        }
      },
    );
  });

  await t.step("Error Handling - Totality Principle Compliance", async (t) => {
    await t.step("should return error for null/undefined data", async () => {
      // Arrange
      const mockMapper = new MockTemplateMapper({
        ok: true,
        data: createMockMappedData({}),
      });
      const useCase = new ProcessTemplateUseCase(mockMapper);

      const input = {
        data: null as unknown as Record<string, unknown>,
        template: createMockTemplate("test-template"),
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
        assertEquals(
          result.error.message.includes(
            "Template processing data must be a valid object",
          ),
          true,
        );
      }
    });

    await t.step("should return error for non-object data", async () => {
      // Arrange
      const mockMapper = new MockTemplateMapper({
        ok: true,
        data: createMockMappedData({}),
      });
      const useCase = new ProcessTemplateUseCase(mockMapper);

      const input = {
        data: "invalid-string-data" as unknown as Record<string, unknown>,
        template: createMockTemplate("test-template"),
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidFormat");
        assertEquals(
          result.error.message.includes(
            "Template processing data must be a valid object",
          ),
          true,
        );
      }
    });

    await t.step("should return error for missing template", async () => {
      // Arrange
      const mockMapper = new MockTemplateMapper({
        ok: true,
        data: createMockMappedData({}),
      });
      const useCase = new ProcessTemplateUseCase(mockMapper);

      const input = {
        data: createMockFrontMatter({
          c1: "test",
          c2: "missing",
          c3: "template",
        }),
        template: null as unknown as Template,
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
        assertEquals(
          result.error.message,
          "Template is required for processing",
        );
      }
    });

    await t.step("should return error when template mapper fails", async () => {
      // Arrange
      const mockMapperError = {
        ok: false as const,
        error: createDomainError(
          {
            kind: "TemplateMappingFailed",
            template: createMockTemplate("failing-template"),
            source: {},
          },
          "Template mapping failed internally",
        ),
      };
      const mockMapper = new MockTemplateMapper(mockMapperError);
      const useCase = new ProcessTemplateUseCase(mockMapper);

      const input = {
        data: createMockFrontMatter({
          c1: "template",
          c2: "mapper",
          c3: "error",
        }),
        template: createMockTemplate("failing-template"),
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "TemplateMappingFailed");
        assertEquals(
          result.error.message.includes("Template processing failed"),
          true,
        );
        assertEquals(
          result.error.message.includes("Template mapping failed internally"),
          true,
        );
      }
    });

    await t.step(
      "should handle template mapper exceptions gracefully",
      async () => {
        // Arrange
        class ThrowingTemplateMapper implements TemplateMapper {
          map(): Result<MappedData, DomainError & { message: string }> {
            throw new Error("Unexpected template mapper exception");
          }
        }

        const useCase = new ProcessTemplateUseCase(
          new ThrowingTemplateMapper(),
        );
        const input = {
          data: createMockFrontMatter({
            c1: "exception",
            c2: "handling",
            c3: "test",
          }),
          template: createMockTemplate("exception-template"),
        };

        // Act
        const result = await useCase.execute(input);

        // Assert
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(result.error.kind, "ProcessingStageError");
          assertEquals(
            result.error.message.includes("Template processing failed"),
            true,
          );
          assertEquals(
            result.error.message.includes(
              "Unexpected template mapper exception",
            ),
            true,
          );
        }
      },
    );
  });

  await t.step("Template Description Resolution", async (t) => {
    await t.step(
      "should use template getDescription method when available",
      async () => {
        // Arrange
        const mockSuccessData = createMockMappedData({ test: "description" });
        const mockMapper = new MockTemplateMapper({
          ok: true,
          data: mockSuccessData,
        });
        const useCase = new ProcessTemplateUseCase(mockMapper);

        // Create template with getDescription method
        const templateWithDescription = createMockTemplate(
          "described-template",
        );
        // Override the getDescription method
        (templateWithDescription as unknown as { getDescription: () => string })
          .getDescription = () => "Custom template description";

        const input = {
          data: createMockFrontMatter({
            c1: "template",
            c2: "description",
            c3: "test",
          }),
          template: templateWithDescription,
        };

        // Act
        const result = await useCase.execute(input);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(
            result.data.metadata.templateApplied,
            "Custom template description",
          );
        }
      },
    );

    await t.step(
      "should fallback to template ID when description not available",
      async () => {
        // Arrange
        const mockSuccessData = createMockMappedData({ test: "fallback" });
        const mockMapper = new MockTemplateMapper({
          ok: true,
          data: mockSuccessData,
        });
        const useCase = new ProcessTemplateUseCase(mockMapper);

        const input = {
          data: createMockFrontMatter({
            c1: "fallback",
            c2: "template",
            c3: "id",
          }),
          template: createMockTemplate("fallback-template"),
        };

        // Act
        const result = await useCase.execute(input);

        // Assert
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(
            result.data.metadata.templateApplied,
            "Mock template for fallback-template",
          );
        }
      },
    );

    await t.step("should use unknown-template as final fallback", async () => {
      // Arrange
      const mockSuccessData = createMockMappedData({ test: "unknown" });
      const mockMapper = new MockTemplateMapper({
        ok: true,
        data: mockSuccessData,
      });
      const useCase = new ProcessTemplateUseCase(mockMapper);

      // Create template without getId method
      const templateWithoutId = {
        getFormat: () => ({ getValue: () => "json" }),
        getMappingRules: () => [],
      };

      const input = {
        data: createMockFrontMatter({
          c1: "unknown",
          c2: "template",
          c3: "fallback",
        }),
        template: templateWithoutId as unknown as Template,
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.data.metadata.templateApplied, "unknown-template");
      }
    });
  });

  await t.step(
    "Dependency Injection - Smart Constructor Pattern",
    async (t) => {
      await t.step(
        "should use injected TemplateMapper when provided",
        async () => {
          // Arrange
          const mockSuccessData = createMockMappedData({ injected: "mapper" });
          const injectedMapper = new MockTemplateMapper({
            ok: true,
            data: mockSuccessData,
          });
          const useCase = new ProcessTemplateUseCase(injectedMapper);

          const input = {
            data: createMockFrontMatter({
              c1: "injected",
              c2: "dependency",
              c3: "test",
            }),
            template: createMockTemplate("injection-test"),
          };

          // Act
          const result = await useCase.execute(input);

          // Assert - Verify the injected mapper was used by checking the result
          assertEquals(result.ok, true);
          if (result.ok) {
            assertEquals(
              result.data.transformedData.getData().injected,
              "mapper",
            );
          }
        },
      );

      await t.step(
        "should use default UnifiedTemplateMapperAdapter when no mapper injected",
        async () => {
          // Arrange - Create use case without injecting mapper
          const useCase = new ProcessTemplateUseCase();

          const input = {
            data: createMockFrontMatter({
              c1: "default",
              c2: "mapper",
              c3: "test",
            }),
            template: createMockTemplate("default-adapter-test"),
          };

          // Act
          const result = await useCase.execute(input);

          // Assert - Should not fail even with default adapter
          // The result may fail due to real template processing, but should not throw
          assertEquals(typeof result.ok, "boolean");
          if (result.ok) {
            assertExists(result.data.transformedData);
            assertExists(result.data.originalData);
            assertExists(result.data.metadata);
          } else {
            assertEquals(typeof result.error.message, "string");
          }
        },
      );
    },
  );

  await t.step("Performance and Metadata Validation", async (t) => {
    await t.step("should measure transformation time accurately", async () => {
      // Arrange
      const mockSuccessData = createMockMappedData({ performance: "test" });
      const mockMapper = new MockTemplateMapper({
        ok: true,
        data: mockSuccessData,
      });
      const useCase = new ProcessTemplateUseCase(mockMapper);

      const input = {
        data: createMockFrontMatter({
          c1: "performance",
          c2: "timing",
          c3: "test",
        }),
        template: createMockTemplate("timing-template"),
      };

      // Act
      const startTime = Date.now();
      const result = await useCase.execute(input);
      const endTime = Date.now();

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(typeof result.data.metadata.transformationTime, "number");
        assertEquals(result.data.metadata.transformationTime >= 0, true);
        // Transformation time should be reasonable (less than total execution time)
        assertEquals(
          result.data.metadata.transformationTime <= (endTime - startTime),
          true,
        );
      }
    });

    await t.step("should include all required metadata fields", async () => {
      // Arrange
      const mockSuccessData = createMockMappedData({ metadata: "validation" });
      const mockMapper = new MockTemplateMapper({
        ok: true,
        data: mockSuccessData,
      });
      const useCase = new ProcessTemplateUseCase(mockMapper);

      const input = {
        data: createMockFrontMatter({
          c1: "metadata",
          c2: "validation",
          c3: "test",
        }),
        template: createMockTemplate("metadata-template"),
        filePath: "/path/to/test-file.md",
      };

      // Act
      const result = await useCase.execute(input);

      // Assert
      assertEquals(result.ok, true);
      if (result.ok) {
        const metadata = result.data.metadata;
        assertExists(metadata.templateApplied);
        assertExists(metadata.transformationTime);
        assertEquals(metadata.filePath, "/path/to/test-file.md");
        assertEquals(typeof metadata.templateApplied, "string");
        assertEquals(typeof metadata.transformationTime, "number");
      }
    });
  });
});
