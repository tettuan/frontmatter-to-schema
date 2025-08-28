/**
 * AI Analysis Orchestrator - Two-stage processing with claude -p
 *
 * Template Flow (テンプレートからの変換フロー):
 * Inputs:
 *   - テンプレート当て込みのprompt (PromptB)
 *   - Schema
 *   - テンプレート
 * Process:
 *   - claude -p processes all inputs
 * Output:
 *   - 変換後テンプレート (統合にそのまま利用)
 *
 * Stage 1: Information extraction from frontmatter
 * Stage 2: Template application with extracted information
 */

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type { FrontMatterContent } from "../models/value-objects.ts";
import type { Schema, Template } from "../models/entities.ts";
import type { AIAnalyzerPort } from "../../infrastructure/ports/index.ts";

/**
 * Extracted information from frontmatter (成果C)
 */
export class ExtractedInfo {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly metadata: ExtractionMetadata,
  ) {}

  static create(
    rawData: unknown,
    metadata: ExtractionMetadata,
  ): Result<ExtractedInfo, DomainError & { message: string }> {
    if (!rawData || typeof rawData !== "object") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof rawData,
          expectedFormat: "object",
        }, "Extracted data must be an object"),
      };
    }

    return {
      ok: true,
      data: new ExtractedInfo(rawData as Record<string, unknown>, metadata),
    };
  }

  getData(): Readonly<Record<string, unknown>> {
    return this.data;
  }

  getMetadata(): ExtractionMetadata {
    return this.metadata;
  }
}

/**
 * Structured data after template application (成果D)
 */
export class StructuredData {
  private constructor(
    private readonly content: string,
    private readonly templateName: string,
    private readonly metadata: StructuringMetadata,
  ) {}

  static createFromAppliedTemplate(
    appliedContent: string,
    templateName: string,
    metadata: StructuringMetadata,
  ): Result<StructuredData, DomainError & { message: string }> {
    if (!appliedContent || appliedContent.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "appliedTemplateContent",
        }, "Applied template content is empty"),
      };
    }

    return {
      ok: true,
      data: new StructuredData(appliedContent, templateName, metadata),
    };
  }

  getContent(): string {
    return this.content;
  }

  getTemplateName(): string {
    return this.templateName;
  }

  getMetadata(): StructuringMetadata {
    return this.metadata;
  }
}

export interface ExtractionMetadata {
  extractedAt: Date;
  promptUsed: string;
  schemaVersion: string;
}

export interface StructuringMetadata {
  structuredAt: Date;
  promptUsed: string;
  templateName: string;
  appliedContent: string;
  sourceMetadata: ExtractionMetadata;
}

/**
 * Two-stage AI analysis orchestrator
 */
export class AIAnalysisOrchestrator {
  constructor(
    private readonly aiAnalyzer: AIAnalyzerPort,
    private readonly promptA: string, // Information extraction prompt
    private readonly promptB: string, // Template application prompt
  ) {}

  /**
   * Stage 1: Extract information from frontmatter (成果B → 成果C)
   */
  async extractInformation(
    frontMatter: FrontMatterContent,
    schema: Schema,
  ): Promise<Result<ExtractedInfo, DomainError & { message: string }>> {
    // Extract schema definition and version from Schema entity
    const schemaDefinition = schema.getDefinition();
    const schemaVersion = schema.getVersion();

    // Build extraction prompt
    const frontMatterData = frontMatter.toJSON();
    const prompt = this.buildExtractionPrompt(
      frontMatterData && typeof frontMatterData === "object"
        ? frontMatterData as object
        : {},
      schemaDefinition.getValue() as object,
    );

    // Execute AI analysis (claude -p 1st call)
    const result = await this.aiAnalyzer.analyze({
      content: JSON.stringify(frontMatter.toJSON()),
      prompt,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ExtractionStrategyFailed",
          strategy: "ai_extraction",
          input: frontMatter,
        }, `Information extraction failed: ${result.error.message}`),
      };
    }

    // Parse result and create ExtractedInfo
    try {
      const parsed = JSON.parse(result.data.result);
      const metadata: ExtractionMetadata = {
        extractedAt: new Date(),
        promptUsed: "PromptA",
        schemaVersion: schemaVersion.toString(),
      };

      return ExtractedInfo.create(parsed, metadata);
    } catch (e) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ParseError",
          input: String(result.data),
          details: String(e),
        }, `Failed to parse extraction result: ${e}`),
      };
    }
  }

  /**
   * Stage 2: Apply template with extracted information (成果C → 成果D)
   */
  async applyTemplate(
    extractedInfo: ExtractedInfo,
    schema: Schema,
    template: Template,
  ): Promise<Result<StructuredData, DomainError & { message: string }>> {
    // Extract schema definition from Schema entity
    const schemaDefinition = schema.getDefinition();

    // Build template application prompt
    const prompt = this.buildTemplateApplicationPrompt(
      extractedInfo.getData(),
      schemaDefinition.getValue() as object,
      template.getFormat().getTemplate(),
    );

    // Execute AI analysis (claude -p 2nd call)
    const result = await this.aiAnalyzer.analyze({
      content: JSON.stringify({
        extractedData: extractedInfo.getData(),
        schema: schemaDefinition.getValue(),
        template: template.getFormat().getTemplate(),
      }),
      prompt,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TemplateMappingFailed",
          template: template,
          source: extractedInfo,
        }, `Template application failed: ${result.error.message}`),
      };
    }

    // Create structured data from applied template
    const metadata: StructuringMetadata = {
      structuredAt: new Date(),
      promptUsed: "PromptB",
      templateName: template.getId().getValue(),
      appliedContent: result.data.result,
      sourceMetadata: extractedInfo.getMetadata(),
    };

    return StructuredData.createFromAppliedTemplate(
      result.data.result,
      template.getId().getValue(),
      metadata,
    );
  }

  /**
   * Complete two-stage pipeline
   */
  async analyze(
    frontMatter: FrontMatterContent,
    schema: Schema,
    template: Template,
  ): Promise<Result<StructuredData, DomainError & { message: string }>> {
    // Stage 1: Information extraction
    const extractionResult = await this.extractInformation(
      frontMatter,
      schema,
    );
    if (!extractionResult.ok) {
      return extractionResult;
    }

    // Stage 2: Template application
    return this.applyTemplate(extractionResult.data, schema, template);
  }

  private buildExtractionPrompt(
    frontMatter: object,
    schema: object,
  ): string {
    return this.promptA
      .replace("{{FRONTMATTER}}", JSON.stringify(frontMatter, null, 2))
      .replace("{{SCHEMA}}", JSON.stringify(schema, null, 2));
  }

  private buildTemplateApplicationPrompt(
    extractedData: object,
    schema: object,
    template: string,
  ): string {
    // テンプレートへの当て込みのプロンプト
    // プロンプトは、「Schemaで解釈されたデータ」と「テンプレート」を使い、
    // テンプレートへ値を埋め込む指示を行う
    // 指示が的確になるように、「Schema」「Schemaで解釈されたデータ」「テンプレート」を使う
    return this.promptB
      .replace("{{EXTRACTED_DATA}}", JSON.stringify(extractedData, null, 2))
      .replace("{{SCHEMA}}", JSON.stringify(schema, null, 2))
      .replace("{{TEMPLATE}}", template);
  }
}
