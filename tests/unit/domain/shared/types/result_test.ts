import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { err, isErr, isOk, ok } from "../../../../../src/domain/shared/types/result.ts";
import { createError } from "../../../../../src/domain/shared/types/errors.ts";

describe("Result Type", () => {
  describe("ok function", () => {
    it("should create a successful result with data", () => {
      const result = ok("success");
      assertEquals(result.ok, true);
      assertEquals(result.data, "success");
    });

    it("should handle different data types", () => {
      const stringResult = ok("test");
      assertEquals(stringResult.data, "test");

      const numberResult = ok(42);
      assertEquals(numberResult.data, 42);

      const objectResult = ok({ key: "value" });
      assertEquals(objectResult.data, { key: "value" });

      const arrayResult = ok([1, 2, 3]);
      assertEquals(arrayResult.data, [1, 2, 3]);

      const nullResult = ok(null);
      assertEquals(nullResult.data, null);

      const undefinedResult = ok(undefined);
      assertEquals(undefinedResult.data, undefined);
    });
  });

  describe("err function", () => {
    it("should create an error result", () => {
      const error = createError({ kind: "EmptyInput" });
      const result = err(error);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "EmptyInput");
      }
    });

    it("should handle different error types", () => {
      const parseError = createError({
        kind: "ParseError",
        input: "invalid",
        field: "test",
      });
      const result = err(parseError);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ParseError");
      }
    });
  });

  describe("isOk function", () => {
    it("should return true for successful results", () => {
      const result = ok("success");
      assertEquals(isOk(result), true);
    });

    it("should return false for error results", () => {
      const error = createError({ kind: "EmptyInput" });
      const result = err(error);
      assertEquals(isOk(result), false);
    });

    it("should work as type guard", () => {
      const result = ok("test") as any;
      if (isOk(result)) {
        // TypeScript should narrow the type here
        assertExists(result.data);
        assertEquals(result.data, "test");
      }
    });
  });

  describe("isErr function", () => {
    it("should return false for successful results", () => {
      const result = ok("success");
      assertEquals(isErr(result), false);
    });

    it("should return true for error results", () => {
      const error = createError({ kind: "EmptyInput" });
      const result = err(error);
      assertEquals(isErr(result), true);
    });

    it("should work as type guard", () => {
      const error = createError({ kind: "EmptyInput" });
      const result = err(error);
      if (isErr(result)) {
        // TypeScript should narrow the type here
        assertExists(result.error);
        assertEquals(result.error.kind, "EmptyInput");
      }
    });
  });

  describe("Result type usage patterns", () => {
    it("should support chaining operations", () => {
      function divide(a: number, b: number) {
        if (b === 0) {
          return err(createError({
            kind: "InvalidType",
            expected: "non-zero divisor",
            actual: "zero",
          }));
        }
        return ok(a / b);
      }

      const result1 = divide(10, 2);
      assertEquals(isOk(result1), true);
      if (result1.ok) {
        assertEquals(result1.data, 5);
      }

      const result2 = divide(10, 0);
      assertEquals(isErr(result2), true);
      if (!result2.ok) {
        assertEquals(result2.error.kind, "InvalidType");
      }
    });

    it("should support mapping over results", () => {
      function mapOk<T, U, E>(
        result: { ok: true; data: T } | { ok: false; error: E },
        fn: (data: T) => U,
      ): { ok: true; data: U } | { ok: false; error: E } {
        if (result.ok) {
          return ok(fn(result.data));
        }
        return result;
      }

      const result = ok(5);
      const mapped = mapOk(result, (x) => x * 2);

      assertEquals(isOk(mapped), true);
      if (mapped.ok) {
        assertEquals(mapped.data, 10);
      }
    });

    it("should support flat mapping", () => {
      function flatMapOk<T, U, E>(
        result: { ok: true; data: T } | { ok: false; error: E },
        fn: (data: T) => { ok: true; data: U } | { ok: false; error: E },
      ): { ok: true; data: U } | { ok: false; error: E } {
        if (result.ok) {
          return fn(result.data);
        }
        return result;
      }

      const result = ok(5);
      const flatMapped = flatMapOk(result, (x) => {
        if (x > 0) {
          return ok(x * 2);
        }
        return err(createError({ kind: "OutOfRange", value: x }));
      });

      assertEquals(isOk(flatMapped), true);
      if (flatMapped.ok) {
        assertEquals(flatMapped.data, 10);
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle void results", () => {
      const voidResult = ok(void 0);
      assertEquals(voidResult.ok, true);
      assertEquals(voidResult.data, undefined);
    });

    it("should distinguish between null and undefined", () => {
      const nullResult = ok(null);
      const undefinedResult = ok(undefined);

      assertEquals(nullResult.data, null);
      assertEquals(undefinedResult.data, undefined);
    });

    it("should handle complex error types", () => {
      const complexError = createError({
        kind: "JMESPathCompilationFailed",
        expression: "[?foo == 'bar']",
        message: "Invalid expression",
      });
      const result = err(complexError);

      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "JMESPathCompilationFailed");
        const error = result.error as any;
        if (error.kind === "JMESPathCompilationFailed") {
          assertEquals(error.expression, "[?foo == 'bar']");
          assertEquals(error.message, "JMESPath expression compilation failed: [?foo == 'bar'] - Invalid expression");
        }
      }
    });
  });
});