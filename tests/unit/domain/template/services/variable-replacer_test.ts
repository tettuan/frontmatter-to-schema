import { assertEquals, assertExists } from "jsr:@std/assert";
import { VariableReplacer } from "../../../../../src/domain/template/services/variable-replacer.ts";
import {
  assertResultSuccess,
  createTestFrontmatterData,
  FrontmatterTestFactory,
} from "../../../../helpers/frontmatter-test-factory.ts";
import { err, ok } from "../../../../../src/domain/shared/types/result.ts";

Deno.test({
  name: "VariableReplacer - should create successfully",
  fn: () => {
    const result = VariableReplacer.create();
    assertEquals(result.ok, true);
    if (result.ok) {
      assertExists(result.data);
    }
  },
});

Deno.test({
  name: "VariableReplacer - should replace simple variables",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const testData = FrontmatterTestFactory.createSimpleData();
    const result = replacer.data.replaceVariables(
      "Hello {name}, value is {value} and {active}",
      testData,
    );

    assertResultSuccess(result, (data) => {
      assertEquals(data, "Hello Test Name, value is Test Value and true");
    });
  },
});

Deno.test({
  name: "VariableReplacer - should handle Result type values gracefully",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    // Create test data with Result types
    const testData = {
      successResult: ok("success value"),
      errorResult: err({ kind: "TestError", message: "Test error" }),
      normalValue: "normal",
    };

    const frontmatterData = createTestFrontmatterData(testData);
    const result = replacer.data.replaceVariables(
      "Success: {successResult}, Error: {errorResult}, Normal: {normalValue}",
      frontmatterData,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      // Success Result should extract the data value
      // Error Result should return empty string
      // Normal value should work as expected
      assertEquals(
        result.data,
        "Success: success value, Error: , Normal: normal",
      );
    }
  },
});

Deno.test({
  name: "VariableReplacer - should not serialize Result objects",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    // Create test data with nested Result in object
    const testTemplate = {
      value: ok("extracted data"),
      error: err({ kind: "TestError", message: "Test error" }),
    };

    const frontmatterData = createTestFrontmatterData({
      template: testTemplate,
    });
    const result = replacer.data.processValue(testTemplate, frontmatterData);

    assertEquals(result.ok, true);
    if (result.ok) {
      const processedObj = result.data as Record<string, unknown>;
      // Verify that Result objects are not serialized as JSON strings
      assertEquals(typeof processedObj.value, "string");
      assertEquals(processedObj.value, "extracted data");
      assertEquals(processedObj.error, ""); // Error Result becomes empty string
    }
  },
});

Deno.test({
  name: "VariableReplacer - should handle nested Result types",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const nestedData = {
      level1: ok({
        level2: ok("deep value"),
        level2Error: err({ kind: "DeepError" }),
      }),
    };

    const frontmatterData = createTestFrontmatterData(nestedData);
    const result = replacer.data.processValue(nestedData, frontmatterData);

    assertEquals(result.ok, true);
    if (result.ok) {
      const processed = result.data as Record<string, unknown>;
      // Should properly extract nested successful Results
      assertExists(processed.level1);
      const level1 = processed.level1 as Record<string, unknown>;
      assertEquals(level1.level2, "deep value");
      assertEquals(level1.level2Error, "");
    }
  },
});

Deno.test({
  name: "VariableReplacer - should handle arrays with Result types",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const arrayData = {
      items: [
        ok("item1"),
        err({ kind: "ItemError" }),
        ok("item3"),
        "normal item",
      ],
    };

    const frontmatterData = createTestFrontmatterData(arrayData);

    const result = replacer.data.processValue(arrayData, frontmatterData);

    assertEquals(result.ok, true);
    if (result.ok) {
      const processed = result.data as Record<string, unknown>;
      const items = processed.items as unknown[];
      assertEquals(items[0], "item1"); // Success Result data extracted
      assertEquals(items[1], ""); // Error Result becomes empty
      assertEquals(items[2], "item3"); // Success Result data extracted
      assertEquals(items[3], "normal item"); // Normal value unchanged
    }
  },
});

Deno.test({
  name: "VariableReplacer - should skip @ variables",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const frontmatterData = createTestFrontmatterData({
      items: ["item1", "item2"],
    });

    const result = replacer.data.replaceVariables(
      "Normal: {items}, Array: {@items}",
      frontmatterData,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      // @ variables should remain unchanged
      assertEquals(
        result.data,
        'Normal: ["item1","item2"], Array: {@items}',
      );
    }
  },
});

Deno.test({
  name: "VariableReplacer - should handle missing variables gracefully",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const frontmatterData = createTestFrontmatterData({
      existing: "value",
    });

    const result = replacer.data.replaceVariables(
      "Existing: {existing}, Missing: {missing}",
      frontmatterData,
    );

    assertEquals(result.ok, true);
    if (result.ok) {
      // Missing variables should keep placeholder
      assertEquals(result.data, "Existing: value, Missing: {missing}");
    }
  },
});

Deno.test({
  name: "VariableReplacer - should handle frontmatter_value objects",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const testData = {
      user: "John Doe",
    };

    const template = {
      name: { frontmatter_value: "user" },
      missing: { frontmatter_value: "nonexistent" },
    };

    const frontmatterData = createTestFrontmatterData(testData);

    const result = replacer.data.processValue(template, frontmatterData);

    assertEquals(result.ok, true);
    if (result.ok) {
      const processed = result.data as Record<string, unknown>;
      assertEquals(processed.name, "John Doe");
      assertEquals(processed.missing, undefined);
    }
  },
});

Deno.test({
  name: "VariableReplacer - should handle iterate objects",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const testData = {
      commands: [
        { name: "cmd1", desc: "Command 1" },
        { name: "cmd2", desc: "Command 2" },
      ],
    };

    const template = {
      names: {
        iterate: "commands",
        frontmatter_value: "name",
      },
    };

    const frontmatterData = createTestFrontmatterData(testData);

    const result = replacer.data.processValue(template, frontmatterData);

    assertEquals(result.ok, true);
    if (result.ok) {
      const processed = result.data as Record<string, unknown>;
      const names = processed.names as string[];
      assertEquals(names, ["cmd1", "cmd2"]);
    }
  },
});

// ✅ DDD Fix: Add comprehensive YAML array expansion tests
Deno.test({
  name:
    "VariableReplacer - processArrayExpansion should handle YAML list format",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const yamlTemplate = "books:\n  - {@items}";
    const dataArray = [
      { title: "Book 1", author: "Author 1" },
      { title: "Book 2", author: "Author 2" },
    ];

    const result = replacer.data.processArrayExpansion(yamlTemplate, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, {
        books: dataArray,
      });
    }
  },
});

Deno.test({
  name:
    "VariableReplacer - processArrayExpansion should handle JSON array format",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const jsonTemplate = "{@items}";
    const dataArray = ["item1", "item2", "item3"];

    const result = replacer.data.processArrayExpansion(jsonTemplate, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      // ✅ JSON format should return actual array (not stringified for proper JSON structure)
      assertEquals(result.data, dataArray);
    }
  },
});

Deno.test({
  name:
    "VariableReplacer - processArrayExpansion should handle embedded {@items} in text",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const textTemplate = "Items: {@items}";
    const dataArray = ["apple", "banana"];

    const result = replacer.data.processArrayExpansion(textTemplate, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, 'Items: ["apple","banana"]');
    }
  },
});

Deno.test({
  name:
    "VariableReplacer - processArrayExpansion should handle template without {@items}",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const template = "No items here";
    const dataArray = ["item1"];

    const result = replacer.data.processArrayExpansion(template, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, "No items here");
    }
  },
});

Deno.test({
  name: "VariableReplacer - processArrayExpansion should handle empty array",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const yamlTemplate = "books:\n  - {@items}";
    const dataArray: unknown[] = [];

    const result = replacer.data.processArrayExpansion(yamlTemplate, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, { books: [] });
    }
  },
});

Deno.test({
  name:
    "VariableReplacer - processArrayExpansion should handle quoted YAML list format",
  fn: () => {
    const replacer = VariableReplacer.create();
    if (!replacer.ok) return;

    const yamlTemplate = 'books:\n  - "{@items}"';
    const dataArray = [
      { title: "Book 1", author: "Author 1" },
      { title: "Book 2", author: "Author 2" },
    ];

    const result = replacer.data.processArrayExpansion(yamlTemplate, dataArray);

    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data, {
        books: dataArray,
      });
    }
  },
});
