/**
 * Process Document Orchestrator
 *
 * Orchestrates individual document processing workflow following SRP.
 * Extracted from ProcessDocumentsUseCase to coordinate analysis and validation.
 * Applies Totality principle with Result types and discriminated unions.
 */

import { type DomainError, isError, type Result } from "../core/result.ts";
import type {
  AnalysisResult,
  Document,
  Schema,
  Template,
} from "../models/entities.ts";
import type { ProcessDocumentAnalysisService } from "./processing-analysis-service.ts";
import type {
  ProcessDocumentValidationService,
  ProcessedResult,
  ValidationResult,
} from "./processing-validation-service.ts";
import { StructuredLogger } from "../shared/logger.ts";

/**
 * Processing outcome discriminated union following totality principle
 */
export type ProcessingOutcome =
  | {
    kind: "Success";
    result: AnalysisResult;
    validationResult: ValidationResult;
  }
  | { kind: "ValidationFailure"; reason: string; document: string }
  | {
    kind: "ProcessingFailure";
    error: DomainError & { message: string };
    document: string;
  };

/**
 * Service responsible for orchestrating individual document processing workflow
 * Following AI Complexity Control Framework - single focused responsibility
 */
export class ProcessDocumentOrchestrator {
  private static readonly SERVICE_NAME = "processing-orchestrator";

  constructor(
    private readonly analysisService: ProcessDocumentAnalysisService,
    private readonly validationService: ProcessDocumentValidationService,
  ) {}

  /**
   * Process a single document through the complete workflow
   * Extracted from ProcessDocumentsUseCase.processDocument with enhanced coordination
   */
  async processDocument(
    document: Document,
    schema: Schema,
    template: Template,
  ): Promise<Result<ProcessingOutcome, DomainError & { message: string }>> {
    const logger = StructuredLogger.getServiceLogger(
      ProcessDocumentOrchestrator.SERVICE_NAME,
    );
    const docPath = document.getPath().getValue();

    logger.info("Starting document processing workflow", {
      document: docPath,
    });

    // Step 1: Pre-processing validation
    const preValidationResult = await this.validateDocumentPreprocessing(
      document,
    );
    if (isError(preValidationResult)) {
      return preValidationResult;
    }

    // If validation failed, return the failure
    if (preValidationResult.data !== null) {
      return {
        ok: true,
        data: preValidationResult.data,
      };
    }
    // Otherwise validation passed (null), continue processing

    // Step 2: Document analysis
    const analysisResult = await this.performDocumentAnalysis(
      document,
      schema,
      template,
    );
    if (isError(analysisResult)) {
      return {
        ok: true,
        data: {
          kind: "ProcessingFailure",
          error: analysisResult.error,
          document: docPath,
        },
      };
    }

    // Step 3: Post-processing validation
    const postValidationResult = await this.validateProcessingResult(
      document,
      analysisResult.data,
    );
    if (isError(postValidationResult)) {
      return postValidationResult;
    }

    if (postValidationResult.data.kind === "ValidationFailure") {
      return {
        ok: true,
        data: postValidationResult.data,
      };
    }

    logger.info("Document processing workflow completed successfully", {
      document: docPath,
    });

    return {
      ok: true,
      data: {
        kind: "Success",
        result: analysisResult.data,
        validationResult: postValidationResult.data.validationResult,
      },
    };
  }

  /**
   * Validate document before processing
   * Returns ValidationFailure if validation fails, or null to continue processing
   */
  private validateDocumentPreprocessing(
    document: Document,
  ): Result<ProcessingOutcome | null, DomainError & { message: string }> {
    const docPath = document.getPath().getValue();

    const validationResult = this.validationService.validateDocument(
      document,
    );
    if (isError(validationResult)) {
      return validationResult;
    }

    if (validationResult.data.kind === "Invalid") {
      return {
        ok: true,
        data: {
          kind: "ValidationFailure",
          reason:
            `Pre-processing validation failed: ${validationResult.data.reason}`,
          document: docPath,
        },
      };
    }

    // Validation passed - return null to indicate processing should continue
    // The actual ProcessingOutcome will be created after full processing completes
    return {
      ok: true,
      data: null,
    };
  }

  /**
   * Perform document analysis
   */
  private async performDocumentAnalysis(
    document: Document,
    schema: Schema,
    template: Template,
  ): Promise<Result<AnalysisResult, DomainError & { message: string }>> {
    return await this.analysisService.analyzeDocument(
      document,
      schema,
      template,
    );
  }

  /**
   * Validate processing result
   */
  private validateProcessingResult(
    document: Document,
    analysisResult: AnalysisResult,
  ): Result<
    { kind: "Success"; validationResult: ValidationResult } | {
      kind: "ValidationFailure";
      reason: string;
      document: string;
    },
    DomainError & { message: string }
  > {
    const docPath = document.getPath().getValue();

    const processedResult: ProcessedResult = {
      document,
      analysisResult,
      processingTime: Date.now(), // Simple timestamp for processing time
    };

    const validationResult = this.validationService.validateProcessingResult(
      processedResult,
    );
    if (isError(validationResult)) {
      return validationResult;
    }

    if (validationResult.data.kind === "Invalid") {
      return {
        ok: true,
        data: {
          kind: "ValidationFailure",
          reason:
            `Post-processing validation failed: ${validationResult.data.reason}`,
          document: docPath,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "Success",
        validationResult: validationResult.data,
      },
    };
  }

  /**
   * Get processing statistics for a document
   */
  getProcessingStatistics(outcome: ProcessingOutcome): {
    success: boolean;
    document: string;
    errorDetails?: string;
  } {
    switch (outcome.kind) {
      case "Success":
        return {
          success: true,
          document: outcome.result.getDocument().getPath().getValue(),
        };
      case "ValidationFailure":
        return {
          success: false,
          document: outcome.document,
          errorDetails: outcome.reason,
        };
      case "ProcessingFailure":
        return {
          success: false,
          document: outcome.document,
          errorDetails: outcome.error.message,
        };
      default: {
        // Exhaustive check following totality principle
        const _exhaustive: never = outcome;
        throw new Error(`Unhandled processing outcome: ${_exhaustive}`);
      }
    }
  }
}
