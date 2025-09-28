import { assertEquals } from "jsr:@std/assert";
import { FlattenArraysDirective } from "../../../../../src/domain/schema/value-objects/flatten-arrays-directive.ts";

Deno.test("FlattenArraysDirective - create with valid property name", () => {
  const result = FlattenArraysDirective.create("traceability");

  assertEquals(result.isOk(), true);
  const directive = result.unwrap();
  assertEquals(directive.getPropertyName(), "traceability");
});

Deno.test("FlattenArraysDirective - reject empty property name", () => {
  const result = FlattenArraysDirective.create("");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_PROPERTY_NAME");
});

Deno.test("FlattenArraysDirective - reject whitespace-only property name", () => {
  const result = FlattenArraysDirective.create("  ");

  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, "EMPTY_PROPERTY_NAME");
});

Deno.test("FlattenArraysDirective - apply flattens nested arrays", () => {
  const directive = FlattenArraysDirective.create("traceability").unwrap();

  const data = {
    title: "Test",
    traceability: ["A", ["B", "C"], [["D"]]],
  };

  const result = directive.apply(data);
  assertEquals(result.traceability, ["A", "B", "C", "D"]);
  assertEquals(result.title, "Test");
});

Deno.test("FlattenArraysDirective - apply wraps single value in array", () => {
  const directive = FlattenArraysDirective.create("traceability").unwrap();

  const data = {
    title: "Test",
    traceability: "single-value",
  };

  const result = directive.apply(data);
  assertEquals(result.traceability, ["single-value"]);
  assertEquals(result.title, "Test");
});

Deno.test("FlattenArraysDirective - apply handles undefined property", () => {
  const directive = FlattenArraysDirective.create("traceability").unwrap();

  const data = {
    title: "Test",
  };

  const result = directive.apply(data);
  assertEquals(result.traceability, []);
  assertEquals(result.title, "Test");
});

Deno.test("FlattenArraysDirective - apply handles null property", () => {
  const directive = FlattenArraysDirective.create("traceability").unwrap();

  const data = {
    title: "Test",
    traceability: null,
  };

  const result = directive.apply(data);
  assertEquals(result.traceability, []);
  assertEquals(result.title, "Test");
});

Deno.test("FlattenArraysDirective - apply handles already flat array", () => {
  const directive = FlattenArraysDirective.create("items").unwrap();

  const data = {
    items: ["A", "B", "C"],
  };

  const result = directive.apply(data);
  assertEquals(result.items, ["A", "B", "C"]);
});

Deno.test("FlattenArraysDirective - equals compares directives correctly", () => {
  const directive1 = FlattenArraysDirective.create("traceability").unwrap();
  const directive2 = FlattenArraysDirective.create("traceability").unwrap();
  const directive3 = FlattenArraysDirective.create("items").unwrap();

  assertEquals(directive1.equals(directive2), true);
  assertEquals(directive1.equals(directive3), false);
});

Deno.test("FlattenArraysDirective - toString provides readable representation", () => {
  const directive = FlattenArraysDirective.create("traceability").unwrap();

  assertEquals(
    directive.toString(),
    'x-flatten-arrays: "traceability"',
  );
});
