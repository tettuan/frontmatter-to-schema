/**
 * Tests for VariableResolver
 */

import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import { VariableResolver } from "../src/variable-resolver.ts";
import { VariableNotFoundError } from "../src/errors.ts";

Deno.test("VariableResolver - simple property access", () => {
  const data = { name: "test", version: "1.0.0" };
  const resolver = new VariableResolver(data);

  assertEquals(resolver.resolve("name"), "test");
  assertEquals(resolver.resolve("version"), "1.0.0");
});

Deno.test("VariableResolver - dot notation access", () => {
  const data = {
    user: {
      profile: {
        name: "John Doe",
        age: 30,
      },
    },
  };
  const resolver = new VariableResolver(data);

  assertEquals(resolver.resolve("user.profile.name"), "John Doe");
  assertEquals(resolver.resolve("user.profile.age"), 30);
});

Deno.test("VariableResolver - array access", () => {
  const data = {
    items: ["apple", "banana", "cherry"],
    users: [
      { name: "Alice", id: 1 },
      { name: "Bob", id: 2 },
    ],
  };
  const resolver = new VariableResolver(data);

  assertEquals(resolver.resolve("items[0]"), "apple");
  assertEquals(resolver.resolve("items[2]"), "cherry");
  assertEquals(resolver.resolve("users[0].name"), "Alice");
  assertEquals(resolver.resolve("users[1].id"), 2);
});

Deno.test("VariableResolver - complex nested access", () => {
  const data = {
    tools: {
      availableConfigs: ["git", "test"],
      commands: [
        {
          c1: "git",
          c2: "create",
          title: "Create Git Issue",
          options: {
            input: ["file", "stdin"],
            output: ["console"],
          },
        },
      ],
    },
  };
  const resolver = new VariableResolver(data);

  assertEquals(resolver.resolve("tools.availableConfigs[0]"), "git");
  assertEquals(resolver.resolve("tools.commands[0].title"), "Create Git Issue");
  assertEquals(resolver.resolve("tools.commands[0].options.input[1]"), "stdin");
});

Deno.test("VariableResolver - handle different value types", () => {
  const data = {
    stringValue: "hello",
    numberValue: 42,
    booleanValue: true,
    nullValue: null,
    arrayValue: [1, 2, 3],
    objectValue: { nested: "value" },
  };
  const resolver = new VariableResolver(data);

  assertEquals(resolver.resolve("stringValue"), "hello");
  assertEquals(resolver.resolve("numberValue"), 42);
  assertEquals(resolver.resolve("booleanValue"), true);
  assertEquals(resolver.resolve("nullValue"), null);
  assertEquals(resolver.resolve("arrayValue"), [1, 2, 3]);
  assertEquals(resolver.resolve("objectValue"), { nested: "value" });
});

Deno.test("VariableResolver - throws VariableNotFoundError for missing paths", () => {
  const data = { existing: "value" };
  const resolver = new VariableResolver(data);

  assertThrows(() => resolver.resolve("missing"), VariableNotFoundError);
  assertThrows(
    () => resolver.resolve("existing.missing"),
    VariableNotFoundError,
  );
  assertThrows(() => resolver.resolve("existing[0]"), VariableNotFoundError);
});

Deno.test("VariableResolver - throws VariableNotFoundError for invalid array access", () => {
  const data = { items: ["a", "b"] };
  const resolver = new VariableResolver(data);

  assertThrows(() => resolver.resolve("items[5]"), VariableNotFoundError);
  assertThrows(() => resolver.resolve("items[-1]"), VariableNotFoundError);
  assertThrows(() => resolver.resolve("items[abc]"), VariableNotFoundError);
});

Deno.test("VariableResolver - throws for null/undefined data", () => {
  const resolver = new VariableResolver(null);
  assertThrows(() => resolver.resolve("anything"), VariableNotFoundError);
});

Deno.test("VariableResolver - exists method", () => {
  const data = {
    existing: "value",
    nested: { prop: "value" },
    array: ["item"],
  };
  const resolver = new VariableResolver(data);

  assertEquals(resolver.exists("existing"), true);
  assertEquals(resolver.exists("nested.prop"), true);
  assertEquals(resolver.exists("array[0]"), true);
  assertEquals(resolver.exists("missing"), false);
  assertEquals(resolver.exists("nested.missing"), false);
  assertEquals(resolver.exists("array[5]"), false);
});

Deno.test("VariableResolver - extractVariables static method", () => {
  const template =
    '{"name": "{user.name}", "items": "{items[0]}", "count": "{count}"}';
  const variables = VariableResolver.extractVariables(template);

  assertEquals(variables.sort(), ["count", "items[0]", "user.name"]);
});

Deno.test("VariableResolver - extractVariables handles empty template", () => {
  const template = '{"static": "value"}';
  const variables = VariableResolver.extractVariables(template);

  assertEquals(variables, []);
});

Deno.test("VariableResolver - extractVariables handles multiple occurrences", () => {
  const template =
    '{"first": "{name}", "second": "{name}", "other": "{value}"}';
  const variables = VariableResolver.extractVariables(template);

  assertEquals(variables.sort(), ["name", "value"]);
});

Deno.test("VariableResolver - parsePath handles complex paths", () => {
  const data = {
    a: {
      b: [
        { c: [{ d: "value" }] },
      ],
    },
  };
  const resolver = new VariableResolver(data);

  assertEquals(resolver.resolve("a.b[0].c[0].d"), "value");
});

Deno.test("VariableResolver - handles empty string path", () => {
  const resolver = new VariableResolver({ test: "value" });
  assertThrows(() => resolver.resolve(""), VariableNotFoundError);
});
