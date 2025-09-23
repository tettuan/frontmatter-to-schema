import { Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { MarkdownDocument } from "../../frontmatter/entities/markdown-document.ts";
import { Schema } from "../../schema/entities/schema.ts";

/**
 * Domain interface for document processing coordination
 * Following DDD principles: Domain defines interfaces, Application implements them
 */
export interface ProcessingCoordinatorPort {
  /**
   * Process a single document with the given schema
   */
  processDocument(
    document: MarkdownDocument,
    schema: Schema,
  ): Promise<Result<ProcessedDocument, DomainError>>;

  /**
   * Process multiple documents in batch
   */
  processBatch(
    documents: MarkdownDocument[],
    schema: Schema,
  ): Promise<Result<ProcessedDocument[], DomainError>>;
}

/**
 * Processed document result from coordination
 */
export interface ProcessedDocument {
  readonly document: MarkdownDocument;
  readonly processingTimeMs: number;
  readonly success: boolean;
  readonly errors?: DomainError[];
}
