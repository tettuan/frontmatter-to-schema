import { assertEquals, assertStringIncludes } from "@std/assert";
import { DefaultOutputFormatter } from "../../../../src/infrastructure/adapters/default-output-formatter.ts";

// === Factory Method Tests ===

Deno.test("DefaultOutputFormatter - create() returns success", () => {
  const result = DefaultOutputFormatter.create();

  assertEquals(result.isOk(), true);
  // Verify the formatter is created and has expected methods
  const formatter = result.unwrap();
  assertEquals(typeof formatter.format, "function");
  assertEquals(typeof formatter.isFormatSupported, "function");
  assertEquals(typeof formatter.getSupportedFormats, "function");
});

// === getSupportedFormats Tests ===

Deno.test("DefaultOutputFormatter - getSupportedFormats returns all formats", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const formats = formatter.getSupportedFormats();

  assertEquals(formats.length, 4);
  assertEquals(formats.includes("json"), true);
  assertEquals(formats.includes("yaml"), true);
  assertEquals(formats.includes("xml"), true);
  assertEquals(formats.includes("markdown"), true);
});

// === isFormatSupported Tests ===

Deno.test("DefaultOutputFormatter - isFormatSupported returns true for valid formats", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();

  assertEquals(formatter.isFormatSupported("json"), true);
  assertEquals(formatter.isFormatSupported("yaml"), true);
  assertEquals(formatter.isFormatSupported("xml"), true);
  assertEquals(formatter.isFormatSupported("markdown"), true);
});

Deno.test("DefaultOutputFormatter - isFormatSupported returns false for invalid formats", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();

  assertEquals(formatter.isFormatSupported("html"), false);
  assertEquals(formatter.isFormatSupported("toml"), false);
  assertEquals(formatter.isFormatSupported(""), false);
});

// === JSON Format Tests ===

Deno.test("DefaultOutputFormatter - format JSON with simple object", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { name: "test", value: 42 };

  const result = formatter.format(data, "json");

  assertEquals(result.isOk(), true);
  const parsed = JSON.parse(result.unwrap());
  assertEquals(parsed.name, "test");
  assertEquals(parsed.value, 42);
});

Deno.test("DefaultOutputFormatter - format JSON with nested object", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = {
    level1: {
      level2: {
        value: "deep",
      },
    },
  };

  const result = formatter.format(data, "json");

  assertEquals(result.isOk(), true);
  const parsed = JSON.parse(result.unwrap());
  assertEquals(parsed.level1.level2.value, "deep");
});

Deno.test("DefaultOutputFormatter - format JSON with array", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { items: [1, 2, 3] };

  const result = formatter.format(data, "json");

  assertEquals(result.isOk(), true);
  const parsed = JSON.parse(result.unwrap());
  assertEquals(parsed.items.length, 3);
});

Deno.test("DefaultOutputFormatter - format JSON with pretty print (default)", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { a: 1, b: 2 };

  const result = formatter.format(data, "json");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "\n"); // Pretty printed has newlines
});

Deno.test("DefaultOutputFormatter - format JSON without pretty print", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { a: 1, b: 2 };

  const result = formatter.format(data, "json", { prettyPrint: false });

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().includes("\n"), false); // Minified has no newlines
});

Deno.test("DefaultOutputFormatter - format JSON with custom indent", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { a: 1 };

  const result = formatter.format(data, "json", { indent: 4 });

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "    "); // 4-space indent
});

// === YAML Format Tests ===

Deno.test("DefaultOutputFormatter - format YAML with simple object", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { name: "test", value: 42 };

  const result = formatter.format(data, "yaml");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "name: test");
  assertStringIncludes(result.unwrap(), "value: 42");
});

Deno.test("DefaultOutputFormatter - format YAML with array", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { items: ["a", "b", "c"] };

  const result = formatter.format(data, "yaml");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "- a");
  assertStringIncludes(result.unwrap(), "- b");
  assertStringIncludes(result.unwrap(), "- c");
});

Deno.test("DefaultOutputFormatter - format YAML with nested object", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = {
    outer: {
      inner: "value",
    },
  };

  const result = formatter.format(data, "yaml");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "outer:");
  assertStringIncludes(result.unwrap(), "inner: value");
});

// === XML Format Tests ===

Deno.test("DefaultOutputFormatter - format XML with simple object", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { name: "test", value: 42 };

  const result = formatter.format(data, "xml");

  assertEquals(result.isOk(), true);
  assertStringIncludes(
    result.unwrap(),
    '<?xml version="1.0" encoding="UTF-8"?>',
  );
  assertStringIncludes(result.unwrap(), "<name>test</name>");
  assertStringIncludes(result.unwrap(), "<value>42</value>");
});

Deno.test("DefaultOutputFormatter - format XML escapes special characters", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { content: "<script>alert('xss')</script>" };

  const result = formatter.format(data, "xml");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "&lt;script&gt;");
  assertStringIncludes(result.unwrap(), "&#39;xss&#39;");
});

Deno.test("DefaultOutputFormatter - format XML with array", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { items: ["a", "b"] };

  const result = formatter.format(data, "xml");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), '<item index="0">a</item>');
  assertStringIncludes(result.unwrap(), '<item index="1">b</item>');
});

// === Markdown Format Tests ===

Deno.test("DefaultOutputFormatter - format Markdown with simple object", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { title: "Test", count: 5 };

  const result = formatter.format(data, "markdown");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "**title**: Test");
  assertStringIncludes(result.unwrap(), "**count**: 5");
});

Deno.test("DefaultOutputFormatter - format Markdown with array", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { items: ["first", "second"] };

  const result = formatter.format(data, "markdown");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "- first");
  assertStringIncludes(result.unwrap(), "- second");
});

Deno.test("DefaultOutputFormatter - format Markdown escapes special characters", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { content: "*bold* _italic_" };

  const result = formatter.format(data, "markdown");

  assertEquals(result.isOk(), true);
  assertStringIncludes(result.unwrap(), "\\*bold\\*");
  assertStringIncludes(result.unwrap(), "\\_italic\\_");
});

// === Edge Cases ===

Deno.test("DefaultOutputFormatter - format handles null values", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { nullValue: null };

  const jsonResult = formatter.format(data, "json");
  assertEquals(jsonResult.isOk(), true);
  assertStringIncludes(jsonResult.unwrap(), "null");
});

Deno.test("DefaultOutputFormatter - format handles empty object", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = {};

  const jsonResult = formatter.format(data, "json");
  assertEquals(jsonResult.isOk(), true);
  assertEquals(jsonResult.unwrap().trim(), "{}");
});

Deno.test("DefaultOutputFormatter - format handles empty array", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { items: [] };

  const jsonResult = formatter.format(data, "json");
  assertEquals(jsonResult.isOk(), true);
  const parsed = JSON.parse(jsonResult.unwrap());
  assertEquals(parsed.items.length, 0);
});

Deno.test("DefaultOutputFormatter - format handles boolean values", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { active: true, disabled: false };

  const jsonResult = formatter.format(data, "json");
  assertEquals(jsonResult.isOk(), true);
  const parsed = JSON.parse(jsonResult.unwrap());
  assertEquals(parsed.active, true);
  assertEquals(parsed.disabled, false);
});

Deno.test("DefaultOutputFormatter - format handles unicode characters", () => {
  const formatter = DefaultOutputFormatter.create().unwrap();
  const data = { japanese: "日本語", emoji: "🎉" };

  const jsonResult = formatter.format(data, "json");
  assertEquals(jsonResult.isOk(), true);
  const parsed = JSON.parse(jsonResult.unwrap());
  assertEquals(parsed.japanese, "日本語");
  assertEquals(parsed.emoji, "🎉");
});
