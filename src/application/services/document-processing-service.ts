/**
 * Document Processing Service
 *
 * Handles individual document processing following Single Responsibility Principle.
 * Extracted from ProcessDocumentsUseCase to reduce AI complexity and improve maintainability.
 */

import {
  type DomainError,
  isError,
  type Result,
} from "../../domain/core/result.ts";
import type {
  Document,
  FrontMatter,
  Schema,
  Template,
} from "../../domain/models/entities.ts";
import {
  AnalysisResult,
  ExtractedData,
  type MappedData,
} from "../../domain/models/analysis-entities.ts";
import type {
  FrontMatterExtractor,
  SchemaAnalyzer,
  TemplateMapper,
} from "../../domain/services/interfaces.ts";
import { LoggingDecoratorService } from "../../domain/services/logging-decorator-service.ts";
import { ErrorHandlerService } from "../../domain/services/error-handler-service.ts";

/**
 * Service responsible for processing individual documents through the pipeline
 */
export class DocumentProcessingService {
  constructor(
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaAnalyzer: SchemaAnalyzer,
    private readonly templateMapper: TemplateMapper,
  ) {}

  /**
   * Process a single document through the complete pipeline
   */
  async processDocument(
    document: Document,
    schema: Schema,
    template: Template,
  ): Promise<Result<AnalysisResult, DomainError & { message: string }>> {
    const docPath = document.getPath().getValue();

    // Step 1: Extract frontmatter
    const frontMatterResult = await this.extractFrontMatter(document);
    if (isError(frontMatterResult)) {
      return ErrorHandlerService.transformError(frontMatterResult, {
        operation: "frontmatter extraction",
        resource: docPath,
      });
    }

    const frontMatter = frontMatterResult.data;

    // Step 2: Analyze with schema
    const analysisResult = await this.analyzeWithSchema(frontMatter, schema);
    if (isError(analysisResult)) {
      return ErrorHandlerService.transformError(analysisResult, {
        operation: "schema analysis",
        resource: docPath,
      });
    }

    // Step 3: Create ExtractedData entity
    const frontMatterData = frontMatter.getContent().toJSON() as Record<
      string,
      unknown
    >;
    const extractedDataEntity = ExtractedData.create(frontMatterData);

    // Step 4: Apply template mapping
    const mappingResult = this.applyTemplateMapping(
      extractedDataEntity,
      template,
      schema,
    );
    if (isError(mappingResult)) {
      return ErrorHandlerService.transformError(mappingResult, {
        operation: "template mapping",
        resource: docPath,
      });
    }

    // Step 5: Create analysis result
    const result = AnalysisResult.create(
      document,
      extractedDataEntity,
      mappingResult.data,
    );

    LoggingDecoratorService.logInfo(
      { service: "DocumentProcessingService", operation: "processDocument" },
      `Successfully processed document: ${docPath}`,
    );

    return { ok: true, data: result };
  }

  /**
   * Extract frontmatter from document
   */
  private extractFrontMatter(
    document: Document,
  ): Result<FrontMatter, DomainError & { message: string }> {
    const frontMatterResult = this.frontMatterExtractor.extract(document);
    if (isError(frontMatterResult)) {
      return frontMatterResult;
    }

    if (frontMatterResult.data.kind === "NotPresent") {
      const error: DomainError = {
        kind: "ExtractionStrategyFailed",
        strategy: "frontmatter",
        input: "No frontmatter found in document",
      };

      return ErrorHandlerService.createResultWithMessage(error, {
        operation: "frontmatter extraction",
        resource: document.getPath().getValue(),
      });
    }

    LoggingDecoratorService.logInfo(
      { service: "DocumentProcessingService", operation: "extractFrontMatter" },
      `Frontmatter extracted from: ${document.getPath().getValue()}`,
    );

    return { ok: true, data: frontMatterResult.data.frontMatter };
  }

  /**
   * Analyze frontmatter data with schema
   */
  private async analyzeWithSchema(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<unknown, DomainError & { message: string }>> {
    const analysisResult = await this.schemaAnalyzer.analyze(
      frontMatter,
      schema,
    );

    if (isError(analysisResult)) {
      return analysisResult;
    }

    LoggingDecoratorService.logInfo(
      { service: "DocumentProcessingService", operation: "analyzeWithSchema" },
      "Schema analysis completed successfully",
    );

    return analysisResult;
  }

  /**
   * Apply template mapping to analyzed data
   */
  private applyTemplateMapping(
    extractedData: ExtractedData,
    template: Template,
    schema: Schema,
  ): Result<MappedData, DomainError & { message: string }> {
    const mappingResult = this.templateMapper.map(extractedData, template, {
      kind: "WithSchema",
      schema: schema.getProperties(),
    });

    if (isError(mappingResult)) {
      return mappingResult;
    }

    LoggingDecoratorService.logInfo(
      {
        service: "DocumentProcessingService",
        operation: "applyTemplateMapping",
      },
      "Template mapping completed successfully",
    );

    return mappingResult;
  }
}
