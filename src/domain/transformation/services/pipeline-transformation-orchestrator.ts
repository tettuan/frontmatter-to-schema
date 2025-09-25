import { err, ok, Result } from "../../shared/types/result.ts";
import type { DocumentProcessor } from "../../document/interfaces/document-processor.ts";
import type { SchemaProcessor } from "../../schema-processing/interfaces/schema-processor.ts";
import type { DataAggregator } from "../../data-aggregation/interfaces/data-aggregator.ts";
import type { FileDiscoveryService } from "../../frontmatter/services/file-discovery-service.ts";
import {
  TransformationConfig,
  TransformationError,
  TransformationMetadata,
  TransformationOrchestrator,
  TransformationOutput,
} from "../interfaces/transformation-orchestrator.ts";
import type { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { ProcessingBoundsFactory } from "../../shared/types/processing-bounds.ts";

/**
 * Implementation of TransformationOrchestrator that coordinates domain services.
 * Extracts orchestration logic from monolithic FrontmatterTransformationService.
 *
 * Following DDD principles:
 * - Single Responsibility: Pipeline coordination only
 * - Domain boundaries: Clear service boundaries and error propagation
 * - Dependency Inversion: Uses injected domain services through interfaces
 *
 * Following Totality principles:
 * - All methods return Result<T,E> types
 * - No partial functions or exceptions
 * - Comprehensive error handling through discriminated unions
 */
export class PipelineTransformationOrchestrator
  implements TransformationOrchestrator {
  private constructor(
    private readonly documentProcessor: DocumentProcessor,
    private readonly schemaProcessor: SchemaProcessor,
    private readonly dataAggregator: DataAggregator,
    private readonly fileDiscovery: FileDiscoveryService,
  ) {}

  /**
   * Smart Constructor following Totality principles
   * Creates an orchestrator with validated dependencies
   */
  static create(
    documentProcessor: DocumentProcessor,
    schemaProcessor: SchemaProcessor,
    dataAggregator: DataAggregator,
    fileDiscovery: FileDiscoveryService,
  ): Result<
    PipelineTransformationOrchestrator,
    TransformationError & { message: string }
  > {
    if (!documentProcessor) {
      return err({
        kind: "ProcessingConfigurationFailure",
        cause: "DocumentProcessor is required",
        message:
          "DocumentProcessor dependency is required for transformation orchestration",
      });
    }

    if (!schemaProcessor) {
      return err({
        kind: "ProcessingConfigurationFailure",
        cause: "SchemaProcessor is required",
        message:
          "SchemaProcessor dependency is required for transformation orchestration",
      });
    }

    if (!dataAggregator) {
      return err({
        kind: "ProcessingConfigurationFailure",
        cause: "DataAggregator is required",
        message:
          "DataAggregator dependency is required for transformation orchestration",
      });
    }

    if (!fileDiscovery) {
      return err({
        kind: "ProcessingConfigurationFailure",
        cause: "FileDiscoveryService is required",
        message:
          "FileDiscoveryService dependency is required for transformation orchestration",
      });
    }

    return ok(
      new PipelineTransformationOrchestrator(
        documentProcessor,
        schemaProcessor,
        dataAggregator,
        fileDiscovery,
      ),
    );
  }

  /**
   * Main orchestration method that coordinates the transformation pipeline
   * Extracted from original FrontmatterTransformationService.transformDocumentsInternal()
   */
  async orchestrateTransformation(
    config: TransformationConfig,
  ): Promise<
    Result<TransformationOutput, TransformationError & { message: string }>
  > {
    const startTime = Date.now();

    try {
      // Stage 1: Schema processing and validation rule adjustment
      const validationRulesResult = await this.prepareValidationRules(config);
      if (!validationRulesResult.ok) {
        return validationRulesResult;
      }
      const { effectiveValidationRules, usingResolvedSchema } =
        validationRulesResult.data;

      // Stage 2: File discovery
      const filesResult = await this.fileDiscovery.discoverFiles({
        pattern: config.inputPattern,
        processingBounds: config.processingBounds,
      });
      if (!filesResult.ok) {
        return err({
          kind: "OrchestrationFailure",
          stage: "file-discovery",
          cause: filesResult.error.message,
          message: `File discovery failed: ${filesResult.error.message}`,
        });
      }

      // Stage 3: Processing bounds setup
      const processingBoundsResult = this.setupProcessingBounds(
        config.processingBounds,
        filesResult.data.fileCount,
      );
      if (!processingBoundsResult.ok) {
        return processingBoundsResult;
      }

      // Stage 4: Document processing strategy
      const processingStrategy = this.determineProcessingStrategy(
        config.processingOptions,
        filesResult.data.fileCount,
      );

      // Stage 5: Document processing
      const documentResults = await this.processDocuments(
        filesResult.data.files,
        effectiveValidationRules,
        processingStrategy,
      );
      if (!documentResults.ok) {
        return documentResults;
      }

      // Stage 6: Data aggregation
      const aggregationResult = this.dataAggregator.aggregateData(
        documentResults.data,
        config.schema,
      );
      if (!aggregationResult.ok) {
        return err({
          kind: "DataAggregationFailure",
          cause: aggregationResult.error.message,
          message:
            `Data aggregation failed: ${aggregationResult.error.message}`,
        });
      }

      // Stage 7: Prepare final output
      const processingTime = Date.now() - startTime;
      const metadata: TransformationMetadata = {
        fileCount: filesResult.data.fileCount,
        processingStrategy: processingStrategy.parallel
          ? "parallel"
          : "sequential",
        processingTime,
        usingResolvedSchema,
        hasValidationRuleAdjustment: usingResolvedSchema,
      };

      return ok({
        transformedData: aggregationResult.data.aggregatedFrontmatter,
        metadata,
      });
    } catch (error) {
      return err({
        kind: "OrchestrationFailure",
        stage: "unknown",
        cause: error instanceof Error ? error.message : "Unknown error",
        message: `Transformation orchestration failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  /**
   * Prepare validation rules using schema processing domain service
   * For now, this is simplified to just return the original validation rules
   * Future enhancement: Use schema processor to adjust validation rules based on schema
   */
  private prepareValidationRules(
    config: TransformationConfig,
  ): Promise<
    Result<
      { effectiveValidationRules: any; usingResolvedSchema: boolean },
      TransformationError & { message: string }
    >
  > {
    // For now, use the original validation rules
    // In the future, this can be enhanced to process the schema and adjust validation rules
    return Promise.resolve(ok({
      effectiveValidationRules: config.validationRules,
      usingResolvedSchema: false,
    }));
  }

  /**
   * Setup processing bounds with defaults if needed
   */
  private setupProcessingBounds(
    providedBounds: any,
    fileCount: number,
  ): Result<any, TransformationError & { message: string }> {
    if (providedBounds) {
      return ok(providedBounds);
    }

    const defaultBoundsResult = ProcessingBoundsFactory.createDefault(
      fileCount,
    );
    if (!defaultBoundsResult.ok) {
      return err({
        kind: "ProcessingConfigurationFailure",
        cause: defaultBoundsResult.error.message,
        message:
          `Failed to create processing bounds: ${defaultBoundsResult.error.message}`,
      });
    }

    return ok(defaultBoundsResult.data);
  }

  /**
   * Determine processing strategy based on file count and options
   */
  private determineProcessingStrategy(
    options: TransformationConfig["processingOptions"],
    fileCount: number,
  ): { parallel: boolean; maxWorkers: number } {
    const minFilesForParallel = 1; // From performance settings
    const defaultMaxWorkers = 4; // From performance settings

    const parallel = options?.parallel === true &&
      fileCount >= minFilesForParallel;
    const maxWorkers = options?.maxWorkers || defaultMaxWorkers;

    return { parallel, maxWorkers };
  }

  /**
   * Process documents using the document processing domain service
   */
  private async processDocuments(
    filePaths: string[],
    validationRules: any,
    strategy: { parallel: boolean; maxWorkers: number },
  ): Promise<
    Result<FrontmatterData[], TransformationError & { message: string }>
  > {
    const processedDocuments: FrontmatterData[] = [];

    if (strategy.parallel) {
      // Parallel processing implementation
      const processingPromises = filePaths.map((filePath) => {
        return this.documentProcessor.processDocument(
          filePath,
          validationRules,
        );
      });

      const results = await Promise.all(processingPromises);

      // Check for any failures
      for (const result of results) {
        if (!result.ok) {
          return err({
            kind: "DocumentProcessingFailure",
            cause: result.error.message,
            message: `Document processing failed: ${result.error.message}`,
          });
        }
        processedDocuments.push(result.data.frontmatterData);
      }
    } else {
      // Sequential processing implementation
      for (const filePath of filePaths) {
        const result = await this.documentProcessor.processDocument(
          filePath,
          validationRules,
        );
        if (!result.ok) {
          return err({
            kind: "DocumentProcessingFailure",
            cause: result.error.message,
            message: `Document processing failed: ${result.error.message}`,
          });
        }
        processedDocuments.push(result.data.frontmatterData);
      }
    }

    return ok(processedDocuments);
  }
}
