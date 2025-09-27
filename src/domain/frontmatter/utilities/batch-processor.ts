import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";

/**
 * Document Processor Port (Legacy Compatibility)
 */
export interface DocumentProcessorPort {
  processDocument(
    filePath: string,
    options?: Record<string, unknown>,
  ): Promise<
    Result<{
      document: MarkdownDocument;
      frontmatterData: FrontmatterData;
    }, DomainError & { message: string }>
  >;
}

/**
 * Batch Processor (Legacy Compatibility)
 *
 * Basic batch processing utilities.
 * Maintained for compatibility during transition to 3-domain architecture.
 */
export interface BatchProcessingOptions {
  readonly batchSize?: number;
  readonly parallel?: boolean;
  readonly maxConcurrency?: number;
}

export class BatchProcessor {
  static create(
    options: BatchProcessingOptions = {},
  ): Result<BatchProcessor, DomainError & { message: string }> {
    return ok(new BatchProcessor(options));
  }

  constructor(
    private readonly options: BatchProcessingOptions = {},
  ) {}

  /**
   * Process items in batches
   */
  async processBatch<T, R>(
    items: T[],
    processor: (
      item: T,
    ) => Promise<Result<R, DomainError & { message: string }>>,
  ): Promise<Result<R[], DomainError & { message: string }>> {
    const batchSize = this.options.batchSize || 10;
    const results: R[] = [];
    const errors: Array<DomainError & { message: string }> = [];

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        if (this.options.parallel) {
          // Process batch in parallel
          const batchPromises = batch.map((item) => processor(item));
          const batchResults = await Promise.all(batchPromises);

          for (const result of batchResults) {
            if (result.ok) {
              results.push(result.data);
            } else {
              errors.push(result.error);
            }
          }
        } else {
          // Process batch sequentially
          for (const item of batch) {
            const result = await processor(item);
            if (result.ok) {
              results.push(result.data);
            } else {
              errors.push(result.error);
            }
          }
        }
      }

      if (errors.length > 0 && results.length === 0) {
        return err(errors[0]);
      }

      return ok(results);
    } catch (error) {
      return err(createError(
        {
          kind: "EXCEPTION_CAUGHT",
          originalError: error,
        },
        `Batch processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ));
    }
  }

  /**
   * Create batches from array
   */
  createBatches<T>(items: T[], batchSize?: number): T[][] {
    const size = batchSize || this.options.batchSize || 10;
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }

    return batches;
  }
}
