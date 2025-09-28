import { Result } from "../../shared/types/result.ts";
import { DomainError as _DomainError } from "../../shared/types/errors.ts";
import { MarkdownDocument } from "../../frontmatter/entities/markdown-document.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";

/**
 * Result of processing a single document following DDD principles
 */
export interface ProcessedDocument {
  readonly document: MarkdownDocument;
  readonly frontmatterData: FrontmatterData;
}

/**
 * Discriminated union for document processing errors following Totality principles
 */
export type DocumentError =
  | { kind: "FilePathInvalid"; path: string; cause: string }
  | { kind: "FileReadFailure"; path: string; cause: string }
  | { kind: "FrontmatterExtractionFailure"; path: string; cause: string }
  | { kind: "DocumentValidationFailure"; path: string; cause: string }
  | { kind: "DocumentCreationFailure"; path: string; cause: string };

/**
 * Domain service interface for document processing following DDD principles.
 * Handles the core responsibility of converting file paths into validated documents with frontmatter.
 *
 * Core Domain: Document Processing
 * Responsibility: File reading, frontmatter extraction, basic validation
 * Dependencies: FileSystem, FrontmatterExtractor, Validator
 */
export interface DocumentProcessor {
  /**
   * Process multiple documents from file paths into validated documents with frontmatter.
   * Follows Totality principle - all error cases are handled and represented in the type system.
   *
   * @param filePaths Array of file paths to process
   * @param validationRules Rules for basic document validation
   * @returns Result containing processed documents or error information
   */
  processDocuments(
    filePaths: string[],
    validationRules: ValidationRules,
  ): Result<ProcessedDocument[], DocumentError & { message: string }>;

  /**
   * Process a single document from a file path.
   * Internal method for processing individual documents.
   *
   * @param filePath Path to the file to process
   * @param validationRules Rules for basic document validation
   * @returns Result containing processed document or error information
   */
  processDocument(
    filePath: string,
    validationRules: ValidationRules,
  ): Result<ProcessedDocument, DocumentError & { message: string }>;
}
