import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";

/**
 * Pipeline Strategy Config (Legacy Compatibility)
 *
 * Configuration for pipeline processing strategies.
 * Maintained for compatibility during transition to 3-domain architecture.
 */
export interface PipelineStrategyOptions {
  readonly parallel?: boolean;
  readonly maxWorkers?: number;
  readonly batchSize?: number;
}

export class PipelineStrategyConfig {
  constructor(
    private readonly options: PipelineStrategyOptions,
  ) {}

  static create(
    options: PipelineStrategyOptions = {},
  ): Result<PipelineStrategyConfig, DomainError & { message: string }> {
    return ok(new PipelineStrategyConfig(options));
  }

  isParallel(): boolean {
    return this.options.parallel ?? false;
  }

  getMaxWorkers(): number {
    return this.options.maxWorkers ?? 1;
  }

  getBatchSize(): number {
    return this.options.batchSize ?? 10;
  }

  getOptions(): PipelineStrategyOptions {
    return { ...this.options };
  }

  /**
   * Create a balanced strategy configuration
   */
  static forBalanced(): Result<
    PipelineStrategyConfig,
    DomainError & { message: string }
  > {
    return PipelineStrategyConfig.create({
      parallel: false,
      maxWorkers: 2,
      batchSize: 10,
    });
  }

  /**
   * Get processing strategy name
   */
  getProcessingStrategy(): string {
    return this.isParallel() ? "parallel" : "sequential";
  }

  /**
   * Get memory strategy
   */
  getMemoryStrategy(): string {
    return "balanced";
  }

  /**
   * Check if adaptive scaling is enabled
   */
  isAdaptiveScalingEnabled(): boolean {
    return false; // Not implemented in legacy version
  }

  /**
   * Calculate expected variance reduction
   */
  calculateExpectedVarianceReduction(): number {
    return 0.1; // Default value for legacy compatibility
  }

  /**
   * Get performance thresholds
   */
  getPerformanceThresholds(): {
    warning: number;
    critical: number;
    maxMemoryVariancePct: number;
    maxThroughputVariancePct: number;
    maxErrorRecoveryTimeMs: number;
    maxCpuUtilizationPct: number;
  } {
    return {
      warning: 80,
      critical: 95,
      maxMemoryVariancePct: 80,
      maxThroughputVariancePct: 80,
      maxErrorRecoveryTimeMs: 5000,
      maxCpuUtilizationPct: 90,
    };
  }

  /**
   * Check if should use parallel processing
   */
  shouldUseParallelProcessing(itemCount: number, complexity: number): boolean {
    return itemCount > 100 && complexity > 5;
  }

  /**
   * Get concurrency level
   */
  getConcurrencyLevel(): number {
    return this.getMaxWorkers();
  }

  /**
   * Calculate optimal batch size
   */
  calculateOptimalBatchSize(itemCount: number, memoryUsage?: number): number {
    if (memoryUsage && memoryUsage > 80) {
      return Math.max(1, Math.min(5, this.getBatchSize()));
    }
    if (itemCount < 10) return itemCount;
    if (itemCount < 100) return 10;
    return this.getBatchSize();
  }
}
