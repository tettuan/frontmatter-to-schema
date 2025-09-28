import { Result } from "../../domain/shared/types/result.ts";
import { FrontmatterError } from "../../domain/shared/types/errors.ts";
import { ValidationRules } from "../../domain/schema/value-objects/validation-rules.ts";

/**
 * Frontmatter Context Port - DDD Boundary Interface
 *
 * Defines the contract for Frontmatter Context interactions following DDD principles.
 * This interface encapsulates all Frontmatter-related operations following the
 * short lifecycle pattern defined in the architecture.
 */

export interface ValidatedData {
  readonly data: Record<string, unknown>;
  readonly filePath: string;
  readonly validated: boolean;
}

export interface ProcessedDocument {
  readonly filePath: string;
  readonly frontmatter: ValidatedData;
  readonly processedAt: Date;
}

/**
 * Frontmatter Context Port Interface
 *
 * Following the DDD architecture design from docs/domain/domain-boundary.md:
 * - Short lifecycle context for frontmatter processing
 * - Receives ValidationRules from Schema Context
 * - Provides ValidatedData to Template Context
 * - Provides ValidatedData[] to Aggregation Context
 */
export interface FrontmatterContextPort {
  /**
   * Process a single file and extract frontmatter
   * Implements the core Frontmatter Extraction stage
   */
  processFile(
    filePath: string,
  ): Promise<Result<ProcessedDocument, FrontmatterError>>;

  /**
   * Process multiple files in batch
   * Optimized for bulk processing scenarios
   */
  processFiles(
    filePaths: string[],
  ): Promise<Result<ProcessedDocument[], FrontmatterError>>;

  /**
   * Validate frontmatter data against schema rules
   * Implements Frontmatter → Validation flow
   */
  validateData(
    rawData: Record<string, unknown>,
    rules: ValidationRules,
    filePath: string,
  ): Result<ValidatedData, FrontmatterError>;

  /**
   * Extract frontmatter part data for aggregation
   * Supports x-frontmatter-part schema extension
   */
  extractFrontmatterPart(
    documents: ProcessedDocument[],
    partPath: string,
  ): Result<ValidatedData[], FrontmatterError>;

  /**
   * Get all validated data for aggregation context
   * Provides ValidatedData[] interface to Aggregation Context
   */
  getAllValidatedData(): ValidatedData[];
}

/**
 * Frontmatter Context Factory
 *
 * Factory interface for creating Frontmatter Context instances.
 * Allows dependency injection while maintaining context boundaries.
 */
export interface FrontmatterContextFactory {
  create(): FrontmatterContextPort;
}
