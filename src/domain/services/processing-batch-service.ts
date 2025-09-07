/**
 * Process Document Batch Service
 *
 * Handles batch processing coordination and parallelization following SRP.
 * Extracted from ProcessDocumentsUseCase to manage document batch workflows.
 * Applies Totality principle with Result types and discriminated unions.
 */

import {
  type DomainError,
  isError,
  isOk,
  type Result,
} from "../core/result.ts";
import type {
  AnalysisResult,
  Document,
  Schema,
  Template,
} from "../models/entities.ts";
import type { ProcessingOptions } from "../models/value-objects.ts";
import type {
  ProcessDocumentOrchestrator,
  ProcessingOutcome,
} from "./processing-orchestrator.ts";
import type { ProcessingProgressTracker } from "./processing-progress-tracker.ts";
import { StructuredLogger } from "../shared/logger.ts";

/**
 * Batch processing result following totality principle
 */
export interface BatchResult {
  processedCount: number;
  failedCount: number;
  results: AnalysisResult[];
  errors: Array<{ document: string; error: string }>;
  processingMode: "parallel" | "sequential";
}

/**
 * Batch processing configuration
 */
export interface BatchConfiguration {
  options: ProcessingOptions;
  continueOnError: boolean;
  parallel: boolean;
}

/**
 * Service responsible for coordinating batch document processing
 * Following AI Complexity Control Framework - single focused responsibility
 */
export class ProcessDocumentBatchService {
  private static readonly SERVICE_NAME = "processing-batch-service";

  constructor(
    private readonly orchestrator: ProcessDocumentOrchestrator,
    private readonly progressTracker: ProcessingProgressTracker,
  ) {}

  /**
   * Process a batch of documents with coordination and error handling
   * Extracted from ProcessDocumentsUseCase.execute lines 230-340
   */
  async processBatch(
    documents: Document[],
    schema: Schema,
    template: Template,
    options: ProcessingOptions,
  ): Promise<Result<BatchResult, DomainError & { message: string }>> {
    const logger = StructuredLogger.getServiceLogger(
      ProcessDocumentBatchService.SERVICE_NAME,
    );

    logger.info("Starting batch processing", {
      documentCount: documents.length,
      parallelMode: options.isParallel(),
    });

    // Early return for empty batch
    if (documents.length === 0) {
      logger.info("No documents to process");
      return {
        ok: true,
        data: {
          processedCount: 0,
          failedCount: 0,
          results: [],
          errors: [],
          processingMode: options.isParallel() ? "parallel" : "sequential",
        },
      };
    }

    // Log processing list
    this.logProcessingList(documents);

    // Choose processing strategy based on options
    const batchConfig: BatchConfiguration = {
      options,
      continueOnError: options.shouldContinueOnError(),
      parallel: options.isParallel(),
    };

    if (batchConfig.parallel) {
      return await this.processParallel(
        documents,
        schema,
        template,
        batchConfig,
      );
    } else {
      return await this.processSequential(
        documents,
        schema,
        template,
        batchConfig,
      );
    }
  }

  /**
   * Process documents in parallel
   */
  private async processParallel(
    documents: Document[],
    schema: Schema,
    template: Template,
    config: BatchConfiguration,
  ): Promise<Result<BatchResult, DomainError & { message: string }>> {
    const logger = StructuredLogger.getServiceLogger(
      `${ProcessDocumentBatchService.SERVICE_NAME}-parallel`,
    );

    logger.info("Starting parallel processing");

    // Create processing promises
    const promises = documents.map((doc) => {
      const docPath = doc.getPath().getValue();
      logger.info("Starting document processing", { docPath });

      return this.orchestrator
        .processDocument(doc, schema, template)
        .then((result) => {
          this.logProcessingResult(docPath, result, "parallel");
          return { doc, result };
        });
    });

    // Wait for all promises to complete
    const outcomes = await Promise.all(promises);

    // Aggregate results
    const results: AnalysisResult[] = [];
    const errors: Array<{ document: string; error: string }> = [];

    for (const { doc, result } of outcomes) {
      if (isError(result)) {
        errors.push({
          document: doc.getPath().getValue(),
          error: result.error.message,
        });
        continue;
      }

      const outcome = result.data;
      if (outcome.kind === "Success") {
        results.push(outcome.result);
      } else {
        const stats = this.orchestrator.getProcessingStatistics(outcome);
        errors.push({
          document: stats.document,
          error: stats.errorDetails || "Unknown error",
        });

        // Check if we should stop on error
        if (!config.continueOnError) {
          logger.warn("Stopping parallel processing due to error", {
            reason: "continue-on-error is false",
          });
          break;
        }
      }
    }

    logger.info("Parallel processing completed", {
      processedCount: results.length,
      failedCount: errors.length,
    });

    return {
      ok: true,
      data: {
        processedCount: results.length,
        failedCount: errors.length,
        results,
        errors,
        processingMode: "parallel",
      },
    };
  }

  /**
   * Process documents sequentially
   */
  private async processSequential(
    documents: Document[],
    schema: Schema,
    template: Template,
    config: BatchConfiguration,
  ): Promise<Result<BatchResult, DomainError & { message: string }>> {
    const logger = StructuredLogger.getServiceLogger(
      `${ProcessDocumentBatchService.SERVICE_NAME}-sequential`,
    );

    logger.info("Starting sequential processing");

    const results: AnalysisResult[] = [];
    const errors: Array<{ document: string; error: string }> = [];

    for (const doc of documents) {
      const docPath = doc.getPath().getValue();
      logger.info("Starting document processing", { document: docPath });

      const result = await this.orchestrator.processDocument(
        doc,
        schema,
        template,
      );

      this.logProcessingResult(docPath, result, "sequential");

      if (isError(result)) {
        errors.push({
          document: docPath,
          error: result.error.message,
        });

        if (!config.continueOnError) {
          logger.warn("Stopping sequential processing due to error", {
            reason: "continue-on-error is false",
          });
          break;
        }
        continue;
      }

      const outcome = result.data;
      if (outcome.kind === "Success") {
        results.push(outcome.result);
      } else {
        const stats = this.orchestrator.getProcessingStatistics(outcome);
        errors.push({
          document: stats.document,
          error: stats.errorDetails || "Unknown error",
        });

        if (!config.continueOnError) {
          logger.warn("Stopping sequential processing due to error", {
            reason: "continue-on-error is false",
          });
          break;
        }
      }
    }

    logger.info("Sequential processing completed", {
      processedCount: results.length,
      failedCount: errors.length,
    });

    return {
      ok: true,
      data: {
        processedCount: results.length,
        failedCount: errors.length,
        results,
        errors,
        processingMode: "sequential",
      },
    };
  }

  /**
   * Log processing list
   */
  private logProcessingList(documents: Document[]): void {
    const processLogger = StructuredLogger.getServiceLogger(
      "process-documents-main",
    );
    const documentPaths = documents.map((doc) => doc.getPath().getValue());
    processLogger.info("Processing document list", {
      documentCount: documents.length,
      documents: documentPaths,
    });
  }

  /**
   * Log individual processing result
   */
  private logProcessingResult(
    docPath: string,
    result: Result<ProcessingOutcome, DomainError & { message: string }>,
    mode: "parallel" | "sequential",
  ): void {
    const resultLogger = StructuredLogger.getServiceLogger(
      `process-documents-${mode}`,
    );

    if (isOk(result) && result.data.kind === "Success") {
      resultLogger.info("Document processing success", {
        document: docPath,
      });
    } else if (isError(result)) {
      resultLogger.error("Document processing failed", {
        document: docPath,
        error: result.error.message,
      });
    } else if (result.data.kind !== "Success") {
      const stats = this.orchestrator.getProcessingStatistics(result.data);
      resultLogger.error("Document processing failed", {
        document: docPath,
        error: stats.errorDetails || "Unknown error",
      });
    }
  }

  /**
   * Check if batch processing was successful
   */
  isBatchSuccessful(batchResult: BatchResult): boolean {
    return batchResult.processedCount > 0 || batchResult.failedCount === 0;
  }

  /**
   * Get batch processing summary
   */
  getBatchSummary(batchResult: BatchResult): {
    totalDocuments: number;
    successRate: number;
    processingMode: string;
    hasErrors: boolean;
  } {
    const totalDocuments = batchResult.processedCount + batchResult.failedCount;
    const successRate = totalDocuments > 0
      ? (batchResult.processedCount / totalDocuments) * 100
      : 0;

    return {
      totalDocuments,
      successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
      processingMode: batchResult.processingMode,
      hasErrors: batchResult.failedCount > 0,
    };
  }
}
