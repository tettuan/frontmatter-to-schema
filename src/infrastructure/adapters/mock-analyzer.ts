/**
 * Unified Mock Analyzer for testing purposes
 * Consolidates mock-ai-analyzer and mock-schema-analyzer
 */

import type { Result } from "../../domain/shared/types.ts";
import {
  createError,
  type ProcessingError,
} from "../../domain/shared/types.ts";
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
} from "../ports/ai-analyzer.ts";
import type { APIError } from "../../domain/shared/errors.ts";
import { createAPIError } from "../../domain/shared/errors.ts";

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
  ): Promise<Result<AIAnalysisResponse, APIError>>;
  async analyze(
    frontMatter: FrontMatter,
    schema: Schema,
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>>;
  async analyze(
    arg1: AIAnalysisRequest | FrontMatter,
    arg2?: Schema,
  ): Promise<
    | Result<AIAnalysisResponse, APIError>
    | Result<ExtractedData, ProcessingError & { message: string }>
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
  ): Promise<Result<AIAnalysisResponse, APIError>> {
    // Use Promise.resolve to satisfy linter's require-await rule
    return await Promise.resolve(this.doAnalyzeAI(request));
  }

  private doAnalyzeAI(
    request: AIAnalysisRequest,
  ): Result<AIAnalysisResponse, APIError> {
    try {
      // Parse content if it's JSON
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(request.content) as Record<string, unknown>;
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
    } catch (error) {
      return {
        ok: false,
        error: createAPIError(
          error instanceof Error ? error.message : "Mock AI analysis failed",
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
  ): Promise<Result<ExtractedData, ProcessingError & { message: string }>> {
    // Use Promise.resolve to satisfy linter's require-await rule
    return await Promise.resolve(this.doAnalyzeSchema(frontMatter, _schema));
  }

  private doAnalyzeSchema(
    frontMatter: FrontMatter,
    _schema: Schema,
  ): Result<ExtractedData, ProcessingError & { message: string }> {
    try {
      // Parse frontmatter content
      const frontMatterData = frontMatter.getContent().toJSON() as Record<
        string,
        unknown
      >;

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
    } catch (error) {
      return {
        ok: false,
        error: createError({
          kind: "AnalysisFailed",
          document: "mock",
          reason: error instanceof Error
            ? error.message
            : "Mock analysis failed",
        }),
      };
    }
  }
}

// Export compatibility aliases for gradual migration
export const MockSchemaAnalyzer = MockAnalyzer;
export const MockAIAnalyzer = MockAnalyzer;
