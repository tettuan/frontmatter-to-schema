/**
 * Document Processor - Main Orchestrator (Refactored)
 * Following DDD principles and domain boundary separation
 * Part of Application Layer - Document Processing Context
 */

import { type DomainError, isOk, type Result } from "../domain/core/result.ts";
import type { Document } from "../domain/models/entities.ts";
import { BatchTransformationResult } from "../domain/models/transformation.ts";
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
import { SchemaAggregationAdapter } from "./services/schema-aggregation-adapter.ts";
import { SchemaExtensionRegistryFactory } from "../domain/schema/factories/schema-extension-registry-factory.ts";
import {
  ExtractedData,
  TransformationContext,
  TransformationResult,
} from "../domain/models/transformation.ts";
import type { Schema } from "../domain/models/entities.ts";
import type { Template } from "../domain/models/domain-models.ts";
import { SchemaExtensions } from "../domain/schema/value-objects/schema-extensions.ts";

/**
 * Document Processor - Main orchestrator for document processing workflow
 * Coordinates between different domain contexts following DDD boundaries
 */
export class DocumentProcessor {
  private readonly fileOperations: FileOperations;
  private readonly resourceLoaders: ResourceLoaders;
  private readonly transformationPipeline: TransformationPipeline;
  private readonly outputGenerator: OutputGenerator;
  private readonly aggregationAdapter: SchemaAggregationAdapter;

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

    // Initialize aggregation adapter with registry
    const registryResult = SchemaExtensionRegistryFactory.createDefault();
    if (!registryResult.ok) {
      throw new Error(
        `Failed to create schema extension registry: ${registryResult.error.message}`,
      );
    }
    this.aggregationAdapter = new SchemaAggregationAdapter(registryResult.data);
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

    // Check if schema requires aggregation processing
    const schemaDefinition = schema.getDefinition().getRawDefinition();
    let schemaData: Record<string, unknown>;
    try {
      schemaData = typeof schemaDefinition === "string"
        ? JSON.parse(schemaDefinition)
        : schemaDefinition as Record<string, unknown>;
    } catch {
      schemaData = {};
    }

    const requiresAggregation = this.hasAggregationExtensions(schemaData);

    if (requiresAggregation) {
      // Process with aggregation for schemas with x-* extensions
      return this.processWithAggregation(
        documents,
        schemaData,
        template,
        config,
        schema,
      );
    } else {
      // Process normally for basic schemas
      return this.processWithoutAggregation(
        documents,
        schema,
        template,
        config,
      );
    }
  }

  /**
   * Process documents with aggregation for x-* schema extensions
   */
  private async processWithAggregation(
    documents: Document[],
    schemaData: Record<string, unknown>,
    template: Template,
    config: ApplicationConfiguration,
    schema?: Schema,
  ): Promise<Result<BatchTransformationResult, DomainError>> {
    // Extract frontmatter from all documents
    const documentData: Record<string, unknown>[] = [];
    const errors: Array<{ document: Document; error: DomainError }> = [];

    for (const document of documents) {
      const frontMatterResult = document.getFrontMatter();
      if (isOk(frontMatterResult)) {
        const frontMatter = frontMatterResult.data;
        const contentJson = frontMatter.getContent().toJSON();
        if (
          typeof contentJson === "object" && contentJson !== null &&
          !Array.isArray(contentJson)
        ) {
          documentData.push(contentJson as Record<string, unknown>);
        }
      } else {
        errors.push({
          document,
          error: frontMatterResult.error,
        });
      }
    }

    // Process aggregation using SchemaAggregationAdapter
    const aggregationResult = this.aggregationAdapter.processAggregation(
      documentData,
      schemaData,
    );
    if (!aggregationResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ConfigurationError",
          config: {
            schema: schemaData,
            aggregationError: aggregationResult.error.message,
          },
        },
      };
    }

    const aggregatedData = aggregationResult.data;

    // Create transformation result with aggregated data
    const transformationResults: TransformationResult[] = [];

    // For aggregation, create a single result representing the aggregated output
    if (documents.length > 0) {
      const firstDocument = documents[0];
      const extractedData = ExtractedData.create(aggregatedData);
      // Use the provided schema for context, fall back to a minimal schema if not provided
      const contextSchema = schema ||
        ({
          getDefinition: () => ({
            getRawDefinition: () => ({ type: "object" }),
          }),
        } as Schema);
      const context = TransformationContext.create(
        firstDocument,
        contextSchema,
      );

      const transformationResult = TransformationResult.create(
        context,
        extractedData,
        aggregatedData,
      );
      transformationResults.push(transformationResult);
    }

    const batchResult = BatchTransformationResult.create(
      transformationResults,
      errors,
    );

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

  /**
   * Process documents without aggregation (original logic)
   */
  private async processWithoutAggregation(
    documents: Document[],
    schema: Schema,
    template: Template,
    config: ApplicationConfiguration,
  ): Promise<Result<BatchTransformationResult, DomainError>> {
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

  /**
   * Check if schema contains x-* extensions that require aggregation
   */
  private hasAggregationExtensions(schema: Record<string, unknown>): boolean {
    // Recursively check for x-derived-from, x-derived-unique, or x-template-aggregation-options
    const checkForExtensions = (obj: unknown): boolean => {
      if (typeof obj !== "object" || obj === null) {
        return false;
      }

      const record = obj as Record<string, unknown>;

      // Check for aggregation-related x-* properties
      for (const key in record) {
        if (
          key === SchemaExtensions.DERIVED_FROM ||
          key === SchemaExtensions.DERIVED_UNIQUE ||
          key === SchemaExtensions.DERIVED_FLATTEN ||
          key === SchemaExtensions.TEMPLATE_AGGREGATION_OPTIONS
        ) {
          return true;
        }

        // Recursively check nested objects
        if (checkForExtensions(record[key])) {
          return true;
        }
      }

      return false;
    };

    return checkForExtensions(schema);
  }
}
