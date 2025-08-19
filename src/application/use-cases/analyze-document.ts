// Analyze single document use case

import {
  Result,
  ProcessingError,
  createError,
  isError,
} from "../../domain/shared/types.ts";
import {
  Document,
  Schema,
  Template,
  AnalysisResult,
} from "../../domain/models/entities.ts";
import {
  DocumentPath,
} from "../../domain/models/value-objects.ts";
import {
  DocumentRepository,
  SchemaRepository,
  TemplateRepository,
  FrontMatterExtractor,
  SchemaAnalyzer,
  TemplateMapper,
  AnalysisConfiguration,
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
    private readonly templateMapper: TemplateMapper
  ) {}

  async execute(
    input: AnalyzeDocumentUseCaseInput
  ): Promise<Result<AnalyzeDocumentUseCaseOutput, ProcessingError & { message: string }>> {
    const { documentPath, schema, template } = input;

    // Read document
    const documentResult = await this.documentRepo.read(documentPath);
    if (isError(documentResult)) {
      return {
        ok: false,
        error: createError({
          kind: "ExtractionFailed",
          document: documentPath.getValue(),
          reason: "Failed to read document"
        })
      };
    }
    const document = documentResult.data;

    // Extract frontmatter
    const frontMatterResult = this.frontMatterExtractor.extract(document);
    if (isError(frontMatterResult)) {
      return frontMatterResult;
    }

    const frontMatter = frontMatterResult.data;
    if (!frontMatter) {
      return {
        ok: false,
        error: createError({
          kind: "ExtractionFailed",
          document: documentPath.getValue(),
          reason: "No frontmatter found in document"
        })
      };
    }

    // Analyze with schema
    const extractedResult = await this.schemaAnalyzer.analyze(frontMatter, schema);
    if (isError(extractedResult)) {
      return {
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: documentPath.getValue(),
          reason: extractedResult.error.message
        })
      };
    }
    const extractedData = extractedResult.data;

    // Map to template
    const mappedResult = this.templateMapper.map(extractedData, template);
    if (isError(mappedResult)) {
      return {
        ok: false,
        error: createError({
          kind: "MappingFailed",
          document: documentPath.getValue(),
          reason: mappedResult.error.message
        })
      };
    }
    const mappedData = mappedResult.data;

    // Create analysis result
    const analysisResult = AnalysisResult.create(
      document,
      extractedData,
      mappedData
    );

    // Get field lists
    const extractedFields = Object.keys(extractedData.getData());
    const mappedFields = Object.keys(mappedData.getData());

    return {
      ok: true,
      data: {
        result: analysisResult,
        extractedFields,
        mappedFields
      }
    };
  }
}