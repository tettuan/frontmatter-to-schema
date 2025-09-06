/**
 * Process Documents Use Case - Refactored
 *
 * Orchestrates the entire document processing pipeline using focused services.
 * Reduced from 532 lines to <100 lines following AI complexity control principles.
 */

import {
  type DomainError,
  isError,
  type Result,
} from "../../domain/core/result.ts";
import { getEnvironmentConfig } from "../../domain/config/environment-config.ts";
import type {
  Document,
  Schema,
  Template,
} from "../../domain/models/entities.ts";
import type {
  DocumentRepository,
  ProcessingConfiguration,
} from "../../domain/services/interfaces.ts";
import { LoggingDecoratorService } from "../../domain/services/logging-decorator-service.ts";
import { ErrorHandlerService } from "../../domain/services/error-handler-service.ts";
import type { DocumentProcessingService } from "../services/document-processing-service.ts";
import type { ResourceLoadingService } from "../services/resource-loading-service.ts";
import type {
  ResultAggregationService,
} from "../services/result-aggregation-service.ts";

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
 * Main use case orchestrating document processing pipeline
 * Now focuses on coordination rather than implementation details
 */
export class ProcessDocumentsUseCase {
  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly resourceLoadingService: ResourceLoadingService,
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly resultAggregationService: ResultAggregationService,
  ) {}

  /**
   * Execute the complete document processing pipeline
   * Reduced from 400+ lines to <50 lines
   */
  async execute(
    input: ProcessDocumentsUseCaseInput,
  ): Promise<
    Result<ProcessDocumentsUseCaseOutput, DomainError & { message: string }>
  > {
    const { config } = input;
    const envConfig = getEnvironmentConfig();
    const concurrentMode = !envConfig.getDebugMode(); // Use concurrent unless in debug mode

    LoggingDecoratorService.logInfo(
      { service: "ProcessDocumentsUseCase", operation: "execute" },
      "Starting document processing pipeline",
    );

    // Step 1: Load resources (schema and template)
    const resourcesResult = await this.resourceLoadingService.loadResources(
      config.schemaPath,
      config.templatePath.getValue(),
    );

    if (isError(resourcesResult)) {
      return ErrorHandlerService.transformError(resourcesResult, {
        operation: "resource loading",
        resource: "schema and template",
      });
    }

    const { schema, template } = resourcesResult.data;

    // Step 2: Load documents
    const documentsResult = await this.loadDocuments(config);
    if (isError(documentsResult)) {
      return documentsResult;
    }

    const documents = documentsResult.data;

    // Step 3: Process documents (concurrent or sequential based on config)
    const processingResults = concurrentMode
      ? await this.processConcurrent(documents, schema, template)
      : await this.processSequential(documents, schema, template);

    // Step 4: Aggregate results
    const aggregationResult = await this.resultAggregationService
      .aggregateResults(processingResults, config);

    if (isError(aggregationResult)) {
      return aggregationResult;
    }

    LoggingDecoratorService.logInfo(
      { service: "ProcessDocumentsUseCase", operation: "execute" },
      `Pipeline completed: ${aggregationResult.data.processedCount} processed, ${aggregationResult.data.failedCount} failed`,
    );

    return aggregationResult;
  }

  /**
   * Load documents from repository with error handling
   */
  private async loadDocuments(
    config: ProcessingConfiguration,
  ): Promise<Result<Document[], DomainError & { message: string }>> {
    const documentsResult = await this.documentRepo.findAll(
      config.documentsPath,
    );

    if (isError(documentsResult)) {
      return ErrorHandlerService.transformError(documentsResult, {
        operation: "document loading",
        resource: config.documentsPath.getValue(),
      });
    }

    if (documentsResult.data.length === 0) {
      return ErrorHandlerService.createResultWithMessage(
        { kind: "NotFound", resource: "documents" },
        {
          operation: "document discovery",
          resource: config.documentsPath.getValue(),
        },
      );
    }

    LoggingDecoratorService.logInfo(
      { service: "ProcessDocumentsUseCase", operation: "loadDocuments" },
      `Loaded ${documentsResult.data.length} documents`,
    );

    return documentsResult;
  }

  /**
   * Process documents concurrently for better performance
   */
  private async processConcurrent(
    documents: Document[],
    schema: Schema,
    template: Template,
  ) {
    LoggingDecoratorService.logInfo(
      { service: "ProcessDocumentsUseCase", operation: "processConcurrent" },
      `Processing ${documents.length} documents concurrently`,
    );

    const promises = documents.map((doc) =>
      this.documentProcessingService.processDocument(doc, schema, template)
    );

    return await Promise.all(promises);
  }

  /**
   * Process documents sequentially for debugging or resource constraints
   */
  private async processSequential(
    documents: Document[],
    schema: Schema,
    template: Template,
  ) {
    LoggingDecoratorService.logInfo(
      { service: "ProcessDocumentsUseCase", operation: "processSequential" },
      `Processing ${documents.length} documents sequentially`,
    );

    const results = [];
    for (const doc of documents) {
      const result = await this.documentProcessingService
        .processDocument(doc, schema, template);
      results.push(result);
    }

    return results;
  }
}
