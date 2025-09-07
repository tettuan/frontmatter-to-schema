/**
 * Process Documents Use Case - Refactored for Single Responsibility Principle
 *
 * Following AI Complexity Control Framework and DDD principles.
 * Orchestrates document processing without implementation details.
 * Uses extracted domain services for each responsibility.
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError, isError } from "../../domain/core/result.ts";
import { ProcessingOptions } from "../../domain/models/value-objects.ts";
import { AnalysisResult } from "../../domain/models/analysis-entities.ts";
import { OutputPath } from "../../domain/models/value-objects.ts";

// Extracted Domain Services
import type { ResourceLoadingConfig } from "../../domain/services/resource-loading-service.ts";
import type { ResourceLoadingService } from "../../domain/services/resource-loading-service.ts";
import { ProcessingProgressTracker } from "../../domain/services/processing-progress-tracker.ts";
import type { ProcessingResultsSummary } from "../../domain/services/processing-result-aggregator.ts";
import { ProcessingResultAggregator } from "../../domain/services/processing-result-aggregator.ts";
import { ProcessingErrorHandler } from "../../domain/services/processing-error-handler.ts";

// Repository Interfaces
import type {
  FrontMatterExtractor,
  ProcessingConfiguration,
  ResultAggregator,
  ResultRepository,
  SchemaAnalyzer,
  TemplateMapper,
} from "../../domain/services/interfaces.ts";
import type {
  Document,
  Schema,
  Template,
} from "../../domain/models/entities.ts";

export interface ProcessDocumentsUseCaseInput {
  config: ProcessingConfiguration;
}

export interface ProcessDocumentsUseCaseOutput {
  processedCount: number;
  failedCount: number;
  outputPath: string;
  errors: Array<{ document: string; error: string }>;
}

/**
 * Refactored Process Documents Use Case
 *
 * Each method is now <50 lines, following SRP.
 * Uses extracted domain services for each responsibility.
 */
export class ProcessDocumentsUseCaseRefactored {
  private readonly resourceLoader: ResourceLoadingService;

  constructor(
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaAnalyzer: SchemaAnalyzer,
    private readonly templateMapper: TemplateMapper,
    private readonly resultAggregator: ResultAggregator,
    private readonly resultRepo: ResultRepository,
    resourceLoader: ResourceLoadingService,
  ) {
    this.resourceLoader = resourceLoader;
  }

  /**
   * Main execution method - now orchestration only
   * Reduced from 532 lines to ~45 lines
   */
  async execute(
    input: ProcessDocumentsUseCaseInput,
  ): Promise<
    Result<ProcessDocumentsUseCaseOutput, DomainError & { message: string }>
  > {
    const { config } = input;

    // Log pipeline start
    ProcessingProgressTracker.logPipelineStart({
      schemaPath: config.schemaPath.getValue(),
      templatePath: config.templatePath.getValue(),
      documentsPath: config.documentsPath.getValue(),
    });

    // Load all resources using dedicated service
    const resourcesResult = await this.loadResources(config);
    if (!resourcesResult.ok) {
      return resourcesResult;
    }
    const { schema, template, documents } = resourcesResult.data;

    // Validate processing configuration
    const optionsResult = ProcessingOptions.create(config.options);
    if (isError(optionsResult)) {
      const _errorResult = ProcessingErrorHandler.handleResourceLoadingError(
        optionsResult.error,
        "documents",
        "processing options",
      );
      return {
        ok: false,
        error: {
          ...optionsResult.error,
          message: "Failed to validate processing options",
        },
      };
    }

    // Process documents using appropriate strategy
    const processingResult = await this.processDocuments(
      documents,
      schema,
      template,
      optionsResult.data,
    );
    if (!processingResult.ok) {
      return processingResult;
    }

    // Generate final output
    return this.generateOutput(
      processingResult.data,
      config.outputPath.getValue(),
    );
  }

  /**
   * Load all required resources
   * Extracted from massive execute() method
   */
  private async loadResources(
    config: ProcessingConfiguration,
  ): Promise<
    Result<
      { schema: Schema; template: Template; documents: Document[] },
      DomainError & { message: string }
    >
  > {
    const resourceConfig: ResourceLoadingConfig = {
      schemaPath: config.schemaPath,
      templatePath: config.templatePath,
      documentsPath: config.documentsPath,
    };

    const resourcesResult = await this.resourceLoader.loadResources(
      resourceConfig,
    );
    if (!resourcesResult.ok) {
      return resourcesResult;
    }

    const { schema, template, documents } = resourcesResult.data;

    // Handle empty document list
    if (documents.length === 0) {
      ProcessingProgressTracker.logNoDocumentsProcessed([]);
      return {
        ok: true,
        data: { schema, template, documents: [] },
      };
    }

    ProcessingProgressTracker.logResourcesLoaded({
      documentsCount: documents.length,
      hasSchema: !!schema,
      hasTemplate: !!template,
    });

    return { ok: true, data: { schema, template, documents } };
  }

  /**
   * Process documents using parallel or sequential strategy
   * Extracted processing logic with proper delegation
   */
  private processDocuments(
    documents: Document[],
    schema: Schema,
    template: Template,
    options: ProcessingOptions,
  ): Promise<
    Result<ProcessingResultsSummary, DomainError & { message: string }>
  > {
    const isParallel = options.isParallel();

    ProcessingProgressTracker.logProcessingList(
      documents,
      isParallel ? "parallel" : "sequential",
    );

    if (isParallel) {
      return this.processDocumentsInParallel(
        documents,
        schema,
        template,
        options,
      );
    } else {
      return this.processDocumentsSequentially(
        documents,
        schema,
        template,
        options,
      );
    }
  }

  /**
   * Process documents in parallel
   * Clean separation of parallel processing logic
   */
  private async processDocumentsInParallel(
    documents: Document[],
    schema: Schema,
    template: Template,
    options: ProcessingOptions,
  ): Promise<
    Result<ProcessingResultsSummary, DomainError & { message: string }>
  > {
    const promises = documents.map(async (document) => {
      const documentPath = document.getPath().getValue();
      ProcessingProgressTracker.logDocumentProcessingStart(
        documentPath,
        "parallel",
      );

      const result = await this.processDocument(document, schema, template);
      return { document, result };
    });

    const outcomes = await Promise.all(promises);
    const summary = ProcessingResultAggregator.processParallelOutcomes(
      outcomes,
      options,
    );

    return { ok: true, data: summary };
  }

  /**
   * Process documents sequentially
   * Clean separation of sequential processing logic
   */
  private async processDocumentsSequentially(
    documents: Document[],
    schema: Schema,
    template: Template,
    options: ProcessingOptions,
  ): Promise<
    Result<ProcessingResultsSummary, DomainError & { message: string }>
  > {
    const results: AnalysisResult[] = [];
    const errors: Array<{ document: string; error: string }> = [];

    for (const document of documents) {
      const documentPath = document.getPath().getValue();
      ProcessingProgressTracker.logDocumentProcessingStart(
        documentPath,
        "sequential",
      );

      const result = await this.processDocument(document, schema, template);
      const outcome = ProcessingResultAggregator.processSequentialOutcome(
        document,
        result,
        options,
        results,
        errors,
      );

      if (outcome.shouldStop) {
        break;
      }
    }

    const summary: ProcessingResultsSummary = {
      results,
      errors,
      processedCount: results.length,
      failedCount: errors.length,
      shouldStop: false,
    };

    return { ok: true, data: summary };
  }

  /**
   * Process individual document
   * Simplified individual document processing
   */
  private async processDocument(
    document: Document,
    schema: Schema,
    template: Template,
  ): Promise<Result<AnalysisResult, DomainError & { message: string }>> {
    // Extract frontmatter
    const frontMatterResult = this.frontMatterExtractor.extract(document);
    if (isError(frontMatterResult)) {
      return frontMatterResult;
    }

    if (frontMatterResult.data.kind === "NotPresent") {
      const domainError = createDomainError({
        kind: "ExtractionStrategyFailed",
        strategy: "frontmatter",
        input: "No frontmatter found in document",
      });

      ProcessingErrorHandler.handleDocumentProcessingError(
        domainError,
        document.getPath().getValue(),
        "frontmatter extraction",
      );

      return {
        ok: false,
        error: {
          ...domainError,
          message: "No frontmatter found in document",
        },
      };
    }

    // Analyze with schema
    const analysisResult = await this.schemaAnalyzer.analyze(
      frontMatterResult.data.frontMatter,
      schema,
    );
    if (isError(analysisResult)) {
      return analysisResult;
    }

    // Map to template
    const mappingResult = this.templateMapper.map(
      analysisResult.data,
      template,
      { kind: "WithSchema", schema },
    );
    if (isError(mappingResult)) {
      return mappingResult;
    }

    // Create AnalysisResult entity
    const analysisResultEntity = AnalysisResult.create(
      document,
      analysisResult.data,
      mappingResult.data,
    );

    return { ok: true, data: analysisResultEntity };
  }

  /**
   * Generate final output
   * Extracted final output generation logic
   */
  private async generateOutput(
    summary: ProcessingResultsSummary,
    outputPath: string,
  ): Promise<
    Result<ProcessDocumentsUseCaseOutput, DomainError & { message: string }>
  > {
    // Validate results
    if (
      !ProcessingResultAggregator.validateResults(
        summary.results,
        summary.errors,
      )
    ) {
      return {
        ok: true,
        data: {
          processedCount: 0,
          failedCount: summary.errors.length,
          outputPath,
          errors: summary.errors,
        },
      };
    }

    // Aggregate and save results
    const aggregateResult = await this.aggregateAndSaveResults(
      summary.results,
      outputPath,
    );
    if (!aggregateResult.ok) {
      return aggregateResult;
    }

    ProcessingProgressTracker.logFinalCompletion(
      summary.processedCount,
      summary.failedCount,
      outputPath,
    );

    return {
      ok: true,
      data: {
        processedCount: summary.processedCount,
        failedCount: summary.failedCount,
        outputPath,
        errors: summary.errors,
      },
    };
  }

  /**
   * Aggregate results and save to output
   * Final step in processing pipeline
   */
  private async aggregateAndSaveResults(
    results: AnalysisResult[],
    outputPath: string,
  ): Promise<Result<void, DomainError & { message: string }>> {
    ProcessingProgressTracker.logResultAggregationStart(results.length);

    const aggregateResult = this.resultAggregator.aggregate(results);
    if (isError(aggregateResult)) {
      return {
        ok: false,
        error: {
          ...aggregateResult.error,
          message: "Failed to aggregate results",
        },
      };
    }

    ProcessingProgressTracker.logResultAggregationSuccess();

    const outputPathResult = OutputPath.create(outputPath);
    if (!outputPathResult.ok) {
      return {
        ok: false,
        error: outputPathResult.error,
      };
    }

    const saveResult = await this.resultRepo.save(
      aggregateResult.data,
      outputPathResult.data,
    );
    if (isError(saveResult)) {
      return {
        ok: false,
        error: {
          ...saveResult.error,
          message: `Failed to save results to ${outputPath}`,
        },
      };
    }

    return { ok: true, data: undefined };
  }
}
