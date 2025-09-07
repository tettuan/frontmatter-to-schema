/**
 * Processing Progress Tracker Service
 *
 * Consolidates verbose logging and progress tracking from massive use case methods.
 * Following AI Complexity Control Framework - eliminates logging entropy.
 * Implements Single Responsibility Principle for progress monitoring.
 */

import { VerboseLoggingUtility } from "./verbose-logging-utility.ts";
import { StructuredLogger } from "../shared/logger.ts";
import type { Document } from "../models/entities.ts";
import type { AnalysisResult as _AnalysisResult } from "../models/entities.ts";

/**
 * Processing Phase Types for progress tracking
 */
export type ProcessingPhase =
  | "pipeline_start"
  | "resource_loading"
  | "document_processing_start"
  | "document_processing_success"
  | "document_processing_failed"
  | "result_aggregation"
  | "final_completion"
  | "error_summary";

/**
 * Processing Context for enhanced logging
 */
export interface ProcessingContext {
  phase: ProcessingPhase;
  documentPath?: string;
  documentCount?: number;
  resultCount?: number;
  errorCount?: number;
  processingMode?: "sequential" | "parallel";
  [key: string]: unknown;
}

/**
 * Processing Progress Tracker Service
 *
 * Extracts verbose logging logic from ProcessDocumentsUseCase.execute()
 * Provides consistent progress tracking across the processing pipeline.
 */
export class ProcessingProgressTracker {
  private static readonly SERVICE_NAME = "processing-progress-tracker";

  /**
   * Log pipeline start with configuration details
   */
  static logPipelineStart(context: {
    schemaPath: string;
    templatePath: string;
    documentsPath: string;
  }): void {
    VerboseLoggingUtility.logInfo(
      this.SERVICE_NAME,
      "[Pipeline] Starting document processing pipeline",
      {
        phase: "pipeline_start",
        schema: context.schemaPath,
        template: context.templatePath,
        documents: context.documentsPath,
      },
    );
  }

  /**
   * Log resource loading completion
   */
  static logResourcesLoaded(context: {
    documentsCount: number;
    hasSchema: boolean;
    hasTemplate: boolean;
  }): void {
    VerboseLoggingUtility.logInfo(
      this.SERVICE_NAME,
      "[Pipeline] Resources loaded successfully",
      {
        phase: "resource_loading",
        documentsFound: context.documentsCount,
        schemaLoaded: context.hasSchema,
        templateLoaded: context.hasTemplate,
      },
    );
  }

  /**
   * Log document processing list
   */
  static logProcessingList(
    documents: Document[],
    mode: "sequential" | "parallel",
  ): void {
    const processLogger = StructuredLogger.getServiceLogger(
      "process-documents-main",
    );
    const documentPaths = documents.map((doc) => doc.getPath().getValue());

    processLogger.info("Processing document list", {
      documentCount: documents.length,
      documents: documentPaths,
      processingMode: mode,
    });

    VerboseLoggingUtility.logInfo(
      this.SERVICE_NAME,
      `[Pipeline] Starting ${mode} processing of ${documents.length} documents`,
      {
        phase: "document_processing_start",
        documentCount: documents.length,
        processingMode: mode,
        documentPaths,
      },
    );
  }

  /**
   * Log individual document processing start
   */
  static logDocumentProcessingStart(
    documentPath: string,
    mode: "sequential" | "parallel",
  ): void {
    const startLogger = StructuredLogger.getServiceLogger(
      mode === "sequential"
        ? "process-documents-sequential"
        : "process-documents-main",
    );
    startLogger.info("Starting document processing", {
      document: documentPath,
      mode,
    });

    VerboseLoggingUtility.logDebug(
      this.SERVICE_NAME,
      `[Document] Processing started: ${documentPath}`,
      {
        phase: "document_processing_start",
        documentPath,
        processingMode: mode,
      },
    );
  }

  /**
   * Log individual document processing success
   */
  static logDocumentProcessingSuccess(
    documentPath: string,
    mode: "sequential" | "parallel",
  ): void {
    const resultLogger = StructuredLogger.getServiceLogger(
      mode === "sequential"
        ? "process-documents-sequential"
        : "process-documents-result",
    );
    resultLogger.info("Document processing success", {
      document: documentPath,
      mode,
    });

    VerboseLoggingUtility.logDebug(
      this.SERVICE_NAME,
      `[Document] Processing completed successfully: ${documentPath}`,
      {
        phase: "document_processing_success",
        documentPath,
        processingMode: mode,
      },
    );
  }

  /**
   * Log individual document processing failure
   */
  static logDocumentProcessingFailure(
    documentPath: string,
    errorMessage: string,
    mode: "sequential" | "parallel",
  ): void {
    const resultLogger = StructuredLogger.getServiceLogger(
      mode === "sequential"
        ? "process-documents-sequential"
        : "process-documents-result",
    );
    resultLogger.error("Document processing failed", {
      document: documentPath,
      error: errorMessage,
      mode,
    });

    VerboseLoggingUtility.logWarn(
      this.SERVICE_NAME,
      `[Document] Processing failed: ${documentPath}`,
      {
        phase: "document_processing_failed",
        documentPath,
        errorMessage,
        processingMode: mode,
      },
    );
  }

  /**
   * Log processing stop due to error
   */
  static logProcessingStop(reason: string): void {
    const stopLogger = StructuredLogger.getServiceLogger(
      "process-documents-control",
    );
    stopLogger.warn("Stopping due to error", { reason });

    VerboseLoggingUtility.logWarn(
      this.SERVICE_NAME,
      "[Pipeline] Processing stopped due to error policy",
      {
        phase: "processing_stopped",
        reason,
      },
    );
  }

  /**
   * Log processing summary when no documents processed
   */
  static logNoDocumentsProcessed(
    errors: Array<{ document: string; error: string }>,
  ): void {
    const summaryLogger = StructuredLogger.getServiceLogger(
      "process-documents-summary",
    );
    summaryLogger.warn("No documents were successfully processed");

    VerboseLoggingUtility.logWarn(
      this.SERVICE_NAME,
      "[Pipeline] No documents were successfully processed",
      {
        phase: "error_summary",
        errorCount: errors.length,
      },
    );

    if (errors.length > 0) {
      const errorSummaryLogger = StructuredLogger.getServiceLogger(
        "process-documents-summary",
      );
      errorSummaryLogger.error("Failed documents summary", {
        failedCount: errors.length,
        failures: errors.map((error) => ({
          document: error.document,
          error: error.error,
        })),
      });

      VerboseLoggingUtility.logWarn(
        this.SERVICE_NAME,
        "[Pipeline] Failed documents summary",
        {
          phase: "error_summary",
          failedDocuments: errors,
        },
      );
    }
  }

  /**
   * Log result aggregation start
   */
  static logResultAggregationStart(resultCount: number): void {
    const aggregationLogger = StructuredLogger.getServiceLogger(
      "process-documents-main",
    );
    aggregationLogger.info("Aggregating results", { resultCount });

    VerboseLoggingUtility.logInfo(
      this.SERVICE_NAME,
      "[Pipeline] Starting result aggregation",
      {
        phase: "result_aggregation",
        resultCount,
      },
    );
  }

  /**
   * Log result aggregation success
   */
  static logResultAggregationSuccess(): void {
    const aggregationLogger = StructuredLogger.getServiceLogger(
      "process-documents-main",
    );
    aggregationLogger.info("Aggregation successful");

    VerboseLoggingUtility.logInfo(
      this.SERVICE_NAME,
      "[Pipeline] Result aggregation completed successfully",
      {
        phase: "result_aggregation",
        status: "success",
      },
    );
  }

  /**
   * Log result aggregation failure
   */
  static logResultAggregationFailure(errorMessage: string): void {
    const errorLogger = StructuredLogger.getServiceLogger(
      "process-documents-error",
    );
    errorLogger.error("Aggregation failed", { errorMessage });

    VerboseLoggingUtility.logWarn(
      this.SERVICE_NAME,
      "[Pipeline] Result aggregation failed",
      {
        phase: "result_aggregation",
        status: "failed",
        errorMessage,
      },
    );
  }

  /**
   * Log final completion with statistics
   */
  static logFinalCompletion(
    totalResults: number,
    errorCount: number,
    outputPath: string,
  ): void {
    VerboseLoggingUtility.logInfo(
      this.SERVICE_NAME,
      "[最終成果物Z] Processing pipeline completed",
      {
        phase: "final_completion",
        totalResults,
        errors: errorCount,
        outputPath,
        successRate: totalResults / (totalResults + errorCount),
      },
    );
  }

  /**
   * Create processing context for structured logging
   */
  static createContext(
    phase: ProcessingPhase,
    additionalContext: Record<string, unknown> = {},
  ): ProcessingContext {
    return {
      phase,
      timestamp: new Date().toISOString(),
      ...additionalContext,
    };
  }
}
