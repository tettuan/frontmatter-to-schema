/**
 * Result Type Test Matchers - Totality Compliant Testing
 * Provides type-safe assertion helpers for Result<T, E> patterns
 * Following robust test principles from climpt-build
 */

import { assertEquals } from "jsr:@std/assert";

// Core Result type for new architecture
export type Result<T, E> = { ok: true; data: T } | { ok: false; error: E };

// Domain Error types for new architecture
export type DomainError =
  | { kind: "SchemaError"; message: string }
  | { kind: "FrontmatterError"; message: string }
  | { kind: "TemplateError"; message: string }
  | { kind: "FileError"; message: string }
  | { kind: "ValidationError"; message: string }
  | { kind: "ProcessingError"; message: string }
  | { kind: "EmptyInput"; message: string }
  | {
    kind: "InvalidFormat";
    message: string;
    input: string;
    expectedFormat: string;
  }
  | {
    kind: "OutOfRange";
    message: string;
    value: unknown;
    min?: number;
    max?: number;
  };

/**
 * Assert that Result is Ok variant - Totality compliant
 * Provides type narrowing for successful results
 */
export function assertOk<T, E>(
  result: Result<T, E>,
): asserts result is { ok: true; data: T } {
  if (!result.ok) {
    throw new Error(
      `Expected Ok but got Error: ${JSON.stringify(result.error)}`,
    );
  }
}

/**
 * Assert that Result is Error variant - Totality compliant
 * Provides type narrowing for error results
 */
export function assertError<T, E>(
  result: Result<T, E>,
): asserts result is { ok: false; error: E } {
  if (result.ok) {
    throw new Error(
      `Expected Error but got Ok: ${JSON.stringify(result.data)}`,
    );
  }
}

/**
 * Assert specific error kind - Domain-specific validation
 * Ensures proper error discrimination in domain logic
 */
export function assertErrorKind<T>(
  result: Result<T, DomainError>,
  expectedKind: DomainError["kind"],
): void {
  assertError(result);
  assertEquals(result.error.kind, expectedKind);
}

/**
 * Assert error with message validation
 * Provides comprehensive error content verification
 */
export function assertErrorMessage<T>(
  result: Result<T, DomainError>,
  expectedKind: DomainError["kind"],
  expectedMessage: string,
): void {
  assertError(result);
  assertEquals(result.error.kind, expectedKind);
  assertEquals(result.error.message, expectedMessage);
}

/**
 * Create success result helper - Test data generation
 * Simplifies test setup for success cases
 */
export function createOk<T, E>(data: T): Result<T, E> {
  return { ok: true, data };
}

/**
 * Create error result helper - Test data generation
 * Simplifies test setup for error cases
 */
export function createError<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

/**
 * Create domain error helper - Domain-specific test utilities
 * Follows Smart Constructor pattern for error creation
 */
export function createDomainError(
  kind: DomainError["kind"],
  message: string,
  additionalFields: Record<string, unknown> = {},
): DomainError {
  return { kind, message, ...additionalFields } as DomainError;
}

/**
 * Assert result data equals expected value
 * Combines result validation with data verification
 */
export function assertOkWith<T, E>(
  result: Result<T, E>,
  expectedData: T,
): void {
  assertOk(result);
  assertEquals(result.data, expectedData);
}

/**
 * Utility for testing async Result operations
 * Simplifies async/await patterns in tests
 */
export async function assertAsyncOk<T, E>(
  resultPromise: Promise<Result<T, E>>,
): Promise<T> {
  const result = await resultPromise;
  assertOk(result);
  return result.data;
}

/**
 * Utility for testing async Result error operations
 * Simplifies async error testing patterns
 */
export async function assertAsyncError<T, E>(
  resultPromise: Promise<Result<T, E>>,
): Promise<E> {
  const result = await resultPromise;
  assertError(result);
  return result.error;
}
