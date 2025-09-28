import { err, ok, Result } from "../../shared/types/result.ts";
// import { createError } from "../../shared/types/errors.ts"; // Unused import
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { MarkdownDocument } from "../../frontmatter/entities/markdown-document.ts";
// FrontmatterData is used in ProcessedDocument interface imported from document-processor.ts
import { FilePath } from "../../frontmatter/value-objects/file-path.ts";
import { FrontmatterProcessor } from "../../frontmatter/processors/frontmatter-processor.ts";
import type { DomainFileReader } from "../../shared/interfaces/file-operations.ts";
import {
  DocumentError,
  DocumentProcessor,
  ProcessedDocument,
} from "../interfaces/document-processor.ts";

/**
 * Implementation of DocumentProcessor for Markdown documents.
 * Focuses solely on document processing: file reading, frontmatter extraction, and basic validation.
 *
 * Following DDD principles:
 * - Single Responsibility: Document processing only
 * - Domain boundaries: Clear separation from schema and aggregation concerns
 * - Dependency Inversion: Uses injected file reader and frontmatter processor
 *
 * Following Totality principles:
 * - All methods return Result<T,E> types
 * - No partial functions or exceptions
 * - Comprehensive error handling through discriminated unions
 */
export class MarkdownDocumentProcessor implements DocumentProcessor {
  private constructor(
    private readonly fileReader: DomainFileReader,
    private readonly frontmatterProcessor: FrontmatterProcessor,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates a document processor with validated dependencies
   */
  static create(
    fileReader: DomainFileReader,
    frontmatterProcessor: FrontmatterProcessor,
  ): Result<MarkdownDocumentProcessor, DocumentError & { message: string }> {
    if (!fileReader) {
      return err({
        kind: "DocumentCreationFailure",
        path: "N/A",
        cause: "FileReader is required",
        message: "FileReader dependency is required for document processing",
      });
    }

    if (!frontmatterProcessor) {
      return err({
        kind: "DocumentCreationFailure",
        path: "N/A",
        cause: "FrontmatterProcessor is required",
        message:
          "FrontmatterProcessor dependency is required for document processing",
      });
    }

    return ok(new MarkdownDocumentProcessor(fileReader, frontmatterProcessor));
  }

  /**
   * Process multiple documents from file paths into validated documents with frontmatter.
   * Handles all documents sequentially, collecting errors without stopping processing.
   */
  processDocuments(
    filePaths: string[],
    validationRules: ValidationRules,
  ): Result<ProcessedDocument[], DocumentError & { message: string }> {
    const processedDocuments: ProcessedDocument[] = [];
    const errors: (DocumentError & { message: string })[] = [];

    for (const filePath of filePaths) {
      const result = this.processDocument(filePath, validationRules);
      if (result.ok) {
        processedDocuments.push(result.data);
      } else {
        errors.push(result.error);
      }
    }

    // If we have any documents processed successfully, return them
    // If all failed, return the first error
    if (processedDocuments.length > 0) {
      return ok(processedDocuments);
    } else if (errors.length > 0) {
      return err(errors[0]);
    } else {
      return err({
        kind: "DocumentCreationFailure",
        path: "N/A",
        cause: "No documents provided for processing",
        message: "No documents were provided for processing",
      });
    }
  }

  /**
   * Process a single document from a file path.
   * Follows the document processing pipeline: FilePath validation → File reading → Frontmatter extraction → Document creation
   */
  processDocument(
    filePath: string,
    validationRules: ValidationRules,
  ): Result<ProcessedDocument, DocumentError & { message: string }> {
    // Step 1: Validate file path
    const filePathResult = FilePath.create(filePath);
    if (!filePathResult.ok) {
      return err({
        kind: "FilePathInvalid",
        path: filePath,
        cause: filePathResult.error.message,
        message: `Invalid file path: ${filePathResult.error.message}`,
      });
    }

    // Step 2: Read file content
    const contentResult = this.fileReader.read(filePath);
    if (!contentResult.ok) {
      return err({
        kind: "FileReadFailure",
        path: filePath,
        cause: contentResult.error.message,
        message:
          `Failed to read file '${filePath}': ${contentResult.error.message}`,
      });
    }

    // Step 3: Extract frontmatter
    const extractResult = this.frontmatterProcessor.extract(contentResult.data);
    if (!extractResult.ok) {
      return err({
        kind: "FrontmatterExtractionFailure",
        path: filePath,
        cause: extractResult.error.message,
        message:
          `Failed to extract frontmatter from '${filePath}': ${extractResult.error.message}`,
      });
    }

    const { frontmatter, body } = extractResult.data;

    // Step 4: Basic validation of frontmatter
    const validationResult = this.frontmatterProcessor.validate(
      frontmatter,
      validationRules,
    );
    if (!validationResult.ok) {
      return err({
        kind: "DocumentValidationFailure",
        path: filePath,
        cause: validationResult.error.message,
        message:
          `Document validation failed for '${filePath}': ${validationResult.error.message}`,
      });
    }

    // Step 5: Create MarkdownDocument entity
    const documentResult = MarkdownDocument.create(
      filePathResult.data,
      contentResult.data, // Full content
      validationResult.data,
      body,
    );
    if (!documentResult.ok) {
      return err({
        kind: "DocumentCreationFailure",
        path: filePath,
        cause: documentResult.error.message,
        message:
          `Failed to create document for '${filePath}': ${documentResult.error.message}`,
      });
    }

    // Return processed document
    return ok({
      document: documentResult.data,
      frontmatterData: validationResult.data,
    });
  }
}

// Helper function removed - using direct error object creation for simplicity
