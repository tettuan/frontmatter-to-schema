/**
 * @fileoverview Validation Helpers for DDD/Totality Compliance
 * @description Centralized validation functions to eliminate code duplication
 * Following DDD principles with domain-specific validation logic
 */

import { err, ok, Result } from "../types/result.ts";
import { createError, DomainError } from "../types/errors.ts";
import { VALIDATION_CONSTANTS } from "../constants/processing-constants.ts";

/**
 * Common validation result types
 */
export type ValidationResult<T> = Result<T, DomainError & { message: string }>;

/**
 * Processing results with errors tracking
 */
export interface ProcessingResults<T> {
  readonly results: T[];
  readonly errors: (DomainError & { message: string })[];
}

/**
 * Validation helpers following Totality principles
 * All functions return Result<T,E> for total function guarantees
 */
export class ValidationHelpers {
  /**
   * Check if array is empty (replaces: processedData.length === 0)
   */
  static isEmptyArray<T>(array: T[]): boolean {
    return array.length === VALIDATION_CONSTANTS.EMPTY_SIZE;
  }

  /**
   * Check if only errors exist in processing results
   * (replaces: results.length === 0 && errors.length > 0)
   */
  static hasOnlyErrors<T>(processingResults: ProcessingResults<T>): boolean {
    return this.isEmptyArray(processingResults.results) &&
      !this.isEmptyArray(processingResults.errors);
  }

  /**
   * Check if processing was successful (has results, no errors)
   */
  static isProcessingSuccessful<T>(
    processingResults: ProcessingResults<T>,
  ): boolean {
    return !this.isEmptyArray(processingResults.results) &&
      this.isEmptyArray(processingResults.errors);
  }

  /**
   * Check if processing has mixed results (both results and errors)
   */
  static hasMixedResults<T>(processingResults: ProcessingResults<T>): boolean {
    return !this.isEmptyArray(processingResults.results) &&
      !this.isEmptyArray(processingResults.errors);
  }

  /**
   * Check if processing had no activity (no results, no errors)
   */
  static hasNoActivity<T>(processingResults: ProcessingResults<T>): boolean {
    return this.isEmptyArray(processingResults.results) &&
      this.isEmptyArray(processingResults.errors);
  }

  /**
   * Validate array is not empty with Result pattern
   */
  static validateNotEmpty<T>(
    array: T[],
    context: string,
  ): ValidationResult<T[]> {
    if (this.isEmptyArray(array)) {
      return err(createError({
        kind: "EMPTY_ARRAY",
        code: "EMPTY_ARRAY",
        message: `${context}: Array cannot be empty`,
      }));
    }
    return ok(array);
  }

  /**
   * Validate processing results have successful outcomes
   */
  static validateHasResults<T>(
    processingResults: ProcessingResults<T>,
    context: string,
  ): ValidationResult<T[]> {
    if (this.hasOnlyErrors(processingResults)) {
      return err(createError({
        kind: "NO_SUCCESSFUL_RESULTS",
        code: "NO_SUCCESSFUL_RESULTS",
        message: `${context}: Processing failed - only errors found`,
      }));
    }

    if (this.hasNoActivity(processingResults)) {
      return err(createError({
        kind: "NO_PROCESSING_ACTIVITY",
        code: "NO_PROCESSING_ACTIVITY",
        message: `${context}: No processing activity detected`,
      }));
    }

    return ok(processingResults.results);
  }

  /**
   * Validate collection size within bounds
   */
  static validateCollectionSize<T>(
    collection: T[],
    minSize: number,
    maxSize: number,
    context: string,
  ): ValidationResult<T[]> {
    const size = collection.length;

    if (size < minSize) {
      return err(createError({
        kind: "COLLECTION_TOO_SMALL",
        code: "COLLECTION_TOO_SMALL",
        message: `${context}: Collection size ${size} below minimum ${minSize}`,
      }));
    }

    if (size > maxSize) {
      return err(createError({
        kind: "COLLECTION_TOO_LARGE",
        code: "COLLECTION_TOO_LARGE",
        message:
          `${context}: Collection size ${size} exceeds maximum ${maxSize}`,
      }));
    }

    return ok(collection);
  }

  /**
   * Create processing results structure
   */
  static createProcessingResults<T>(
    results: T[] = [],
    errors: (DomainError & { message: string })[] = [],
  ): ProcessingResults<T> {
    return { results, errors };
  }

  /**
   * Merge multiple processing results
   */
  static mergeProcessingResults<T>(
    resultsList: ProcessingResults<T>[],
  ): ProcessingResults<T> {
    const allResults: T[] = [];
    const allErrors: (DomainError & { message: string })[] = [];

    for (const results of resultsList) {
      allResults.push(...results.results);
      allErrors.push(...results.errors);
    }

    return this.createProcessingResults(allResults, allErrors);
  }
}
