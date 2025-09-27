import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import {
  ProcessingStrategyState,
  TransformationStrategy,
  TransformationStrategySelector,
} from "../strategies/transformation-strategy.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";

/**
 * Processing Strategy Service (Legacy Compatibility)
 *
 * Service for managing processing strategies.
 * Maintained for compatibility during transition to 3-domain architecture.
 */
export interface ProcessingStrategyServiceConfig {
  readonly maxWorkers?: number;
  readonly batchSize?: number;
  readonly parallel?: boolean;
  readonly performanceSettings?: unknown;
  readonly documentProcessor?: unknown;
}

export class ProcessingStrategyService {
  private readonly strategySelector: TransformationStrategySelector;
  private readonly config: ProcessingStrategyServiceConfig;

  constructor(config: ProcessingStrategyServiceConfig = {}) {
    this.strategySelector = new TransformationStrategySelector();
    this.config = config;
  }

  static create(
    config: ProcessingStrategyServiceConfig = {},
  ): Result<ProcessingStrategyService, DomainError & { message: string }> {
    return ok(new ProcessingStrategyService(config));
  }

  /**
   * Select appropriate processing strategy
   */
  selectStrategy(
    state: ProcessingStrategyState,
  ): Result<TransformationStrategy, DomainError & { message: string }> {
    return this.strategySelector.selectStrategy(state);
  }

  /**
   * Get recommended strategy based on file count
   */
  getRecommendedStrategy(fileCount: number): ProcessingStrategyState {
    if (fileCount < 10) {
      return { kind: "sequential" };
    } else if (fileCount < 100) {
      return { kind: "parallel", workers: 4 };
    } else {
      return { kind: "adaptive", baseWorkers: 8, threshold: 50 };
    }
  }

  /**
   * Process documents using strategy (Legacy compatibility)
   */
  processDocuments(options: {
    inputPattern?: string;
    validationRules?: unknown;
    strategy?: ProcessingStrategyState;
    files?: string[];
    boundsMonitor?: unknown;
    processingOptionsState?: unknown;
  }): Promise<
    Result<{
      processedData: FrontmatterData[];
      processedCount: number;
      documents?: MarkdownDocument[];
    }, DomainError & { message: string }>
  > {
    try {
      // Basic implementation for compatibility
      // In the new 3-domain architecture, this is handled by the orchestrator

      console.log(`Processing documents with pattern: ${options.inputPattern}`);

      // Mock processing for compatibility
      return Promise.resolve(ok({
        processedData: [],
        processedCount: 0,
        documents: [],
      }));
    } catch (error) {
      return Promise.resolve(err(createError(
        {
          kind: "EXCEPTION_CAUGHT",
          originalError: error,
        },
        `Document processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )));
    }
  }
}
