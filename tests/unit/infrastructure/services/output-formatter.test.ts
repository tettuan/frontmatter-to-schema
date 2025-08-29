/**
 * Tests for Output Formatter Services
 *
 * Tests the infrastructure services responsible for serializing domain data
 * to various formats, ensuring proper separation of concerns.
 */

import { assertEquals } from "jsr:@std/assert";
import {
  JsonOutputFormatter,
  MultiFormatOutputService,
  type OutputFormat,
  OutputFormatterFactory,
  YamlOutputFormatter,
} from "../../../../src/infrastructure/services/output-formatter.ts";

Deno.test("OutputFormatter: JSON formatting", () => {
  const formatter = new JsonOutputFormatter();

  const testData = {
    name: "test",
    value: 42,
    nested: {
      array: [1, 2, 3],
      boolean: true,
    },
  };

  const result = formatter.format(testData);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Verify it's valid JSON
  const parsed = JSON.parse(result.data);
  assertEquals(parsed.name, "test");
  assertEquals(parsed.value, 42);
  assertEquals(parsed.nested.array.length, 3);
  assertEquals(parsed.nested.boolean, true);
});

Deno.test("OutputFormatter: JSON formatting with custom indent", () => {
  const formatter = new JsonOutputFormatter(4);

  const testData = { name: "test", value: 42 };
  const result = formatter.format(testData);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Check indentation
  const lines = result.data.split("\n");
  assertEquals(lines[1].startsWith('    "name"'), true); // 4 spaces
});

Deno.test("OutputFormatter: JSON error handling", () => {
  const formatter = new JsonOutputFormatter();

  // Create circular reference
  const circular: { name: string; self?: unknown } = { name: "test" };
  circular.self = circular;

  const result = formatter.format(circular);
  assertEquals(result.ok, false);
  if (result.ok) return;

  assertEquals(result.error.kind, "ProcessingStageError");
});

Deno.test("OutputFormatter: YAML formatting", () => {
  const formatter = new YamlOutputFormatter();

  const testData = {
    name: "test",
    value: 42,
    nested: {
      boolean: true,
    },
  };

  const result = formatter.format(testData);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Basic YAML structure checks
  assertEquals(result.data.includes("name: test"), true);
  assertEquals(result.data.includes("value: 42"), true);
  assertEquals(result.data.includes("nested:"), true);
  assertEquals(result.data.includes("boolean: true"), true);
});

Deno.test("OutputFormatter: YAML array formatting", () => {
  const formatter = new YamlOutputFormatter();

  const testData = [
    { name: "item1", value: 1 },
    { name: "item2", value: 2 },
  ];

  const result = formatter.format(testData);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  assertEquals(result.data.startsWith("results:"), true);
  assertEquals(result.data.includes("name: item1"), true);
  assertEquals(result.data.includes("name: item2"), true);
});

Deno.test("OutputFormatter: YAML string escaping", () => {
  const formatter = new YamlOutputFormatter();

  const testData = {
    description: 'This has: colons and "quotes"',
    normal: "simple",
  };

  const result = formatter.format(testData);
  assertEquals(result.ok, true);
  if (!result.ok) return;

  // Should escape the string with quotes
  assertEquals(
    result.data.includes('"This has: colons and \\"quotes\\""'),
    true,
  );
  assertEquals(result.data.includes("normal: simple"), true);
});

Deno.test("OutputFormatterFactory: Create JSON formatter", () => {
  const format: OutputFormat = { kind: "JSON", indent: 2 };
  const formatter = OutputFormatterFactory.createFormatter(format);

  assertEquals(formatter.getFormatKind(), "JSON");

  const result = formatter.format({ test: "data" });
  assertEquals(result.ok, true);
});

Deno.test("OutputFormatterFactory: Create YAML formatter", () => {
  const format: OutputFormat = { kind: "YAML", indentSize: 4 };
  const formatter = OutputFormatterFactory.createFormatter(format);

  assertEquals(formatter.getFormatKind(), "YAML");

  const result = formatter.format({ test: "data" });
  assertEquals(result.ok, true);
});

Deno.test("OutputFormatterFactory: From string parsing", () => {
  // Test JSON
  const jsonResult = OutputFormatterFactory.fromString("json");
  assertEquals(jsonResult.ok, true);
  if (!jsonResult.ok) return;
  assertEquals(jsonResult.data.kind, "JSON");

  // Test YAML
  const yamlResult = OutputFormatterFactory.fromString("yaml");
  assertEquals(yamlResult.ok, true);
  if (!yamlResult.ok) return;
  assertEquals(yamlResult.data.kind, "YAML");

  // Test yml alias
  const ymlResult = OutputFormatterFactory.fromString("yml");
  assertEquals(ymlResult.ok, true);
  if (!ymlResult.ok) return;
  assertEquals(ymlResult.data.kind, "YAML");

  // Test invalid format
  const invalidResult = OutputFormatterFactory.fromString("invalid");
  assertEquals(invalidResult.ok, false);
  if (invalidResult.ok) return;
  assertEquals(invalidResult.error.kind, "InvalidFormat");
});

Deno.test("MultiFormatOutputService: Format with OutputFormat", () => {
  const service = new MultiFormatOutputService();

  const testData = { name: "test", value: 42 };

  // Test JSON format
  const jsonFormat: OutputFormat = { kind: "JSON" };
  const jsonResult = service.format(testData, jsonFormat);
  assertEquals(jsonResult.ok, true);
  if (!jsonResult.ok) return;

  const parsed = JSON.parse(jsonResult.data);
  assertEquals(parsed.name, "test");

  // Test YAML format
  const yamlFormat: OutputFormat = { kind: "YAML" };
  const yamlResult = service.format(testData, yamlFormat);
  assertEquals(yamlResult.ok, true);
  if (!yamlResult.ok) return;
  assertEquals(yamlResult.data.includes("name: test"), true);
});

Deno.test("MultiFormatOutputService: Format with string", () => {
  const service = new MultiFormatOutputService();

  const testData = { name: "test", value: 42 };

  // Test JSON
  const jsonResult = service.formatWithString(testData, "json");
  assertEquals(jsonResult.ok, true);
  if (!jsonResult.ok) return;

  const parsed = JSON.parse(jsonResult.data);
  assertEquals(parsed.name, "test");

  // Test invalid format
  const invalidResult = service.formatWithString(testData, "invalid");
  assertEquals(invalidResult.ok, false);
});

Deno.test("MultiFormatOutputService: Get supported formats", () => {
  const service = new MultiFormatOutputService();
  const formats = service.getSupportedFormats();

  assertEquals(formats.length, 2);
  assertEquals(formats.includes("JSON"), true);
  assertEquals(formats.includes("YAML"), true);
});
