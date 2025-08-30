/**
 * Mock implementation of SchemaAnalyzer for testing
 */

import {
  ExtractedData,
  type FrontMatter,
  type Schema,
} from "../../src/domain/models/entities.ts";
import type { DomainError, Result } from "../../src/domain/core/result.ts";
import type { SchemaAnalyzer } from "../../src/domain/services/interfaces.ts";

export class MockSchemaAnalyzer implements SchemaAnalyzer {
  private analysisResult: ExtractedData | null = null;
  private analysisError: (DomainError & { message: string }) | null = null;

  /**
   * Sets the result that will be returned by analyze()
   */
  setAnalysisResult(data: Record<string, unknown>): void {
    this.analysisResult = ExtractedData.create(data);
    this.analysisError = null;
  }

  /**
   * Sets an error that will be returned by analyze()
   */
  setAnalysisError(error: DomainError & { message: string }): void {
    this.analysisError = error;
    this.analysisResult = null;
  }

  analyze(
    frontMatter: FrontMatter,
    _schema: Schema,
  ): Promise<Result<ExtractedData, DomainError & { message: string }>> {
    // Return error if set
    if (this.analysisError) {
      return Promise.resolve({ ok: false, error: this.analysisError });
    }

    // Return result if set
    if (this.analysisResult) {
      return Promise.resolve({ ok: true, data: this.analysisResult });
    }

    // Default behavior - return the frontmatter data as extracted data
    return Promise.resolve({
      ok: true,
      data: ExtractedData.create(
        frontMatter.toObject() as Record<string, unknown>,
      ),
    });
  }

  /**
   * Reset mock state
   */
  reset(): void {
    this.analysisResult = null;
    this.analysisError = null;
  }
}
