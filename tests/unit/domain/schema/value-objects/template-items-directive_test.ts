import { assertEquals } from "jsr:@std/assert";
import { TemplateItemsDirective } from "../../../../../src/domain/schema/value-objects/template-items-directive.ts";

Deno.test("TemplateItemsDirective - create with valid template variable", () => {
  const result = TemplateItemsDirective.create("{{item}}");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getTemplateVariable(), "{{item}}");
});

Deno.test("TemplateItemsDirective - create with valid variable (trimmed)", () => {
  const result = TemplateItemsDirective.create("  {{items}}  ");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getTemplateVariable(), "{{items}}");
});

Deno.test("TemplateItemsDirective - create with simple variable name", () => {
  const result = TemplateItemsDirective.create("item");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getTemplateVariable(), "item");
});

Deno.test("TemplateItemsDirective - create with complex variable", () => {
  const result = TemplateItemsDirective.create("{{content.items[0]}}");

  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap().getTemplateVariable(), "{{content.items[0]}}");
});

Deno.test("TemplateItemsDirective - reject non-string value (number)", () => {
  const result = TemplateItemsDirective.create(123);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template-items directive value must be a string",
  );
});

Deno.test("TemplateItemsDirective - reject non-string value (object)", () => {
  const result = TemplateItemsDirective.create({ variable: "item" });

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template-items directive value must be a string",
  );
});

Deno.test("TemplateItemsDirective - reject non-string value (array)", () => {
  const result = TemplateItemsDirective.create(["item"]);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template-items directive value must be a string",
  );
});

Deno.test("TemplateItemsDirective - reject non-string value (boolean)", () => {
  const result = TemplateItemsDirective.create(true);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template-items directive value must be a string",
  );
});

Deno.test("TemplateItemsDirective - reject null value", () => {
  const result = TemplateItemsDirective.create(null);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template-items directive value must be a string",
  );
});

Deno.test("TemplateItemsDirective - reject undefined value", () => {
  const result = TemplateItemsDirective.create(undefined);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template-items directive value must be a string",
  );
});

Deno.test("TemplateItemsDirective - reject empty string", () => {
  const result = TemplateItemsDirective.create("");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template-items directive template variable cannot be empty",
  );
});

Deno.test("TemplateItemsDirective - reject whitespace-only string", () => {
  const result = TemplateItemsDirective.create("   ");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-template-items directive template variable cannot be empty",
  );
});

Deno.test("TemplateItemsDirective - getTemplateVariable returns correct value", () => {
  const directive = TemplateItemsDirective.create("{{my_items}}").unwrap();

  assertEquals(directive.getTemplateVariable(), "{{my_items}}");
});

Deno.test("TemplateItemsDirective - equals compares correctly (same variables)", () => {
  const directive1 = TemplateItemsDirective.create("{{item}}").unwrap();
  const directive2 = TemplateItemsDirective.create("{{item}}").unwrap();

  assertEquals(directive1.equals(directive2), true);
});

Deno.test("TemplateItemsDirective - equals compares correctly (different variables)", () => {
  const directive1 = TemplateItemsDirective.create("{{item1}}").unwrap();
  const directive2 = TemplateItemsDirective.create("{{item2}}").unwrap();

  assertEquals(directive1.equals(directive2), false);
});

Deno.test("TemplateItemsDirective - equals handles trimming consistently", () => {
  const directive1 = TemplateItemsDirective.create("{{item}}").unwrap();
  const directive2 = TemplateItemsDirective.create("  {{item}}  ").unwrap();

  assertEquals(directive1.equals(directive2), true);
});

Deno.test("TemplateItemsDirective - toString provides readable representation", () => {
  const directive = TemplateItemsDirective.create("{{my_items}}").unwrap();

  assertEquals(directive.toString(), 'x-template-items: "{{my_items}}"');
});

Deno.test("TemplateItemsDirective - toString with simple variable", () => {
  const directive = TemplateItemsDirective.create("item").unwrap();

  assertEquals(directive.toString(), 'x-template-items: "item"');
});

Deno.test("TemplateItemsDirective - toString with complex variable", () => {
  const directive = TemplateItemsDirective.create("{{content.items[0]}}")
    .unwrap();

  assertEquals(
    directive.toString(),
    'x-template-items: "{{content.items[0]}}"',
  );
});
