/**
 * Tests for shared types and helper functions
 * Tests error creation helpers and result combinators
 */

import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import {
  createError,
  flatMapResult,
  isError,
  isOk,
  mapResult,
  type Result,
  unwrapOr,
  type ValidationError,
  wrapAsync,
} from "../../../../src/domain/shared/types.ts";

Deno.test("Error Creation Helpers", async (t) => {
  await t.step("should create ValidationError with message and code", () => {
    const error = createError({
      kind: "ValidationError",
      message: "Custom validation error",
    });

    assertEquals(error.kind, "ValidationError");
    assertStringIncludes(error.message, "Custom validation error");
    assertEquals(typeof error.code, "string");
  });

  await t.step(
    "should create ExtractionFailed error with default message",
    () => {
      const error = createError({
        kind: "ExtractionFailed",
        document: "test.md",
        reason: "Invalid format",
      });

      assertEquals(error.kind, "ExtractionFailed");
      assertStringIncludes(error.message, "test.md");
      assertStringIncludes(error.message, "Invalid format");
      assertEquals(typeof error.code, "string");
    },
  );

  await t.step("should create AnalysisFailed error", () => {
    const error = createError({
      kind: "AnalysisFailed",
      document: "analysis.md",
      reason: "Schema mismatch",
    });

    assertEquals(error.kind, "AnalysisFailed");
    assertStringIncludes(error.message, "analysis.md");
    assertStringIncludes(error.message, "Schema mismatch");
  });

  await t.step("should create MappingFailed error", () => {
    const error = createError({
      kind: "MappingFailed",
      document: "template.json",
      reason: "Template invalid",
    });

    assertEquals(error.kind, "MappingFailed");
    assertStringIncludes(error.message, "template.json");
    assertStringIncludes(error.message, "Template invalid");
  });

  await t.step("should create AggregationFailed error", () => {
    const error = createError({
      kind: "AggregationFailed",
      reason: "Cannot combine results",
    });

    assertEquals(error.kind, "AggregationFailed");
    assertStringIncludes(error.message, "Cannot combine results");
  });

  await t.step("should create ConfigurationInvalid error", () => {
    const validationErrors: ValidationError[] = [
      { kind: "ValidationError", message: "Field required" },
      { kind: "ValidationError", message: "Invalid type" },
    ];

    const error = createError({
      kind: "ConfigurationInvalid",
      errors: validationErrors,
    });

    assertEquals(error.kind, "ConfigurationInvalid");
    assertEquals(error.errors, validationErrors);
  });

  await t.step("should create FileNotFound IO error", () => {
    const error = createError({
      kind: "FileNotFound",
      path: "/path/to/missing/file.txt",
    });

    assertEquals(error.kind, "FileNotFound");
    assertStringIncludes(error.message, "/path/to/missing/file.txt");
  });

  await t.step("should create PermissionDenied IO error", () => {
    const error = createError({
      kind: "PermissionDenied",
      path: "/restricted/file.txt",
    });

    assertEquals(error.kind, "PermissionDenied");
    assertStringIncludes(error.message, "/restricted/file.txt");
  });

  await t.step("should create ReadError IO error", () => {
    const error = createError({
      kind: "ReadError",
      path: "/file.txt",
      reason: "Disk error",
    });

    assertEquals(error.kind, "ReadError");
    assertStringIncludes(error.message, "/file.txt");
    assertStringIncludes(error.message, "Disk error");
  });

  await t.step("should create WriteError IO error", () => {
    const error = createError({
      kind: "WriteError",
      path: "/output/file.txt",
      reason: "No space left",
    });

    assertEquals(error.kind, "WriteError");
    assertStringIncludes(error.message, "/output/file.txt");
    assertStringIncludes(error.message, "No space left");
  });

  await t.step("should create PromptTooLong AI error", () => {
    const error = createError({
      kind: "PromptTooLong",
      length: 1000,
      maxLength: 500,
    });

    assertEquals(error.kind, "PromptTooLong");
    assertEquals(error.length, 1000);
    assertEquals(error.maxLength, 500);
    assertStringIncludes(error.message, "1000");
    assertStringIncludes(error.message, "500");
  });

  await t.step("should create APIError with message and code", () => {
    const error = createError({
      kind: "APIError",
      message: "Rate limit exceeded",
      code: "429",
    });

    assertEquals(error.kind, "APIError");
    // The original code is overridden by the error code from getErrorCode
    assertEquals(typeof error.code, "string");
    assertStringIncludes(error.message, "Rate limit exceeded");
    assertStringIncludes(error.message, "429"); // The original code should be in the message
  });

  await t.step("should create APIError without code", () => {
    const error = createError({
      kind: "APIError",
      message: "Network error",
    });

    assertEquals(error.kind, "APIError");
    assertStringIncludes(error.message, "Network error");
  });

  await t.step("should create RateLimited error with retryAfter", () => {
    const error = createError({
      kind: "RateLimited",
      retryAfter: 60,
    });

    assertEquals(error.kind, "RateLimited");
    assertEquals(error.retryAfter, 60);
    assertStringIncludes(error.message, "60");
  });

  await t.step("should create RateLimited error without retryAfter", () => {
    const error = createError({
      kind: "RateLimited",
    });

    assertEquals(error.kind, "RateLimited");
    assertEquals((error as { retryAfter?: number }).retryAfter, undefined);
  });

  await t.step("should create InvalidResponse error", () => {
    const error = createError({
      kind: "InvalidResponse",
      response: "Invalid JSON response",
    });

    assertEquals(error.kind, "InvalidResponse");
    assertStringIncludes(error.message, "Invalid JSON response");
  });

  await t.step("should handle unknown error kind", () => {
    const error = createError({
      kind: "UnknownError",
    } as { kind: string });

    assertStringIncludes(error.message, "UnknownError");
  });

  await t.step("should override default message when provided", () => {
    const customMessage = "Custom override message";
    const error = createError({
      kind: "FileNotFound",
      path: "/some/path",
    }, customMessage);

    assertEquals(error.message, customMessage);
  });

  await t.step("should handle various error message types", () => {
    // EmptyInput
    const emptyInputError = createError(
      { kind: "EmptyInput" } as { kind: string },
    );
    assertStringIncludes(emptyInputError.message, "empty");

    // InvalidFormat
    const invalidFormatError = createError({
      kind: "InvalidFormat",
      format: "JSON",
      input: "invalid-json",
    } as { kind: string; format: string; input: string });
    assertStringIncludes(invalidFormatError.message, "JSON");
    assertStringIncludes(invalidFormatError.message, "invalid-json");

    // PatternMismatch
    const patternError = createError({
      kind: "PatternMismatch",
      pattern: "\\d+",
      input: "abc",
    } as { kind: string; pattern: string; input: string });
    assertStringIncludes(patternError.message, "\\d+");
    assertStringIncludes(patternError.message, "abc");

    // OutOfRange
    const rangeError = createError({
      kind: "OutOfRange",
      value: 150,
      min: 0,
      max: 100,
    } as { kind: string; value: number; min: number; max: number });
    assertStringIncludes(rangeError.message, "150");

    // InvalidPath
    const pathError = createError({
      kind: "InvalidPath",
      path: "/invalid/path",
      reason: "Does not exist",
    } as { kind: string; path: string; reason: string });
    assertStringIncludes(pathError.message, "/invalid/path");
    assertStringIncludes(pathError.message, "Does not exist");

    // SchemaValidation
    const schemaError = createError({
      kind: "SchemaValidation",
      errors: ["error1", "error2"],
    } as { kind: string; errors: unknown[] });
    assertStringIncludes(schemaError.message.toLowerCase(), "schema");

    // TemplateValidation
    const templateError = createError({
      kind: "TemplateValidation",
      errors: ["template error"],
    } as { kind: string; errors: unknown[] });
    assertStringIncludes(templateError.message.toLowerCase(), "template");
  });
});

Deno.test("Result Type Guards", async (t) => {
  await t.step("isOk should correctly identify success results", () => {
    const successResult: Result<number, string> = { ok: true, data: 42 };
    const errorResult: Result<number, string> = { ok: false, error: "error" };

    assertEquals(isOk(successResult), true);
    assertEquals(isOk(errorResult), false);

    // Type narrowing test
    if (isOk(successResult)) {
      assertEquals(successResult.data, 42);
    }
  });

  await t.step("isError should correctly identify error results", () => {
    const successResult: Result<number, string> = { ok: true, data: 42 };
    const errorResult: Result<number, string> = { ok: false, error: "error" };

    assertEquals(isError(successResult), false);
    assertEquals(isError(errorResult), true);

    // Type narrowing test
    if (isError(errorResult)) {
      assertEquals(errorResult.error, "error");
    }
  });
});

Deno.test("Result Combinators", async (t) => {
  await t.step("unwrapOr should return data for success result", () => {
    const successResult: Result<number, string> = { ok: true, data: 42 };
    const value = unwrapOr(successResult, 0);
    assertEquals(value, 42);
  });

  await t.step("unwrapOr should return default for error result", () => {
    const errorResult: Result<number, string> = { ok: false, error: "error" };
    const value = unwrapOr(errorResult, 99);
    assertEquals(value, 99);
  });

  await t.step("mapResult should transform success result", () => {
    const successResult: Result<number, string> = { ok: true, data: 42 };
    const mapped = mapResult(successResult, (x) => x * 2);

    assertEquals(isOk(mapped), true);
    if (isOk(mapped)) {
      assertEquals(mapped.data, 84);
    }
  });

  await t.step("mapResult should pass through error result", () => {
    const errorResult: Result<number, string> = { ok: false, error: "error" };
    const mapped = mapResult(errorResult, (x: number) => x * 2);

    assertEquals(isError(mapped), true);
    if (isError(mapped)) {
      assertEquals(mapped.error, "error");
    }
  });

  await t.step("flatMapResult should chain success results", () => {
    const successResult: Result<number, string> = { ok: true, data: 42 };
    const chained = flatMapResult(
      successResult,
      (x) => ({ ok: true, data: x.toString() }),
    );

    assertEquals(isOk(chained), true);
    if (isOk(chained)) {
      assertEquals(chained.data, "42");
    }
  });

  await t.step("flatMapResult should chain to error result", () => {
    const successResult: Result<number, string> = { ok: true, data: 42 };
    const chained = flatMapResult(
      successResult,
      (_x) => ({ ok: false, error: "chained error" }),
    );

    assertEquals(isError(chained), true);
    if (isError(chained)) {
      assertEquals(chained.error, "chained error");
    }
  });

  await t.step("flatMapResult should pass through error result", () => {
    const errorResult: Result<number, string> = {
      ok: false,
      error: "original error",
    };
    const chained = flatMapResult(
      errorResult,
      (x: number) => ({ ok: true, data: x.toString() }),
    );

    assertEquals(isError(chained), true);
    if (isError(chained)) {
      assertEquals(chained.error, "original error");
    }
  });
});

Deno.test("wrapAsync", async (t) => {
  await t.step("should wrap successful promise", async () => {
    const promise = Promise.resolve(42);
    const result = await wrapAsync(promise, (error) => String(error));

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data, 42);
    }
  });

  await t.step("should wrap rejected promise", async () => {
    const promise = Promise.reject(new Error("Test error"));
    const result = await wrapAsync(
      promise,
      (error) => (error as Error).message,
    );

    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error, "Test error");
    }
  });

  await t.step("should use error mapper for non-Error rejections", async () => {
    const promise = Promise.reject("string error");
    const result = await wrapAsync(promise, (error) => `Mapped: ${error}`);

    assertEquals(isError(result), true);
    if (isError(result)) {
      assertEquals(result.error, "Mapped: string error");
    }
  });

  await t.step("should handle async operations", async () => {
    const asyncOperation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return "async result";
    };

    const result = await wrapAsync(asyncOperation(), (error) => String(error));

    assertEquals(isOk(result), true);
    if (isOk(result)) {
      assertEquals(result.data, "async result");
    }
  });
});
