/**
 * Comprehensive tests for PlaceholderProcessor
 * Target coverage: >80%
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  PlaceholderPattern,
  type PlaceholderPatternType,
  type PlaceholderProcessingContext,
  PlaceholderProcessor,
  PlaceholderProcessorFactory,
  PlaceholderUtils,
} from "../../../src/domain/template/placeholder-processor.ts";

Deno.test("PlaceholderPattern", async (t) => {
  await t.step("creates mustache pattern successfully", () => {
    const result = PlaceholderPattern.create("mustache");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getName(), "mustache");
      assertExists(result.data.getPattern());
    }
  });

  await t.step("creates dollar pattern successfully", () => {
    const result = PlaceholderPattern.create("dollar");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getName(), "dollar");
      assertExists(result.data.getPattern());
    }
  });

  await t.step("creates percent pattern successfully", () => {
    const result = PlaceholderPattern.create("percent");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.getName(), "percent");
      assertExists(result.data.getPattern());
    }
  });

  await t.step("fails with invalid pattern type", () => {
    const result = PlaceholderPattern.create(
      "invalid" as PlaceholderPatternType,
    );
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });
});

Deno.test("PlaceholderProcessor - Basic String Replacement", async (t) => {
  const processor = new PlaceholderProcessor();

  await t.step("replaces single mustache placeholder", () => {
    const context: PlaceholderProcessingContext = {
      data: { name: "John", age: 30 },
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("Hello {{name}}!", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "Hello John!");
      assertEquals(result.data.replacedCount, 1);
    }
  });

  await t.step("replaces multiple placeholders", () => {
    const context: PlaceholderProcessingContext = {
      data: { name: "Alice", age: 25 },
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("{{name}} is {{age}} years old", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "Alice is 25 years old");
      assertEquals(result.data.replacedCount, 2);
    }
  });

  await t.step("handles dollar pattern", () => {
    const context: PlaceholderProcessingContext = {
      data: { var: "value" },
      patternType: "dollar",
      strictMode: false,
    };

    const result = processor.process("Variable: ${var}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "Variable: value");
    }
  });

  await t.step("handles percent pattern", () => {
    const context: PlaceholderProcessingContext = {
      data: { key: "data" },
      patternType: "percent",
      strictMode: false,
    };

    const result = processor.process("Key: %key%", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "Key: data");
    }
  });
});

Deno.test("PlaceholderProcessor - Nested Path Resolution", async (t) => {
  const processor = new PlaceholderProcessor();

  await t.step("resolves nested object paths", () => {
    const context: PlaceholderProcessingContext = {
      data: {
        user: {
          profile: {
            name: "Bob",
            email: "bob@example.com",
          },
        },
      },
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("Email: {{user.profile.email}}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "Email: bob@example.com");
    }
  });

  await t.step("handles deeply nested paths", () => {
    const context: PlaceholderProcessingContext = {
      data: {
        a: { b: { c: { d: { e: "deep-value" } } } },
      },
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("{{a.b.c.d.e}}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "deep-value");
    }
  });
});

Deno.test("PlaceholderProcessor - Complex Data Structures", async (t) => {
  const processor = new PlaceholderProcessor();

  await t.step("processes objects recursively", () => {
    const context: PlaceholderProcessingContext = {
      data: { name: "Test", value: 123 },
      patternType: "mustache",
      strictMode: false,
    };

    const template = {
      title: "{{name}}",
      count: "{{value}}",
      nested: {
        display: "{{name}} - {{value}}",
      },
    };

    const result = processor.process(template, context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      const processed = result.data.processedContent as Record<string, unknown>;
      assertEquals(processed.title, "Test");
      assertEquals(processed.count, "123");
      const nested = processed.nested as Record<string, unknown>;
      assertEquals(nested.display, "Test - 123");
    }
  });

  await t.step("processes arrays", () => {
    const context: PlaceholderProcessingContext = {
      data: { item: "value" },
      patternType: "mustache",
      strictMode: false,
    };

    const template = ["{{item}}", "literal", "{{item}}"];
    const result = processor.process(template, context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      const processed = result.data.processedContent as string[];
      assertEquals(processed, ["value", "literal", "value"]);
    }
  });

  await t.step("handles mixed nested structures", () => {
    const context: PlaceholderProcessingContext = {
      data: { x: "X", y: "Y" },
      patternType: "mustache",
      strictMode: false,
    };

    const template = {
      arr: ["{{x}}", { inner: "{{y}}" }],
      obj: { value: "{{x}}" },
    };

    const result = processor.process(template, context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      const processed = result.data.processedContent as Record<string, unknown>;
      const arr = processed.arr as unknown[];
      assertEquals(arr[0], "X");
      const arr1 = arr[1] as Record<string, unknown>;
      assertEquals(arr1.inner, "Y");
      const obj = processed.obj as Record<string, unknown>;
      assertEquals(obj.value, "X");
    }
  });
});

Deno.test("PlaceholderProcessor - Missing Placeholders", async (t) => {
  const processor = new PlaceholderProcessor();

  await t.step("reports partial success for missing placeholders", () => {
    const context: PlaceholderProcessingContext = {
      data: { present: "here" },
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("{{present}} and {{missing}}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "PartialSuccess") {
      assertEquals(result.data.processedContent, "here and {{missing}}");
      assertEquals(result.data.missingPlaceholders, ["missing"]);
    }
  });

  await t.step("fails in strict mode with missing placeholders", () => {
    const context: PlaceholderProcessingContext = {
      data: { present: "here" },
      patternType: "mustache",
      strictMode: true,
    };

    const result = processor.process("{{present}} and {{missing}}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Failure") {
      assertEquals(result.data.error.kind, "NotFound");
    }
  });

  await t.step("handles multiple missing placeholders", () => {
    const context: PlaceholderProcessingContext = {
      data: {},
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("{{a}} {{b}} {{c}}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "PartialSuccess") {
      assertEquals(result.data.missingPlaceholders.sort(), ["a", "b", "c"]);
    }
  });
});

Deno.test("PlaceholderProcessor - Edge Cases", async (t) => {
  const processor = new PlaceholderProcessor();

  await t.step("handles empty strings", () => {
    const context: PlaceholderProcessingContext = {
      data: {},
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "");
      assertEquals(result.data.replacedCount, 0);
    }
  });

  await t.step("handles null values", () => {
    const context: PlaceholderProcessingContext = {
      data: { nullValue: null },
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("Value: {{nullValue}}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "Value: ");
    }
  });

  await t.step("handles undefined values", () => {
    const context: PlaceholderProcessingContext = {
      data: { undefinedValue: undefined },
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("Value: {{undefinedValue}}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "Value: ");
    }
  });

  await t.step("preserves primitive values", () => {
    const context: PlaceholderProcessingContext = {
      data: {},
      patternType: "mustache",
      strictMode: false,
    };

    assertEquals(processor.process(42, context).ok, true);
    assertEquals(processor.process(true, context).ok, true);
    assertEquals(processor.process(null, context).ok, true);
  });

  await t.step("handles single placeholder as entire value", () => {
    const context: PlaceholderProcessingContext = {
      data: { value: "replacement" },
      patternType: "mustache",
      strictMode: false,
    };

    const result = processor.process("{{value}}", context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      assertEquals(result.data.processedContent, "replacement");
    }
  });
});

Deno.test("PlaceholderProcessor.getValueByPath", async (t) => {
  const processor = new PlaceholderProcessor();

  await t.step("gets simple property", () => {
    const result = processor.getValueByPath({ key: "value" }, "key");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, "value");
    }
  });

  await t.step("gets nested property", () => {
    const data = { a: { b: { c: "nested" } } };
    const result = processor.getValueByPath(data, "a.b.c");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, "nested");
    }
  });

  await t.step("fails for non-existent path", () => {
    const result = processor.getValueByPath({ key: "value" }, "missing");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
    }
  });

  await t.step("fails for empty path", () => {
    const result = processor.getValueByPath({ key: "value" }, "");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "EmptyInput");
    }
  });

  await t.step("fails when traversing non-object", () => {
    const result = processor.getValueByPath({ key: "value" }, "key.nested");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "InvalidFormat");
    }
  });

  await t.step("fails when value is null in path", () => {
    const data = { a: { b: null } };
    const result = processor.getValueByPath(data, "a.b.c");
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
    }
  });
});

Deno.test("PlaceholderProcessorFactory", async (t) => {
  await t.step("creates mustache processor", () => {
    const processor = PlaceholderProcessorFactory.createMustacheProcessor();
    assertExists(processor);
  });

  await t.step("creates dollar processor", () => {
    const processor = PlaceholderProcessorFactory.createDollarProcessor();
    assertExists(processor);
  });

  await t.step("creates percent processor", () => {
    const processor = PlaceholderProcessorFactory.createPercentProcessor();
    assertExists(processor);
  });
});

Deno.test("PlaceholderUtils", async (t) => {
  await t.step("extracts mustache placeholders", () => {
    const result = PlaceholderUtils.extractPlaceholders(
      "{{a}} text {{b}} more {{c}}",
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.sort(), ["a", "b", "c"]);
    }
  });

  await t.step("extracts dollar placeholders", () => {
    const result = PlaceholderUtils.extractPlaceholders(
      "${x} and ${y}",
      "dollar",
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.sort(), ["x", "y"]);
    }
  });

  await t.step("extracts percent placeholders", () => {
    const result = PlaceholderUtils.extractPlaceholders(
      "%foo% %bar%",
      "percent",
    );
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.sort(), ["bar", "foo"]);
    }
  });

  await t.step("handles duplicate placeholders", () => {
    const result = PlaceholderUtils.extractPlaceholders("{{x}} {{x}} {{y}}");
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.sort(), ["x", "y"]);
    }
  });

  await t.step("validates all placeholders present", () => {
    const data = { a: 1, b: 2 };
    const result = PlaceholderUtils.validatePlaceholders(["a", "b"], data);
    assertEquals(result.ok, true);
  });

  await t.step("fails validation for missing placeholders", () => {
    const data = { a: 1 };
    const result = PlaceholderUtils.validatePlaceholders(["a", "b"], data);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, "NotFound");
    }
  });

  await t.step("handles empty placeholder list", () => {
    const result = PlaceholderUtils.validatePlaceholders([], {});
    assertEquals(result.ok, true);
  });
});

Deno.test("PlaceholderProcessor - Registry Command Scenarios", async (t) => {
  const processor = new PlaceholderProcessor();

  await t.step("processes c1/c2/c3 command fields", () => {
    const context: PlaceholderProcessingContext = {
      data: {
        c1: "git",
        c2: "create",
        c3: "refinement-issue",
        description: "Create a refinement issue",
      },
      patternType: "mustache",
      strictMode: false,
    };

    const template = {
      c1: "{{c1}}",
      c2: "{{c2}}",
      c3: "{{c3}}",
      description: "{{description}}",
    };

    const result = processor.process(template, context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      const processed = result.data.processedContent as Record<string, unknown>;
      assertEquals(processed.c1, "git");
      assertEquals(processed.c2, "create");
      assertEquals(processed.c3, "refinement-issue");
      assertEquals(processed.description, "Create a refinement issue");
    }
  });

  await t.step("processes options with arrays", () => {
    const context: PlaceholderProcessingContext = {
      data: {
        options: {
          input: ["code", "text"],
          file: [true],
          stdin: [true],
        },
      },
      patternType: "mustache",
      strictMode: false,
    };

    const template = {
      options: {
        input: "{{options.input}}",
        file: "{{options.file}}",
        stdin: "{{options.stdin}}",
      },
    };

    const result = processor.process(template, context);
    assertEquals(result.ok, true);
    if (result.ok && result.data.kind === "Success") {
      const processed = result.data.processedContent as Record<string, unknown>;
      const options = processed.options as Record<string, unknown>;
      assertEquals(options.input, "code,text");
      assertEquals(options.file, "true");
      assertEquals(options.stdin, "true");
    }
  });
});
