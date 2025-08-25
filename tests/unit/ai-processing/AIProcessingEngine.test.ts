/**
 * AI Processing Engine Tests - Comprehensive test suite for claude -p replacement
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { AIProcessingEngine, DEFAULT_AI_PROCESSING_CONFIG } from "../../../src/domain/ai-processing/engine/AIProcessingEngine.ts";
import type { TwoStageAnalysisConfig } from "../../../src/domain/ai-processing/types/analysis-types.ts";
import type { AIProcessingError } from "../../../src/domain/ai-processing/errors/AIProcessingError.ts";

// Mock interfaces and implementations
interface MockMetricsCollector {
  recordSuccess(operationName: string, duration: number): void;
  recordError(operationName: string, duration: number, error: AIProcessingError): void;
  getMetrics(operationName: string, options?: { period: number }): Promise<any[]>;
  getSuccessCount(operation: string): number;
  getErrorCount(operation: string): number;
}

interface MockStructuredLogger {
  info(message: string, context: Record<string, unknown>): void;
  error(message: string, context: Record<string, unknown>): void;
  debug(message: string, context: Record<string, unknown>): void;
  warn(message: string, context: Record<string, unknown>): void;
  getLogs(): Array<{ level: string; message: string; context: Record<string, unknown> }>;
}

class MockClaudeAPIClient {
  private stage1Response: any = null;
  private stage2Response: any = null;
  private shouldFailStage1 = false;
  private shouldFailStage2 = false;
  private rateLimitError = false;

  mockStage1Response(response: any) {
    this.stage1Response = response;
  }

  mockStage2Response(response: any) {
    this.stage2Response = response;
  }

  mockStage1Failure() {
    this.shouldFailStage1 = true;
  }

  mockStage2Failure() {
    this.shouldFailStage2 = true;
  }

  mockRateLimitError() {
    this.rateLimitError = true;
  }

  async sendMessage(request: any, responseSchema: any, traceId: string): Promise<any> {
    if (this.rateLimitError) {
      return {
        ok: false,
        error: {
          kind: 'APIRateLimitError',
          retryAfter: 60,
          requestsRemaining: 0,
          resetTime: new Date(Date.now() + 60000).toISOString(),
          traceId,
          requestId: 'test-request-id'
        }
      };
    }

    // Determine which stage based on request content
    const isStage1 = request.messages[0].content.includes('extract');
    
    if (isStage1) {
      if (this.shouldFailStage1) {
        return {
          ok: false,
          error: {
            kind: 'APIServerError',
            statusCode: 500,
            message: 'Stage 1 API error',
            retryable: false,
            traceId,
            requestId: 'test-request-id'
          }
        };
      }

      const mockData = this.stage1Response || { key: 'extracted-value', confidence: 0.9 };
      const validationResult = responseSchema.validate(mockData);
      return validationResult.ok ? { ok: true, data: mockData } : validationResult;
    } else {
      if (this.shouldFailStage2) {
        return {
          ok: false,
          error: {
            kind: 'APIServerError',
            statusCode: 500,
            message: 'Stage 2 API error',
            retryable: false,
            traceId,
            requestId: 'test-request-id'
          }
        };
      }

      const mockData = this.stage2Response || { 
        extractedData: { key: 'mapped-value' },
        confidence: 0.95,
        processingTime: 0
      };
      const validationResult = responseSchema.validate(mockData);
      return validationResult.ok ? { ok: true, data: mockData } : validationResult;
    }
  }
}

class TestMetricsCollector implements MockMetricsCollector {
  private successCounts = new Map<string, number>();
  private errorCounts = new Map<string, number>();
  private errors: AIProcessingError[] = [];

  recordSuccess(operationName: string, duration: number): void {
    this.successCounts.set(operationName, (this.successCounts.get(operationName) || 0) + 1);
  }

  recordError(operationName: string, duration: number, error: AIProcessingError): void {
    this.errorCounts.set(operationName, (this.errorCounts.get(operationName) || 0) + 1);
    this.errors.push(error);
  }

  async getMetrics(operationName: string): Promise<any[]> {
    return [];
  }

  getSuccessCount(operation: string): number {
    return this.successCounts.get(operation) || 0;
  }

  getErrorCount(operation: string): number {
    return this.errorCounts.get(operation) || 0;
  }

  getLastError(): AIProcessingError | undefined {
    return this.errors[this.errors.length - 1];
  }
}

class TestStructuredLogger implements MockStructuredLogger {
  private logs: Array<{ level: string; message: string; context: Record<string, unknown> }> = [];

  info(message: string, context: Record<string, unknown>): void {
    this.logs.push({ level: 'info', message, context });
  }

  error(message: string, context: Record<string, unknown>): void {
    this.logs.push({ level: 'error', message, context });
  }

  debug(message: string, context: Record<string, unknown>): void {
    this.logs.push({ level: 'debug', message, context });
  }

  warn(message: string, context: Record<string, unknown>): void {
    this.logs.push({ level: 'warn', message, context });
  }

  getLogs(): Array<{ level: string; message: string; context: Record<string, unknown> }> {
    return [...this.logs];
  }
}

class MockRateLimiter {
  private shouldFail = false;

  async acquire(): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Rate limit exceeded');
    }
  }

  getTokensRemaining(): number {
    return 100;
  }

  mockFailure() {
    this.shouldFail = true;
  }
}

class MockCircuitBreaker {
  private isOpenState = false;
  private failureCount = 0;

  isOpen(): boolean {
    return this.isOpenState;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.isOpenState = false;
  }

  recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= 5) {
      this.isOpenState = true;
    }
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  mockOpen() {
    this.isOpenState = true;
    this.failureCount = 5;
  }
}

// Test data and configurations
function createTestInput(): Record<string, unknown> {
  return {
    title: 'Test Document',
    author: 'Test Author',
    date: '2024-01-01',
    tags: ['test', 'mock']
  };
}

function createTestAnalysisConfig(): TwoStageAnalysisConfig<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>> {
  return {
    stage1: {
      prompt: {
        template: 'Extract information from: {{json}}',
        variables: {
          extract: (input: Record<string, unknown>, key: string) => 
            key === 'json' ? JSON.stringify(input) : input[key]
        },
        render: function(input: Record<string, unknown>) {
          return this.template.replace('{{json}}', JSON.stringify(input));
        }
      },
      schema: {
        name: 'ExtractedInfo',
        version: '1.0.0',
        validate: (data: unknown) => ({ ok: true, data: data as Record<string, unknown> }),
        describe: () => 'Test extraction schema'
      },
      options: {
        temperature: 0.1,
        maxTokens: 1000,
        timeout: 30000,
        retryCount: 3
      }
    },
    stage2: {
      prompt: {
        template: 'Map information: {{json}}',
        variables: {
          extract: (input: Record<string, unknown>, key: string) => 
            key === 'json' ? JSON.stringify(input) : input[key]
        },
        render: function(input: Record<string, unknown>) {
          return this.template.replace('{{json}}', JSON.stringify(input));
        }
      },
      schema: {
        name: 'MappedResult',
        version: '1.0.0',
        validate: (data: unknown) => ({ ok: true, data: data as Record<string, unknown> }),
        describe: () => 'Test mapping schema'
      },
      options: {
        temperature: 0.0,
        maxTokens: 800,
        timeout: 30000,
        retryCount: 3
      }
    }
  };
}

// Test Suite
Deno.test("AIProcessingEngine", async (t) => {
  let engine: AIProcessingEngine;
  let mockApiClient: MockClaudeAPIClient;
  let mockMetrics: TestMetricsCollector;
  let mockLogger: TestStructuredLogger;
  let mockRateLimiter: MockRateLimiter;
  let mockCircuitBreaker: MockCircuitBreaker;

  await t.step("setup", () => {
    mockApiClient = new MockClaudeAPIClient();
    mockMetrics = new TestMetricsCollector();
    mockLogger = new TestStructuredLogger();
    mockRateLimiter = new MockRateLimiter();
    mockCircuitBreaker = new MockCircuitBreaker();

    engine = new AIProcessingEngine(
      mockApiClient as any,
      DEFAULT_AI_PROCESSING_CONFIG,
      mockMetrics,
      mockLogger,
      mockRateLimiter as any,
      mockCircuitBreaker as any
    );
  });

  await t.step("should successfully process two-stage analysis", async () => {
    // Given
    const input = createTestInput();
    const config = createTestAnalysisConfig();

    mockApiClient.mockStage1Response({ extractedKey: 'extractedValue' });
    mockApiClient.mockStage2Response({ mappedKey: 'mappedValue' });

    // When
    const result = await engine.processTwoStageAnalysis(input, config);

    // Then
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.data.mappedKey, 'mappedValue');
    }

    assertEquals(mockMetrics.getSuccessCount('two_stage_analysis'), 1);
    assertEquals(mockMetrics.getSuccessCount('stage1_analysis'), 1);
    assertEquals(mockMetrics.getSuccessCount('stage2_analysis'), 1);

    const logs = mockLogger.getLogs();
    const infoLogs = logs.filter(log => log.level === 'info');
    assertEquals(infoLogs.length >= 2, true); // Should have start and complete logs
  });

  await t.step("should handle stage 1 API failure", async () => {
    // Given
    const input = createTestInput();
    const config = createTestAnalysisConfig();

    mockApiClient.mockStage1Failure();

    // When
    const result = await engine.processTwoStageAnalysis(input, config);

    // Then
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, 'APIServerError');
    }

    assertEquals(mockMetrics.getErrorCount('two_stage_analysis'), 1);
    assertEquals(mockMetrics.getSuccessCount('stage1_analysis'), 0);

    const lastError = mockMetrics.getLastError();
    assertExists(lastError);
    assertEquals(lastError.kind, 'APIServerError');
  });

  await t.step("should handle stage 2 API failure", async () => {
    // Given
    const input = createTestInput();
    const config = createTestAnalysisConfig();

    mockApiClient.mockStage1Response({ extractedKey: 'extractedValue' });
    mockApiClient.mockStage2Failure();

    // When
    const result = await engine.processTwoStageAnalysis(input, config);

    // Then
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, 'APIServerError');
    }

    assertEquals(mockMetrics.getErrorCount('two_stage_analysis'), 1);
    assertEquals(mockMetrics.getSuccessCount('stage1_analysis'), 1);
    assertEquals(mockMetrics.getSuccessCount('stage2_analysis'), 0);
  });

  await t.step("should handle rate limit errors", async () => {
    // Given
    const input = createTestInput();
    const config = createTestAnalysisConfig();

    mockApiClient.mockRateLimitError();

    // When
    const result = await engine.processTwoStageAnalysis(input, config);

    // Then
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, 'APIRateLimitError');
    }

    const logs = mockLogger.getLogs();
    const debugLogs = logs.filter(log => log.level === 'debug');
    // Should have retry logs
    assertEquals(debugLogs.some(log => log.message.includes('will retry')), true);
  });

  await t.step("should respect circuit breaker", async () => {
    // Given
    const input = createTestInput();
    const config = createTestAnalysisConfig();

    mockCircuitBreaker.mockOpen();

    // When
    const result = await engine.processTwoStageAnalysis(input, config);

    // Then
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, 'CircuitBreakerOpen');
    }

    const logs = mockLogger.getLogs();
    const warnLogs = logs.filter(log => log.level === 'warn');
    assertEquals(warnLogs.some(log => log.message.includes('Circuit breaker is open')), true);
  });

  await t.step("should handle rate limiter failures", async () => {
    // Given
    const input = createTestInput();
    const config = createTestAnalysisConfig();

    mockRateLimiter.mockFailure();

    // When
    const result = await engine.processTwoStageAnalysis(input, config);

    // Then
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.error.kind, 'NetworkError');
    }

    const logs = mockLogger.getLogs();
    const warnLogs = logs.filter(log => log.level === 'warn');
    assertEquals(warnLogs.some(log => log.message.includes('Rate limit acquisition failed')), true);
  });

  await t.step("should generate unique trace IDs", async () => {
    // Given
    const input = createTestInput();
    const config = createTestAnalysisConfig();

    mockApiClient.mockStage1Response({ extractedKey: 'extractedValue' });
    mockApiClient.mockStage2Response({ mappedKey: 'mappedValue' });

    // When
    const result1 = await engine.processTwoStageAnalysis(input, config);
    const result2 = await engine.processTwoStageAnalysis(input, config);

    // Then
    assertEquals(result1.ok, true);
    assertEquals(result2.ok, true);

    const logs = mockLogger.getLogs();
    const traceIds = logs.map(log => log.context.traceId).filter(Boolean);
    
    // Should have multiple unique trace IDs
    const uniqueTraceIds = new Set(traceIds);
    assertEquals(uniqueTraceIds.size >= 2, true);
  });
});

Deno.test("AIProcessingEngine Configuration", async (t) => {
  await t.step("should use default configuration values", () => {
    assertEquals(DEFAULT_AI_PROCESSING_CONFIG.timeout, 30000);
    assertEquals(DEFAULT_AI_PROCESSING_CONFIG.maxRetries, 3);
    assertEquals(DEFAULT_AI_PROCESSING_CONFIG.enableCircuitBreaker, true);
    assertEquals(DEFAULT_AI_PROCESSING_CONFIG.enableRateLimit, true);
    assertEquals(DEFAULT_AI_PROCESSING_CONFIG.defaultModel, 'claude-3-sonnet-20240229');
    assertEquals(DEFAULT_AI_PROCESSING_CONFIG.defaultTemperature, 0.1);
    assertEquals(DEFAULT_AI_PROCESSING_CONFIG.defaultMaxTokens, 1000);
  });

  await t.step("should allow custom configuration", () => {
    const customConfig = {
      ...DEFAULT_AI_PROCESSING_CONFIG,
      timeout: 60000,
      maxRetries: 5,
      defaultModel: 'claude-3-opus-20240229'
    };

    assertEquals(customConfig.timeout, 60000);
    assertEquals(customConfig.maxRetries, 5);
    assertEquals(customConfig.defaultModel, 'claude-3-opus-20240229');
  });
});