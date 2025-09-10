/**
 * Document Processing Orchestrator
 *
 * Coordinates the high-level document processing workflow following DDD principles.
 * Split from DocumentProcessor to respect AI complexity control (<200 lines).
 */

import {
  type DomainError,
  isOk,
  type Result,
} from "../../domain/core/result.ts";
import {
  BatchTransformationResult,
  type TransformationResult,
} from "../../domain/models/transformation.ts";
import type { Document } from "../../domain/models/entities.ts";
import type { SchemaRepository } from "../../domain/repositories/schema-repository.ts";
import type { ITemplateRepository } from "../../domain/repositories/template-repository.ts";
import { TemplatePath } from "../../domain/repositories/template-repository.ts";
import type { FrontmatterProcessor } from "../../domain/frontmatter/services/frontmatter-processor.ts";
import type { FileRepository } from "../../infrastructure/file-system/file-repository.ts";
import type { OutputFormatter } from "../../infrastructure/services/output-formatter-interface.ts";
import type { ConfigurationExtractor } from "../services/configuration-extractor.ts";
import type { ApplicationConfiguration } from "../configuration.ts";

/**
 * Orchestrates document processing workflow across domain boundaries
 *
 * Following DDD: coordinates domain services without implementing domain logic
 */
export class DocumentOrchestrator {
  constructor(
    private readonly schemaRepository: SchemaRepository,
    private readonly templateRepository: ITemplateRepository,
    private readonly frontmatterProcessor: FrontmatterProcessor,
    private readonly fileRepository: FileRepository,
    private readonly outputFormatter: OutputFormatter,
    private readonly configExtractor: ConfigurationExtractor,
  ) {}

  /**
   * Main orchestration method for document processing
   *
   * @param config Application configuration
   * @returns Result containing batch transformation results
   */
  async processDocuments(
    config: ApplicationConfiguration,
  ): Promise<Result<BatchTransformationResult, DomainError>> {
    // Load schema from Schema Context
    // TODO: Adapt config.schema to match SchemaRepository.load(string) signature
    const schemaPath = config.schema.definition; // Use definition which contains path
    const schemaResult = await this.schemaRepository.load(schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }
    const schema = schemaResult.data;

    // Load template from Template Context
    // TODO: Adapt config.template to match ITemplateRepository.load(TemplatePath) signature
    const templatePathResult = TemplatePath.create(config.template.definition);
    if (!templatePathResult.ok) {
      return templatePathResult;
    }
    const templateResult = await this.templateRepository.load(
      templatePathResult.data,
    );
    if (!templateResult.ok) {
      return templateResult;
    }
    const template = templateResult.data;

    // Discover documents from File Context
    const documentsResult = await this.fileRepository.discoverDocuments(
      config.input,
    );
    if (!documentsResult.ok) {
      return documentsResult;
    }
    const documents = documentsResult.data;

    // Extract processing prompts
    const extractionPrompt = this.configExtractor.getExtractionPrompt(
      config.processing,
    );
    const mappingPrompt = this.configExtractor.getMappingPrompt(
      config.processing,
    );

    // Process each document through Frontmatter Context
    const results: TransformationResult[] = [];
    const errors: Array<{ document: Document; error: DomainError }> = [];

    for (const document of documents) {
      const transformResult = await this.frontmatterProcessor.transformDocument(
        document,
        schema,
        extractionPrompt,
        mappingPrompt,
      );

      if (isOk(transformResult)) {
        results.push(transformResult.data);
      } else if (
        this.configExtractor.shouldContinueOnError(config.processing)
      ) {
        errors.push({
          document,
          error: transformResult.error,
        });
      } else {
        return transformResult;
      }
    }

    // Create batch result
    const batchResult = BatchTransformationResult.create(results, errors);

    // Generate output through Template Context
    const outputResult = await this.outputFormatter.generateOutput(
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
