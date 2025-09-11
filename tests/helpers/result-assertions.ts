/**
 * Result Assertions Helper
 * 
 * Type-safe assertion helpers for Result types in tests
 * Eliminates boilerplate error checking and improves test readability
 * Follows Totality principles with exhaustive error handling
 * 
 * Part of Issue #664: Test Setup Duplication Refactoring
 */

import { assertEquals } from "jsr:@std/assert";
import type { Result } from "../../src/domain/core/result.ts";

/**
 * Type-safe assertion helpers for Result pattern testing
 * Provides clear error messages and proper type narrowing
 */
export class ResultAssertions {
  private constructor() {
    // Prevent instantiation - static utility class only
  }

  /**
   * Assert that a Result is an error with specific kind
   * Returns the error for further inspection
   */
  static assertError<T, E extends { kind: string }>(
    result: Result<T, E>,
    expectedKind: string,
    customMessage?: string
  ): E {
    const message = customMessage || `Expected error with kind "${expectedKind}"`;
    
    assertEquals(
      result.ok, 
      false, 
      `${message}, but got success with data: ${JSON.stringify(result.ok ? (result as any).data : null)}`
    );
    
    if (result.ok) {
      // Type guard failed - this should not happen due to assertEquals above
      throw new Error(`Type system inconsistency: result.ok is true but should be false`);
    }
    
    assertEquals(
      result.error.kind,
      expectedKind,
      `${message}, but got error kind "${result.error.kind}" with error: ${JSON.stringify(result.error)}`
    );
    
    return result.error;
  }

  /**
   * Assert that a Result is successful
   * Returns the data for further use in tests
   */
  static assertSuccess<T, E>(
    result: Result<T, E>,
    customMessage?: string
  ): T {
    const message = customMessage || "Expected successful result";
    
    assertEquals(
      result.ok, 
      true, 
      `${message}, but got error: ${JSON.stringify(!result.ok ? (result as any).error : null)}`
    );
    
    if (!result.ok) {
      // Type guard failed - this should not happen due to assertEquals above
      throw new Error(`Type system inconsistency: result.ok is false but should be true`);
    }
    
    return result.data;
  }

  /**
   * Assert specific error kind and message pattern
   * Useful for detailed error validation
   */
  static assertErrorWithMessage<T, E extends { kind: string; message: string }>(
    result: Result<T, E>,
    expectedKind: string,
    messagePattern: string | RegExp,
    customMessage?: string
  ): E {
    const error = this.assertError(result, expectedKind, customMessage);
    
    if (typeof messagePattern === "string") {
      assertEquals(
        error.message,
        messagePattern,
        `Expected error message "${messagePattern}", but got "${error.message}"`
      );
    } else {
      assertEquals(
        messagePattern.test(error.message),
        true,
        `Expected error message to match pattern ${messagePattern}, but got "${error.message}"`
      );
    }
    
    return error;
  }

  /**
   * Assert that Result is error of any kind (for negative testing)
   * Returns the error without kind validation
   */
  static assertAnyError<T, E>(
    result: Result<T, E>,
    customMessage?: string
  ): E {
    const message = customMessage || "Expected any error";
    
    assertEquals(
      result.ok,
      false,
      `${message}, but got success with data: ${JSON.stringify(result.ok ? (result as any).data : null)}`
    );
    
    if (result.ok) {
      throw new Error(`Type system inconsistency: result.ok is true but should be false`);
    }
    
    return result.error;
  }

  /**
   * Assert Result success and validate data properties
   * Combines success assertion with data validation
   */
  static assertSuccessWithData<T extends Record<string, unknown>, E>(
    result: Result<T, E>,
    dataValidator: (data: T) => boolean,
    validationMessage: string,
    customMessage?: string
  ): T {
    const data = this.assertSuccess(result, customMessage);
    
    assertEquals(
      dataValidator(data),
      true,
      `Data validation failed: ${validationMessage}. Data: ${JSON.stringify(data)}`
    );
    
    return data;
  }

  /**
   * Utility for testing processing stage errors (common pattern)
   * Specifically for DocumentProcessor error scenarios
   */
  static assertProcessingStageError<T>(
    result: Result<T, { kind: string; message: string }>,
    customMessage?: string
  ): { kind: string; message: string } {
    return this.assertError(result, "ProcessingStageError", customMessage);
  }

  /**
   * Utility for testing file system errors (common pattern)
   * Specifically for file operation error scenarios
   */
  static assertFileSystemError<T>(
    result: Result<T, { kind: string; message: string }>,
    expectedKind: "FileNotFound" | "DirectoryNotFound" | "WriteError" | "ReadError",
    customMessage?: string
  ): { kind: string; message: string } {
    return this.assertError(result, expectedKind, customMessage);
  }

  /**
   * Utility for testing parsing errors (common pattern)
   * Specifically for schema/template/markdown parsing error scenarios
   */
  static assertParsingError<T>(
    result: Result<T, { kind: string; message: string }>,
    customMessage?: string
  ): { kind: string; message: string } {
    return this.assertError(result, "ParseError", customMessage);
  }
}