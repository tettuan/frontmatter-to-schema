/**
 * Claude API Client - HTTP-based replacement for claude -p command
 * Provides type-safe communication with Claude API
 */

import type { Result } from "../../../domain/shared/types.ts";
import type {
  ClaudeMessageRequest,
  HTTPRequest,
  HTTPResponse,
} from "../../../domain/ai-processing/types/analysis-types.ts";
import type {
  APIError,
  APIRateLimitError,
  APIAuthError,
  APIServerError,
  APITimeoutError,
} from "../../../domain/ai-processing/errors/AIProcessingError.ts";
import {
  createAPIRateLimitError,
  formatErrorMessage,
} from "../../../domain/ai-processing/errors/AIProcessingError.ts";

/**
 * Claude API Configuration
 */
export interface ClaudeAPIConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly apiVersion: string;
  readonly timeout: number;
  readonly maxConnections: number;
  readonly defaultModel: string;
  readonly defaultMaxTokens: number;
}

/**
 * HTTP Client interface for dependency injection
 */
export interface TypeSafeHttpClient {
  send(request: HTTPRequest): Promise<Result<HTTPResponse, NetworkError>>;
}

/**
 * HTTP Connection Pool interface
 */
export interface HTTPConnectionPool {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  getActiveConnections(): number;
  getMaxConnections(): number;
}

/**
 * Network error type
 */
interface NetworkError {
  readonly kind: 'NetworkError';
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
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
 * Claude API response structure
 */
interface ClaudeAPIResponse {
  readonly id: string;
  readonly type: 'message';
  readonly role: 'assistant';
  readonly content: Array<{
    type: 'text';
    text: string;
  }>;
  readonly model: string;
  readonly stop_reason: string;
  readonly stop_sequence: string | null;
  readonly usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Claude API Client Implementation
 * Replaces claude -p with direct HTTP API calls
 */
export class ClaudeAPIClient {
  private readonly connectionPool: HTTPConnectionPool;

  constructor(
    private readonly config: ClaudeAPIConfig,
    private readonly httpClient: TypeSafeHttpClient,
    private readonly logger: StructuredLogger,
    connectionPool: HTTPConnectionPool
  ) {
    this.connectionPool = connectionPool;
  }

  /**
   * Send message to Claude API - core replacement for claude -p
   */
  async sendMessage<TRequest, TResponse>(
    request: ClaudeMessageRequest<TRequest>,
    responseSchema: { validate(data: unknown): Result<TResponse, any> },
    traceId: string
  ): Promise<Result<TResponse, APIError>> {
    const requestId = this.generateRequestId();
    
    this.logger.debug('Sending Claude API request', {
      traceId,
      requestId,
      model: request.model || this.config.defaultModel,
      messageCount: request.messages.length,
    });

    try {
      // Build HTTP request
      const httpRequest = this.buildHttpRequest(request, traceId, requestId);

      // Execute with connection pooling
      const httpResponse = await this.connectionPool.execute(
        () => this.httpClient.send(httpRequest)
      );

      if (!httpResponse.ok) {
        return this.handleHttpError(httpResponse.error, traceId, requestId);
      }

      // Parse and validate Claude API response
      const apiResponse = await this.parseClaudeResponse(httpResponse.data, traceId, requestId);
      if (!apiResponse.ok) {
        return apiResponse;
      }

      // Extract text content from Claude response
      const textContent = this.extractTextContent(apiResponse.data);
      
      // Validate against provided schema
      const validationResult = responseSchema.validate(textContent);
      if (!validationResult.ok) {
        this.logger.error('Response validation failed', {
          traceId,
          requestId,
          validationError: validationResult.error,
        });

        return {
          ok: false,
          error: {
            kind: 'InvalidResponseFormat',
            received: textContent,
            expected: 'Valid response matching provided schema',
            traceId,
            requestId,
          }
        };
      }

      this.logger.debug('Claude API request successful', {
        traceId,
        requestId,
        responseTokens: apiResponse.data.usage.output_tokens,
      });

      return { ok: true, data: validationResult.data };

    } catch (error) {
      this.logger.error('Claude API request failed with unexpected error', {
        traceId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        ok: false,
        error: {
          kind: 'APIServerError',
          statusCode: 500,
          message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
          retryable: false,
          traceId,
          requestId,
        }
      };
    }
  }

  /**
   * Build HTTP request for Claude API
   */
  private buildHttpRequest<T>(
    request: ClaudeMessageRequest<T>,
    traceId: string,
    requestId: string
  ): HTTPRequest {
    const requestBody = {
      model: request.model || this.config.defaultModel,
      max_tokens: request.maxTokens || this.config.defaultMaxTokens,
      temperature: request.temperature ?? 0.1,
      messages: request.messages,
      ...(request.systemPrompt && { system: request.systemPrompt }),
    };

    return {
      method: 'POST',
      url: `${this.config.baseUrl}/messages`,
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.apiVersion,
        'content-type': 'application/json',
        'x-trace-id': traceId,
        'x-request-id': requestId,
        'user-agent': 'frontmatter-to-schema-typescript/1.0.0',
      },
      body: JSON.stringify(requestBody),
      timeout: this.config.timeout,
    };
  }

  /**
   * Parse Claude API response with error handling
   */
  private async parseClaudeResponse(
    responseData: unknown,
    traceId: string,
    requestId: string
  ): Promise<Result<ClaudeAPIResponse, APIError>> {
    try {
      // Basic structure validation
      if (!responseData || typeof responseData !== 'object') {
        return {
          ok: false,
          error: {
            kind: 'InvalidResponseFormat',
            received: responseData,
            expected: 'Claude API response object',
            traceId,
            requestId,
          }
        };
      }

      const response = responseData as Record<string, unknown>;

      // Check for error response
      if (response.type === 'error') {
        return this.handleClaudeErrorResponse(response, traceId, requestId);
      }

      // Validate required fields
      const requiredFields = ['id', 'type', 'role', 'content', 'model', 'usage'];
      for (const field of requiredFields) {
        if (!(field in response)) {
          return {
            ok: false,
            error: {
              kind: 'InvalidResponseFormat',
              received: responseData,
              expected: `Claude API response with field: ${field}`,
              traceId,
              requestId,
            }
          };
        }
      }

      // Additional validation for content array
      if (!Array.isArray(response.content) || response.content.length === 0) {
        return {
          ok: false,
          error: {
            kind: 'InvalidResponseFormat',
            received: responseData,
            expected: 'Claude API response with non-empty content array',
            traceId,
            requestId,
          }
        };
      }

      return { ok: true, data: response as unknown as ClaudeAPIResponse };

    } catch (error) {
      return {
        ok: false,
        error: {
          kind: 'InvalidResponseFormat',
          received: responseData,
          expected: 'Valid JSON Claude API response',
          traceId,
          requestId,
        }
      };
    }
  }

  /**
   * Handle Claude API error responses
   */
  private handleClaudeErrorResponse(
    errorResponse: Record<string, unknown>,
    traceId: string,
    requestId: string
  ): Result<ClaudeAPIResponse, APIError> {
    const error = errorResponse.error as Record<string, unknown>;
    const errorType = error?.type as string;
    const message = error?.message as string || 'Unknown Claude API error';

    switch (errorType) {
      case 'rate_limit_error':
        const retryAfter = this.parseRetryAfter(error);
        return {
          ok: false,
          error: createAPIRateLimitError(
            retryAfter,
            0, // requests remaining unknown
            new Date(Date.now() + retryAfter * 1000).toISOString(),
            traceId,
            requestId
          )
        };

      case 'authentication_error':
        return {
          ok: false,
          error: {
            kind: 'APIAuthError',
            statusCode: 401,
            message,
            traceId,
            requestId,
          }
        };

      case 'permission_error':
        return {
          ok: false,
          error: {
            kind: 'APIAuthError',
            statusCode: 403,
            message,
            traceId,
            requestId,
          }
        };

      default:
        return {
          ok: false,
          error: {
            kind: 'APIServerError',
            statusCode: 400,
            message: `Claude API error (${errorType}): ${message}`,
            retryable: false,
            traceId,
            requestId,
          }
        };
    }
  }

  /**
   * Handle HTTP-level errors
   */
  private handleHttpError(
    networkError: NetworkError,
    traceId: string,
    requestId: string
  ): Result<never, APIError> {
    this.logger.error('HTTP request failed', {
      traceId,
      requestId,
      networkError: formatErrorMessage(networkError as any),
    });

    // Map network errors to API errors
    if (networkError.code === 'TIMEOUT') {
      return {
        ok: false,
        error: {
          kind: 'APITimeoutError',
          timeoutMs: this.config.timeout,
          operation: 'claude_api_request',
          traceId,
        }
      };
    }

    return {
      ok: false,
      error: {
        kind: 'APIServerError',
        statusCode: 500,
        message: `Network error: ${networkError.message}`,
        retryable: networkError.retryable,
        traceId,
        requestId,
      }
    };
  }

  /**
   * Extract text content from Claude response
   */
  private extractTextContent(response: ClaudeAPIResponse): string {
    return response.content
      .filter(content => content.type === 'text')
      .map(content => content.text)
      .join('\n')
      .trim();
  }

  /**
   * Parse retry-after value from rate limit error
   */
  private parseRetryAfter(error: Record<string, unknown>): number {
    const retryAfter = error.retry_after;
    if (typeof retryAfter === 'number' && retryAfter > 0) {
      return retryAfter;
    }
    return 60; // Default 1 minute retry delay
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }
}

/**
 * Default Claude API configuration
 */
export const DEFAULT_CLAUDE_API_CONFIG: ClaudeAPIConfig = {
  baseUrl: 'https://api.anthropic.com/v1',
  apiKey: '', // Must be provided by environment
  apiVersion: '2023-06-01',
  timeout: 30000,
  maxConnections: 10,
  defaultModel: 'claude-3-sonnet-20240229',
  defaultMaxTokens: 1000,
};