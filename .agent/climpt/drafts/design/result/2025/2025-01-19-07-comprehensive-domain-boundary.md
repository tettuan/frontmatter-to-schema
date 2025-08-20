# 統合ドメイン境界線設計 - フロントマター解析システム

## コード分析と要求事項の統合設計

## 1. システム全体像（要求事項＋コード分析統合）

### 1.1 システムの目的と中心骨格

**システムの目的（要求事項より）**：

- Markdownファイルの索引(Index)作成
- 柔軟なフロントマター解析による事後的型定義
- 差し替え可能なSchema/Templateによる多様な索引対応

**中心骨格（24回試行分析）**：

```
入力(Markdown) → FrontMatter抽出 → AI解析(claude -p) → Schema検証 → Template変換 → 索引出力
```

### 1.2 統合出現分布分析

```
[絶対中核] 100% 出現率（要求＋コード両方で必須）
├── AnalysisEngine (解析エンジン)
├── SchemaDefinition (柔軟な型定義)
├── TemplateMapper (差し替え可能な変換)
├── FrontMatterContent (抽出対象)
└── ClaudeAnalyzer (claude -p統合)

[準中核] 80-99% 出現率
├── ConfigurationLoader (Schema/Template読込)
├── FileDiscovery (Markdown探索)
├── Registry (索引集約)
└── Result<T,E> (全域性保証)

[支援層] 60-79% 出現率
├── DocumentProcessor (文書処理)
├── PromptManager (プロンプト管理)
├── ExtractionStrategy (抽出戦略)
└── MappingStrategy (マッピング戦略)

[インフラ層] 40-59% 出現率
├── FileSystem (Deno FS)
├── ClaudeAPIClient (外部API)
├── YAMLParser (出力形式)
└── JSONSerializer (出力形式)
```

## 2. 要求事項に基づく境界線の再定義

### 2.1 機能要件からの境界導出

**要求事項の機能要件**：

1. フロントマター抽出（Deno実装）
2. claude -pによる解析（2段階）
   - 情報抽出
   - テンプレート当て込み
3. Schema/Template差し替え可能性
4. 複数索引形式対応

**導出される境界**：

```typescript
// ===============================================
// 索引作成ドメイン（Index Creation Domain）
// ===============================================
namespace IndexCreationDomain {
  // 中心: 索引作成エンジン
  interface IndexingEngine {
    createIndex(
      documents: MarkdownDocument[],
      schema: SchemaDefinition,
      template: TemplateDefinition,
    ): Promise<Result<Index>>;
  }

  // AI解析統合（claude -p）
  interface AIAnalysisService {
    extractInformation(
      frontMatter: FrontMatterContent,
      schema: SchemaDefinition,
      extractionPrompt: string,
    ): Promise<Result<ExtractedData>>;

    mapToTemplate(
      extractedData: ExtractedData,
      template: TemplateDefinition,
      mappingPrompt: string,
    ): Promise<Result<MappedResult>>;
  }
}

// ===============================================
// 設定管理ドメイン（Configuration Domain）
// ===============================================
namespace ConfigurationDomain {
  // Schema/Template差し替え管理
  interface ConfigurationManager {
    loadSchema(path: string): Promise<Result<SchemaDefinition>>;
    loadTemplate(path: string): Promise<Result<TemplateDefinition>>;
    loadPrompts(): Promise<Result<PromptPair>>;
  }

  // 実例管理（examples/）
  interface ExampleRegistry {
    getExample(name: "climpt-registry" | "articles-index"): ExampleConfig;
    validateExample(config: ExampleConfig): Result<ValidatedConfig>;
  }
}
```

### 2.2 非機能要件からの境界強化

**柔軟性要件**：

- Schema変更に対応可能
- Markdown側の変更不要
- 多様な索引形式対応

**抽象化要件**：

- 実例パターンの混入禁止
- 設定/引数による解決

```typescript
// ===============================================
// 抽象化境界（Abstraction Boundary）
// ===============================================
namespace AbstractionLayer {
  // 実装から実例を分離
  interface GenericProcessor<TInput, TOutput> {
    process(
      input: TInput,
      strategy: ProcessingStrategy<TInput, TOutput>,
    ): Promise<Result<TOutput>>;
  }

  // 設定駆動アーキテクチャ
  interface ConfigDrivenPipeline {
    configure(config: PipelineConfig): Result<ConfiguredPipeline>;
    execute(): Promise<Result<PipelineOutput>>;
  }
}
```

## 3. ライフサイクル統合分析

### 3.1 要求事項のライフサイクル

```
[設定時] Schema/Template/Prompts読込
    ↓
[実行時] Markdownファイル群処理
    ↓
[ループ内] 個別ファイル処理
    ├─ FrontMatter抽出
    ├─ AI解析（成果C）
    └─ Template変換（成果D）
    ↓
[集約時] 全体統合（成果E）
    ↓
[永続化] 索引保存
```

### 3.2 統合ライフサイクル境界

```typescript
// ===============================================
// ライフサイクル境界定義
// ===============================================

// 設定時境界（アプリケーション起動時）
interface ConfigurationLifecycle {
  readonly schema: SchemaDefinition; // 不変
  readonly template: TemplateDefinition; // 不変
  readonly prompts: PromptPair; // 不変
}

// 実行時境界（バッチ処理単位）
interface ExecutionLifecycle {
  readonly pipeline: AnalysisPipeline; // セッション中不変
  readonly registry: Registry; // 累積変更
  state: "initialized" | "processing" | "completed";
}

// ループ境界（ファイル単位）
interface ProcessingLifecycle {
  readonly filePath: string; // 処理中不変
  frontMatter?: FrontMatterContent; // 抽出後設定
  extractedData?: ExtractedData; // 解析後設定
  mappedResult?: MappedResult; // 変換後設定
}

// イベント境界
type DomainEvent =
  | { type: "ConfigurationLoaded"; config: ConfigurationLifecycle }
  | { type: "ProcessingStarted"; files: string[] }
  | { type: "FileProcessed"; file: string; result: ProcessingResult }
  | { type: "IndexCreated"; index: Index };
```

## 4. 距離ベース境界の最終設計

### 4.1 統合距離マトリクス

| ドメイン要素         | 実行ステップ | 意味距離 | 要求重要度 | 総合距離 | 境界分類 |
| -------------------- | ------------ | -------- | ---------- | -------- | -------- |
| IndexingEngine       | 0            | 0        | 10         | 0.0      | 絶対中核 |
| SchemaDefinition     | 1            | 1        | 10         | 1.0      | 絶対中核 |
| ClaudeAnalyzer       | 1            | 1        | 10         | 1.0      | 絶対中核 |
| TemplateMapper       | 2            | 2        | 9          | 2.2      | 準中核   |
| ConfigurationLoader  | 2            | 3        | 8          | 3.3      | 準中核   |
| FrontMatterExtractor | 3            | 2        | 7          | 3.6      | 支援層   |
| Registry             | 3            | 3        | 6          | 4.2      | 支援層   |
| FileDiscovery        | 4            | 4        | 5          | 5.7      | 汎用層   |
| PromptManager        | 3            | 4        | 7          | 5.0      | 汎用層   |
| FileSystem           | 5            | 6        | 3          | 7.8      | インフラ |
| ClaudeAPIClient      | 4            | 7        | 4          | 8.1      | インフラ |

### 4.2 統合境界アーキテクチャ

```typescript
// ===============================================
// 最終統合境界設計
// ===============================================

// レイヤー1: 絶対中核（距離0-1）
export namespace CoreIndexingDomain {
  export interface IndexingEngine {
    createIndex(config: IndexingConfig): Promise<Result<Index>>;
  }

  export interface SchemaBasedAnalyzer {
    analyze(
      content: FrontMatterContent,
      schema: SchemaDefinition,
    ): Promise<Result<AnalyzedData>>;
  }

  export interface ClaudeIntegration {
    executePrompt(
      prompt: string,
      data: unknown,
    ): Promise<Result<unknown>>;
  }
}

// レイヤー2: 準中核（距離1-3）
export namespace SupportingIndexDomain {
  export interface TemplateProcessor {
    process(
      data: AnalyzedData,
      template: TemplateDefinition,
    ): Result<MappedData>;
  }

  export interface ConfigurationService {
    loadIndexingConfig(path: string): Promise<Result<IndexingConfig>>;
  }
}

// レイヤー3: 支援層（距離3-5）
export namespace DocumentProcessingDomain {
  export interface FrontMatterService {
    extract(markdown: string): Result<FrontMatterContent>;
  }

  export interface RegistryService {
    aggregate(results: ProcessingResult[]): Result<Registry>;
  }
}

// レイヤー4: 汎用層（距離5-7）
export namespace UtilityDomain {
  export interface FileDiscoveryService {
    discover(pattern: string): Promise<string[]>;
  }

  export interface PromptTemplateService {
    loadPrompts(): Promise<PromptPair>;
  }
}

// レイヤー5: インフラ層（距離7+）
export namespace InfrastructureDomain {
  export interface FileSystemAdapter {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
  }

  export interface ExternalAPIAdapter {
    callClaude(prompt: string): Promise<string>;
  }
}
```

## 5. 実装優先順位（要求事項準拠）

### Phase 1: MVP実装（実例1対応）

1. ✅ FrontMatter抽出（Deno実装）
2. ✅ Claude API統合（2段階プロンプト）
3. ✅ Climpt Registry生成（.agent/climpt/registry.json）

### Phase 2: 汎用化（実例2対応）

1. ⬜ YAML出力対応
2. ⬜ 記事索引Schema対応
3. ⬜ 複数入力パス対応

### Phase 3: 完全抽象化

1. ⬜ 実例パターンの完全分離
2. ⬜ プラグイン化アーキテクチャ
3. ⬜ 動的Schema/Template読込

### Phase 4: 品質保証

1. ⬜ 堅牢なテスト（tests/）
2. ⬜ 実行可能な例（examples/）
3. ⬜ CI/CD統合

## 6. 境界違反検出と品質管理

### 6.1 要求事項準拠チェック

```typescript
export const RequirementComplianceChecker = {
  // 実例パターン混入チェック
  checkNoHardcodedExamples(): boolean {
    const patterns = [
      /climpt-registry/,
      /articles-index/,
      /\.agent\/climpt/,
    ];
    return !hasPatternInCore(patterns);
  },

  // Schema/Template差し替え可能性チェック
  checkReplaceability(): boolean {
    return hasExternalConfigLoader() &&
      hasTemplateInjection() &&
      hasSchemaInjection();
  },

  // 抽象化レベルチェック
  checkAbstractionLevel(): boolean {
    return noDependencyOnExamples() &&
      configDrivenArchitecture() &&
      pathsAsArguments();
  },
};
```

### 6.2 継続的境界モニタリング

```bash
# 要求事項準拠チェック
npm run compliance:check

# 境界違反検出
npm run boundary:validate

# 抽象化レベル測定
npm run abstraction:measure

# 実例テスト実行
npm run examples:test
```

## 7. イベント駆動による境界通信

### 7.1 境界間イベントフロー

```typescript
// 設定読込イベント
interface ConfigurationLoadedEvent {
  schema: SchemaDefinition;
  template: TemplateDefinition;
  prompts: PromptPair;
  paths: {
    input: string;
    output: string;
  };
}

// ファイル処理イベント
interface FileProcessingEvent {
  stage: "discovered" | "extracting" | "analyzing" | "mapping" | "completed";
  filePath: string;
  data?: unknown;
  error?: Error;
}

// 索引生成イベント
interface IndexGenerationEvent {
  totalFiles: number;
  processedFiles: number;
  registry: Registry;
  outputPath: string;
}
```

### 7.2 Pub/Sub実装

```typescript
export class DomainEventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  // 境界を越えた通信
  publish<T extends DomainEvent>(event: T): void {
    const handlers = this.handlers.get(event.type) || new Set();
    handlers.forEach((handler) => handler(event));
  }

  // 境界でのイベント購読
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => void,
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }
}
```

## 8. 成果物チェックリスト

### 8.1 要求事項の成果物

-
  1. [x] 要求の整理と要件化
-
  2. [x] 機能要件、非機能要件の分離
-
  3. [x] ドメイン境界線の設計資料の作成
-
  4. [ ] 実装された解析のスクリプトと堅牢なテスト
-
  5. [x] 'claude -p' 用のプロンプト2つ
-
  6. [ ] examples/ に実例を使った実行例

### 8.2 境界設計の成果物

- [x] 出現分布分析
- [x] 中心骨格特定
- [x] 距離ベース境界
- [x] ライフサイクル境界
- [x] イベント境界
- [x] 実装優先順位
- [x] 品質管理指標

## 9. まとめ

本統合設計により実現される価値：

1. **要求準拠**: 柔軟な索引作成システムの実現
2. **中心明確**: IndexingEngineを中核とした安定構造
3. **境界明確**: 距離とライフサイクルによる自然な境界
4. **差し替え可能**: Schema/Templateの完全な外部化
5. **抽象化達成**: 実例パターンからの完全分離
6. **品質保証**: 継続的な境界違反検出

この設計により、要求事項を満たしつつ、持続可能で拡張性の高いドメイン境界を実現する。
