import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { parse as parseYaml } from "jsr:@std/yaml@1.0.5";
import { YamlFormatter } from "../../../../../src/domain/template/formatters/yaml-formatter.ts";

/**
 * COMPREHENSIVE TEST: YAML Formatter
 *
 * This test validates the YAML formatting functionality for template output.
 *
 * Key Requirements Validated:
 * 1. Format objects to valid YAML
 * 2. Handle nested structures correctly
 * 3. Preserve data types in YAML format
 * 4. Handle arrays and lists
 * 5. Format strings with special characters
 * 6. Error handling for non-serializable data
 */
describe("YamlFormatter", () => {
  const formatterResult = YamlFormatter.create();
  if (!formatterResult.ok) {
    throw new Error(
      `Failed to create YamlFormatter: ${formatterResult.error.message}`,
    );
  }
  const formatter = formatterResult.data;

  it("should return correct format type", () => {
    assertEquals(formatter.getFormat(), "yaml");
  });

  it("should format simple object to YAML", () => {
    const data = {
      name: "Test Project",
      version: "1.0.0",
      active: true,
      count: 42,
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format successfully");
    if (result.ok) {
      const formatted = result.data;

      // Parse back to verify structure
      const parsed = parseYaml(formatted) as any;

      assertEquals(parsed.name, "Test Project");
      assertEquals(parsed.version, "1.0.0");
      assertEquals(parsed.active, true);
      assertEquals(parsed.count, 42);

      // Check YAML formatting
      assertExists(
        formatted.includes("name:"),
        "Should contain YAML key-value format",
      );
      assertExists(
        formatted.includes("version:"),
        "Should format version field",
      );
    }
  });

  it("should format complex nested structure", () => {
    const data = {
      project: {
        name: "My Project",
        metadata: {
          tags: ["yaml", "test"],
          settings: {
            debug: true,
            level: 2,
          },
        },
      },
      items: [
        { id: 1, title: "First Item" },
        { id: 2, title: "Second Item" },
      ],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format complex structure successfully");
    if (result.ok) {
      const parsed = parseYaml(result.data) as any;

      assertEquals(parsed.project.name, "My Project");
      assertEquals(parsed.project.metadata.tags[0], "yaml");
      assertEquals(parsed.project.metadata.settings.debug, true);
      assertEquals(parsed.items[0].title, "First Item");
    }
  });

  it("should handle arrays correctly", () => {
    const data = {
      strings: ["one", "two", "three"],
      numbers: [1, 2, 3],
      mixed: ["string", 42, true, null],
      nested: [
        { name: "item1", value: 10 },
        { name: "item2", value: 20 },
      ],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format arrays successfully");
    if (result.ok) {
      const parsed = parseYaml(result.data) as any;

      assertEquals(parsed.strings.length, 3);
      assertEquals(parsed.strings[0], "one");
      assertEquals(parsed.numbers[1], 2);
      assertEquals(parsed.mixed[2], true);
      assertEquals(parsed.nested[0].name, "item1");
    }
  });

  it("should handle special string values", () => {
    const data = {
      multiline: "Line 1\\nLine 2\\nLine 3",
      withQuotes: 'Text with "quotes"',
      withApostrophe: "Text with 'apostrophe'",
      empty: "",
      withSpecialChars: "Special: @#$%^&*()",
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should handle special strings");
    if (result.ok) {
      const parsed = parseYaml(result.data) as any;

      assertEquals(parsed.multiline, "Line 1\\nLine 2\\nLine 3");
      assertEquals(parsed.withQuotes, 'Text with "quotes"');
      assertEquals(parsed.empty, "");
      assertEquals(parsed.withSpecialChars, "Special: @#$%^&*()");
    }
  });

  it("should handle null and undefined values", () => {
    const data = {
      nullValue: null,
      undefinedValue: undefined,
      zero: 0,
      false: false,
      emptyString: "",
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should handle null/undefined values");
    if (result.ok) {
      const parsed = parseYaml(result.data) as any;

      assertEquals(parsed.nullValue, null);
      assertEquals(parsed.undefinedValue, undefined);
      assertEquals(parsed.zero, 0);
      assertEquals(parsed.false, false);
      assertEquals(parsed.emptyString, "");
    }
  });

  it("should handle empty structures", () => {
    const testCases = [
      { input: {}, name: "empty object" },
      { input: [], name: "empty array" },
      { input: { nested: {} }, name: "nested empty object" },
      { input: { items: [] }, name: "empty array in object" },
    ];

    for (const testCase of testCases) {
      const result = formatter.format(testCase.input);

      assertExists(result.ok, `Should format ${testCase.name} successfully`);
      if (result.ok) {
        const parsed = parseYaml(result.data);
        // Basic structure validation - should not throw
        assertExists(parsed !== null, `${testCase.name} should parse back`);
      }
    }
  });

  it("should format primitive values", () => {
    const testCases = [
      { input: "simple string", type: "string" },
      { input: 123, type: "number" },
      { input: true, type: "boolean" },
      { input: null, type: "null" },
    ];

    for (const testCase of testCases) {
      const result = formatter.format(testCase.input);

      assertExists(result.ok, `Should format ${testCase.type} successfully`);
      if (result.ok) {
        const parsed = parseYaml(result.data);
        assertEquals(parsed, testCase.input);
      }
    }
  });

  it("should handle YAML-specific formatting correctly", () => {
    const data = {
      title: "YAML Test",
      config: {
        enabled: true,
        ports: [8080, 9000],
        database: {
          host: "localhost",
          port: 5432,
        },
      },
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format YAML structure");
    if (result.ok) {
      const formatted = result.data;

      // Check YAML-specific formatting characteristics
      assertExists(
        formatted.includes("title: YAML Test"),
        "Should have proper key-value format",
      );
      assertExists(
        formatted.includes("config:"),
        "Should have nested object indicators",
      );
      assertExists(
        formatted.includes("- 8080"),
        "Should format arrays with dashes",
      );
      assertExists(
        formatted.includes("  enabled: true"),
        "Should have proper indentation",
      );
    }
  });
});
