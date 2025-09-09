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
} from "../../domain/analysis/entities.ts";
import type {
  FrontMatterExtractor,
  SchemaAnalyzer,
  TemplateMapper,
} from "../../domain/services/interfaces.ts";
import { createDomainError } from "../../domain/core/result.ts";

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
    // Step 1: Extract frontmatter
    const frontMatterResult = await this.extractFrontMatter(document);
    if (isError(frontMatterResult)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: "frontmatter",
          input: frontMatterResult.error.message ||
            "Failed to extract frontmatter",
        }),
      };
    }

    const frontMatter = frontMatterResult.data;

    // Step 2: Analyze with schema
    const analysisResult = await this.analyzeWithSchema(frontMatter, schema);
    if (isError(analysisResult)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "SchemaValidationFailed",
          schema: schema,
          data: frontMatter,
        }),
      };
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
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: template,
          source: extractedDataEntity,
        }),
      };
    }

    // Step 5: Create analysis result
    const result = AnalysisResult.create(
      document,
      extractedDataEntity,
      mappingResult.data,
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

      return {
        ok: false,
        error: createDomainError(error),
      };
    }

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

    return mappingResult;
  }
}
