import { assertEquals, assertStrictEquals } from "jsr:@std/assert";
import { TemplateFormatDirective } from "../../../../../src/domain/schema/value-objects/template-format-directive.ts";
import { SchemaError } from "../../../../../src/domain/shared/types/errors.ts";

Deno.test("TemplateFormatDirective - create with valid json format", () => {
  const result = TemplateFormatDirective.create("json");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getFormat(), "json");
  assertEquals(directive.isJson(), true);
  assertEquals(directive.isYaml(), false);
});

Deno.test("TemplateFormatDirective - create with valid yaml format", () => {
  const result = TemplateFormatDirective.create("yaml");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getFormat(), "yaml");
  assertEquals(directive.isYaml(), true);
  assertEquals(directive.isJson(), false);
});

Deno.test("TemplateFormatDirective - create with uppercase JSON format", () => {
  const result = TemplateFormatDirective.create("JSON");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getFormat(), "json");
  assertEquals(directive.isJson(), true);
});

Deno.test("TemplateFormatDirective - create with mixed case YAML format", () => {
  const result = TemplateFormatDirective.create("YaMl");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getFormat(), "yaml");
  assertEquals(directive.isYaml(), true);
});

Deno.test("TemplateFormatDirective - create with whitespace trimming", () => {
  const result = TemplateFormatDirective.create("  json  ");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getFormat(), "json");
  assertEquals(directive.isJson(), true);
});

Deno.test("TemplateFormatDirective - create with tabs and newlines", () => {
  const result = TemplateFormatDirective.create("\t\nyaml\n\t");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getFormat(), "yaml");
  assertEquals(directive.isYaml(), true);
});

Deno.test("TemplateFormatDirective - create with valid xml format", () => {
  const result = TemplateFormatDirective.create("xml");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getFormat(), "xml");
  assertEquals(directive.isXml(), true);
  assertEquals(directive.isJson(), false);
  assertEquals(directive.isYaml(), false);
});

Deno.test("TemplateFormatDirective - create with valid markdown format", () => {
  const result = TemplateFormatDirective.create("markdown");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getFormat(), "markdown");
  assertEquals(directive.isMarkdown(), true);
  assertEquals(directive.isJson(), false);
  assertEquals(directive.isYaml(), false);
  assertEquals(directive.isXml(), false);
});

Deno.test("TemplateFormatDirective - create fails with invalid format", () => {
  const result = TemplateFormatDirective.create("txt");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    error.message,
    "x-template-format directive value must be one of: json, yaml, xml, markdown",
  );
});

Deno.test("TemplateFormatDirective - create fails with non-string input", () => {
  const result = TemplateFormatDirective.create(123);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    error.message,
    "x-template-format directive value must be a string",
  );
});

Deno.test("TemplateFormatDirective - create fails with null input", () => {
  const result = TemplateFormatDirective.create(null);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("TemplateFormatDirective - create fails with undefined input", () => {
  const result = TemplateFormatDirective.create(undefined);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("TemplateFormatDirective - create fails with boolean input", () => {
  const result = TemplateFormatDirective.create(true);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("TemplateFormatDirective - create fails with object input", () => {
  const result = TemplateFormatDirective.create({ format: "json" });

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("TemplateFormatDirective - create fails with array input", () => {
  const result = TemplateFormatDirective.create(["json"]);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("TemplateFormatDirective - create fails with empty string", () => {
  const result = TemplateFormatDirective.create("");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("TemplateFormatDirective - create fails with whitespace only", () => {
  const result = TemplateFormatDirective.create("   ");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error instanceof SchemaError, true);
  assertEquals(error.code, "INVALID_DIRECTIVE_VALUE");
});

Deno.test("TemplateFormatDirective - equals returns true for same format", () => {
  const directive1 = TemplateFormatDirective.create("json").unwrap();
  const directive2 = TemplateFormatDirective.create("JSON").unwrap();

  assertEquals(directive1.equals(directive2), true);
  assertEquals(directive2.equals(directive1), true);
});

Deno.test("TemplateFormatDirective - equals returns false for different formats", () => {
  const jsonDirective = TemplateFormatDirective.create("json").unwrap();
  const yamlDirective = TemplateFormatDirective.create("yaml").unwrap();

  assertEquals(jsonDirective.equals(yamlDirective), false);
  assertEquals(yamlDirective.equals(jsonDirective), false);
});

Deno.test("TemplateFormatDirective - equals is reflexive", () => {
  const directive = TemplateFormatDirective.create("json").unwrap();

  assertEquals(directive.equals(directive), true);
});

Deno.test("TemplateFormatDirective - toString returns correct representation", () => {
  const jsonDirective = TemplateFormatDirective.create("json").unwrap();
  const yamlDirective = TemplateFormatDirective.create("yaml").unwrap();

  assertEquals(jsonDirective.toString(), 'x-template-format: "json"');
  assertEquals(yamlDirective.toString(), 'x-template-format: "yaml"');
});

Deno.test("TemplateFormatDirective - getFormat returns exact format value", () => {
  const jsonDirective = TemplateFormatDirective.create("json").unwrap();
  const yamlDirective = TemplateFormatDirective.create("YAML").unwrap();

  assertStrictEquals(jsonDirective.getFormat(), "json");
  assertStrictEquals(yamlDirective.getFormat(), "yaml");
});

Deno.test("TemplateFormatDirective - isJson behavior validation", () => {
  const jsonDirective = TemplateFormatDirective.create("JSON").unwrap();
  const yamlDirective = TemplateFormatDirective.create("yaml").unwrap();

  assertEquals(jsonDirective.isJson(), true);
  assertEquals(jsonDirective.isYaml(), false);
  assertEquals(yamlDirective.isJson(), false);
  assertEquals(yamlDirective.isYaml(), true);
});

Deno.test("TemplateFormatDirective - error context validation", () => {
  const result = TemplateFormatDirective.create("invalid");

  assertEquals(result.isError(), true);
  const error = result.unwrapError();

  // Validate error context
  assertEquals(error.context?.directive, "x-template-format");
  assertEquals(error.context?.value, "invalid");
  assertEquals(error.context?.expected, "one of: json, yaml, xml, markdown");
});

Deno.test("TemplateFormatDirective - error context for non-string", () => {
  const result = TemplateFormatDirective.create(42);

  assertEquals(result.isError(), true);
  const error = result.unwrapError();

  // Validate error context
  assertEquals(error.context?.directive, "x-template-format");
  assertEquals(error.context?.value, 42);
  assertEquals(error.context?.expected, "string");
});

Deno.test("TemplateFormatDirective - comprehensive format validation", () => {
  const validFormats = [
    "json",
    "JSON",
    "Json",
    "jSoN",
    "yaml",
    "YAML",
    "Yaml",
    "yAmL",
    "xml",
    "XML",
    "Xml",
    "xMl",
    "markdown",
    "MARKDOWN",
    "Markdown",
    "MarkDown",
  ];
  const invalidFormats = ["txt", "csv", "html", "pdf", "docx"];

  // Test all valid formats
  for (const format of validFormats) {
    const result = TemplateFormatDirective.create(format);
    assertEquals(
      result.isOk(),
      true,
      `Format '${format}' should be valid but was rejected`,
    );
  }

  // Test all invalid formats
  for (const format of invalidFormats) {
    const result = TemplateFormatDirective.create(format);
    assertEquals(
      result.isError(),
      true,
      `Format '${format}' should be invalid but was accepted`,
    );
  }
});

Deno.test("TemplateFormatDirective - case normalization consistency", () => {
  const formats = ["json", "JSON", "Json", "jSoN"];
  const directives = formats.map((f) =>
    TemplateFormatDirective.create(f).unwrap()
  );

  // All should have the same normalized format
  for (const directive of directives) {
    assertEquals(directive.getFormat(), "json");
    assertEquals(directive.isJson(), true);
    assertEquals(directive.isYaml(), false);
  }

  // All should be equal to each other
  for (let i = 0; i < directives.length; i++) {
    for (let j = 0; j < directives.length; j++) {
      assertEquals(
        directives[i].equals(directives[j]),
        true,
        `Directives ${i} and ${j} should be equal`,
      );
    }
  }
});
