/**
 * Result Repository Interface
 * Defines contract for processing result management
 * Follows DDD principles with Repository pattern
 */

import type { DomainError, Result } from "../core/result.ts";
import type { ProcessingResult } from "../core/abstractions.ts";

/**
 * Repository interface for processing result management
 */
export interface ResultRepository<T = unknown> {
  /**
   * Store a processing result
   * @param result - The processing result to store
   * @returns Result indicating success or error
   */
  store(
    result: ProcessingResult<T>,
  ): Promise<Result<void, DomainError & { message: string }>>;

  /**
   * Retrieve a processing result by ID
   * @param id - The ID of the result to retrieve
   * @returns Result containing the ProcessingResult or error
   */
  retrieve(
    id: string,
  ): Promise<Result<ProcessingResult<T>, DomainError & { message: string }>>;

  /**
   * List all stored results
   * @returns Result containing array of ProcessingResults
   */
  list(): Promise<
    Result<ProcessingResult<T>[], DomainError & { message: string }>
  >;

  /**
   * Validate a processing result
   * @param result - Result to validate
   * @returns Result indicating validity
   */
  validate(
    result: ProcessingResult<T>,
  ): Result<void, DomainError & { message: string }>;
}
