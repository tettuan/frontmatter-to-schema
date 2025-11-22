# Schema定義のディレクティブと役割

本ドキュメントは、frontmatter-to-schemaプロジェクトにおけるSchema定義のディレクティブ（x-*）の役割を整理し、各定義が何の目的でどのように利用されるかを明確化したものです。

## 1. ディレクティブの分類

### 1.1 処理ステージによる分類（実装準拠の8段階）

Schema定義のディレクティブは、実装に基づく8つのステージで処理されます：

0. **Stage 0: Schema変換** ← ★ yaml-schema-mapper による前処理
   - プロパティ名マッピング（`x-map-from` ディレクティブの処理）
   - 型変換（array ↔ single value, string → number/boolean など）
   - パターンマッチング収集（`x-collect-pattern` ディレクティブの処理）
   - Schema検証（required, enum, pattern など）
   - **重要**: 全ディレクティブ処理の前に実行される

1. **Stage 1: 対象配列の特定**
   - `x-frontmatter-part` - 処理対象の配列を識別

2. **Stage 2: 配列フラット化**
   - `x-flatten-arrays` - 指定プロパティの配列フラット化（オプション）

3. **Stage 3: フィルタリング適用**
   - `x-jmespath-filter` - フラット化されたデータへのJMESPathフィルタリング

4. **Stage 4: 値の集約**
   - `x-derived-from` - 複数ソースからの値集約

5. **Stage 5: 重複削除**
   - `x-derived-unique` - 集約データからの重複削除

6. **Stage 6: データ収集完了**
   - （内部処理ステージ）全ファイルからのデータ収集と統合

7. **Stage 7: テンプレート適用**
   - `x-template` - メインテンプレートの適用
   - `x-template-items` - 個別要素へのテンプレート適用
   - `x-template-format` - 出力形式の指定

### 1.2 役割による分類

ディレクティブは以下の4つの役割に分けられます：

- **処理制御** - データ処理の流れを制御する
  - `x-frontmatter-part`

- **データ抽出・フィルタリング** - フロントマターから値を抽出・選別する
  - `x-flatten-arrays`
  - `x-jmespath-filter`
  - `x-collect-pattern`

- **データ変換・集約** - 抽出したデータを変換・統合する
  - `x-derived-from`
  - `x-derived-unique`

- **テンプレート指定** - 出力フォーマットを決定する
  - `x-template`
  - `x-template-items`
  - `x-template-format`

### 1.3 標準JSON Schema記述との関係

標準のJSON Schema記述要素とカスタムディレクティブの関係：

- **構造定義** - データの型と構造を定義
  - `type`
  - `properties`
  - `items`
  - `$ref`
  - `required`
  - `additionalProperties`

- **検証ルール** - データの妥当性を検証
  - `pattern`
  - `format`
  - `minLength`/`maxLength`
  - `minimum`/`maximum`
  - `enum`

- **ドキュメント** - スキーマの説明
  - `$schema`
  - `title`
  - `description`

- **カスタム処理** - アプリケーション固有の処理（x-*ディレクティブ）
  - 上記の全x-*ディレクティブ

**重要**: 本システムはデフォルト値の生成や補完を行いません。JSON
Schemaの`default`プロパティも使用しません。ただし、値が存在しない場合は
明示的に`null`に置換されます。

### 1.4 Sub-Module Integration

本システムは3つの独立したサブモジュールを使用してディレクティブ処理を実現：

#### Stage 0: yaml-schema-mapper

- **責任範囲**: 生フロントマター → Schema準拠データへの変換
- **処理内容**: Property mapping, Type coercion, Schema validation
- **適用タイミング**: フロントマター抽出直後、全ディレクティブ処理の前
- **モジュールパス**: `sub_modules/yaml-schema-mapper/`

**x-map-from の処理**:

- yaml-schema-mapper が Stage 0 で処理
- Schema定義内の `x-map-from` ディレクティブを解釈
- string | string[] (fallback) 形式をサポート

**変換例**:

```yaml
# Input (raw frontmatter)
file: [false]
stdin: [true]

# Schema
properties:
  input_file: { type: "boolean", x-map-from: "file" }
  stdin: { type: "boolean" }

# Output (after Stage 0)
input_file: false
stdin: true
```

#### Stage 4: data-path-resolver

- **責任範囲**: `x-derived-from` のパス式解決
- **処理内容**: 配列展開構文 (`items[]`) による値の集約
- **適用タイミング**: Stage 4（全体統合フェーズ）
- **モジュールパス**: `sub_modules/data-path-resolver/`

#### Stage 7: json-template

- **責任範囲**: テンプレート変数 `{variable.path}` の置換
- **処理内容**: 階層データアクセス、配列インデックス指定
- **適用タイミング**: Stage 7（テンプレート展開フェーズ）
- **モジュールパス**: `sub_modules/json-template/`

**モジュール独立性**: 各サブモジュールは完全に独立し、相互依存なし

## 2. 各ディレクティブの詳細

### 2.1 処理制御ディレクティブ

#### `x-frontmatter-part`

- **役割**: フロントマター処理の起点指定
- **適用対象**: 配列プロパティ
- **処理ステージ**: Stage 1
- **目的**: 各Markdownファイルの処理で使用する配列を指定
- **動作**: trueが設定された配列の各要素が個別のMarkdownファイル処理単位となる。
  スキーマ内に複数指定がある場合は、ツリーの最上位かつ最初に現れる宣言のみが有効となり、
  それ以降の宣言は同一処理内では無視される。
- **依存関係**: なし（最初に処理される）
- **使用例**:

```json
{
  "commands": {
    "type": "array",
    "x-frontmatter-part": true,
    "items": {...}
  }
}
```

### 2.2 データ抽出・フィルタリングディレクティブ

#### `x-flatten-arrays`

- **役割**: 配列のフラット化処理
- **適用対象**: 配列プロパティ（`x-frontmatter-part: true`と併用）
- **処理ステージ**: Stage 2
- **目的**:
  フロントマター内部のネストした配列構造をフラット化し、テンプレート処理用の均一な配列を生成
- **特徴**: 指定時のみ適用されるオプション機能。デフォルトでは元構造を維持
- **依存関係**: `x-frontmatter-part`の後に処理
- **使用例**:

```json
{
  "trace_ids": {
    "type": "array",
    "description": "フラット化されたトレーサビリティIDの一覧",
    "x-frontmatter-part": true,
    "x-flatten-arrays": "traceability",
    "x-derived-unique": true,
    "x-template-items": "trace_item_template.json"
  }
}
```

**フラット化の動作原理**:

| フロントマター構造                | 指定                                 | 処理結果                       |
| --------------------------------- | ------------------------------------ | ------------------------------ |
| `traceability: ["A", ["B", "C"]]` | `"x-flatten-arrays": "traceability"` | `["A", "B", "C"]`              |
| `traceability: "D"`               | 同上                                 | `["D"]`                        |
| `traceability: ["A", ["B", "C"]]` | **指定なし**                         | `["A", ["B", "C"]]` (構造維持) |
| 複数ファイル                      | 指定時                               | 全要素が`{@items}`で展開       |
| 複数ファイル                      | **指定なし**                         | 元構造のまま`{@items}`で展開   |

#### `x-flatten-arrays`

- **役割**: 配列のフラット化
- **適用対象**: 配列プロパティ
- **処理ステージ**: Stage 2
- **目的**:
  フロントマター内部のネストした配列構造をフラット化し、テンプレート処理用の均一な配列を生成
- **特徴**: 指定時のみ適用される配列フラット化機能
- **依存関係**: `x-frontmatter-part`の後に処理
- **使用例**:

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

#### `x-jmespath-filter`

- **役割**: JMESPath式によるデータ抽出とフィルタリング
- **適用対象**: 配列プロパティ
- **処理ステージ**: Stage 3
- **目的**: 抽出されたデータに対してJMESPath式で選択的抽出やフィルタリング
- **依存関係**:
  `x-flatten-arrays`の後に処理（フラット化されたデータに対して適用）
- **使用例**:

```json
{
  "activeItems": {
    "type": "array",
    "x-jmespath-filter": "items[?status=='active']",
    "items": {...}
  }
}
```

#### `x-collect-pattern`

- **役割**: 正規表現パターンにマッチするプロパティの収集
- **適用対象**: 配列プロパティ
- **処理ステージ**: Stage 0（yaml-schema-mapper内）
- **目的**: 動的なプロパティ名（`uv-*`等のワイルドカードパターン）をkey-value配列として収集
- **依存関係**: yaml-schema-mapper処理時に実行、`additionalProperties: true`が必要
- **詳細仕様**: [x-collect-pattern-specification.md](./x-collect-pattern-specification.md)
- **使用例**:

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

**収集結果の形式**:

```json
[
  { "key": "uv-scope", "value": "domain architecture" },
  { "key": "uv-date", "value": "2025-06-08" }
]
```

### 2.3 データ変換・集約ディレクティブ

#### `x-derived-from`

- **役割**: 派生フィールドの生成
- **適用対象**: 任意のプロパティ
- **処理ステージ**: Stage 5
- **目的**: 他のプロパティから値を集約して新しいフィールドを生成
- **依存関係**: `x-flatten-arrays`の後に処理
- **使用例**:

```json
{
  "availableConfigs": {
    "type": "array",
    "x-derived-from": "commands[].c1",
    "items": { "type": "string" }
  }
}
```

#### `x-derived-unique`

- **役割**: 派生値の重複削除
- **適用対象**: 配列プロパティ（x-derived-fromと併用）
- **処理ステージ**: Stage 6
- **目的**: 派生した配列から重複を削除
- **依存関係**: `x-derived-from`の後に処理
- **使用例**:

```json
{
  "uniqueConfigs": {
    "type": "array",
    "x-derived-from": "commands[].c1",
    "x-derived-unique": true,
    "items": { "type": "string" }
  }
}
```

### 2.4 テンプレート制御ディレクティブ

#### `x-template`

- **役割**: コンテナテンプレートの指定
- **適用対象**: ルートスキーマ
- **処理ステージ**: Stage 7
- **目的**: 最終出力の全体構造を定義するテンプレートファイルを指定
- **依存関係**: `x-derived-unique`と`x-derived-from`の後（最終段階）
- **使用例**:

```json
{
  "x-template": "registry_template.json"
}
```

#### `x-template-items`

- **役割**: アイテムテンプレートの指定
- **適用対象**: ルートスキーマ
- **処理ステージ**: Stage 7
- **目的**: `{@items}`展開時に使用する個別アイテム用テンプレートを指定
- **依存関係**: `x-derived-unique`と`x-derived-from`の後（最終段階）
- **使用例**:

```json
{
  "x-template-items": "command_template.json"
}
```

#### `x-template-format`

- **役割**: 出力フォーマットの明示的指定
- **適用対象**: ルートスキーマ
- **処理ステージ**: Stage 7（テンプレート適用時）
- **目的**:
  出力形式（JSON/TOML/YAML/Markdown）を明示的に指定し、拡張子の自動判定を上書き
- **備考**: テンプレートファイル自体は常にJSON形式で保存・解釈される
- **使用例**:

```json
{
  "x-template-format": "yaml"
}
```

## 3. 処理フローとディレクティブの依存関係

### 3.1 ステージごとの処理順序

```
Stage 1: 対象配列の特定
   └─ x-frontmatter-part: 処理対象配列を識別
        ↓
Stage 2: 配列フラット化
   └─ x-flatten-arrays: 指定プロパティの配列フラット化（オプション）
        ↓
Stage 3: フィルタリング適用
   └─ x-jmespath-filter: フラット化データへのフィルタリング
        ↓
Stage 4: 値の集約
   └─ x-derived-from: 複数ソースからの集約
        ↓
Stage 5: 重複削除
   └─ x-derived-unique: 重複値の除去
        ↓
Stage 6: データ収集完了
   └─ （内部処理）全ファイルのデータ統合
        ↓
Stage 7: テンプレート適用
   ├─ x-template: メインテンプレート
   ├─ x-template-items: アイテムテンプレート
   └─ x-template-format: 出力形式指定
```

### 3.2 ディレクティブの依存グラフ

- `x-frontmatter-part` → なし（起点）
- `x-flatten-arrays` → `x-frontmatter-part`
- `x-jmespath-filter` → `x-flatten-arrays`
- `x-derived-from` → `x-jmespath-filter`, `x-flatten-arrays`
- `x-derived-unique` → `x-derived-from`
- `x-template` → `x-derived-unique`, `x-derived-from`
- `x-template-items` → `x-derived-unique`, `x-derived-from`

### 3.3 ディレクティブの相互作用

- `x-frontmatter-part` と `x-template-items`
  は連携して、配列要素の個別処理とテンプレート適用を制御
- `x-flatten-arrays`
  は指定時のみ適用され、ネストした配列をフラット化してテンプレート処理を簡素化
- `x-jmespath-filter` は `x-flatten-arrays`
  の後に適用され、フラット化されたデータをさらに絞り込む
- `x-derived-from` と `x-derived-unique`
  を組み合わせて、集約データの重複を自動削除

## 4. 設計原則

### 4.1 宣言的な定義

すべてのディレクティブは宣言的であり、「どのように」ではなく「何を」するかを記述します。処理順序は依存関係に基づいて自動的に決定されます。

### 4.2 柔軟性の確保

- フロントマターの構造（配列/単一）に依存しない処理を実現
- 書き手の自由度と読み手の一貫性を両立
- Schema変更に対してアプリケーション変更が不要

### 4.3 関心の分離

- **Schema**: データの構造と抽出ルールを定義
- **テンプレート**: 出力フォーマットを定義
- 両者は独立しており、`$ref`はスキーマ構造の再利用にのみ使用

### 4.4 制約事項

- **デフォルト値の非対応**: 本システムはデフォルト値の生成や補完を行いません
- **実データのみ処理**: フロントマターに実際に存在するデータのみを扱います
- **値が存在しない場合**: 存在しないデータは明示的に`null`として扱われます
- **値の自動生成禁止**: 初期値設定や推測による値補完は行いません

## 5. 実装上の注意点

### 5.1 処理順序の保証

ディレクティブは7つのステージで順次処理され、各ステージ内での処理は並列化可能ですが、ステージ間の順序は厳密に保証されます。

### 5.2 エラーハンドリング

- 不正なパス指定：該当するプロパティが見つからない場合は`null`を返す
- 型の不一致：期待する型と異なる場合は適切な変換を試みる
- テンプレートファイル不在：明確なエラーメッセージを表示
- 循環依存：DirectiveOrderManagerが検出してエラーを返す

### 5.3 パフォーマンス最適化

- パス解決の処理はキャッシュされ、同じパスへの重複アクセスを避ける
- `x-jmespath-filter` で早期にフィルタリングすることで後続処理を軽量化
- `x-derived-from` の集約は遅延評価され、必要時のみ実行される
- 各ステージ内での並列処理により処理時間を短縮

## 6. ユースケース別ガイド

### 6.1 トレーサビリティID収集（フラット化あり）

```json
{
  "trace_ids": {
    "type": "array",
    "description": "フラット化されたトレーサビリティIDの一覧",
    "x-frontmatter-part": true,
    "x-flatten-arrays": "traceability",
    "x-derived-unique": true,
    "x-template-items": "trace_item_template.json"
  }
}
```

処理順序：

1. `x-frontmatter-part`で対象配列を特定
2. `x-flatten-arrays`でtraceabilityプロパティをフラット化
3. 全ファイルのフラット化結果を統合
4. `x-derived-unique`で重複を削除

### 6.2 コマンドレジストリ構築

```json
{
  "tools": {
    "availableConfigs": {
      "type": "array",
      "x-derived-from": "commands[].c1",
      "x-derived-unique": true
    },
    "commands": {
      "type": "array",
      "x-frontmatter-part": true,
      "items": { "$ref": "command_schema.json" }
    }
  }
}
```

処理順序：

1. `x-frontmatter-part`でcommandsを処理対象に
2. 各コマンドデータを収集（フラット化なし）
3. `x-derived-from`でc1値を集約
4. `x-derived-unique`で重複を削除

### 6.3 条件付きアイテム集約（構造維持）

```json
{
  "activeItems": {
    "type": "array",
    "description": "アクティブなアイテムの集約（元構造維持）",
    "x-frontmatter-part": true,
    "x-jmespath-filter": "items[?status=='active']"
  }
}
```

処理順序：

1. `x-frontmatter-part`で処理開始
2. フロントマターの元構造を維持（フラット化なし）
3. `x-jmespath-filter`でアクティブなものだけ選別
4. 全ファイルの結果を自動統合

## まとめ

Schema定義のディレクティブは、フロントマターからテンプレート出力までの全処理フローを7つのステージで制御する重要な機能です。各ディレクティブは明確な役割と依存関係を持ち、処理順序に従って適切に組み合わせることで、柔軟かつ強力なデータ変換パイプラインを構築できます。

本システムは実データの抽出と変換に特化しており、デフォルト値の生成や補完は行いません。値が存在しない場合は明示的に`null`として扱われます。これにより、予測可能で透明性の高い処理を実現しています。

開発者は、このドキュメントを参照することで、どのディレクティブをどの目的で使用すべきか瞬時に理解し、適切なSchema定義を作成できます。
