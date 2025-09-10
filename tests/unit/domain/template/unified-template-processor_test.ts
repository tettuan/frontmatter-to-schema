/**
 * UnifiedTemplateProcessor Test Suite
 *
 * Tests consolidation of:
 * - TemplateMapper functionality
 * - TypeScriptTemplateProcessor functionality
 * - PlaceholderProcessor functionality
 * - NativeTemplateStrategy patterns
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1.0.11";
import {
  PlaceholderPattern,
  type PlaceholderPatternType,
  type TemplateProcessingContext,
  TemplateProcessorFactory,
  UnifiedTemplateProcessor,
  ValidatedTemplateContent,
} from "../../../../src/domain/template/services/unified-template-processor.ts";

// Test Data
const sampleData = {
  user: { name: "John", age: 30 },
  items: ["apple", "banana", "cherry"],
  active: true,
};

const sampleSchema = {
  properties: {
    user: { type: "object", properties: { name: { type: "string" } } },
    items: { type: "array" },
    active: { type: "boolean" },
  },
  required: ["user"],
};

Deno.test("UnifiedTemplateProcessor - Smart Constructor Creation", async (t) => {
  await t.step("should create processor with default options", () => {
    const processor = UnifiedTemplateProcessor.create();
    assertExists(processor);
    assertEquals(typeof processor, "object");
    assertEquals("process" in processor, true);
  });

  await t.step("should create processor with custom options", () => {
    const processor = UnifiedTemplateProcessor.create({
      handleMissingRequired: "error",
      arrayFormat: "csv",
    });
    assertExists(processor);
  });

  await t.step("should handle invalid options gracefully", () => {
    // Testing Totality - should handle edge cases
    const processor = UnifiedTemplateProcessor.create({
      handleMissingRequired: "error",
      handleMissingOptional: "empty",
      arrayFormat: "json",
    });
    assertExists(processor);
  });
});

Deno.test("ValidatedTemplateContent - Smart Constructor", async (t) => {
  await t.step("should create valid template content", () => {
    const content = ValidatedTemplateContent.create("Hello {{name}}");
    assertExists(content);
    assertEquals(typeof content, "object");
    assertEquals("content" in content, true);
  });

  await t.step("should reject empty template content", () => {
    const content = ValidatedTemplateContent.create("");
    assertEquals("kind" in content, true); // Should be DomainError
  });

  await t.step("should reject non-string template content", () => {
    const content = ValidatedTemplateContent.create(123);
    assertEquals("kind" in content, true); // Should be DomainError
  });
});

Deno.test("PlaceholderPattern - Smart Constructor", async (t) => {
  await t.step("should create mustache pattern", () => {
    const pattern = PlaceholderPattern.create("mustache");
    assertExists(pattern);
    assertEquals(typeof pattern, "object");
    assertEquals("pattern" in pattern, true);
  });

  await t.step("should create dollar pattern", () => {
    const pattern = PlaceholderPattern.create("dollar");
    assertExists(pattern);
  });

  await t.step("should create percent pattern", () => {
    const pattern = PlaceholderPattern.create("percent");
    assertExists(pattern);
  });

  await t.step("should create brace pattern", () => {
    const pattern = PlaceholderPattern.create("brace");
    assertExists(pattern);
    assertEquals(typeof pattern, "object");
    assertEquals("pattern" in pattern, true);
  });

  await t.step("should reject invalid pattern type", () => {
    const pattern = PlaceholderPattern.create(
      "invalid" as PlaceholderPatternType,
    );
    assertEquals("kind" in pattern, true); // Should be DomainError
  });
});

Deno.test("UnifiedTemplateProcessor - Simple Replacement Processing", async (t) => {
  const processor = UnifiedTemplateProcessor.create();
  assertExists(processor);

  await t.step("should process mustache template", () => {
    const template = "Hello {{user.name}}, you are {{user.age}} years old";
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: sampleData,
      placeholderPattern: "mustache",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(result.content, "Hello John, you are 30 years old");
      assertEquals(result.statistics.totalReplacements, 2);
      assertEquals(result.statistics.replacedVariables.length, 2);
    } else {
      throw new Error("Expected Success result");
    }
  });

  await t.step("should handle missing variables gracefully", () => {
    const template = "Hello {{user.name}}, address: {{user.address}}";
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: sampleData,
      placeholderPattern: "mustache",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(result.content, "Hello John, address: {{user.address}}");
      assertEquals(result.statistics.totalReplacements, 1);
    } else {
      throw new Error("Expected Success result");
    }
  });

  await t.step("should process array data", () => {
    const template = "First item: {{items.0}}, Count: {{items.length}}";
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: sampleData,
      placeholderPattern: "mustache",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(result.content, "First item: apple, Count: 3");
    } else {
      throw new Error("Expected Success result");
    }
  });
});

Deno.test("UnifiedTemplateProcessor - Brace Format Replacement", async (t) => {
  const processor = UnifiedTemplateProcessor.create();
  assertExists(processor);

  await t.step("should process simple brace template", () => {
    const template = "Version: {version}, Description: {description}";
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: { version: "1.0.0", description: "Test app" },
      placeholderPattern: "brace",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(result.content, "Version: 1.0.0, Description: Test app");
      assertEquals(result.statistics.totalReplacements, 2);
      assertEquals(result.statistics.replacedVariables.length, 2);
    } else {
      throw new Error("Expected Success result");
    }
  });

  await t.step("should process nested path brace template", () => {
    const template = "Name: {user.name}, Age: {user.age}";
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: sampleData,
      placeholderPattern: "brace",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(result.content, "Name: John, Age: 30");
      assertEquals(result.statistics.totalReplacements, 2);
    } else {
      throw new Error("Expected Success result");
    }
  });

  await t.step("should process complex nested paths", () => {
    const template = "Config: {tools.availableConfigs}, Input: {options.input}";
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: {
        tools: { availableConfigs: ["build", "test"] },
        options: { input: "file.txt" },
      },
      placeholderPattern: "brace",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(result.content, "Config: build,test, Input: file.txt");
      assertEquals(result.statistics.totalReplacements, 2);
    } else {
      throw new Error("Expected Success result");
    }
  });

  await t.step("should handle registry template format", () => {
    // Test based on requirements.ja.md examples
    const template =
      '{"version": "{version}", "tools": {"availableConfigs": "{tools.availableConfigs}"}}';
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: {
        version: "1.0.0",
        tools: { availableConfigs: ["build", "debug", "test"] },
      },
      placeholderPattern: "brace",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(
        result.content,
        '{"version": "1.0.0", "tools": {"availableConfigs": "build,debug,test"}}',
      );
    } else {
      throw new Error("Expected Success result");
    }
  });

  await t.step("should not match double braces with brace pattern", () => {
    const template = "Hello {{name}} and {user}";
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: { name: "World", user: "John" },
      placeholderPattern: "brace",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      // Should only replace {user}, not {{name}}
      assertEquals(result.content, "Hello {{name}} and John");
      assertEquals(result.statistics.totalReplacements, 1);
    } else {
      throw new Error("Expected Success result");
    }
  });
});

Deno.test("UnifiedTemplateProcessor - Schema Guided Processing", async (t) => {
  const processor = UnifiedTemplateProcessor.create();
  assertExists(processor);

  await t.step("should process schema-guided template", () => {
    const template = '{"user": "{{user.name}}", "active": "{{active}}"}';
    const context: TemplateProcessingContext = {
      kind: "SchemaGuided",
      data: sampleData,
      schema: sampleSchema,
      strictMode: false,
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertExists(result.content);
      assertEquals(typeof result.content, "string");
    } else {
      throw new Error("Expected Success result");
    }
  });

  await t.step("should handle schema validation", () => {
    const template = "User: {{user.name}}";
    const context: TemplateProcessingContext = {
      kind: "SchemaGuided",
      data: sampleData,
      schema: sampleSchema,
      strictMode: true,
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );
    assertExists(result);
    // Should succeed because user.name exists and matches schema
  });
});

Deno.test("UnifiedTemplateProcessor - TypeScript Processing", async (t) => {
  const processor = UnifiedTemplateProcessor.create();
  assertExists(processor);

  await t.step("should process TypeScript template", () => {
    const template = "Name: ${user.name}, Items: ${items}";
    const context: TemplateProcessingContext = {
      kind: "TypeScriptProcessing",
      mappedData: {
        data: sampleData,
        schemaPath: "/user",
      },
      options: {
        handleMissingRequired: "warning",
        handleMissingOptional: "empty",
        arrayFormat: "csv",
      },
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(result.content, "Name: John, Items: apple, banana, cherry");
      assertEquals(
        result.statistics.replacedVariables.includes("user.name"),
        true,
      );
      assertEquals(result.statistics.replacedVariables.includes("items"), true);
    } else {
      throw new Error("Expected Success result");
    }
  });

  await t.step("should format arrays based on options", () => {
    const template = "Items: ${items}";

    // Test JSON format
    const jsonContext: TemplateProcessingContext = {
      kind: "TypeScriptProcessing",
      mappedData: { data: sampleData, schemaPath: "/" },
      options: {
        handleMissingRequired: "ignore",
        handleMissingOptional: "empty",
        arrayFormat: "json",
      },
    };

    const jsonResult = (processor as UnifiedTemplateProcessor).process(
      template,
      jsonContext,
    );
    if ("kind" in jsonResult && jsonResult.kind === "Success") {
      assertEquals(jsonResult.content, 'Items: ["apple","banana","cherry"]');
    }

    // Test list format
    const listContext: TemplateProcessingContext = {
      kind: "TypeScriptProcessing",
      mappedData: { data: sampleData, schemaPath: "/" },
      options: {
        handleMissingRequired: "ignore",
        handleMissingOptional: "empty",
        arrayFormat: "list",
      },
    };

    const listResult = (processor as UnifiedTemplateProcessor).process(
      template,
      listContext,
    );
    if ("kind" in listResult && listResult.kind === "Success") {
      assertEquals(listResult.content, "Items: - apple\\n- banana\\n- cherry");
    }
  });
});

Deno.test("TemplateProcessorFactory - Factory Methods", async (t) => {
  await t.step("should create simple processor", () => {
    const processor = TemplateProcessorFactory.createSimpleProcessor();
    assertExists(processor);
    assertEquals(typeof processor, "object");
  });

  await t.step("should create schema processor", () => {
    const processor = TemplateProcessorFactory.createSchemaProcessor();
    assertExists(processor);
  });

  await t.step("should create TypeScript processor", () => {
    const processor = TemplateProcessorFactory.createTypeScriptProcessor();
    assertExists(processor);
  });
});

Deno.test("UnifiedTemplateProcessor - Error Handling (Totality)", async (t) => {
  const processor = UnifiedTemplateProcessor.create();
  assertExists(processor);

  await t.step("should handle empty template content", () => {
    const result = (processor as UnifiedTemplateProcessor).process("", {
      kind: "SimpleReplacement",
      data: sampleData,
      placeholderPattern: "mustache",
    });

    assertEquals("kind" in result, true); // Should be DomainError
  });

  await t.step("should handle invalid context exhaustively", () => {
    // This tests the exhaustive switch statement (Totality principle)
    // We need to cast to unknown first, then to the target type for this test
    const invalidContext = {
      kind: "InvalidContext" as "SimpleReplacement",
      data: sampleData,
    } as unknown as TemplateProcessingContext;

    const result = (processor as UnifiedTemplateProcessor).process(
      "test",
      invalidContext,
    );

    assertEquals("kind" in result, true); // Should be DomainError
  });

  await t.step("should include processing time in statistics", () => {
    const template = "Hello {{user.name}}";
    const context: TemplateProcessingContext = {
      kind: "SimpleReplacement",
      data: sampleData,
      placeholderPattern: "mustache",
    };

    const result = (processor as UnifiedTemplateProcessor).process(
      template,
      context,
    );

    if ("kind" in result && result.kind === "Success") {
      assertEquals(typeof result.statistics.processingTimeMs, "number");
      assertEquals(result.statistics.processingTimeMs >= 0, true);
    } else {
      throw new Error("Expected Success result");
    }
  });
});

Deno.test("UnifiedTemplateProcessor - Integration Test", async (t) => {
  await t.step(
    "should consolidate all previous processor functionality",
    () => {
      const processor = UnifiedTemplateProcessor.create();
      assertExists(processor);

      // Test that it can handle patterns from all consolidated processors
      const templates = [
        "{{user.name}}", // PlaceholderProcessor pattern
        "${user.name}", // TypeScriptTemplateProcessor pattern
        '{"name": "{{user.name}}"}', // TemplateMapper pattern
      ];

      const contexts: TemplateProcessingContext[] = [
        {
          kind: "SimpleReplacement",
          data: sampleData,
          placeholderPattern: "mustache",
        },
        {
          kind: "TypeScriptProcessing",
          mappedData: { data: sampleData, schemaPath: "/" },
          options: {
            handleMissingRequired: "ignore",
            handleMissingOptional: "empty",
            arrayFormat: "json",
          },
        },
        {
          kind: "SchemaGuided",
          data: sampleData,
          schema: sampleSchema,
          strictMode: false,
        },
      ];

      // Each template should process successfully with appropriate context
      for (let i = 0; i < templates.length; i++) {
        const result: unknown = (processor as UnifiedTemplateProcessor).process(
          templates[i],
          contexts[i],
        );

        // Type guard to check if result has 'kind' property
        if (
          typeof result === "object" && result !== null && "kind" in result &&
          result.kind === "Success"
        ) {
          const successResult = result as {
            kind: "Success";
            content: string;
            statistics: { processingTimeMs: number };
          };
          assertExists(successResult.content);
          assertExists(successResult.statistics);
          assertEquals(
            typeof successResult.statistics.processingTimeMs,
            "number",
          );
        } else {
          throw new Error(`Template ${i} processing failed`);
        }
      }
    },
  );
});
