# 要求事項

1. マークダウンのフロントマターを抽出し、解析する
2. フロントマターの柔軟性を保つため、Schemaに基づきTypeScriptによる構造化処理を使う（変数名の名寄せ）
3. 解析した結果をテンプレートフォーマットへ当て込み、書き出す

## 目的

Markdownファイルの索引(Index)を作るためである。
様々な形式の、様々な用途のMarkdownファイルがあり、多様なフロントマター定義が存在する。
厳格なSchema定義を用いて運用されていない中で、索引作りは難しい。
そこで、事後的に（FrontMatter入力時Validationや事前定義ではなく、作成されたMarkdownに対し）索引化する。

## 背景

その時々で、柔軟に運用できるメリットが、Markdownやフロントマターには存在する。
一方、厳格な型定義を通すことなく作成されるため、入力方法や名称も運用者依存になりがちである。
さらに、蓄積された過去のMarkdownを含めると、全てを事前定義して運用することは難しい。
こうした課題に対応する。

## 柔軟性を確保する理由

特定のパターンのみでハードコーディングする設計では、Schema変更に対応できない。
そのため、アプリケーションはSchemaとテンプレートを外部から読み込み、差し代え前提でSchema定義を用い、テンプレートへ出力する。

これにより、索引の仕様が変わっても
アプリケーションの変更を伴うこと無く、索引定義だけ変えられる。

また、プロンプト集の索引を作るケース、記事の索引を作るケースなども、Schemaとテンプレートのセットを差し替え、Markdownのファイルが置かれたPathや索引出力先を切り替えるだけで、同じアプリケーションで多様な索引作りが可能となる。

これが柔軟性確保の理由であり、「Schema指定にすることが、重要な要求事項である」ことの理由である。

## Schemaとテンプレートの役割

Schemaはフロントマターの解析構造を決め、テンプレートはフロントマターから得られた値の出力形式を決める。Schema解析結果が、テンプレートの変数へ埋め込まれる。

Schemaは、利用すべきテンプレートファイル名を有する。
テンプレートは、フロントマターやSchema定義に依存せず、形式を決められる。

**重要な分離原則**:

- `$ref`はJSON Schemaの標準機能であり、スキーマ構造の再利用にのみ使用される
- テンプレート指定は`x-template`（コンテナ）と`x-template-items`（アイテム）でのみ行う
- 両者は完全に独立しており、`$ref`はテンプレート処理に影響しない

### テンプレート処理の基本原則

**重要**:
テンプレートは出力フォーマットを完全に定義する。テンプレートに記載されたもののみが出力される。

- テンプレートファイルに書かれた内容がそのまま出力フォーマットとなる
- {variable.path}形式の変数のみが実際の値に置換される
- {@items}形式は配列展開記法で、x-template-itemsで指定されたテンプレートを各アイテムに適用する
- Schemaによる構造の補完や追加は一切行われない
- x-frontmatter-part配列も同じルールに従う（特殊処理なし）

### `{@items}`展開の確定タイミング

`{@items}`は全フロントマターファイルの処理完了後に確定される：

#### 処理フロー

1. **個別ファイル処理**: 各Markdownファイルのフロントマター処理
   - フロントマター構造をそのまま保持（デフォルト）
   - `x-flatten-arrays`指定時のみ配列フラット化
   - 他のディレクティブ適用
2. **ファイル間統合**: 全ファイル処理完了後
   - `x-frontmatter-part: true`指定配列の統合
   - `{@items}`配列の確定
3. **テンプレート展開**: 統合完了後
   - `x-template-items`指定テンプレートで各要素を展開

#### 重要な特性

- **遅延確定**: `{@items}`は最後に確定される
- **全体統合**: 個別ファイルの結果を自動統合
- **配列起点**: `x-frontmatter-part: true`配列が`{@items}`の元データ
- **構造選択**: フラット化は`x-flatten-arrays`指定時のみ適用

### 対応出力フォーマット

システムは以下の構造化されたフォーマットをサポートしており、テンプレートに応じて出力形式を決定する：

- **JSON** (`.json`): JavaScriptオブジェクト記法による構造化データ
- **YAML** (`.yaml`, `.yml`): 人間が読みやすい構造化データ形式
- **Markdown** (`.md`): マークアップ文書フォーマット
- **XML** (`.xml`): 拡張マークアップ言語による構造化データ

# 成果物

1. 要求の整理と要件化
2. 機能要件、非機能要件の分離
3. ドメイン境界線の設計資料の作成
4. 実装された解析のスクリプトと堅牢なテスト
5. TypeScript処理ロジック（Schemaの$refにも対応し、再帰的に解析する）
6. examples/ に実例を使った実行例が存在する

# 解析の手順

一覧： まず、マークダウンファイルの一覧を作る。(成果A)
また、最終成果物を空の状態でつくる（最終成果物Z）

各マークダウンファイル： 成果Aのなかの繰り返し処理に相当する。
各ループ内では、マークダウンファイル1つずつを処理する。ループ処理は、マークダウンファイル全件に対して実施する。

最初にフロントマター部分を抽出する。これはTypeScriptで実施する。(成果B)
成果Bから、TypeScriptで解析する。（成果C）
成果Cを元にTypeScriptでSchema構造データで保持する（成果D）
成果Dをテンプレートの変数へ当てこむ。（成果E）
成果Eを統合し、最終成果物Zを得る。成果物Zは、Schemaで指定されたx-templateとx-template-items
を用いて得られた成果Eを統合したものである。なお、$ref
はスキーマ構造の再利用にのみ使用され、テンプレート処理とは独立している。
最後に、成最終成果物Zを保存する。

一覧のなかで、どの配列構造が各マークダウンファイルの処理に用いれるかは、`"x-frontmatter-part": true`
で判定する。

## サブモジュール構成

本システムは、以下の独立したサブモジュールを使用して処理を実現する：

### 1. yaml-schema-mapper

**責任範囲**: フロントマターデータのSchema変換

- **適用フェーズ**: フロントマター抽出直後（成果B → 成果C）
- **処理内容**:
  - プロパティ名のマッピング（`file` → `input_file` など）
  - 型変換（`[false]` → `false`、`"42"` → `42` など）
  - Schema準拠データへの変換
- **使用場所**: `FrontmatterData.create()` 内部
- **モジュールパス**: `sub_modules/yaml-schema-mapper/`

**詳細**:

フロントマターの多様な記法（snake_case, camelCase,
kebab-case等）をSchema定義に基づいて正規化し、型変換を行う。

- Property mapping: Exact match → Case-insensitive → Heuristic matching
- x-map-from directive: 明示的なプロパティマッピング指定
- Type coercion: Array ↔ single value, string → number/boolean など
- Validation: Required properties, enum, pattern など

**変換例**:

```yaml
# Input (frontmatter)
file: [false]
stdin: [true]

# Schema
properties:
  input_file: { type: "boolean", x-map-from: "file" }
  stdin: { type: "boolean" }

# Output (schema-compliant)
input_file: false
stdin: true
```

### 2. data-path-resolver

**責任範囲**: `x-derived-from` ディレクティブのパス式解決

- **適用フェーズ**: フェーズ2（全体統合）の集約処理
- **処理内容**:
  - ドット記法によるネストアクセス (`user.profile.name`)
  - 配列展開構文 (`items[]`)
  - プロパティ付き配列展開 (`items[].name`)
  - 二重展開によるフラット化 (`articles[].tags[]`)
- **使用場所**: `schema-directive-processor.ts` 内の `x-derived-from` 処理
- **モジュールパス**: `sub_modules/data-path-resolver/`

**重要**: テンプレート変数（`{variable.path}`）の解決には使用しない。

### 3. json-template

**責任範囲**: テンプレート変数の置換処理

- **適用フェーズ**: フェーズ3（テンプレート展開）
- **処理内容**:
  - `{variable.path}` 形式の変数置換
  - ドット記法による階層データアクセス
  - 配列要素への直接アクセス (`{items[0].name}`)
- **使用場所**: `template.ts` 内の `x-template-items` 処理
- **モジュールパス**: `sub_modules/json-template/`

**重要**: `{@items}` 記法による配列展開は含まれない（親システム側で実装）。

### モジュール責任の明確な区別

| 項目                     | yaml-schema-mapper        | data-path-resolver      | json-template                    |
| ------------------------ | ------------------------- | ----------------------- | -------------------------------- |
| **適用フェーズ**         | フロントマター解析直後    | フェーズ2（全体統合）   | フェーズ3（テンプレート展開）    |
| **処理対象**             | 生YAML → Schema準拠データ | `x-derived-from` パス式 | テンプレート内 `{variable.path}` |
| **配列展開構文**         | ❌                        | ✅ (`items[]`)          | ❌                               |
| **型変換**               | ✅                        | ❌                      | ❌                               |
| **プロパティマッピング** | ✅                        | ❌                      | ❌                               |
| **独立性**               | 完全独立                  | 完全独立                | 完全独立                         |

### 処理フロー全体像

```
1. フロントマター抽出 (YAML parsing)
   ↓
2. yaml-schema-mapper による変換 ← ★ Schema準拠データへ変換
   - Property mapping (file → input_file)
   - Type coercion ([false] → false)
   - Schema validation
   ↓
3. フェーズ1処理 (x-flatten-arrays, x-jmespath-filter)
   ↓
4. フェーズ2処理 (全体統合)
   - x-derived-from (data-path-resolver 使用)
   - x-derived-unique
   ↓
5. フェーズ3処理 (テンプレート展開)
   - x-template-items (json-template 使用)
   - {@items} 展開 (親システム)
```

## フロントマター処理機能

フロントマターの多様な構造に対応し、テンプレート処理用のデータを準備する機能を提供する。

### 基本ディレクティブ

#### `x-frontmatter-part: true`

このディレクティブが設定された配列が、各Markdownファイルのフロントマター処理の起点となる。

#### `x-flatten-arrays` (オプション)

フロントマター内部のネストした配列構造をフラット化し、テンプレート処理用の均一な配列を生成する。

```json
{
  "items": {
    "type": "array",
    "x-frontmatter-part": true,
    "x-flatten-arrays": "traceability",
    "x-template-items": "item_template.json"
  }
}
```

### フラット化の動作原理

`x-flatten-arrays`は**指定時のみ**適用される配列フラット化機能：

| フロントマター構造                | 指定                                 | 処理結果                       |
| --------------------------------- | ------------------------------------ | ------------------------------ |
| `traceability: ["A", ["B", "C"]]` | `"x-flatten-arrays": "traceability"` | `["A", "B", "C"]`              |
| `traceability: "D"`               | 同上                                 | `["D"]`                        |
| `traceability: ["A", ["B", "C"]]` | **指定なし**                         | `["A", ["B", "C"]]` (構造維持) |
| 複数ファイル                      | 指定時                               | 全要素が`{@items}`で展開       |
| 複数ファイル                      | **指定なし**                         | 元構造のまま`{@items}`で展開   |

### 実現できること

1. **柔軟な構造対応**: フラット化の有無を用途に応じて選択可能
2. **Schema再利用**: 同一Schemaで多様なフロントマター構造に対応
3. **段階的移行**: 既存構造を維持しつつ新機能を段階導入
4. **処理の一貫性**: `{@items}`による統一的な配列展開

### 設計思想と`{@items}`の関係

「**書き手の自由度と読み手の処理効率を両立**」

- **フロントマター作成時**: 自然な構造を選択（配列、単一要素、ネスト等）
- **Schema定義時**: `x-flatten-arrays`で処理方針を選択
- **`{@items}`確定時**: 全ファイル処理後に統合された配列で展開
- **テンプレート側**: 一貫した`{@items}`配列でアクセス

### 完全な例：トレーサビリティID収集

#### 多様なフロントマター入力

```yaml
# ファイル1: ネスト配列
traceability: [["REQ-001", "REQ-002"], "REQ-003"]

# ファイル2: 単一要素
traceability: "REQ-004"
```

#### Schema定義（フラット化あり）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "trace_template.json",
  "properties": {
    "trace_ids": {
      "type": "array",
      "description": "フラット化されたトレーサビリティIDの一覧",
      "x-frontmatter-part": true,
      "x-flatten-arrays": "traceability",
      "x-derived-unique": true,
      "x-template-items": "trace_item_template.json"
    }
  }
}
```

#### Schema定義（構造維持）

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "x-template": "trace_template.json",
  "properties": {
    "trace_data": {
      "type": "array",
      "description": "元構造を維持したトレーサビリティデータ",
      "x-frontmatter-part": true,
      "x-template-items": "trace_nested_template.json"
    }
  }
}
```

#### 処理結果の比較

**フラット化あり**:
`["REQ-001", "REQ-002", "REQ-003", "REQ-004"]`として`{@items}`展開

**構造維持**:
`[[["REQ-001", "REQ-002"], "REQ-003"], "REQ-004"]`として`{@items}`展開

この柔軟性により、用途に応じた最適な処理方法を選択できる。

```text
- 一覧
  - コマンド繰り返し項目()
```

結果、以下のような構造になる。 出力:

```text
- 一覧
  - コマンド
  - コマンド
  - コマンド
```

## 一覧の整形

以下の整形処理がなされる。

### Schemaとテンプレート

利用するSchemaとテンプレート:　 registry_schema.json registry_template.json
なお、一覧1個に対し、個別マークダウンファイルn個の関係である。registry_template.json　は
registry_schema.json 内部で指定される。
（つまりregistry_schema.jsonファイルは、役割的にはidnex_schema.jsonと同じ意味である。）

### テンプレート指定機能

Schemaは、出力時に用いるテンプレートを内部的に指定できる。以下の2つの指定方法がある：

#### 1. コンテナテンプレート指定 (x-template)

`"x-template": "registry_template.json"`

メインのコンテナ構造を定義するテンプレートを指定する。

#### 2. アイテムテンプレート指定 (x-template-items)

`"x-template-items": "registry_command_template.json"`

`{@items}`
展開時に使用するテンプレートを指定する。この指定により、メインスキーマでアイテムテンプレートを集中管理でき、設定が簡素化される。

#### テンプレート変数の参照方法

テンプレートには、Schema階層を指定した変数名を記載しており、テンプレート処理は
`{id.full}` 形式で参照した変数をSchema値で置換する。 例)
`{id.full}`は、`req:api:deepresearch-3f8d2a#20250909` へ置換される。

Schemaのroot階層は、"x-template" と並列の"properties"を起点とする。 {id.full}
と記述する場合は

```json
"x-template": "registry_template.json",
"x-template-items": "registry_command_template.json",
"properties":
  "id":
    "full":
```

である。

### テンプレート処理実装: sub_modules/json-template モジュールの使用

`x-template-items`で指定されたテンプレートファイルの変数置換処理には、`sub_modules/json-template`モジュールを使用する。

#### モジュールの責任範囲

**json-templateモジュール:**

- `{variable.path}` 形式の変数置換
- ドット記法による階層データアクセス
- 配列要素への直接アクセス (`{items[0].name}`)
- テンプレートファイルの読み込みとJSON解析
- 変数解決エラーの詳細な報告

**フロントマターシステム:**

- `{@items}` 記法による配列展開制御
- `x-frontmatter-part: true` データの統合処理
- 各配列要素へのテンプレート適用反復
- 最終的な出力フォーマット統合

#### 統合処理の流れ

1. **データ準備**: `x-frontmatter-part: true`配列から統合データを生成
2. **個別処理**: 各配列要素に対して：
   ```typescript
   import { createTemplateProcessor } from "./sub_modules/json-template/mod.ts";
   const processor = createTemplateProcessor();
   const result = await processor.process(itemData, templateFilePath);
   ```
3. **結果統合**: 全ての処理結果を`{@items}`位置に挿入

#### 制約事項

- **テンプレートはファイル形式必須**: インメモリ文字列テンプレートは未対応
- **JSON出力限定**: テンプレート結果は有効なJSON構造である必要
- **`{@items}`は外部実装**: json-templateモジュール自体は配列展開機能を持たない

この設計により、汎用的なテンプレート処理機能を再利用しつつ、フロントマター固有の要件を満たすことができる。

## データ抽出・変換ディレクティブ

Schemaで使用可能な`x-*`ディレクティブの完全なリファレンス。

### テンプレート制御

| ディレクティブ     | 型     | 説明                                   | 適用対象       |
| ------------------ | ------ | -------------------------------------- | -------------- |
| `x-template`       | string | コンテナテンプレートファイル指定       | ルートスキーマ |
| `x-template-items` | string | `{@items}`展開時のアイテムテンプレート | ルートスキーマ |

### データ抽出

| ディレクティブ       | 型      | 説明                                           | 適用対象       |
| -------------------- | ------- | ---------------------------------------------- | -------------- |
| `x-frontmatter-part` | boolean | 各Markdownファイル処理の起点を指定             | 配列プロパティ |
| `x-flatten-arrays`   | string  | 指定プロパティの配列をフラット化（オプション） | 配列プロパティ |
| `x-collect-pattern`  | object  | 正規表現パターンにマッチするプロパティを収集   | 配列プロパティ |

#### `x-collect-pattern` ディレクティブ

動的なプロパティ名（`uv-*`等のワイルドカードパターン）をkey-value配列として収集する。

**パラメータ**:

| パラメータ | 型     | 必須 | 説明                                   |
| ---------- | ------ | ---- | -------------------------------------- |
| `source`   | string | Yes  | 収集対象オブジェクトへのパス（ドット記法） |
| `pattern`  | string | Yes  | 正規表現パターン（ECMAScript）         |

**使用例**:

```json
{
  "user_variables": {
    "type": "array",
    "x-collect-pattern": {
      "source": "options",
      "pattern": "^uv-.*$"
    },
    "items": {
      "type": "object",
      "properties": {
        "key": { "type": "string" },
        "value": { "type": "string" }
      }
    }
  }
}
```

**収集結果**:

```json
[
  { "key": "uv-scope", "value": "domain architecture" },
  { "key": "uv-date", "value": "2025-06-08" }
]
```

**処理タイミング**: yaml-schema-mapper処理時（フロントマター抽出と同タイミング）

**前提条件**: 収集元オブジェクトに`additionalProperties: true`が必要

**詳細仕様**: [x-collect-pattern-specification.md](./architecture/x-collect-pattern-specification.md)

**重要な制約事項**:

- デフォルト値に関する機能は一切実装しません
- JSON Schemaの`default`プロパティも使用しません
- 値の生成、補完、初期値設定などの機能は実装対象外です
- 本システムは実際のフロントマターデータの抽出と変換のみを行います
- 存在しないデータに対する値の補完や生成は行いません

### データ変換

| ディレクティブ      | 型      | 説明                           | 適用対象         |
| ------------------- | ------- | ------------------------------ | ---------------- |
| `x-derived-from`    | string  | 他のプロパティから値を集約     | 任意のプロパティ |
| `x-derived-unique`  | boolean | 配列の重複を削除               | 配列プロパティ   |
| `x-jmespath-filter` | string  | JMESPath式によるフィルタリング | 配列プロパティ   |

### 処理順序と確定タイミング

ディレクティブは以下の順序で処理される：

#### フェーズ1: 個別ファイル処理

各Markdownファイルに対して順次実行：

1. **フロントマター抽出**
2. **配列フラット化**: `x-flatten-arrays`による個別配列処理（指定時のみ）
3. **フィルタリング**: `x-jmespath-filter`適用
4. **個別結果保存**: ファイル単位の処理結果を保持

#### フェーズ2: 全体統合（全ファイル処理完了後）

1. **配列統合**: `x-frontmatter-part: true`配列の統合
2. **集約処理**: `x-derived-from`による値の集約
3. **重複削除**: `x-derived-unique`適用
4. **`{@items}`確定**: テンプレート展開用配列の確定

#### フェーズ3: テンプレート展開

1. **メインテンプレート**: `x-template`適用
2. **アイテム展開**: `{@items}`を`x-template-items`で展開
3. **変数置換**: `{variable.path}`形式の変数を実際の値に置換
4. **最終出力**: 完成したフォーマットの出力

### パス解決実装: sub_modules/data-path-resolver モジュールの使用

**重要**: このモジュールは **`x-derived-from`ディレクティブ専用**
です。テンプレート変数（`{variable.path}`）の解決には使用しません（json-templateを使用）。
また、フロントマターのSchema変換には **yaml-schema-mapper** を使用します。

**3つのサブモジュールの使い分け**:

1. **yaml-schema-mapper**: フロントマターの生データ → Schema準拠データへの変換
   - プロパティ名マッピング、型変換、検証
2. **data-path-resolver**: `x-derived-from` でのパス式解決
   - 配列展開構文 (`items[]`) による値の集約
3. **json-template**: テンプレート変数 `{variable.path}` の置換
   - 階層データアクセス、配列インデックス指定

`x-derived-from`ディレクティブで指定されたパス式の解決には、`sub_modules/data-path-resolver`モジュールを使用する。

#### モジュールの責任範囲

**data-path-resolverモジュール:**

- ドット記法によるネストアクセス (`user.profile.name`)
- 配列インデックスアクセス (`items[0]`)
- 配列展開構文 (`items[]` - 配列の各要素を収集)
- プロパティ付き配列展開 (`items[].name` - 各要素のプロパティを収集)
- 二重展開によるフラット化 (`articles[].tags[]` - ネスト配列を自動フラット化)
- `Result<T, E>` パターンによる型安全なエラーハンドリング

**フロントマターシステム:**

- `x-derived-from` ディレクティブの処理制御
- `x-flatten-arrays` によるフロントマター内部の配列フラット化
- 複数ファイルからのデータ統合
- `x-derived-unique` による重複削除

#### モジュール責任の明確な区別

| 項目             | data-path-resolver                       | json-template                            |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| **適用フェーズ** | フェーズ2（全体統合）                    | フェーズ3（テンプレート展開）            |
| **処理対象**     | `x-derived-from` ディレクティブのパス式  | テンプレート内の `{variable.path}`       |
| **配列展開構文** | ✅ サポート (`items[]`)                  | ❌ サポート外                            |
| **使用場所**     | schema-directive-processor.ts            | template.ts (resolveVariables)           |
| **独立性**       | 完全独立（他サブモジュールに依存しない） | 完全独立（他サブモジュールに依存しない） |

**重要な相違点**:

- `x-derived-from: "commands[].c1"` → data-path-resolver が処理（配列展開あり）
- テンプレート内 `{commands[0].c1}` → json-template
  が処理（配列展開なし、インデックス指定のみ）

#### 統合処理の流れ

フェーズ2（全体統合）の集約処理において、以下のように使用される：

1. **パス式の指定**: Schema内の `x-derived-from` で収集元パスを指定
   ```json
   {
     "availableConfigs": {
       "type": "array",
       "x-derived-from": "commands[].c1"
     }
   }
   ```

2. **パス解決の実行**: data-path-resolver がパス式を解析して値を抽出
   ```typescript
   import { DataPathResolver } from "./sub_modules/data-path-resolver/mod.ts";
   const resolver = new DataPathResolver(aggregatedData);
   const result = resolver.resolveAsArray("commands[].c1");
   ```

3. **結果の統合**: 抽出された値を Schema で指定されたプロパティに設定

**注意**: このプロセスは **フェーズ2（全体統合）専用**
です。フェーズ3のテンプレート変数解決（`{variable.path}`）には json-template
を使用し、data-path-resolver は使用しません。

#### Issue #1217 の解決

data-path-resolver の二重展開構文 (`articles[].tags[]`)
により、YAML配列レンダリング時の配列のフラット化不足問題を解決する。

```typescript
// データ
{
  articles: [
    { tags: ["AI", "Cursor"] },
    { tags: ["Claude"] },
  ];
}

// パス式: "articles[].tags[]"
// 結果: ["AI", "Cursor", "Claude"]  ✅ 自動フラット化
```

この機能により、Schema定義で `"x-derived-from": "articles[].tags[]"`
と指定するだけで、ネストした配列構造を自動的にフラット化できる。

### パス記法の詳細

`x-derived-from`で使用可能なパス記法：

| 記法         | 例                       | 説明                                   |
| ------------ | ------------------------ | -------------------------------------- |
| ドット記法   | `id.full`                | ネストされたプロパティアクセス         |
| 配列展開     | `items[]`                | 配列の各要素を展開（単一要素も配列化） |
| 組み合わせ   | `traceability[].id.full` | 配列展開後にプロパティアクセス         |
| インデックス | `items[0]`               | 特定インデックスの要素（非推奨）       |

### 集約機能

一覧は、集約機能を持つ。 `"x-derived-from": "commands[].c1"`
のように、特定の階層から値を集約する処理を持つ。
各マークダウンファイルの処理が完了したあとに実行される。 さらに
`x-derived-unique: true`がある場合は、ユニーク化される。

**JMESPath フィルタリング**: `"x-jmespath-filter": "commands[?c1 == 'git']"`
のように、JMESPath式でデータの動的フィルタリングが可能である。
Schema解析時にJMESPath式が評価され、条件に合うデータのみが抽出される。

例えば、以下は、availableConfigs を利用可能なコマンドの c1 の集合体で構築する。

```
"availableConfigs": {
  "type": "array",
  "description": "Tool names array - each becomes available as climpt-{name}. Derived automatically from commands[].c1",
  "x-derived-from": "commands[].c1",
  "x-derived-unique": true,
  "items": {
    "type": "string"
  }
}
```

## 個別フロントマターの整形

一覧1個に対し、個別フロントマターn個の関係である。

以下の2種類を使い分ける。

a. マークダウンファイルのフロントマターと「解析用Schema」を使って情報を抽出する
b.抽出した情報を、テンプレート変数化し、テンプレートへ当て込む

抽出のための処理は、TypeScriptで行う。

詳しくは `docs/architecture/schema_process_architecture.ja.md`
へ記載したため、必ず読むこと。

**利用するSchemaとテンプレート**:　 registry_command_schema.json
registry_command_template.json

完成したバージョンの参考例： .agent/test-climpt/registry.json
（正解の出力フォーマットではない。Schemaとテンプレートを使った出力例の参考例として、理解の補助に使うだけである。）

## 抽象化レベル

ルール:

1. 実装に具体的な実例1-実例2のパターンを混入しない
2. 実例1-実例2のSchema例とテンプレート例が変更されても、アプリケーションコードに影響がない
3. 実例1-実例2の階層情報が変わっても、アプリケーションコードに影響がない
4. 上記2と3が、設定あるいは引数で解決できている
5. 最終成果物Zは、TypeScript処理による成果物を結合した結果とイコールである。
6. フロントマターの構造多様性を許容し、`x-flatten-arrays`で処理方針を選択
7. 書き手の自由度と読み手の一貫性を両立する設計
8. `{@items}`による統一的な配列展開機能
9. すべての`x-*`ディレクティブは宣言的であり、処理順序は自動決定される
10. ディレクティブの組み合わせにより、複雑な変換を段階的に記述可能

# 参照すべき情報

以下は、実際のユースケースに該当する事例である。 成果物は、ここに挙げた
実例1-実例2
以外のケースにも対応できるように、汎用的に抽象化されたアプリケーションである。
そのアプリケーションが、以下の実例を使って、実際にSchemaからテンプレートへと当て込むことが出来るか検証する目的で例示する。

なお、実際の使用例としては、 examples/
配下に作成し、実行可能な形で再現すること。 tests/
がアプリケーションコードを強固にする役割であり、 examples/
が実例を実行して示す役割である。

## 実例1

### フロントマター解析対象のフォルダ：

`.agent/climpt/prompts`

### 解析結果の保存先：

`.agent/climpt/registry.json`

### 解析結果のSchema：

```json:registry_schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Registry Schema",
  "x-template": "registry_template.json",
  "x-template-items": "registry_command_template.json",
  "description": "Schema for registry configuration with tools and commands",
  "properties": {
    "version": {
      "type": "string",
      "description": "Registry version (e.g., \"1.0.0\")",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "description": {
      "type": "string",
      "description": "Overall registry description"
    },
    "tools": {
      "type": "object",
      "description": "Tool configuration and command registry",
      "properties": {
        "availableConfigs": {
          "type": "array",
          "description": "Tool names array - each becomes available as climpt-{name}. Should contain unique values from commands[].c1",
          "items": {
            "type": "string"
          }
        },
        "commands": {
          "type": "array",
          "description": "Command registry - defines all available C3L commands",
          "items": { "$ref": "registry_command_schema.json" }
        }
      },
      "required": ["availableConfigs", "commands"],
      "additionalProperties": false
    }
  },
  "required": ["version", "description", "tools"],
  "additionalProperties": false
}
```

```json:registry_command_schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Command Schema",
  "description": "Schema for a single command definition",
  "properties": {
    "c1": {
      "type": "string",
      "description": "Domain/category (git, spec, test, code, docs, meta)"
    },
    "c2": {
      "type": "string",
      "description": "Action/directive (create, analyze, execute, etc.)"
    },
    "c3": {
      "type": "string",
      "description": "Target/layer (refinement-issue, quality-metrics, etc.)"
    },
    "title": {
      "type": "string",
      "description": "Command title"
    },
    "description": {
      "type": "string",
      "description": "Command description"
    },
    "usage": {
      "type": "string",
      "description": "Usage instructions and examples"
    },
    "options": {
      "type": "object",
      "description": "Available options for this command",
      "properties": {
        "input": {
          "type": "array",
          "description": "Supported input formats",
          "items": { "type": "string" }
        },
        "adaptation": {
          "type": "array",
          "description": "Processing modes",
          "items": { "type": "string" }
        },
        "input_file": {
          "type": "array",
          "description": "File input support",
          "items": { "type": "boolean" }
        },
        "stdin": {
          "type": "array",
          "description": "Standard input support",
          "items": { "type": "boolean" }
        },
        "destination": {
          "type": "array",
          "description": "Output destination support",
          "items": { "type": "boolean" }
        }
      },
      "additionalProperties": false
    }
  },
  "required": ["c1", "c2", "c3", "description", "usage", "options"],
  "additionalProperties": false
}
```

### 解析結果のテンプレート：

```json:registry_template.json
{
  "version": "{version}",
  "description": "{description}",
  "tools": {
    "availableConfigs": "{tools.availableConfigs}",
    "commands": [
      "{@items}"
    ]
  }
}
```

```json:registry_command_template.json
{
  "c1": "{c1}",
  "c2": "{c2}",
  "c3": "{c3}",
  "title": "{title}",
  "description": "{description}",
  "usage": "{usage}",
  "options": {
    "input": "{options.input}",
    "adaptation": "{options.adaptation}",
    "input_file": "{options.input_file}",
    "stdin": "{options.stdin}",
    "destination": "{options.destination}"
  }
}
```

## 実例2

### フロントマター解析対象のフォルダ：

`.agent/drafts/articles`

### 解析結果の保存先：

`.agent/drafts/books.yml`

### 解析結果のSchema：

```
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "books": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "emoji": { "type": "string" },
          "type": { "type": "string" },
          "topics": {
            "type": "array",
            "items": { "type": "string" }
          },
          "published": { "type": "boolean" },
          "published_at": { "type": "string", "format": "date-time" }
        },
        "required": ["title", "type", "published"],
        "additionalProperties": true
      }
    }
  },
  "required": ["books"],
  "additionalProperties": false
}
```

### 解析結果のテンプレート：

```
books:
  - title: "記事タイトル"
    emoji: "📚"
    type: "tech"
    topics:
      - "claudecode"
      - "codingagents"
    published: true
    published_at: "2025-08-01 10:00"
  # ...他の記事も同様に追加
```
