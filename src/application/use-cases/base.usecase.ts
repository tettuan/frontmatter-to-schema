/**
 * Base Use Case Interface
 *
 * Following DDD and Totality principles
 * All use cases must return Result types for error handling
 */

import type { Result } from "../../domain/core/result.ts";
import type { DomainError } from "../../domain/core/result.ts";

/**
 * Base interface for all use cases
 * Enforces Result type return for Totality
 */
export interface UseCase<TInput, TOutput> {
  /**
   * Execute the use case with given input
   * @param input - The input parameters for the use case
   * @returns Result containing output or error
   */
  execute(
    input: TInput,
  ): Promise<Result<TOutput, DomainError & { message: string }>>;
}

/**
 * Synchronous use case interface
 */
export interface SyncUseCase<TInput, TOutput> {
  /**
   * Execute the use case synchronously
   * @param input - The input parameters for the use case
   * @returns Result containing output or error
   */
  execute(
    input: TInput,
  ): Result<TOutput, DomainError & { message: string }>;
}

/**
 * Use case without input parameters
 */
export interface NoInputUseCase<TOutput> {
  /**
   * Execute the use case without input
   * @returns Result containing output or error
   */
  execute(): Promise<Result<TOutput, DomainError & { message: string }>>;
}

/**
 * Use case without output (void operations)
 */
export interface VoidUseCase<TInput> {
  /**
   * Execute the use case that performs side effects
   * @param input - The input parameters for the use case
   * @returns Result indicating success or error
   */
  execute(
    input: TInput,
  ): Promise<Result<void, DomainError & { message: string }>>;
}
