/**
 * Frontmatter Processor Service Interface
 *
 * Domain service for document transformation within Frontmatter Context.
 * Defines contract for transforming documents with frontmatter data.
 */

import type { DomainError, Result } from "../../core/result.ts";
import type { Document, Schema } from "../../models/entities.ts";
import type { TransformationResult } from "../../models/transformation.ts";

/**
 * Domain service interface for frontmatter processing
 *
 * Belongs to Frontmatter Context in DDD boundaries
 */
export interface FrontmatterProcessor {
  /**
   * Transform a document using schema and prompts
   *
   * @param document Document to transform
   * @param schema Schema for validation and transformation
   * @param extractionPrompt Optional extraction prompt
   * @param mappingPrompt Optional mapping prompt
   * @returns Result containing transformation result
   */
  transformDocument(
    document: Document,
    schema: Schema,
    extractionPrompt: string | undefined,
    mappingPrompt: string | undefined,
  ): Promise<Result<TransformationResult, DomainError>>;
}
