import { assertEquals } from "jsr:@std/assert";
import { FlattenArraysDirective } from "../../../../../src/domain/schema/value-objects/flatten-arrays-directive.ts";

Deno.test("FlattenArraysDirective - create with valid properties", () => {
  const result = FlattenArraysDirective.create("items", "traceability");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getTargetPropertyName(), "items");
  assertEquals(directive.getSourcePropertyName(), "traceability");
});

Deno.test("FlattenArraysDirective - reject empty target property", () => {
  const result = FlattenArraysDirective.create("", "traceability");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_TARGET_PROPERTY");
});

Deno.test("FlattenArraysDirective - reject empty source property", () => {
  const result = FlattenArraysDirective.create("items", "");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_SOURCE_PROPERTY");
});

Deno.test("FlattenArraysDirective - reject whitespace-only properties", () => {
  const targetResult = FlattenArraysDirective.create("  ", "traceability");
  const sourceResult = FlattenArraysDirective.create("items", "  ");

  assertEquals(targetResult.isError(), true);
  assertEquals(sourceResult.isError(), true);
});

Deno.test("FlattenArraysDirective - isApplicable returns true for valid directive", () => {
  const directive = FlattenArraysDirective.create("items", "traceability")
    .unwrap();

  assertEquals(directive.isApplicable(), true);
});

Deno.test("FlattenArraysDirective - createOptional creates optional directive", () => {
  const result = FlattenArraysDirective.createOptional("items", "traceability");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.isOptional(), true);
});

Deno.test("FlattenArraysDirective - default directive is not optional", () => {
  const directive = FlattenArraysDirective.create("items", "traceability")
    .unwrap();

  assertEquals(directive.isOptional(), false);
});

Deno.test("FlattenArraysDirective - equals compares directives correctly", () => {
  const directive1 = FlattenArraysDirective.create("items", "traceability")
    .unwrap();
  const directive2 = FlattenArraysDirective.create("items", "traceability")
    .unwrap();
  const directive3 = FlattenArraysDirective.create("items", "different")
    .unwrap();

  assertEquals(directive1.equals(directive2), true);
  assertEquals(directive1.equals(directive3), false);
});

Deno.test("FlattenArraysDirective - toString provides readable representation", () => {
  const directive = FlattenArraysDirective.create("items", "traceability")
    .unwrap();

  assertEquals(
    directive.toString(),
    "FlattenArraysDirective(target: items, source: traceability, optional: false)",
  );
});
