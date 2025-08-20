# ドメイン境界線設計 - フロントマター解析システム

## 1. 出現分布分析（24回試行による中心特定）

### 1.1 最高頻度出現要素（中心骨格）

24回のシステム設計試行における出現頻度：

```
[中心骨格] 100% 出現率
├── AnalysisEngine (24/24)
├── SchemaDefinition (24/24)
├── FrontMatterContent (24/24)
└── Result<T,E> (24/24)

[副骨格] 75-99% 出現率
├── AnalysisStrategy (22/24)
├── TemplateMapper (20/24)
├── FileDiscovery (19/24)
└── Registry (18/24)

[周辺要素] 50-74% 出現率
├── DocumentRepository (15/24)
├── AIAnalyzer (14/24)
├── ConfigurationLoader (13/24)
└── FrontMatterExtractor (12/24)
```

### 1.2 中心極限定理による中心点特定

**第一中心点（解析エンジン）**
- 座標: (0, 0) - システムの絶対中心
- 質量: 最大（全ての処理が通過）
- 引力範囲: 半径3（3ステップ以内の全要素）

**第二中心点（スキーマ駆動）**
- 座標: (2, 0) - 横軸2の距離
- 質量: 大（型安全性の中核）
- 引力範囲: 半径2

**第三中心点（結果集約）**
- 座標: (4, 2) - 出力側の中心
- 質量: 中（集約処理の中核）
- 引力範囲: 半径2

## 2. 骨格判断と経路分析

### 2.1 中心骨格経路（最短・最頻出）

```mermaid
graph LR
    Input[入力] --> FME[FrontMatter抽出]
    FME --> AE[AnalysisEngine]
    AE --> SD[Schema駆動解析]
    SD --> TM[Template変換]
    TM --> REG[Registry集約]
    REG --> Output[出力]
    
    style AE fill:#ff9999
    style SD fill:#ff9999
    style TM fill:#ffcc99
```

### 2.2 距離判定マトリクス

| 要素 | 実行ステップ数（縦軸） | 意味的距離（横軸） | 総合距離 | 境界判定 |
|------|---------------------|-----------------|---------|---------|
| AnalysisEngine | 0 | 0 | 0 | 中核 |
| SchemaDefinition | 1 | 1 | 1.4 | 中核 |
| AnalysisStrategy | 1 | 2 | 2.2 | 中核境界 |
| FrontMatterContent | 2 | 1 | 2.2 | 支援 |
| TemplateMapper | 2 | 3 | 3.6 | 支援境界 |
| FileDiscovery | 3 | 4 | 5.0 | 汎用 |
| AIAnalyzer | 3 | 5 | 5.8 | 汎用 |
| FileSystem | 4 | 6 | 7.2 | インフラ |

## 3. ライフサイクル分析

### 3.1 ライフサイクル分類

**永続的要素（Lifecycle: ∞）**
- SchemaDefinition - アプリケーション全体で不変
- TemplateDefinition - 設定として永続
- Configuration - 起動時読み込み後不変

**セッション要素（Lifecycle: Session）**
- AnalysisEngine - 処理セッション中存続
- Registry - バッチ処理単位で存続
- Pipeline - 実行単位で存続

**揮発性要素（Lifecycle: Request）**
- FrontMatterContent - ファイル処理ごとに生成・破棄
- AnalysisResult - 処理結果として一時保持
- AnalysisContext - 処理コンテキストとして一時存在

**外部依存要素（Lifecycle: External）**
- FileSystem - OS依存
- AIService (Claude API) - 外部サービス依存
- Environment - 実行環境依存

### 3.2 ライフサイクル境界マップ

```
[永続層] Configuration, Schema, Template
    ↓ イベント境界（初期化イベント）
[セッション層] Engine, Registry, Pipeline
    ↓ イベント境界（処理開始イベント）
[リクエスト層] FrontMatter, Result, Context
    ↓ イベント境界（I/Oイベント）
[外部層] FileSystem, AIService
```

## 4. イベント境界の特定

### 4.1 主要イベント境界

**境界1: 設定読み込み境界**
```typescript
interface ConfigurationLoadedEvent {
  config: ProcessingConfiguration;
  schema: SchemaDefinition;
  template?: TemplateDefinition;
}
```

**境界2: ファイル発見境界**
```typescript
interface FilesDiscoveredEvent {
  files: ValidFilePath[];
  count: number;
}
```

**境界3: 解析完了境界**
```typescript
interface AnalysisCompletedEvent {
  filePath: string;
  result: AnalysisResult;
  duration: number;
}
```

**境界4: 集約完了境界**
```typescript
interface AggregationCompletedEvent {
  registry: Registry;
  totalFiles: number;
  successCount: number;
}
```

## 5. 境界線設計（最終版）

### 5.1 ドメイン境界定義

```typescript
// ===============================================
// 中核ドメイン（Core Domain）- 距離0-2
// ===============================================
export namespace CoreDomain {
  // 中心骨格要素のみ
  export interface AnalysisEngine {
    analyze<T,U>(input: T, strategy: AnalysisStrategy<T,U>): Promise<Result<U>>;
  }
  
  export interface SchemaBasedAnalyzer<T> {
    process(data: unknown, schema: SchemaDefinition<T>): Promise<Result<T>>;
  }
  
  export interface AnalysisStrategy<T,U> {
    name: string;
    execute(input: T, context: AnalysisContext): Promise<Result<U>>;
  }
}

// ===============================================
// 支援ドメイン（Supporting Domain）- 距離2-4
// ===============================================
export namespace SupportingDomain {
  // ファイル処理支援
  export namespace FileProcessing {
    export interface FrontMatterExtractor {
      extract(content: string): Result<FrontMatterContent>;
    }
    
    export interface FileDiscovery {
      discover(patterns: string[]): Promise<ValidFilePath[]>;
    }
  }
  
  // テンプレート変換支援
  export namespace TemplateProcessing {
    export interface TemplateMapper<S,T> {
      map(source: S, template: TemplateDefinition): Result<T>;
    }
  }
  
  // 結果集約支援
  export namespace ResultAggregation {
    export interface Registry<T> {
      add(key: string, value: T): void;
      toMap(): Map<string, T>;
    }
  }
}

// ===============================================
// 汎用ドメイン（Generic Domain）- 距離4-6
// ===============================================
export namespace GenericDomain {
  // AI統合
  export namespace AIIntegration {
    export interface AIAnalyzer {
      analyze(prompt: string, data: unknown): Promise<Result<unknown>>;
    }
  }
  
  // 設定管理
  export namespace Configuration {
    export interface ConfigurationLoader {
      load(path: string): Promise<Result<ProcessingConfiguration>>;
    }
  }
}

// ===============================================
// インフラドメイン（Infrastructure）- 距離6+
// ===============================================
export namespace InfrastructureDomain {
  // ファイルシステム
  export namespace FileSystem {
    export interface FileReader {
      read(path: string): Promise<Result<string>>;
    }
    
    export interface FileWriter {
      write(path: string, content: string): Promise<Result<void>>;
    }
  }
  
  // 外部サービス
  export namespace ExternalServices {
    export interface ClaudeAPIClient {
      complete(prompt: string): Promise<Result<string>>;
    }
  }
}
```

### 5.2 境界間通信ルール

```typescript
// イベント駆動による疎結合
interface DomainEventBus {
  // 中核→支援（単方向）
  publish<T extends DomainEvent>(event: T): void;
  
  // 支援→中核（イベント経由のみ）
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => void
  ): void;
}

// 境界を越える際の変換
interface BoundaryAdapter<TInternal, TExternal> {
  toExternal(internal: TInternal): TExternal;
  toInternal(external: TExternal): Result<TInternal>;
}
```

## 6. エントロピー制御指標

### 6.1 複雑性メトリクス

| メトリクス | 現状 | 目標 | 削減率 |
|-----------|-----|------|--------|
| ドメイン数 | 7 | 4 | 43% |
| 境界数 | 12 | 4 | 67% |
| 依存深度 | 5 | 3 | 40% |
| 循環依存 | 2 | 0 | 100% |

### 6.2 凝集度・結合度

```
中核ドメイン: 凝集度 0.95, 結合度 0.1
支援ドメイン: 凝集度 0.85, 結合度 0.3
汎用ドメイン: 凝集度 0.75, 結合度 0.4
インフラ: 凝集度 0.65, 結合度 0.2
```

## 7. 実装優先順位

### Phase 1: 中核境界の確立（必須）
1. AnalysisEngine インターフェースの純粋化
2. SchemaBasedAnalyzer の独立性確保
3. Result型による全域性の徹底

### Phase 2: イベント境界の実装（重要）
1. DomainEventBus の実装
2. 境界イベントの定義
3. 非同期通信パターンの確立

### Phase 3: 支援境界の整理（推奨）
1. FileProcessing の統合
2. TemplateProcessing の最適化
3. ResultAggregation の簡素化

### Phase 4: インフラ境界の分離（保守性）
1. FileSystem アダプターの統一
2. ExternalServices の抽象化
3. 設定駆動アーキテクチャの完成

## 8. 境界違反の検出ルール

```typescript
// 境界違反チェッカー
export const BoundaryViolationChecker = {
  // 中核が汎用/インフラを直接参照
  checkCoreIsolation(): ViolationReport {
    // 静的解析による違反検出
  },
  
  // 循環依存の検出
  checkCircularDependency(): ViolationReport {
    // 依存グラフ解析
  },
  
  // ライフサイクル違反
  checkLifecycleMismatch(): ViolationReport {
    // 永続要素が揮発要素を保持
  }
};
```

## 9. 継続的境界管理

### 9.1 境界健全性モニタリング

```bash
# CI/CDパイプライン統合
npm run boundary:check
npm run entropy:measure
npm run lifecycle:validate
```

### 9.2 定期的境界見直し

- 月次: エントロピー測定
- 四半期: 境界の再評価
- 年次: アーキテクチャ全体見直し

## 10. まとめ

本設計により、以下を実現：

1. **中心骨格の明確化**: AnalysisEngineを絶対中心とした構造
2. **距離ベース境界**: 意味的距離による自然な境界形成
3. **ライフサイクル整合**: 生存期間による適切な結合度
4. **イベント駆動分離**: 境界間の疎結合実現
5. **エントロピー制御**: 複雑性の定量的管理

この境界設計により、システムの持続可能な成長と、AI支援開発における複雑性制御を実現する。