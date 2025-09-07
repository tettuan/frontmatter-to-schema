/**
 * Process Document Validation Service
 *
 * Handles document and processing result validation following SRP.
 * Implements validation concerns extracted from ProcessDocumentsUseCase.
 * Applies Totality principle with Result types and discriminated unions.
 */

import {
  createDomainError,
  type DomainError,
  type Result,
} from "../core/result.ts";
import type { AnalysisResult, Document } from "../models/entities.ts";
import { StructuredLogger } from "../shared/logger.ts";

/**
 * Validation result discriminated union following totality principle
 */
export type ValidationResult =
  | { kind: "Valid"; message?: string }
  | { kind: "Invalid"; reason: string; details?: string };

/**
 * Processing result validation interface
 */
export interface ProcessedResult {
  document: Document;
  analysisResult: AnalysisResult;
  processingTime?: number;
}

/**
 * Service responsible for validation operations in document processing
 * Following AI Complexity Control Framework - single focused responsibility
 */
export class ProcessDocumentValidationService {
  private static readonly SERVICE_NAME = "processing-validation-service";

  /**
   * Validate document structure and content
   */
  validateDocument(
    document: Document,
  ): Result<ValidationResult, DomainError & { message: string }> {
    const logger = StructuredLogger.getServiceLogger(
      ProcessDocumentValidationService.SERVICE_NAME,
    );
    const docPath = document.getPath().getValue();

    logger.info("Validating document", { document: docPath });

    try {
      // Check document path validity
      if (!docPath || docPath.trim() === "") {
        return {
          ok: true,
          data: {
            kind: "Invalid",
            reason: "Document path is empty or invalid",
            details: "Document must have a valid file path",
          },
        };
      }

      // Check document content exists
      const content = document.getContent();
      if (!content || String(content).trim() === "") {
        return {
          ok: true,
          data: {
            kind: "Invalid",
            reason: "Document content is empty",
            details: "Document must contain content to process",
          },
        };
      }

      // Basic markdown file validation
      if (
        !docPath.toLowerCase().endsWith(".md") &&
        !docPath.toLowerCase().endsWith(".markdown")
      ) {
        return {
          ok: true,
          data: {
            kind: "Invalid",
            reason: "Document is not a markdown file",
            details: "Only .md and .markdown files are supported",
          },
        };
      }

      logger.info("Document validation passed", { document: docPath });

      return {
        ok: true,
        data: {
          kind: "Valid",
          message: "Document structure and content are valid",
        },
      };
    } catch (error) {
      logger.error("Document validation failed", {
        document: docPath,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "document",
          expectedFormat: `Valid document structure: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
      };
    }
  }

  /**
   * Validate processing result completeness and quality
   */
  validateProcessingResult(
    result: ProcessedResult,
  ): Result<ValidationResult, DomainError & { message: string }> {
    const logger = StructuredLogger.getServiceLogger(
      ProcessDocumentValidationService.SERVICE_NAME,
    );
    const docPath = result.document.getPath().getValue();

    logger.info("Validating processing result", { document: docPath });

    try {
      // Validate analysis result exists
      if (!result.analysisResult) {
        return {
          ok: true,
          data: {
            kind: "Invalid",
            reason: "Analysis result is missing",
            details: "Processing result must contain analysis data",
          },
        };
      }

      // Validate extracted data exists
      const extractedData = result.analysisResult.getExtractedData();
      if (!extractedData || Object.keys(extractedData).length === 0) {
        return {
          ok: true,
          data: {
            kind: "Invalid",
            reason: "No data was extracted from document",
            details:
              "Analysis must extract at least some data from the document",
          },
        };
      }

      // Validate mapped data exists
      const mappedData = result.analysisResult.getMappedData();
      if (!mappedData) {
        return {
          ok: true,
          data: {
            kind: "Invalid",
            reason: "Template mapping failed",
            details: "Analysis must produce mapped data using the template",
          },
        };
      }

      logger.info("Processing result validation passed", { document: docPath });

      return {
        ok: true,
        data: {
          kind: "Valid",
          message: "Processing result is complete and valid",
        },
      };
    } catch (error) {
      logger.error("Processing result validation failed", {
        document: docPath,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "processing_result",
          expectedFormat: `Valid processing result: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
      };
    }
  }

  /**
   * Validate batch processing prerequisites
   */
  validateBatchPrerequisites(
    documents: Document[],
  ): Result<ValidationResult, DomainError & { message: string }> {
    const logger = StructuredLogger.getServiceLogger(
      ProcessDocumentValidationService.SERVICE_NAME,
    );

    logger.info("Validating batch processing prerequisites", {
      documentCount: documents.length,
    });

    try {
      // Check if documents array is empty
      if (!documents || documents.length === 0) {
        return {
          ok: true,
          data: {
            kind: "Invalid",
            reason: "No documents to process",
            details: "Batch processing requires at least one document",
          },
        };
      }

      // Validate each document in the batch
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const docValidation = this.validateDocument(doc);

        if (!docValidation.ok) {
          return docValidation;
        }

        if (docValidation.data.kind === "Invalid") {
          return {
            ok: true,
            data: {
              kind: "Invalid",
              reason: `Document ${i + 1} failed validation`,
              details: `${docValidation.data.reason}: ${
                docValidation.data.details || ""
              }`,
            },
          };
        }
      }

      logger.info("Batch processing prerequisites validated successfully", {
        validDocuments: documents.length,
      });

      return {
        ok: true,
        data: {
          kind: "Valid",
          message: `All ${documents.length} documents are valid for processing`,
        },
      };
    } catch (error) {
      logger.error("Batch prerequisites validation failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "batch_prerequisites",
          expectedFormat: `Valid batch prerequisites: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
      };
    }
  }
}
