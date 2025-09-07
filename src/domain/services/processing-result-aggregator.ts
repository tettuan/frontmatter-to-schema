/**
 * Processing Result Aggregator Service
 *
 * Consolidates result aggregation responsibilities from massive use case methods.
 * Following AI Complexity Control Framework - eliminates result processing entropy.
 * Implements Single Responsibility Principle for result management.
 */

import type { DomainError, Result } from "../core/result.ts";
import { ResultHandlerService } from "./result-handler-service.ts";
import { ProcessingProgressTracker } from "./processing-progress-tracker.ts";
import type { AnalysisResult, Document } from "../models/entities.ts";
import type { ProcessingOptions } from "../models/value-objects.ts";

/**
 * Document Processing Outcome
 */
export interface DocumentProcessingOutcome {
  document: Document;
  result: Result<AnalysisResult, DomainError & { message: string }>;
}

/**
 * Processing Results Summary
 */
export interface ProcessingResultsSummary {
  results: AnalysisResult[];
  errors: Array<{ document: string; error: string }>;
  processedCount: number;
  failedCount: number;
  shouldStop: boolean;
}

/**
 * Aggregation Statistics
 */
export interface AggregationStatistics {
  totalDocuments: number;
  successfulResults: number;
  failedResults: number;
  successRate: number;
  processingMode: "sequential" | "parallel";
}

/**
 * Processing Result Aggregator Service
 *
 * Extracts result aggregation logic from ProcessDocumentsUseCase.execute()
 * Provides consistent result processing across sequential and parallel modes.
 */
export class ProcessingResultAggregator {
  /**
   * Process parallel processing outcomes
   */
  static processParallelOutcomes(
    outcomes: DocumentProcessingOutcome[],
    options: ProcessingOptions,
  ): ProcessingResultsSummary {
    const results: AnalysisResult[] = [];
    const errors: Array<{ document: string; error: string }> = [];
    let shouldStop = false;

    for (const { document, result } of outcomes) {
      const documentPath = document.getPath().getValue();

      if (result.ok) {
        results.push(result.data);
        ProcessingProgressTracker.logDocumentProcessingSuccess(
          documentPath,
          "parallel",
        );
      } else {
        const errorEntry = {
          document: documentPath,
          error: result.error.message,
        };
        errors.push(errorEntry);

        ProcessingProgressTracker.logDocumentProcessingFailure(
          documentPath,
          result.error.message,
          "parallel",
        );

        if (!options.shouldContinueOnError()) {
          shouldStop = true;
          ProcessingProgressTracker.logProcessingStop(
            "continue-on-error is false",
          );
          break;
        }
      }
    }

    return {
      results,
      errors,
      processedCount: results.length,
      failedCount: errors.length,
      shouldStop,
    };
  }

  /**
   * Process sequential processing outcome
   */
  static processSequentialOutcome(
    document: Document,
    result: Result<AnalysisResult, DomainError & { message: string }>,
    options: ProcessingOptions,
    currentResults: AnalysisResult[],
    currentErrors: Array<{ document: string; error: string }>,
  ): { shouldContinue: boolean; shouldStop: boolean } {
    const documentPath = document.getPath().getValue();

    if (result.ok) {
      currentResults.push(result.data);
      ProcessingProgressTracker.logDocumentProcessingSuccess(
        documentPath,
        "sequential",
      );
      return { shouldContinue: true, shouldStop: false };
    } else {
      const errorEntry = {
        document: documentPath,
        error: result.error.message,
      };
      currentErrors.push(errorEntry);

      ProcessingProgressTracker.logDocumentProcessingFailure(
        documentPath,
        result.error.message,
        "sequential",
      );

      if (!options.shouldContinueOnError()) {
        ProcessingProgressTracker.logProcessingStop(
          "continue-on-error is false",
        );
        return { shouldContinue: false, shouldStop: true };
      }
      return { shouldContinue: true, shouldStop: false };
    }
  }

  /**
   * Validate processing results
   */
  static validateResults(
    results: AnalysisResult[],
    errors: Array<{ document: string; error: string }>,
  ): boolean {
    if (results.length === 0) {
      ProcessingProgressTracker.logNoDocumentsProcessed(errors);
      return false;
    }
    return true;
  }

  /**
   * Create aggregation statistics
   */
  static createStatistics(
    summary: ProcessingResultsSummary,
    mode: "sequential" | "parallel",
  ): AggregationStatistics {
    const totalDocuments = summary.processedCount + summary.failedCount;

    return {
      totalDocuments,
      successfulResults: summary.processedCount,
      failedResults: summary.failedCount,
      successRate: totalDocuments > 0
        ? summary.processedCount / totalDocuments
        : 0,
      processingMode: mode,
    };
  }

  /**
   * Process document outcomes with error handling
   */
  static processOutcomes<T>(
    outcomes: T[],
    processor: (outcome: T) => Result<unknown, DomainError>,
    context: { operation: string; component: string },
  ): Result<unknown[], DomainError & { message: string }> {
    const results = outcomes.map(processor);

    const collectResult = ResultHandlerService.collectResults(results, context);
    if (!collectResult.ok) {
      // Ensure the error has a message property
      const errorWithMessage = collectResult.error as DomainError & {
        message: string;
      };
      if (!errorWithMessage.message) {
        errorWithMessage.message =
          `${context.operation} failed in ${context.component}`;
      }
      return { ok: false, error: errorWithMessage };
    }

    return { ok: true, data: collectResult.data };
  }

  /**
   * Aggregate processing results with statistics
   */
  static aggregateWithStatistics(
    summary: ProcessingResultsSummary,
    mode: "sequential" | "parallel",
  ): {
    summary: ProcessingResultsSummary;
    statistics: AggregationStatistics;
    isValid: boolean;
  } {
    const statistics = this.createStatistics(summary, mode);
    const isValid = this.validateResults(summary.results, summary.errors);

    return {
      summary,
      statistics,
      isValid,
    };
  }

  /**
   * Create empty results summary
   */
  static createEmptySummary(): ProcessingResultsSummary {
    return {
      results: [],
      errors: [],
      processedCount: 0,
      failedCount: 0,
      shouldStop: false,
    };
  }

  /**
   * Merge multiple result summaries (for complex processing scenarios)
   */
  static mergeSummaries(
    summaries: ProcessingResultsSummary[],
  ): ProcessingResultsSummary {
    return summaries.reduce((merged, current) => ({
      results: [...merged.results, ...current.results],
      errors: [...merged.errors, ...current.errors],
      processedCount: merged.processedCount + current.processedCount,
      failedCount: merged.failedCount + current.failedCount,
      shouldStop: merged.shouldStop || current.shouldStop,
    }), this.createEmptySummary());
  }
}
