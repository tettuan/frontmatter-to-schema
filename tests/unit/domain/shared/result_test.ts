import { assertEquals } from "jsr:@std/assert";
import {
  chain,
  combine,
  err,
  isErr,
  isOk,
  map,
  ok,
  unwrapOr,
} from "../../../../src/domain/shared/types/result.ts";

Deno.test("Result - ok creates success result", () => {
  const result = ok("test");
  assertEquals(result.ok, true);
  assertEquals(result.data, "test");
});

Deno.test("Result - err creates error result", () => {
  const result = err("error");
  assertEquals(result.ok, false);
  assertEquals(result.error, "error");
});

Deno.test("Result - isOk identifies success results", () => {
  const success = ok("test");
  const error = err("error");

  assertEquals(isOk(success), true);
  assertEquals(isOk(error), false);
});

Deno.test("Result - isErr identifies error results", () => {
  const success = ok("test");
  const error = err("error");

  assertEquals(isErr(success), false);
  assertEquals(isErr(error), true);
});

Deno.test("Result - map transforms success values", () => {
  const result = ok(5);
  const mapped = map(result, (x: number) => x * 2);

  assertEquals(isOk(mapped), true);
  if (isOk(mapped)) {
    assertEquals(mapped.data, 10);
  }
});

Deno.test("Result - map preserves errors", () => {
  const result = err("error");
  const mapped = map(result, (x: number) => x * 2);

  assertEquals(isErr(mapped), true);
  if (isErr(mapped)) {
    assertEquals(mapped.error, "error");
  }
});

Deno.test("Result - chain transforms success values", () => {
  const result = ok(5);
  const chained = chain(result, (x: number) => ok(x * 2));

  assertEquals(isOk(chained), true);
  if (isOk(chained)) {
    assertEquals(chained.data, 10);
  }
});

Deno.test("Result - chain propagates errors", () => {
  const result = err("error");
  const chained = chain(result, (x: number) => ok(x * 2));

  assertEquals(isErr(chained), true);
  if (isErr(chained)) {
    assertEquals(chained.error, "error");
  }
});

Deno.test("Result - combine succeeds with all success", () => {
  const results = [ok(1), ok(2), ok(3)];
  const combined = combine(results);

  assertEquals(isOk(combined), true);
  if (isOk(combined)) {
    assertEquals(combined.data, [1, 2, 3]);
  }
});

Deno.test("Result - combine fails with any error", () => {
  const results = [ok(1), err("error"), ok(3)];
  const combined = combine(results);

  assertEquals(isErr(combined), true);
  if (isErr(combined)) {
    assertEquals(combined.error, "error");
  }
});

Deno.test("Result - unwrapOr returns value for success", () => {
  const result = ok("test");
  assertEquals(unwrapOr(result, "default"), "test");
});

Deno.test("Result - unwrapOr returns default for error", () => {
  const result = err("error");
  assertEquals(unwrapOr(result, "default"), "default");
});

// Note: unwrap function removed for Totality compliance (Issue #849)
// Use unwrapOr, map, or proper Result handling instead of throwing exceptions
