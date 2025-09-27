import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";
import { ProcessingBoundsMonitor } from "../../shared/types/processing-bounds.ts";

/**
 * Transformation Strategy (Legacy Compatibility)
 *
 * Basic transformation strategy for processing documents.
 * Maintained for compatibility during transition to 3-domain architecture.
 */
export interface ProcessingResult {
  readonly kind: "success" | "failed" | "skipped";
  readonly data?: FrontmatterData;
  readonly document?: MarkdownDocument;
  readonly filePath?: string;
  readonly error?: string;
  readonly reason?: string;
}

export interface ProcessingFunction {
  (filePath: FilePath, rules: ValidationRules): Result<{
    kind: "success";
    data: FrontmatterData;
    document: MarkdownDocument;
  }, unknown>;
}

export interface TransformationStrategy {
  execute(
    filePaths: FilePath[],
    validationRules: ValidationRules,
    processingFunction: ProcessingFunction,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<Result<ProcessingResult[], unknown>>;

  getDescription(): string;
}

export interface ProcessingStrategyState {
  readonly kind: "sequential" | "parallel" | "adaptive";
  readonly workers?: number;
  readonly baseWorkers?: number;
  readonly threshold?: number;
}

/**
 * Sequential processing strategy
 */
export class SequentialTransformationStrategy
  implements TransformationStrategy {
  getDescription(): string {
    return "Sequential processing strategy";
  }

  execute(
    filePaths: FilePath[],
    validationRules: ValidationRules,
    processingFunction: ProcessingFunction,
    _boundsMonitor: ProcessingBoundsMonitor,
    _logger?: DebugLogger,
  ): Promise<Result<ProcessingResult[], unknown>> {
    const results: ProcessingResult[] = [];

    for (const filePath of filePaths) {
      try {
        const result = processingFunction(filePath, validationRules);
        if (result.ok) {
          results.push({
            kind: "success",
            data: result.data.data,
            document: result.data.document,
          });
        } else {
          results.push({
            kind: "failed",
            filePath: filePath.toString(),
            error: String(result.error),
          });
        }
      } catch (error) {
        results.push({
          kind: "failed",
          filePath: filePath.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return Promise.resolve(ok(results));
  }
}

/**
 * Parallel processing strategy
 */
export class ParallelTransformationStrategy implements TransformationStrategy {
  constructor(private readonly workers: number = 4) {}

  getDescription(): string {
    return `Parallel processing strategy (${this.workers} workers)`;
  }

  async execute(
    filePaths: FilePath[],
    validationRules: ValidationRules,
    processingFunction: ProcessingFunction,
    _boundsMonitor: ProcessingBoundsMonitor,
    _logger?: DebugLogger,
  ): Promise<Result<ProcessingResult[], unknown>> {
    const results: ProcessingResult[] = [];
    const batchSize = Math.ceil(filePaths.length / this.workers);

    const batches = [];
    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }

    try {
      const batchPromises = batches.map((batch) => {
        const batchResults: ProcessingResult[] = [];
        for (const filePath of batch) {
          try {
            const result = processingFunction(filePath, validationRules);
            if (result.ok) {
              batchResults.push({
                kind: "success",
                data: result.data.data,
                document: result.data.document,
              });
            } else {
              batchResults.push({
                kind: "failed",
                filePath: filePath.toString(),
                error: String(result.error),
              });
            }
          } catch (error) {
            batchResults.push({
              kind: "failed",
              filePath: filePath.toString(),
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        return batchResults;
      });

      const batchResults = await Promise.all(batchPromises);
      for (const batch of batchResults) {
        results.push(...batch);
      }

      return ok(results);
    } catch (error) {
      return err(error);
    }
  }
}

/**
 * Strategy selector
 */
export class TransformationStrategySelector {
  selectStrategy(
    state: ProcessingStrategyState,
  ): Result<TransformationStrategy, DomainError & { message: string }> {
    switch (state.kind) {
      case "sequential":
        return ok(new SequentialTransformationStrategy());
      case "parallel":
        return ok(new ParallelTransformationStrategy(state.workers || 4));
      case "adaptive": {
        // For adaptive, choose based on threshold
        const workers = state.baseWorkers || 2;
        return ok(new ParallelTransformationStrategy(workers));
      }
      default:
        return err(createError({
          kind: "ConfigurationError",
          message: `Unknown processing strategy: ${(state as any).kind}`,
        }));
    }
  }
}
