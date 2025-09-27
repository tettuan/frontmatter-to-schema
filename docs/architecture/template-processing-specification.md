# Template Processing System Specification

## 1. 概要

本仕様は、requirements.ja.mdとflow.ja.mdに基づき、3つの独立したドメインによるテンプレート処理システムを定義する。

## 2. アーキテクチャ原則

### 2.1 3ドメイン分離

システムは以下の3つの独立したドメインに分離される：

1. **フロントマター解析ドメイン**: Markdownファイルからのデータ抽出
2. **テンプレート管理ドメイン**: 出力テンプレートの管理と提供
3. **データ処理指示ドメイン**: フロントマターデータの加工と提供（隠蔽層）

### 2.2 データアクセスの隠蔽

flow.ja.mdの原則：

> 「1.フロントマター解析の構造」が直接参照されることはなく、「3.解析結果データの処理指示」によって隠蔽されている

## 3. 処理フロー

### 3.1 全体の処理フロー

```mermaid
graph TB
    subgraph "初期化フェーズ"
        CLI[CLI起点] --> Schema[Schema読取]
        Schema --> Decompose[3ドメインへ分解]
    end

    subgraph "個別ファイル処理フェーズ"
        Decompose --> FM[フロントマター解析]
        FM --> Extract[データ抽出]
        Extract --> FMP[x-frontmatter-part識別]
    end

    subgraph "統合処理フェーズ"
        FMP --> DP[データ処理指示]
        DP --> Flatten[x-flatten-arrays]
        Flatten --> Filter[x-jmespath-filter]
        Filter --> Derive[x-derived-from]
        Derive --> Unique[x-derived-unique]
    end

    subgraph "テンプレート展開フェーズ"
        Unique --> TM[テンプレート管理]
        TM --> Load[テンプレート読込]
        Load --> Engine[テンプレートエンジン]
        Engine --> Render[変数置換・{@items}展開]
        Render --> Output[最終出力]
    end

    style FM fill:#f9f
    style TM fill:#bbf
    style DP fill:#bfb
```

### 3.2 コンポーネント階層

```
1. CLI (エントリポイント)
    ↓
2. SchemaOrchestrator (Schema統括)
    ↓
3. DomainDecomposer (3ドメインへ分解)
    ↓
4. 並行処理:
   - FrontmatterExtractor (フロントマター解析ドメイン)
   - TemplateManager (テンプレート管理ドメイン)
   - DataProcessor (データ処理指示ドメイン)
    ↓
5. TemplateEngine (アプリケーション層)
    ↓
6. OutputWriter (インフラ層)
```

## 4. ドメイン間のインターフェース

### 4.1 フロントマター解析 → データ処理指示

```typescript
interface FrontmatterToDataProcessing {
  // フロントマター解析ドメインが提供
  getExtractedData(): ExtractedData[];

  // データ処理指示ドメインが使用
  initialize(data: ExtractedData[]): void;
  callMethod(schemaPath: string): ProcessedData;
}
```

### 4.2 テンプレート管理 → テンプレートエンジン

```typescript
interface TemplateToEngine {
  // テンプレート管理ドメインが提供
  getTemplate(type: "main" | "items"): Template;

  // テンプレートエンジンが使用
  loadTemplate(path: string): Template;
}
```

### 4.3 データ処理指示 → テンプレートエンジン

```typescript
interface DataProcessingToEngine {
  // データ処理指示ドメインが提供（隠蔽層）
  getProcessedData(path: string): unknown;

  // テンプレートエンジンが使用
  resolveVariable(variablePath: string): unknown;
}
```

## 5. テンプレート変数解決

### 5.1 変数解決の起点

flow.ja.mdの61-74行目に基づく：

#### x-template内の変数

- **起点**: Schemaのroot
- **例**: `{version}` → `root.version`
- **例**: `{tools.availableConfigs}` → `root.tools.availableConfigs`

#### x-template-items内の変数

- **起点**: x-frontmatter-part指定階層
- **例**: commandsがx-frontmatter-partの場合
  - `{c1}` → `commands[].c1`と同義
  - `{description}` → `commands[].description`と同義

### 5.2 {@items}展開のタイミング

flow.ja.mdの59行目：

> `{@items}`は全フロントマターファイルの処理完了後に確定される

処理順序：

1. 個別ファイル処理（フロントマター抽出）
2. 全ファイル統合（x-frontmatter-part配列の統合）
3. データ処理（x-ディレクティブ適用）
4. {@items}配列の確定
5. x-template-itemsによる各要素の展開

## 6. 中間表現層（IR）

### 6.1 IRの役割

データ処理指示ドメイン内で、ディレクティブ処理後のデータを正規化：

```typescript
class TemplateIntermediateRepresentation {
  // フロントマターデータから構築
  static fromFrontmatterData(data: ExtractedData[]): IR;

  // パスによるデータアクセス（隠蔽層の実装）
  resolve(path: string): unknown;

  // スコープ管理
  createScope(path: string): Scope;
}
```

### 6.2 スコープ管理

配列展開時のコンテキスト保持：

```typescript
class TemplateContext {
  private scopeStack: Scope[];

  // 配列要素への入場
  enterArray(arrayPath: string): void;

  // 変数解決（スコープチェーン）
  resolve(variable: string): unknown;

  // 配列要素からの退出
  exitArray(): void;
}
```

## 7. 処理タイミングの詳細

### 7.1 フェーズ1: 個別ファイル処理

**責務ドメイン**: フロントマター解析ドメイン

1. Markdownファイルの読み込み
2. フロントマター部分の抽出
3. YAMLパース
4. x-frontmatter-part指定階層の識別
5. 構造化データとして保持

### 7.2 フェーズ2: 統合処理

**責務ドメイン**: データ処理指示ドメイン

1. 全ファイルのデータ統合
2. x-flatten-arrays（指定時のみ）
3. x-jmespath-filter
4. x-derived-from
5. x-derived-unique

### 7.3 フェーズ3: テンプレート展開

**責務ドメイン**: テンプレートエンジン（アプリケーション層）

1. x-templateファイルの読み込み
2. x-template-itemsファイルの読み込み
3. 変数の識別と抽出
4. {@items}の展開
5. 変数の置換
6. 最終出力の生成

## 8. エラーハンドリング

### 8.1 ドメインエラー

各ドメインは独自のエラー型を定義：

```typescript
// フロントマター解析エラー
type FrontmatterError =
  | { kind: "FileNotFound" }
  | { kind: "InvalidYaml" }
  | { kind: "MissingFrontmatter" };

// テンプレート管理エラー
type TemplateError =
  | { kind: "TemplateNotFound" }
  | { kind: "InvalidFormat" }
  | { kind: "MissingVariable" };

// データ処理エラー
type ProcessingError =
  | { kind: "InvalidDirective" }
  | { kind: "PathNotFound" }
  | { kind: "ProcessingFailed" };
```

### 8.2 Result型による全体性

```typescript
type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// すべての処理はResult型を返す
function processTemplate(
  data: ProcessedData,
  template: Template,
): Result<Output, TemplateError>;
```

## 9. 重要な制約

### 9.1 items階層の省略

flow.ja.mdの42-51行目：

> Schemaにおいてtype:"array"の場合にitems:があるのは`[]`の各要素である

- ✅ 正しい: `commands[].c1`
- ❌ 誤り: `commands.items[].c1`

### 9.2 $refの独立性

requirements.ja.mdの分離原則：

- `$ref`はJSON Schemaの標準機能
- スキーマ構造の再利用にのみ使用
- テンプレート処理から完全に独立

### 9.3 デフォルト値の非生成

- デフォルト値の生成や補完を行わない
- JSON Schemaの`default`プロパティは無視
- 実際のフロントマターデータのみを処理

## 10. まとめ

本仕様により、以下が実現される：

1. **明確な責務分離**: 3つの独立ドメインによる処理
2. **データ隠蔽**: データ処理指示ドメインによるアクセス制御
3. **宣言的処理**: x-ディレクティブによる自動処理
4. **正確な変数解決**: 起点を明確にした変数スコープ管理
5. **堅牢性**: Result型による完全なエラーハンドリング
