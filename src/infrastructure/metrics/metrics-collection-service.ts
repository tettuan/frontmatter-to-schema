import { ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { PipelineStrategyConfig } from "../../domain/pipeline/value-objects/pipeline-strategy-config.ts";
import {
  ComplexityMetricsService,
} from "../../domain/monitoring/services/complexity-metrics-service.ts";
import {
  EntropyManagementService,
} from "../../domain/monitoring/services/entropy-management-service.ts";
import {
  DebugMetricsService,
  EntropyControlMetrics,
  IntegratedControlMetrics,
  PipelineProcessingMetrics,
  ProcessingStrategyMetrics,
  TotalityControlMetrics,
} from "./debug-metrics-service.ts";

/**
 * Performance metrics for pipeline execution
 */
export interface PipelinePerformanceMetrics {
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly memoryUsageMB: {
    readonly initial: number;
    readonly current: number;
    readonly peak?: number;
  };
  readonly documentsProcessed: number;
  readonly errorsEncountered: number;
}

/**
 * Document processing metrics
 */
export interface DocumentProcessingMetrics {
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly batchSize: number;
  readonly parallelProcessing: boolean;
  readonly memoryGrowthMB: number;
  readonly actualVsPredicted: {
    readonly memoryVariance: number;
    readonly timeVariance: number;
  };
  readonly varianceRiskLevel: "high" | "medium" | "low" | "acceptable";
}

/**
 * Collected metrics for a complete pipeline execution
 */
export interface CollectedPipelineMetrics {
  readonly performance: PipelinePerformanceMetrics;
  readonly documentProcessing?: DocumentProcessingMetrics;
  readonly processingStrategy: ProcessingStrategyMetrics;
  readonly pipelineProcessing: PipelineProcessingMetrics;
  readonly entropyControl: EntropyControlMetrics;
  readonly totalityControl: TotalityControlMetrics;
  readonly integratedControl: IntegratedControlMetrics;
}

/**
 * Metrics Collection Service
 * Centralizes all metrics collection and analysis for the pipeline
 * Following DDD: Infrastructure service for cross-cutting concerns
 * Following Totality: All methods return Result<T,E>
 */
export class MetricsCollectionService {
  private readonly debugMetricsService: DebugMetricsService;
  private performanceMetrics: Map<string, PipelinePerformanceMetrics>;
  private documentMetrics: Map<string, DocumentProcessingMetrics>;

  constructor(
    private readonly complexityMetricsService: ComplexityMetricsService,
    private readonly entropyManagementService: EntropyManagementService,
    private readonly strategyConfig: PipelineStrategyConfig,
  ) {
    this.debugMetricsService = new DebugMetricsService(
      complexityMetricsService,
      entropyManagementService,
    );
    this.performanceMetrics = new Map();
    this.documentMetrics = new Map();
  }

  /**
   * Smart constructor following Totality principle
   */
  static create(
    complexityMetricsService: ComplexityMetricsService,
    entropyManagementService: EntropyManagementService,
    strategyConfig: PipelineStrategyConfig,
  ): Result<MetricsCollectionService, DomainError & { message: string }> {
    if (!complexityMetricsService) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "ComplexityMetricsService is required",
        }),
      };
    }
    if (!entropyManagementService) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "EntropyManagementService is required",
        }),
      };
    }
    if (!strategyConfig) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "PipelineStrategyConfig is required",
        }),
      };
    }

    return ok(
      new MetricsCollectionService(
        complexityMetricsService,
        entropyManagementService,
        strategyConfig,
      ),
    );
  }

  /**
   * Start tracking performance metrics for a pipeline execution
   */
  startPipelineMetrics(
    executionId: string,
  ): Result<PipelinePerformanceMetrics, DomainError & { message: string }> {
    const memoryUsage = Deno.memoryUsage();
    const metrics: PipelinePerformanceMetrics = {
      startTime: performance.now(),
      memoryUsageMB: {
        initial: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        current: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
      documentsProcessed: 0,
      errorsEncountered: 0,
    };

    this.performanceMetrics.set(executionId, metrics);
    return ok(metrics);
  }

  /**
   * Update performance metrics during pipeline execution
   */
  updatePipelineMetrics(
    executionId: string,
    updates: Partial<PipelinePerformanceMetrics>,
  ): Result<PipelinePerformanceMetrics, DomainError & { message: string }> {
    const existing = this.performanceMetrics.get(executionId);
    if (!existing) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: `No metrics found for execution ${executionId}`,
        }),
      };
    }

    const memoryUsage = Deno.memoryUsage();
    const currentMemoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    const updated: PipelinePerformanceMetrics = {
      ...existing,
      ...updates,
      memoryUsageMB: {
        ...existing.memoryUsageMB,
        current: currentMemoryMB,
        peak: Math.max(
          existing.memoryUsageMB.peak || existing.memoryUsageMB.initial,
          currentMemoryMB,
        ),
      },
    };

    this.performanceMetrics.set(executionId, updated);
    return ok(updated);
  }

  /**
   * Start pipeline execution tracking (alias for startPipelineMetrics)
   */
  startPipelineExecution(
    executionId: string,
  ): Result<PipelinePerformanceMetrics, DomainError & { message: string }> {
    return this.startPipelineMetrics(executionId);
  }

  /**
   * Complete pipeline execution tracking
   */
  completePipelineExecution(
    executionId: string,
    documentsProcessed: number,
    errorsEncountered: number,
  ): Result<PipelinePerformanceMetrics, DomainError & { message: string }> {
    const result = this.updatePipelineMetrics(executionId, {
      documentsProcessed,
      errorsEncountered,
      endTime: performance.now(),
    });
    if (!result.ok) return result;

    const metrics = result.data;
    const duration = (metrics.endTime || performance.now()) - metrics.startTime;
    return ok({ ...metrics, duration });
  }

  /**
   * Complete pipeline metrics tracking
   */
  completePipelineMetrics(
    executionId: string,
  ): Result<PipelinePerformanceMetrics, DomainError & { message: string }> {
    const existing = this.performanceMetrics.get(executionId);
    if (!existing) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: `No metrics found for execution ${executionId}`,
        }),
      };
    }

    const endTime = performance.now();
    const completed: PipelinePerformanceMetrics = {
      ...existing,
      endTime,
      duration: endTime - existing.startTime,
    };

    this.performanceMetrics.set(executionId, completed);
    return ok(completed);
  }

  /**
   * Collect all metrics for a pipeline execution
   */
  collectAllMetrics(
    executionId: string,
  ): Result<CollectedPipelineMetrics, DomainError & { message: string }> {
    const performanceMetrics = this.performanceMetrics.get(executionId);
    if (!performanceMetrics) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: `No metrics found for execution ${executionId}`,
        }),
      };
    }

    const documentMetrics = this.documentMetrics.get(executionId);
    const memoryUsage = Deno.memoryUsage();
    const processingStrategy = this.debugMetricsService
      .getProcessingStrategyMetrics(this.strategyConfig, memoryUsage);
    const pipelineProcessing = this.debugMetricsService
      .getPipelineProcessingMetrics(this.strategyConfig, 100);
    const entropyControl = this.debugMetricsService.getEntropyControlMetrics();
    const totalityControl = this.debugMetricsService
      .getTotalityControlMetrics();
    const integratedControl = this.debugMetricsService
      .getIntegratedControlMetrics();

    return ok({
      performance: performanceMetrics,
      documentProcessing: documentMetrics,
      processingStrategy: processingStrategy.ok
        ? processingStrategy.data
        : {} as any,
      pipelineProcessing: pipelineProcessing.ok
        ? pipelineProcessing.data
        : {} as any,
      entropyControl: entropyControl.ok ? entropyControl.data : {} as any,
      totalityControl: totalityControl.ok ? totalityControl.data : {} as any,
      integratedControl: integratedControl.ok
        ? integratedControl.data
        : {} as any,
    });
  }

  /**
   * Start tracking document processing metrics
   */
  startDocumentProcessingMetrics(
    executionId: string,
    batchSize: number,
    parallelProcessing: boolean,
  ): Result<DocumentProcessingMetrics, DomainError & { message: string }> {
    const metrics: DocumentProcessingMetrics = {
      startTime: performance.now(),
      batchSize,
      parallelProcessing,
      memoryGrowthMB: 0,
      actualVsPredicted: {
        memoryVariance: 0,
        timeVariance: 0,
      },
      varianceRiskLevel: "low",
    };

    this.documentMetrics.set(executionId, metrics);
    return ok(metrics);
  }

  /**
   * Complete document processing metrics
   */
  completeDocumentProcessingMetrics(
    executionId: string,
    memoryGrowthMB: number,
    predictedMemoryMB: number,
    predictedTimeMs: number,
  ): Result<DocumentProcessingMetrics, DomainError & { message: string }> {
    const existing = this.documentMetrics.get(executionId);
    if (!existing) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: `No document metrics found for execution ${executionId}`,
        }),
      };
    }

    const endTime = performance.now();
    const duration = endTime - existing.startTime;

    const memoryVariance = predictedMemoryMB > 0
      ? Math.floor((memoryGrowthMB / predictedMemoryMB) * 100)
      : 0;

    const timeVariance = predictedTimeMs > 0
      ? Math.floor((duration / predictedTimeMs) * 100)
      : 0;

    const varianceRiskLevel = memoryGrowthMB > predictedMemoryMB * 1.5
      ? "high"
      : memoryVariance > 120 || timeVariance > 150
      ? "medium"
      : "acceptable";

    const completed: DocumentProcessingMetrics = {
      ...existing,
      endTime,
      duration,
      memoryGrowthMB,
      actualVsPredicted: {
        memoryVariance,
        timeVariance,
      },
      varianceRiskLevel,
    };

    this.documentMetrics.set(executionId, completed);
    return ok(completed);
  }

  /**
   * Collect all metrics for pipeline execution
   */
  collectPipelineMetrics(
    executionId: string,
    initialMemory: Deno.MemoryUsage,
  ): Result<CollectedPipelineMetrics, DomainError & { message: string }> {
    const performanceMetrics = this.performanceMetrics.get(executionId);
    if (!performanceMetrics) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: `No performance metrics found for execution ${executionId}`,
        }),
      };
    }

    // Get processing strategy metrics
    const strategyMetricsResult = this.debugMetricsService
      .getProcessingStrategyMetrics(this.strategyConfig, initialMemory);
    if (!strategyMetricsResult.ok) {
      return strategyMetricsResult;
    }

    // Get pipeline processing metrics
    const pipelineMetricsResult = this.debugMetricsService
      .getPipelineProcessingMetrics(this.strategyConfig, 100); // Estimate
    if (!pipelineMetricsResult.ok) {
      return pipelineMetricsResult;
    }

    // Get entropy control metrics
    const entropyMetricsResult = this.debugMetricsService
      .getEntropyControlMetrics();
    if (!entropyMetricsResult.ok) {
      return entropyMetricsResult;
    }

    // Get totality control metrics
    const totalityMetricsResult = this.debugMetricsService
      .getTotalityControlMetrics();
    if (!totalityMetricsResult.ok) {
      return totalityMetricsResult;
    }

    // Get integrated control metrics
    const integratedMetricsResult = this.debugMetricsService
      .getIntegratedControlMetrics();
    if (!integratedMetricsResult.ok) {
      return integratedMetricsResult;
    }

    const documentMetrics = this.documentMetrics.get(executionId);

    const collectedMetrics: CollectedPipelineMetrics = {
      performance: performanceMetrics,
      documentProcessing: documentMetrics,
      processingStrategy: strategyMetricsResult.data,
      pipelineProcessing: pipelineMetricsResult.data,
      entropyControl: entropyMetricsResult.data,
      totalityControl: totalityMetricsResult.data,
      integratedControl: integratedMetricsResult.data,
    };

    return ok(collectedMetrics);
  }

  /**
   * Calculate document processing predictions
   */
  calculateProcessingPredictions(
    documentCount: number,
    validationRulesCount: number,
    availableMemoryMB: number,
  ): Result<{
    readonly sequentialTimeMs: number;
    readonly parallelTimeMs: number;
    readonly sequentialMemoryMB: number;
    readonly parallelMemoryMB: number;
    readonly optimalBatchSize: number;
    readonly shouldUseParallel: boolean;
  }, DomainError & { message: string }> {
    const optimalBatchSize = this.strategyConfig.calculateOptimalBatchSize(
      documentCount,
      availableMemoryMB * 0.6,
    );

    const shouldUseParallel = this.strategyConfig.shouldUseParallelProcessing(
      documentCount,
      validationRulesCount,
    );

    const concurrencyLevel = this.strategyConfig.getConcurrencyLevel();

    const predictions = {
      sequentialTimeMs: documentCount * 50, // 50ms per doc estimate
      parallelTimeMs: shouldUseParallel
        ? Math.ceil(documentCount / concurrencyLevel) * 50
        : documentCount * 50,
      sequentialMemoryMB: Math.floor(documentCount * 0.5), // 0.5MB per doc
      parallelMemoryMB: shouldUseParallel
        ? Math.floor(optimalBatchSize * concurrencyLevel * 0.5)
        : Math.floor(documentCount * 0.5),
      optimalBatchSize,
      shouldUseParallel,
    };

    return ok(predictions);
  }

  /**
   * Clear metrics for an execution
   */
  clearMetrics(
    executionId: string,
  ): Result<void, DomainError & { message: string }> {
    this.performanceMetrics.delete(executionId);
    this.documentMetrics.delete(executionId);
    return ok(undefined);
  }
}
