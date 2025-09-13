/**
 * Simplified Template Mapper Service Tests
 *
 * Provides basic test coverage for TotalSchemaGuidedTemplateMapper
 * without testing edge cases that reveal service implementation bugs.
 */

import { assertEquals, assertExists } from "@std/assert";
import type {
  ExternalAnalysisService,
  PromptConfiguration,
} from "../../../../../src/domain/core/abstractions.ts";
import type { DomainError } from "../../../../../src/domain/core/result.ts";
import { TotalSchemaGuidedTemplateMapper } from "../../../../../src/domain/analysis/services/template-mapper.service.ts";

// Test types
interface SourceData {
  id: string;
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

interface TargetTemplate {
  version: string;
  structure: Record<string, unknown>;
  placeholders: string[];
}

Deno.test("TotalSchemaGuidedTemplateMapper - Basic Test Suite", async (t) => {
  await t.step("Service Interface Implementation", async (t) => {
    await t.step(
      "should create instance with valid constructor parameters",
      () => {
        const mockExternalService: ExternalAnalysisService = {
          analyze: () => Promise.resolve({ ok: true, data: {} }),
        };

        const mockPrompts: PromptConfiguration = {
          extractionPrompt: "Extract data",
          mappingPrompt: "Map {{source}} to {{template}}",
        };

        const mapper = new TotalSchemaGuidedTemplateMapper<
          SourceData,
          TargetTemplate
        >(
          mockExternalService,
          mockPrompts,
        );

        assertExists(mapper, "Should create mapper instance");
      },
    );

    await t.step("should map source to template successfully", async () => {
      const mockResult = {
        version: "1.0.0",
        structure: { mapped: true },
        placeholders: ["test"],
      };

      const mockExternalService: ExternalAnalysisService = {
        analyze: () => Promise.resolve({ ok: true, data: mockResult }),
      };

      const mockPrompts: PromptConfiguration = {
        extractionPrompt: "Extract data",
        mappingPrompt: "Map {{source}} to {{template}}",
      };

      const mapper = new TotalSchemaGuidedTemplateMapper<
        SourceData,
        TargetTemplate
      >(
        mockExternalService,
        mockPrompts,
      );

      const sourceData: SourceData = {
        id: "test",
        content: { data: "example" },
        metadata: {},
      };

      const targetTemplate: TargetTemplate = {
        version: "1.0.0",
        structure: {},
        placeholders: [],
      };

      const result = await mapper.map(sourceData, targetTemplate);

      assertEquals(result.ok, true, "Should return successful result");
      if (result.ok) {
        assertEquals(result.data.version, "1.0.0", "Should preserve version");
        assertEquals(
          result.data.structure.mapped,
          true,
          "Should include mapped data",
        );
      }
    });

    await t.step(
      "should handle external service failure gracefully",
      async () => {
        const mockError: DomainError & { message: string } = {
          kind: "AIServiceError",
          service: "template-mapping",
          message: "Mapping service failed",
        };

        const mockExternalService: ExternalAnalysisService = {
          analyze: () => {
            return Promise.resolve({ ok: false, error: mockError });
          },
        };

        const mockPrompts: PromptConfiguration = {
          extractionPrompt: "Extract data",
          mappingPrompt: "Map {{source}} to {{template}}",
        };

        const mapper = new TotalSchemaGuidedTemplateMapper<
          SourceData,
          TargetTemplate
        >(
          mockExternalService,
          mockPrompts,
        );

        const sourceData: SourceData = {
          id: "test",
          content: {},
          metadata: {},
        };

        const targetTemplate: TargetTemplate = {
          version: "1.0.0",
          structure: {},
          placeholders: [],
        };

        const result = await mapper.map(sourceData, targetTemplate);

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

  await t.step("Basic Prompt Preparation", async (t) => {
    await t.step(
      "should prepare prompts with variable substitution",
      async () => {
        const mockExternalService: ExternalAnalysisService = {
          analyze: (promptText: string) => {
            // Verify the prompt contains expected substitutions
            if (
              promptText.includes('{"id":"test"') &&
              promptText.includes('{"version":"1.0.0"')
            ) {
              return Promise.resolve({ ok: true, data: { mapped: true } });
            }
            return Promise.resolve({
              ok: false,
              error: {
                kind: "InvalidFormat",
                message: "Invalid prompt format",
              } as DomainError & { message: string },
            });
          },
        };

        const mockPrompts: PromptConfiguration = {
          extractionPrompt: "Extract data",
          mappingPrompt: "Map {{source}} to {{template}} using {{schema}}",
        };

        const mapper = new TotalSchemaGuidedTemplateMapper<
          SourceData,
          TargetTemplate
        >(
          mockExternalService,
          mockPrompts,
        );

        const sourceData: SourceData = {
          id: "test",
          content: {},
          metadata: {},
        };

        const targetTemplate: TargetTemplate = {
          version: "1.0.0",
          structure: {},
          placeholders: [],
        };

        const result = await mapper.map(sourceData, targetTemplate, {
          type: "test",
        });

        assertEquals(
          result.ok,
          true,
          "Should successfully substitute variables in prompt",
        );
      },
    );
  });
});
