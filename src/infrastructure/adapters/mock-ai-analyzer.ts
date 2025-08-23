// Mock AI Analyzer for testing purposes
import type {
  AIAnalysisRequest,
  AIAnalysisResponse,
  AIAnalyzerPort,
} from "../ports/ai-analyzer.ts";
import type { Result } from "../../domain/core/result.ts";
import type { APIError } from "../../domain/shared/errors.ts";
import { createAPIError } from "../../domain/shared/errors.ts";

export class MockAIAnalyzer implements AIAnalyzerPort {
  analyze(request: AIAnalysisRequest): Promise<
    Result<AIAnalysisResponse, APIError>
  > {
    // Simple mock that returns transformed content based on request
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
          title: (parsed.title as string) || "Test Title",
          description: (parsed.description as string) || "Test Description",
          metadata: {
            extracted: true,
            timestamp: new Date().toISOString(),
          },
        };
      } else if (request.prompt.includes("template")) {
        // Mock template application
        result = {
          command: (parsed.title as string) || "test-command",
          description: (parsed.description as string) || "Test command",
          config: {
            template: "applied",
            processed: true,
          },
        };
      } else {
        // Default mock result
        result = {
          processed: true,
          data: parsed,
        };
      }

      return Promise.resolve({
        ok: true,
        data: {
          result: JSON.stringify(result),
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        },
      });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: createAPIError(
          error instanceof Error ? error.message : "Mock analysis failed",
        ),
      });
    }
  }
}
