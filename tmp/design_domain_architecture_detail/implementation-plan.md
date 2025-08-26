# TypeScript Claude Replacement - 実装計画書

## 1. 実装ロードマップ

### Phase 1: 基盤構築 (Week 1-2)

#### 1.1 コアドメイン実装

**src/domain/ai-processing/**

```
├── engine/
│   ├── AIProcessingEngine.ts           # メイン処理エンジン
│   ├── TwoStageAnalysisConfig.ts       # 設定型定義
│   └── PromptTemplate.ts               # プロンプト管理
├── errors/
│   ├── AIProcessingError.ts            # エラー型定義
│   └── error-factories.ts              # エラー生成関数
└── types/
    ├── analysis-types.ts               # 解析関連型
    └── api-types.ts                    # API関連型
```

#### 1.2 インフラストラクチャ層実装

**src/infrastructure/ai-processing/**

```
├── clients/
│   ├── ClaudeAPIClient.ts              # Claude API通信
│   ├── TypeSafeHttpClient.ts           # HTTP通信基盤
│   └── api-adapters.ts                 # APIアダプター
├── config/
│   ├── AIProcessingConfig.ts           # AI処理設定
│   └── environment-config.ts           # 環境設定
└── monitoring/
    ├── MetricsCollector.ts             # メトリクス収集
    └── StructuredLogger.ts             # ログ出力
```

### Phase 2: 既存機能移行 (Week 3-5)

#### 2.1 claude-client.ts の移行

**移行対象メソッド:**

1. `analyzeFrontMatter()` → `TypeScriptFrontMatterAnalyzer.analyzeFrontMatter()`
2. `mapToSchema()` → `TypeScriptSchemaMapper.mapToSchema()`

**実装ファイル:**

- `src/application/ai-processing/TypeScriptFrontMatterAnalyzer.ts`
- `src/application/ai-processing/TypeScriptSchemaMapper.ts`

#### 2.2 ai-analysis-orchestrator.ts の移行

**移行対象コンポーネント:**

1. 2段階AI解析オーケストレーション
2. プロンプト管理システム
3. 結果統合ロジック

**実装ファイル:**

- `src/domain/ai-processing/orchestrators/TypeScriptAnalysisOrchestrator.ts`

#### 2.3 climpt-adapter.ts の移行

**移行対象機能:**

1. Climptコマンド統合
2. バッチ処理機能

### Phase 3: 最適化と完成 (Week 6)

#### 3.1 パフォーマンス最適化

- HTTP接続プール実装
- リクエストバッチング
- キャッシュ機構

#### 3.2 監視・観測機能

- メトリクス収集
- 分散トレーシング
- 構造化ログ

## 2. 詳細実装仕様

### 2.1 AIProcessingEngine コア実装

```typescript
export class AIProcessingEngine {
  private readonly rateLimiter: RateLimiter;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly apiClient: ClaudeAPIClient,
    private readonly config: AIProcessingConfig,
    private readonly metrics: MetricsCollector,
    private readonly logger: StructuredLogger,
  ) {
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  }

  async processTwoStageAnalysis<TInput, TIntermediate, TOutput>(
    input: TInput,
    config: TwoStageAnalysisConfig<TInput, TIntermediate, TOutput>,
  ): Promise<Result<TOutput, AIProcessingError>> {
    const traceId = generateTraceId();
    const startTime = Date.now();

    this.logger.info("Starting two-stage analysis", {
      traceId,
      stage: "begin",
    });

    try {
      // Rate limiting
      await this.rateLimiter.acquire();

      // Circuit breaker check
      if (this.circuitBreaker.isOpen()) {
        return this.createError("CircuitBreakerOpen", { traceId });
      }

      // Stage 1: Information extraction
      const stage1Result = await this.executeStage1Analysis(
        input,
        config.stage1,
        traceId,
      );
      if (!stage1Result.ok) {
        this.circuitBreaker.recordFailure();
        return stage1Result;
      }

      // Stage 2: Template application
      const stage2Result = await this.executeStage2Analysis(
        stage1Result.data,
        config.stage2,
        traceId,
      );

      if (!stage2Result.ok) {
        this.circuitBreaker.recordFailure();
        return stage2Result;
      }

      // Success metrics
      const duration = Date.now() - startTime;
      this.metrics.recordSuccess("two_stage_analysis", duration);
      this.circuitBreaker.recordSuccess();

      this.logger.info("Two-stage analysis completed", {
        traceId,
        duration,
        stage: "complete",
      });

      return stage2Result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.recordError("two_stage_analysis", duration);
      this.circuitBreaker.recordFailure();

      this.logger.error("Two-stage analysis failed", {
        traceId,
        error: error.message,
        duration,
      });

      return this.handleUnexpectedError(error, traceId);
    }
  }
}
```

### 2.2 ClaudeAPIClient 実装

```typescript
export class ClaudeAPIClient {
  private readonly connectionPool: HTTPConnectionPool;

  constructor(
    private readonly config: ClaudeAPIConfig,
    private readonly httpClient: TypeSafeHttpClient,
    private readonly logger: StructuredLogger,
  ) {
    this.connectionPool = new HTTPConnectionPool({
      maxConnections: config.maxConnections,
      keepAlive: true,
      timeout: config.timeout,
    });
  }

  async sendMessage<TRequest, TResponse>(
    request: ClaudeMessageRequest<TRequest>,
    responseSchema: SchemaDefinition<TResponse>,
    traceId: string,
  ): Promise<Result<TResponse, APIError>> {
    const requestId = generateRequestId();
    this.logger.debug("Sending Claude API request", { traceId, requestId });

    try {
      // Prepare request
      const httpRequest = this.buildHttpRequest(request, traceId, requestId);

      // Send request with connection pooling
      const response = await this.connectionPool.execute(
        () => this.httpClient.send(httpRequest),
      );

      if (!response.ok) {
        return this.handleHttpError(response.error, traceId, requestId);
      }

      // Validate and parse response
      const validationResult = responseSchema.validate(response.data);
      if (!validationResult.ok) {
        return {
          ok: false,
          error: {
            kind: "InvalidResponseFormat",
            received: response.data,
            expected: responseSchema.description,
            traceId,
            requestId,
          },
        };
      }

      this.logger.debug("Claude API request successful", {
        traceId,
        requestId,
      });
      return { ok: true, data: validationResult.data };
    } catch (error) {
      this.logger.error("Claude API request failed", {
        traceId,
        requestId,
        error: error.message,
      });

      return {
        ok: false,
        error: {
          kind: "UnexpectedError",
          message: error.message,
          traceId,
          requestId,
        },
      };
    }
  }

  private buildHttpRequest<T>(
    request: ClaudeMessageRequest<T>,
    traceId: string,
    requestId: string,
  ): HTTPRequest {
    return {
      method: "POST",
      url: `${this.config.baseUrl}/messages`,
      headers: {
        "x-api-key": this.config.apiKey,
        "content-type": "application/json",
        "anthropic-version": this.config.apiVersion,
        "x-trace-id": traceId,
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        model: request.model || this.config.defaultModel,
        messages: request.messages,
        max_tokens: request.maxTokens || this.config.defaultMaxTokens,
        temperature: request.temperature ?? 0.1,
      }),
      timeout: this.config.timeout,
    };
  }
}
```

### 2.3 エラーハンドリング体系

```typescript
// 全域性原則によるエラー型定義
export type AIProcessingError =
  | NetworkError
  | APIError
  | ValidationError
  | BusinessLogicError;

export type NetworkError = {
  kind: "NetworkError";
  details: {
    code: string;
    message: string;
    retryable: boolean;
  };
  traceId: string;
};

export type APIError = {
  kind: "APIRateLimitError" | "APIAuthError" | "APIServerError";
  statusCode: number;
  retryAfter?: number;
  traceId: string;
  requestId: string;
};

export type ValidationError = {
  kind:
    | "InvalidRequestFormat"
    | "InvalidResponseFormat"
    | "SchemaValidationError";
  received: unknown;
  expected: string;
  traceId: string;
};

export type BusinessLogicError = {
  kind:
    | "PromptRenderingError"
    | "TemplateApplicationError"
    | "CircuitBreakerOpen";
  context: Record<string, unknown>;
  traceId: string;
};

// エラーファクトリー
export function createNetworkError(
  code: string,
  message: string,
  retryable: boolean,
  traceId: string,
): NetworkError {
  return {
    kind: "NetworkError",
    details: { code, message, retryable },
    traceId,
  };
}
```

## 3. テスト戦略詳細

### 3.1 単体テスト構成

```typescript
// AIProcessingEngine テスト
describe("AIProcessingEngine", () => {
  let engine: AIProcessingEngine;
  let mockApiClient: MockClaudeAPIClient;
  let mockMetrics: MockMetricsCollector;

  beforeEach(() => {
    mockApiClient = new MockClaudeAPIClient();
    mockMetrics = new MockMetricsCollector();
    engine = new AIProcessingEngine(
      mockApiClient,
      createTestConfig(),
      mockMetrics,
      createTestLogger(),
    );
  });

  describe("processTwoStageAnalysis", () => {
    it("should successfully process valid input", async () => {
      // Given
      const input = createTestFrontMatterContent();
      const config = createTestAnalysisConfig();

      mockApiClient.mockStage1Response(createMockStage1Response());
      mockApiClient.mockStage2Response(createMockStage2Response());

      // When
      const result = await engine.processTwoStageAnalysis(input, config);

      // Then
      expect(result.ok).toBe(true);
      expect(result.data).toMatchSchema(ExpectedOutputSchema);
      expect(mockMetrics.getSuccessCount("two_stage_analysis")).toBe(1);
    });

    it("should handle API rate limit errors", async () => {
      // Given
      const input = createTestFrontMatterContent();
      const config = createTestAnalysisConfig();

      mockApiClient.mockRateLimitError(60); // 60 seconds retry-after

      // When
      const result = await engine.processTwoStageAnalysis(input, config);

      // Then
      expect(result.ok).toBe(false);
      expect(result.error.kind).toBe("APIRateLimitError");
      expect(result.error.retryAfter).toBe(60);
    });
  });
});
```

### 3.2 統合テスト構成

```typescript
// End-to-end migration test
describe("Claude SDK Migration Integration", () => {
  let oldImplementation: ClaudeClient;
  let newImplementation: TypeScriptFrontMatterAnalyzer;

  beforeAll(() => {
    oldImplementation = new ClaudeClient();
    newImplementation = createNewImplementation();
  });

  it("should produce equivalent results for frontmatter analysis", async () => {
    const testCases = await loadTestCases("frontmatter-analysis");

    for (const testCase of testCases) {
      // Skip claude -p if not available in CI
      if (process.env.CI && !process.env.CLAUDE_API_KEY) {
        continue;
      }

      // Old implementation
      const oldResult = await oldImplementation.analyzeFrontMatter(
        testCase.input,
      );

      // New implementation
      const newResult = await newImplementation.analyzeFrontMatter(
        FrontMatterContent.fromString(testCase.input),
      );

      // Compare results (with tolerance for AI variance)
      expect(newResult.ok).toBe(true);
      expect(normalizeAnalysisResult(newResult.data))
        .toBeEquivalentTo(normalizeAnalysisResult(oldResult));
    }
  });
});
```

## 4. 段階的デプロイメント計画

### 4.1 Feature Flag 実装

```typescript
export class AIProcessingFeatureFlags {
  constructor(private config: FeatureFlagConfig) {}

  shouldUseTypeScriptImplementation(operation: string): boolean {
    const flagKey = `typescript_ai_${operation}`;
    return this.config.isEnabled(flagKey);
  }
}

// 使用例: 段階的移行
export class MigrationAwareAnalyzer {
  constructor(
    private oldImplementation: ClaudeClient,
    private newImplementation: TypeScriptFrontMatterAnalyzer,
    private featureFlags: AIProcessingFeatureFlags,
  ) {}

  async analyzeFrontMatter(content: string): Promise<any> {
    if (
      this.featureFlags.shouldUseTypeScriptImplementation(
        "frontmatter_analysis",
      )
    ) {
      return this.newImplementation.analyzeFrontMatter(
        FrontMatterContent.fromString(content),
      );
    }

    return this.oldImplementation.analyzeFrontMatter(content);
  }
}
```

### 4.2 カナリア デプロイメント

```typescript
// カナリア デプロイメント設定
export interface CanaryConfig {
  rolloutPercentage: number; // 0-100
  successThreshold: number; // 成功率閾値
  errorThreshold: number; // エラー率閾値
  monitoringPeriod: number; // 監視期間 (minutes)
}

export class CanaryDeploymentManager {
  constructor(
    private config: CanaryConfig,
    private metrics: MetricsCollector,
  ) {}

  shouldUseNewImplementation(): boolean {
    const random = Math.random() * 100;
    return random < this.config.rolloutPercentage;
  }

  async evaluateCanaryHealth(): Promise<CanaryHealthStatus> {
    const metrics = await this.metrics.getMetrics("typescript_ai", {
      period: this.config.monitoringPeriod * 60 * 1000,
    });

    const successRate = metrics.successCount /
      (metrics.successCount + metrics.errorCount);
    const errorRate = metrics.errorCount /
      (metrics.successCount + metrics.errorCount);

    if (
      successRate >= this.config.successThreshold &&
      errorRate <= this.config.errorThreshold
    ) {
      return "Healthy";
    }

    return "Unhealthy";
  }
}
```

## 5. 実装チェックリスト

### Phase 1: 基盤構築

- [ ] `AIProcessingEngine` コア実装
- [ ] `ClaudeAPIClient` HTTP通信層
- [ ] エラー型定義とファクトリー
- [ ] 基本設定管理
- [ ] メトリクス収集基盤
- [ ] 構造化ログ機能
- [ ] 単体テストスイート (80%+ coverage)

### Phase 2: 機能移行

- [ ] `TypeScriptFrontMatterAnalyzer` 実装
- [ ] `TypeScriptSchemaMapper` 実装
- [ ] `TypeScriptAnalysisOrchestrator` 実装
- [ ] Climpt統合の移行
- [ ] 後方互換性アダプター
- [ ] 統合テストスイート
- [ ] パフォーマンス回帰テスト

### Phase 3: 最適化

- [ ] HTTP接続プール実装
- [ ] レスポンスキャッシュ機構
- [ ] サーキットブレーカー実装
- [ ] レート制限機構
- [ ] 分散トレーシング
- [ ] Feature Flag システム
- [ ] カナリア デプロイメント機構

### Phase 4: 完成

- [ ] 全ての`claude -p`呼び出し削除
- [ ] ドキュメント更新
- [ ] 性能ベンチマーク完了
- [ ] 本番環境デプロイメント
- [ ] 監視ダッシュボード完成

## 6. 成功指標

### 技術指標

- ✅ TypeScript化率: 100%
- ✅ 外部プロセス依存: 0個
- ✅ テストカバレッジ: 90%+
- ✅ 型安全性: 100%

### パフォーマンス指標

- ✅ レスポンス時間改善: 30%+
- ✅ メモリ使用量削減: 20%+
- ✅ エラー率削減: 90%+
- ✅ 可用性: 99.9%+

### 品質指標

- ✅ 静的解析エラー: 0個
- ✅ セキュリティ脆弱性: 0個
- ✅ パフォーマンス回帰: 0個
- ✅ 機能回帰: 0個

このマイグレーション完了により、Issue
#366の要求を満たし、より堅牢で保守しやすいAI処理基盤を実現します。
