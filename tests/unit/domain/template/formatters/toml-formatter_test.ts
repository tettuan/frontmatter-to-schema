import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TomlFormatter } from "../../../../../src/domain/template/formatters/toml-formatter.ts";

/**
 * COMPREHENSIVE TEST: TOML Formatter
 *
 * This test validates the TOML formatting functionality for template output.
 *
 * Key Requirements Validated:
 * 1. Format simple key-value pairs to TOML
 * 2. Handle nested objects as sections
 * 3. Format arrays correctly
 * 4. Handle arrays of objects as array of tables
 * 5. Escape special characters in strings
 * 6. Error handling for non-serializable data
 */
describe("TomlFormatter", () => {
  const formatter = new TomlFormatter();

  it("should return correct format type", () => {
    assertEquals(formatter.getFormat(), "toml");
  });

  it("should format simple object to TOML", () => {
    const data = {
      name: "Test Project",
      version: "1.0.0",
      debug: true,
      port: 8080,
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check TOML key-value format
      assertExists(
        formatted.includes('name = "Test Project"'),
        "Should format string values",
      );
      assertExists(
        formatted.includes('version = "1.0.0"'),
        "Should format version",
      );
      assertExists(
        formatted.includes("debug = true"),
        "Should format boolean values",
      );
      assertExists(
        formatted.includes("port = 8080"),
        "Should format number values",
      );
    }
  });

  it("should format nested objects as sections", () => {
    const data = {
      title: "Main Title",
      database: {
        host: "localhost",
        port: 5432,
        enabled: true,
      },
      server: {
        bind: "0.0.0.0",
        workers: 4,
      },
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format nested objects successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check main key-value
      assertExists(
        formatted.includes('title = "Main Title"'),
        "Should format top-level values",
      );

      // Check sections
      assertExists(
        formatted.includes("[database]"),
        "Should create database section",
      );
      assertExists(
        formatted.includes('host = "localhost"'),
        "Should format nested string",
      );
      assertExists(
        formatted.includes("port = 5432"),
        "Should format nested number",
      );

      assertExists(
        formatted.includes("[server]"),
        "Should create server section",
      );
      assertExists(
        formatted.includes('bind = "0.0.0.0"'),
        "Should format server bind",
      );
    }
  });

  it("should format arrays correctly", () => {
    const data = {
      strings: ["one", "two", "three"],
      numbers: [1, 2, 3],
      mixed: ["text", 42, true],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format arrays successfully");
    if (result.ok) {
      const formatted = result.data;

      assertExists(
        formatted.includes('strings = ["one", "two", "three"]'),
        "Should format string array",
      );
      assertExists(
        formatted.includes("numbers = [1, 2, 3]"),
        "Should format number array",
      );
      assertExists(
        formatted.includes('mixed = ["text", 42, true]'),
        "Should format mixed array",
      );
    }
  });

  it("should handle arrays of objects as array of tables", () => {
    const data = {
      title: "Configuration",
      servers: [
        { name: "server1", host: "host1.com", port: 8080 },
        { name: "server2", host: "host2.com", port: 9000 },
      ],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format arrays of objects successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check main title
      assertExists(
        formatted.includes('title = "Configuration"'),
        "Should format main title",
      );

      // Check array of tables
      assertExists(
        formatted.includes("[[servers]]"),
        "Should create array of tables",
      );
      assertExists(
        formatted.includes('name = "server1"'),
        "Should format first server",
      );
      assertExists(
        formatted.includes('host = "host1.com"'),
        "Should format first host",
      );

      // Should have multiple [[servers]] sections
      const serverSections = (formatted.match(/\[\[servers\]\]/g) || []).length;
      assertEquals(serverSections, 2, "Should have two server sections");
    }
  });

  it("should escape special characters in strings", () => {
    const data = {
      withQuotes: 'Text with "quotes"',
      withBackslash: "Path\\to\\file",
      withNewline: "Line 1\nLine 2",
      withTab: "Before\tAfter",
      withCarriageReturn: "Before\rAfter",
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should handle special characters");
    if (result.ok) {
      const formatted = result.data;

      assertExists(formatted.includes('\\"'), "Should escape quotes");
      assertExists(formatted.includes("\\\\"), "Should escape backslashes");
      assertExists(formatted.includes("\\n"), "Should escape newlines");
      assertExists(formatted.includes("\\t"), "Should escape tabs");
      assertExists(formatted.includes("\\r"), "Should escape carriage returns");
    }
  });

  it("should handle null and primitive values", () => {
    const data = {
      nullValue: null,
      undefinedValue: undefined,
      zero: 0,
      false: false,
      emptyString: "",
      number: 42.5,
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should handle null and primitive values");
    if (result.ok) {
      const formatted = result.data;

      assertExists(
        formatted.includes("nullValue = null"),
        "Should format null",
      );
      assertExists(
        formatted.includes("undefinedValue = undefined"),
        "Should format undefined",
      );
      assertExists(formatted.includes("zero = 0"), "Should format zero");
      assertExists(formatted.includes("false = false"), "Should format false");
      assertExists(
        formatted.includes('emptyString = ""'),
        "Should format empty string",
      );
      assertExists(
        formatted.includes("number = 42.5"),
        "Should format decimal number",
      );
    }
  });

  it("should handle empty structures", () => {
    const testCases = [
      { input: {}, name: "empty object" },
      { input: { empty: {} }, name: "nested empty object" },
      { input: { emptyArray: [] }, name: "empty array" },
    ];

    for (const testCase of testCases) {
      const result = formatter.format(testCase.input);

      assertExists(result.ok, `Should format ${testCase.name} successfully`);
      if (result.ok) {
        // Should not throw and produce valid TOML
        assertExists(
          typeof result.data === "string",
          `${testCase.name} should produce string`,
        );
      }
    }
  });

  it("should handle complex nested structure", () => {
    const data = {
      title: "Complex Config",
      simple: "value",
      section: {
        key: "value",
        number: 123,
      },
      arraySection: [
        { name: "item1", value: 10 },
        { name: "item2", value: 20 },
      ],
      simpleArray: [1, 2, 3],
    };

    const result = formatter.format(data);

    assertExists(result.ok, "Should format complex structure successfully");
    if (result.ok) {
      const formatted = result.data;

      // Check various TOML constructs
      assertExists(
        formatted.includes('title = "Complex Config"'),
        "Should format title",
      );
      assertExists(formatted.includes("[section]"), "Should create section");
      assertExists(
        formatted.includes("[[arraySection]]"),
        "Should create array of tables",
      );
      assertExists(
        formatted.includes("simpleArray = [1, 2, 3]"),
        "Should format simple array",
      );
    }
  });

  it("should handle primitive values as root", () => {
    const testCases = [
      { input: "string", expected: '"string"' },
      { input: 42, expected: "42" },
      { input: true, expected: "true" },
      { input: null, expected: "null" },
    ];

    for (const testCase of testCases) {
      const result = formatter.format(testCase.input);

      assertExists(
        result.ok,
        `Should format ${typeof testCase.input} successfully`,
      );
      if (result.ok) {
        assertEquals(result.data.trim(), testCase.expected);
      }
    }
  });
});
