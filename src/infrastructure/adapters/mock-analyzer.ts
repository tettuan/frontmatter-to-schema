/**
 * Unified Mock Analyzer for testing purposes
 * Consolidates mock-ai-analyzer and mock-schema-analyzer
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import {
  ExtractedData,
  type FrontMatter,
  type Schema,
} from "../../domain/models/entities.ts";
import type { SchemaAnalyzer } from "../../domain/services/interfaces.ts";
import type {
  AIAnalysisRequest,
  AIAnalysisResponse,
  AIAnalyzerPort,
} from "../ports/index.ts";

/**
 * Unified mock analyzer that can act as both AI and Schema analyzer
 */
export class MockAnalyzer implements AIAnalyzerPort, SchemaAnalyzer {
  constructor(
    private readonly config?: unknown,
    private readonly extractionPromptTemplate?: string,
    private readonly mappingPromptTemplate?: string,
  ) {}

  /**
   * Method overloading for both AIAnalyzerPort and SchemaAnalyzer
   */
  async analyze(
    request: AIAnalysisRequest,
  ): Promise<Result<AIAnalysisResponse, DomainError & { message: string }>>;
  async analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, DomainError & { message: string }>>;
  async analyze(
    arg1: AIAnalysisRequest | FrontMatter,
    arg2?: Schema,
  ): Promise<
    | Result<AIAnalysisResponse, DomainError & { message: string }>
    | Result<ExtractedData, DomainError & { message: string }>
  > {
    // Check if this is an AI analyzer call
    if ("prompt" in arg1 && "content" in arg1) {
      return await this.analyzeAI(arg1);
    }
    // Otherwise it's a schema analyzer call
    return await this.analyzeSchema(arg1 as FrontMatter, arg2!);
  }

  /**
   * AIAnalyzerPort implementation
   */
  private async analyzeAI(
    request: AIAnalysisRequest,
  ): Promise<Result<AIAnalysisResponse, DomainError & { message: string }>> {
    // Use Promise.resolve to satisfy linter's require-await rule
    return await Promise.resolve(this.doAnalyzeAI(request));
  }

  private doAnalyzeAI(
    request: AIAnalysisRequest,
  ): Result<AIAnalysisResponse, DomainError & { message: string }> {
    try {
      // Parse content if it's JSON
      let parsed: Record<string, unknown>;
      try {
        const jsonResult = JSON.parse(request.content);
        parsed = this.validateRecordObject(jsonResult)
          ? jsonResult
          : { content: request.content };
      } catch {
        // If not JSON, use as-is
        parsed = { content: request.content };
      }

      // Create a mock result based on the prompt
      let result: Record<string, unknown> = {};

      if (request.prompt.includes("extract")) {
        // Mock extraction
        result = {
          title: parsed.title || "Extracted Title",
          description: parsed.description || "Extracted Description",
          ...parsed,
        };
      } else if (request.prompt.includes("template")) {
        // Mock template application
        result = {
          formatted: true,
          data: parsed,
        };
      } else {
        // Default mock response
        result = {
          processed: true,
          original: parsed,
        };
      }

      return {
        ok: true,
        data: {
          result: JSON.stringify(result),
          usage: {
            promptTokens: 50,
            completionTokens: 50,
            totalTokens: 100,
          },
        },
      };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "AIServiceError",
            service: "mock",
          },
          _error instanceof Error ? _error.message : "Mock AI analysis failed",
        ),
      };
    }
  }

  /**
   * SchemaAnalyzer implementation
   */
  private async analyzeSchema(
    frontMatter: FrontMatter,
    _schema: Schema,
  ): Promise<Result<ExtractedData, DomainError & { message: string }>> {
    // Use Promise.resolve to satisfy linter's require-await rule
    return await Promise.resolve(this.doAnalyzeSchema(frontMatter, _schema));
  }

  private doAnalyzeSchema(
    frontMatter: FrontMatter,
    _schema: Schema,
  ): Result<ExtractedData, DomainError & { message: string }> {
    try {
      // Parse frontmatter content
      const frontMatterJson = frontMatter.getContent().toJSON();
      const frontMatterData = this.validateRecordObject(frontMatterJson)
        ? frontMatterJson
        : {};

      // Create mock extracted data based on frontmatter
      const mockExtractedData = {
        title: frontMatterData?.title || "Test Title",
        description: frontMatterData?.description || "Test Description",
        ...(frontMatterData || {}),
        // Add some mock processing metadata
        _mock: true,
        _processedAt: new Date().toISOString(),
      };

      return {
        ok: true,
        data: ExtractedData.create(mockExtractedData),
      };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "AIServiceError",
          service: "mock",
          statusCode: 500,
        }),
      };
    }
  }

  /**
   * Type guard to validate that a value is a Record<string, unknown>
   */
  private validateRecordObject(
    value: unknown,
  ): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}

// Export compatibility aliases for gradual migration
export const MockSchemaAnalyzer = MockAnalyzer;
export const MockAIAnalyzer = MockAnalyzer;
