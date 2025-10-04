/**
 * Basic functionality tests for DataPathResolver.
 */

import { assertEquals, assertExists } from "@std/assert";
import { DataPathResolver, PathErrorCode } from "../src/mod.ts";

Deno.test("DataPathResolver - simple property access", () => {
  const data = { user: { name: "Alice" } };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<string>("user.name");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "Alice");
});

Deno.test("DataPathResolver - nested property access", () => {
  const data = {
    user: {
      profile: {
        email: "alice@example.com",
      },
    },
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<string>("user.profile.email");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "alice@example.com");
});

Deno.test("DataPathResolver - array index access", () => {
  const data = { items: ["apple", "banana", "cherry"] };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<string>("items[0]");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "apple");

  const result2 = resolver.resolve<string>("items[2]");
  assertEquals(result2.isOk(), true);
  assertEquals(result2.unwrap(), "cherry");
});

Deno.test("DataPathResolver - array expansion", () => {
  const data = {
    users: [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ],
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<string[]>("users[].name");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), ["Alice", "Bob"]);
});

Deno.test("DataPathResolver - double expansion (nested arrays)", () => {
  const data = {
    articles: [
      { tags: ["AI", "ML"] },
      { tags: ["Web", "TypeScript"] },
    ],
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<string[]>("articles[].tags[]");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), ["AI", "ML", "Web", "TypeScript"]);
});

Deno.test("DataPathResolver - exists() method", () => {
  const data = {
    user: { name: "Alice" },
    items: ["a", "b"],
  };
  const resolver = new DataPathResolver(data);

  assertEquals(resolver.exists("user.name"), true);
  assertEquals(resolver.exists("user.age"), false);
  assertEquals(resolver.exists("items[0]"), true);
  assertEquals(resolver.exists("items[5]"), false);
});

Deno.test("DataPathResolver - resolveAsArray() with array path", () => {
  const data = {
    users: [
      { name: "Alice" },
      { name: "Bob" },
    ],
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolveAsArray<string>("users[].name");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), ["Alice", "Bob"]);
});

Deno.test("DataPathResolver - resolveAsArray() with single value", () => {
  const data = { user: { name: "Alice" } };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolveAsArray<string>("user.name");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), ["Alice"]); // Wrapped in array
});

Deno.test("DataPathResolver - resolveAsArray() with non-existent path", () => {
  const data = { user: { name: "Alice" } };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolveAsArray<string>("user.age");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), []); // Empty array for PATH_NOT_FOUND
});

Deno.test("DataPathResolver - PATH_NOT_FOUND error", () => {
  const data = { user: { name: "Alice" } };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("user.age");
  assertEquals(result.isError(), true);
  const error = result.unwrapError();
  assertEquals(error.code, PathErrorCode.PATH_NOT_FOUND);
  assertExists(error.message);
});

Deno.test("DataPathResolver - ARRAY_EXPECTED error", () => {
  const data = { user: { name: "Alice" } };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("user.name[]");
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, PathErrorCode.ARRAY_EXPECTED);
});

Deno.test("DataPathResolver - INDEX_OUT_OF_BOUNDS error", () => {
  const data = { items: ["a", "b"] };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("items[5]");
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, PathErrorCode.INDEX_OUT_OF_BOUNDS);
});

Deno.test("DataPathResolver - INVALID_PATH_SYNTAX error", () => {
  const data = { user: { name: "Alice" } };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("user[name");
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, PathErrorCode.INVALID_PATH_SYNTAX);
});

Deno.test("DataPathResolver - complex path", () => {
  const data = {
    tools: {
      commands: [
        { name: "cmd1", options: { input: ["file1", "file2"] } },
        { name: "cmd2", options: { input: ["file3"] } },
      ],
    },
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<string>("tools.commands[0].options.input[0]");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "file1");
});

Deno.test("DataPathResolver - array expansion skips missing properties", () => {
  const data = {
    users: [
      { name: "Alice", age: 30 },
      { name: "Bob" }, // Missing age
      { name: "Charlie", age: 35 },
    ],
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<number[]>("users[].age");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), [30, 35]); // Bob's missing age is skipped
});
