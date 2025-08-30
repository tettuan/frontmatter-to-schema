/**
 * Mock implementation of FrontMatterExtractor for testing
 */

import type { Document } from "../../src/domain/models/entities.ts";
import type { DomainError, Result } from "../../src/domain/core/result.ts";
import type {
  FrontMatterExtractionResult,
  FrontMatterExtractor,
} from "../../src/domain/services/interfaces.ts";

export class MockFrontMatterExtractor implements FrontMatterExtractor {
  private extractionResult: FrontMatterExtractionResult | null = null;
  private extractionError: (DomainError & { message: string }) | null = null;
  private multipleResults: FrontMatterExtractionResult[] = [];
  private currentIndex = 0;

  /**
   * Sets the result that will be returned by extract()
   */
  setExtractionResult(result: FrontMatterExtractionResult): void {
    this.extractionResult = result;
    this.extractionError = null;
    this.multipleResults = [];
    this.currentIndex = 0;
  }

  /**
   * Sets an error that will be returned by extract()
   */
  setExtractionError(error: DomainError & { message: string }): void {
    this.extractionError = error;
    this.extractionResult = null;
    this.multipleResults = [];
    this.currentIndex = 0;
  }

  /**
   * Sets multiple results for batch testing
   */
  setMultipleExtractionResults(results: FrontMatterExtractionResult[]): void {
    this.multipleResults = results;
    this.currentIndex = 0;
    this.extractionResult = null;
    this.extractionError = null;
  }

  extract(
    _document: Document,
  ): Result<FrontMatterExtractionResult, DomainError & { message: string }> {
    // Return error if set
    if (this.extractionError) {
      return { ok: false, error: this.extractionError };
    }

    // Return multiple results if set (for batch testing)
    if (this.multipleResults.length > 0) {
      if (this.currentIndex < this.multipleResults.length) {
        const result = this.multipleResults[this.currentIndex];
        this.currentIndex++;
        return { ok: true, data: result };
      } else {
        // Fall back to last result if we've exceeded the array
        return {
          ok: true,
          data: this.multipleResults[this.multipleResults.length - 1],
        };
      }
    }

    // Return single result if set
    if (this.extractionResult) {
      return { ok: true, data: this.extractionResult };
    }

    // Default behavior - return NotPresent
    return { ok: true, data: { kind: "NotPresent" } };
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.extractionResult = null;
    this.extractionError = null;
    this.multipleResults = [];
    this.currentIndex = 0;
  }
}
