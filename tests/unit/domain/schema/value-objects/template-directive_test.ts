import { assertEquals } from "@std/assert";
import { TemplateDirective } from "../../../../../src/domain/schema/value-objects/template-directive.ts";

Deno.test("TemplateDirective - create with valid template path", () => {
  const result = TemplateDirective.create("template.json");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getTemplatePath(), "template.json");
});

Deno.test("TemplateDirective - create with valid path with spaces (trimmed)", () => {
  const result = TemplateDirective.create("  template.json  ");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getTemplatePath(), "template.json");
});

Deno.test("TemplateDirective - create with absolute path", () => {
  const result = TemplateDirective.create("/absolute/path/template.json");

  assertEquals(result.isOk(), true);
  assertEquals(
    result.unwrap().getTemplatePath(),
    "/absolute/path/template.json",
  );
});

Deno.test("TemplateDirective - reject non-string value (number)", () => {
  const result = TemplateDirective.create(123);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template directive value must be a string",
  );
});

Deno.test("TemplateDirective - reject non-string value (object)", () => {
  const result = TemplateDirective.create({ path: "template.json" });

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template directive value must be a string",
  );
});

Deno.test("TemplateDirective - reject non-string value (array)", () => {
  const result = TemplateDirective.create(["template.json"]);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template directive value must be a string",
  );
});

Deno.test("TemplateDirective - reject null value", () => {
  const result = TemplateDirective.create(null);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template directive value must be a string",
  );
});

Deno.test("TemplateDirective - reject undefined value", () => {
  const result = TemplateDirective.create(undefined);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template directive value must be a string",
  );
});

Deno.test("TemplateDirective - reject empty string", () => {
  const result = TemplateDirective.create("");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template directive path cannot be empty",
  );
});

Deno.test("TemplateDirective - reject whitespace-only string", () => {
  const result = TemplateDirective.create("   ");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template directive path cannot be empty",
  );
});

Deno.test("TemplateDirective - getTemplatePath returns correct value", () => {
  const directive = TemplateDirective.create("my-template.json").unwrap();

  assertEquals(directive.getTemplatePath(), "my-template.json");
});

Deno.test("TemplateDirective - equals compares correctly (same paths)", () => {
  const directive1 = TemplateDirective.create("template.json").unwrap();
  const directive2 = TemplateDirective.create("template.json").unwrap();

  assertEquals(directive1.equals(directive2), true);
});

Deno.test("TemplateDirective - equals compares correctly (different paths)", () => {
  const directive1 = TemplateDirective.create("template1.json").unwrap();
  const directive2 = TemplateDirective.create("template2.json").unwrap();

  assertEquals(directive1.equals(directive2), false);
});

Deno.test("TemplateDirective - equals handles trimming consistently", () => {
  const directive1 = TemplateDirective.create("template.json").unwrap();
  const directive2 = TemplateDirective.create("  template.json  ").unwrap();

  assertEquals(directive1.equals(directive2), true);
});

Deno.test("TemplateDirective - toString provides readable representation", () => {
  const directive = TemplateDirective.create("my-template.json").unwrap();

  assertEquals(directive.toString(), 'x-template: "my-template.json"');
});

Deno.test("TemplateDirective - toString with absolute path", () => {
  const directive = TemplateDirective.create("/absolute/path/template.json")
    .unwrap();

  assertEquals(
    directive.toString(),
    'x-template: "/absolute/path/template.json"',
  );
});
