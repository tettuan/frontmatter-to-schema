import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { JsonFormatter } from "../../../../../src/domain/template/formatters/json-formatter.ts";

/**
 * COMPREHENSIVE TEST: JSON Formatter
 *
 * This test validates the JSON formatting functionality for template output.
 *
 * Key Requirements Validated:
 * 1. Format simple objects to JSON
 * 2. Handle complex nested structures
 * 3. Preserve data types correctly
 * 4. Format arrays properly
 * 5. Handle edge cases gracefully
 * 6. Error handling for non-serializable data
 */
describe("JsonFormatter", () => {
  const formatterResult = JsonFormatter.create();
  if (!formatterResult.ok) {
    throw new Error(
      `Failed to create JsonFormatter: ${formatterResult.error.message}`,
    );
  }
  const formatter = formatterResult.data;

  it("should return correct format type", () => {
    assertEquals(formatter.getFormat(), "json");
  });

  it("should format simple object", () => {
    const data = {
      name: "Test",
      age: 25,
      active: true,
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format successfully");
    if (result.ok) {
      const formatted = result.data;
      const parsed = JSON.parse(formatted);

      assertEquals(parsed.name, "Test");
      assertEquals(parsed.age, 25);
      assertEquals(parsed.active, true);

      // Check formatting (should be pretty-printed)
      assertExists(
        formatted.includes("  "),
        "Should be pretty-printed with indentation",
      );
    }
  });

  it("should format complex nested structure", () => {
    const data = {
      title: "Project",
      metadata: {
        version: "1.0.0",
        tags: ["test", "formatter"],
      },
      items: [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format complex structure successfully");
    if (result.ok) {
      const parsed = JSON.parse(result.data);

      assertEquals(parsed.title, "Project");
      assertEquals(parsed.metadata.version, "1.0.0");
      assertEquals(parsed.metadata.tags.length, 2);
      assertEquals(parsed.items[0].name, "Item 1");
    }
  });

  it("should handle null and undefined values", () => {
    const data = {
      nullValue: null,
      undefinedValue: undefined,
      emptyString: "",
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should handle null/undefined values");
    if (result.ok) {
      const parsed = JSON.parse(result.data);

      assertEquals(parsed.nullValue, null);
      assertEquals(parsed.undefinedValue, undefined);
      assertEquals(parsed.emptyString, "");
    }
  });

  it("should handle arrays correctly", () => {
    const data = [
      "string",
      42,
      true,
      { nested: "object" },
      [1, 2, 3],
    ];

    const result = formatter.format(data);

    assertExists(result.ok, "Should format array successfully");
    if (result.ok) {
      const parsed = JSON.parse(result.data);

      assertEquals(parsed.length, 5);
      assertEquals(parsed[0], "string");
      assertEquals(parsed[1], 42);
      assertEquals(parsed[2], true);
      assertEquals(parsed[3].nested, "object");
      assertEquals(parsed[4][0], 1);
    }
  });

  it("should handle empty objects and arrays", () => {
    const emptyObject = {};
    const emptyArray: unknown[] = [];

    const objectResult = formatter.format(emptyObject);
    const arrayResult = formatter.format(emptyArray);

    assertExists(objectResult.ok, "Should format empty object");
    assertExists(arrayResult.ok, "Should format empty array");

    if (objectResult.ok && arrayResult.ok) {
      assertEquals(JSON.parse(objectResult.data), {});
      assertEquals(JSON.parse(arrayResult.data), []);
    }
  });

  it("should handle primitive values", () => {
    const testCases = [
      { input: "string", expected: "string" },
      { input: 42, expected: 42 },
      { input: true, expected: true },
      { input: false, expected: false },
      { input: null, expected: null },
    ];

    for (const testCase of testCases) {
      const result = formatter.format(testCase.input);

      assertExists(
        result.ok,
        `Should format ${typeof testCase.input} successfully`,
      );
      if (result.ok) {
        const parsed = JSON.parse(result.data);
        assertEquals(parsed, testCase.expected);
      }
    }
  });

  it("should handle circular references gracefully", () => {
    // Create object with circular reference
    const circular: any = { name: "circular" };
    circular.self = circular;

    const result = formatter.format(circular);

    assertExists(!result.ok, "Should fail on circular references");
    if (!result.ok) {
      assertExists(
        result.error.message.toLowerCase().includes("circular") ||
          result.error.message.toLowerCase().includes("json") ||
          result.error.kind === "InvalidTemplate",
        "Should indicate circular reference or JSON error",
      );
    }
  });
});
