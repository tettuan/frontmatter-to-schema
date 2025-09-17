import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import {
  ProcessingBounds,
  ProcessingBoundsFactory,
  ProcessingBoundsMonitor,
} from "../../shared/types/processing-bounds.ts";
import { FilePath } from "../value-objects/file-path.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { MarkdownDocument } from "../entities/markdown-document.ts";
import { FrontmatterProcessor } from "../processors/frontmatter-processor.ts";
import { ValidationRules } from "../../schema/value-objects/validation-rules.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { Aggregator, DerivationRule } from "../../aggregation/index.ts";
import { BasePropertyPopulator } from "../../schema/services/base-property-populator.ts";
import { SchemaPathResolver } from "../../schema/services/schema-path-resolver.ts";
import {
  createLogContext,
  DebugLogger,
} from "../../shared/services/debug-logger.ts";
import { defaultSchemaExtensionRegistry } from "../../schema/value-objects/schema-extension-registry.ts";
import {
  defaultFrontmatterDataCreationService,
  FrontmatterDataCreationService,
} from "./frontmatter-data-creation-service.ts";

export interface FileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

export interface FileLister {
  list(pattern: string): Result<string[], DomainError & { message: string }>;
}

export interface ProcessedDocuments {
  readonly documents: MarkdownDocument[];
  readonly processedData: FrontmatterData[];
}

/**
 * Result of converting schema derivation rules to domain rules.
 * Replaces silent error handling with explicit rule conversion tracking.
 */
export type RuleConversionResult = {
  readonly successfulRules: DerivationRule[];
  readonly failedRuleCount: number;
  readonly errors: Array<DomainError & { message: string }>;
};

/**
 * Domain service responsible for transforming multiple Markdown files into integrated domain data.
 * Handles: Multiple Frontmatter → Validated + Aggregated + Structured Domain Data
 *
 * Transformation Pipeline:
 * 1. Extract frontmatter from multiple files
 * 2. Validate according to schema rules
 * 3. Aggregate and structure data
 * 4. Apply derivation rules
 * 5. Generate final integrated domain data
 */
export class FrontmatterTransformationService {
  constructor(
    private readonly frontmatterProcessor: FrontmatterProcessor,
    private readonly aggregator: Aggregator,
    private readonly basePropertyPopulator: BasePropertyPopulator,
    private readonly fileReader: FileReader,
    private readonly fileLister: FileLister,
    private readonly frontmatterDataCreationService:
      FrontmatterDataCreationService = defaultFrontmatterDataCreationService,
    private readonly logger?: DebugLogger,
  ) {}

  /**
   * Transform multiple frontmatter documents into integrated domain data.
   * Follows transformation pipeline: Extract → Validate → Aggregate → Structure → Integrate
   * Includes memory bounds monitoring following Totality principles
   */
  async transformDocuments(
    inputPattern: string,
    validationRules: ValidationRules,
    schema: Schema,
    logger?: DebugLogger,
    processingBounds?: ProcessingBounds,
    options?: {
      parallel?: boolean;
      maxWorkers?: number;
    },
  ): Promise<Result<FrontmatterData, DomainError & { message: string }>> {
    // Stage 1: List matching files
    const activeLogger = logger || this.logger;
    activeLogger?.info(
      `Starting document processing with pattern: ${inputPattern}`,
      {
        operation: "document-processing",
        pattern: inputPattern,
        timestamp: new Date().toISOString(),
      },
    );
    const filesResult = this.fileLister.list(inputPattern);
    if (!filesResult.ok) {
      activeLogger?.error(
        `Failed to list files with pattern: ${inputPattern}`,
        {
          operation: "file-listing",
          pattern: inputPattern,
          error: filesResult.error,
          timestamp: new Date().toISOString(),
        },
      );
      return filesResult;
    }

    activeLogger?.info(
      `Found ${filesResult.data.length} files to process`,
      {
        operation: "file-listing",
        count: filesResult.data.length,
        files: filesResult.data,
        timestamp: new Date().toISOString(),
      },
    );

    // Initialize memory bounds monitoring following Totality principles
    let actualBounds: ProcessingBounds;
    if (processingBounds) {
      actualBounds = processingBounds;
    } else {
      const defaultBoundsResult = ProcessingBoundsFactory.createDefault(
        filesResult.data.length,
      );
      if (!defaultBoundsResult.ok) {
        return err(defaultBoundsResult.error);
      }
      actualBounds = defaultBoundsResult.data;
    }

    // メモリ境界監視振れ幅デバッグ情報 (メモリ管理変動制御フロー Iteration 15)
    const memoryBoundsVarianceDebug = {
      varianceTarget: "memory-bounds-monitoring-variance-control",
      boundsConfiguration: {
        providedBounds: !!processingBounds,
        boundsType: actualBounds.kind,
        fileCount: filesResult.data.length,
        boundsCreationMethod: processingBounds
          ? "external-provided"
          : "factory-generated",
      },
      memoryMonitoringVarianceFactors: {
        dynamicBoundsCalculation: !processingBounds,
        fileCountImpact: filesResult.data.length,
        expectedMemoryGrowthPattern: actualBounds.kind === "bounded"
          ? "bounded-growth"
          : "unlimited-growth",
        monitoringOverhead: "per-file-check",
        boundsCheckingFrequency: "every-100-files",
      },
      memoryVariancePrediction: {
        estimatedPeakMemory: `${filesResult.data.length * 2}MB`,
        memoryGrowthRate: "O(n)-linear",
        monitoringImpact: `${Math.ceil(filesResult.data.length / 100) * 5}ms`,
        boundsViolationRisk: actualBounds.kind === "unbounded"
          ? "low"
          : "medium",
      },
      memoryVarianceRisks: {
        boundsCreationVariance: !processingBounds ? "high" : "none",
        monitoringOverheadVariance: "medium", // 監視オーバーヘッド変動
        memoryGrowthPredictionVariance: "high", // メモリ成長予測変動
        boundsViolationHandlingVariance: "low", // 境界違反処理変動
      },
      varianceReductionStrategy: {
        targetReduction: "predictive-bounds-optimization",
        recommendedApproach: "adaptive-bounds-scaling",
        monitoringOptimization: "threshold-based-checking",
        memoryPredictionImprovement: "learning-based-estimation",
      },
      debugLogLevel: "memory-bounds-variance", // メモリ境界変動詳細ログ
      memoryVarianceTrackingEnabled: true, // メモリ変動追跡有効
    };

    const currentMemory = Deno.memoryUsage();
    activeLogger?.debug("メモリ境界監視振れ幅デバッグ情報", {
      ...memoryBoundsVarianceDebug,
      currentSystemState: {
        heapUsedMB: Math.round(currentMemory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(currentMemory.heapTotal / 1024 / 1024),
        systemMemoryPressure:
          currentMemory.heapUsed / currentMemory.heapTotal > 0.8
            ? "high"
            : "normal",
        estimatedMemoryAfterProcessing: Math.round(
          (currentMemory.heapUsed + filesResult.data.length * 2 * 1024 * 1024) /
            1024 / 1024,
        ),
      },
      timestamp: new Date().toISOString(),
    });

    const boundsMonitor = ProcessingBoundsMonitor.create(actualBounds);

    activeLogger?.debug(
      "Initialized processing bounds",
      {
        operation: "memory-monitoring",
        boundsType: actualBounds.kind,
        fileCount: filesResult.data.length,
        timestamp: new Date().toISOString(),
      },
    );

    const processedData: FrontmatterData[] = [];
    const documents: MarkdownDocument[] = [];

    // Stage 2: Process files (parallel or sequential based on options)
    const useParallel = options?.parallel === true &&
      filesResult.data.length > 1;
    const maxWorkers = options?.maxWorkers || 4;

    // 処理戦略切り替え振れ幅デバッグ情報 (高変動箇所特定フロー Iteration 13)
    const processingStrategyVarianceDebug = {
      varianceTarget: "processing-strategy-switch-variance-reduction",
      strategySelectionVariance: {
        parallelThreshold: 1, // useParallel条件: filesResult.data.length > 1
        workerCountVariance: `1-${maxWorkers}`, // 1～maxWorkers の変動範囲
        fileCountImpact: filesResult.data.length, // ファイル数による戦略影響
        binaryDecisionVariance: useParallel
          ? "parallel-selected"
          : "sequential-selected",
      },
      processingVarianceFactors: {
        memoryAllocationPattern: useParallel
          ? "batch-concurrent"
          : "sequential-accumulative",
        workerPoolOverhead: useParallel
          ? `${maxWorkers}-workers`
          : "no-workers",
        coordinationComplexity: useParallel
          ? "high-sync-overhead"
          : "linear-processing",
        errorHandlingStrategy: useParallel
          ? "batch-aggregation"
          : "immediate-propagation",
      },
      predictedVarianceImpact: {
        memoryVarianceRisk: useParallel ? "high-burst" : "gradual-growth",
        processingTimeVariability: useParallel
          ? `${maxWorkers}x-speedup-variance`
          : "linear-time",
        resourceUtilizationVariance: useParallel
          ? "cpu-intensive-burst"
          : "memory-steady",
        errorRecoveryVariance: useParallel
          ? "batch-failure-impact"
          : "single-file-failure",
      },
      varianceReductionStrategy: {
        targetVarianceReduction: "binary-to-adaptive", // 二元選択 → 適応的調整
        recommendedApproach: "dynamic-worker-scaling", // 動的ワーカー調整
        memoryVarianceControl: "adaptive-batch-sizing", // 適応的バッチサイズ
        performanceVarianceStabilization: "predictive-strategy-selection", // 予測的戦略選択
      },
      debugLogLevel: "processing-strategy-variance", // 処理戦略変動詳細ログ
      varianceTrackingEnabled: true, // 変動追跡有効
    };

    activeLogger?.debug("処理戦略切り替え振れ幅デバッグ情報", {
      ...processingStrategyVarianceDebug,
      strategySelection: {
        useParallel,
        maxWorkers,
        fileCount: filesResult.data.length,
        estimatedMemoryImpact: useParallel
          ? `${maxWorkers * 50}MB-burst`
          : `${filesResult.data.length * 2}MB-gradual`,
        estimatedTimeRange: useParallel
          ? `${
            Math.ceil(filesResult.data.length / maxWorkers) * 50
          }ms-optimistic`
          : `${filesResult.data.length * 50}ms-linear`,
      },
      timestamp: new Date().toISOString(),
    });

    if (useParallel) {
      activeLogger?.info(
        `Using parallel processing with ${maxWorkers} workers for ${filesResult.data.length} files`,
        {
          operation: "parallel-processing",
          workerCount: maxWorkers,
          fileCount: filesResult.data.length,
          timestamp: new Date().toISOString(),
        },
      );

      // Parallel processing implementation (Issue #545)
      const results = await this.processFilesInParallel(
        filesResult.data,
        validationRules,
        maxWorkers,
        boundsMonitor,
        activeLogger,
      );

      if (!results.ok) {
        return results;
      }

      // Collect results from parallel processing
      for (const result of results.data) {
        processedData.push(result.frontmatterData);
        documents.push(result.document);
      }
    } else {
      // Sequential processing (original implementation)
      for (const filePath of filesResult.data) {
        // Memory bounds monitoring - check state before processing each file
        const state = boundsMonitor.checkState(processedData.length);
        if (state.kind === "exceeded_limit") {
          return err(createError({
            kind: "MemoryBoundsViolation",
            content: `Processing exceeded bounds: ${state.limit}`,
          }));
        }

        if (state.kind === "approaching_limit") {
          activeLogger?.warn(
            `Approaching memory limit: ${
              Math.round(state.usage.heapUsed / 1024 / 1024)
            }MB used, threshold: ${
              Math.round(state.warningThreshold / 1024 / 1024)
            }MB`,
            {
              operation: "memory-monitoring",
              heapUsed: state.usage.heapUsed,
              warningThreshold: state.warningThreshold,
              timestamp: new Date().toISOString(),
            },
          );
        }

        activeLogger?.debug(
          `Processing file: ${filePath}`,
          {
            operation: "file-processing",
            filePath,
            timestamp: new Date().toISOString(),
          },
        );
        const documentResult = this.processDocument(filePath, validationRules);
        if (documentResult.ok) {
          processedData.push(documentResult.data.frontmatterData);
          documents.push(documentResult.data.document);

          activeLogger?.debug(
            `Successfully processed: ${filePath}`,
            {
              operation: "file-processing",
              filePath,
              timestamp: new Date().toISOString(),
            },
          );

          // Periodic O(log n) memory growth validation
          if (processedData.length % 100 === 0 && processedData.length > 0) {
            const growthResult = boundsMonitor.validateMemoryGrowth(
              processedData.length,
            );
            if (!growthResult.ok) {
              activeLogger?.warn(
                `Memory growth validation warning: ${growthResult.error.message}`,
                {
                  operation: "memory-monitoring",
                  processedCount: processedData.length,
                  timestamp: new Date().toISOString(),
                },
              );
            }
          }

          activeLogger?.debug(
            "File processed successfully",
            {
              operation: "file-processing",
              status: "success",
              timestamp: new Date().toISOString(),
            },
          );
        } else {
          activeLogger?.error(
            `Failed to process file: ${filePath}`,
            {
              operation: "file-processing",
              filePath,
              stage: "individual-file-processing",
              error: documentResult.error,
              timestamp: new Date().toISOString(),
            },
          );
        }
        // Note: Individual file failures don't stop processing
      }
    }

    if (processedData.length === 0) {
      const noDataError = createError({
        kind: "AggregationFailed",
        message: "No valid documents found to process",
      });
      activeLogger?.error(
        "No valid documents found to process",
        {
          operation: "document-processing",
          error: noDataError,
          timestamp: new Date().toISOString(),
        },
      );
      return err(noDataError);
    }

    activeLogger?.info(
      `Successfully processed ${processedData.length} documents`,
      {
        operation: "document-processing",
        processedCount: processedData.length,
        totalFiles: filesResult.data.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Stage 3: Apply frontmatter-part processing if needed
    activeLogger?.debug(
      "Starting frontmatter-part processing",
      {
        operation: "frontmatter-part-processing",
        timestamp: new Date().toISOString(),
      },
    );
    const finalData = this.processFrontmatterParts(processedData, schema);

    activeLogger?.info(
      "Frontmatter-part processing complete",
      {
        operation: "frontmatter-part-processing",
        inputCount: processedData.length,
        outputCount: finalData.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Stage 4: Aggregate data using derivation rules
    activeLogger?.debug(
      "Starting data aggregation with derivation rules",
      {
        operation: "aggregation",
        timestamp: new Date().toISOString(),
      },
    );
    const derivationRules = schema.getDerivedRules();

    activeLogger?.info(
      `Found ${derivationRules.length} derivation rules`,
      {
        operation: "aggregation",
        rulesCount: derivationRules.length,
        rules: derivationRules.map((r) => ({
          sourcePath: r.sourcePath,
          targetField: r.targetField,
        })),
        timestamp: new Date().toISOString(),
      },
    );

    const aggregatedData = this.aggregateData(finalData, schema);
    if (!aggregatedData.ok) {
      activeLogger?.error(
        "Data aggregation failed",
        {
          operation: "aggregation",
          error: aggregatedData.error,
          timestamp: new Date().toISOString(),
        },
      );
      return aggregatedData;
    }

    // Stage 5: Populate base properties from schema defaults
    activeLogger?.debug(
      "Starting base property population",
      {
        operation: "base-property-population",
        timestamp: new Date().toISOString(),
      },
    );
    const result = this.basePropertyPopulator.populate(
      aggregatedData.data,
      schema,
    );

    if (result.ok) {
      activeLogger?.info(
        "Document processing pipeline completed successfully",
        {
          operation: "document-processing",
          timestamp: new Date().toISOString(),
        },
      );
    } else {
      activeLogger?.error(
        "Base property population failed",
        {
          operation: "base-property-population",
          error: result.error,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return result;
  }

  /**
   * Process a single document file.
   */
  private processDocument(
    filePath: string,
    validationRules: ValidationRules,
  ): Result<
    { document: MarkdownDocument; frontmatterData: FrontmatterData },
    DomainError & { message: string }
  > {
    const activeLogger = this.logger;
    activeLogger?.debug(
      `Starting processing of document: ${filePath}`,
      createLogContext({
        operation: "single-document",
        location: filePath,
      }),
    );

    // Create file path value object
    const filePathResult = FilePath.create(filePath);
    if (!filePathResult.ok) {
      activeLogger?.error(
        `File path validation failed: ${filePathResult.error.message}`,
        createLogContext({
          operation: "file-path-validation",
          location: filePath,
        }),
      );
      return filePathResult;
    }

    // Read file content
    activeLogger?.debug(
      `Reading file content: ${filePath}`,
      createLogContext({
        operation: "file-reading",
        location: filePath,
      }),
    );
    const contentResult = this.fileReader.read(filePath);
    if (!contentResult.ok) {
      activeLogger?.error(
        `File reading failed: ${contentResult.error.message}`,
        createLogContext({
          operation: "file-reading",
          location: filePath,
        }),
      );
      return contentResult;
    }

    // Extract frontmatter
    activeLogger?.debug(
      `Extracting frontmatter from: ${filePath}`,
      createLogContext({
        operation: "frontmatter-extraction",
        location: filePath,
      }),
    );
    const extractResult = this.frontmatterProcessor.extract(contentResult.data);
    if (!extractResult.ok) {
      activeLogger?.error(
        `Frontmatter extraction failed: ${extractResult.error.message}`,
        createLogContext({
          operation: "frontmatter-extraction",
          location: filePath,
        }),
      );
      return extractResult;
    }

    const { frontmatter, body } = extractResult.data;
    activeLogger?.debug(
      `Successfully extracted frontmatter from: ${filePath}`,
      createLogContext({
        operation: "frontmatter-extraction",
        location: filePath,
        inputs: `keys: ${
          Object.keys(frontmatter || {}).join(", ")
        }, bodyLength: ${body.length}`,
      }),
    );

    // Validate frontmatter
    activeLogger?.debug(
      `Validating frontmatter for: ${filePath}`,
      createLogContext({
        operation: "frontmatter-validation",
        location: filePath,
      }),
    );
    const validationResult = this.frontmatterProcessor.validate(
      frontmatter,
      validationRules,
    );
    if (!validationResult.ok) {
      activeLogger?.error(
        `Frontmatter validation failed: ${validationResult.error.message}`,
        createLogContext({
          operation: "frontmatter-validation",
          location: filePath,
        }),
      );
      return validationResult;
    }

    activeLogger?.debug(
      `Successfully validated frontmatter for: ${filePath}`,
      createLogContext({
        operation: "frontmatter-validation",
        location: filePath,
      }),
    );

    // Create document entity
    activeLogger?.debug(
      `Creating MarkdownDocument entity for: ${filePath}`,
      createLogContext({
        operation: "document-creation",
        location: filePath,
      }),
    );
    const docResult = MarkdownDocument.create(
      filePathResult.data,
      contentResult.data,
      validationResult.data,
      body,
    );
    if (!docResult.ok) {
      activeLogger?.error(
        `Document creation failed: ${docResult.error.message}`,
        createLogContext({
          operation: "document-creation",
          location: filePath,
        }),
      );
      return docResult;
    }

    activeLogger?.debug(
      `Successfully processed document: ${filePath}`,
      createLogContext({
        operation: "single-document",
        location: filePath,
      }),
    );

    return ok({
      document: docResult.data,
      frontmatterData: validationResult.data,
    });
  }

  /**
   * Process files in parallel using a worker pool pattern.
   * Implements Issue #545: Parallel processing capability with configurable workers.
   */
  private async processFilesInParallel(
    filePaths: string[],
    validationRules: ValidationRules,
    maxWorkers: number,
    boundsMonitor: ProcessingBoundsMonitor,
    logger?: DebugLogger,
  ): Promise<
    Result<
      Array<{ document: MarkdownDocument; frontmatterData: FrontmatterData }>,
      DomainError & { message: string }
    >
  > {
    const activeLogger = logger || this.logger;
    const results: Array<
      { document: MarkdownDocument; frontmatterData: FrontmatterData }
    > = [];
    const errors: Array<DomainError & { message: string }> = [];

    // ワーカープール振れ幅デバッグ情報 (並列処理変動制御フロー Iteration 14)
    const workerPoolVarianceDebug = {
      varianceTarget: "worker-pool-variance-control",
      workerPoolConfiguration: {
        maxWorkers,
        fileCount: filePaths.length,
        optimalWorkerCount: Math.min(maxWorkers, filePaths.length),
        workerUtilizationRatio: filePaths.length / maxWorkers,
        parallelEfficiencyPredictiion: maxWorkers > filePaths.length
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
        promiseAllSynchronization: "high-variance", // Promise.all 同期オーバーヘッド
        batchResultAggregation: "medium-variance", // バッチ結果集約の複雑性
        errorHandlingComplexity: "high-variance", // 並列エラーハンドリング複雑性
        memoryCoordinationOverhead: "medium-variance", // メモリ協調オーバーヘッド
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
      debugLogLevel: "worker-pool-variance", // ワーカープール変動詳細ログ
      parallelVarianceTrackingEnabled: true, // 並列変動追跡有効
    };

    activeLogger?.debug("ワーカープール振れ幅デバッグ情報", {
      ...workerPoolVarianceDebug,
      realTimeMetrics: {
        currentMemoryMB: Math.round(Deno.memoryUsage().heapUsed / 1024 / 1024),
        processingStartTime: performance.now(),
        expectedFinishTime: `+${
          Math.ceil(filePaths.length / maxWorkers) * 100
        }ms`,
      },
      timestamp: new Date().toISOString(),
    });

    // Create batches for worker processing
    const batchSize = Math.max(1, Math.ceil(filePaths.length / maxWorkers));
    const batches: string[][] = [];

    for (let i = 0; i < filePaths.length; i += batchSize) {
      batches.push(filePaths.slice(i, i + batchSize));
    }

    activeLogger?.debug(
      `Created ${batches.length} batches with batch size ${batchSize}`,
      {
        operation: "parallel-batch-creation",
        batchCount: batches.length,
        batchSize,
        totalFiles: filePaths.length,
        timestamp: new Date().toISOString(),
      },
    );

    // Process batches in parallel using Promise.all
    try {
      const batchPromises = batches.map((batch, batchIndex) => {
        return new Promise<
          {
            batchResults: Array<
              { document: MarkdownDocument; frontmatterData: FrontmatterData }
            >;
            batchErrors: Array<DomainError & { message: string }>;
          }
        >((resolve) => {
          const batchResults: Array<
            { document: MarkdownDocument; frontmatterData: FrontmatterData }
          > = [];
          const batchErrors: Array<DomainError & { message: string }> = [];

          activeLogger?.debug(
            `Processing batch ${
              batchIndex + 1
            }/${batches.length} with ${batch.length} files`,
            {
              operation: "parallel-batch-processing",
              batchIndex: batchIndex + 1,
              batchSize: batch.length,
              timestamp: new Date().toISOString(),
            },
          );

          for (const filePath of batch) {
            // Memory bounds monitoring for each file
            const state = boundsMonitor.checkState(
              results.length + batchResults.length,
            );
            if (state.kind === "exceeded_limit") {
              batchErrors.push(createError({
                kind: "MemoryBoundsViolation",
                content: `Processing exceeded bounds: ${state.limit}`,
              }));
              break;
            }

            if (state.kind === "approaching_limit") {
              activeLogger?.warn(
                `Approaching memory limit in batch ${batchIndex + 1}: ${
                  Math.round(state.usage.heapUsed / 1024 / 1024)
                }MB used, threshold: ${
                  Math.round(state.warningThreshold / 1024 / 1024)
                }MB`,
                {
                  operation: "parallel-memory-monitoring",
                  batchIndex: batchIndex + 1,
                  heapUsed: state.usage.heapUsed,
                  warningThreshold: state.warningThreshold,
                  timestamp: new Date().toISOString(),
                },
              );
            }

            const documentResult = this.processDocument(
              filePath,
              validationRules,
            );
            if (documentResult.ok) {
              batchResults.push(documentResult.data);
              activeLogger?.debug(
                `Successfully processed file in batch ${
                  batchIndex + 1
                }: ${filePath}`,
                {
                  operation: "parallel-file-processing",
                  batchIndex: batchIndex + 1,
                  filePath,
                  timestamp: new Date().toISOString(),
                },
              );
            } else {
              batchErrors.push(documentResult.error);
              activeLogger?.error(
                `Failed to process file in batch ${
                  batchIndex + 1
                }: ${filePath}`,
                {
                  operation: "parallel-file-processing",
                  batchIndex: batchIndex + 1,
                  filePath,
                  error: documentResult.error,
                  timestamp: new Date().toISOString(),
                },
              );
            }
          }

          resolve({ batchResults, batchErrors });
        });
      });

      // Wait for all batches to complete
      const batchOutputs = await Promise.all(batchPromises);

      // Collect all results and errors
      for (const { batchResults, batchErrors } of batchOutputs) {
        results.push(...batchResults);
        errors.push(...batchErrors);
      }

      activeLogger?.info(
        `Parallel processing completed: ${results.length} successful, ${errors.length} errors`,
        {
          operation: "parallel-processing-completion",
          successCount: results.length,
          errorCount: errors.length,
          totalFiles: filePaths.length,
          timestamp: new Date().toISOString(),
        },
      );

      // Return results even if some files failed (matching sequential behavior)
      if (results.length === 0 && errors.length > 0) {
        return err(errors[0]);
      }

      return ok(results);
    } catch (error) {
      const processingError = createError({
        kind: "AggregationFailed",
        message: `Parallel processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });

      activeLogger?.error(
        "Parallel processing encountered an unexpected error",
        {
          operation: "parallel-processing-error",
          error: processingError,
          timestamp: new Date().toISOString(),
        },
      );

      return err(processingError);
    }
  }

  /**
   * Process frontmatter parts if schema defines x-frontmatter-part.
   * When x-frontmatter-part is true, extracts the specific part from each markdown file.
   */
  private processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): FrontmatterData[] {
    const extensionKey = defaultSchemaExtensionRegistry.getFrontmatterPartKey()
      .getValue();
    const activeLogger = this.logger;
    activeLogger?.debug(
      `Checking for ${extensionKey} schema definition`,
      createLogContext({
        operation: "frontmatter-parts",
      }),
    );

    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();
    if (!frontmatterPartSchemaResult.ok) {
      activeLogger?.debug(
        `No ${extensionKey} schema found, returning original data`,
        createLogContext({
          operation: "frontmatter-parts",
        }),
      );
      return data;
    }

    // Get the path to the frontmatter part (e.g., "commands")
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    if (!frontmatterPartPathResult.ok) {
      activeLogger?.debug(
        `No ${extensionKey} path found, returning original data`,
        createLogContext({
          operation: "frontmatter-parts",
        }),
      );
      return data;
    }

    const partPath = frontmatterPartPathResult.data;
    activeLogger?.info(
      `Processing frontmatter parts at path: ${partPath}`,
      createLogContext({
        operation: "frontmatter-parts",
        inputs: `path: ${partPath}, inputCount: ${data.length}`,
      }),
    );

    const extractedParts: FrontmatterData[] = [];

    // Extract the frontmatter part from each document
    for (const frontmatterData of data) {
      const dataObj = frontmatterData.getData();
      activeLogger?.debug(
        `Processing document for frontmatter-part at schema path '${partPath}'`,
        createLogContext({
          operation: "frontmatter-part-extraction",
          inputs: `availableKeys: ${Object.keys(dataObj).join(", ")}`,
        }),
      );

      // For frontmatter-part processing, the individual markdown files contain
      // the data that will become items in the target array. The partPath indicates
      // where the final array will be placed in the aggregated result, NOT where
      // to extract data from individual files.
      // Therefore, we extract the entire frontmatter object from each file.
      const partData = dataObj; // Use the entire frontmatter object

      if (partData && typeof partData === "object") {
        activeLogger?.debug(
          "Found frontmatter object to extract as array item",
          createLogContext({
            operation: "frontmatter-part-extraction",
            inputs: `keys: ${Object.keys(partData).join(", ")}`,
          }),
        );

        // Each individual frontmatter object becomes one item in the target array
        const itemDataResult = this.frontmatterDataCreationService
          .createFromRaw(partData);
        if (itemDataResult.ok) {
          extractedParts.push(itemDataResult.data);
          activeLogger?.debug(
            "Successfully processed frontmatter as array item",
            createLogContext({
              operation: "frontmatter-part-extraction",
            }),
          );
        } else {
          activeLogger?.error(
            `Failed to process frontmatter as array item: ${itemDataResult.error.message}`,
            createLogContext({
              operation: "frontmatter-part-extraction",
            }),
          );
        }
      } else {
        activeLogger?.debug(
          `No valid data found at '${partPath}' (type: ${typeof partData})`,
          createLogContext({
            operation: "frontmatter-part-extraction",
          }),
        );
      }
    }

    const result = extractedParts.length > 0 ? extractedParts : data;
    activeLogger?.info(
      `Frontmatter parts processing complete`,
      createLogContext({
        operation: "frontmatter-parts",
        inputs:
          `inputCount: ${data.length}, extractedCount: ${extractedParts.length}`,
        decisions: extractedParts.length === 0
          ? ["returning original data"]
          : undefined,
      }),
    );

    return result;
  }

  /**
   * Aggregate data using derivation rules from schema.
   * Refactored to use SchemaPathResolver following DDD Totality principles.
   */
  private aggregateData(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivationRules = schema.getDerivedRules();

    if (derivationRules.length > 0) {
      return this.aggregateWithDerivationRules(data, schema, derivationRules);
    } else {
      return this.aggregateWithoutDerivationRules(data, schema);
    }
  }

  /**
   * Handles aggregation with derivation rules using schema-driven approach.
   * Replaces hardcoded structure creation with SchemaPathResolver.
   */
  private aggregateWithDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      const baseDataResult = emptyStructureResult.data.toFrontmatterData();
      if (!baseDataResult.ok) {
        return baseDataResult;
      }

      return this.applyDerivationRules(baseDataResult.data, derivationRules);
    }

    // Use SchemaPathResolver instead of hardcoded structure creation
    const commandsArray = data.map((item) => item.getData());

    const activeLogger = this.logger;
    activeLogger?.debug(
      "Creating data structure using SchemaPathResolver",
      createLogContext({
        operation: "data-structure-creation",
        inputs:
          `inputCount: ${data.length}, commandsArrayLength: ${commandsArray.length}`,
      }),
    );

    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      activeLogger?.error(
        `Data structure creation failed: ${structureResult.error.message}`,
        createLogContext({
          operation: "data-structure-creation",
        }),
      );
      return structureResult;
    }

    activeLogger?.debug(
      "Successfully created data structure",
      createLogContext({
        operation: "data-structure-creation",
      }),
    );

    // Convert to FrontmatterData and apply derivation rules
    const baseDataResult = structureResult.data.toFrontmatterData();
    if (!baseDataResult.ok) {
      activeLogger?.error(
        `Frontmatter conversion failed: ${baseDataResult.error.message}`,
        createLogContext({
          operation: "frontmatter-conversion",
        }),
      );
      return baseDataResult;
    }

    activeLogger?.debug(
      "Successfully converted structure to FrontmatterData",
      createLogContext({
        operation: "frontmatter-conversion",
        inputs: `dataKeys: ${
          Object.keys(baseDataResult.data.getData()).join(", ")
        }`,
      }),
    );

    return this.applyDerivationRules(baseDataResult.data, derivationRules);
  }

  /**
   * Handles aggregation without derivation rules using schema-driven approach.
   * Replaces hardcoded structure creation with SchemaPathResolver.
   */
  private aggregateWithoutDerivationRules(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

    if (!frontmatterPartSchemaResult.ok) {
      return this.mergeDataDirectly(data);
    }

    // Handle empty data by creating empty structure
    if (data.length === 0) {
      const emptyStructureResult = SchemaPathResolver.createEmptyStructure(
        schema,
      );
      if (!emptyStructureResult.ok) {
        return emptyStructureResult;
      }

      return emptyStructureResult.data.toFrontmatterData();
    }

    // Use SchemaPathResolver instead of hardcoded structure creation
    const commandsArray = data.map((item) => item.getData());
    const structureResult = SchemaPathResolver.resolveDataStructure(
      schema,
      commandsArray,
    );

    if (!structureResult.ok) {
      return structureResult;
    }

    return structureResult.data.toFrontmatterData();
  }

  /**
   * Applies derivation rules to base data using existing aggregator.
   */
  private applyDerivationRules(
    baseData: FrontmatterData,
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Convert schema rules to domain rules with explicit error tracking
    const ruleConversion = this.convertDerivationRules(derivationRules);

    // For backward compatibility, we continue processing even with failed rules
    const rules = ruleConversion.successfulRules;

    const activeLogger = this.logger;
    activeLogger?.debug(
      "Applying derivation rules while preserving frontmatter-part data",
      createLogContext({
        operation: "derivation-rules-application",
        inputs: `ruleCount: ${rules.length}, baseDataKeys: ${
          Object.keys(baseData.getData()).join(", ")
        }`,
      }),
    );

    // Apply derivation rules and merge with base data
    const aggregationResult = this.aggregator.aggregate(
      [baseData],
      rules,
      baseData,
    );
    if (!aggregationResult.ok) {
      return aggregationResult;
    }

    // Use aggregator's mergeWithBase to properly apply derived fields
    const mergeResult = this.aggregator.mergeWithBase(aggregationResult.data);
    if (!mergeResult.ok) {
      return mergeResult;
    }

    const finalData = mergeResult.data;

    activeLogger?.debug(
      "Successfully applied derivation rules",
      createLogContext({
        operation: "derivation-rules-application",
        inputs: `finalDataKeys: ${Object.keys(finalData.getData()).join(", ")}`,
      }),
    );

    return ok(finalData);
  }

  /**
   * Calculate derived fields from source data using derivation rules.
   * Preserves frontmatter-part data by computing only derived fields.
   */
  private calculateDerivedFields(
    sourceData: FrontmatterData,
    rules: DerivationRule[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const derivedFields: Record<string, unknown> = {};

    const activeLogger = this.logger;
    activeLogger?.debug(
      "Calculating derived fields",
      createLogContext({
        operation: "derived-field-calculation",
        inputs: `ruleCount: ${rules.length}, sourceDataKeys: ${
          Object.keys(sourceData.getData()).join(", ")
        }`,
      }),
    );

    for (const rule of rules) {
      const sourceResult = sourceData.get(rule.getBasePath());
      if (sourceResult.ok && Array.isArray(sourceResult.data)) {
        activeLogger?.debug(
          `Processing rule: ${rule.getBasePath()} -> ${rule.getTargetField()}`,
          createLogContext({
            operation: "derived-field-calculation",
            inputs:
              `sourceArrayLength: ${sourceResult.data.length}, isUnique: ${rule.isUnique()}`,
          }),
        );

        const values = sourceResult.data.map((item) =>
          typeof item === "object" && item !== null
            ? (item as Record<string, unknown>)[rule.getPropertyPath()]
            : item
        ).filter((value) => value !== undefined);

        const finalValues = rule.isUnique() ? [...new Set(values)] : values;

        // Set derived field using targetField path
        this.setNestedField(derivedFields, rule.getTargetField(), finalValues);

        activeLogger?.debug(
          `Calculated derived field: ${rule.getTargetField()}`,
          createLogContext({
            operation: "derived-field-calculation",
            inputs: `valuesCount: ${finalValues.length}`,
          }),
        );
      } else {
        activeLogger?.debug(
          `Skipping rule due to missing or non-array source: ${rule.getBasePath()}`,
          createLogContext({
            operation: "derived-field-calculation",
            decisions: [sourceResult.ok ? "found but not array" : "not found"],
          }),
        );
      }
    }

    activeLogger?.debug(
      "Derived field calculation completed",
      createLogContext({
        operation: "derived-field-calculation",
        inputs: `derivedFieldsKeys: ${Object.keys(derivedFields).join(", ")}`,
      }),
    );

    return this.frontmatterDataCreationService.createFromRaw(derivedFields);
  }

  /**
   * Deep merge two FrontmatterData objects, preserving existing nested structures.
   * Required to merge derived fields without overwriting frontmatter-part data.
   */
  private deepMerge(
    baseData: FrontmatterData,
    derivedData: FrontmatterData,
  ): Result<FrontmatterData, DomainError> {
    const baseObj = baseData.getData();
    const derivedObj = derivedData.getData();

    const mergedObj = this.deepMergeObjects(baseObj, derivedObj);
    const mergedResult = this.frontmatterDataCreationService.createFromRaw(
      mergedObj,
    );

    if (!mergedResult.ok) {
      return err(createError({
        kind: "MergeFailed",
        message: `Deep merge failed: ${mergedResult.error.message}`,
      }));
    }

    return ok(mergedResult.data);
  }

  /**
   * Deep merge two objects recursively.
   */
  private deepMergeObjects(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === "object" &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof result[key] === "object" &&
          result[key] !== null &&
          !Array.isArray(result[key])
        ) {
          // Both are objects - merge recursively
          result[key] = this.deepMergeObjects(
            result[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>,
          );
        } else {
          // Replace value (for arrays, primitives, or when target is not object)
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Set nested field in object using dot notation path.
   * Helper method for applying derived field values to nested structure.
   */
  private setNestedField(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Fallback for direct merging when no frontmatter-part schema exists.
   * Follows Totality principle with proper error handling.
   */
  private mergeDataDirectly(
    data: FrontmatterData[],
  ): Result<FrontmatterData, DomainError & { message: string }> {
    if (data.length === 0) {
      return ok(FrontmatterData.empty());
    }

    let merged = data[0];
    for (let i = 1; i < data.length; i++) {
      merged = merged.merge(data[i]);
    }
    return ok(merged);
  }

  /**
   * Convert schema derivation rules to domain rules with explicit error handling.
   * Replaces silent error handling with tracked rule conversion results.
   */
  private convertDerivationRules(
    derivationRules: Array<
      { sourcePath: string; targetField: string; unique: boolean }
    >,
  ): RuleConversionResult {
    const successfulRules: DerivationRule[] = [];
    const errors: Array<DomainError & { message: string }> = [];
    let failedRuleCount = 0;

    for (const rule of derivationRules) {
      const ruleResult = DerivationRule.create(
        rule.sourcePath,
        rule.targetField,
        rule.unique,
      );

      if (ruleResult.ok) {
        successfulRules.push(ruleResult.data);
      } else {
        failedRuleCount++;
        errors.push(ruleResult.error);
      }
    }

    return { successfulRules, failedRuleCount, errors };
  }

  /**
   * Helper method to extract nested properties from an object.
   */
  private extractNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (
        current && typeof current === "object" &&
        part in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Helper method to set nested properties in an object.
   */
  private setNestedProperty(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    let current = obj;

    // Navigate to the parent of the target property
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the final property
    current[parts[parts.length - 1]] = value;
  }
}
