/**
 * @fileoverview Transformation Strategy Pattern
 * @description Strategy pattern for different transformation approaches
 * Following DDD and Totality principles
 */

import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { ProcessingBoundsMonitor } from "../../shared/types/processing-bounds.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import {
  DocumentProcessingResult,
  MemoryMonitoringState,
  ProcessingStrategyState,
} from "../types/transformation-states.ts";

/**
 * Base interface for transformation strategies
 * All methods return Result types (Totality principle)
 */
export interface TransformationStrategy {
  /**
   * Check if this strategy can handle the given state
   */
  canHandle(state: ProcessingStrategyState): boolean;

  /**
   * Execute the transformation
   */
  execute(
    files: FilePath[],
    validationRules: ValidationRules,
    processDocument: (
      file: FilePath,
      rules: ValidationRules,
    ) => Result<DocumentProcessingResult, DomainError & { message: string }>,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<DocumentProcessingResult[], DomainError & { message: string }>
  >;

  /**
   * Get strategy description for logging
   */
  getDescription(): string;
}

/**
 * Sequential processing strategy
 * Processes files one by one in order
 */
export class SequentialStrategy implements TransformationStrategy {
  canHandle(state: ProcessingStrategyState): boolean {
    return state.kind === "sequential";
  }

  async execute(
    files: FilePath[],
    validationRules: ValidationRules,
    processDocument: (
      file: FilePath,
      rules: ValidationRules,
    ) => Result<DocumentProcessingResult, DomainError & { message: string }>,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<DocumentProcessingResult[], DomainError & { message: string }>
  > {
    const results: DocumentProcessingResult[] = [];

    for (const file of files) {
      // Check memory bounds
      const memoryState = this.checkMemoryBounds(boundsMonitor, results.length);

      switch (memoryState.kind) {
        case "exceeded_limit":
          return ErrorHandler.system({
            operation: "SequentialStrategy",
            method: "execute",
          }).memoryBoundsViolation(
            `Memory limit exceeded: ${memoryState.heapUsed}/${memoryState.limit}`,
          );

        case "approaching_limit":
          logger?.warn(
            `Approaching memory limit: ${
              Math.round(memoryState.heapUsed / 1024 / 1024)
            }MB used`,
            {
              operation: "sequential-processing",
              warningThreshold: memoryState.warningThreshold,
              limit: memoryState.limit,
              timestamp: new Date().toISOString(),
            },
          );
          break;

        case "within_bounds":
          // Continue processing
          break;
      }

      logger?.debug(`Processing file sequentially: ${file}`, {
        operation: "sequential-processing",
        filePath: file.toString(),
        timestamp: new Date().toISOString(),
      });

      // Small delay to yield control back to event loop
      await new Promise((resolve) => setTimeout(resolve, 0));

      const result = processDocument(file, validationRules);

      if (result.ok) {
        results.push(result.data);
        logger?.debug(`Successfully processed: ${file}`, {
          operation: "sequential-processing",
          status: "success",
          timestamp: new Date().toISOString(),
        });
      } else {
        // Log error but continue processing other files
        logger?.error(`Failed to process file: ${file}`, {
          operation: "sequential-processing",
          error: result.error,
          timestamp: new Date().toISOString(),
        });
        results.push({
          kind: "failed",
          error: result.error,
          filePath: file.toString(),
        });
      }
    }

    return ok(results);
  }

  getDescription(): string {
    return "Sequential Processing Strategy";
  }

  private checkMemoryBounds(
    monitor: ProcessingBoundsMonitor,
    processedCount: number,
  ): MemoryMonitoringState {
    const state = monitor.checkState(processedCount);
    const bounds = monitor.getBounds();

    switch (state.kind) {
      case "exceeded_limit":
        return {
          kind: "exceeded_limit",
          heapUsed: state.usage.heapUsed,
          limit: state.limit,
        };

      case "approaching_limit": {
        // For approaching_limit, derive limit from bounds or warningThreshold
        const approachingLimit = bounds.kind === "bounded"
          ? bounds.memoryLimit
          : state.warningThreshold * 1.25; // Estimate limit as 125% of warning threshold
        return {
          kind: "approaching_limit",
          heapUsed: state.usage.heapUsed,
          warningThreshold: state.warningThreshold,
          limit: approachingLimit,
        };
      }

      case "within_bounds": {
        // For within_bounds, use actual bounds if available
        const withinLimit = bounds.kind === "bounded"
          ? bounds.memoryLimit
          : Number.MAX_SAFE_INTEGER; // Unbounded case
        return {
          kind: "within_bounds",
          heapUsed: state.usage.heapUsed,
          limit: withinLimit,
        };
      }
    }
  }
}

/**
 * Parallel processing strategy
 * Processes files in parallel using worker pools
 */
export class ParallelStrategy implements TransformationStrategy {
  canHandle(state: ProcessingStrategyState): boolean {
    return state.kind === "parallel";
  }

  async execute(
    files: FilePath[],
    validationRules: ValidationRules,
    processDocument: (
      file: FilePath,
      rules: ValidationRules,
    ) => Result<DocumentProcessingResult, DomainError & { message: string }>,
    _boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<DocumentProcessingResult[], DomainError & { message: string }>
  > {
    const state = { kind: "parallel" as const, workers: 4 }; // Default workers

    logger?.info(
      `Using parallel processing with ${state.workers} workers for ${files.length} files`,
      {
        operation: "parallel-processing",
        workerCount: state.workers,
        fileCount: files.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Create batches for parallel processing
    const batchSize = Math.ceil(files.length / state.workers);
    const batches: FilePath[][] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    // Process batches in parallel
    const batchPromises = batches.map((batch, batchIndex) => {
      const batchResults: DocumentProcessingResult[] = [];

      for (const file of batch) {
        logger?.debug(`Processing file in batch ${batchIndex}: ${file}`, {
          operation: "parallel-batch-processing",
          batchIndex,
          filePath: file.toString(),
          timestamp: new Date().toISOString(),
        });

        const result = processDocument(file, validationRules);

        if (result.ok) {
          batchResults.push(result.data);
        } else {
          batchResults.push({
            kind: "failed",
            error: result.error,
            filePath: file.toString(),
          });
        }
      }

      return Promise.resolve(batchResults);
    });

    try {
      const batchResults = await Promise.all(batchPromises);
      const results = batchResults.flat();

      logger?.info(
        `Parallel processing completed: ${results.length} files processed`,
        {
          operation: "parallel-processing",
          processedCount: results.length,
          timestamp: new Date().toISOString(),
        },
      );

      return ok(results);
    } catch (error) {
      return ErrorHandler.system({
        operation: "ParallelStrategy",
        method: "execute",
      }).configurationError(`Parallel processing failed: ${error}`);
    }
  }

  getDescription(): string {
    return "Parallel Processing Strategy";
  }
}

/**
 * Adaptive processing strategy
 * Dynamically adjusts processing approach based on system state
 */
export class AdaptiveStrategy implements TransformationStrategy {
  canHandle(state: ProcessingStrategyState): boolean {
    return state.kind === "adaptive";
  }

  async execute(
    files: FilePath[],
    validationRules: ValidationRules,
    processDocument: (
      file: FilePath,
      rules: ValidationRules,
    ) => Result<DocumentProcessingResult, DomainError & { message: string }>,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<DocumentProcessingResult[], DomainError & { message: string }>
  > {
    const fileCount = files.length;

    // Determine optimal strategy based on file count and system state
    const strategy = this.selectOptimalStrategy(fileCount, boundsMonitor);

    logger?.info(`Adaptive strategy selected: ${strategy.getDescription()}`, {
      operation: "adaptive-processing",
      fileCount,
      selectedStrategy: strategy.getDescription(),
      timestamp: new Date().toISOString(),
    });

    return await strategy.execute(
      files,
      validationRules,
      processDocument,
      boundsMonitor,
      logger,
    );
  }

  getDescription(): string {
    return "Adaptive Processing Strategy";
  }

  private selectOptimalStrategy(
    fileCount: number,
    boundsMonitor: ProcessingBoundsMonitor,
  ): TransformationStrategy {
    // Check current memory state
    const memoryState = boundsMonitor.checkState(0);

    // If memory is tight, use sequential
    if (memoryState.kind === "approaching_limit") {
      return new SequentialStrategy();
    }

    // For small file counts, use sequential
    if (fileCount <= 5) {
      return new SequentialStrategy();
    }

    // For larger file counts, use parallel
    return new ParallelStrategy();
  }
}

/**
 * Strategy selector
 * Selects appropriate strategy based on processing state
 */
export class TransformationStrategySelector {
  private strategies: TransformationStrategy[];

  constructor() {
    this.strategies = [
      new SequentialStrategy(),
      new ParallelStrategy(),
      new AdaptiveStrategy(),
    ];
  }

  /**
   * Select strategy for given state
   * Returns Result to handle no matching strategy case (Totality)
   */
  selectStrategy(
    state: ProcessingStrategyState,
  ): Result<TransformationStrategy, DomainError & { message: string }> {
    const strategy = this.strategies.find((s) => s.canHandle(state));

    if (!strategy) {
      return ErrorHandler.system({
        operation: "TransformationStrategySelector",
        method: "selectStrategy",
      }).configurationError(`No strategy found for state: ${state.kind}`);
    }

    return ok(strategy);
  }
}
