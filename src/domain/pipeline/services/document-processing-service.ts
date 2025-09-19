import { ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../../frontmatter/entities/markdown-document.ts";
import { PipelineStrategyConfig } from "../../../application/value-objects/pipeline-strategy-config.ts";
import { ProcessingCoordinator } from "../../../application/coordinators/processing-coordinator.ts";
import { LoggingService } from "../../../infrastructure/logging/logging-service.ts";

/**
 * Document processing configuration
 */
export interface DocumentProcessingConfig {
  readonly inputPattern: string;
  readonly strategyConfig: PipelineStrategyConfig;
  readonly maxWorkers?: number;
}

/**
 * Document processing metrics
 */
export interface DocumentProcessingMetrics {
  readonly documentsProcessed: number;
  readonly processingTimeMs: number;
  readonly memoryUsageMB: {
    readonly initial: number;
    readonly peak: number;
    readonly growth: number;
  };
  readonly strategy: "sequential" | "parallel";
  readonly batchSize?: number;
  readonly concurrencyLevel?: number;
}

/**
 * Processing strategy decision
 */
export interface ProcessingStrategyDecision {
  readonly shouldUseParallel: boolean;
  readonly optimalBatchSize: number;
  readonly concurrencyLevel: number;
  readonly memoryStrategy: string;
  readonly estimatedTimeMs: number;
  readonly estimatedMemoryMB: number;
}

/**
 * Document Processing Service
 *
 * Handles document processing logic extracted from PipelineOrchestrator.
 * Manages parallel/sequential processing strategies and worker pools.
 *
 * Following DDD: Domain service for document processing
 * Following Totality: All methods return Result<T,E>
 */
export class DocumentProcessingService {
  private constructor(
    private readonly processingCoordinator: ProcessingCoordinator,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Smart constructor following Totality principle
   */
  static create(
    processingCoordinator: ProcessingCoordinator,
    loggingService: LoggingService,
  ): Result<DocumentProcessingService, DomainError & { message: string }> {
    if (!processingCoordinator) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "ProcessingCoordinator is required",
        }),
      };
    }

    if (!loggingService) {
      return {
        ok: false,
        error: createError({
          kind: "ConfigurationError",
          message: "LoggingService is required",
        }),
      };
    }

    return ok(
      new DocumentProcessingService(
        processingCoordinator,
        loggingService,
      ),
    );
  }

  /**
   * Process documents with optimal strategy
   */
  async processDocuments(
    config: DocumentProcessingConfig,
    validationRules: ValidationRules,
    schema: Schema,
  ): Promise<Result<FrontmatterData[], DomainError & { message: string }>> {
    const startTime = performance.now();
    const initialMemory = Deno.memoryUsage();

    // Determine processing strategy
    const strategyDecisionResult = this.determineProcessingStrategy(
      config.strategyConfig,
      validationRules,
    );
    if (!strategyDecisionResult.ok) {
      return strategyDecisionResult;
    }
    const strategy = strategyDecisionResult.data;

    // Log strategy decision
    this.loggingService.debug("Document processing strategy selected", {
      operation: "document-batch-processing",
      strategy: {
        parallel: strategy.shouldUseParallel,
        batchSize: strategy.optimalBatchSize,
        concurrency: strategy.concurrencyLevel,
        estimatedTime: strategy.estimatedTimeMs,
        estimatedMemory: strategy.estimatedMemoryMB,
      },
    });

    // Process documents using coordinator
    const processingOptions = strategy.shouldUseParallel
      ? { kind: "parallel" as const, maxWorkers: strategy.concurrencyLevel }
      : { kind: "sequential" as const };

    const processedDataResult = await this.processingCoordinator
      .processDocuments(
        config.inputPattern,
        validationRules,
        schema,
        processingOptions,
      );

    if (!processedDataResult.ok) {
      return processedDataResult;
    }

    // Calculate and log metrics
    const endTime = performance.now();
    const finalMemory = Deno.memoryUsage();

    const metrics: DocumentProcessingMetrics = {
      documentsProcessed: Array.isArray(processedDataResult.data)
        ? processedDataResult.data.length
        : 1,
      processingTimeMs: Math.floor(endTime - startTime),
      memoryUsageMB: {
        initial: Math.floor(initialMemory.heapUsed / 1024 / 1024),
        peak: Math.floor(finalMemory.heapUsed / 1024 / 1024),
        growth: Math.floor(
          (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024,
        ),
      },
      strategy: strategy.shouldUseParallel ? "parallel" : "sequential",
      batchSize: strategy.optimalBatchSize,
      concurrencyLevel: strategy.concurrencyLevel,
    };

    this.loggingService.info("Document processing completed", {
      operation: "document-processing-complete",
      metrics,
    });

    return ok(
      Array.isArray(processedDataResult.data)
        ? processedDataResult.data
        : [processedDataResult.data],
    );
  }

  /**
   * Determine optimal processing strategy based on configuration and workload
   */
  determineProcessingStrategy(
    strategyConfig: PipelineStrategyConfig,
    validationRules: ValidationRules,
  ): Result<ProcessingStrategyDecision, DomainError & { message: string }> {
    const memoryUsage = Deno.memoryUsage();
    const availableMemoryMB = Math.floor(
      memoryUsage.heapTotal / 1024 / 1024 * 0.6,
    );

    // Estimate document count (this is a simplified estimation)
    const estimatedDocumentCount = 100;

    const optimalBatchSize = strategyConfig.calculateOptimalBatchSize(
      estimatedDocumentCount,
      availableMemoryMB,
    );

    const shouldUseParallel = strategyConfig.shouldUseParallelProcessing(
      estimatedDocumentCount,
      validationRules.getCount(),
    );

    const concurrencyLevel = shouldUseParallel
      ? strategyConfig.getConcurrencyLevel()
      : 1;

    const decision: ProcessingStrategyDecision = {
      shouldUseParallel,
      optimalBatchSize,
      concurrencyLevel,
      memoryStrategy: strategyConfig.getMemoryStrategy(),
      estimatedTimeMs: this.estimateProcessingTime(
        estimatedDocumentCount,
        shouldUseParallel,
        concurrencyLevel,
      ),
      estimatedMemoryMB: this.estimateMemoryUsage(
        estimatedDocumentCount,
        shouldUseParallel,
        optimalBatchSize,
        concurrencyLevel,
      ),
    };

    return ok(decision);
  }

  /**
   * Estimate processing time based on strategy
   */
  private estimateProcessingTime(
    documentCount: number,
    parallel: boolean,
    concurrency: number,
  ): number {
    const baseTimePerDoc = 50; // 50ms per document estimate

    if (parallel) {
      return Math.ceil(documentCount / concurrency) * baseTimePerDoc;
    }

    return documentCount * baseTimePerDoc;
  }

  /**
   * Estimate memory usage based on strategy
   */
  private estimateMemoryUsage(
    documentCount: number,
    parallel: boolean,
    batchSize: number,
    concurrency: number,
  ): number {
    const memoryPerDoc = 0.5; // 0.5MB per document estimate

    if (parallel) {
      return Math.floor(batchSize * concurrency * memoryPerDoc);
    }

    return Math.floor(documentCount * memoryPerDoc);
  }

  /**
   * Process documents in batches for memory efficiency
   */
  processInBatches(
    documents: MarkdownDocument[],
    batchSize: number,
    _validationRules: ValidationRules,
    _schema: Schema,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    const results: FrontmatterData[] = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      this.loggingService.debug(`Processing batch ${i / batchSize + 1}`, {
        batchSize: batch.length,
        progress: `${i + batch.length}/${documents.length}`,
      });

      // Process batch (simplified - actual implementation would use ProcessingCoordinator)
      for (const doc of batch) {
        const dataResult = { ok: true as const, data: doc.getFrontmatter() };
        if (dataResult.ok) {
          results.push(dataResult.data);
        }
      }
    }

    return ok(results);
  }

  /**
   * Calculate variance metrics for monitoring
   */
  calculateVarianceMetrics(
    actual: DocumentProcessingMetrics,
    predicted: ProcessingStrategyDecision,
  ): Result<{
    readonly memoryVariancePct: number;
    readonly timeVariancePct: number;
    readonly riskLevel: "high" | "medium" | "low" | "acceptable";
  }, DomainError & { message: string }> {
    const memoryVariance = predicted.estimatedMemoryMB > 0
      ? Math.floor(
        (actual.memoryUsageMB.growth / predicted.estimatedMemoryMB) * 100,
      )
      : 0;

    const timeVariance = predicted.estimatedTimeMs > 0
      ? Math.floor((actual.processingTimeMs / predicted.estimatedTimeMs) * 100)
      : 0;

    const riskLevel = memoryVariance > 150 || timeVariance > 200
      ? "high"
      : memoryVariance > 120 || timeVariance > 150
      ? "medium"
      : memoryVariance > 100 || timeVariance > 100
      ? "low"
      : "acceptable";

    return ok({
      memoryVariancePct: memoryVariance,
      timeVariancePct: timeVariance,
      riskLevel,
    });
  }
}
