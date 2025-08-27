/**
 * TypeScript Analysis Orchestrator - Domain Boundary Architecture Implementation
 *
 * Implements the documented 2-stage TypeScript processing approach from domain-boundary.md:
 * Stage 1: Information extraction from frontmatter + schema
 * Stage 2: Template mapping with extracted information
 *
 * This orchestrator follows the CD2: TypeScript Analysis Domain specification.
 */

import type { Result } from "../core/result.ts";
import {
  createValidationError,
  type ValidationError,
} from "../shared/errors.ts";
import type { FrontMatterContent } from "../models/value-objects.ts";
import type { Schema, Template } from "../models/entities.ts";
import type { AIAnalyzerPort } from "../../infrastructure/ports/index.ts";

/**
 * Extracted information from frontmatter (Stage 1 output)
 * Represents the ExtractedInfo value object from domain boundary spec
 */
export class ExtractedInfo {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly metadata: ExtractionMetadata,
  ) {}

  static create(
    rawData: unknown,
    metadata: ExtractionMetadata,
  ): Result<ExtractedInfo, ValidationError> {
    if (!rawData || typeof rawData !== "object") {
      return {
        ok: false,
        error: createValidationError("Extracted data must be an object"),
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
 * Structured data after template mapping (Stage 2 output)
 * Maps to StructuredData from domain boundary spec
 */
export class StructuredData {
  private constructor(
    private readonly content: string,
    private readonly templateName: string,
    private readonly metadata: StructuringMetadata,
  ) {}

  static create(
    content: string,
    templateName: string,
    metadata: StructuringMetadata,
  ): Result<StructuredData, ValidationError> {
    if (!content || content.trim() === "") {
      return {
        ok: false,
        error: createValidationError("Structured content cannot be empty"),
      };
    }

    return {
      ok: true,
      data: new StructuredData(content, templateName, metadata),
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
  stage: "information_extraction";
}

export interface StructuringMetadata {
  structuredAt: Date;
  promptUsed: string;
  templateName: string;
  sourceMetadata: ExtractionMetadata;
  stage: "template_mapping";
}

/**
 * TypeScript Analysis Orchestrator - implements CD2 domain boundary specification
 *
 * Responsible for 2-stage TypeScript processing:
 * 1. extractInformation: frontMatter + schema → ExtractedInfo
 * 2. mapToTemplate: ExtractedInfo + schema + template → StructuredData
 */
export class TypeScriptAnalysisOrchestrator {
  constructor(
    private readonly aiAnalyzer: AIAnalyzerPort,
    private readonly extractionPrompt: string, // Stage 1 prompt
    private readonly mappingPrompt: string, // Stage 2 prompt
  ) {}

  /**
   * Stage 1: Extract information from frontmatter + schema
   * Input: FrontMatterContent + Schema
   * Output: ExtractedInfo
   */
  async extractInformation(
    frontMatter: FrontMatterContent,
    schema: Schema,
  ): Promise<Result<ExtractedInfo, ValidationError>> {
    try {
      // Extract schema definition and version from Schema entity
      const schemaDefinition = schema.getDefinition();
      const schemaVersion = schema.getVersion();

      // Build extraction prompt for Stage 1
      const frontMatterData = frontMatter.toJSON();
      const prompt = this.buildExtractionPrompt(
        frontMatterData && typeof frontMatterData === "object"
          ? frontMatterData as object
          : {},
        schemaDefinition.getValue() as object,
      );

      // Execute AI analysis for information extraction
      const result = await this.aiAnalyzer.analyze({
        content: JSON.stringify(frontMatter.toJSON()),
        prompt,
      });

      if (!result.ok) {
        return {
          ok: false,
          error: createValidationError(
            `Stage 1 (Information extraction) failed: ${result.error.message}`,
          ),
        };
      }

      // Parse result and create ExtractedInfo
      const parsed = JSON.parse(result.data.result);
      const metadata: ExtractionMetadata = {
        extractedAt: new Date(),
        promptUsed: "extraction_stage",
        schemaVersion: schemaVersion.toString(),
        stage: "information_extraction",
      };

      return ExtractedInfo.create(parsed, metadata);
    } catch (e) {
      return {
        ok: false,
        error: createValidationError(
          `Stage 1 failed to parse extraction result: ${e}`,
        ),
      };
    }
  }

  /**
   * Stage 2: Map extracted information to template
   * Input: ExtractedInfo + Schema + Template
   * Output: StructuredData
   */
  async mapToTemplate(
    extractedInfo: ExtractedInfo,
    schema: Schema,
    template: Template,
  ): Promise<Result<StructuredData, ValidationError>> {
    try {
      // Extract schema definition from Schema entity
      const schemaDefinition = schema.getDefinition();

      // Build template mapping prompt for Stage 2
      const prompt = this.buildTemplateMappingPrompt(
        extractedInfo.getData(),
        schemaDefinition.getValue() as object,
        template.getFormat().getTemplate(),
      );

      // Execute AI analysis for template mapping
      const result = await this.aiAnalyzer.analyze({
        content: JSON.stringify({
          extractedInfo: extractedInfo.getData(),
          schema: schemaDefinition.getValue(),
          template: template.getFormat().getTemplate(),
        }),
        prompt,
      });

      if (!result.ok) {
        return {
          ok: false,
          error: createValidationError(
            `Stage 2 (Template mapping) failed: ${result.error.message}`,
          ),
        };
      }

      // Create structured data from mapped template
      const metadata: StructuringMetadata = {
        structuredAt: new Date(),
        promptUsed: "mapping_stage",
        templateName: template.getId().getValue(),
        sourceMetadata: extractedInfo.getMetadata(),
        stage: "template_mapping",
      };

      return StructuredData.create(
        result.data.result,
        template.getId().getValue(),
        metadata,
      );
    } catch (e) {
      return {
        ok: false,
        error: createValidationError(
          `Stage 2 failed to process template mapping: ${e}`,
        ),
      };
    }
  }

  /**
   * Complete 2-stage processing pipeline as per domain boundary spec
   */
  async processComplete(
    frontMatter: FrontMatterContent,
    schema: Schema,
    template: Template,
  ): Promise<Result<StructuredData, ValidationError>> {
    // Stage 1: Information extraction
    const extractionResult = await this.extractInformation(frontMatter, schema);
    if (!extractionResult.ok) {
      return extractionResult;
    }

    // Stage 2: Template mapping
    return this.mapToTemplate(extractionResult.data, schema, template);
  }

  private buildExtractionPrompt(
    frontMatter: object,
    schema: object,
  ): string {
    return this.extractionPrompt
      .replace("{{FRONTMATTER}}", JSON.stringify(frontMatter, null, 2))
      .replace("{{SCHEMA}}", JSON.stringify(schema, null, 2));
  }

  private buildTemplateMappingPrompt(
    extractedData: object,
    schema: object,
    template: string,
  ): string {
    return this.mappingPrompt
      .replace("{{EXTRACTED_DATA}}", JSON.stringify(extractedData, null, 2))
      .replace("{{SCHEMA}}", JSON.stringify(schema, null, 2))
      .replace("{{TEMPLATE}}", template);
  }
}
