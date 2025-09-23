import { assert, assertEquals } from "jsr:@std/assert@^1.0.6";
import { describe, it } from "jsr:@std/testing@^1.0.5/bdd";
import { ResultValidator } from "./result-validator.ts";
import { err, ok, Result } from "../types/result.ts";
import { createError } from "../types/errors.ts";

describe("ResultValidator", () => {
  describe("validateOrReturn", () => {
    it("returns the same result if successful", () => {
      const result = ok({ value: 42 });
      const validated = ResultValidator.validateOrReturn(result);
      assertEquals(validated, result);
    });

    it("returns error result if failed", () => {
      const error = createError({
        kind: "InvalidType",
        expected: "string",
        actual: "number",
      });
      const result = err(error);
      const validated = ResultValidator.validateOrReturn(result);
      assertEquals(validated, result);
    });
  });

  describe("validateAll", () => {
    it("returns ok if all results are successful", () => {
      const results = [ok(1), ok(2), ok(3)];
      const validated = ResultValidator.validateAll(...results);
      assertEquals(validated.ok, true);
    });

    it("returns first error if any result fails", () => {
      const error1 = createError({
        kind: "InvalidType",
        expected: "string",
        actual: "number",
      });
      const error2 = createError({ kind: "EmptyInput" });
      const results = [ok(1), err(error1), err(error2)] as Array<
        Result<unknown, typeof error1 | typeof error2>
      >;
      const validated = ResultValidator.validateAll(...results);
      assertEquals(validated.ok, false);
      if (!validated.ok) {
        assertEquals(validated.error, error1);
      }
    });
  });

  describe("mapOrReturn", () => {
    it("maps successful result", () => {
      const result = ok(5);
      const mapped = ResultValidator.mapOrReturn(result, (n) => n * 2);
      assertEquals(mapped, ok(10));
    });

    it("returns error without mapping if failed", () => {
      const error = createError({
        kind: "InvalidType",
        expected: "string",
        actual: "number",
      });
      const result = err(error);
      const mapped = ResultValidator.mapOrReturn(result, (n: number) => n * 2);
      assertEquals(mapped, result);
    });
  });

  describe("chainOrReturn", () => {
    it("chains successful result with async operation", async () => {
      const result = ok(5);
      const chained = await ResultValidator.chainOrReturn(
        result,
        (n) => Promise.resolve(ok(n * 2)),
      );
      assertEquals(chained, ok(10));
    });

    it("returns error without chaining if failed", async () => {
      const error = createError({
        kind: "InvalidType",
        expected: "string",
        actual: "number",
      });
      const result = err(error);
      const chained = await ResultValidator.chainOrReturn(
        result,
        (n: number) => Promise.resolve(ok(n * 2)),
      );
      assertEquals(chained, result);
    });
  });

  describe("unwrapOrThrow", () => {
    it("returns value if successful", () => {
      const result = ok(42);
      const value = ResultValidator.unwrapOrThrow(result, "test context");
      assertEquals(value, 42);
    });

    it("throws error with context if failed", () => {
      const error = createError({
        kind: "InvalidType",
        expected: "string",
        actual: "number",
      });
      const result = err(error);

      try {
        ResultValidator.unwrapOrThrow(result, "test context");
        throw new Error("Should have thrown");
      } catch (e) {
        assertEquals(e instanceof Error, true);
        if (e instanceof Error) {
          assertEquals(
            e.message,
            "test context: Expected type string, got number",
          );
        }
      }
    });
  });

  describe("createErrorResult", () => {
    it("creates standardized error result", () => {
      const result = ResultValidator.createErrorResult<string>(
        "InvalidType",
        "test message",
      );
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "InvalidType");
        assert(result.error.message && result.error.message.length > 0);
      }
    });
  });

  describe("collectResults", () => {
    it("collects all successful results", () => {
      const results = [ok(1), ok(2), ok(3)];
      const collected = ResultValidator.collectResults(results);
      assertEquals(collected, ok([1, 2, 3]));
    });

    it("returns first error if any fails", () => {
      const error = createError({
        kind: "InvalidType",
        expected: "string",
        actual: "number",
      });
      const results = [ok(1), err(error), ok(3)];
      const collected = ResultValidator.collectResults(results);
      assertEquals(collected, err(error));
    });
  });

  describe("tryAsync", () => {
    it("wraps successful async operation", async () => {
      const result = await ResultValidator.tryAsync(() => Promise.resolve(42));
      assertEquals(result, ok(42));
    });

    it("catches and wraps async errors", async () => {
      const result = await ResultValidator.tryAsync(
        () => Promise.reject(new Error("test error")),
        "ConfigurationError",
      );
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assert(result.error.message.includes("test error"));
      }
    });
  });

  describe("try", () => {
    it("wraps successful sync operation", () => {
      const result = ResultValidator.try(() => 42);
      assertEquals(result, ok(42));
    });

    it("catches and wraps sync errors", () => {
      const result = ResultValidator.try(
        () => {
          throw new Error("test error");
        },
        "ConfigurationError",
      );
      assertEquals(result.ok, false);
      if (!result.ok) {
        assertEquals(result.error.kind, "ConfigurationError");
        assert(result.error.message.includes("test error"));
      }
    });
  });
});
