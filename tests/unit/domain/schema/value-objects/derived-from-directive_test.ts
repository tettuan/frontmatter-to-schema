import { assertEquals } from "jsr:@std/assert";
import { DerivedFromDirective } from "../../../../../src/domain/schema/value-objects/derived-from-directive.ts";

Deno.test("DerivedFromDirective - create with valid string expression", () => {
  const result = DerivedFromDirective.create("frontmatter.title");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getExpressions(), ["frontmatter.title"]);
  assertEquals(directive.getPrimaryExpression(), "frontmatter.title");
  assertEquals(directive.hasMultipleExpressions(), false);
});

Deno.test("DerivedFromDirective - create with valid string (trimmed)", () => {
  const result = DerivedFromDirective.create("  frontmatter.title  ");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getExpressions(), ["frontmatter.title"]);
  assertEquals(directive.getPrimaryExpression(), "frontmatter.title");
});

Deno.test("DerivedFromDirective - create with complex JMESPath expression", () => {
  const result = DerivedFromDirective.create(
    "frontmatter.tags[?contains(@, 'tech')]",
  );

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getExpressions(), [
    "frontmatter.tags[?contains(@, 'tech')]",
  ]);
  assertEquals(
    directive.getPrimaryExpression(),
    "frontmatter.tags[?contains(@, 'tech')]",
  );
});

Deno.test("DerivedFromDirective - create with valid array of expressions", () => {
  const expressions = ["frontmatter.title", "frontmatter.description"];
  const result = DerivedFromDirective.create(expressions);

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getExpressions(), expressions);
  assertEquals(directive.getPrimaryExpression(), "frontmatter.title");
  assertEquals(directive.hasMultipleExpressions(), true);
});

Deno.test("DerivedFromDirective - create with array (trimmed expressions)", () => {
  const result = DerivedFromDirective.create(["  expr1  ", "  expr2  "]);

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getExpressions(), ["expr1", "expr2"]);
  assertEquals(directive.hasMultipleExpressions(), true);
});

Deno.test("DerivedFromDirective - create with single item array", () => {
  const result = DerivedFromDirective.create(["frontmatter.title"]);

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getExpressions(), ["frontmatter.title"]);
  assertEquals(directive.hasMultipleExpressions(), false);
});

Deno.test("DerivedFromDirective - reject empty string", () => {
  const result = DerivedFromDirective.create("");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive expression cannot be empty",
  );
});

Deno.test("DerivedFromDirective - reject whitespace-only string", () => {
  const result = DerivedFromDirective.create("   ");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive expression cannot be empty",
  );
});

Deno.test("DerivedFromDirective - reject empty array", () => {
  const result = DerivedFromDirective.create([]);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive array cannot be empty",
  );
});

Deno.test("DerivedFromDirective - reject array with non-string item", () => {
  const result = DerivedFromDirective.create(["valid_expression", 123]);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "All x-derived-from directive array items must be strings",
  );
});

Deno.test("DerivedFromDirective - reject array with empty string item", () => {
  const result = DerivedFromDirective.create(["valid_expression", ""]);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive expressions cannot be empty",
  );
});

Deno.test("DerivedFromDirective - reject array with whitespace-only string item", () => {
  const result = DerivedFromDirective.create(["valid_expression", "   "]);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive expressions cannot be empty",
  );
});

Deno.test("DerivedFromDirective - reject non-string non-array value (number)", () => {
  const result = DerivedFromDirective.create(123);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive must be a string or array of strings",
  );
});

Deno.test("DerivedFromDirective - reject non-string non-array value (object)", () => {
  const result = DerivedFromDirective.create({
    expression: "frontmatter.title",
  });

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive must be a string or array of strings",
  );
});

Deno.test("DerivedFromDirective - reject null value", () => {
  const result = DerivedFromDirective.create(null);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive must be a string or array of strings",
  );
});

Deno.test("DerivedFromDirective - reject undefined value", () => {
  const result = DerivedFromDirective.create(undefined);

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "INVALID_DIRECTIVE_VALUE");
  assertEquals(
    result.unwrapError().message,
    "x-derived-from directive must be a string or array of strings",
  );
});

Deno.test("DerivedFromDirective - getExpressions returns copy of array", () => {
  const directive = DerivedFromDirective.create(["expr1", "expr2"]).unwrap();

  const expressions = directive.getExpressions();
  expressions.push("modified");

  // Original should be unchanged
  assertEquals(directive.getExpressions(), ["expr1", "expr2"]);
});

Deno.test("DerivedFromDirective - getPrimaryExpression returns first expression", () => {
  const directive = DerivedFromDirective.create(["first", "second", "third"])
    .unwrap();

  assertEquals(directive.getPrimaryExpression(), "first");
});

Deno.test("DerivedFromDirective - hasMultipleExpressions returns correct value", () => {
  const singleDirective = DerivedFromDirective.create("single_expr").unwrap();
  const multipleDirective = DerivedFromDirective.create(["expr1", "expr2"])
    .unwrap();

  assertEquals(singleDirective.hasMultipleExpressions(), false);
  assertEquals(multipleDirective.hasMultipleExpressions(), true);
});

Deno.test("DerivedFromDirective - equals compares correctly (same single expression)", () => {
  const directive1 = DerivedFromDirective.create("frontmatter.title").unwrap();
  const directive2 = DerivedFromDirective.create("frontmatter.title").unwrap();

  assertEquals(directive1.equals(directive2), true);
});

Deno.test("DerivedFromDirective - equals compares correctly (different single expression)", () => {
  const directive1 = DerivedFromDirective.create("frontmatter.title").unwrap();
  const directive2 = DerivedFromDirective.create("frontmatter.description")
    .unwrap();

  assertEquals(directive1.equals(directive2), false);
});

Deno.test("DerivedFromDirective - equals compares correctly (same multiple expressions)", () => {
  const directive1 = DerivedFromDirective.create(["expr1", "expr2"]).unwrap();
  const directive2 = DerivedFromDirective.create(["expr1", "expr2"]).unwrap();

  assertEquals(directive1.equals(directive2), true);
});

Deno.test("DerivedFromDirective - equals compares correctly (different multiple expressions)", () => {
  const directive1 = DerivedFromDirective.create(["expr1", "expr2"]).unwrap();
  const directive2 = DerivedFromDirective.create(["expr1", "expr3"]).unwrap();

  assertEquals(directive1.equals(directive2), false);
});

Deno.test("DerivedFromDirective - equals compares correctly (different order)", () => {
  const directive1 = DerivedFromDirective.create(["expr1", "expr2"]).unwrap();
  const directive2 = DerivedFromDirective.create(["expr2", "expr1"]).unwrap();

  assertEquals(directive1.equals(directive2), false);
});

Deno.test("DerivedFromDirective - equals compares correctly (different length)", () => {
  const directive1 = DerivedFromDirective.create(["expr1"]).unwrap();
  const directive2 = DerivedFromDirective.create(["expr1", "expr2"]).unwrap();

  assertEquals(directive1.equals(directive2), false);
});

Deno.test("DerivedFromDirective - toString single expression", () => {
  const directive = DerivedFromDirective.create("frontmatter.title").unwrap();

  assertEquals(directive.toString(), 'x-derived-from: "frontmatter.title"');
});

Deno.test("DerivedFromDirective - toString multiple expressions", () => {
  const directive = DerivedFromDirective.create(["expr1", "expr2"]).unwrap();

  assertEquals(directive.toString(), 'x-derived-from: ["expr1", "expr2"]');
});

Deno.test("DerivedFromDirective - toString complex expressions", () => {
  const directive = DerivedFromDirective.create([
    "frontmatter.tags[0]",
    "content.body | length(@)",
  ]).unwrap();

  assertEquals(
    directive.toString(),
    'x-derived-from: ["frontmatter.tags[0]", "content.body | length(@)"]',
  );
});

Deno.test("DerivedFromDirective - handles trimming in equals comparison", () => {
  const directive1 = DerivedFromDirective.create("frontmatter.title").unwrap();
  const directive2 = DerivedFromDirective.create("  frontmatter.title  ")
    .unwrap();

  assertEquals(directive1.equals(directive2), true);
});
