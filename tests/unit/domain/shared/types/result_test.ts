import { assertEquals, assertThrows } from "jsr:@std/assert";
import { Result } from "../../../../../src/domain/shared/types/result.ts";

Deno.test("Result - Success case", () => {
  const result = Result.ok("success value");

  assertEquals(result.isOk(), true);
  assertEquals(result.isError(), false);
  assertEquals(result.unwrap(), "success value");
});

Deno.test("Result - Error case", () => {
  const result = Result.error("error message");

  assertEquals(result.isOk(), false);
  assertEquals(result.isError(), true);
  assertEquals(result.unwrapError(), "error message");
});

Deno.test("Result - unwrap() throws on error", () => {
  const result = Result.error("error message");

  assertThrows(
    () => {
      result.unwrap();
    },
    Error,
    "Result is an error",
  );
});

Deno.test("Result - unwrapError() throws on success", () => {
  const result = Result.ok("success value");

  assertThrows(
    () => {
      result.unwrapError();
    },
    Error,
    "Result is not an error",
  );
});

Deno.test("Result - map transforms success value", () => {
  const result = Result.ok(5);
  const mapped = result.map((x: number) => x * 2);

  assertEquals(mapped.unwrap(), 10);
});

Deno.test("Result - map does not transform error", () => {
  const result: Result<number, string> = Result.error("original error");
  const mapped = result.map((x: number) => x * 2);

  assertEquals(mapped.isError(), true);
  assertEquals(mapped.unwrapError(), "original error");
});

Deno.test("Result - mapError transforms error", () => {
  const result = Result.error("original error");
  const mapped = result.mapError((err) => `transformed: ${err}`);

  assertEquals(mapped.unwrapError(), "transformed: original error");
});

Deno.test("Result - mapError does not transform success", () => {
  const result = Result.ok("success value");
  const mapped = result.mapError((err) => `transformed: ${err}`);

  assertEquals(mapped.isOk(), true);
  assertEquals(mapped.unwrap(), "success value");
});

Deno.test("Result - andThen chains successful operations", () => {
  const result = Result.ok(5);
  const chained = result.andThen((x: number) => Result.ok(x * 2));

  assertEquals(chained.unwrap(), 10);
});

Deno.test("Result - andThen stops on first error", () => {
  const result: Result<number, string> = Result.error("original error");
  const chained = result.andThen((x: number) => Result.ok(x * 2));

  assertEquals(chained.isError(), true);
  assertEquals(chained.unwrapError(), "original error");
});

Deno.test("Result - match handles both cases", () => {
  const successResult = Result.ok(42);
  const errorResult = Result.error("test error");

  const successMessage = successResult.match(
    (value) => `Success: ${value}`,
    (error) => `Error: ${error}`,
  );

  const errorMessage = errorResult.match(
    (value) => `Success: ${value}`,
    (error) => `Error: ${error}`,
  );

  assertEquals(successMessage, "Success: 42");
  assertEquals(errorMessage, "Error: test error");
});
