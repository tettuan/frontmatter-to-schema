import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { ProcessingBoundsMonitor } from "../../shared/types/processing-bounds.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

/**
 * Utility for processing batches of files.
 *
 * Following DDD principles:
 * - Utility class for parallel processing operations
 * - Single responsibility: Batch processing coordination
 * - Pure functions with controlled side effects
 */
export class BatchProcessor {
  /**
   * Processes a batch of files with bounds monitoring.
   */
  static processBatch(
    batch: string[],
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    documentProcessor: DocumentProcessorPort,
  ): Result<
    {
      batchResults: Array<
        { document: MarkdownDocument; frontmatterData: FrontmatterData }
      >;
      batchErrors: Array<DomainError & { message: string }>;
    },
    DomainError & { message: string }
  > {
    const batchResults: Array<
      { document: MarkdownDocument; frontmatterData: FrontmatterData }
    > = [];
    const batchErrors: Array<DomainError & { message: string }> = [];

    for (const filePath of batch) {
      const state = boundsMonitor.checkState(batchResults.length);
      if (state.kind === "exceeded_limit") {
        const boundsError = ErrorHandler.system({
          operation: "processBatch",
          method: "checkBatchMemoryBounds",
        }).memoryBoundsViolation(`Processing exceeded bounds: ${state.limit}`);

        if (!boundsError.ok) {
          batchErrors.push(boundsError.error);
        }
        break;
      }

      const documentResult = documentProcessor.processDocument(
        filePath,
        validationRules,
      );
      if (documentResult.ok) {
        batchResults.push(documentResult.data);
      } else {
        batchErrors.push(documentResult.error);
      }
    }

    return ok({ batchResults, batchErrors });
  }

  /**
   * Creates batches from file list.
   */
  static createBatches(files: string[], maxWorkers: number): string[][] {
    const batchSize = Math.max(1, Math.ceil(files.length / maxWorkers));
    const batches: string[][] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    return batches;
  }
}

/**
 * Port interface for document processor used by batch processor.
 */
export interface DocumentProcessorPort {
  processDocument(
    filePath: string,
    validationRules: ValidationRules,
  ): Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  >;
}
