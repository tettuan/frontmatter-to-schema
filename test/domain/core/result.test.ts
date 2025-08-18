import { assertEquals, assertThrows } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  type Result,
  type DomainError,
  type ValidationError,
  createDomainError,
  getDefaultErrorMessage,
  mapResult,
  flatMapResult,
  mapErrorResult,
  combineResults,
  unwrapResult,
  unwrapOrResult,
  ResultUtils,
  isSuccess,
  isFailure,
} from "../../../src/domain/core/result.ts";

// Test helper functions for creating test data
const createSuccessResult = <T>(data: T): Result<T, ValidationError & { message: string }> => ({
  ok: true,
  data,
});

const createErrorResult = <T>(error: ValidationError): Result<T, ValidationError & { message: string }> => ({
  ok: false,
  error: createDomainError(error),
});

Deno.test("Result type utilities", async (t) => {
  await t.step("createDomainError should create error with default message", () => {
    const error = createDomainError({ kind: "EmptyInput" });
    assertEquals(error.kind, "EmptyInput");
    assertEquals(error.message, "Input cannot be empty");
  });

  await t.step("createDomainError should use custom message when provided", () => {
    const customMessage = "Custom validation failed";
    const error = createDomainError({ kind: "EmptyInput" }, customMessage);
    assertEquals(error.kind, "EmptyInput");
    assertEquals(error.message, customMessage);
  });

  await t.step("getDefaultErrorMessage should provide correct messages for all error types", () => {
    const testCases: Array<{ error: ValidationError; expected: string }> = [
      { error: { kind: "EmptyInput" }, expected: "Input cannot be empty" },
      { 
        error: { kind: "InvalidFormat", input: "abc", expectedFormat: "number" }, 
        expected: 'Invalid format: expected number, got "abc"' 
      },
      { 
        error: { kind: "OutOfRange", value: 5, min: 0, max: 3 }, 
        expected: "Value 5 is out of range 0-3" 
      },
      { 
        error: { kind: "PatternMismatch", value: "abc", pattern: "\\d+" }, 
        expected: 'Value "abc" does not match pattern \\d+' 
      },
      { 
        error: { kind: "ParseError", input: "invalid", details: "Not valid JSON" }, 
        expected: 'Cannot parse "invalid": Not valid JSON' 
      },
      { 
        error: { kind: "TooLong", value: "toolong", maxLength: 5 }, 
        expected: 'Value "toolong" exceeds maximum length of 5' 
      },
      { 
        error: { kind: "TooShort", value: "hi", minLength: 5 }, 
        expected: 'Value "hi" is shorter than minimum length of 5' 
      },
      { 
        error: { kind: "InvalidRegex", pattern: "[" }, 
        expected: "Invalid regex pattern: [" 
      },
      { 
        error: { kind: "FileExtensionMismatch", path: "file.txt", expected: [".md", ".mdx"] }, 
        expected: 'File "file.txt" must have one of these extensions: .md, .mdx' 
      },
    ];

    testCases.forEach(({ error, expected }) => {
      assertEquals(getDefaultErrorMessage(error), expected);
    });
  });
});

Deno.test("Result utility functions", async (t) => {
  await t.step("mapResult should transform success value", () => {
    const result = createSuccessResult(5);
    const mapped = mapResult(result, (x) => x * 2);
    
    assertEquals(mapped.ok, true);
    if (mapped.ok) {
      assertEquals(mapped.data, 10);
    }
  });

  await t.step("mapResult should preserve error", () => {
    const result = createErrorResult<number>({ kind: "EmptyInput" });
    const mapped = mapResult(result, (x) => x * 2);
    
    assertEquals(mapped.ok, false);
    if (!mapped.ok) {
      assertEquals(mapped.error.kind, "EmptyInput");
    }
  });

  await t.step("flatMapResult should chain successful operations", () => {
    const result = createSuccessResult(5);
    const chained = flatMapResult(result, (x) => createSuccessResult(x * 2));
    
    assertEquals(chained.ok, true);
    if (chained.ok) {
      assertEquals(chained.data, 10);
    }
  });

  await t.step("flatMapResult should short-circuit on first error", () => {
    const result = createErrorResult<number>({ kind: "EmptyInput" });
    const chained = flatMapResult(result, (x) => createSuccessResult(x * 2));
    
    assertEquals(chained.ok, false);
    if (!chained.ok) {
      assertEquals(chained.error.kind, "EmptyInput");
    }
  });

  await t.step("flatMapResult should propagate chained operation error", () => {
    const result = createSuccessResult(5);
    const chained = flatMapResult(result, (_x) => createErrorResult<number>({ kind: "InvalidFormat", input: "test", expectedFormat: "number" }));
    
    assertEquals(chained.ok, false);
    if (!chained.ok) {
      assertEquals(chained.error.kind, "InvalidFormat");
    }
  });

  await t.step("mapErrorResult should transform error", () => {
    const result = createErrorResult<number>({ kind: "EmptyInput" });
    const mapped = mapErrorResult(result, (error) => createDomainError({ kind: "InvalidFormat", input: "transformed", expectedFormat: "test" }));
    
    assertEquals(mapped.ok, false);
    if (!mapped.ok) {
      assertEquals(mapped.error.kind, "InvalidFormat");
    }
  });

  await t.step("mapErrorResult should preserve success", () => {
    const result = createSuccessResult(42);
    const mapped = mapErrorResult(result, (error) => createDomainError({ kind: "InvalidFormat", input: "transformed", expectedFormat: "test" }));
    
    assertEquals(mapped.ok, true);
    if (mapped.ok) {
      assertEquals(mapped.data, 42);
    }
  });

  await t.step("combineResults should combine all successes", () => {
    const results = [
      createSuccessResult(1),
      createSuccessResult(2),
      createSuccessResult(3),
    ];
    const combined = combineResults(results);
    
    assertEquals(combined.ok, true);
    if (combined.ok) {
      assertEquals(combined.data, [1, 2, 3]);
    }
  });

  await t.step("combineResults should return first error", () => {
    const results = [
      createSuccessResult(1),
      createErrorResult<number>({ kind: "EmptyInput" }),
      createSuccessResult(3),
    ];
    const combined = combineResults(results);
    
    assertEquals(combined.ok, false);
    if (!combined.ok) {
      assertEquals(combined.error.kind, "EmptyInput");
    }
  });

  await t.step("combineResults should handle empty array", () => {
    const results: Result<number, ValidationError & { message: string }>[] = [];
    const combined = combineResults(results);
    
    assertEquals(combined.ok, true);
    if (combined.ok) {
      assertEquals(combined.data, []);
    }
  });

  await t.step("unwrapResult should return data for success", () => {
    const result = createSuccessResult(42);
    const value = unwrapResult(result);
    assertEquals(value, 42);
  });

  await t.step("unwrapResult should throw for error", () => {
    const result = createErrorResult<number>({ kind: "EmptyInput" });
    assertThrows(
      () => unwrapResult(result),
      Error,
      "Input cannot be empty",
    );
  });

  await t.step("unwrapOrResult should return data for success", () => {
    const result = createSuccessResult(42);
    const value = unwrapOrResult(result, 0);
    assertEquals(value, 42);
  });

  await t.step("unwrapOrResult should return default for error", () => {
    const result = createErrorResult<number>({ kind: "EmptyInput" });
    const value = unwrapOrResult(result, 0);
    assertEquals(value, 0);
  });
});

Deno.test("ResultUtils legacy namespace", async (t) => {
  await t.step("ResultUtils.unwrap should work like unwrapResult", () => {
    const successResult = createSuccessResult(42);
    assertEquals(ResultUtils.unwrap(successResult), 42);

    const errorResult = createErrorResult<number>({ kind: "EmptyInput" });
    assertThrows(
      () => ResultUtils.unwrap(errorResult),
      Error,
      "Input cannot be empty",
    );
  });

  await t.step("ResultUtils.map should work like mapResult", () => {
    const result = createSuccessResult(5);
    const mapped = ResultUtils.map(result, (x) => x * 2);
    
    assertEquals(mapped.ok, true);
    if (mapped.ok) {
      assertEquals(mapped.data, 10);
    }
  });

  await t.step("ResultUtils.flatMap should work like flatMapResult", () => {
    const result = createSuccessResult(5);
    const chained = ResultUtils.flatMap(result, (x) => createSuccessResult(x * 2));
    
    assertEquals(chained.ok, true);
    if (chained.ok) {
      assertEquals(chained.data, 10);
    }
  });

  await t.step("ResultUtils.chain should work like flatMapResult", () => {
    const result = createSuccessResult(5);
    const chained = ResultUtils.chain(result, (x) => createSuccessResult(x * 2));
    
    assertEquals(chained.ok, true);
    if (chained.ok) {
      assertEquals(chained.data, 10);
    }
  });

  await t.step("ResultUtils.all should work like combineResults", () => {
    const results = [
      createSuccessResult(1),
      createSuccessResult(2),
      createSuccessResult(3),
    ];
    const combined = ResultUtils.all(results);
    
    assertEquals(combined.ok, true);
    if (combined.ok) {
      assertEquals(combined.data, [1, 2, 3]);
    }
  });
});

Deno.test("Type guards", async (t) => {
  await t.step("isSuccess should correctly identify success results", () => {
    const successResult = createSuccessResult(42);
    const errorResult = createErrorResult<number>({ kind: "EmptyInput" });

    assertEquals(isSuccess(successResult), true);
    assertEquals(isSuccess(errorResult), false);

    // Type narrowing test
    if (isSuccess(successResult)) {
      // This should compile without errors - typescript type narrowing
      const _data: number = successResult.data;
    }
  });

  await t.step("isFailure should correctly identify error results", () => {
    const successResult = createSuccessResult(42);
    const errorResult = createErrorResult<number>({ kind: "EmptyInput" });

    assertEquals(isFailure(successResult), false);
    assertEquals(isFailure(errorResult), true);

    // Type narrowing test
    if (isFailure(errorResult)) {
      // This should compile without errors - typescript type narrowing
      const _error: ValidationError & { message: string } = errorResult.error;
    }
  });
});

Deno.test("Error handling edge cases", async (t) => {
  await t.step("should handle complex nested operations", () => {
    const result = createSuccessResult(5);
    
    const complex = flatMapResult(
      mapResult(result, (x) => x * 2),
      (x) => flatMapResult(
        createSuccessResult(x + 1),
        (y) => createSuccessResult(y.toString())
      )
    );
    
    assertEquals(complex.ok, true);
    if (complex.ok) {
      assertEquals(complex.data, "11");
    }
  });

  await t.step("should handle error propagation in complex operations", () => {
    const result = createErrorResult<number>({ kind: "EmptyInput" });
    
    const complex = flatMapResult(
      mapResult(result, (x) => x * 2),
      (x) => flatMapResult(
        createSuccessResult(x + 1),
        (y) => createSuccessResult(y.toString())
      )
    );
    
    assertEquals(complex.ok, false);
    if (!complex.ok) {
      assertEquals(complex.error.kind, "EmptyInput");
    }
  });

  await t.step("should handle error in middle of complex operations", () => {
    const result = createSuccessResult(5);
    
    const complex = flatMapResult(
      mapResult(result, (x) => x * 2),
      (x) => flatMapResult(
        createErrorResult<number>({ kind: "InvalidFormat", input: "test", expectedFormat: "number" }),
        (y) => createSuccessResult(y.toString())
      )
    );
    
    assertEquals(complex.ok, false);
    if (!complex.ok) {
      assertEquals(complex.error.kind, "InvalidFormat");
    }
  });
});