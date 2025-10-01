/**
 * Edge cases tests for DataPathResolver.
 */

import { assertEquals } from "jsr:@std/assert@^1.0.14";
import { DataPathResolver, PathErrorCode } from "../src/mod.ts";

Deno.test("DataPathResolver - empty array", () => {
  const data = { items: [] };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<unknown[]>("items[]");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), []);
});

Deno.test("DataPathResolver - empty object", () => {
  const data = {};
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("user");
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, PathErrorCode.PATH_NOT_FOUND);
});

Deno.test("DataPathResolver - null value", () => {
  const data = { user: null };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("user");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), null);
});

Deno.test("DataPathResolver - undefined value", () => {
  const data = { user: { name: undefined } };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("user.name");
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, PathErrorCode.PATH_NOT_FOUND);
});

Deno.test("DataPathResolver - null in path", () => {
  const data = { user: null };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("user.name");
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, PathErrorCode.PATH_NOT_FOUND);
});

Deno.test("DataPathResolver - empty path string", () => {
  const data = { user: { name: "Alice" } };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve("");
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError().code, PathErrorCode.INVALID_PATH_SYNTAX);
});

Deno.test("DataPathResolver - deeply nested structure (10 levels)", () => {
  const data = {
    l1: {
      l2: {
        l3: {
          l4: {
            l5: {
              l6: {
                l7: {
                  l8: {
                    l9: {
                      l10: "deep value",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<string>("l1.l2.l3.l4.l5.l6.l7.l8.l9.l10");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), "deep value");
});

Deno.test("DataPathResolver - numeric values", () => {
  const data = { count: 42, price: 99.99 };
  const resolver = new DataPathResolver(data);

  const result1 = resolver.resolve<number>("count");
  assertEquals(result1.isOk(), true);
  assertEquals(result1.unwrap(), 42);

  const result2 = resolver.resolve<number>("price");
  assertEquals(result2.isOk(), true);
  assertEquals(result2.unwrap(), 99.99);
});

Deno.test("DataPathResolver - boolean values", () => {
  const data = { isActive: true, isDeleted: false };
  const resolver = new DataPathResolver(data);

  const result1 = resolver.resolve<boolean>("isActive");
  assertEquals(result1.isOk(), true);
  assertEquals(result1.unwrap(), true);

  const result2 = resolver.resolve<boolean>("isDeleted");
  assertEquals(result2.isOk(), true);
  assertEquals(result2.unwrap(), false);
});

Deno.test("DataPathResolver - array of primitives", () => {
  const data = { numbers: [1, 2, 3, 4, 5] };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<number[]>("numbers[]");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), [1, 2, 3, 4, 5]);
});

Deno.test("DataPathResolver - mixed type array", () => {
  const data = { mixed: [1, "two", true, null] };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<unknown[]>("mixed[]");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), [1, "two", true, null]);
});

Deno.test("DataPathResolver - triple nested arrays", () => {
  const data = {
    level1: [
      {
        level2: [
          { level3: [1, 2] },
          { level3: [3, 4] },
        ],
      },
      {
        level2: [
          { level3: [5, 6] },
        ],
      },
    ],
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<number[]>("level1[].level2[].level3[]");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), [1, 2, 3, 4, 5, 6]);
});

Deno.test("DataPathResolver - resolveAsArray with null value", () => {
  const data = { user: null };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolveAsArray("user");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), []);
});

Deno.test("DataPathResolver - resolveAsArray with undefined", () => {
  const data = { user: undefined };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolveAsArray("user");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), []);
});

Deno.test("DataPathResolver - array expansion with empty result", () => {
  const data = {
    users: [
      { name: "Alice" },
      { name: "Bob" },
    ],
  };
  const resolver = new DataPathResolver(data);

  const result = resolver.resolve<number[]>("users[].age");
  assertEquals(result.isOk(), true);
  assertEquals(result.unwrap(), []); // All elements missing 'age'
});
