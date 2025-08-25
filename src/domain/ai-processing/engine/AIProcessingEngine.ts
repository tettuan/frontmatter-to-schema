/**
 * AI Processing Engine - Complete TypeScript replacement for claude -p
 * Implements two-stage analysis with type safety and robust error handling
 */

import type { Result } from "../../shared/types.ts";
import type {
  TwoStageAnalysisConfig,
  AnalysisStageConfig,
  ClaudeMessageRequest,
  ProcessingMetrics,
} from "../types/analysis-types.ts";
import type {
  AIProcessingError,
  NetworkError,
  APIError,
} from "../errors/AIProcessingError.ts";
import {
  formatErrorMessage,
  isRetryableError,
  getRetryDelayMs,
  createNetworkError,
} from "../errors/AIProcessingError.ts";

/**
 * Rate limiter interface for API throttling
 */
interface RateLimiter {
  acquire(): Promise<void>;
  getTokensRemaining(): number;
}

/**
 * Circuit breaker interface for fault tolerance
 */
interface CircuitBreaker {
  isOpen(): boolean;
  recordSuccess(): void;
  recordFailure(): void;
  getFailureCount(): number;
}

/**
 * Metrics collector interface for monitoring
 */
interface MetricsCollector {
  recordSuccess(operationName: string, duration: number): void;
  recordError(operationName: string, duration: number, error: AIProcessingError): void;
  getMetrics(operationName: string, options?: { period: number }): Promise<ProcessingMetrics[]>;
}

/**
 * Structured logger interface
 */
interface StructuredLogger {
  info(message: string, context: Record<string, unknown>): void;
  error(message: string, context: Record<string, unknown>): void;
  debug(message: string, context: Record<string, unknown>): void;
  warn(message: string, context: Record<string, unknown>): void;
}

/**
 * Claude API Client interface
 */
interface ClaudeAPIClient {
  sendMessage<TRequest, TResponse>(
    request: ClaudeMessageRequest<TRequest>,
    responseSchema: { validate(data: unknown): Result<TResponse, any> },
    traceId: string
  ): Promise<Result<TResponse, APIError>>;
}

/**
 * AI Processing Engine Configuration
 */
export interface AIProcessingEngineConfig {
  readonly timeout: number;
  readonly maxRetries: number;
  readonly enableCircuitBreaker: boolean;
  readonly enableRateLimit: boolean;
  readonly defaultModel: string;
  readonly defaultTemperature: number;
  readonly defaultMaxTokens: number;
}

/**
 * Main AI Processing Engine
 * Replaces all claude -p functionality with type-safe TypeScript implementation
 */
export class AIProcessingEngine {
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly apiClient: ClaudeAPIClient,
    private readonly config: AIProcessingEngineConfig,
    private readonly metrics: MetricsCollector,
    private readonly logger: StructuredLogger,
    rateLimiter: RateLimiter,
    circuitBreaker: CircuitBreaker
  ) {
    this.rateLimiter = rateLimiter;
    this.circuitBreaker = circuitBreaker;
  }

  /**
   * Execute two-stage analysis - core replacement for claude -p dual processing
   * Stage 1: Information extraction (claude -p first call)
   * Stage 2: Template application (claude -p second call)
   */
  async processTwoStageAnalysis<TInput, TIntermediate, TOutput>(
    input: TInput,
    config: TwoStageAnalysisConfig<TInput, TIntermediate, TOutput>
  ): Promise<Result<TOutput, AIProcessingError>> {
    const traceId = this.generateTraceId();
    const startTime = Date.now();

    this.logger.info('Starting two-stage AI analysis', {
      traceId,
      stage: 'begin',
      inputType: typeof input,
    });

    try {
      // Pre-flight checks
      const preflightResult = await this.performPreflightChecks(traceId);
      if (!preflightResult.ok) {
        return preflightResult;
      }

      // Stage 1: Information extraction
      this.logger.debug('Executing stage 1: information extraction', { traceId });
      const stage1Result = await this.executeStage1Analysis(input, config.stage1, traceId);
      
      if (!stage1Result.ok) {
        this.recordFailure('two_stage_analysis', startTime, stage1Result.error);
        return stage1Result;
      }

      // Stage 2: Template application
      this.logger.debug('Executing stage 2: template application', { traceId });
      const stage2Result = await this.executeStage2Analysis(
        stage1Result.data,
        config.stage2,
        traceId
      );

      if (!stage2Result.ok) {
        this.recordFailure('two_stage_analysis', startTime, stage2Result.error);
        return stage2Result;
      }

      // Success recording
      const duration = Date.now() - startTime;
      this.metrics.recordSuccess('two_stage_analysis', duration);
      this.circuitBreaker.recordSuccess();

      this.logger.info('Two-stage analysis completed successfully', {
        traceId,
        duration,
        stage: 'complete',
      });

      return stage2Result;

    } catch (error) {
      const unexpectedError = this.handleUnexpectedError(error, traceId);
      this.recordFailure('two_stage_analysis', startTime, unexpectedError);
      return { ok: false, error: unexpectedError };
    }
  }

  /**
   * Execute Stage 1: Information extraction (replaces claude -p first call)
   */
  private async executeStage1Analysis<TInput, TIntermediate>(
    input: TInput,
    config: AnalysisStageConfig<TInput, TIntermediate>,
    traceId: string
  ): Promise<Result<TIntermediate, AIProcessingError>> {
    const stageStartTime = Date.now();

    try {
      // Render prompt with input data
      const renderedPrompt = config.prompt.render(input);
      
      // Prepare Claude API request
      const apiRequest: ClaudeMessageRequest<TInput> = {
        model: this.config.defaultModel,
        messages: [{
          role: 'user',
          content: renderedPrompt
        }],
        maxTokens: config.options.maxTokens || this.config.defaultMaxTokens,
        temperature: config.options.temperature ?? this.config.defaultTemperature,
      };

      // Execute API call with retry logic
      const apiResult = await this.executeWithRetry(
        () => this.apiClient.sendMessage(apiRequest, config.schema, traceId),
        config.options.retryCount || this.config.maxRetries,
        traceId
      );

      if (!apiResult.ok) {
        return apiResult;
      }

      const duration = Date.now() - stageStartTime;
      this.metrics.recordSuccess('stage1_analysis', duration);

      return { ok: true, data: apiResult.data };

    } catch (error) {
      const duration = Date.now() - stageStartTime;
      const processedError = this.handleUnexpectedError(error, traceId);
      this.metrics.recordError('stage1_analysis', duration, processedError);
      return { ok: false, error: processedError };
    }
  }

  /**
   * Execute Stage 2: Template application (replaces claude -p second call)
   */
  private async executeStage2Analysis<TIntermediate, TOutput>(
    intermediateResult: TIntermediate,
    config: AnalysisStageConfig<TIntermediate, TOutput>,
    traceId: string
  ): Promise<Result<TOutput, AIProcessingError>> {
    const stageStartTime = Date.now();

    try {
      // Render prompt with intermediate result
      const renderedPrompt = config.prompt.render(intermediateResult);
      
      // Prepare Claude API request
      const apiRequest: ClaudeMessageRequest<TIntermediate> = {
        model: this.config.defaultModel,
        messages: [{
          role: 'user',
          content: renderedPrompt
        }],
        maxTokens: config.options.maxTokens || this.config.defaultMaxTokens,
        temperature: config.options.temperature ?? this.config.defaultTemperature,
      };

      // Execute API call with retry logic
      const apiResult = await this.executeWithRetry(
        () => this.apiClient.sendMessage(apiRequest, config.schema, traceId),
        config.options.retryCount || this.config.maxRetries,
        traceId
      );

      if (!apiResult.ok) {
        return apiResult;
      }

      const duration = Date.now() - stageStartTime;
      this.metrics.recordSuccess('stage2_analysis', duration);

      return { ok: true, data: apiResult.data };

    } catch (error) {
      const duration = Date.now() - stageStartTime;
      const processedError = this.handleUnexpectedError(error, traceId);
      this.metrics.recordError('stage2_analysis', duration, processedError);
      return { ok: false, error: processedError };
    }
  }

  /**
   * Perform preflight checks before processing
   */
  private async performPreflightChecks(traceId: string): Promise<Result<void, AIProcessingError>> {
    // Rate limiting check
    if (this.config.enableRateLimit) {
      try {
        await this.rateLimiter.acquire();
      } catch (error) {
        this.logger.warn('Rate limit acquisition failed', { traceId, error });
        return {
          ok: false,
          error: createNetworkError('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', true, traceId)
        };
      }
    }

    // Circuit breaker check
    if (this.config.enableCircuitBreaker && this.circuitBreaker.isOpen()) {
      this.logger.warn('Circuit breaker is open', {
        traceId,
        failureCount: this.circuitBreaker.getFailureCount()
      });
      
      return {
        ok: false,
        error: {
          kind: 'CircuitBreakerOpen',
          serviceName: 'AIProcessingEngine',
          failureCount: this.circuitBreaker.getFailureCount(),
          nextRetryTime: new Date(Date.now() + 60000).toISOString(), // 1 minute
          traceId
        }
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<Result<T, AIProcessingError>>,
    maxRetries: number,
    traceId: string
  ): Promise<Result<T, AIProcessingError>> {
    let lastError: AIProcessingError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = lastError ? getRetryDelayMs(lastError, attempt) : 1000;
        this.logger.debug('Retrying operation', { traceId, attempt, delay });
        await this.sleep(delay);
      }

      const result = await operation();
      
      if (result.ok) {
        if (attempt > 0) {
          this.logger.info('Operation succeeded after retry', { traceId, attempt });
        }
        return result;
      }

      lastError = result.error;

      // Don't retry non-retryable errors
      if (!isRetryableError(result.error)) {
        this.logger.debug('Error is not retryable', {
          traceId,
          errorKind: result.error.kind,
          attempt
        });
        break;
      }

      this.logger.debug('Operation failed, will retry', {
        traceId,
        attempt,
        errorKind: result.error.kind,
        errorMessage: formatErrorMessage(result.error)
      });
    }

    return { ok: false, error: lastError! };
  }

  /**
   * Handle unexpected errors (non-AIProcessingError)
   */
  private handleUnexpectedError(error: unknown, traceId: string): AIProcessingError {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error('Unexpected error occurred', { traceId, error: message });
    
    return createNetworkError('UNEXPECTED_ERROR', `Unexpected error: ${message}`, false, traceId);
  }

  /**
   * Record failure metrics and circuit breaker state
   */
  private recordFailure(operationName: string, startTime: number, error: AIProcessingError): void {
    const duration = Date.now() - startTime;
    this.metrics.recordError(operationName, duration, error);
    this.circuitBreaker.recordFailure();
  }

  /**
   * Generate unique trace ID for request tracking
   */
  private generateTraceId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Default configuration for AI Processing Engine
 */
export const DEFAULT_AI_PROCESSING_CONFIG: AIProcessingEngineConfig = {
  timeout: 30000,
  maxRetries: 3,
  enableCircuitBreaker: true,
  enableRateLimit: true,
  defaultModel: 'claude-3-sonnet-20240229',
  defaultTemperature: 0.1,
  defaultMaxTokens: 1000,
};