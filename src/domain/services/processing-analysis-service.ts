/**
 * Process Document Analysis Service
 *
 * Handles schema analysis and document processing orchestration following SRP.
 * Extracted from ProcessDocumentsUseCase.processDocument to reduce AI complexity.
 * Applies Totality principle with Result types and discriminated unions.
 */

import {
  createDomainError,
  type DomainError,
  isError,
  isOk,
  type Result,
} from "../core/result.ts";
import { getGlobalEnvironmentConfig } from "../../infrastructure/services/dependency-container.ts";
import {
  AnalysisResult,
  type Document,
  type ExtractedData,
  type FrontMatter,
  type Schema,
  type Template,
} from "../models/entities.ts";
import type {
  FrontMatterExtractor,
  SchemaAnalyzer,
  SchemaValidationMode,
  TemplateMapper,
} from "./interfaces.ts";
import { StructuredLogger } from "../shared/logger.ts";

/**
 * Service responsible for orchestrating document analysis workflow
 * Following AI Complexity Control Framework - single focused responsibility
 */
export class ProcessDocumentAnalysisService {
  private static readonly SERVICE_NAME = "processing-analysis-service";

  constructor(
    private readonly frontMatterExtractor: FrontMatterExtractor,
    private readonly schemaAnalyzer: SchemaAnalyzer,
    private readonly templateMapper: TemplateMapper,
  ) {}

  /**
   * Analyze document against schema and generate mapped result
   * Extracted from ProcessDocumentsUseCase.processDocument lines 420-530
   */
  async analyzeDocument(
    document: Document,
    schema: Schema,
    template: Template,
  ): Promise<Result<AnalysisResult, DomainError & { message: string }>> {
    const logger = StructuredLogger.getServiceLogger(
      ProcessDocumentAnalysisService.SERVICE_NAME,
    );
    const docPath = document.getPath().getValue();

    logger.info("Starting document analysis", {
      document: docPath,
    });

    // Step 1: Extract frontmatter
    const frontMatterResult = await this.extractFrontMatter(document);
    if (isError(frontMatterResult)) {
      return frontMatterResult;
    }

    // Step 2: Analyze with schema
    const extractedResult = await this.analyzeWithSchema(
      frontMatterResult.data,
      schema,
      docPath,
    );
    if (isError(extractedResult)) {
      return extractedResult;
    }

    // Step 3: Map to template
    const mappedResult = await this.mapToTemplate(
      extractedResult.data,
      template,
      schema,
      docPath,
    );
    if (isError(mappedResult)) {
      return mappedResult;
    }

    // Create analysis result
    const analysisResult = AnalysisResult.create(
      document,
      extractedResult.data,
      mappedResult.data,
    );

    logger.info("Document analysis completed successfully", {
      document: docPath,
    });

    return { ok: true, data: analysisResult };
  }

  /**
   * Extract frontmatter from document with enhanced error handling
   */
  private extractFrontMatter(document: Document) {
    const envConfig = getGlobalEnvironmentConfig();
    const verboseMode = envConfig.getVerboseMode();
    const docPath = document.getPath().getValue();

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
      } as const;
    }

    const frontMatter = frontMatterResult.data.frontMatter;

    // Verbose logging
    if (verboseMode) {
      const verboseLogger = StructuredLogger.getServiceLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("[成果B] Frontmatter extracted", {
        document: docPath,
        keys: Object.keys(frontMatter.toObject() as Record<string, unknown>),
      });
    }

    return { ok: true, data: frontMatter } as const;
  }

  /**
   * Analyze frontmatter against schema
   */
  private async analyzeWithSchema(
    frontMatter: FrontMatter,
    schema: Schema,
    docPath: string,
  ) {
    const envConfig = getGlobalEnvironmentConfig();
    const verboseMode = envConfig.getVerboseMode();

    const extractedResult = await this.schemaAnalyzer.analyze(
      frontMatter,
      schema,
    );

    // Verbose logging for successful analysis
    if (verboseMode && isOk(extractedResult)) {
      const verboseLogger = StructuredLogger.getServiceLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("[成果C] Schema analysis completed", {
        document: docPath,
        fieldsExtracted: Object.keys(extractedResult.data),
      });
    }

    // Error handling with verbose logging
    if (isError(extractedResult)) {
      if (verboseMode) {
        const errorLogger = StructuredLogger.getServiceLogger(
          "process-documents-helper",
        );
        errorLogger.error("AI analysis failed", {
          document: docPath,
          error: extractedResult.error,
        });
      }
      return extractedResult;
    }

    return extractedResult;
  }

  /**
   * Map extracted data to template
   */
  private mapToTemplate(
    extractedData: ExtractedData,
    template: Template,
    schema: Schema,
    docPath: string,
  ) {
    const envConfig = getGlobalEnvironmentConfig();
    const verboseMode = envConfig.getVerboseMode();

    const schemaDefinition = schema.getDefinition().getRawDefinition();
    const schemaMode: SchemaValidationMode = {
      kind: "WithSchema",
      schema: schemaDefinition,
    };

    const mappedResult = this.templateMapper.map(
      extractedData,
      template,
      schemaMode,
    );

    if (isError(mappedResult)) {
      if (verboseMode) {
        const errorLogger = StructuredLogger.getServiceLogger(
          "process-documents-helper",
        );
        errorLogger.error("Template mapping failed", {
          document: docPath,
        });
      }
      return mappedResult;
    }

    // Verbose logging for successful mapping
    if (verboseMode) {
      const verboseLogger = StructuredLogger.getServiceLogger(
        "process-documents-verbose",
      );
      verboseLogger.info("[成果D] Template mapping completed", {
        document: docPath,
      });
    }

    return mappedResult;
  }
}
