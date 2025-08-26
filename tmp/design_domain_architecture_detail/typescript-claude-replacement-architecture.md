# TypeScript Claude SDK Replacement Architecture

## エグゼクティブサマリー

Issue
#366に対応し、現在の`claude -p`外部コマンド依存を廃止し、完全なTypeScript実装による内部AI処理システムを設計します。既存の2段階AI解析フローを維持しながら、型安全性とパフォーマンスを向上させます。

## 1. 現状分析

### 1.1 現在のclaude -p使用箇所

- `src/claude-client.ts`: フロントマター解析とスキーママッピング
- `src/application/climpt/climpt-adapter.ts`: Climptコマンド処理
- `src/domain/core/ai-analysis-orchestrator.ts`: 2段階AI解析オーケストレーション

### 1.2 外部依存の問題点

1. **外部プロセス依存**: コマンドライン実行による遅延とエラーリスク
2. **型安全性欠如**: 文字列ベースの入出力でコンパイル時検証なし
3. **デバッグ困難**: 外部プロセスのトレーシング困難
4. **テスト複雑性**: 外部コマンドのモッキングが複雑

## 2. 新アーキテクチャ設計

### 2.1 コアドメイン: TypeScript AI Processing Domain

#### 2.1.1 集約ルート: AIProcessingEngine

```typescript
/**
 * AI処理エンジン - claude -p の完全TypeScript置換
 * 全域性原則に基づく型安全な実装
 */
export class AIProcessingEngine {
  constructor(
    private readonly httpClient: TypeSafeHttpClient,
    private readonly configManager: ConfigurationManager,
    private readonly logger: StructuredLogger,
  ) {}

  /**
   * 2段階AI解析の実行 (claude -p 1st + 2nd call equivalent)
   */
  async processTwoStageAnalysis<TInput, TIntermediate, TOutput>(
    input: TInput,
    config: TwoStageAnalysisConfig<TInput, TIntermediate, TOutput>,
  ): Promise<Result<TOutput, AIProcessingError>> {
    // Stage 1: 情報抽出 (claude -p 1st call equivalent)
    const stage1Result = await this.executeStage1Analysis(input, config.stage1);
    if (!stage1Result.ok) {
      return stage1Result;
    }

    // Stage 2: テンプレート当て込み (claude -p 2nd call equivalent)
    const stage2Result = await this.executeStage2Analysis(
      stage1Result.data,
      config.stage2,
    );

    return stage2Result;
  }
}
```

#### 2.1.2 値オブジェクト: 型安全な設定

```typescript
/**
 * AI解析設定 - 従来のclaude -pパラメータのTypeScript化
 */
export interface TwoStageAnalysisConfig<TInput, TIntermediate, TOutput> {
  stage1: {
    prompt: PromptTemplate<TInput>;
    schema: SchemaDefinition<TIntermediate>;
    options: AnalysisOptions;
  };
  stage2: {
    prompt: PromptTemplate<TIntermediate>;
    schema: SchemaDefinition<TOutput>;
    template: OutputTemplate<TOutput>;
    options: AnalysisOptions;
  };
}

/**
 * プロンプトテンプレート - 型安全なプロンプト管理
 */
export class PromptTemplate<T> {
  constructor(
    private readonly template: string,
    private readonly variables: PromptVariables<T>,
  ) {}

  render(input: T): string {
    return this.template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.variables.extract(input, key);
      return String(value);
    });
  }
}
```

### 2.2 インフラストラクチャ層: HTTP通信アダプター

#### 2.2.1 Claude API TypeScript Client

```typescript
/**
 * Claude APIクライアント - claude -pの内部化
 */
export class ClaudeAPIClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly httpClient: TypeSafeHttpClient,
  ) {}

  async sendMessage<TRequest, TResponse>(
    request: ClaudeMessageRequest<TRequest>,
    responseSchema: SchemaDefinition<TResponse>,
  ): Promise<Result<TResponse, APIError>> {
    const httpRequest: HTTPRequest = {
      method: "POST",
      url: `${this.baseUrl}/messages`,
      headers: {
        "x-api-key": this.apiKey,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: this.serializeRequest(request),
    };

    const response = await this.httpClient.send(httpRequest);
    if (!response.ok) {
      return this.handleHttpError(response.error);
    }

    // 型安全なレスポンス解析
    return this.parseResponse(response.data, responseSchema);
  }
}
```

#### 2.2.2 エラーハンドリング強化

```typescript
/**
 * AI処理エラー - 全域性原則によるエラー型定義
 */
export type AIProcessingError =
  | { kind: "NetworkError"; details: NetworkErrorDetails }
  | { kind: "APIRateLimitError"; retryAfter: number }
  | { kind: "InvalidResponseFormat"; received: unknown; expected: string }
  | { kind: "PromptRenderingError"; template: string; variables: unknown }
  | { kind: "SchemaValidationError"; schema: unknown; data: unknown }
  | { kind: "TimeoutError"; duration: number; operation: string };

export function createDomainError(error: AIProcessingError): DomainError {
  return {
    ...error,
    message: formatErrorMessage(error),
    timestamp: new Date().toISOString(),
    domain: "AIProcessing",
  };
}
```

### 2.3 アプリケーション層: 使用例の移行

#### 2.3.1 FrontMatter解析の移行

```typescript
// Before: claude -p依存
class OldClaudeClient {
  async analyzeFrontMatter(content: string): Promise<any> {
    const command = `claude -p "${promptFile}" <<< "${content}"`;
    return execCommand(command); // 外部プロセス実行
  }
}

// After: TypeScript実装
class TypeScriptFrontMatterAnalyzer {
  constructor(private aiEngine: AIProcessingEngine) {}

  async analyzeFrontMatter(
    content: FrontMatterContent,
  ): Promise<Result<FrontMatterAnalysisResult, AIProcessingError>> {
    const config: TwoStageAnalysisConfig<
      FrontMatterContent,
      ExtractedInfo,
      FrontMatterAnalysisResult
    > = {
      stage1: {
        prompt: this.createExtractionPrompt(),
        schema: ExtractedInfoSchema,
        options: { temperature: 0.1, maxTokens: 1000 },
      },
      stage2: {
        prompt: this.createTemplatePrompt(),
        schema: FrontMatterAnalysisResultSchema,
        template: DefaultOutputTemplate,
        options: { temperature: 0.0, maxTokens: 500 },
      },
    };

    return await this.aiEngine.processTwoStageAnalysis(content, config);
  }
}
```

### 2.4 ドメインサービス: 分析パイプライン統合

#### 2.4.1 統合オーケストレーター

```typescript
/**
 * 分析パイプライン - claude -p 2段階処理の完全移行
 */
export class TypeScriptAnalysisPipeline {
  constructor(
    private readonly frontMatterAnalyzer: TypeScriptFrontMatterAnalyzer,
    private readonly schemaMapper: TypeScriptSchemaMapper,
    private readonly templateApplier: TypeScriptTemplateApplier,
  ) {}

  async processDocument(
    document: MarkdownDocument,
    config: DocumentProcessingConfig,
  ): Promise<Result<ProcessedDocument, DomainError>> {
    // Stage 1: フロントマター抽出と解析
    const analysisResult = await this.frontMatterAnalyzer.analyzeFrontMatter(
      document.frontMatter,
    );
    if (!analysisResult.ok) {
      return { ok: false, error: createDomainError(analysisResult.error) };
    }

    // Stage 2: スキーママッピング
    const mappingResult = await this.schemaMapper.mapToSchema(
      analysisResult.data,
      config.targetSchema,
    );
    if (!mappingResult.ok) {
      return { ok: false, error: createDomainError(mappingResult.error) };
    }

    // Stage 3: テンプレート適用
    const templateResult = await this.templateApplier.applyTemplate(
      mappingResult.data,
      config.outputTemplate,
    );
    if (!templateResult.ok) {
      return { ok: false, error: createDomainError(templateResult.error) };
    }

    return {
      ok: true,
      data: new ProcessedDocument(document.path, templateResult.data),
    };
  }
}
```

## 3. マイグレーション戦略

### 3.1 段階的移行計画

#### Phase 1: 基盤構築 (1-2週間)

1. `AIProcessingEngine`コア実装
2. `ClaudeAPIClient`HTTP通信層
3. エラーハンドリング体系
4. 基本テストスイート

#### Phase 2: 既存機能移行 (2-3週間)

1. `claude-client.ts`の移行
2. `ai-analysis-orchestrator.ts`の移行
3. `climpt-adapter.ts`の移行
4. 統合テストとパフォーマンス検証

#### Phase 3: 最適化と完成 (1週間)

1. パフォーマンス最適化
2. エラーハンドリング強化
3. ドキュメント更新
4. 最終動作確認

### 3.2 互換性保証

```typescript
/**
 * 後方互換性アダプター - 既存インターフェース保持
 */
export class BackwardCompatibilityAdapter {
  constructor(private newEngine: AIProcessingEngine) {}

  // 既存のclaudeCLientインターフェースを維持
  async analyzeFrontMatter(content: string): Promise<any> {
    const frontMatter = FrontMatterContent.fromString(content);
    const result = await this.newEngine.processTwoStageAnalysis(
      frontMatter,
      DefaultAnalysisConfig,
    );

    return result.ok ? result.data : null; // 既存の戻り値形式を維持
  }
}
```

## 4. テスト戦略

### 4.1 単体テスト

```typescript
describe("AIProcessingEngine", () => {
  it("should process two-stage analysis successfully", async () => {
    // Given
    const engine = new AIProcessingEngine(
      mockHttpClient,
      mockConfig,
      mockLogger,
    );
    const input = createTestFrontMatter();
    const config = createTestAnalysisConfig();

    // When
    const result = await engine.processTwoStageAnalysis(input, config);

    // Then
    expect(result.ok).toBe(true);
    expect(result.data).toMatchSchema(ExpectedOutputSchema);
  });
});
```

### 4.2 統合テスト

```typescript
describe("Claude SDK Migration Integration", () => {
  it("should produce identical results to claude -p", async () => {
    // Given: 既存のclaude -pと同じ入力
    const testCases = loadClaudeSDKTestCases();

    for (const testCase of testCases) {
      // When: 新実装で処理
      const newResult = await newTypeScriptImplementation.process(
        testCase.input,
      );

      // Then: claude -pと同等の結果
      expect(newResult).toBeEquivalentTo(testCase.expectedOutput);
    }
  });
});
```

## 5. パフォーマンス改善

### 5.1 期待される改善点

1. **レスポンス時間**: 外部プロセス起動オーバーヘッド削除 → 30-50%短縮
2. **メモリ使用量**: プロセス間通信削除 → 20-30%削減
3. **エラー率**: 型安全性による実行時エラー削減 → 90%削減
4. **デバッガビリティ**: 完全なTypeScript実行コンテキスト → 大幅改善

### 5.2 監視指標

```typescript
export interface AIProcessingMetrics {
  // パフォーマンス指標
  averageResponseTime: number;
  successRate: number;
  errorRate: number;

  // リソース使用量
  memoryUsage: number;
  cpuUsage: number;

  // API使用量
  apiCallCount: number;
  tokenUsage: number;
}
```

## 6. 実装優先順位

### 優先度1 (Critical): コア処理エンジン

- `AIProcessingEngine`
- `ClaudeAPIClient`
- 基本エラーハンドリング

### 優先度2 (High): 既存機能移行

- `claude-client.ts`の置換
- `ai-analysis-orchestrator.ts`の置換

### 優先度3 (Medium): 最適化

- パフォーマンス改善
- 詳細ログ機能
- 監視ダッシュボード

## 7. リスク管理

### 7.1 技術リスク

| リスク             | 影響度 | 対策                               |
| ------------------ | ------ | ---------------------------------- |
| Claude API仕様変更 | High   | バージョン固定、アダプターパターン |
| パフォーマンス劣化 | Medium | ベンチマーク、段階的ロールアウト   |
| 互換性問題         | High   | 広範囲統合テスト、並行運用期間     |

### 7.2 運用リスク

| リスク      | 影響度 | 対策                               |
| ----------- | ------ | ---------------------------------- |
| API制限超過 | Medium | レート制限、リトライ機構           |
| 認証エラー  | High   | 冗長認証、適切なエラーハンドリング |

## 8. 成果指標

### 8.1 技術指標

- ✅ 全てのclaude -p呼び出しをTypeScript化
- ✅ 実行時エラー90%削減
- ✅ レスポンス時間30%改善
- ✅ 100%テストカバレッジ維持

### 8.2 品質指標

- ✅ 型安全性100%達成
- ✅ 外部プロセス依存0個
- ✅ デバッグ効率50%向上

## まとめ

本設計により、Issue #366「Claude Code SDK処理のTypeScript再構築」を実現します：

1. **完全内製化**: claude -p外部依存を完全排除
2. **型安全性**: TypeScriptによる型安全な処理フロー
3. **パフォーマンス**: 外部プロセスオーバーヘッド削除
4. **保守性**: 統一されたTypeScriptコードベース
5. **テスタビリティ**: モック化容易な内部実装

全域性原則とDDD原則に基づき、堅牢で拡張可能なAI処理アーキテクチャを構築します。
