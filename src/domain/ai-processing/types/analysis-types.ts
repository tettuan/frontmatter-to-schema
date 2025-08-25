/**
 * AI Processing Types - TypeScript replacement for claude -p
 * Following Totality principles and DDD patterns
 */

import type { Result } from "../../shared/types.ts";

/**
 * Two-stage analysis configuration
 * Replaces claude -p command parameters with type-safe configuration
 */
export interface TwoStageAnalysisConfig<TInput, TIntermediate, TOutput> {
  stage1: AnalysisStageConfig<TInput, TIntermediate>;
  stage2: AnalysisStageConfig<TIntermediate, TOutput>;
}

/**
 * Configuration for a single analysis stage
 */
export interface AnalysisStageConfig<TInput, TOutput> {
  prompt: PromptTemplate<TInput>;
  schema: SchemaDefinition<TOutput>;
  options: AnalysisOptions;
}

/**
 * Type-safe prompt template with variable extraction
 */
export interface PromptTemplate<T> {
  readonly template: string;
  readonly variables: PromptVariables<T>;
  render(input: T): string;
}

/**
 * Prompt variable extraction interface
 */
export interface PromptVariables<T> {
  extract(input: T, key: string): unknown;
}

/**
 * Schema definition for type-safe validation
 */
export interface SchemaDefinition<T> {
  readonly name: string;
  readonly version: string;
  validate(data: unknown): Result<T, any>;
  describe(): string;
}

/**
 * Analysis execution options
 */
export interface AnalysisOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeout?: number;
  readonly retryCount?: number;
}

/**
 * Claude API message request structure
 */
export interface ClaudeMessageRequest<T> {
  readonly model?: string;
  readonly messages: ClaudeMessage[];
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly systemPrompt?: string;
}

/**
 * Claude API message structure
 */
export interface ClaudeMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/**
 * HTTP request structure for type-safe communication
 */
export interface HTTPRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body?: string;
  readonly timeout?: number;
}

/**
 * HTTP response structure
 */
export interface HTTPResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly data: unknown;
}

/**
 * Schema validation error
 */
export interface SchemaValidationError {
  readonly kind: 'SchemaValidationError';
  readonly schema: string;
  readonly data: unknown;
  readonly details: string;
}

/**
 * Processing metrics for monitoring
 */
export interface ProcessingMetrics {
  readonly operationName: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly success: boolean;
  readonly errorType?: string;
}