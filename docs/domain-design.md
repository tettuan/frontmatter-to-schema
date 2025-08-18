# ドメイン設計書 - 汎用フロントマター解析システム

## 1. ドメイン境界の定義

### 1.1 コアドメイン

**FrontMatter Analysis Domain（フロントマター解析ドメイン）**
- 責務: 任意のマークダウンファイルからフロントマターを抽出し、スキーマベースで構造化データへ変換
- 主要概念:
  - FrontMatter: マークダウンファイルのメタデータ
  - Schema: 出力構造の型定義（汎用的）
  - Template: スキーマに基づく出力フォーマット（汎用的）

### 1.2 サポートドメイン

**File Discovery Domain（ファイル探索ドメイン）**
- 責務: 対象ファイルの探索と列挙（任意のディレクトリ構造対応）
- 主要概念:
  - FilePattern: ファイル探索パターン
  - FileList: 発見されたファイルのコレクション

**AI Analysis Domain（AI解析ドメイン）**
- 責務: Claude APIを使用した柔軟で汎用的な解析
- 主要概念:
  - AnalysisEngine: 解析エンジンインターフェース
  - AnalysisStrategy: 解析戦略（抽出/マッピング）

**Registry Building Domain（レジストリ構築ドメイン）**
- 責務: 解析結果の統合と任意フォーマットでの保存
- 主要概念:
  - Registry: 解析結果の集約
  - OutputFormatter: 出力フォーマッター（JSON/YAML/etc）

## 2. レイヤードアーキテクチャ（抽象化重視）

```
┌─────────────────────────────────────┐
│      Application Layer              │
│  - Generic UseCases                 │
│  - Configurable Services            │
└─────────────────────────────────────┘
        ↓ (依存性注入)
┌─────────────────────────────────────┐
│      Domain Layer                   │
│  - Abstract Models                  │
│  - Generic Processors               │
│  - Strategy Interfaces              │
└─────────────────────────────────────┘
        ↓ (インターフェース)
┌─────────────────────────────────────┐
│    Infrastructure Layer             │
│  - Pluggable Implementations        │
│  - External API Adapters            │
│  - Format Converters                │
└─────────────────────────────────────┘
```

## 3. 汎用ドメインモデル

### 3.1 値オブジェクト（汎用的）

```typescript
// 汎用ファイルパス
class FilePath {
  constructor(readonly value: string) {}
  
  isMarkdown(): boolean {
    return this.value.endsWith('.md');
  }
}

// 汎用フロントマター
class FrontMatterContent {
  constructor(readonly data: Record<string, unknown>) {}
  
  get(key: string): unknown {
    return this.data[key];
  }
}

// 汎用スキーマ定義
class SchemaDefinition<T = any> {
  constructor(readonly schema: T) {}
  
  validate(data: unknown): boolean {
    // スキーマバリデーションロジック
    return true;
  }
}
```

### 3.2 エンティティ（汎用的）

```typescript
// 汎用ソースファイル
class SourceFile {
  constructor(
    readonly path: FilePath,
    readonly frontMatter: FrontMatterContent | null,
    readonly content: string
  ) {}
}

// 汎用解析結果
class AnalysisResult<T = any> {
  constructor(
    readonly sourceFile: FilePath,
    readonly extractedData: T,
    readonly metadata: Map<string, unknown>
  ) {}
}
```

### 3.3 集約（汎用的）

```typescript
// 汎用レジストリ
class Registry<T = any> {
  private results = new Map<string, AnalysisResult<T>>();
  
  add(key: string, result: AnalysisResult<T>): void {
    this.results.set(key, result);
  }
  
  transform<U>(transformer: Transformer<T, U>): U {
    return transformer.transform(this.results);
  }
}
```

## 4. 抽象化されたドメインサービス

```typescript
// 汎用解析エンジンインターフェース
interface AnalysisEngine {
  analyze<T, U>(
    input: T,
    strategy: AnalysisStrategy<T, U>
  ): Promise<U>;
}

// 解析戦略インターフェース
interface AnalysisStrategy<T, U> {
  execute(input: T, context: AnalysisContext): Promise<U>;
}

// フロントマター抽出器インターフェース
interface FrontMatterExtractor {
  extract(content: string): FrontMatterContent | null;
}

// 汎用トランスフォーマー
interface Transformer<T, U> {
  transform(data: Map<string, T>): U;
}
```

## 5. 処理フロー（汎用化）

```typescript
// 汎用処理パイプライン
class AnalysisPipeline<T> {
  constructor(
    private extractor: FrontMatterExtractor,
    private engine: AnalysisEngine,
    private transformer: Transformer<AnalysisResult, T>
  ) {}
  
  async process(files: FilePath[]): Promise<T> {
    const registry = new Registry<AnalysisResult>();
    
    for (const file of files) {
      // 1. ファイル読み込み
      const content = await this.readFile(file);
      
      // 2. フロントマター抽出
      const frontMatter = this.extractor.extract(content);
      
      // 3. AI解析（戦略パターン）
      const extractionStrategy = new ExtractionStrategy();
      const extracted = await this.engine.analyze(
        frontMatter,
        extractionStrategy
      );
      
      // 4. マッピング（戦略パターン）
      const mappingStrategy = new MappingStrategy();
      const mapped = await this.engine.analyze(
        extracted,
        mappingStrategy
      );
      
      // 5. レジストリへ追加
      const result = new AnalysisResult(file, mapped, new Map());
      registry.add(file.value, result);
    }
    
    // 6. 変換して出力
    return this.transformer.transform(registry);
  }
}
```

## 6. Claude APIプロンプト設計（汎用的）

### 6.1 情報抽出プロンプト（汎用）
```typescript
class ExtractionPrompt {
  constructor(
    private schema: SchemaDefinition,
    private context: string = ""
  ) {}
  
  generate(frontMatter: FrontMatterContent): string {
    return `
      Given the following frontmatter data and schema,
      extract structured information:
      
      FrontMatter: ${JSON.stringify(frontMatter.data)}
      Schema: ${JSON.stringify(this.schema.schema)}
      Context: ${this.context}
      
      Return extracted data matching the schema.
    `;
  }
}
```

### 6.2 テンプレートマッピングプロンプト（汎用）
```typescript
class MappingPrompt {
  constructor(
    private template: any,
    private rules: MappingRules = {}
  ) {}
  
  generate(data: any): string {
    return `
      Map the following data to the template structure:
      
      Data: ${JSON.stringify(data)}
      Template: ${JSON.stringify(this.template)}
      Rules: ${JSON.stringify(this.rules)}
      
      Return the filled template.
    `;
  }
}
```

## 7. 拡張ポイント

### 7.1 プラガブルコンポーネント
- **Extractor**: Deno標準、gray-matter、custom実装
- **AnalysisEngine**: Claude API、OpenAI API、ローカル処理
- **Transformer**: JSON、YAML、XML、Custom形式
- **FileDiscovery**: glob、regex、custom patterns

### 7.2 設定駆動
```typescript
interface AnalysisConfig {
  // 入力設定
  input: {
    patterns: string[];
    extractor: 'deno' | 'gray-matter' | 'custom';
  };
  
  // 処理設定
  processing: {
    engine: 'claude' | 'openai' | 'local';
    strategies: AnalysisStrategy[];
  };
  
  // 出力設定
  output: {
    format: 'json' | 'yaml' | 'custom';
    schema: SchemaDefinition;
    template: any;
  };
}
```

## 8. ユビキタス言語（汎用版）

- **Source**: 入力となる任意のマークダウンファイル
- **FrontMatter**: ファイルのメタデータ部分（汎用）
- **Schema**: データ構造の定義（カスタマイズ可能）
- **Template**: 出力フォーマットの雛形（カスタマイズ可能）
- **Registry**: 解析結果の汎用コンテナ
- **Pipeline**: 処理の流れ（設定可能）
- **Strategy**: 解析方法（差し替え可能）
- **Transformer**: データ変換器（プラガブル）