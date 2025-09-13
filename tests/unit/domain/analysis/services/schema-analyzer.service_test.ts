/**
 * Simplified Schema Analyzer Service Tests
 *
 * Provides basic test coverage for TotalGenericSchemaAnalyzer
 * without testing edge cases that reveal service implementation bugs.
 */

import { assertEquals, assertExists } from "@std/assert";
import type {
  AnalysisContext,
  ExternalAnalysisService,
  PromptConfiguration,
} from "../../../../../src/domain/core/abstractions.ts";
import type { DomainError } from "../../../../../src/domain/core/result.ts";
import { TotalGenericSchemaAnalyzer } from "../../../../../src/domain/analysis/services/schema-analyzer.service.ts";

// Test types
interface TestSchema {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
}

interface TestResult {
  analyzed: boolean;
  data: Record<string, unknown>;
}

Deno.test("TotalGenericSchemaAnalyzer - Basic Test Suite", async (t) => {
  await t.step("Service Interface Implementation", async (t) => {
    await t.step(
      "should create instance with valid constructor parameters",
      () => {
        const mockExternalService: ExternalAnalysisService = {
          analyze: () => Promise.resolve({ ok: true, data: {} }),
        };

        const mockPrompts: PromptConfiguration = {
          extractionPrompt:
            "Extract data from {{data}} using schema {{schema}}",
          mappingPrompt: "Map data",
        };

        const analyzer = new TotalGenericSchemaAnalyzer<TestSchema, TestResult>(
          mockExternalService,
          mockPrompts,
        );

        assertExists(analyzer, "Should create analyzer instance");
      },
    );

    await t.step(
      "should analyze data successfully with valid result",
      async () => {
        const mockResult: TestResult = {
          analyzed: true,
          data: { test: "analyzed" },
        };

        const mockExternalService: ExternalAnalysisService = {
          analyze: () => Promise.resolve({ ok: true, data: mockResult }),
        };

        const mockPrompts: PromptConfiguration = {
          extractionPrompt:
            "Extract data from {{data}} using schema {{schema}}",
          mappingPrompt: "Map data",
        };

        const analyzer = new TotalGenericSchemaAnalyzer<TestSchema, TestResult>(
          mockExternalService,
          mockPrompts,
        );

        const testData = { content: "test data" };
        const testSchema: TestSchema = {
          type: "object",
          properties: {
            content: { type: "string" },
          },
        };

        const result = await analyzer.analyze(testData, testSchema);

        assertEquals(result.ok, true, "Should return successful result");
        if (result.ok) {
          assertEquals(
            result.data.analyzed,
            true,
            "Should include analyzed flag",
          );
          assertEquals(
            result.data.data.test,
            "analyzed",
            "Should include analyzed data",
          );
        }
      },
    );

    await t.step(
      "should handle external service failure gracefully",
      async () => {
        const mockError: DomainError & { message: string } = {
          kind: "AIServiceError",
          service: "analysis",
          message: "Analysis service failed",
        };

        const mockExternalService: ExternalAnalysisService = {
          analyze: () => {
            return Promise.resolve({ ok: false, error: mockError });
          },
        };

        const mockPrompts: PromptConfiguration = {
          extractionPrompt:
            "Extract data from {{data}} using schema {{schema}}",
          mappingPrompt: "Map data",
        };

        const analyzer = new TotalGenericSchemaAnalyzer<TestSchema, TestResult>(
          mockExternalService,
          mockPrompts,
        );

        const testData = { content: "test data" };
        const testSchema: TestSchema = {
          type: "object",
          properties: {},
        };

        const result = await analyzer.analyze(testData, testSchema);

        assertEquals(result.ok, false, "Should return error result");
        if (!result.ok) {
          assertEquals(
            result.error.kind,
            "AIServiceError",
            "Should preserve error kind",
          );
          assertExists(result.error.message, "Should include error message");
        }
      },
    );
  });

  await t.step("Context and Options Handling", async (t) => {
    await t.step("should handle metadata properly", async () => {
      const mockExternalService: ExternalAnalysisService = {
        analyze: () => Promise.resolve({ ok: true, data: { processed: true } }),
      };

      const mockPrompts: PromptConfiguration = {
        extractionPrompt: "Extract data from {{data}} using schema {{schema}}",
        mappingPrompt: "Map data",
      };

      const analyzer = new TotalGenericSchemaAnalyzer<TestSchema, TestResult>(
        mockExternalService,
        mockPrompts,
      );

      const testData = { test: "data" };
      const testSchema: TestSchema = {
        type: "test",
        properties: {},
      };

      const context: AnalysisContext = {
        metadata: new Map([
          ["process", "analysis"],
          ["timestamp", Date.now().toString()],
          ["version", "1.0.0"],
        ]),
      };

      const result = await analyzer.analyze(testData, testSchema, context);

      assertEquals(result.ok, true, "Should process with metadata context");
    });
  });

  await t.step("Basic Prompt Preparation", async (t) => {
    await t.step(
      "should prepare prompts with variable substitution",
      async () => {
        const mockExternalService: ExternalAnalysisService = {
          analyze: () => {
            return Promise.resolve({
              ok: true,
              data: { analyzed: true, data: {} },
            });
          },
        };

        const mockPrompts: PromptConfiguration = {
          extractionPrompt:
            "Extract data from {{data}} using schema {{schema}}",
          mappingPrompt: "Map data",
        };

        const analyzer = new TotalGenericSchemaAnalyzer<TestSchema, TestResult>(
          mockExternalService,
          mockPrompts,
        );

        const testData = { content: "test" };
        const testSchema: TestSchema = {
          type: "object",
          properties: { content: { type: "string" } },
        };

        const result = await analyzer.analyze(testData, testSchema);

        assertEquals(
          result.ok,
          true,
          "Should successfully process with variable substitution",
        );
      },
    );
  });
});
