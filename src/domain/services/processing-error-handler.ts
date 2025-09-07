/**
 * Processing Error Handler Service
 *
 * Consolidates error handling responsibilities from massive use case methods.
 * Following AI Complexity Control Framework - eliminates error handling entropy.
 * Implements Single Responsibility Principle for error management.
 */

import type { DomainError, Result } from "../core/result.ts";
import { ResultHandlerService } from "./result-handler-service.ts";
import { ProcessingProgressTracker } from "./processing-progress-tracker.ts";

/**
 * Processing Error Categories
 */
export type ProcessingErrorCategory =
  | "resource_loading"
  | "document_processing"
  | "result_aggregation"
  | "output_writing"
  | "validation"
  | "configuration";

/**
 * Enhanced Processing Error
 */
export interface ProcessingError {
  kind: string;
  category: ProcessingErrorCategory;
  context: Record<string, unknown>;
  recoverable: boolean;
  suggestions?: string[];
  message?: string;
  [key: string]: unknown; // Allow additional properties from DomainError
}

/**
 * Error Recovery Strategy
 */
export interface ErrorRecoveryStrategy {
  canRecover: boolean;
  retryCount: number;
  fallbackAction?: string;
  userMessage: string;
}

/**
 * Processing Error Handler Service
 *
 * Extracts error handling logic from ProcessDocumentsUseCase.execute()
 * Provides consistent error processing and recovery strategies.
 */
export class ProcessingErrorHandler {
  /**
   * Handle resource loading errors with enhanced context
   */
  static handleResourceLoadingError(
    error: DomainError,
    resourceType: "schema" | "template" | "documents",
    resourcePath: string,
  ): Result<never, ProcessingError & { message: string }> {
    const _enhancedError: ProcessingError = {
      ...error,
      kind: error.kind,
      category: "resource_loading",
      context: {
        resourceType,
        resourcePath,
        timestamp: new Date().toISOString(),
      },
      recoverable: this.isRecoverableResourceError(error),
      suggestions: this.getResourceErrorSuggestions(error, resourceType),
      message: this.createResourceErrorMessage(
        error,
        resourceType,
        resourcePath,
      ),
    };

    const _contextualMessage = this.createResourceErrorMessage(
      error,
      resourceType,
      resourcePath,
    );

    return ResultHandlerService.createError(
      error,
      {
        operation: "handleResourceLoadingError",
        component: "ProcessingErrorHandler",
      },
    ) as Result<never, ProcessingError & { message: string }>;
  }

  /**
   * Handle document processing errors
   */
  static handleDocumentProcessingError(
    error: DomainError,
    documentPath: string,
    processingStage: string,
  ): ProcessingError & { message: string } {
    const errorMessage = ("message" in error && error.message)
      ? error.message as string
      : `Document processing failed at ${processingStage}`;

    const enhancedError: ProcessingError & { message: string } = {
      ...error,
      kind: error.kind,
      message: errorMessage,
      category: "document_processing",
      context: {
        documentPath,
        processingStage,
        timestamp: new Date().toISOString(),
      },
      recoverable: this.isRecoverableDocumentError(error),
      suggestions: this.getDocumentErrorSuggestions(error, processingStage),
    };

    ProcessingProgressTracker.logDocumentProcessingFailure(
      documentPath,
      enhancedError.message,
      "sequential", // Default mode for error tracking
    );

    return enhancedError;
  }

  /**
   * Handle result aggregation errors
   */
  static handleAggregationError(
    error: DomainError,
    resultCount: number,
  ): Result<never, ProcessingError & { message: string }> {
    const errorMessage = ("message" in error && error.message)
      ? error.message as string
      : "Aggregation failed";

    ProcessingProgressTracker.logResultAggregationFailure(errorMessage);

    const _enhancedError: ProcessingError = {
      ...error,
      kind: error.kind,
      message: errorMessage,
      category: "result_aggregation",
      context: {
        resultCount,
        timestamp: new Date().toISOString(),
      },
      recoverable: false, // Aggregation errors are typically not recoverable
      suggestions: [
        "Check if all analysis results are valid",
        "Verify result aggregator configuration",
        "Review memory usage for large result sets",
      ],
    };

    return ResultHandlerService.createError(
      error,
      {
        operation: "handleAggregationError",
        component: "ProcessingErrorHandler",
      },
    ) as Result<never, ProcessingError & { message: string }>;
  }

  /**
   * Handle output writing errors
   */
  static handleOutputWritingError(
    outputPath: string,
    underlyingError?: DomainError,
  ): Result<never, ProcessingError & { message: string }> {
    const _enhancedError: ProcessingError = {
      kind: "WriteError",
      path: outputPath,
      details: "Failed to save aggregated results",
      category: "output_writing",
      context: {
        outputPath,
        timestamp: new Date().toISOString(),
        underlyingError: underlyingError?.kind,
      },
      recoverable: true, // Writing errors might be recoverable
      suggestions: [
        "Check if output directory exists",
        "Verify write permissions",
        "Ensure sufficient disk space",
        "Try alternative output path",
      ],
    };

    return ResultHandlerService.createError(
      {
        kind: "WriteError",
        path: outputPath,
        details: "Failed to save aggregated results",
      } as DomainError,
      {
        operation: "handleOutputWritingError",
        component: "ProcessingErrorHandler",
      },
    ) as Result<never, ProcessingError & { message: string }>;
  }

  /**
   * Create error recovery strategy
   */
  static createRecoveryStrategy(error: ProcessingError): ErrorRecoveryStrategy {
    return {
      canRecover: error.recoverable,
      retryCount: this.getRecommendedRetryCount(error),
      fallbackAction: this.getFallbackAction(error),
      userMessage: this.createUserFriendlyMessage(error),
    };
  }

  /**
   * Determine if resource loading error is recoverable
   */
  private static isRecoverableResourceError(error: DomainError): boolean {
    return error.kind === "ReadError" || error.kind === "PermissionDenied";
  }

  /**
   * Determine if document processing error is recoverable
   */
  private static isRecoverableDocumentError(error: DomainError): boolean {
    return error.kind !== "FileNotFound" && error.kind !== "InvalidFormat";
  }

  /**
   * Get error suggestions for resource loading
   */
  private static getResourceErrorSuggestions(
    error: DomainError,
    resourceType: string,
  ): string[] {
    const commonSuggestions = [
      `Verify ${resourceType} file path is correct`,
      `Check if ${resourceType} file exists`,
      `Ensure proper file permissions`,
    ];

    if (error.kind === "FileNotFound") {
      return [
        ...commonSuggestions,
        `Create the missing ${resourceType} file`,
        "Use absolute path instead of relative path",
      ];
    }

    if (error.kind === "ReadError") {
      return [
        ...commonSuggestions,
        `Check ${resourceType} file format`,
        "Try opening file in text editor to verify content",
      ];
    }

    return commonSuggestions;
  }

  /**
   * Get error suggestions for document processing
   */
  private static getDocumentErrorSuggestions(
    _error: DomainError,
    stage: string,
  ): string[] {
    const baseSuggestions = [
      "Check document format and structure",
      "Verify frontmatter syntax",
      "Ensure schema compatibility",
    ];

    if (stage === "frontmatter") {
      return [
        ...baseSuggestions,
        "Validate YAML frontmatter syntax",
        "Check for required frontmatter fields",
      ];
    }

    if (stage === "analysis") {
      return [
        ...baseSuggestions,
        "Review schema constraints",
        "Check template mapping rules",
      ];
    }

    return baseSuggestions;
  }

  /**
   * Create contextual error message for resources
   */
  private static createResourceErrorMessage(
    error: DomainError,
    resourceType: string,
    resourcePath: string,
  ): string {
    const baseMessage = `Failed to load ${resourceType}`;

    if (error.kind === "FileNotFound") {
      return `${baseMessage}: File not found at ${resourcePath}`;
    }

    if (error.kind === "ReadError" && "details" in error && error.details) {
      return `${baseMessage}: ${error.details}`;
    }

    if ("message" in error && error.message) {
      return error.message as string;
    }

    return baseMessage;
  }

  /**
   * Get recommended retry count based on error type
   */
  private static getRecommendedRetryCount(error: ProcessingError): number {
    if (!error.recoverable) return 0;

    switch (error.category) {
      case "resource_loading":
        return 2;
      case "output_writing":
        return 3;
      case "document_processing":
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Get fallback action for error category
   */
  private static getFallbackAction(error: ProcessingError): string | undefined {
    switch (error.category) {
      case "output_writing":
        return "Save to temporary directory";
      case "document_processing":
        return "Skip problematic document and continue";
      case "resource_loading":
        return "Use default configuration if available";
      default:
        return undefined;
    }
  }

  /**
   * Create user-friendly error message
   */
  private static createUserFriendlyMessage(error: ProcessingError): string {
    const suggestions = error.suggestions?.slice(0, 2).join(" or ");
    const basMessage = error.message || `Processing failed: ${error.kind}`;

    if (suggestions) {
      return `${basMessage}. Try: ${suggestions}`;
    }

    return basMessage;
  }
}
