import { Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";

/**
 * Document Processing Coordinator Interface (Legacy Compatibility)
 *
 * Interface for coordinating document processing.
 * Maintained for compatibility during transition to 3-domain architecture.
 */
export interface DocumentProcessingCoordinator {
  /**
   * Process documents according to configuration
   */
  processDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    options?: ProcessingOptions,
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>>;

  /**
   * Get processing status
   */
  getProcessingStatus(): ProcessingStatus;
}

export interface ProcessingOptions {
  readonly kind?: "sequential" | "parallel";
  readonly parallel?: boolean;
  readonly maxWorkers?: number;
  readonly batchSize?: number;
}

export interface DocumentProcessingResult {
  readonly processedData: FrontmatterData[];
  readonly processedCount: number;
  readonly failedCount: number;
  readonly duration: number;
  // Legacy compatibility properties
  readonly mainData?: FrontmatterData[];
  readonly itemsData?: FrontmatterData[];
}

export interface ProcessingStatus {
  readonly isProcessing: boolean;
  readonly currentFile?: string;
  readonly processedCount: number;
  readonly totalCount: number;
  readonly startTime?: Date;
}
