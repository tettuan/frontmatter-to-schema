# Schema可変性対応ドメイン境界線設計 - フロントマター解析システム
## 実行時Schema差し替えを中心とした境界設計

## 1. 設計の中核原則：Schema可変性

### 1.1 要求事項の再確認

**最重要要求**：
> "アプリケーションはSchemaとテンプレートを外部から読み込み、差し代え前提でSchema定義を用い、テンプレートへ出力する"

**意味するところ**：
- Schemaは実行時に決定される
- 同一アプリケーションが異なるSchemaで動作する
- Schemaの変更はコード変更を伴わない
- 実例（climpt-registry、articles-index）は交換可能な設定

### 1.2 Schema可変性による境界の再定義

```
[固定層] アプリケーションコア（Schemaに依存しない）
    ↓ Schema注入境界
[可変層] Schema依存処理（実行時に決定）
    ↓ 動的ロード境界
[外部層] Schema/Template定義ファイル
```

## 2. Schema可変性を中心とした境界設計

### 2.1 第1境界：Schema非依存コア（不変領域）

```typescript
// ===============================================
// Schema非依存コアドメイン（完全に不変）
// ===============================================
namespace SchemaAgnosticCore {
  
  // Schemaの概念すら知らない純粋な処理エンジン
  export interface PureProcessingEngine {
    execute<TInput, TOutput>(
      input: TInput,
      transformer: Transformer<TInput, TOutput>
    ): Promise<Result<TOutput>>;
  }
  
  // 汎用的なデータ変換インターフェース
  export interface Transformer<TInput, TOutput> {
    transform(input: TInput): Promise<Result<TOutput>>;
  }
  
  // フロントマター抽出（Schemaと無関係）
  export interface FrontMatterExtractor {
    extract(markdown: string): Result<Record<string, unknown>>;
  }
  
  // ファイル発見（Schemaと無関係）
  export interface FileDiscovery {
    discover(patterns: string[]): Promise<string[]>;
  }
}
```

### 2.2 第2境界：Schema注入層（実行時決定）

```typescript
// ===============================================
// Schema注入境界（実行時に外部から注入）
// ===============================================
namespace SchemaInjectionBoundary {
  
  // 実行時Schema注入ポイント
  export interface RuntimeSchemaInjector {
    // 実行ごとに異なるSchemaを注入
    injectSchema(schema: unknown): SchemaContext;
    injectTemplate(template: unknown): TemplateContext;
    injectPrompts(prompts: PromptPair): PromptContext;
  }
  
  // Schema適用エンジン（注入されたSchemaで動作）
  export interface SchemaApplicableEngine {
    applySchema(
      data: Record<string, unknown>,
      context: SchemaContext
    ): Promise<Result<ValidatedData>>;
  }
  
  // Template適用エンジン（注入されたTemplateで動作）
  export interface TemplateApplicableEngine {
    applyTemplate(
      data: ValidatedData,
      context: TemplateContext
    ): Promise<Result<FormattedOutput>>;
  }
  
  // Schema実行コンテキスト（実行時生成）
  export interface SchemaContext {
    readonly id: string;                    // 実行ID
    readonly schema: unknown;               // 注入されたSchema
    readonly validationRules: unknown[];    // 実行時ルール
    readonly createdAt: Date;              // 注入時刻
  }
}
```

### 2.3 第3境界：動的Schema管理層

```typescript
// ===============================================
// 動的Schema管理境界（Schema可変性の管理）
// ===============================================
namespace DynamicSchemaManagement {
  
  // Schema動的ロード管理
  export interface SchemaLoader {
    // 実行時にSchemaをロード
    loadSchema(path: string): Promise<Result<unknown>>;
    loadTemplate(path: string): Promise<Result<unknown>>;
    
    // Schemaのバリデーション（形式チェックのみ）
    validateSchemaFormat(schema: unknown): Result<ValidSchema>;
  }
  
  // Schema切り替えマネージャー
  export interface SchemaSwitcher {
    // 実行時にSchemaを切り替え
    switchToSchema(schemaName: string): Promise<Result<ActiveSchema>>;
    
    // 現在のアクティブSchema
    getCurrentSchema(): ActiveSchema | null;
    
    // 利用可能なSchema一覧
    listAvailableSchemas(): string[];
  }
  
  // アクティブSchema（現在選択中）
  export interface ActiveSchema {
    readonly name: string;
    readonly schema: unknown;
    readonly template: unknown;
    readonly prompts: PromptPair;
    readonly activatedAt: Date;
  }
}
```

### 2.4 第4境界：実行時構成層

```typescript
// ===============================================
// 実行時構成境界（完全に動的）
// ===============================================
namespace RuntimeConfigurationBoundary {
  
  // 実行単位の設定（毎回異なる可能性）
  export interface ExecutionConfiguration {
    // 実行時に決定されるパラメータ
    schemaPath: string;        // 外部から指定
    templatePath: string;      // 外部から指定
    inputPath: string;         // 外部から指定
    outputPath: string;        // 外部から指定
    outputFormat: "json" | "yaml" | "xml";  // 外部から指定
  }
  
  // 実行パイプラインファクトリ（動的生成）
  export interface DynamicPipelineFactory {
    // 実行時設定からパイプライン生成
    createPipeline(
      config: ExecutionConfiguration
    ): Promise<Result<ExecutablePipeline>>;
  }
  
  // 実行可能パイプライン（使い捨て）
  export interface ExecutablePipeline {
    readonly id: string;
    readonly config: ExecutionConfiguration;
    
    // 一度だけ実行
    execute(): Promise<Result<PipelineOutput>>;
    
    // 実行後は破棄
    dispose(): void;
  }
}
```

## 3. ライフサイクル境界（Schema可変性考慮）

### 3.1 Schema可変性のライフサイクル

```typescript
// ===============================================
// Schema可変ライフサイクル
// ===============================================

// アプリケーション起動時（Schemaに依存しない）
interface ApplicationLifecycle {
  // Schemaを含まない
  readonly engine: PureProcessingEngine;
  readonly extractor: FrontMatterExtractor;
  readonly discovery: FileDiscovery;
}

// 実行準備時（Schema読み込み）
interface PreparationLifecycle {
  // 毎回異なるSchemaをロード
  loadedSchema?: unknown;           // 実行時決定
  loadedTemplate?: unknown;          // 実行時決定
  loadedPrompts?: PromptPair;       // 実行時決定
}

// 実行時（Schema適用）
interface ExecutionLifecycle {
  // 注入されたSchemaで動作
  readonly injectedSchema: unknown;      // この実行でのSchema
  readonly injectedTemplate: unknown;    // この実行でのTemplate
  readonly processingState: "ready" | "processing" | "completed";
}

// 実行後（リセット）
interface PostExecutionLifecycle {
  // Schemaの参照を破棄
  cleanup(): void;
  resetForNextExecution(): void;
}
```

### 3.2 イベント駆動Schema切り替え

```typescript
// Schema切り替えイベント
type SchemaChangeEvent = 
  | { type: "SchemaLoadRequested"; path: string }
  | { type: "SchemaLoaded"; schema: unknown }
  | { type: "SchemaActivated"; name: string }
  | { type: "SchemaDeactivated"; name: string }
  | { type: "SchemaValidationFailed"; error: Error };

// Template切り替えイベント
type TemplateChangeEvent =
  | { type: "TemplateLoadRequested"; path: string }
  | { type: "TemplateLoaded"; template: unknown }
  | { type: "TemplateActivated"; name: string };

// 実行イベント（Schema含む）
type ExecutionEvent =
  | { type: "ExecutionStarted"; schemaName: string; templateName: string }
  | { type: "SchemaApplied"; documentCount: number }
  | { type: "TemplateApplied"; resultCount: number }
  | { type: "ExecutionCompleted"; outputPath: string };
```

## 4. 距離ベース境界（Schema可変性優先）

### 4.1 Schema可変性を考慮した距離マトリクス

| 要素 | Schema依存度 | 可変性 | 実行頻度 | 境界分類 |
|------|------------|--------|---------|----------|
| PureProcessingEngine | 0% | 不変 | 常時 | コア（不変） |
| FrontMatterExtractor | 0% | 不変 | 常時 | コア（不変） |
| SchemaLoader | 50% | 半可変 | 実行毎 | 注入層 |
| SchemaApplicator | 100% | 完全可変 | 実行毎 | 可変層 |
| TemplateApplicator | 100% | 完全可変 | 実行毎 | 可変層 |
| ClaudeAnalyzer | 80% | 高可変 | 実行毎 | 可変層 |
| ConfigurationReader | 30% | 低可変 | 起動時 | 設定層 |
| FileSystem | 0% | 不変 | 常時 | インフラ |

### 4.2 Schema可変性による境界アーキテクチャ

```typescript
// ===============================================
// 最終境界設計（Schema可変性中心）
// ===============================================

// レイヤー1: 不変コア（Schema非依存）
export namespace InvariantCore {
  // 一切Schemaを知らない
  export class PureEngine {
    process(data: unknown): unknown {
      // Schemaと無関係な処理
    }
  }
}

// レイヤー2: 注入境界（Schema受け入れ）
export namespace InjectionBoundary {
  // Schemaを外部から受け取る
  export class SchemaReceiver {
    private currentSchema: unknown = null;
    
    inject(schema: unknown): void {
      this.currentSchema = schema;  // 実行時注入
    }
    
    apply(data: unknown): Result<unknown> {
      if (!this.currentSchema) {
        return { ok: false, error: "No schema injected" };
      }
      // 注入されたSchemaで処理
    }
  }
}

// レイヤー3: 可変処理層（Schema依存）
export namespace VariableProcessing {
  // Schemaに完全依存（実行毎に異なる）
  export class SchemaProcessor {
    constructor(private schema: unknown) {
      // 実行時に渡されたSchemaで初期化
    }
    
    process(data: unknown): Result<unknown> {
      // このSchemaでの処理
    }
  }
}

// レイヤー4: 動的管理層（Schema切り替え）
export namespace DynamicManagement {
  // 複数のSchemaを管理
  export class SchemaManager {
    private schemas = new Map<string, unknown>();
    
    register(name: string, schema: unknown): void {
      this.schemas.set(name, schema);
    }
    
    activate(name: string): Result<unknown> {
      const schema = this.schemas.get(name);
      if (!schema) {
        return { ok: false, error: `Schema ${name} not found` };
      }
      return { ok: true, data: schema };
    }
  }
}

// レイヤー5: 外部境界（Schema供給）
export namespace ExternalBoundary {
  // Schemaファイルの読み込み
  export class SchemaProvider {
    async provide(path: string): Promise<unknown> {
      // 外部からSchemaを供給
      const content = await Deno.readTextFile(path);
      return JSON.parse(content);
    }
  }
}
```

## 5. 実装パターン（Schema可変性実現）

### 5.1 依存性注入パターン

```typescript
// Schema注入コンテナ
export class SchemaInjectionContainer {
  private bindings = new Map<string, unknown>();
  
  // 実行時にSchemaをバインド
  bind(key: string, schema: unknown): void {
    this.bindings.set(key, schema);
  }
  
  // 実行時にSchemaを解決
  resolve<T>(key: string): T {
    const schema = this.bindings.get(key);
    if (!schema) {
      throw new Error(`Schema ${key} not bound`);
    }
    return schema as T;
  }
  
  // 実行後にクリア
  clear(): void {
    this.bindings.clear();
  }
}
```

### 5.2 ファクトリーパターン

```typescript
// Schema依存コンポーネントのファクトリー
export class SchemaBasedComponentFactory {
  // 実行時にSchemaを受け取って生成
  static createProcessor(schema: unknown): Processor {
    return new SchemaProcessor(schema);
  }
  
  static createValidator(schema: unknown): Validator {
    return new SchemaValidator(schema);
  }
  
  static createMapper(template: unknown): Mapper {
    return new TemplateMapper(template);
  }
}
```

### 5.3 ストラテジーパターン

```typescript
// Schema依存戦略
export interface SchemaStrategy {
  canHandle(schema: unknown): boolean;
  execute(data: unknown, schema: unknown): Result<unknown>;
}

// 実行時戦略選択
export class StrategySelector {
  private strategies: SchemaStrategy[] = [];
  
  register(strategy: SchemaStrategy): void {
    this.strategies.push(strategy);
  }
  
  select(schema: unknown): SchemaStrategy | null {
    return this.strategies.find(s => s.canHandle(schema)) || null;
  }
}
```

## 6. 境界違反検出（Schema可変性観点）

### 6.1 Schema固定化の検出

```typescript
export const SchemaVariabilityChecker = {
  // Schemaハードコーディング検出
  checkNoHardcodedSchema(): boolean {
    const codePatterns = [
      /const schema = \{/,
      /interface.*Schema/,
      /type.*Schema.*=/,
    ];
    return !hasPatternInCore(codePatterns);
  },
  
  // Schema依存の境界違反検出
  checkBoundaryViolation(): boolean {
    // コア層がSchemaを参照していないか
    const coreImports = getImportsFromCore();
    return !coreImports.some(imp => imp.includes('schema'));
  },
  
  // 実行時注入の確認
  checkRuntimeInjection(): boolean {
    return hasInjectionPoints() && 
           hasFactoryMethods() &&
           hasStrategyPattern();
  }
};
```

### 6.2 可変性メトリクス

```typescript
export const VariabilityMetrics = {
  // Schema切り替え可能性
  schemaSwitchability: () => {
    return {
      injectionPoints: countInjectionPoints(),
      factoryMethods: countFactoryMethods(),
      strategies: countStrategies(),
      score: calculateVariabilityScore()
    };
  },
  
  // 依存度測定
  schemaDependency: () => {
    return {
      coreLayerDependency: 0,      // あるべき姿
      injectionLayerDependency: 50,
      variableLayerDependency: 100,
    };
  }
};
```

## 7. 実例との整合性確認

### 7.1 実例1（climpt-registry）の実行

```typescript
// 実行時にclimpt-registry用のSchemaを注入
const execution1 = async () => {
  const container = new SchemaInjectionContainer();
  
  // 実行時にSchemaをロード
  const schema = await SchemaProvider.provide(
    "examples/climpt-registry/schema.json"
  );
  const template = await TemplateProvider.provide(
    "examples/climpt-registry/template.json"
  );
  
  // 注入
  container.bind("schema", schema);
  container.bind("template", template);
  
  // 実行
  const pipeline = PipelineFactory.create(container);
  return pipeline.execute();
};
```

### 7.2 実例2（articles-index）の実行

```typescript
// 同じアプリで異なるSchemaを注入
const execution2 = async () => {
  const container = new SchemaInjectionContainer();
  
  // 実行時に別のSchemaをロード
  const schema = await SchemaProvider.provide(
    "examples/articles-index/schema.json"
  );
  const template = await TemplateProvider.provide(
    "examples/articles-index/template.yaml"
  );
  
  // 注入（異なるSchema）
  container.bind("schema", schema);
  container.bind("template", template);
  
  // 実行（同じコード、異なるSchema）
  const pipeline = PipelineFactory.create(container);
  return pipeline.execute();
};
```

## 8. 継続的品質管理

### 8.1 Schema可変性の継続的検証

```bash
# Schema可変性チェック
npm run schema:variability:check

# 境界違反検出
npm run boundary:schema:validate

# 注入ポイント検証
npm run injection:points:verify

# 実例切り替えテスト
npm run examples:switch:test
```

### 8.2 CI/CDパイプライン統合

```yaml
# .github/workflows/schema-variability.yml
name: Schema Variability Check
on: [push, pull_request]
jobs:
  check:
    steps:
      - name: Check no hardcoded schemas
        run: npm run schema:hardcode:check
      
      - name: Verify injection boundaries
        run: npm run boundary:injection:verify
      
      - name: Test schema switching
        run: |
          npm run test:schema:climpt
          npm run test:schema:articles
```

## 9. まとめ

### 9.1 実現される価値

1. **完全なSchema可変性**: 実行時に任意のSchemaを注入可能
2. **境界の明確化**: Schema依存/非依存の境界が明確
3. **実例の独立性**: climpt-registry、articles-indexが完全に交換可能
4. **コードの不変性**: Schema変更でコード変更不要
5. **動的切り替え**: 実行中にSchemaを切り替え可能

### 9.2 要求事項との整合性

✅ **要求**: "Schema変更に対応できない" → **解決**: 実行時注入で対応
✅ **要求**: "差し替え可能なSchema" → **解決**: 注入境界で実現
✅ **要求**: "Markdown側の変更不要" → **解決**: Schema可変でも影響なし
✅ **要求**: "多様な索引作り" → **解決**: Schema切り替えで対応

この設計により、Schema可変性を中心とした真に柔軟なドメイン境界を実現する。