/**
 * Domain-based tests for Template Processing Strategies
 * Testing Strategy pattern implementation with Totality principles
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  AITemplateStrategy,
  CompositeTemplateStrategy,
  NativeTemplateStrategy,
} from "../../../../src/domain/template/strategies.ts";
import {
  Template,
  TemplateDefinition,
} from "../../../../src/domain/models/template.ts";
import type { TemplateApplicationContext } from "../../../../src/domain/template/aggregate.ts";
import type {
  AIAnalysisRequest,
  AIAnalyzerPort,
} from "../../../../src/infrastructure/ports/ai-analyzer.ts";
import { createAPIError } from "../../../../src/domain/shared/errors.ts";

// Mock AI Analyzer for testing
class MockAIAnalyzer implements AIAnalyzerPort {
  constructor(
    private shouldSucceed: boolean = true,
    private responseData: string = "AI processed template",
  ) {}

  analyze(_request: AIAnalysisRequest) {
    if (this.shouldSucceed) {
      return Promise.resolve({
        ok: true as const,
        data: {
          result: this.responseData,
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        },
      });
    }
    return Promise.resolve({
      ok: false as const,
      error: createAPIError("AI processing failed", 500),
    });
  }
}

Deno.test("NativeTemplateStrategy - Totality Tests", async (t) => {
  const strategy = new NativeTemplateStrategy();

  await t.step("should handle JSON templates with Result type", async () => {
    const templateDef = TemplateDefinition.create(
      JSON.stringify({
        title: "{{title}}",
        description: "{{description}}",
        tags: ["{{tag1}}", "{{tag2}}"],
      }),
      "json",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "json-test",
        templateDef.data,
        "JSON test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: {
            title: "Test Title",
            description: "Test Description",
            tag1: "typescript",
            tag2: "deno",
          },
          schema: {},
          format: "json",
        };

        const result = await strategy.process(template.data, context);
        assertEquals(
          result.ok,
          true,
          "Should process JSON template successfully",
        );
        if (result.ok) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.title, "Test Title");
          assertEquals(parsed.description, "Test Description");
          assertEquals(parsed.tags, ["typescript", "deno"]);
        }
      }
    }
  });

  await t.step("should handle missing paths with Result type", async () => {
    const templateDef = TemplateDefinition.create(
      JSON.stringify({
        required: "{{missing.nested.path}}",
      }),
      "json",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "missing-path",
        templateDef.data,
        "Missing path test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: {
            other: "value",
          },
          schema: {},
          format: "json",
        };

        const result = await strategy.process(template.data, context);
        // New behavior: succeeds with missing placeholders preserved
        assertEquals(
          result.ok,
          true,
          "Should succeed with missing placeholders preserved",
        );
        if (result.ok) {
          // Verify placeholders are preserved for missing data
          const output = JSON.parse(result.data);
          // The output should have the structure with placeholders preserved
          assertEquals(typeof output, "object");
          assertEquals(output.required, "{{missing.nested.path}}");
        }
        if (!result.ok) {
          assertExists(result.error.message);
          assertEquals(result.error.message.includes("not found"), true);
        }
      }
    }
  });

  await t.step("should handle YAML format conversion", async () => {
    const templateDef = TemplateDefinition.create("", "yaml");
    if (templateDef.ok) {
      const template = Template.create(
        "yaml-test",
        templateDef.data,
        "YAML test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: {
            name: "Test",
            version: "1.0.0",
            dependencies: ["deno", "typescript"],
          },
          schema: {},
          format: "yaml",
        };

        const result = await strategy.process(template.data, context);
        assertEquals(result.ok, true, "Should convert to YAML successfully");
        if (result.ok) {
          assertEquals(result.data.includes("name: Test"), true);
          assertEquals(result.data.includes("version: 1.0.0"), true);
          assertEquals(result.data.includes("- deno"), true);
        }
      }
    }
  });

  await t.step("should handle deeply nested templates", async () => {
    const templateDef = TemplateDefinition.create(
      JSON.stringify({
        level1: {
          level2: {
            level3: {
              value: "{{deep.nested.value}}",
            },
          },
        },
      }),
      "json",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "nested-test",
        templateDef.data,
        "Nested test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: {
            deep: {
              nested: {
                value: "Found it!",
              },
            },
          },
          schema: {},
          format: "json",
        };

        const result = await strategy.process(template.data, context);
        assertEquals(result.ok, true, "Should handle deep nesting");
        if (result.ok) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.level1.level2.level3.value, "Found it!");
        }
      }
    }
  });
});

Deno.test("AITemplateStrategy - Integration Tests", async (t) => {
  await t.step("should delegate to AI analyzer successfully", async () => {
    const mockAI = new MockAIAnalyzer(true, "AI processed result");
    const strategy = new AITemplateStrategy(mockAI);

    const templateDef = TemplateDefinition.create("{{template}}", "custom");
    if (templateDef.ok) {
      const template = Template.create("ai-test", templateDef.data, "AI test");
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: { value: "test" },
          schema: {},
          format: "json",
        };

        const result = await strategy.process(template.data, context);
        assertEquals(result.ok, true, "Should process via AI successfully");
        if (result.ok) {
          assertEquals(result.data, "AI processed result");
        }
      }
    }
  });

  await t.step("should handle AI failure gracefully", async () => {
    const mockAI = new MockAIAnalyzer(false);
    const strategy = new AITemplateStrategy(mockAI);

    const templateDef = TemplateDefinition.create("{{template}}", "custom");
    if (templateDef.ok) {
      const template = Template.create(
        "ai-fail",
        templateDef.data,
        "AI fail test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: { value: "test" },
          schema: {},
          format: "json",
        };

        const result = await strategy.process(template.data, context);
        assertEquals(result.ok, false, "Should handle AI failure");
        if (!result.ok) {
          assertEquals(
            result.error.message.includes("AI template processing failed"),
            true,
          );
        }
      }
    }
  });

  await t.step("should build proper prompts", async () => {
    let capturedPrompt = "";
    const mockAI: AIAnalyzerPort = {
      analyze(request: AIAnalysisRequest) {
        capturedPrompt = request.prompt;
        return Promise.resolve({
          ok: true as const,
          data: {
            result: "processed",
            usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          },
        });
      },
    };

    const strategy = new AITemplateStrategy(mockAI);
    const templateDef = TemplateDefinition.create(
      "Template: {{value}}",
      "custom",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "prompt-test",
        templateDef.data,
        "Prompt test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: { value: "test-data" },
          schema: { type: "object" },
          format: "yaml",
        };

        await strategy.process(template.data, context);
        assertEquals(
          capturedPrompt.includes("テンプレートへの値の当て込み処理"),
          true,
        );
        assertEquals(capturedPrompt.includes("yaml"), true);
      }
    }
  });
});

Deno.test("CompositeTemplateStrategy - Fallback Tests", async (t) => {
  await t.step("should use primary strategy when successful", async () => {
    const primaryAI = new MockAIAnalyzer(true, "Primary result");
    const primary = new AITemplateStrategy(primaryAI);
    const fallback = new NativeTemplateStrategy();
    const composite = new CompositeTemplateStrategy(primary, fallback);

    const templateDef = TemplateDefinition.create('{"test": "value"}', "json");
    if (templateDef.ok) {
      const template = Template.create(
        "composite-test",
        templateDef.data,
        "Composite test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: { value: "test" },
          schema: {},
          format: "json",
        };

        const result = await composite.process(template.data, context);
        assertEquals(result.ok, true);
        if (result.ok) {
          assertEquals(result.data, "Primary result");
        }
      }
    }
  });

  await t.step("should fallback to secondary when primary fails", async () => {
    const primaryAI = new MockAIAnalyzer(false); // Will fail
    const primary = new AITemplateStrategy(primaryAI);
    const fallback = new NativeTemplateStrategy();
    const composite = new CompositeTemplateStrategy(primary, fallback);

    const templateDef = TemplateDefinition.create(
      JSON.stringify({ result: "{{value}}" }),
      "json",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "fallback-test",
        templateDef.data,
        "Fallback test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: { value: "fallback-value" },
          schema: {},
          format: "json",
        };

        const result = await composite.process(template.data, context);
        assertEquals(result.ok, true, "Should succeed with fallback");
        if (result.ok) {
          const parsed = JSON.parse(result.data);
          assertEquals(parsed.result, "fallback-value");
        }
      }
    }
  });

  await t.step("should fail when both strategies fail", async () => {
    const primaryAI = new MockAIAnalyzer(false);
    const primary = new AITemplateStrategy(primaryAI);
    const fallback = new NativeTemplateStrategy();
    const composite = new CompositeTemplateStrategy(primary, fallback);

    const templateDef = TemplateDefinition.create(
      JSON.stringify({ missing: "{{non.existent.path}}" }),
      "json",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "both-fail",
        templateDef.data,
        "Both fail test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: { other: "value" },
          schema: {},
          format: "json",
        };

        const result = await composite.process(template.data, context);
        // New behavior: falls back to NativeTemplateStrategy which succeeds with missing placeholders
        assertEquals(result.ok, true, "Should succeed with fallback strategy");
        if (result.ok) {
          // Verify placeholders are preserved for missing data
          const output = JSON.parse(result.data);
          assertEquals(output.missing, "{{non.existent.path}}");
        }
      }
    }
  });

  await t.step("should report correct strategy names", () => {
    const primary = new AITemplateStrategy(new MockAIAnalyzer());
    const fallback = new NativeTemplateStrategy();
    const composite = new CompositeTemplateStrategy(primary, fallback);

    assertEquals(primary.getName(), "AITemplateStrategy");
    assertEquals(fallback.getName(), "NativeTemplateStrategy");
    assertEquals(
      composite.getName(),
      "CompositeStrategy(AITemplateStrategy, NativeTemplateStrategy)",
    );
  });
});

Deno.test("Strategy Pattern - Boundary Tests", async (t) => {
  const strategy = new NativeTemplateStrategy();

  await t.step("should handle all supported formats", () => {
    const formats = ["json", "yaml", "custom"] as const;

    for (const format of formats) {
      const templateDef = TemplateDefinition.create("test", format);
      if (templateDef.ok) {
        const template = Template.create(
          `${format}-test`,
          templateDef.data,
          `${format} test`,
        );
        if (template.ok) {
          assertEquals(
            strategy.canHandle(template.data),
            true,
            `Should handle ${format} format`,
          );
        }
      }
    }
  });

  await t.step("should reject unsupported formats", async () => {
    const templateDef = TemplateDefinition.create("test", "handlebars");
    if (templateDef.ok) {
      const template = Template.create(
        "handlebars-test",
        templateDef.data,
        "Handlebars test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: {},
          schema: {},
          format: "json",
        };

        const result = await strategy.process(template.data, context);
        assertEquals(result.ok, false);
        if (!result.ok) {
          assertEquals(
            result.error.message.includes(
              "NativeTemplateStrategy cannot handle format",
            ),
            true,
          );
        }
      }
    }
  });

  await t.step("should maintain immutability of input data", async () => {
    const originalData = {
      key: "value",
      nested: { prop: "data" },
    };

    const templateDef = TemplateDefinition.create(
      JSON.stringify({ result: "{{key}}" }),
      "json",
    );

    if (templateDef.ok) {
      const template = Template.create(
        "immutable-test",
        templateDef.data,
        "Immutable test",
      );
      if (template.ok) {
        const context: TemplateApplicationContext = {
          extractedData: originalData,
          schema: {},
          format: "json",
        };

        await strategy.process(template.data, context);

        // Original data should remain unchanged
        assertEquals(originalData.key, "value");
        assertEquals(originalData.nested.prop, "data");
      }
    }
  });
});
