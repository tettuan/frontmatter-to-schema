import type { Result } from "../../domain/shared/result.ts";
import type { APIError } from "../../domain/shared/errors.ts";

export interface AIAnalysisRequest {
  content: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIAnalysisResponse {
  result: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIAnalyzerPort {
  analyze(request: AIAnalysisRequest): Promise<Result<AIAnalysisResponse, APIError>>;
}