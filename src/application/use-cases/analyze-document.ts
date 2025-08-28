// Analyze single document use case

import {
  createDomainError,
  type DomainError,
  isError,
  type Result,
} from "../../domain/core/result.ts";
import { AnalysisResult, type Schema } from "../../domain/models/entities.ts";
import type { Template } from "../../domain/models/domain-models.ts";
import type { DocumentPath } from "../../domain/models/value-objects.ts";
import type {
  AnalysisConfiguration,
  DocumentRepository,
  FrontMatterExtractor,
  SchemaAnalyzer,
  TemplateMapper,
} from "../../domain/services/interfaces.ts";

export interface AnalyzeDocumentUseCaseInput {
  documentPath: DocumentPath;
  schema: Schema;
  template: Template;
  config: AnalysisConfiguration;
}

export interface AnalyzeDocumentUseCaseOutput {
  result: AnalysisResult;
  extractedFields: string[];
  mappedFields: string[];
}

export class AnalyzeDocumentUseCase {
  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaAnalyzer: SchemaAnalyzer,
    private readonly templateMapper: TemplateMapper,
  ) {}

  async execute(
    input: AnalyzeDocumentUseCaseInput,
  ): Promise<
    Result<AnalyzeDocumentUseCaseOutput, DomainError & { message: string }>
  > {
    const { documentPath, schema, template } = input;

    // Read document
    const documentResult = await this.documentRepo.read(documentPath);
    if (isError(documentResult)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: documentPath.getValue(),
          details: "Failed to read document",
        }),
      };
    }
    const document = documentResult.data;

    // Extract frontmatter
    const frontMatterResult = this.frontMatterExtractor.extract(document);
    if (isError(frontMatterResult)) {
      return frontMatterResult;
    }

    if (frontMatterResult.data.kind === "NotPresent") {
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: "frontmatter",
          input: "No frontmatter found in document",
        }),
      };
    }

    const frontMatter = frontMatterResult.data.frontMatter;

    // Analyze with schema
    const extractedResult = await this.schemaAnalyzer.analyze(
      frontMatter,
      schema,
    );
    if (isError(extractedResult)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "AIServiceError",
          service: "schema_analyzer",
          statusCode: 500,
        }),
      };
    }
    const extractedData = extractedResult.data;

    // Map to template
    const mappedResult = this.templateMapper.map(extractedData, template, {
      kind: "WithSchema",
      schema: schema.getDefinition(),
    });
    if (isError(mappedResult)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: template,
          source: extractedData.getData(),
        }),
      };
    }
    const mappedData = mappedResult.data;

    // Create analysis result
    const analysisResult = AnalysisResult.create(
      document,
      extractedData,
      mappedData,
    );

    // Get field lists
    const extractedFields = Object.keys(extractedData.getData());
    const mappedFields = Object.keys(mappedData.getData());

    return {
      ok: true,
      data: {
        result: analysisResult,
        extractedFields,
        mappedFields,
      },
    };
  }
}
