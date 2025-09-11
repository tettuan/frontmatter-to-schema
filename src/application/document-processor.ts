/**
 * Document Processor - Main Orchestrator (Refactored)
 * Following DDD principles and domain boundary separation
 * Part of Application Layer - Document Processing Context
 */

import { type DomainError, isOk, type Result } from "../domain/core/result.ts";
import type { Document } from "../domain/models/entities.ts";
import {
  BatchTransformationResult,
  type TransformationResult,
} from "../domain/models/transformation.ts";
import type { FrontMatterExtractor } from "../domain/services/interfaces.ts";
import type { SchemaValidator } from "../domain/services/schema-validator.ts";
import type {
  UnifiedTemplateProcessor,
} from "../domain/template/services/unified-template-processor.ts";
import type { FileSystemPort } from "../infrastructure/ports/index.ts";
import type { ApplicationConfiguration } from "./configuration.ts";
import { FileOperations } from "./document-processing/file-operations.ts";
import { ResourceLoaders } from "./document-processing/resource-loaders.ts";
import { TransformationPipeline } from "./document-processing/transformation-pipeline.ts";
import { OutputGenerator } from "./document-processing/output-generators.ts";

/**
 * Document Processor - Main orchestrator for document processing workflow
 * Coordinates between different domain contexts following DDD boundaries
 */
export class DocumentProcessor {
  private readonly fileOperations: FileOperations;
  private readonly resourceLoaders: ResourceLoaders;
  private readonly transformationPipeline: TransformationPipeline;
  private readonly outputGenerator: OutputGenerator;

  constructor(
    private readonly fileSystem: FileSystemPort,
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaValidator: SchemaValidator,
    private readonly templateProcessor: UnifiedTemplateProcessor,
  ) {
    // Initialize domain services
    this.fileOperations = new FileOperations(fileSystem, frontMatterExtractor);
    this.resourceLoaders = new ResourceLoaders();
    this.transformationPipeline = new TransformationPipeline(
      schemaValidator,
      templateProcessor,
    );
    this.outputGenerator = new OutputGenerator(
      fileSystem,
      this.transformationPipeline,
    );
  }

  /**
   * Main document processing workflow orchestrator
   * Coordinates between different domain contexts
   */
  async processDocuments(
    config: ApplicationConfiguration,
  ): Promise<Result<BatchTransformationResult, DomainError>> {
    // Load resources using Resource Context
    const schemaResult = this.resourceLoaders.loadSchema(config.schema);
    if (!schemaResult.ok) {
      return schemaResult;
    }
    const schema = schemaResult.data;

    const templateResult = this.resourceLoaders.loadTemplate(config.template);
    if (!templateResult.ok) {
      return templateResult;
    }
    const template = templateResult.data;

    // Discover documents using File Context
    const documentsResult = await this.fileOperations.discoverDocuments(
      config.input,
    );
    if (!documentsResult.ok) {
      return documentsResult;
    }
    const documents = documentsResult.data;

    // Process each document using Transformation Context
    const results: TransformationResult[] = [];
    const errors: Array<{ document: Document; error: DomainError }> = [];

    const extractionPrompt = this.transformationPipeline.getExtractionPrompt(
      config.processing,
    );
    const mappingPrompt = this.transformationPipeline.getMappingPrompt(
      config.processing,
    );
    const continueOnError = this.transformationPipeline.shouldContinueOnError(
      config.processing,
    );

    for (const document of documents) {
      const transformResult = this.transformationPipeline.transformDocument(
        document,
        schema,
        extractionPrompt,
        mappingPrompt,
      );

      if (isOk(transformResult)) {
        results.push(transformResult.data);
      } else if (continueOnError) {
        errors.push({
          document,
          error: transformResult.error,
        });
      } else {
        return transformResult;
      }
    }

    const batchResult = BatchTransformationResult.create(results, errors);

    // Generate output using Output Context
    const outputResult = await this.outputGenerator.generateOutput(
      batchResult,
      template,
      config.output,
    );

    if (!outputResult.ok) {
      return outputResult;
    }

    return { ok: true, data: batchResult };
  }
}
