# ドメインアーキテクチャ設計書 - 汎用フロントマター解析システム（DDD+Totality準拠）

## 1. 核心ドメイン（中核中心線）

### 1.1 システムの中心線特定

24回シミュレーション試行により特定された**骨格の中心線**：

```
Schema-driven Analysis Engine → Analysis Strategy → Template Mapping
```

**ライフタイムが最も長い中核**：
- `AnalysisEngine<TInput, TOutput>`
- `SchemaBasedAnalyzer<TSchema, TResult>`  
- `TemplateMapper<TSource, TTarget>`

### 1.2 中核境界の明確化

```typescript
// 【中核】Schema-driven Analysis Domain
export namespace CoreAnalysisDomain {
  // 中心線：分析エンジン（最高頻度・最長生存）
  export interface AnalysisEngine {
    analyze<TInput, TOutput>(
      input: TInput,
      strategy: AnalysisStrategy<TInput, TOutput>,
    ): Promise<Result<TOutput, AnalysisError & { message: string }>>;
  }

  // 中心線：戦略パターン（柔軟性担保）
  export interface AnalysisStrategy<TInput, TOutput> {
    execute(
      input: TInput, 
      context: AnalysisContext
    ): Promise<Result<TOutput, AnalysisError & { message: string }>>;
  }

  // 中心線：スキーマベース解析（型安全性）
  export interface SchemaBasedAnalyzer<TSchema, TResult> {
    process(
      data: FrontMatterContent,
      schema: SchemaDefinition<TSchema>,
    ): Promise<Result<TResult, AnalysisError & { message: string }>>;
  }
}
```

## 2. 全域性原則適用による型安全強化

### 2.1 部分関数の排除（Smart Constructor）

```typescript
// ❌ 旧：部分関数（null許可）
extractFrontMatter(content: string): FrontMatterContent | null

// ✅ 新：全域関数（Result型）
export class FrontMatterContent {
  private constructor(readonly data: Record<string, unknown>) {}
  
  static fromYaml(yamlContent: string): Result<FrontMatterContent, ValidationError & { message: string }> {
    if (!yamlContent.trim()) {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }
    try {
      const parsed = this.parseYaml(yamlContent);
      return { ok: true, data: new FrontMatterContent(parsed) };
    } catch (error) {
      return { 
        ok: false, 
        error: createError({ kind: "ParseError", input: yamlContent }) 
      };
    }
  }
}

// 制約のあるファイルパス
export class ValidFilePath {
  private constructor(readonly value: string) {}
  
  static create(path: string): Result<ValidFilePath, ValidationError & { message: string }> {
    if (!path || path.trim().length === 0) {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
    }
    if (!path.endsWith('.md')) {
      return { 
        ok: false, 
        error: createError({ 
          kind: "PatternMismatch", 
          value: path, 
          pattern: "*.md" 
        })
      };
    }
    return { ok: true, data: new ValidFilePath(path.trim()) };
  }
}
```

### 2.2 状態表現のDiscriminated Union化

```typescript
// ❌ 旧：オプショナルプロパティ
interface AnalysisContext {
  schema?: SchemaDefinition;
  template?: unknown;
  options?: Record<string, unknown>;
}

// ✅ 新：タグ付きユニオン（網羅性担保）
export type AnalysisContext = 
  | { 
      kind: "SchemaAnalysis"; 
      schema: SchemaDefinition; 
      options: AnalysisOptions 
    }
  | { 
      kind: "TemplateMapping"; 
      template: TemplateDefinition; 
      schema?: SchemaDefinition 
    }
  | { 
      kind: "ValidationOnly"; 
      schema: SchemaDefinition 
    }
  | { 
      kind: "BasicExtraction"; 
      options: AnalysisOptions 
    };

// 網羅的処理（default不要）
function processAnalysis(context: AnalysisContext): ProcessingResult {
  switch (context.kind) {
    case "SchemaAnalysis":
      return processWithSchema(context.schema, context.options);
    case "TemplateMapping":
      return processWithTemplate(context.template, context.schema);
    case "ValidationOnly":
      return validateAgainstSchema(context.schema);
    case "BasicExtraction":
      return basicExtractionProcess(context.options);
  }
}
```

### 2.3 包括的エラー型システム

```typescript
// 統合ドメインエラー定義
export type DomainError = 
  | ValidationError
  | AnalysisError  
  | PipelineError
  | FileSystemError
  | ExternalServiceError;

export type AnalysisError =
  | { kind: "SchemaValidationFailed"; schema: unknown; data: unknown }
  | { kind: "TemplateMappingFailed"; template: unknown; source: unknown }
  | { kind: "ExtractionStrategyFailed"; strategy: string; input: unknown }
  | { kind: "AIServiceError"; service: string; statusCode?: number };

export type PipelineError =
  | { kind: "FileDiscoveryFailed"; directory: string; pattern?: string }
  | { kind: "ProcessingStageError"; stage: string; error: DomainError }
  | { kind: "ConfigurationError"; config: unknown }
  | { kind: "ResourceExhausted"; resource: string; limit: number };

// 共通エラー生成
export const createDomainError = (
  error: DomainError,
  customMessage?: string,
): DomainError & { message: string } => ({
  ...error,
  message: customMessage || getDefaultErrorMessage(error),
});
```

## 3. エントロピー制御による境界明確化

### 3.1 中核周辺境界線の設計

```typescript
// 【中核ドメイン】- 最高凝集・最小結合
export namespace CoreDomain {
  // 中心線構成要素のみ
  export { AnalysisEngine } from './engines/analysis-engine.ts';
  export { SchemaBasedAnalyzer } from './analyzers/schema-based.ts';
  export { AnalysisStrategy } from './strategies/analysis-strategy.ts';
  
  // 基盤型のみ
  export type { AnalysisResult, AnalysisContext } from './types.ts';
}

// 【支援ドメイン】- 中核支援特化
export namespace SupportingDomain {
  // ファイル発見（標準的処理）
  export namespace FileDiscovery {
    export class FileDiscoveryService {
      async discoverFiles(
        directory: string, 
        pattern?: RegExp
      ): Promise<Result<ValidFilePath[], FileSystemError & { message: string }>> {
        // 実装
      }
    }
  }
  
  // レジストリ構築（出力特化）
  export namespace RegistryBuilding {
    export class RegistryBuilder<T> {
      build(results: Map<string, T>): Result<Registry<T>, ValidationError & { message: string }> {
        // 実装
      }
    }
  }
}

// 【汎用ドメイン】- 外部統合
export namespace GenericDomain {
  // 外部AIサービス統合
  export interface ExternalAnalysisService {
    analyze(prompt: string, data: unknown): Promise<Result<unknown, ExternalServiceError & { message: string }>>;
  }
  
  // ファイルシステム統合
  export interface FileSystemProvider {
    readFile(path: ValidFilePath): Promise<Result<string, FileSystemError & { message: string }>>;
    writeFile(path: ValidFilePath, content: string): Promise<Result<void, FileSystemError & { message: string }>>;
  }
}
```

### 3.2 機能引力による自然な凝集

**強引力クラスタ（統合推奨）**：
```typescript
// Schema Analysis Cluster（強引力→統合）
export class SchemaAnalysisCluster {
  constructor(
    private analyzer: SchemaBasedAnalyzer,
    private validator: SchemaValidator,
    private mapper: TemplateMapper,
  ) {}
  
  async processWithSchema<T>(
    frontMatter: FrontMatterContent,
    schema: SchemaDefinition<T>,
    template?: TemplateDefinition,
  ): Promise<Result<T, AnalysisError & { message: string }>> {
    // 凝集した処理
  }
}

// Pipeline Processing Cluster（強引力→統合）
export class PipelineProcessingCluster {
  constructor(
    private fileDiscovery: FileDiscoveryService,
    private extractor: FrontMatterExtractionService,
    private processor: SchemaAnalysisCluster,
  ) {}
}
```

**弱引力要素（分離維持）**：
- ファイルI/O（外部システム依存）
- Claude API統合（外部サービス）
- 設定管理（環境依存）

## 4. 設計意図の継承と拡張性

### 4.1 プラガブル設計パターン

```typescript
// 戦略差し替え可能設計
export interface AnalysisStrategyFactory {
  createExtractionStrategy(): AnalysisStrategy<FrontMatterContent, ExtractedData>;
  createMappingStrategy(): AnalysisStrategy<ExtractedData, MappedResult>;
}

// 設定駆動ファクトリ
export class ConfigurablePipelineFactory {
  static create(config: PipelineConfiguration): Result<AnalysisPipeline, ConfigurationError & { message: string }> {
    return PipelineConfiguration.validate(config)
      .map(validConfig => new AnalysisPipeline(
        validConfig.createFileDiscovery(),
        validConfig.createAnalysisEngine(),
        validConfig.createResultProcessor(),
      ));
  }
}
```

### 4.2 型安全な拡張ポイント

```typescript
// 型安全なカスタムアナライザー追加
export abstract class CustomAnalyzer<TInput, TOutput> {
  abstract readonly analyzerType: string;
  abstract process(input: TInput): Promise<Result<TOutput, AnalysisError & { message: string }>>;
}

// プラグインシステム
export class AnalyzerRegistry {
  private analyzers = new Map<string, CustomAnalyzer<any, any>>();
  
  register<TInput, TOutput>(
    analyzer: CustomAnalyzer<TInput, TOutput>
  ): Result<void, ValidationError & { message: string }> {
    if (this.analyzers.has(analyzer.analyzerType)) {
      return { 
        ok: false, 
        error: createDomainError({ 
          kind: "DuplicateRegistration", 
          type: analyzer.analyzerType 
        })
      };
    }
    this.analyzers.set(analyzer.analyzerType, analyzer);
    return { ok: true, data: undefined };
  }
}
```

## 5. 実装完了条件

### 5.1 Totality適用完了指標
- [ ] `null`/`undefined`戻り値→Result型変換完了
- [ ] オプショナルプロパティ→Discriminated Union変換完了  
- [ ] `switch`文に`default`不要（網羅性担保）
- [ ] Smart Constructor適用（制約のある値）
- [ ] 型アサーション使用量最小化

### 5.2 エントロピー制御完了指標
- [ ] クラス数25→20以下（20%削減）
- [ ] インターフェース数15→10以下（33%削減）
- [ ] 抽象化層4→3以下（簡素化）
- [ ] 最大メソッド複雑度10以下
- [ ] 依存深度3以下

### 5.3 機能引力バランス指標
- [ ] 強引力クラスタ統合完了
- [ ] 弱引力要素分離確認
- [ ] 質量中心保護（中核ドメイン安定性）
- [ ] 拡張ポイント明確化

## 6. 継続的品質管理

### 6.1 自動品質監視

```typescript
// CI統合品質ゲート
export const ArchitectureHealthCheck = {
  checkTotalityCompliance(): boolean {
    return [
      this.countPartialFunctions() === 0,
      this.countOptionalProperties() === 0,
      this.countTypeAssertions() < 5,
    ].every(Boolean);
  },
  
  checkEntropyControl(): boolean {
    const metrics = this.calculateComplexityMetrics();
    return [
      metrics.classCount <= 20,
      metrics.interfaceCount <= 10,
      metrics.abstractionLayers <= 3,
    ].every(Boolean);
  }
};
```

### 6.2 設計原則遵守チェック

```bash
# 定期実行推奨
npm run architecture:check
npm run totality:validate  
npm run entropy:monitor
```

この設計により、科学的原理に基づく持続可能で拡張性の高いドメインアーキテクチャを構築し、AI開発における複雑化を制御しつつ、ビジネス価値の最大化を図る。