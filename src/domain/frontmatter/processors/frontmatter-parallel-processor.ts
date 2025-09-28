/**
 * @fileoverview FrontmatterParallelProcessor - Domain Service for parallel frontmatter processing
 * @description Extracted from FrontmatterTransformationService to follow DDD boundaries
 * Following Frontmatter Context responsibilities for parallel document processing
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { ProcessingBoundsMonitor } from "../../shared/types/processing-bounds.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";

/**
 * Configuration for frontmatter parallel processor dependencies
 * Following dependency injection pattern for DDD compliance
 */
export interface FrontmatterParallelProcessorConfig {
  readonly processDocument: (
    filePath: string,
    validationRules: ValidationRules,
  ) => Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  >;
  readonly debugLogger?: DebugLogger;
}

/**
 * FrontmatterParallelProcessor - Domain Service for Frontmatter Context
 *
 * Responsibilities:
 * - Parallel processing of multiple markdown files with configurable workers
 * - Memory bounds monitoring during parallel operations
 * - Batch processing with worker pool pattern
 * - Error aggregation and result collection
 *
 * Following DDD principles:
 * - Single responsibility: Parallel processing coordination only
 * - Domain service: Cross-aggregate operations within Frontmatter Context
 * - Totality: All methods return Result<T,E>
 */
export class FrontmatterParallelProcessor {
  private constructor(
    private readonly config: FrontmatterParallelProcessorConfig,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates parallel processor with validated configuration
   */
  static create(
    config: FrontmatterParallelProcessorConfig,
  ): Result<FrontmatterParallelProcessor, DomainError & { message: string }> {
    if (!config?.processDocument) {
      return err(createError({
        kind: "InitializationError",
        message: "ProcessDocument function is required for parallel processor",
      }));
    }

    return ok(new FrontmatterParallelProcessor(config));
  }

  /**
   * Process files in parallel using configurable worker pool
   * Implements batch processing with memory bounds monitoring
   * Following Totality principles with comprehensive error handling
   */
  async processFilesInParallel(
    filePaths: string[],
    validationRules: ValidationRules,
    maxWorkers: number,
    boundsMonitor: ProcessingBoundsMonitor,
  ): Promise<
    Result<
      Array<{ document: MarkdownDocument; frontmatterData: FrontmatterData }>,
      DomainError & { message: string }
    >
  > {
    if (filePaths.length === 0) {
      return ok([]);
    }

    if (maxWorkers <= 0) {
      return err(createError({
        kind: "InvalidType",
        expected: "positive integer",
        actual: maxWorkers.toString(),
      }, "MaxWorkers must be a positive integer"));
    }

    const results: Array<
      { document: MarkdownDocument; frontmatterData: FrontmatterData }
    > = [];
    const errors: Array<DomainError & { message: string }> = [];

    // Worker pool variance debug information
    const workerPoolDebugInfo = this.createWorkerPoolDebugInfo(
      filePaths,
      maxWorkers,
    );

    this.config.debugLogger?.debug(
      "Worker pool variance debug information",
      createLogContext({
        operation: "parallel-processing",
        inputs: workerPoolDebugInfo,
      }),
    );

    // Create batches for worker processing
    const batchSize = Math.max(1, Math.ceil(filePaths.length / maxWorkers));
    const batches = this.createBatches(filePaths, batchSize);

    this.config.debugLogger?.debug(
      `Created ${batches.length} batches with batch size ${batchSize}`,
      createLogContext({
        operation: "parallel-batch-creation",
        inputs:
          `batchCount: ${batches.length}, batchSize: ${batchSize}, totalFiles: ${filePaths.length}`,
      }),
    );

    // Process batches in parallel using Promise.all
    try {
      const batchPromises = batches.map((batch, batchIndex) => {
        return Promise.resolve(this.processBatch(
          batch,
          batchIndex,
          batches.length,
          validationRules,
          boundsMonitor,
          results.length,
        ));
      });

      // Wait for all batches to complete
      const batchOutputs = await Promise.all(batchPromises);

      // Collect all results and errors
      for (const { batchResults, batchErrors } of batchOutputs) {
        results.push(...batchResults);
        errors.push(...batchErrors);
      }

      this.config.debugLogger?.info(
        `Parallel processing completed: ${results.length} successful, ${errors.length} errors`,
        createLogContext({
          operation: "parallel-processing-completion",
          inputs:
            `successCount: ${results.length}, errorCount: ${errors.length}, totalFiles: ${filePaths.length}`,
        }),
      );

      // Return results even if some files failed (matching sequential behavior)
      if (results.length === 0 && errors.length > 0) {
        return err(errors[0]);
      }

      return ok(results);
    } catch (error) {
      const processingError = ErrorHandler.aggregation({
        operation: "processFilesInParallel",
        method: "handleParallelProcessing",
      }).aggregationFailed(
        `Parallel processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      this.config.debugLogger?.error(
        "Parallel processing encountered an unexpected error",
        createLogContext({
          operation: "parallel-processing-error",
          inputs: "Parallel processing failed",
        }),
      );

      return processingError;
    }
  }

  /**
   * Create worker pool debug information for monitoring
   * Private helper method for performance analysis
   */
  private createWorkerPoolDebugInfo(
    filePaths: string[],
    maxWorkers: number,
  ): Record<string, unknown> {
    return {
      varianceTarget: "worker-pool-variance-control",
      workerPoolConfiguration: {
        maxWorkers,
        fileCount: filePaths.length,
        optimalWorkerCount: Math.min(maxWorkers, filePaths.length),
        workerUtilizationRatio: filePaths.length / maxWorkers,
        parallelEfficiencyPrediction: maxWorkers > filePaths.length
          ? "over-provisioned"
          : "optimal-or-under-provisioned",
      },
      batchingVarianceFactors: {
        calculatedBatchSize: Math.max(
          1,
          Math.ceil(filePaths.length / maxWorkers),
        ),
        batchCountVariance: Math.ceil(filePaths.length / maxWorkers),
        batchBalancing: (filePaths.length % maxWorkers) === 0
          ? "perfect"
          : "unbalanced",
        lastBatchSize: filePaths.length %
          Math.max(1, Math.ceil(filePaths.length / maxWorkers)),
        workerLoadDistribution: "round-robin-batching",
      },
      coordinationVarianceRisks: {
        promiseAllSynchronization: "high-variance",
        batchResultAggregation: "medium-variance",
        errorHandlingComplexity: "high-variance",
        memoryCoordinationOverhead: "medium-variance",
      },
      workerPoolVarianceMetrics: {
        estimatedMemoryPerWorker: `${
          Math.ceil(filePaths.length / maxWorkers) * 2
        }MB`,
        estimatedCpuUtilization: `${Math.min(100, maxWorkers * 25)}%`,
        estimatedCoordinationLatency: `${maxWorkers * 5}ms`,
        estimatedVarianceRange: `${maxWorkers}x-${
          Math.ceil(maxWorkers * 1.5)
        }x-speedup`,
      },
      debugLogLevel: "worker-pool-variance",
      parallelVarianceTrackingEnabled: true,
      realTimeMetrics: {
        currentMemoryMB: Math.round(Deno.memoryUsage().heapUsed / 1024 / 1024),
        processingStartTime: performance.now(),
        expectedFinishTime: `+${
          Math.ceil(filePaths.length / maxWorkers) * 100
        }ms`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create batches from file paths for parallel processing
   * Private helper method with optimized batch distribution
   */
  private createBatches(filePaths: string[], batchSize: number): string[][] {
    const batches: string[][] = [];

    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Process a single batch of files
   * Returns results and errors for the batch
   */
  private processBatch(
    batch: string[],
    batchIndex: number,
    totalBatches: number,
    validationRules: ValidationRules,
    boundsMonitor: ProcessingBoundsMonitor,
    currentResultCount: number,
  ): {
    batchResults: Array<
      { document: MarkdownDocument; frontmatterData: FrontmatterData }
    >;
    batchErrors: Array<DomainError & { message: string }>;
  } {
    const batchResults: Array<
      { document: MarkdownDocument; frontmatterData: FrontmatterData }
    > = [];
    const batchErrors: Array<DomainError & { message: string }> = [];

    this.config.debugLogger?.debug(
      `Processing batch ${
        batchIndex + 1
      }/${totalBatches} with ${batch.length} files`,
      createLogContext({
        operation: "parallel-batch-processing",
        inputs: `batchIndex: ${batchIndex + 1}, batchSize: ${batch.length}`,
      }),
    );

    for (const filePath of batch) {
      // Memory bounds monitoring for each file
      const state = boundsMonitor.checkState(
        currentResultCount + batchResults.length,
      );

      if (state.kind === "exceeded_limit") {
        const boundsError = ErrorHandler.system({
          operation: "processFilesInParallel",
          method: "checkBatchMemoryBounds",
        }).memoryBoundsViolation(
          `Processing exceeded bounds: ${state.limit}`,
        );
        if (!boundsError.ok) {
          batchErrors.push(boundsError.error);
        }
        break;
      }

      if (state.kind === "approaching_limit") {
        this.config.debugLogger?.warn(
          `Approaching memory limit in batch ${batchIndex + 1}: ${
            Math.round(state.usage.heapUsed / 1024 / 1024)
          }MB used, threshold: ${
            Math.round(state.warningThreshold / 1024 / 1024)
          }MB`,
          createLogContext({
            operation: "parallel-memory-monitoring",
            inputs: `batchIndex: ${
              batchIndex + 1
            }, heapUsed: ${state.usage.heapUsed}, warningThreshold: ${state.warningThreshold}`,
          }),
        );
      }

      const documentResult = this.config.processDocument(
        filePath,
        validationRules,
      );

      if (documentResult.ok) {
        batchResults.push(documentResult.data);
        this.config.debugLogger?.debug(
          `Successfully processed file in batch ${batchIndex + 1}: ${filePath}`,
          createLogContext({
            operation: "parallel-file-processing",
            inputs: `batchIndex: ${batchIndex + 1}, filePath: ${filePath}`,
          }),
        );
      } else {
        batchErrors.push(documentResult.error);
        this.config.debugLogger?.error(
          `Failed to process file in batch ${batchIndex + 1}: ${filePath}`,
          createLogContext({
            operation: "parallel-file-processing",
            inputs: `batchIndex: ${
              batchIndex + 1
            }, filePath: ${filePath}, error: ${documentResult.error.message}`,
          }),
        );
      }
    }

    return { batchResults, batchErrors };
  }
}
